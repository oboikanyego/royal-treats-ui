import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommerceState } from '../commerce-state.service';
import { ORDERS_PATH } from '../navigation';
import { OrderTrackingService } from '../order-tracking.service';

@Component({
  selector: 'section[rt-success]',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.component.html',
  host: { class: 'success' },
})
export class SuccessComponent {
  readonly tracking = inject(OrderTrackingService);
  readonly store = inject(CommerceState);
  readonly ordersPath = ORDERS_PATH;
}
