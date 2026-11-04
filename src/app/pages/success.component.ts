import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InstallPrompt } from '../install-prompt.service';
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
  readonly install = inject(InstallPrompt);
  /** Decided once when the page opens, so tapping a button does not make the card jump away. */
  readonly offer = signal(this.install.shouldOffer());
  readonly added = signal(false);

  constructor() {
    // The offer is made once per device, whether or not it is accepted.
    if (this.offer()) this.install.markAsked();
  }

  async add(): Promise<void> {
    this.added.set(await this.install.install());
    if (this.added()) this.offer.set(false);
  }

  notNow(): void {
    this.offer.set(false);
  }
}
