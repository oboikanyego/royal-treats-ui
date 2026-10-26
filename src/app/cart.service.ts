import { Injectable, computed, signal } from '@angular/core';
import { CommerceState } from './commerce-state.service';

export type CartItem = {
  productId: string;
  name: string;
  image: string;
  variant: string;
  price: number;
  qty: number;
  sauce: string;
  topping: string;
  recipient?: string;
};

const STORAGE_KEY = 'rt-cart';
const RECIPIENT_MAX = 45;

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>([]);
  readonly count = computed(() => this.items().reduce((n, x) => n + x.qty, 0));
  readonly total = computed(() => this.items().reduce((n, x) => n + x.qty * x.price, 0));
  readonly recipients = computed(() => [
    ...new Set(this.items().map((i) => i.recipient?.trim() || 'Shared treats')),
  ]);

  constructor(private readonly store: CommerceState) {
    this.items.set(this.load());
  }

  /** Add a line, merging into an identical existing one (same product, options and recipient). */
  add(item: CartItem): void {
    const recipient = (item.recipient ?? '').trim().slice(0, RECIPIENT_MAX);
    const line = { ...item, recipient };
    const same = (i: CartItem) =>
      i.productId === line.productId &&
      i.variant === line.variant &&
      i.sauce === line.sauce &&
      i.topping === line.topping &&
      (i.recipient || '') === recipient;
    const items = this.items();
    this.set(
      items.some(same)
        ? items.map((i) => (same(i) ? { ...i, qty: i.qty + line.qty } : i))
        : [...items, line],
    );
  }

  setRecipient(item: CartItem, recipient: string): void {
    this.set(
      this.items().map((x) =>
        x === item ? { ...x, recipient: recipient.slice(0, RECIPIENT_MAX) } : x,
      ),
    );
  }

  changeQty(item: CartItem, delta: number): void {
    this.set(
      this.items()
        .map((x) => (x === item ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  }

  remove(item: CartItem): void {
    this.set(this.items().filter((x) => x !== item));
  }

  clear(): void {
    this.set([]);
  }

  private set(items: CartItem[]): void {
    this.items.set(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked: the cart still works for this visit.
    }
  }

  /** Carts saved before lines carried a product id are matched back to the catalogue by name once. */
  private load(): CartItem[] {
    let saved: Partial<CartItem>[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(parsed)) saved = parsed;
    } catch {
      saved = [];
    }
    const products = this.store.products();
    return saved.map((i) => ({
      productId: i.productId ?? products.find((p) => p.name === i.name)?.id ?? '',
      name: i.name ?? '',
      image: i.image ?? '',
      variant: i.variant ?? '',
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 1,
      sauce: i.sauce ?? '',
      topping: i.topping ?? '',
      recipient: i.recipient,
    }));
  }
}
