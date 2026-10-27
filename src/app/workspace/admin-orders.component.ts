import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import { type OrderFilter, matchesFilter, statusActionLabel } from '../api/admin-view';
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import { OrderFeed } from '../api/order-feed';
import { OrdersApi } from '../api/orders-api.service';
import type { DeliveryOrder } from '../commerce-state.service';
import { groupByRecipient } from '../order-view';
import { RandPipe } from '../rand.pipe';

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
  private readonly feed = new OrderFeed((page, limit) => this.ordersApi.list(page, limit), 20);
  readonly status = this.feed.status;
  readonly total = this.feed.total;
  readonly loaded = this.feed.orders;
  readonly loadingMore = this.feed.loadingMore;

  readonly filter = signal<OrderFilter>('all');
  readonly orders = computed(() =>
    this.loaded().filter((o) => matchesFilter(o.status, this.filter())),
  );
  readonly message = signal<{ kind: 'error' | 'notice'; text: string } | null>(null);
  readonly confirming = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  readonly courierNames = signal<Record<string, string>>({});

  readonly groupByRecipient = groupByRecipient;
  readonly actionLabel = statusActionLabel;
  readonly isSet = (value: string | undefined) => !!value;

  constructor() {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.feed.refresh(false);
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    void this.refresh();
    void this.loadCourierNames();
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

  async change(order: DeliveryOrder, status: string) {
    this.busy.set(order.id);
    try {
      const updated = fromApiOrder(await this.ordersApi.setStatus(order.id, status));
      this.feed.replace(updated);
      this.message.set({ kind: 'notice', text: `${updated.ref} is now ${updated.status}.` });
    } catch (failure) {
      this.message.set({ kind: 'error', text: adminErrorMessage(toApiError(failure), 'status') });
      void this.feed.refresh(false); // the order has probably moved on; show how
    } finally {
      this.busy.set(null);
      this.confirming.set(null);
    }
  }
}
