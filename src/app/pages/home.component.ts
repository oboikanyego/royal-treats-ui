import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';

@Component({
  selector: 'section[rt-home]',
  standalone: true,
  imports: [CommonModule, RouterLink, RandPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly store = inject(CommerceState);
  private readonly router = inject(Router);

  /** Hero photo: the milkshake, or whatever the catalogue starts with if it is gone. */
  readonly heroImage = computed(() => {
    const products = this.store.products();
    return (products.find((p) => p.id === 'shake') ?? products[0])?.image ?? '';
  });

  open(p: CatalogueProduct) {
    if (this.store.products().find((x) => x.id === p.id)?.available)
      this.router.navigate(['/menu', p.id]);
  }
}
