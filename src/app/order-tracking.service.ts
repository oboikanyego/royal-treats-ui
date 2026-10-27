import { Injectable, computed, inject, signal } from '@angular/core';
import { CommerceState, DeliveryOrder } from './commerce-state.service';
import { stepDone, stepsFor } from './order-view';

/** What checkout hands over to the confirmation and tracking pages. */
@Injectable({ providedIn: 'root' })
export class OrderTrackingService {
  private readonly store = inject(CommerceState);

  /** The order just placed in this visit; the confirmation page needs it. */
  readonly lastOrder = signal<DeliveryOrder | null>(null);
  readonly trackedId = signal<string | null>(null);
  /** Lookup form fields, prefilled after checkout. */
  ref = '';
  phone = '';

  /** Always the store's current record, so the status follows admin/courier updates. */
  readonly tracked = computed(
    () => this.store.deliveries().find((o) => o.id === this.trackedId()) ?? null,
  );
  readonly steps = computed(() => stepsFor(this.tracked()?.fulfillment ?? 'collection'));

  /** Remember a freshly placed order and prefill the tracking form with it. */
  placed(order: DeliveryOrder): void {
    this.lastOrder.set(order);
    this.trackedId.set(order.id);
    this.ref = order.id;
    this.phone = order.phone;
  }

  lookup(): void {
    const digits = (value: string) => value.replace(/\D/g, '');
    const entry = this.store
      .deliveries()
      .find(
        (o) =>
          o.id.toLowerCase() === this.ref.trim().toLowerCase() &&
          digits(o.phone) === digits(this.phone),
      );
    this.trackedId.set(entry?.id ?? null);
  }

  stepDone(step: string): boolean {
    return stepDone(this.steps(), this.tracked()?.status ?? '', step);
  }
}
