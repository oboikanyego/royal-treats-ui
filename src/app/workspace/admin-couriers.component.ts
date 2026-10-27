import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import { toCourierRequest } from '../api/admin-payloads';
import { toApiError } from '../api/api-errors';
import type { ApiUser } from '../api/api-types';
import { registrationProblem } from '../api/auth-messages';
import { PasswordFieldComponent } from './password-field.component';

/** Delivery personnel: add a courier, and deactivate or reactivate their sign-in. */
@Component({
  selector: 'rt-admin-couriers',
  standalone: true,
  imports: [CommonModule, FormsModule, PasswordFieldComponent],
  templateUrl: './admin-couriers.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminCouriersComponent implements OnInit {
  private readonly admin = inject(AdminApi);
  readonly couriers = signal<ApiUser[]>([]);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly notice = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly confirming = signal<string | null>(null);
  readonly busy = signal<string | null>(null);
  courier = { name: '', email: '', phone: '', password: '' };

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.status.set('loading');
    try {
      this.couriers.set((await this.admin.couriers(1, 100)).items);
      this.status.set('ready');
    } catch (failure) {
      this.status.set('error');
      this.error.set(adminErrorMessage(toApiError(failure), 'orders'));
    }
  }

  async create() {
    this.notice.set('');
    const problem = registrationProblem(this.courier);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const created = await this.admin.createCourier(toCourierRequest(this.courier));
      this.couriers.update((list) => [...list, created]);
      this.notice.set(`${created.name} can now sign in as a delivery person.`);
      this.courier = { name: '', email: '', phone: '', password: '' };
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'couriers'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Deactivating signs the courier out everywhere, so it asks first; reactivating does not. */
  async setActive(courier: ApiUser, active: boolean) {
    this.busy.set(courier.id);
    this.error.set('');
    try {
      const updated = await this.admin.setCourierActive(courier.id, active);
      this.couriers.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
      this.notice.set(
        active
          ? `${updated.name} can sign in again.`
          : `${updated.name} was deactivated and signed out.`,
      );
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'couriers'));
    } finally {
      this.busy.set(null);
      this.confirming.set(null);
    }
  }
}
