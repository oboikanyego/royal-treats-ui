import type { CartItem } from '../cart.service';
import type { OrderRequest } from './api-types';

export type CheckoutForm = {
  fulfillment: 'collection' | 'delivery';
  date: string;
  time: string;
  notes: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

/**
 * The body of POST /orders. Prices, totals, the customer and the status are never sent: the
 * server owns them. Delivery details are only included for a delivery (the API rejects unknown
 * keys but treats absent ones as "not a delivery").
 */
export function buildOrderRequest(items: readonly CartItem[], form: CheckoutForm): OrderRequest {
  const request: OrderRequest = {
    fulfillment: form.fulfillment,
    date: form.date,
    time: form.time,
    notes: form.notes.trim(),
    items: items.map((i) => ({
      productId: i.productId,
      variant: i.variant,
      qty: i.qty,
      sauce: i.sauce,
      topping: i.topping,
      recipient: (i.recipient ?? '').trim(),
    })),
  };
  if (form.fulfillment === 'delivery') {
    request.address = form.address.trim();
    if (form.latitude !== null) request.latitude = form.latitude;
    if (form.longitude !== null) request.longitude = form.longitude;
  }
  return request;
}

/**
 * The Idempotency-Key for a checkout. The same order retried (after a timeout, say) must reuse its
 * key so the server answers with the order it already created; a changed order needs a new key, or
 * the server refuses it. The key is therefore tied to the exact request body.
 */
export class AttemptKeys {
  private last?: { body: string; key: string };

  constructor(private readonly newKey: () => string = () => crypto.randomUUID()) {}

  keyFor(request: OrderRequest): string {
    const body = JSON.stringify(request);
    if (this.last?.body !== body) this.last = { body, key: this.newKey() };
    return this.last.key;
  }

  /** Call after an order was placed, so the next order starts with a fresh key. */
  reset(): void {
    this.last = undefined;
  }
}
