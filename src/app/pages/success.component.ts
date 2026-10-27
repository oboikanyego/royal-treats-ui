import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlacedOrder } from '../placed-order.service';

@Component({
  selector: 'section[rt-success]',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.component.html',
  host: { class: 'success' },
})
export class SuccessComponent {
  readonly placed = inject(PlacedOrder);
}
