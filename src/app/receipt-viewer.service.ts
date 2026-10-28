import { Injectable, inject, signal } from '@angular/core';
import { OrdersApi } from './api/orders-api.service';
import { toApiError } from './api/api-errors';

/** The receipt shown in the print dialog: loading, failed, or ready as HTML. */
@Injectable({ providedIn: 'root' })
export class ReceiptViewer {
  private readonly orders = inject(OrdersApi);
  readonly open = signal(false);
  readonly title = signal('Receipt');
  /** Name for the downloaded file, from the order reference. */
  readonly fileName = signal('receipt.html');
  readonly html = signal('');
  readonly loading = signal(false);
  readonly error = signal('');

  /** Fetches an order's receipt from the API and opens the dialog. */
  async showOrder(orderId: string, ref: string): Promise<void> {
    this.begin(`Receipt ${ref}`);
    this.fileName.set(`receipt-${ref.replace(/[^A-Za-z0-9_-]/g, '')}.html`);
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

  close(): void {
    this.open.set(false);
    this.html.set('');
    this.error.set('');
  }

  private begin(title: string): void {
    this.title.set(title);
    this.fileName.set('receipt.html');
    this.html.set('');
    this.error.set('');
    this.loading.set(true);
    this.open.set(true);
  }
}
