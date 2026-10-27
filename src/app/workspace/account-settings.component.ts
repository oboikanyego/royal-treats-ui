import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommerceState } from '../commerce-state.service';
import { PasswordFieldComponent } from './password-field.component';

/** Any signed-in user's own details and password. The email and role cannot be changed here. */
@Component({
  selector: 'rt-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordFieldComponent],
  templateUrl: './account-settings.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AccountSettingsComponent {
  private readonly store = inject(CommerceState);
  readonly user = this.store.session;

  name = this.store.session()?.name ?? '';
  phone = this.store.session()?.phone ?? '';
  readonly detailsNotice = signal('');
  readonly detailsError = signal('');
  readonly savingDetails = signal(false);

  current = '';
  next = '';
  confirm = '';
  readonly passwordNotice = signal('');
  readonly passwordError = signal('');
  readonly savingPassword = signal(false);

  async saveDetails() {
    this.detailsNotice.set('');
    this.savingDetails.set(true);
    const problem = await this.store.updateProfile(this.name, this.phone);
    this.detailsError.set(problem ?? '');
    if (!problem) this.detailsNotice.set('Your details were saved.');
    this.savingDetails.set(false);
  }

  async savePassword() {
    this.passwordNotice.set('');
    this.savingPassword.set(true);
    const problem = await this.store.changePassword(this.current, this.next, this.confirm);
    this.passwordError.set(problem ?? '');
    if (!problem) {
      this.passwordNotice.set(
        'Your password was changed. Any other device you were signed in on has been signed out.',
      );
      this.current = this.next = this.confirm = '';
    }
    this.savingPassword.set(false);
  }
}
