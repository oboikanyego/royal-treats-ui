import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommerceState } from '../commerce-state.service';
import { ORDERS_PATH } from '../navigation';

@Component({
  selector: 'section[rt-contact]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact.component.html',
  host: { class: 'support-page' },
})
export class ContactComponent {
  readonly store = inject(CommerceState);
  readonly ordersPath = ORDERS_PATH;
  supportSubject = 'Order support';
  supportMessage = '';

  emailReady() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.store.settings().supportEmail || '');
  }
  supportHref() {
    const email = this.store.settings().supportEmail;
    return (
      'mailto:' +
      email +
      '?subject=' +
      encodeURIComponent(this.supportSubject) +
      '&body=' +
      encodeURIComponent(this.supportMessage)
    );
  }
}
