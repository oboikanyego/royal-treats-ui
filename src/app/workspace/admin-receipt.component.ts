import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { toApiError } from '../api/api-errors';
import type { ApiReceiptTemplate } from '../api/api-types';
import { ReceiptViewer } from '../receipt-viewer.service';

/** The receipt template: edit it, preview it on a sample order, save it, or go back to the one the shop started with. */
@Component({
  selector: 'rt-admin-receipt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-receipt.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminReceiptComponent implements OnInit {
  private readonly admin = inject(AdminApi);
  private readonly viewer = inject(ReceiptViewer);
  readonly template = signal<ApiReceiptTemplate | null>(null);
  readonly loading = signal(true);
  readonly busy = signal<'save' | 'preview' | 'reset' | null>(null);
  readonly notice = signal('');
  readonly error = signal('');
  readonly confirmReset = signal(false);
  html = '';

  async ngOnInit() {
    try {
      this.apply(await this.admin.receiptTemplate());
    } catch (failure) {
      this.error.set(toApiError(failure).message);
    } finally {
      this.loading.set(false);
    }
  }

  private apply(t: ApiReceiptTemplate) {
    this.template.set(t);
    this.html = t.html;
  }

  /** What the admin has typed differs from what is saved. */
  get changed(): boolean {
    return this.html !== (this.template()?.html ?? '');
  }

  async preview() {
    await this.run('preview', async () => {
      this.viewer.showHtml(
        'Receipt preview (sample order)',
        await this.admin.previewReceipt(this.html),
      );
    });
  }

  async save() {
    await this.run('save', async () => {
      this.apply(await this.admin.saveReceiptTemplate(this.html));
      this.notice.set('The receipt template was saved. New receipts use it straight away.');
    });
  }

  async reset() {
    this.confirmReset.set(false);
    await this.run('reset', async () => {
      this.apply(await this.admin.resetReceiptTemplate());
      this.notice.set('The receipt template is back to the one you started with.');
    });
  }

  private async run(kind: 'save' | 'preview' | 'reset', work: () => Promise<void>) {
    this.notice.set('');
    this.error.set('');
    this.busy.set(kind);
    try {
      await work();
    } catch (failure) {
      // The API explains a template problem in plain words ("Use {{value}} instead of {{{value}}}…").
      this.error.set(toApiError(failure).message);
    } finally {
      this.busy.set(null);
    }
  }
}
