import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { environment } from '../environments/environment';
import { fromApiUser } from './api/api-mappers';
import { toApiError } from './api/api-errors';
import { AuthApi } from './api/auth-api.service';
import { authErrorMessage, registrationProblem, type AuthContext } from './api/auth-messages';
import { CatalogueApi } from './api/catalogue-api.service';
import { photoFileProblem } from './api/photo-file';
import { SessionService } from './api/session.service';
import {
  CATEGORY_OPTIONS,
  DELIVERY_RADIUS_KM,
  isDeliverableCategory,
  type ProductOptions,
} from './catalogue-config';

export type Role = 'admin' | 'customer' | 'courier';
export type Account = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
  active: boolean;
  photo?: string;
};
export type CatalogueProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  available: boolean;
  deliverable: boolean;
  variants: { label: string; price: number }[];
  /** Flavour/topping choices; when absent the category defaults apply. */
  options?: ProductOptions;
};
export type Settings = {
  open: string;
  close: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  storeName: string;
  address: string;
  supportEmail: string;
};
export type DeliveryOrder = {
  id: string;
  customerId: string;
  customer: string;
  phone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  fulfillment: 'delivery' | 'collection';
  courierId?: string;
  status: string;
  payment: string;
  total: number;
  items: { name: string; qty: number; price: number; recipient?: string }[];
  date: string;
  time: string;
  notes?: string;
};

const seedProducts: CatalogueProduct[] = [
  {
    id: 'slush',
    name: 'Slushies',
    category: 'Slushies',
    options: CATEGORY_OPTIONS['Slushies'],
    price: 15,
    image:
      'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=85',
    description: 'Lemon Lime, Strawberry or Blueberry',
    available: true,
    deliverable: false,
    variants: [
      { label: 'Small cup', price: 15 },
      { label: 'Big cup', price: 30 },
    ],
  },
  {
    id: 'donuts',
    name: 'Mini Donuts',
    category: 'Mini Donuts',
    options: CATEGORY_OPTIONS['Mini Donuts'],
    price: 25,
    image:
      'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85',
    description: 'Fresh mini donuts with your favourite toppings',
    available: true,
    deliverable: true,
    variants: [
      { label: '6 donuts', price: 25 },
      { label: '12 donuts', price: 50 },
      { label: '24 donuts', price: 95 },
      { label: '50 donuts', price: 210 },
    ],
  },
  {
    id: 'shake',
    name: 'Milkshakes',
    category: 'Milkshakes',
    options: CATEGORY_OPTIONS['Milkshakes'],
    price: 25,
    image:
      'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=85',
    description: 'Creamy milkshakes',
    available: true,
    deliverable: false,
    variants: [
      { label: 'Small', price: 25 },
      { label: 'Large', price: 40 },
    ],
  },
  {
    id: 'sundae',
    name: 'Ice Cream Sundaes',
    category: 'Ice Cream Sundaes',
    options: CATEGORY_OPTIONS['Ice Cream Sundaes'],
    price: 30,
    image:
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=85',
    description: 'Sage, Legacy and Royal Buffet sundaes',
    available: true,
    deliverable: false,
    variants: [
      { label: 'Sage', price: 30 },
      { label: 'Legacy', price: 50 },
      { label: 'Chocolate Classic', price: 120 },
      { label: 'Royal Buffet', price: 150 },
    ],
  },
];
const read = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};
const demoAdmin: Account = {
  id: 'admin-demo',
  name: 'Royal Treats Admin',
  email: 'admin@royaltreats.demo',
  phone: '0000000000',
  role: 'admin',
  password: 'Demo@12345',
  active: true,
};

/** Shown while the API catalogue loads: 'slow' means the first request is taking a while (cold start). */
export type CatalogueStatus = 'ready' | 'loading' | 'slow' | 'error';
const SLOW_AFTER_MS = 4000;
const defaultSettings: Settings = {
  open: '10:00',
  close: '23:00',
  latitude: null,
  longitude: null,
  radiusKm: DELIVERY_RADIUS_KM,
  storeName: 'Royal Treats',
  address: '34 10th Avenue, Thabazimbi',
  supportEmail: '',
};

