import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { AdminApi } from '../api/admin-api.service';
import { toApiError } from '../api/api-errors';
import type { ApiPasswordRequest } from '../api/api-types';

/**
 * People who forgot their password and asked the shop for a new one. The admin sees who is asking and how
 * they last ordered (never the password itself), checks it is really them, then approves or declines.
 */
@Component({
  selector: 'rt-admin-password-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-password-requests.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminPasswordRequestsComponent implements OnInit {
  private readonly admin = inject(AdminApi);
  readonly requests = signal<ApiPasswordRequest[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  /** The request whose Approve button was pressed once and now asks "are you sure". */
  readonly confirming = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      this.requests.set(await this.admin.passwordRequests());
    } catch (failure) {
      this.error.set(toApiError(failure).message);
    } finally {
      this.loading.set(false);
    }
  }

  async approve(request: ApiPasswordRequest) {
    await this.decide(request, 'approve');
  }
  async decline(request: ApiPasswordRequest) {
    await this.decide(request, 'decline');
  }

  private async decide(request: ApiPasswordRequest, action: 'approve' | 'decline') {
    this.busy.set(request.id);
    this.notice.set('');
    this.error.set('');
    try {
      if (action === 'approve') await this.admin.approvePasswordRequest(request.id);
      else await this.admin.declinePasswordRequest(request.id);
      this.notice.set(
        action === 'approve'
          ? `${request.name} can now sign in with the new password.`
          : `The request from ${request.name} was declined. Their old password still works.`,
      );
    } catch (failure) {
      this.error.set(toApiError(failure).message);
    } finally {
      this.confirming.set(null);
      this.busy.set(null);
      await this.load();
    }
  }
}
