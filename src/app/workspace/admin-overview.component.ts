import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AdminApi } from '../api/admin-api.service';
import { adminErrorMessage } from '../api/admin-messages';
import { dashboardSummary } from '../api/admin-view';
import { toApiError } from '../api/api-errors';
import type { ApiDashboard } from '../api/api-types';
import { CommerceState } from '../commerce-state.service';
import { RandPipe } from '../rand.pipe';

/** The admin's overview: order totals from the API's dashboard plus the store's opening hours. */
@Component({
  selector: 'rt-admin-overview',
  standalone: true,
  imports: [CommonModule, RandPipe],
  templateUrl: './admin-overview.component.html',
  // Rendered inside the portal's shadow root, so the portal's stylesheet already styles it.
  encapsulation: ViewEncapsulation.None,
})
export class AdminOverviewComponent implements OnInit {
  readonly store = inject(CommerceState);
  private readonly admin = inject(AdminApi);
  @Output() configure = new EventEmitter<void>();

  readonly dashboard = signal<ApiDashboard | null>(null);
  readonly error = signal('');
  readonly summary = computed(() => {
    const d = this.dashboard();
    return d ? dashboardSummary(d) : null;
  });
  readonly outOfStock = computed(() => this.store.products().filter((p) => !p.available).length);

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.error.set('');
    try {
      this.dashboard.set(await this.admin.dashboard());
    } catch (failure) {
      this.error.set(adminErrorMessage(toApiError(failure), 'dashboard'));
    }
  }
}
