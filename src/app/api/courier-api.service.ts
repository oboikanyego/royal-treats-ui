import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { ApiCourierJob, ApiOrder, Paginated } from './api-types';

/** The signed-in courier's side of royal-treats-api. A courier's own deliveries come from GET /orders. */
@Injectable({ providedIn: 'root' })
export class CourierApi {
  private readonly api = inject(ApiClient);

  /** Deliveries nobody has accepted yet. The API shows only the date, time and distance until accepted. */
  jobs(page: number, limit: number): Promise<Paginated<ApiCourierJob>> {
    return firstValueFrom(this.api.get<Paginated<ApiCourierJob>>('/courier/jobs', { page, limit }));
  }

  /** First courier to accept gets the job (and then sees the customer's details). */
  accept(id: string): Promise<ApiOrder> {
    return firstValueFrom(
      this.api.post<ApiOrder>(`/courier/jobs/${encodeURIComponent(id)}/accept`),
    );
  }
}
