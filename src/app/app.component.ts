import { Component, signal, computed, DestroyRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceState, CatalogueProduct, DeliveryOrder } from './commerce-state.service';
import { CartItem, CartService } from './cart.service';
import { optionsFor } from './catalogue-config';
import { PortalComponent } from './portal.component';
import { inject } from '@angular/core';
const collectionSteps = ['Pending', 'Confirmed', 'Preparing', 'Ready for Collection', 'Completed'];
const deliverySteps = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Delivery',
  'Out for Delivery',
  'Completed',
];
const pagePaths: Record<string, string> = {
  home: '/',
  menu: '/menu',
  cart: '/cart',
  checkout: '/checkout',
  success: '/order-placed',
  track: '/track',
  about: '/about',
  contact: '/contact',
  portal: '/account',
};
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  store = inject(CommerceState);
  cartSvc = inject(CartService);
  router = inject(Router);
  title = inject(Title);
  products = this.store.products;
  page = signal('home');
  menu = false;
  category = signal('All');
  categories = computed(() => ['All', ...new Set(this.store.products().map((x) => x.category))]);
  selected = signal<CatalogueProduct>(this.store.products()[1]);
  private selectedId = '';
  variant = signal('6 donuts');
  flavour = signal('Chocolate');
  topping = signal('Oreo');
  qty = signal(1);
  options = computed(() => optionsFor(this.selected()));
  flavours = computed(() => this.options().flavours);
  toppings = computed(() => this.options().toppings);
  forPerson = '';
  searchText = signal('');
  sortBy = signal('featured');
  availableOnly = signal(false);
  menuPage = signal(1);
  readonly pageSize = 8;
  showWelcome = signal(!localStorage.getItem('royal-welcome-v1'));
  supportSubject = 'Order support';
  supportMessage = '';

  cart = this.cartSvc.items;
  latest = signal<DeliveryOrder | null>(null);
  trackedId = signal<string | null>(null);
  tracked = computed(() => this.store.deliveries().find((o) => o.id === this.trackedId()) ?? null);
  trackRef = '';
  trackPhone = '';
  trackSearched = false;
  name = '';
  phone = '';
  date = '';
  time = '';
  payment = 'Cash on Collection';
  notes = '';
  fulfillment: 'collection' | 'delivery' = 'collection';
  deliveryAddress = '';
  deliveryLat = signal<number | null>(null);
  deliveryLng = signal<number | null>(null);
  locationMessage = '';
  checkoutError = '';
  minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  times = computed(() =>
    Array.from(
      { length: 48 },
      (_, i) => String(Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'),
    ).filter((t) => this.store.inHours(t)),
  );
  filtered = computed(() => {
    let items = this.store
      .products()
      .filter(
        (p) =>
          (this.category() === 'All' || p.category === this.category()) &&
          (!this.availableOnly() || p.available) &&
          [p.name, p.category, p.description].some((value) =>
            value.toLowerCase().includes(this.searchText().trim().toLowerCase()),
          ),
      );
    if (this.sortBy() === 'price-low') items = [...items].sort((a, b) => a.price - b.price);
    if (this.sortBy() === 'price-high') items = [...items].sort((a, b) => b.price - a.price);
    if (this.sortBy() === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    return items;
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  visibleProducts = computed(() =>
    this.filtered().slice((this.menuPage() - 1) * this.pageSize, this.menuPage() * this.pageSize),
  );
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const count = Math.min(5, total);
    const start = Math.max(1, Math.min(this.menuPage() - 2, total - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  });
  groupRecipients = this.cartSvc.recipients;

  deliveryCheck = computed(() =>
    this.store.canDeliver(this.cart(), this.deliveryLat(), this.deliveryLng()),
  );
  eligibleForDelivery = computed(
    () =>
      this.cart().every((i) =>
        this.store.products().some((p) => p.id === i.productId && p.deliverable && p.available),
      ) && this.cart().length > 0,
  );
  unitPrice = computed(
    () =>
      this.selected().variants.find((v) => v.label === this.variant())?.price ??
      this.selected().price,
  );
  count = this.cartSvc.count;
  total = this.cartSvc.total;
  constructor() {
    if (this.showWelcome()) setTimeout(() => this.dismissWelcome(), 2200);
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.syncRoute();
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
  private syncRoute() {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const page = String(route.data['page'] ?? 'home');
    this.menu = false;
    this.page.set(page);
    this.title.setTitle((route.data['title'] ? route.data['title'] + ' | ' : '') + 'Royal Treats');
    if (page === 'product') {
      const found = this.store.products().find((p) => p.id === route.params['id']);
      if (!found) {
        this.router.navigateByUrl('/menu', { replaceUrl: true });
        return;
      }
      if (this.selectedId !== found.id) this.select(found);
    }
    if (page === 'success' && !this.latest()) {
      this.router.navigateByUrl('/track', { replaceUrl: true });
      return;
    }
    const user = this.store.session();
    if (page === 'checkout' && user?.role === 'customer') {
      this.name = user.name;
      this.phone = user.phone;
    }
  }
  dismissWelcome() {
    this.showWelcome.set(false);
    localStorage.setItem('royal-welcome-v1', 'yes');
  }
  signOut() {
    this.store.signOut();
    this.go('home');
  }
  updateSearch(value: string) {
    this.searchText.set(value);
    this.menuPage.set(1);
  }
  clearFilters() {
    this.searchText.set('');
    this.category.set('All');
    this.sortBy.set('featured');
    this.availableOnly.set(false);
    this.menuPage.set(1);
  }
  setCategory(cat: string) {
    this.category.set(cat);
    this.menuPage.set(1);
  }
  setSort(value: string) {
    this.sortBy.set(value);
    this.menuPage.set(1);
  }
  setAvailable(value: boolean) {
    this.availableOnly.set(value);
    this.menuPage.set(1);
  }
  setPage(n: number) {
    this.menuPage.set(Math.max(1, Math.min(this.totalPages(), n)));
    window.scrollTo(0, 220);
  }
  itemDetails(i: CartItem) {
    return [i.variant, i.sauce, i.topping].filter((x) => x).join(' · ');
  }
  saveRecipient(item: CartItem, recipient: string) {
    this.cartSvc.setRecipient(item, recipient);
  }
  emailReady() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.store.settings().supportEmail || '');
  }
  supportHref() {
    const email = this.store.settings().supportEmail;
    return (
      'mailto:' +
      email +
      '?subject=' +
      encodeURIComponent(this.supportSubject) +
      '&body=' +
      encodeURIComponent(this.supportMessage)
    );
  }

  go(p: string) {
    if (p.startsWith('admin')) p = 'portal';
    this.router.navigateByUrl(pagePaths[p] ?? '/');
  }
  selectedAvailable() {
    return !!this.store.products().find((p) => p.id === this.selected().id)?.available;
  }
  select(p: CatalogueProduct) {
    this.selectedId = p.id;
    this.selected.set(p);
    this.variant.set(p.variants[0].label);
    const options = optionsFor(p);
    this.flavour.set(options.flavours[0] ?? '');
    this.topping.set(options.toppings[0] ?? '');
    this.qty.set(1);
    this.forPerson = '';
  }
  open(p: CatalogueProduct) {
    if (!this.store.products().find((x) => x.id === p.id)?.available) return;
    this.select(p);
    this.router.navigate(['/menu', p.id]);
  }
  add() {
    const p = this.selected();
    if (!this.store.products().find((x) => x.id === p.id)?.available) return;
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
    this.go('cart');
  }
  change(i: CartItem, d: number) {
    this.cartSvc.changeQty(i, d);
  }
  remove(i: CartItem) {
    this.cartSvc.remove(i);
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
    const phone = this.phone.replace(/\s/g, '');
    const order: DeliveryOrder = {
      id: 'RT-' + Date.now().toString().slice(-8),
      customerId: user?.id || 'guest',
      customer: this.name,
      phone,
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
      notes: this.notes,
    };
    this.store.record(order);
    this.latest.set(order);
    this.trackedId.set(order.id);
    this.trackRef = order.id;
    this.trackPhone = phone;
    this.cartSvc.clear();
    this.go('success');
  }
  trackSteps() {
    return this.tracked()?.fulfillment === 'delivery' ? deliverySteps : collectionSteps;
  }
  stepDone(step: string) {
    const steps = this.trackSteps();
    const status = this.tracked()?.status ?? '';
    let current = steps.indexOf(status);
    if (current < 0 && status.startsWith('Ready'))
      current = steps.findIndex((x) => x.startsWith('Ready'));
    return steps.indexOf(step) <= current;
  }
  track() {
    this.trackSearched = true;
    const entry = this.store
      .deliveries()
      .find(
        (o) =>
          o.id.toLowerCase() === this.trackRef.trim().toLowerCase() &&
          o.phone.replace(/\D/g, '') === this.trackPhone.replace(/\D/g, ''),
      );
    this.trackedId.set(entry?.id ?? null);
  }
}
