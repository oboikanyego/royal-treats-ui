import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../cart.service';
import { CommerceState, DeliveryOrder } from '../commerce-state.service';
import { OrderTrackingService } from '../order-tracking.service';

@Component({
  selector: 'section[rt-checkout]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RandPipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly store = inject(CommerceState);
  private readonly cartSvc = inject(CartService);
  private readonly tracking = inject(OrderTrackingService);
  private readonly router = inject(Router);

  readonly cart = this.cartSvc.items;
  readonly count = this.cartSvc.count;
  readonly total = this.cartSvc.total;
  readonly groupRecipients = this.cartSvc.recipients;

  name = '';
  phone = '';
  date = '';
  time = '';
  fulfillment: 'collection' | 'delivery' = 'collection';
  deliveryAddress = '';
  readonly deliveryLat = signal<number | null>(null);
  readonly deliveryLng = signal<number | null>(null);
  locationMessage = '';
  checkoutError = '';
  readonly minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  readonly times = computed(() =>
    Array.from(
      { length: 48 },
      (_, i) => String(Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'),
    ).filter((t) => this.store.inHours(t)),
  );
  readonly deliveryCheck = computed(() =>
    this.store.canDeliver(this.cart(), this.deliveryLat(), this.deliveryLng()),
  );
  readonly eligibleForDelivery = computed(
    () =>
      this.cart().length > 0 &&
      this.cart().every((i) =>
        this.store.products().some((p) => p.id === i.productId && p.deliverable && p.available),
      ),
  );

  constructor() {
    const user = this.store.session();
    if (user?.role === 'customer') {
      this.name = user.name;
      this.phone = user.phone;
    }
  }

  useDeliveryLocation() {
    this.locationMessage = '';
    if (!navigator.geolocation) {
      this.locationMessage = 'Geolocation is not available. Choose collection.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.deliveryLat.set(pos.coords.latitude);
        this.deliveryLng.set(pos.coords.longitude);
        this.locationMessage =
          'Location captured. ' +
          this.store.canDeliver(this.cart(), this.deliveryLat(), this.deliveryLng()).reason;
      },
      () => {
        this.locationMessage =
          'Could not get your location. Enable location permission or choose collection.';
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  place() {
    this.checkoutError = '';
    if (this.store.session()?.role !== 'customer') {
      this.checkoutError = 'Please sign in or register as a customer before placing an order.';
      return;
    }
    if (
      !this.name.trim() ||
      !this.phone.trim() ||
      !this.date ||
      !this.time ||
      !this.cart().length
    ) {
      this.checkoutError = 'Complete your contact details and collection time.';
      return;
    }
    if (!this.store.inHours(this.time)) {
      this.checkoutError = 'Choose a time within the store opening hours.';
      return;
    }
    if (
      this.cart().some(
        (i) => !this.store.products().some((p) => p.id === i.productId && p.available),
      )
    ) {
      this.checkoutError = 'An item is now out of stock. Please update your cart.';
      return;
    }
    if (
      this.fulfillment === 'delivery' &&
      (!this.deliveryCheck().ok || !this.deliveryAddress.trim())
    ) {
      this.checkoutError = 'Delivery requires a valid location within 5 km and a delivery address.';
      return;
    }
    const user = this.store.session();
    const order: DeliveryOrder = {
      id: 'RT-' + Date.now().toString().slice(-8),
      customerId: user?.id || 'guest',
      customer: this.name,
      phone: this.phone.replace(/\s/g, ''),
      address: this.fulfillment === 'delivery' ? this.deliveryAddress : '',
      latitude: this.deliveryLat() ?? undefined,
      longitude: this.deliveryLng() ?? undefined,
      distanceKm: this.deliveryCheck().distance ?? undefined,
      fulfillment: this.fulfillment,
      status: 'Pending',
      payment: this.fulfillment === 'delivery' ? 'Cash on Delivery' : 'Cash on Collection',
      total: this.total(),
      items: this.cart().map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        recipient: i.recipient,
      })),
      date: this.date,
      time: this.time,
      notes: this.cartSvc.notes(),
    };
    this.store.record(order);
    this.tracking.placed(order);
    this.cartSvc.clear();
    this.router.navigateByUrl('/order-placed');
  }
}
