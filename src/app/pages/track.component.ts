import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrderTrackingService } from '../order-tracking.service';

@Component({
  selector: 'section[rt-track]',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './track.component.html',
})
export class TrackComponent {
  readonly tracking = inject(OrderTrackingService);
  trackSearched = false;

  track() {
    this.trackSearched = true;
    this.tracking.lookup();
  }
}
