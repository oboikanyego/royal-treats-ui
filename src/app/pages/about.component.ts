import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommerceState } from '../commerce-state.service';
import { ImageSetPipe, ImageSrcPipe } from '../image.pipes';

@Component({
  selector: 'section[rt-about]',
  standalone: true,
  imports: [CommonModule, RouterLink, ImageSrcPipe, ImageSetPipe],
  templateUrl: './about.component.html',
  host: { class: 'about-page' },
})
export class AboutComponent {
  readonly store = inject(CommerceState);

  /** Mini donuts photo, falling back to the first product if the catalogue has changed. */
  readonly featureImage = computed(() => {
    const products = this.store.products();
    return (products.find((p) => p.id === 'donuts') ?? products[0])?.image ?? '';
  });
}
