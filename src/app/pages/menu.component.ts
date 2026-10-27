import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogueFilters } from '../catalogue-filters.service';
import { Busy } from '../busy.service';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';

@Component({
  selector: 'section[rt-menu]',
  standalone: true,
  imports: [CommonModule, FormsModule, RandPipe],
  templateUrl: './menu.component.html',
  host: { class: 'menu-section' },
})
export class MenuComponent {
  readonly store = inject(CommerceState);
  readonly filters = inject(CatalogueFilters);
  private readonly router = inject(Router);
  readonly busy = inject(Busy);
  /** The product just tapped, so its card can show that the page is on its way. */
  readonly tapped = signal<string | null>(null);

  open(p: CatalogueProduct) {
    // Further taps while the page is on its way would only queue more navigations.
    if (this.busy.navigationInProgress()) return;
    if (this.store.products().find((x) => x.id === p.id)?.available) {
      this.tapped.set(p.id);
      this.router.navigate(['/menu', p.id]);
    }
  }
}
