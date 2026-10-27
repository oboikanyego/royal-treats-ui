import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import { settingsProblem, toSettingsPayload } from '../api/admin-payloads';
import { toApiError } from '../api/api-errors';
import { CommerceState, Settings } from '../commerce-state.service';

/** Business settings: hours, address, support email and the store's coordinates. */
@Component({
  selector: 'rt-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-settings.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AdminSettingsComponent {
  private readonly store = inject(CommerceState);
  private readonly admin = inject(AdminApi);
  settings: Settings = { ...this.store.settings() };
  readonly notice = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

  async save() {
    this.notice.set('');
    const problem = settingsProblem(this.settings);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.admin.saveSettings(
        toSettingsPayload(this.settings),
        this.store.settings(),
      );
      this.store.applySettings(saved);
      this.settings = { ...saved };
      this.notice.set('Business settings saved.');
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'settings'));
    } finally {
      this.saving.set(false);
    }
  }

  useStoreLocation() {
    if (!navigator.geolocation) {
      this.error.set('Location is unavailable.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.settings.latitude = p.coords.latitude;
        this.settings.longitude = p.coords.longitude;
        this.error.set('');
        this.notice.set('Store coordinates captured from this device. Save settings to apply.');
      },
      () => this.error.set('Location permission denied. Enter store coordinates manually.'),
    );
  }
}
