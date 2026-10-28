import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AdminLive } from './api/admin-live.service';
import { Busy } from './busy.service';
import { CartService } from './cart.service';
import { CommerceState } from './commerce-state.service';
import { IconComponent } from './icon.component';

const pagePaths: Record<string, string> = {
  home: '/',
  menu: '/menu',
  cart: '/cart',
  checkout: '/checkout',
  success: '/order-placed',
  orders: '/orders',
  about: '/about',
  contact: '/contact',
  portal: '/account',
};

/** App shell: welcome splash, header and navigation, footer, and the routed page. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, IconComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(CommerceState);
  readonly count = inject(CartService).count;
  readonly live = inject(AdminLive);
  readonly busy = inject(Busy);
  private readonly router = inject(Router);

  /** The active page, from the route's `data.page`, for highlighting navigation. */
  readonly page = signal('home');
  menu = false;
  /** The admin screen in the address (`?screen=`), or 'home'. */
  readonly adminScreen = signal('home');
  readonly showWelcome = signal(!localStorage.getItem('royal-welcome-v1'));

  constructor() {
    if (this.showWelcome()) setTimeout(() => this.dismissWelcome(), 2200);
    const sub = this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      let route = this.router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      this.page.set(String(route.data['page'] ?? 'home'));
      // Which admin screen is open lives in the address (?screen=), for the bottom bar and the menu.
      this.adminScreen.set(String(route.queryParams['screen'] ?? 'home'));
      this.menu = false;
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  dismissWelcome() {
    this.showWelcome.set(false);
    localStorage.setItem('royal-welcome-v1', 'yes');
  }
  /** From a new-order alert to the admin's Orders screen. */
  openOrders(alertId: string) {
    this.live.dismiss(alertId);
    this.router.navigate(['/account'], { queryParams: { screen: 'orders' } });
  }
  initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] || '')
      .join('')
      .toUpperCase();
  }
  /** From the menu or the bottom bar to one of the admin's own screens. */
  openAdmin(screen: string) {
    this.menu = false;
    void this.router.navigate(['/account'], {
      queryParams: { screen: screen === 'home' ? null : screen },
    });
  }
  signOut() {
    this.store.signOut();
    this.go('home');
  }
  go(p: string) {
    this.router.navigateByUrl(pagePaths[p] ?? '/');
  }
}
