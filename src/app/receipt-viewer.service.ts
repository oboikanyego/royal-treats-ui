import { Injectable, inject, signal } from '@angular/core';
import { OrdersApi } from './api/orders-api.service';
import { toApiError } from './api/api-errors';

/** The receipt shown in the print dialog: loading, failed, or ready as HTML. */
@Injectable({ providedIn: 'root' })
export class ReceiptViewer {
  private readonly orders = inject(OrdersApi);
  readonly open = signal(false);
  readonly title = signal('Receipt');
  readonly html = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  /** Fetches an order's receipt from the API and opens the dialog. */
  async showOrder(orderId: string, ref: string): Promise<void> {
    this.begin(`Receipt ${ref}`);
    try {
      this.html.set(await this.orders.receipt(orderId));
    } catch (failure) {
      const e = toApiError(failure);
      this.error.set(
        e.status === 404
          ? 'We could not find that receipt.'
          : 'We could not load the receipt. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** Shows HTML that is already in hand (a template preview). */
  showHtml(title: string, html: string): void {
    this.begin(title);
    this.html.set(html);
    this.loading.set(false);
  }

  close(): void {
    this.open.set(false);
    this.html.set('');
    this.error.set('');
  }

  private begin(title: string): void {
    this.title.set(title);
    this.html.set('');
    this.error.set('');
    this.loading.set(true);
    this.open.set(true);
  }
}
