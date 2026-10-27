import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import { orderErrorMessage } from '../api/order-messages';
import { OrdersApi } from '../api/orders-api.service';
import { CommerceState, DeliveryOrder } from '../commerce-state.service';
import { groupByRecipient, mergeOrders, stepDone, stepsFor } from '../order-view';
import { RandPipe } from '../rand.pipe';

const PAGE_SIZE = 20;
const REFRESH_MS = 30_000;

/** The signed-in customer's orders, with live status and cancellation while an order is Pending. */
@Component({
  selector: 'section[rt-orders]',
  standalone: true,
  imports: [CommonModule, RouterLink, RandPipe],
  templateUrl: './orders.component.html',
})
export class OrdersComponent {
  readonly store = inject(CommerceState);
  private readonly ordersApi = inject(OrdersApi);

  readonly orders = signal<DeliveryOrder[]>([]);
  readonly total = signal(0);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly loadingMore = signal(false);
  readonly message = signal<{ kind: 'error' | 'notice'; text: string } | null>(null);
  /** The order whose "cancel" is awaiting confirmation, and the one being cancelled. */
  readonly confirming = signal<string | null>(null);
  readonly cancelling = signal<string | null>(null);
  readonly isCustomer = computed(() => this.store.session()?.role === 'customer');

  readonly stepsFor = stepsFor;
  readonly stepDone = stepDone;
  readonly groupByRecipient = groupByRecipient;
  readonly isSet = (value: string | undefined) => !!value;

  constructor() {
    // Load when a customer is (or becomes) signed in; forget everything when they are not.
    effect(() => {
      const customer = this.isCustomer();
      untracked(() => {
        if (customer) void this.refresh(true);
        else this.clear();
      });
    });
    // Statuses change as the shop works on the order, so keep the list fresh while it is open.
    const timer = setInterval(() => {
      if (this.isCustomer() && document.visibilityState === 'visible') void this.refresh(false);
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private clear() {
    this.orders.set([]);
    this.total.set(0);
    this.status.set('idle');
    this.message.set(null);
  }

  /** `initial` shows the loading state; later refreshes are silent and keep what is on screen. */
  async refresh(initial: boolean) {
    if (initial) this.status.set('loading');
    try {
      const page = await this.ordersApi.list(1, PAGE_SIZE);
      const fresh = page.items.map(fromApiOrder);
      this.orders.update((current) => (initial ? fresh : mergeOrders(current, fresh)));
      this.total.set(page.total);
      this.status.set('ready');
      if (initial) this.message.set(null);
    } catch (error) {
      if (!initial) return; // a silent refresh just tries again next time
      this.status.set('error');
      this.message.set({ kind: 'error', text: orderErrorMessage(toApiError(error), 'list') });
    }
  }

  async loadMore() {
    this.loadingMore.set(true);
    try {
      const next = Math.ceil(this.orders().length / PAGE_SIZE) + 1;
      const page = await this.ordersApi.list(next, PAGE_SIZE);
      const known = new Set(this.orders().map((o) => o.id));
      this.orders.update((current) => [
        ...current,
        ...page.items.filter((o) => !known.has(o.id)).map(fromApiOrder),
      ]);
      this.total.set(page.total);
    } catch (error) {
      this.message.set({ kind: 'error', text: orderErrorMessage(toApiError(error), 'list') });
    } finally {
      this.loadingMore.set(false);
    }
  }

  canCancel(order: DeliveryOrder): boolean {
    return !!order.allowedStatuses?.includes('Cancelled');
  }

  async cancel(order: DeliveryOrder) {
    this.cancelling.set(order.id);
    try {
      const updated = fromApiOrder(await this.ordersApi.setStatus(order.id, 'Cancelled'));
      this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      this.message.set({ kind: 'notice', text: `Order ${updated.ref} was cancelled.` });
    } catch (error) {
      this.message.set({ kind: 'error', text: orderErrorMessage(toApiError(error), 'cancel') });
      void this.refresh(false); // the order has probably moved on; show how
    } finally {
      this.cancelling.set(null);
      this.confirming.set(null);
    }
  }
}
