import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { AdminLive } from '../api/admin-live.service';
import { adminErrorMessage } from '../api/admin-messages';
import { type OrderFilter, statusActionLabel, statusesFor } from '../api/admin-view';
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import { OrderFeed } from '../api/order-feed';
import { OrdersApi } from '../api/orders-api.service';
import type { DeliveryOrder } from '../commerce-state.service';
import type { ApiUser } from '../api/api-types';
import { groupByRecipient, mapsLink, statusLabel } from '../order-view';
import { RandPipe } from '../rand.pipe';
import { ReceiptViewer } from '../receipt-viewer.service';

const REFRESH_MS = 30_000;

/** Every order, newest first. Staff move an order only along the transitions the API allows. */
@Component({
  selector: 'rt-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RandPipe],
  templateUrl: './admin-orders.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminOrdersComponent implements OnInit {
  private readonly ordersApi = inject(OrdersApi);
  private readonly admin = inject(AdminApi);
  readonly live = inject(AdminLive);
  readonly receipts = inject(ReceiptViewer);
  private readonly feed = new OrderFeed(
    (page, limit) => this.ordersApi.list(page, limit, statusesFor(this.filter())),
    20,
  );
  readonly status = this.feed.status;
  readonly total = this.feed.total;
  readonly loaded = this.feed.orders;
  readonly loadingMore = this.feed.loadingMore;

  /** The filter is applied by the API, so it covers every order, not just the ones loaded. */
  readonly filter = signal<OrderFilter>('all');
  readonly orders = this.feed.orders;
  readonly filters: { value: OrderFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Waiting' },
    { value: 'active', label: 'In progress' },
    { value: 'completed', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' },
  ];
  readonly message = signal<{ kind: 'error' | 'notice'; text: string } | null>(null);
  readonly confirming = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly courierNames = signal<Record<string, string>>({});
  /** Couriers an order can be given to (active ones), and the one picked on each order's card. */
  readonly couriers = signal<ApiUser[]>([]);
  readonly choice = signal<Record<string, string>>({});
  readonly assigning = signal<string | null>(null);

  readonly groupByRecipient = groupByRecipient;
  readonly actionLabel = statusActionLabel;
  readonly statusText = (order: DeliveryOrder) => statusLabel(order.status, order.fulfillment);
  readonly isSet = (value: string | undefined) => !!value;
  readonly mapsLink = mapsLink;

  constructor() {
    // A new order, or a change reported by the API, shows up without waiting for the 30 s refresh.
    let first = true;
    effect(() => {
      this.live.changes();
      untracked(() => {
        if (first) first = false;
        else void this.feed.refresh(false);
      });
    });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.feed.refresh(false);
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    void this.refresh();
    void this.loadCourierNames();
  }

  setFilter(filter: OrderFilter) {
    this.filter.set(filter);
    void this.refresh();
  }

  async refresh() {
    const failure = await this.feed.refresh(true);
    this.message.set(
      failure ? { kind: 'error', text: adminErrorMessage(toApiError(failure), 'orders') } : null,
    );
  }

  async loadMore() {
    const failure = await this.feed.loadMore();
    if (failure)
      this.message.set({ kind: 'error', text: adminErrorMessage(toApiError(failure), 'orders') });
  }

  /** Names for the courier ids on orders; the orders are still useful if this fails. */
  private async loadCourierNames() {
    try {
      const page = await this.admin.couriers(1, 100);
      this.courierNames.set(Object.fromEntries(page.items.map((c) => [c.id, c.name])));
      this.couriers.set(page.items.filter((c) => c.active));
    } catch {
      // Orders then show "a courier" instead of a name.
    }
  }

  courierLabel(order: DeliveryOrder): string {
    return order.courierId ? (this.courierNames()[order.courierId] ?? 'a courier') : '';
  }

  waitingForCourier(order: DeliveryOrder): boolean {
    return order.status === 'Ready for Delivery' && !order.courierId;
  }

  /** A delivery that is ready, or already out, can be handed to a courier (or to another one). */
  canAssign(order: DeliveryOrder): boolean {
    return (
      order.fulfillment === 'delivery' &&
      (order.status === 'Ready for Delivery' || order.status === 'Out for Delivery') &&
      this.couriers().length > 0
    );
  }

  /** The courier shown in the order's box: the one picked, else the one already assigned. */
  chosen(order: DeliveryOrder): string {
    return this.choice()[order.id] ?? order.courierId ?? '';
  }

  pick(order: DeliveryOrder, courierId: string) {
    this.choice.update((c) => ({ ...c, [order.id]: courierId }));
  }

  async assign(order: DeliveryOrder) {
    const courierId = this.chosen(order);
    if (!courierId) {
      this.message.set({ kind: 'error', text: 'Choose a courier first.' });
      return;
    }
    this.assigning.set(order.id);
    try {
      const updated = fromApiOrder(await this.admin.assignCourier(order.id, courierId));
      this.show(updated);
      this.message.set({
        kind: 'notice',
        text: `${updated.ref} was given to ${this.courierNames()[courierId] ?? 'the courier'}.`,
      });
    } catch (failure) {
      this.message.set({ kind: 'error', text: adminErrorMessage(toApiError(failure), 'assign') });
      void this.feed.refresh(false);
    } finally {
      this.assigning.set(null);
    }
  }

  /** Puts an updated order in the list, or takes it out if it no longer matches the filter. */
  private show(updated: DeliveryOrder) {
    const wanted = statusesFor(this.filter());
    if (wanted && !wanted.includes(updated.status)) this.feed.remove(updated.id);
    else this.feed.replace(updated);
  }

  async change(order: DeliveryOrder, status: string) {
    this.busy.set(order.id);
    try {
      const updated = fromApiOrder(await this.ordersApi.setStatus(order.id, status));
      this.show(updated);
      this.message.set({
        kind: 'notice',
        text: `${updated.ref} is now ${this.statusText(updated)}.`,
      });
    } catch (failure) {
      this.message.set({ kind: 'error', text: adminErrorMessage(toApiError(failure), 'status') });
      void this.feed.refresh(false); // the order has probably moved on; show how
    } finally {
      this.busy.set(null);
      this.confirming.set(null);
    }
  }
}
