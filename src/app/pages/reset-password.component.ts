import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommerceState } from '../commerce-state.service';
import { PasswordFieldComponent } from '../workspace/password-field.component';

/** Where the link in the reset email lands: choose a new password. */
@Component({
  selector: 'section[rt-reset-password]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PasswordFieldComponent],
  templateUrl: './reset-password.component.html',
  host: { class: 'reset-page' },
})
export class ResetPasswordComponent {
  private readonly store = inject(CommerceState);
  /** The one-time token from the link. It is kept only in memory and removed from the address bar. */
  private readonly token: string | null;
  readonly hasToken: boolean;
  next = '';
  confirm = '';
  readonly saving = signal(false);
  readonly error = signal('');
  readonly done = signal(false);

  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    this.token = route.snapshot.queryParamMap.get('token');
    this.hasToken = !!this.token;
    // A one-time secret should not stay in the address, history or a shared screenshot.
    if (this.token) void router.navigate([], { replaceUrl: true, queryParams: {} });
  }

  async submit() {
    if (!this.token || this.saving()) return;
    this.saving.set(true);
    const problem = await this.store.resetPassword(this.token, this.next, this.confirm);
    this.error.set(problem ?? '');
    this.done.set(!problem);
    this.saving.set(false);
  }
}
