import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CartService } from '../cart.service';
import { optionsFor } from '../catalogue-config';
import { CatalogueProduct, CommerceState } from '../commerce-state.service';
import { ImageSetPipe, ImageSrcPipe } from '../image.pipes';

@Component({
  selector: 'section[rt-product]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RandPipe, ImageSrcPipe, ImageSetPipe],
  templateUrl: './product.component.html',
})
export class ProductComponent {
  readonly store = inject(CommerceState);
  private readonly cartSvc = inject(CartService);
  private readonly router = inject(Router);
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((m) => m.get('id') ?? '')),
    {
      initialValue: '',
    },
  );

  readonly selected = computed(() => this.store.products().find((p) => p.id === this.id()));
  readonly options = computed(() => {
    const p = this.selected();
    return p ? optionsFor(p) : { flavourLabel: 'flavour', flavours: [], toppings: [] };
  });
  readonly flavours = computed(() => this.options().flavours);
  readonly toppings = computed(() => this.options().toppings);
  readonly variant = signal('');
  readonly flavour = signal('');
  readonly topping = signal('');
  readonly qty = signal(1);
  forPerson = '';
  readonly unitPrice = computed(() => {
    const p = this.selected();
    return p ? (p.variants.find((v) => v.label === this.variant())?.price ?? p.price) : 0;
  });

  constructor() {
    // Start from the product's first options whenever the page is opened for a product.
    effect(() => {
      const id = this.id();
      untracked(() => {
        const p = this.store.products().find((x) => x.id === id);
        if (p) this.reset(p);
      });
    });
  }

  private reset(p: CatalogueProduct) {
    const options = optionsFor(p);
    this.variant.set(p.variants[0]?.label ?? '');
    this.flavour.set(options.flavours[0] ?? '');
    this.topping.set(options.toppings[0] ?? '');
    this.qty.set(1);
    this.forPerson = '';
  }

  selectedAvailable() {
    return !!this.selected()?.available;
  }

  add() {
    const p = this.selected();
    if (!p?.available) return;
    this.cartSvc.add({
      productId: p.id,
      name: p.name,
      image: p.image,
      variant: this.variant(),
      price: this.unitPrice(),
      qty: this.qty(),
      sauce: this.flavour(),
      topping: this.topping(),
      recipient: this.forPerson,
    });
    this.router.navigateByUrl('/cart');
  }
}
