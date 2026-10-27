import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { CommerceState } from './commerce-state.service';
import { OrderTrackingService } from './order-tracking.service';

/** The confirmation page only makes sense straight after placing an order. */
const hasJustOrdered: CanActivateFn = () =>
  inject(OrderTrackingService).lastOrder() ? true : inject(Router).createUrlTree(['/track']);

/**
 * Unknown product ids go back to the menu. When the catalogue comes from the API the guard first
 * waits for the load to finish, otherwise a deep link or refresh would always look "unknown".
 */
const knownProduct: CanActivateFn = (route) => {
  const store = inject(CommerceState);
  const router = inject(Router);
  const check = () =>
    store.products().some((p) => p.id === route.paramMap.get('id'))
      ? true
      : router.createUrlTree(['/menu']);
  const settled = (status: string) => status === 'ready' || status === 'error';
  if (settled(store.catalogueStatus())) return check();
  return firstValueFrom(toObservable(store.catalogueStatus).pipe(filter(settled))).then(check);
};

// `data.page` tells the shell which navigation item to highlight.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Sweet Treats, Bigger Smiles',
    data: { page: 'home' },
    loadComponent: () => import('./pages/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'menu',
    pathMatch: 'full',
    title: 'Our Menu',
    data: { page: 'menu' },
    loadComponent: () => import('./pages/menu.component').then((m) => m.MenuComponent),
  },
  {
    path: 'menu/:id',
    title: 'Menu',
    data: { page: 'product' },
    canActivate: [knownProduct],
    loadComponent: () => import('./pages/product.component').then((m) => m.ProductComponent),
  },
  {
    path: 'cart',
    title: 'Your Basket',
    data: { page: 'cart' },
    loadComponent: () => import('./pages/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    title: 'Checkout',
    data: { page: 'checkout' },
    loadComponent: () => import('./pages/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'order-placed',
    title: 'Order Placed',
    data: { page: 'success' },
    canActivate: [hasJustOrdered],
    loadComponent: () => import('./pages/success.component').then((m) => m.SuccessComponent),
  },
  {
    path: 'track',
    title: 'Track Order',
    data: { page: 'track' },
    loadComponent: () => import('./pages/track.component').then((m) => m.TrackComponent),
  },
  {
    path: 'about',
    title: 'About Us',
    data: { page: 'about' },
    loadComponent: () => import('./pages/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'contact',
    title: 'Contact',
    data: { page: 'contact' },
    loadComponent: () => import('./pages/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'account',
    title: 'Account',
    data: { page: 'portal' },
    loadComponent: () => import('./portal.component').then((m) => m.PortalComponent),
  },
  { path: '**', redirectTo: '' },
];
