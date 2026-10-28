import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartItem, CartService } from '../cart.service';
import { ImageSetPipe, ImageSrcPipe } from '../image.pipes';

@Component({
  selector: 'section[rt-cart]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RandPipe, ImageSrcPipe],
  templateUrl: './cart.component.html',
  host: { class: 'cart-section' },
})
export class CartComponent {
  readonly cartSvc = inject(CartService);
  readonly cart = this.cartSvc.items;
  readonly count = this.cartSvc.count;
  readonly total = this.cartSvc.total;
  readonly groupRecipients = this.cartSvc.recipients;

  itemDetails(i: CartItem) {
    return [i.variant, i.sauce, i.topping].filter((x) => x).join(' · ');
  }
  saveRecipient(item: CartItem, recipient: string) {
    this.cartSvc.setRecipient(item, recipient);
  }
  change(i: CartItem, d: number) {
    this.cartSvc.changeQty(i, d);
  }
  remove(i: CartItem) {
    this.cartSvc.remove(i);
  }
}
