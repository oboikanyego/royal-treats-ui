import { RandPipe } from '../rand.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../cart.service';
import { toApiError } from '../api/api-errors';
import { fromApiOrder } from '../api/api-mappers';
import { orderErrorMessage } from '../api/order-messages';
import { AttemptKeys, buildOrderRequest } from '../api/order-request';
import { OrdersApi } from '../api/orders-api.service';
import { CommerceState } from '../commerce-state.service';
import { PlacedOrder } from '../placed-order.service';

@Component({
  selector: 'section[rt-checkout]',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RandPipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly store = inject(CommerceState);
  private readonly cartSvc = inject(CartService);
  private readonly placedOrder = inject(PlacedOrder);
  private readonly router = inject(Router);
  private readonly ordersApi = inject(OrdersApi);
  /** One idempotency key per distinct order, so a retried submit cannot place it twice. */
  private readonly keys = new AttemptKeys();
  readonly submitting = signal(false);

  readonly cart = this.cartSvc.items;
  readonly count = this.cartSvc.count;
  readonly total = this.cartSvc.total;
  readonly groupRecipients = this.cartSvc.recipients;

  name = '';
  phone = '';
  /** The chosen date lives in a signal so the list of times follows that weekday's hours. */
  readonly chosenDate = signal('');
  get date(): string {
    return this.chosenDate();
  }
  set date(value: string) {
    this.chosenDate.set(value);
    // A time that is not offered on the new day would be refused, so ask again.
    if (this.time && !this.store.inHours(this.time, value)) this.time = '';
  }
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
    ).filter((t) => this.store.inHours(t, this.chosenDate())),
  );
  /** What to tell the customer about the hours: the chosen day's, or that the shop is closed then. */
  readonly hoursNote = computed(() => {
    const date = this.chosenDate();
    if (!date) return "Choose a date to see that day's opening hours.";
    const hours = this.store.hoursOn(date);
    return hours
      ? `Open ${hours.open}–${hours.close} on that day.`
      : 'We are closed on that day. Please choose another date.';
  });
  readonly paused = computed(() => !!this.store.settings().ordersPaused);
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

  /** The shop's own words when it has paused orders. */
  pausedMessage(): string {
    const note = (this.store.settings().pauseMessage ?? '').trim();
    return note
      ? `Orders are paused: ${note}`
      : 'Orders are paused right now. Please check back soon.';
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

  async place() {
    this.checkoutError = '';
    if (this.paused()) {
      this.checkoutError = this.pausedMessage();
      return;
    }
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
    if (!this.store.hoursOn(this.date)) {
      this.checkoutError = 'We are closed on that day. Please choose another date.';
      return;
    }
    if (!this.store.inHours(this.time, this.date)) {
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
    await this.submit();
  }

  /** The server prices the order and returns it; nothing about money is decided here. */
  private async submit() {
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const request = buildOrderRequest(this.cart(), {
        fulfillment: this.fulfillment,
        date: this.date,
        time: this.time,
        notes: this.cartSvc.notes(),
        address: this.deliveryAddress,
        latitude: this.deliveryLat(),
        longitude: this.deliveryLng(),
      });
      const order = fromApiOrder(await this.ordersApi.place(request, this.keys.keyFor(request)));
      this.keys.reset();
      this.placedOrder.placed(order);
      this.cartSvc.clear();
      await this.router.navigateByUrl('/order-placed');
    } catch (error) {
      // The key is kept: submitting the same order again returns the one already created.
      this.checkoutError = orderErrorMessage(toApiError(error), 'place');
    } finally {
      this.submitting.set(false);
    }
  }
}
