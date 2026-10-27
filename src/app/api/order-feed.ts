import { signal } from '@angular/core';
import type { DeliveryOrder } from '../commerce-state.service';
import { fromApiOrder } from './api-mappers';
import type { ApiOrder, Paginated } from './api-types';
import { mergeOrders } from '../order-view';

export type FeedStatus = 'idle' | 'loading' | 'ready' | 'error';

/** A newest-first, paged list of orders that can be refreshed in the background. */
export class OrderFeed {
  readonly orders = signal<DeliveryOrder[]>([]);
  readonly total = signal(0);
  readonly status = signal<FeedStatus>('idle');
  readonly loadingMore = signal(false);

  constructor(
    private readonly fetchPage: (page: number, limit: number) => Promise<Paginated<ApiOrder>>,
    private readonly pageSize = 20,
  ) {}

  clear() {
    this.orders.set([]);
    this.total.set(0);
    this.status.set('idle');
  }

  /**
   * `initial` shows the loading state and replaces the list; later refreshes are silent, keep what is
   * on screen, and merge the first page into it. Returns the failure of an initial load, else null.
   */
  async refresh(initial: boolean): Promise<unknown> {
    if (initial) this.status.set('loading');
    try {
      const page = await this.fetchPage(1, this.pageSize);
      const fresh = page.items.map(fromApiOrder);
      this.orders.update((current) =>
        initial ? fresh : mergeOrders(current, fresh, this.pageSize),
      );
      this.total.set(page.total);
      this.status.set('ready');
      return null;
    } catch (error) {
      if (!initial) return null; // a silent refresh just tries again next time
      this.status.set('error');
      return error;
    }
  }

  /** Appends the next page; returns the failure, or null. */
  async loadMore(): Promise<unknown> {
    this.loadingMore.set(true);
    try {
      const next = Math.ceil(this.orders().length / this.pageSize) + 1;
      const page = await this.fetchPage(next, this.pageSize);
      const known = new Set(this.orders().map((o) => o.id));
      this.orders.update((current) => [
        ...current,
        ...page.items.filter((o) => !known.has(o.id)).map(fromApiOrder),
      ]);
      this.total.set(page.total);
      return null;
    } catch (error) {
      return error;
    } finally {
      this.loadingMore.set(false);
    }
  }

  /** Puts an order the server just returned (e.g. a delivery just accepted) at the top of the list. */
  add(order: DeliveryOrder) {
    this.orders.update((list) => [order, ...list.filter((o) => o.id !== order.id)]);
    this.total.update((n) => n + 1);
  }

  /** Takes an order out of the list, e.g. one that no longer matches the status filter. */
  remove(id: string) {
    const before = this.orders().length;
    this.orders.update((list) => list.filter((o) => o.id !== id));
    if (this.orders().length < before) this.total.update((n) => Math.max(0, n - 1));
  }

  /** Swaps in an order the server just returned (after a status change). */
  replace(order: DeliveryOrder) {
    this.orders.update((list) => list.map((o) => (o.id === order.id ? order : o)));
  }
}
