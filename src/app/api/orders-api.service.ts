import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { ApiOrder, OrderRequest, Paginated } from './api-types';

/** The signed-in customer's orders (royal-treats-api /orders). */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly api = inject(ApiClient);

  /**
   * Places an order. The idempotency key makes a retry safe: the same key with the same order
   * returns the order already created (200) instead of creating a second one.
   */
  place(request: OrderRequest, idempotencyKey: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.api.post<ApiOrder>('/orders', request, { 'Idempotency-Key': idempotencyKey }),
    );
  }
  /** `statuses` limits the list on the server, before paging (e.g. ['Confirmed', 'Preparing']). */
  list(page: number, limit: number, statuses?: string[]): Promise<Paginated<ApiOrder>> {
    const params: Record<string, string | number> = { page, limit };
    if (statuses?.length) params['status'] = statuses.join(',');
    return firstValueFrom(this.api.get<Paginated<ApiOrder>>('/orders', params));
  }
  /** The printable receipt for an order, as HTML. */
  receipt(id: string): Promise<string> {
    return firstValueFrom(this.api.getText(`/orders/${encodeURIComponent(id)}/receipt`));
  }
  setStatus(id: string, status: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.api.patch<ApiOrder>(`/orders/${encodeURIComponent(id)}/status`, { status }),
    );
  }
}
