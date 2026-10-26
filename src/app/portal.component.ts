import { Component, HostListener, ViewEncapsulation, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceState, CatalogueProduct, DeliveryOrder, Settings } from './commerce-state.service';
import { isDeliverableCategory } from './catalogue-config';

@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.css'],
  // Shadow DOM keeps the global storefront stylesheet from reaching the staff workspace.
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class PortalComponent {
  readonly store = inject(CommerceState);
  screen = signal<'signin' | 'register' | 'home' | 'products' | 'couriers' | 'settings' | 'orders'>(
    'signin',
  );
  error = '';
  notice = '';
  email = '';
  password = '';
  name = '';
  phone = '';
  photoError = '';
  uploadingPhoto = false;
  courier = { name: '', email: '', phone: '', password: '' };
  pendingAvailability: CatalogueProduct | null = null;
  edited: CatalogueProduct | null = null;
  imageError = '';
  isUploading = false;
  settings: Settings = { ...this.store.settings() };
  constructor() {
    if (this.store.session()) this.screen.set('home');
  }
  login() {
    this.error = '';
    if (!this.store.signIn(this.email, this.password)) {
      this.error = 'Incorrect email or password (demo account on this device).';
      return;
    }
    this.screen.set('home');
    this.password = '';
  }
  register() {
    this.error = this.store.register(this.name, this.email, this.phone, this.password) || '';
    if (!this.error) {
      this.screen.set('home');
      this.password = '';
    }
  }
  logout() {
    this.store.signOut();
    this.screen.set('signin');
    this.error = '';
  }
  nav(to: 'home' | 'products' | 'couriers' | 'settings' | 'orders') {
    this.notice = '';
    this.error = '';
    if (to === 'settings') this.settings = { ...this.store.settings() };
    this.screen.set(to);
  }
  createCourier() {
    this.error =
      this.store.addCourier(
        this.courier.name,
        this.courier.email,
        this.courier.phone,
        this.courier.password,
      ) || '';
    if (!this.error) {
      this.notice = 'Delivery person added. Their sign-in works in this browser demo only.';
      this.courier = { name: '', email: '', phone: '', password: '' };
    }
  }
  edit(p?: CatalogueProduct) {
    this.edited = p
      ? (JSON.parse(JSON.stringify(p)) as CatalogueProduct)
      : {
          id: 'p-' + Date.now(),
          name: '',
          category: 'Mini Donuts',
          price: 25,
          image: '',
          description: '',
          available: true,
          deliverable: true,
          variants: [{ label: 'Standard', price: 25 }],
        };
    this.imageError = '';
  }
  addVariant() {
    if (this.edited) this.edited.variants.push({ label: 'New size', price: this.edited.price });
  }
  removeVariant(i: number) {
    if (this.edited && this.edited.variants.length > 1) this.edited.variants.splice(i, 1);
  }
  saveProduct() {
    const p = this.edited;
    if (!p || !p.name.trim() || p.price < 0) {
      this.error = 'Enter a valid product name and price.';
      return;
    }
    if (!p.variants.length) p.variants = [{ label: 'Standard', price: p.price }];
    this.store.saveProduct(p);
    this.edited = null;
    this.notice = 'Product saved.';
    this.error = '';
  }
  upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.edited) return;
    this.imageError = '';
    if (!file.type.startsWith('image/')) {
      this.imageError = 'Choose an image file.';
      return;
    }
    if (file.size > 400_000) {
      this.imageError = 'For this browser-only demo, choose an image under 400 KB.';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (this.edited) this.edited.image = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  saveHours() {
    if (
      this.settings.supportEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.settings.supportEmail.trim())
    ) {
      this.error = 'Configure a valid business support email address.';
      return;
    }
    if (this.settings.open === this.settings.close) {
      this.error = 'Opening and closing time must differ.';
      return;
    }
    if (
      (this.settings.latitude !== null &&
        (this.settings.latitude < -90 || this.settings.latitude > 90)) ||
      (this.settings.longitude !== null &&
        (this.settings.longitude < -180 || this.settings.longitude > 180))
    ) {
      this.error = 'Invalid latitude or longitude.';
      return;
    }
    this.store.saveSettings(this.settings);
    this.error = '';
    this.notice = 'Business settings saved.';
  }
  useStoreLocation() {
    if (!navigator.geolocation) {
      this.error = 'Location is unavailable.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.settings.latitude = p.coords.latitude;
        this.settings.longitude = p.coords.longitude;
        this.error = '';
        this.notice = 'Store coordinates captured from this device. Save settings to apply.';
      },
      () => (this.error = 'Location permission denied. Enter store coordinates manually.'),
    );
  }
  initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || '')
      .join('')
      .toUpperCase();
  }
  async uploadProfilePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.photoError = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      this.photoError = 'Select a JPG, PNG or WebP image under 5 MB.';
      input.value = '';
      return;
    }
    this.uploadingPhoto = true;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image editing is not supported by this browser.');
      const size = Math.min(bitmap.width, bitmap.height);
      const x = (bitmap.width - size) / 2;
      const y = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, x, y, size, size, 0, 0, 240, 240);
      bitmap.close();
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      this.photoError = this.store.updateProfilePhoto(dataUrl) || '';
      if (!this.photoError) this.notice = 'Profile picture updated for this demo browser.';
    } catch {
      this.photoError = 'Could not read this picture. Choose another image.';
    } finally {
      this.uploadingPhoto = false;
      input.value = '';
    }
  }
  toggleAvailability(product: CatalogueProduct): void {
    this.pendingAvailability = product;
  }
  confirmAvailability(): void {
    if (!this.pendingAvailability) return;
    const product = this.pendingAvailability;
    this.store.saveProduct({ ...product, available: !product.available });
    this.notice = product.available
      ? product.name + ' is now out of stock.'
      : product.name + ' is available again.';
    this.pendingAvailability = null;
  }
  closeEditor(): void {
    this.edited = null;
    this.imageError = '';
    this.error = '';
  }
  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeEditor();
    this.pendingAvailability = null;
  }
  canBeDelivered(p: CatalogueProduct) {
    return isDeliverableCategory(p.category);
  }
  outOfStockCount() {
    return this.store.products().filter((p) => !p.available).length;
  }
  couriers() {
    return this.store.accounts().filter((x) => x.role === 'courier');
  }
  availableOrders() {
    return this.store
      .deliveries()
      .filter(
        (o) => o.fulfillment === 'delivery' && o.status === 'Ready for Delivery' && !o.courierId,
      );
  }
  ownOrders() {
    return this.store.deliveries().filter((o) => o.courierId === this.store.session()?.id);
  }
  accept(id: string) {
    this.error = this.store.acceptOrder(id) ? '' : 'Order is no longer available.';
    if (!this.error) this.notice = 'Order accepted. Contact the customer before delivery.';
  }
  statusOptions(order: DeliveryOrder) {
    return order.fulfillment === 'delivery'
      ? [
          'Pending',
          'Confirmed',
          'Preparing',
          'Ready for Delivery',
          'Out for Delivery',
          'Completed',
          'Cancelled',
        ]
      : ['Pending', 'Confirmed', 'Preparing', 'Ready for Collection', 'Completed', 'Cancelled'];
  }
  saveOrder(id: string, status: string) {
    this.store.setOrder(id, status);
  }
}
