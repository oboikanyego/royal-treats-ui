import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Busy } from '../busy.service';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';
import { ImageSetPipe, ImageSrcPipe } from '../image.pipes';

@Component({
  selector: 'section[rt-home]',
  standalone: true,
  imports: [CommonModule, RouterLink, RandPipe, ImageSrcPipe, ImageSetPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  readonly store = inject(CommerceState);
  private readonly router = inject(Router);
  readonly busy = inject(Busy);
  /** The product just tapped, so its card can show that the page is on its way. */
  readonly tapped = signal<string | null>(null);

  /** Hero photo: the milkshake, or whatever the catalogue starts with if it is gone. */
  readonly heroImage = computed(() => {
    const products = this.store.products();
    return (products.find((p) => p.id === 'shake') ?? products[0])?.image ?? '';
  });

  open(p: CatalogueProduct) {
    // Further taps while the page is on its way would only queue more navigations.
    if (this.busy.navigationInProgress()) return;
    if (this.store.products().find((x) => x.id === p.id)?.available) {
      this.tapped.set(p.id);
      this.router.navigate(['/menu', p.id]);
    }
  }
}
