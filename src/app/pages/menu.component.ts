import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CatalogueFilters } from '../catalogue-filters.service';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';

@Component({
  selector: 'section[rt-menu]',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  host: { class: 'menu-section' },
})
export class MenuComponent {
  readonly store = inject(CommerceState);
  readonly filters = inject(CatalogueFilters);
  private readonly router = inject(Router);

  open(p: CatalogueProduct) {
    if (this.store.products().find((x) => x.id === p.id)?.available)
      this.router.navigate(['/menu', p.id]);
  }
}
