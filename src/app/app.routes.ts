import { Routes } from '@angular/router';

// Pages are still rendered by AppComponent; each route only declares which page it is.
// `data.page` is the single source of truth that AppComponent syncs its view from.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: { page: 'home', title: 'Sweet Treats, Bigger Smiles' },
    children: [],
  },
  { path: 'menu', pathMatch: 'full', data: { page: 'menu', title: 'Our Menu' }, children: [] },
  { path: 'menu/:id', data: { page: 'product', title: 'Menu' }, children: [] },
  { path: 'cart', data: { page: 'cart', title: 'Your Basket' }, children: [] },
  { path: 'checkout', data: { page: 'checkout', title: 'Checkout' }, children: [] },
  { path: 'order-placed', data: { page: 'success', title: 'Order Placed' }, children: [] },
  { path: 'track', data: { page: 'track', title: 'Track Order' }, children: [] },
  { path: 'about', data: { page: 'about', title: 'About Us' }, children: [] },
  { path: 'contact', data: { page: 'contact', title: 'Contact' }, children: [] },
  { path: 'account', data: { page: 'portal', title: 'Account' }, children: [] },
  { path: '**', redirectTo: '' },
];
