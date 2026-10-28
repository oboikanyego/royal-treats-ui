import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ReceiptViewer } from './receipt-viewer.service';

/**
 * A receipt in a sheet over the page, with Print and Close. The receipt is the API's own HTML (a template
 * filled with the order, escaped, and served with a locked-down policy), shown in a sandboxed frame that
 * cannot run scripts.
 */
@Component({
  selector: 'rt-receipt-dialog',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="receipt-backdrop" *ngIf="viewer.open()" (click)="viewer.close()"></div>
    <section
      class="receipt-sheet"
      *ngIf="viewer.open()"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="viewer.title()"
      (keydown.escape)="viewer.close()"
    >
      <header>
        <h2>{{ viewer.title() }}</h2>
        <button type="button" class="receipt-close" (click)="viewer.close()" aria-label="Close">
          ✕
        </button>
      </header>
      <p class="receipt-state" *ngIf="viewer.loading()">Loading the receipt…</p>
      <p class="receipt-state receipt-error" *ngIf="viewer.error() as problem" role="alert">
        {{ problem }}
      </p>
      <iframe
        #frame
        class="receipt-frame"
        title="Receipt"
        sandbox="allow-same-origin allow-modals"
        *ngIf="safeHtml() as doc"
        [srcdoc]="doc"
      ></iframe>
      <div class="receipt-foot">
        <button type="button" class="primary" [disabled]="!viewer.html()" (click)="print()">
          Print or save as PDF
        </button>
        <button type="button" class="secondary" (click)="viewer.close()">Close</button>
      </div>
    </section>
  `,
})
export class ReceiptDialogComponent {
  readonly viewer = inject(ReceiptViewer);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  /** The API's own receipt page. It is trusted here: it is escaped, has no scripts and runs in a sandbox. */
  readonly safeHtml = computed(() => {
    const html = this.viewer.html();
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });

  print(): void {
    const frame = this.frame()?.nativeElement.contentWindow;
    frame?.focus();
    frame?.print();
  }
}
