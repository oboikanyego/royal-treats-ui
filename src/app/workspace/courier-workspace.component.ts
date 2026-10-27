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
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import type { ApiCourierJob } from '../api/api-types';
import { CourierApi } from '../api/courier-api.service';
import { courierErrorMessage } from '../api/courier-messages';
import {
  type CourierJob,
  byDue,
  distanceLabel,
  fromApiJob,
  splitDeliveries,
} from '../api/courier-view';
import { OrderFeed } from '../api/order-feed';
import { OrdersApi } from '../api/orders-api.service';
import type { DeliveryOrder } from '../commerce-state.service';
import { groupByRecipient, statusLabel } from '../order-view';
import { RandPipe } from '../rand.pipe';

const REFRESH_MS = 30_000;
const PAGE_SIZE = 50;

/** A courier's day: deliveries to accept, and the ones they have accepted. */
@Component({
  selector: 'rt-courier-workspace',
  standalone: true,
  imports: [CommonModule, RandPipe],
  templateUrl: './courier-workspace.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class CourierWorkspaceComponent implements OnInit {
  private readonly courierApi = inject(CourierApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly feed = new OrderFeed(
    (page, limit) => this.ordersApi.list(page, limit),
    PAGE_SIZE,
  );

  readonly jobs = signal<CourierJob[]>([]);
  readonly jobsStatus = signal<'loading' | 'ready' | 'error'>('loading');
  readonly deliveriesStatus = this.feed.status;
  readonly deliveries = computed(() => splitDeliveries(this.feed.orders()));
  readonly message = signal<{ kind: 'error' | 'notice'; text: string } | null>(null);
  readonly accepting = signal<string | null>(null);
  readonly confirming = signal<string | null>(null);
  readonly completing = signal<string | null>(null);

  readonly groupByRecipient = groupByRecipient;
  readonly distanceLabel = distanceLabel;
  readonly statusText = (order: DeliveryOrder) => statusLabel(order.status, order.fulfillment);
  readonly isSet = (value: string | undefined) => !!value;

  constructor() {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void this.loadJobs(false);
      void this.feed.refresh(false);
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.message.set(null);
    const [, failure] = await Promise.all([this.loadJobs(true), this.feed.refresh(true)]);
    if (failure) this.fail(failure, 'jobs');
  }

  /** `initial` shows the loading state; later refreshes are silent and keep what is on screen. */
  private async loadJobs(initial: boolean) {
    if (initial) this.jobsStatus.set('loading');
    try {
      const page = await this.courierApi.jobs(1, PAGE_SIZE);
      this.jobs.set(page.items.map((j: ApiCourierJob) => fromApiJob(j)).sort(byDue));
      this.jobsStatus.set('ready');
    } catch (failure) {
      if (!initial) return;
      this.jobsStatus.set('error');
      this.fail(failure, 'jobs');
    }
  }

  private fail(failure: unknown, context: 'jobs' | 'accept' | 'complete') {
    this.message.set({ kind: 'error', text: courierErrorMessage(toApiError(failure), context) });
  }

  async accept(job: CourierJob) {
    this.accepting.set(job.id);
    try {
      const order = fromApiOrder(await this.courierApi.accept(job.id));
      this.jobs.update((list) => list.filter((j) => j.id !== job.id));
      this.feed.add(order);
      this.message.set({
        kind: 'notice',
        text: `You accepted ${order.ref}. Contact the customer before delivery.`,
      });
    } catch (failure) {
      this.fail(failure, 'accept');
      void this.loadJobs(false); // someone else probably took it; show what is left
    } finally {
      this.accepting.set(null);
    }
  }

  canComplete(order: DeliveryOrder): boolean {
    return !!order.allowedStatuses?.includes('Completed');
  }

  async complete(order: DeliveryOrder) {
    this.completing.set(order.id);
    try {
      const updated = fromApiOrder(await this.ordersApi.setStatus(order.id, 'Completed'));
      this.feed.replace(updated);
      this.message.set({ kind: 'notice', text: `${updated.ref} was marked as delivered.` });
    } catch (failure) {
      this.fail(failure, 'complete');
      void this.feed.refresh(false);
    } finally {
      this.completing.set(null);
      this.confirming.set(null);
    }
  }
}
