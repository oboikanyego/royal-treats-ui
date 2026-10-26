import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CartService } from './cart.service';
import { CommerceState } from './commerce-state.service';

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

/** App shell: welcome splash, header and navigation, footer, and the routed page. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(CommerceState);
  readonly count = inject(CartService).count;
  private readonly router = inject(Router);

  /** The active page, from the route's `data.page`, for highlighting navigation. */
  readonly page = signal('home');
  menu = false;
  readonly showWelcome = signal(!localStorage.getItem('royal-welcome-v1'));

  constructor() {
    if (this.showWelcome()) setTimeout(() => this.dismissWelcome(), 2200);
    const sub = this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      let route = this.router.routerState.snapshot.root;
      while (route.firstChild) route = route.firstChild;
      this.page.set(String(route.data['page'] ?? 'home'));
      this.menu = false;
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  dismissWelcome() {
    this.showWelcome.set(false);
    localStorage.setItem('royal-welcome-v1', 'yes');
  }
  signOut() {
    this.store.signOut();
    this.go('home');
  }
  go(p: string) {
    this.router.navigateByUrl(pagePaths[p] ?? '/');
  }
}
