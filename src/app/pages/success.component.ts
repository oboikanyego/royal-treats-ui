import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderTrackingService } from '../order-tracking.service';

@Component({
  selector: 'section[rt-success]',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './success.component.html',
  host: { class: 'success' },
})
export class SuccessComponent {
  readonly tracking = inject(OrderTrackingService);
}
