import { Injectable, signal } from '@angular/core';
import type { DeliveryOrder } from './commerce-state.service';

/** The order just placed in this visit: checkout hands it to the confirmation page. */
@Injectable({ providedIn: 'root' })
export class PlacedOrder {
  readonly last = signal<DeliveryOrder | null>(null);

  placed(order: DeliveryOrder): void {
    this.last.set(order);
  }
}
