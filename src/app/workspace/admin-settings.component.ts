import { CommonModule } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import { settingsProblem, toSettingsPayload } from '../api/admin-payloads';
import { toApiError } from '../api/api-errors';
import { geocodeAddress, mapLink } from '../api/geocode';
import { CommerceState, Settings } from '../commerce-state.service';

/**
 * Business settings: name, address, hours and support email. The store's map point is worked out
 * from the address when it is saved, because the API measures the 5 km delivery area from it.
 */
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
  /** The address as last saved, to know when the map point must be looked up again. */
  private savedAddress = this.settings.address.trim();
  readonly notice = signal('');
  readonly warning = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  /** What the admin sees about delivery: where it is measured from, or why it is off. */
  readonly located = signal<{ latitude: number; longitude: number } | null>(
    this.settings.latitude !== null && this.settings.longitude !== null
      ? { latitude: this.settings.latitude, longitude: this.settings.longitude }
      : null,
  );
  readonly mapUrl = computed(() => {
    const point = this.located();
    return point ? mapLink(point.latitude, point.longitude) : '';
  });

  async save() {
    this.notice.set('');
    this.warning.set('');
    const problem = settingsProblem(this.settings);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const next = { ...this.settings };
      const addressChanged = next.address.trim() !== this.savedAddress;
      if (addressChanged || next.latitude === null || next.longitude === null) {
        const found = await geocodeAddress(next.address);
        if (found) {
          next.latitude = found.latitude;
          next.longitude = found.longitude;
        } else if (addressChanged) {
          // Keeping the old point would measure deliveries from the wrong place.
          this.error.set(
            "We couldn't find that address on the map. Add the suburb and town, for example “34 10th Avenue, Thabazimbi”, and try again.",
          );
          return;
        } else {
          this.warning.set(
            "Saved, but we couldn't find the address on the map, so delivery stays off. Check the address and save again.",
          );
        }
      }
      const saved = await this.admin.saveSettings(toSettingsPayload(next), this.store.settings());
      this.store.applySettings(saved);
      this.settings = { ...saved };
      this.savedAddress = saved.address.trim();
      this.located.set(
        saved.latitude !== null && saved.longitude !== null
          ? { latitude: saved.latitude, longitude: saved.longitude }
          : null,
      );
      if (!this.warning()) this.notice.set('Business settings saved.');
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'settings'));
    } finally {
      this.saving.set(false);
    }
  }
}
