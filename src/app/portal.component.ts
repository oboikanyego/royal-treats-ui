import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminLive } from './api/admin-live.service';
import { CommerceState } from './commerce-state.service';
import { type PortalScreen, authCopy, portalHeading } from './portal-headings';
import { AdminCouriersComponent } from './workspace/admin-couriers.component';
import { AdminOrdersComponent } from './workspace/admin-orders.component';
import { AdminOverviewComponent } from './workspace/admin-overview.component';
import { AdminProductsComponent } from './workspace/admin-products.component';
import { AdminSettingsComponent } from './workspace/admin-settings.component';
import { AccountSettingsComponent } from './workspace/account-settings.component';
import { CourierWorkspaceComponent } from './workspace/courier-workspace.component';
import { PasswordFieldComponent } from './workspace/password-field.component';

const ADMIN_SCREENS: PortalScreen[] = [
  'home',
  'orders',
  'products',
  'couriers',
  'settings',
  'account',
];

/** Sign-in, registration and the signed-in workspace for each role. */
@Component({
  selector: 'app-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminOverviewComponent,
    AdminOrdersComponent,
    AdminProductsComponent,
    AdminCouriersComponent,
    AdminSettingsComponent,
    CourierWorkspaceComponent,
    AccountSettingsComponent,
    PasswordFieldComponent,
  ],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.css'],
  // Shadow DOM keeps the global storefront stylesheet from reaching the staff workspace.
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class PortalComponent {
  readonly store = inject(CommerceState);
  /** The shop's own number from Settings, or empty when it has not set one. */
  readonly shopPhone = computed(() => (this.store.settings().supportPhone ?? '').trim());
  readonly live = inject(AdminLive);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly router = inject(Router);
  private readonly activeRoute = inject(ActivatedRoute);
  screen = signal<PortalScreen>('signin');
  error = '';
  notice = '';
  email = '';
  password = '';
  consent = false;
  /** "Keep me signed in on this device": on by default, as phones often drop a tab's session. */
  remember = true;
  newPassword = '';
  confirmPassword = '';
  resetSent = false;
  sendingReset = false;
  name = '';
  phone = '';
  photoError = '';
  uploadingPhoto = false;

  constructor() {
    if (this.store.session()) this.screen.set('home');
    // However the screen changes, keep the active admin tab in view on a narrow phone.
    effect(() => {
      this.screen();
      setTimeout(() =>
        this.host.nativeElement.shadowRoot
          ?.querySelector<HTMLElement>('.appbar-tabs button.active')
          ?.scrollIntoView?.({ inline: 'center', block: 'nearest' }),
      );
    });
    // A new-order alert links here with ?screen=orders.
    const route = inject(ActivatedRoute);
    const sub = route.queryParamMap.subscribe(() => this.followAddress());
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
    // Follow the session: leave the sign-in screens once signed in (e.g. a session restored after a
    // reload), and come back to them when it ends (sign-out, or the server rejecting the token).
    effect(() => {
      const signedIn = !!this.store.session();
      untracked(() => {
        const onAuthScreen = ['signin', 'register', 'forgot'].includes(this.screen());
        if (signedIn && onAuthScreen) {
          this.screen.set('home');
          this.followAddress();
        }
        if (!signedIn && !onAuthScreen) this.screen.set('signin');
      });
    });
  }

  /** An admin's screen is the address's ?screen= (no value means the overview). */
  private followAddress() {
    if (this.store.session()?.role !== 'admin') return;
    const wanted = this.activeRoute.snapshot.queryParamMap.get('screen') as PortalScreen | null;
    this.screen.set(wanted && ADMIN_SCREENS.includes(wanted) ? wanted : 'home');
  }

  telHref(phone: string): string {
    return 'tel:' + phone.replace(/\s+/g, '');
  }

  authTitle() {
    return authCopy(this.screen()).title;
  }
  authSubtitle() {
    return authCopy(this.screen()).subtitle;
  }

  openForgot() {
    this.error = '';
    this.resetSent = false;
    this.newPassword = this.confirmPassword = '';
    this.screen.set('forgot');
  }

  async sendReset() {
    this.sendingReset = true;
    this.error =
      (await this.store.requestPasswordChange(
        this.email,
        this.newPassword,
        this.confirmPassword,
      )) ?? '';
    this.resetSent = !this.error;
    if (this.resetSent) this.newPassword = this.confirmPassword = '';
    this.sendingReset = false;
  }

  async login() {
    this.error = (await this.store.signIn(this.email, this.password, this.remember)) ?? '';
    if (this.error) return;
    this.screen.set('home');
    this.password = '';
  }

  async register() {
    this.error =
      (await this.store.register(
        this.name,
        this.email,
        this.phone,
        this.password,
        this.consent,
        this.remember,
      )) ?? '';
    if (!this.error) {
      this.screen.set('home');
      this.password = '';
      this.consent = false;
    }
  }

  logout() {
    this.store.signOut();
    this.screen.set('signin');
    this.error = '';
  }

  heading(role: string) {
    return portalHeading(role, this.screen());
  }

  nav(to: 'home' | 'products' | 'couriers' | 'settings' | 'orders' | 'account') {
    this.notice = '';
    this.error = '';
    this.screen.set(to);
    // Keep the address in step, so the bottom bar, the menu and the back button all agree.
    if (this.store.session()?.role === 'admin')
      void this.router.navigate([], {
        relativeTo: this.activeRoute,
        queryParams: { screen: to === 'home' ? null : to },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
  }

  /** A tap on the admin app bar: switch section, close the menu, keep the tab in view, go to the top. */
  tab(to: 'home' | 'products' | 'couriers' | 'settings' | 'orders' | 'account', event?: Event) {
    this.nav(to);
    (event?.currentTarget as HTMLElement | null)?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
    window.scrollTo({ top: 0 });
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || '')
      .join('')
      .toUpperCase();
  }

  /** The API validates and resizes the picture itself, so the file is sent as it is. */
  async uploadProfilePhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.photoError = '';
    this.uploadingPhoto = true;
    this.photoError = (await this.store.uploadProfilePhoto(file)) ?? '';
    if (!this.photoError) this.notice = 'Profile picture updated.';
    this.uploadingPhoto = false;
    input.value = '';
  }
}
