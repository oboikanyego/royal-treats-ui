import { Component, ViewEncapsulation, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommerceState } from './commerce-state.service';
import { AdminCouriersComponent } from './workspace/admin-couriers.component';
import { AdminOrdersComponent } from './workspace/admin-orders.component';
import { AdminOverviewComponent } from './workspace/admin-overview.component';
import { AdminProductsComponent } from './workspace/admin-products.component';
import { AdminSettingsComponent } from './workspace/admin-settings.component';
import { CourierWorkspaceComponent } from './workspace/courier-workspace.component';

type Screen = 'signin' | 'register' | 'home' | 'products' | 'couriers' | 'settings' | 'orders';

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
  ],
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.css'],
  // Shadow DOM keeps the global storefront stylesheet from reaching the staff workspace.
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class PortalComponent {
  readonly store = inject(CommerceState);
  screen = signal<Screen>('signin');
  error = '';
  notice = '';
  email = '';
  password = '';
  name = '';
  phone = '';
  photoError = '';
  uploadingPhoto = false;

  constructor() {
    if (this.store.session()) this.screen.set('home');
    // Follow the session: leave the sign-in screens once signed in (e.g. a session restored after a
    // reload), and come back to them when it ends (sign-out, or the server rejecting the token).
    effect(() => {
      const signedIn = !!this.store.session();
      untracked(() => {
        const onAuthScreen = this.screen() === 'signin' || this.screen() === 'register';
        if (signedIn && onAuthScreen) this.screen.set('home');
        if (!signedIn && !onAuthScreen) this.screen.set('signin');
      });
    });
  }

  async login() {
    this.error = (await this.store.signIn(this.email, this.password)) ?? '';
    if (this.error) return;
    this.screen.set('home');
    this.password = '';
  }

  async register() {
    this.error =
      (await this.store.register(this.name, this.email, this.phone, this.password)) ?? '';
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
    this.screen.set(to);
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
