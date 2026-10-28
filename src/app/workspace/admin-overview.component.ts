import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { AdminApi } from '../api/admin-api.service';
import { AdminLive } from '../api/admin-live.service';
import { adminErrorMessage } from '../api/admin-messages';
import { dashboardSummary } from '../api/admin-view';
import { toApiError } from '../api/api-errors';
import type { ApiDashboard } from '../api/api-types';
import { weekSummary } from '../opening-hours';
import { CommerceState } from '../commerce-state.service';
import { RandPipe } from '../rand.pipe';
import { AdminPasswordRequestsComponent } from './admin-password-requests.component';

/** The admin's overview: order totals from the API's dashboard plus the store's opening hours. */
@Component({
  selector: 'rt-admin-overview',
  standalone: true,
  imports: [CommonModule, RandPipe, AdminPasswordRequestsComponent],
  templateUrl: './admin-overview.component.html',
  // Rendered inside the portal's shadow root, so the portal's stylesheet already styles it.
  encapsulation: ViewEncapsulation.None,
})
export class AdminOverviewComponent implements OnInit {
  readonly store = inject(CommerceState);
  private readonly admin = inject(AdminApi);
  private readonly live = inject(AdminLive);
  @Output() configure = new EventEmitter<void>();

  readonly dashboard = signal<ApiDashboard | null>(null);
  readonly error = signal('');
  readonly hoursText = computed(() => weekSummary(this.store.settings()));
  readonly summary = computed(() => {
    const d = this.dashboard();
    return d ? dashboardSummary(d) : null;
  });
  readonly outOfStock = computed(() => this.store.products().filter((p) => !p.available).length);

  constructor() {
    // Keep the totals current as orders arrive and change.
    let first = true;
    effect(() => {
      this.live.changes();
      untracked(() => {
        if (first) first = false;
        else void this.load();
      });
    });
  }

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
