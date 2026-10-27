import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import { orderErrorMessage } from '../api/order-messages';
import { OrderFeed } from '../api/order-feed';
import { OrdersApi } from '../api/orders-api.service';
import { CommerceState, DeliveryOrder } from '../commerce-state.service';
import { groupByRecipient, stepDone, stepsFor } from '../order-view';
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

  private readonly feed = new OrderFeed(
    (page, limit) => this.ordersApi.list(page, limit),
    PAGE_SIZE,
  );
  readonly orders = this.feed.orders;
  readonly total = this.feed.total;
  readonly status = this.feed.status;
  readonly loadingMore = this.feed.loadingMore;
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
    this.feed.clear();
    this.message.set(null);
  }

  /** `initial` shows the loading state; later refreshes are silent and keep what is on screen. */
  async refresh(initial: boolean) {
    const failure = await this.feed.refresh(initial);
    if (initial) {
      this.message.set(
        failure ? { kind: 'error', text: orderErrorMessage(toApiError(failure), 'list') } : null,
      );
    }
  }

  async loadMore() {
    const failure = await this.feed.loadMore();
    if (failure)
      this.message.set({ kind: 'error', text: orderErrorMessage(toApiError(failure), 'list') });
  }

  canCancel(order: DeliveryOrder): boolean {
    return !!order.allowedStatuses?.includes('Cancelled');
  }

  async cancel(order: DeliveryOrder) {
    this.cancelling.set(order.id);
    try {
      const updated = fromApiOrder(await this.ordersApi.setStatus(order.id, 'Cancelled'));
      this.feed.replace(updated);
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