@Injectable({ providedIn: 'root' })
export class CommerceState {
  private readonly catalogueApi = inject(CatalogueApi);
  private readonly authApi = inject(AuthApi);
  private readonly sessions = inject(SessionService);
  /** True when the catalogue and settings come from the API (see src/environments). */
  readonly apiMode = environment.useApi;
  /** Minimum password length: the API requires 12, the browser demo only 8. */
  readonly passwordMin = environment.useApi ? 12 : 8;
  /** True while a saved API session is being checked after a page load. */
  readonly sessionRestoring = this.sessions.restoring;
  /** True after the API rejected our token, so the sign-in screen can explain. */
  readonly sessionExpired = this.sessions.expired;
  readonly catalogueStatus = signal<CatalogueStatus>(environment.useApi ? 'loading' : 'ready');
  readonly products = signal<CatalogueProduct[]>(
    environment.useApi ? [] : read('royal-products-v2', seedProducts),
  );
  readonly accounts = signal<Account[]>(
    read<Account[]>('royal-accounts-v2', [demoAdmin]).map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      role: a.role,
      password: a.password,
      active: a.active,
      photo: a.photo,
    })),
  );

  readonly session = signal<Account | null>(null);
  readonly settings = signal<Settings>(
    environment.useApi
      ? defaultSettings
      : {
          ...read('royal-settings-v2', defaultSettings),
          supportEmail: read<Partial<Settings>>('royal-settings-v2', {}).supportEmail ?? '',
        },
  );
  readonly deliveries = signal<DeliveryOrder[]>(
    read<DeliveryOrder[]>('royal-deliveries-v2', []).map((o) => ({
      ...o,
      items: o.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
        recipient: i.recipient,
      })),
    })),
  );

  constructor() {
    const id = sessionStorage.getItem('royal-demo-session');
    if (id) this.session.set(this.accounts().find((a) => a.id === id && a.active) ?? null);
    if (this.apiMode) {
      // The signed-in API user, as the Account the templates already read.
      effect(() => {
        const user = this.sessions.user();
        const photo = this.sessions.photoUrl();
        untracked(() => this.session.set(user ? fromApiUser(user, photo) : null));
      });
      void this.refreshCatalogue();
      void this.restoreSession();
    }
  }
  /** After a reload, checks the token kept in sessionStorage; an invalid one ends the session. */
  private async restoreSession(): Promise<void> {
    if (!this.sessions.token()) return;
    this.sessions.restoring.set(true);
    try {
      this.sessions.user.set(await this.authApi.me());
      void this.loadPhoto();
    } catch {
      // A 401 already cleared the session in the interceptor; other failures leave us signed out for now.
    } finally {
      this.sessions.restoring.set(false);
    }
  }
  private async loadPhoto(): Promise<void> {
    try {
      this.sessions.setPhoto(await this.authApi.photo());
    } catch {
      // The picture is optional; a failure to fetch it must not affect signing in.
    }
  }
  private async startApiSession(
    call: () => ReturnType<AuthApi['login']>,
    context: AuthContext,
  ): Promise<string | null> {
    try {
      const { user, token, expiresAt } = await call();
      this.sessions.start(user, token, expiresAt);
      void this.loadPhoto();
      return null;
    } catch (error) {
      return authErrorMessage(toApiError(error), context);
    }
  }
  /** Loads products and settings from the API; retried from the banner after a failure. */
  async refreshCatalogue(): Promise<void> {
    this.catalogueStatus.set('loading');
    const slow = setTimeout(
      () => this.catalogueStatus.update((s) => (s === 'loading' ? 'slow' : s)),
      SLOW_AFTER_MS,
    );
    try {
      const [products, settings] = await Promise.all([
        this.catalogueApi.products(),
        this.catalogueApi.settings(this.settings()),
      ]);
      this.products.set(products);
      this.settings.set(settings);
      this.catalogueStatus.set('ready');
    } catch {
      this.catalogueStatus.set('error');
    } finally {
      clearTimeout(slow);
    }
  }
  private save<T>(key: string, sig: { (): T }, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
  /** Resolves to an error message for the form, or null on success. */
  async register(
    name: string,
    email: string,
    phone: string,
    password: string,
  ): Promise<string | null> {
    if (!this.apiMode) return this.registerLocal(name, email, phone, password);
    const problem = registrationProblem({ name, email, phone, password });
    if (problem) return problem;
    return this.startApiSession(
      () =>
        this.authApi.register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        }),
      'register',
    );
  }
  async signIn(email: string, password: string): Promise<string | null> {
    if (this.apiMode)
      return this.startApiSession(
        () => this.authApi.login(email.trim().toLowerCase(), password),
        'login',
      );
    return this.signInLocal(email, password)
      ? null
      : 'Incorrect email or password (demo account on this device).';
  }
  /** Uploads a profile picture to the API (API mode only). */
  async uploadProfilePhoto(file: File): Promise<string | null> {
    const problem = photoFileProblem(file);
    if (problem) return problem;
    try {
      await this.authApi.uploadPhoto(file);
      await this.loadPhoto();
      return null;
    } catch (error) {
      return authErrorMessage(toApiError(error), 'photo');
    }
  }
  private registerLocal(
    name: string,
    email: string,
    phone: string,
    password: string,
  ): string | null {
    const normalized = email.trim().toLowerCase();
    if (!name.trim() || !normalized || !/^\+?[0-9 ]{9,16}$/.test(phone) || password.length < 8)
      return 'Please enter a name, email, valid phone and password of at least 8 characters.';
    if (this.accounts().some((a) => a.email === normalized))
      return 'That email is already registered.';
    const account: Account = {
      id: 'u-' + Date.now(),
      name: name.trim(),
      email: normalized,
      phone: phone.trim(),
      password,
      role: 'customer',
      active: true,
    };
    this.accounts.update((xs) => [...xs, account]);
    this.save('royal-accounts-v2', this.accounts, this.accounts());
    this.signInLocal(normalized, password);
    return null;
  }
  private signInLocal(email: string, password: string): boolean {
    const a = this.accounts().find(
      (x) => x.email === email.trim().toLowerCase() && x.password === password && x.active,
    );
    this.session.set(a ?? null);
    if (a) sessionStorage.setItem('royal-demo-session', a.id);
    return !!a;
  }
  signOut(): void {
    if (this.apiMode) {
      // Revoke the token on the server (best effort), then forget it here.
      void this.authApi.logout().catch(() => undefined);
      this.sessions.clear();
      return;
    }
    this.session.set(null);
    sessionStorage.removeItem('royal-demo-session');
  }
  updateProfilePhoto(dataUrl: string): string | null {
    const current = this.session();
    if (!current) return 'Sign in to upload a profile picture.';
    if (!/^data:image\/(jpeg|webp|png);base64,/.test(dataUrl) || dataUrl.length > 220_000)
      return 'Choose a smaller JPG, PNG or WebP picture.';
    this.accounts.update((xs) =>
      xs.map((a) => (a.id === current.id ? { ...a, photo: dataUrl } : a)),
    );
    try {
      this.save('royal-accounts-v2', this.accounts, this.accounts());
    } catch {
      return 'Not enough browser storage for this photo.';
    }
    this.session.set(this.accounts().find((a) => a.id === current.id) ?? null);
    return null;
  }

  addCourier(name: string, email: string, phone: string, password: string): string | null {
    if (this.session()?.role !== 'admin') return 'Admin role required.';
    const normalized = email.trim().toLowerCase();
    if (!name.trim() || !normalized || !/^\+?[0-9 ]{9,16}$/.test(phone) || password.length < 8)
      return 'Name, valid phone, email and password of at least 8 characters are required.';
    if (this.accounts().some((a) => a.email === normalized)) return 'Email already registered.';
    this.accounts.update((xs) => [
      ...xs,
      {
        id: 'courier-' + Date.now(),
        name,
        email: normalized,
        phone,
        password,
        role: 'courier',
        active: true,
      },
    ]);
    this.save('royal-accounts-v2', this.accounts, this.accounts());
    return null;
  }
  toggleAccount(id: string): void {
    if (this.session()?.role !== 'admin') return;
    this.accounts.update((xs) =>
      xs.map((a) => (a.id === id && a.role === 'courier' ? { ...a, active: !a.active } : a)),
    );
    this.save('royal-accounts-v2', this.accounts, this.accounts());
  }
  saveProduct(p: CatalogueProduct): void {
    if (this.apiMode || this.session()?.role !== 'admin') return;
    // The MVP only delivers products from deliverable categories, regardless of product configuration.
    const product = { ...p, deliverable: isDeliverableCategory(p.category) && p.deliverable };
    this.products.update((xs) =>
      xs.some((x) => x.id === product.id)
        ? xs.map((x) => (x.id === product.id ? product : x))
        : [...xs, product],
    );
    this.save('royal-products-v2', this.products, this.products());
  }
  saveSettings(s: Settings): void {
    if (this.apiMode || this.session()?.role !== 'admin') return;
    this.settings.set({ ...s, radiusKm: DELIVERY_RADIUS_KM });
    this.save('royal-settings-v2', this.settings, this.settings());
  }
  record(order: DeliveryOrder): void {
    this.deliveries.update((xs) => [order, ...xs]);
    this.save('royal-deliveries-v2', this.deliveries, this.deliveries());
  }
  setOrder(id: string, status: string, courierId?: string): void {
    const user = this.session();
    if (!user || user.role === 'customer') return;
    this.deliveries.update((xs) =>
      xs.map((o) =>
        o.id === id
          ? { ...o, status, courierId: courierId === undefined ? o.courierId : courierId }
          : o,
      ),
    );
    this.save('royal-deliveries-v2', this.deliveries, this.deliveries());
  }
  acceptOrder(id: string): boolean {
    const user = this.session();
    if (user?.role !== 'courier') return false;
    const order = this.deliveries().find((x) => x.id === id);
    if (
      !order ||
      order.fulfillment !== 'delivery' ||
      order.courierId ||
      order.status !== 'Ready for Delivery'
    )
      return false;
    this.setOrder(id, 'Out for Delivery', user.id);
    return true;
  }
  distanceKm(lat: number, lng: number): number | null {
    const s = this.settings();
    if (s.latitude === null || s.longitude === null) return null;
    const rad = (n: number) => (n * Math.PI) / 180;
    const a =
      Math.sin(rad(lat - s.latitude) / 2) ** 2 +
      Math.cos(rad(s.latitude)) * Math.cos(rad(lat)) * Math.sin(rad(lng - s.longitude) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  canDeliver(
    items: { productId: string }[],
    lat: number | null,
    lng: number | null,
  ): { ok: boolean; reason: string; distance: number | null } {
    if (!items.length) return { ok: false, reason: 'Your cart is empty.', distance: null };
    if (
      items.some(
        (i) =>
          !this.products().some(
            (p) =>
              p.id === i.productId &&
              isDeliverableCategory(p.category) &&
              p.deliverable &&
              p.available,
          ),
      )
    )
      return {
        ok: false,
        reason:
          'Only in-stock mini donut products are eligible for delivery. Remove other items or choose collection.',
        distance: null,
      };
    if (lat === null || lng === null)
      return {
        ok: false,
        reason: `Provide your location to check the ${DELIVERY_RADIUS_KM} km delivery area.`,
        distance: null,
      };
    const d = this.distanceKm(lat, lng);
    if (d === null)
      return {
        ok: false,
        reason: 'Store location needs to be configured by the admin.',
        distance: null,
      };
    return {
      ok: d <= DELIVERY_RADIUS_KM,
      reason:
        d <= DELIVERY_RADIUS_KM
          ? 'Within the delivery area.'
          : `Outside the ${DELIVERY_RADIUS_KM} km delivery area.`,
      distance: d,
    };
  }
  inHours(time: string): boolean {
    const s = this.settings();
    return s.open <= s.close
      ? time >= s.open && time <= s.close
      : time >= s.open || time <= s.close;
  }
}
