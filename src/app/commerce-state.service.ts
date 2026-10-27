import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { fromApiUser } from './api/api-mappers';
import { toApiError } from './api/api-errors';
import { AuthApi } from './api/auth-api.service';
import { authErrorMessage, registrationProblem, type AuthContext } from './api/auth-messages';
import { CatalogueApi } from './api/catalogue-api.service';
import { photoFileProblem } from './api/photo-file';
import { SessionService } from './api/session.service';
import { DELIVERY_RADIUS_KM, isDeliverableCategory, type ProductOptions } from './catalogue-config';

export type Role = 'admin' | 'customer' | 'courier';
export type Account = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
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
  items: {
    name: string;
    qty: number;
    price: number;
    recipient?: string;
    variant?: string;
    sauce?: string;
    topping?: string;
  }[];
  date: string;
  time: string;
  notes?: string;
  /** Short reference to show customers (API orders have long ids). */
  ref?: string;
  /** ISO time the order was placed (API orders). */
  createdAt?: string;
  /** Statuses the signed-in user may move this order to (API orders). */
  allowedStatuses?: string[];
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
  /** True while a saved session is being checked after a page load. */
  readonly sessionRestoring = this.sessions.restoring;
  /** True after the API rejected our token, so the sign-in screen can explain. */
  readonly sessionExpired = this.sessions.expired;
  readonly catalogueStatus = signal<CatalogueStatus>('loading');
  readonly products = signal<CatalogueProduct[]>([]);
  readonly settings = signal<Settings>(defaultSettings);
  /** The signed-in user, as the Account the templates read. */
  readonly session = signal<Account | null>(null);

  constructor() {
    effect(() => {
      const user = this.sessions.user();
      const photo = this.sessions.photoUrl();
      untracked(() => this.session.set(user ? fromApiUser(user, photo) : null));
    });
    void this.refreshCatalogue();
    void this.restoreSession();
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
  /** Resolves to an error message for the form, or null on success. */
  async register(
    name: string,
    email: string,
    phone: string,
    password: string,
  ): Promise<string | null> {
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
    return this.startApiSession(
      () => this.authApi.login(email.trim().toLowerCase(), password),
      'login',
    );
  }
  /** Uploads a profile picture to the API. */
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
  signOut(): void {
    // Revoke the token on the server (best effort), then forget it here.
    void this.authApi.logout().catch(() => undefined);
    this.sessions.clear();
  }
  /** Shows a product the admin just saved, so the menu and admin lists stay current. */
  applyProduct(p: CatalogueProduct): void {
    this.products.update((xs) =>
      xs.some((x) => x.id === p.id) ? xs.map((x) => (x.id === p.id ? p : x)) : [p, ...xs],
    );
  }
  /** Shows the settings the admin just saved. */
  applySettings(s: Settings): void {
    this.settings.set(s);
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
