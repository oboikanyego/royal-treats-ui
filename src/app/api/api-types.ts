/** Response shapes of royal-treats-api (docs/API.md in that repo). Money is integer ZAR cents. */
export type ApiProduct = {
  id: string;
  name: string;
  category: string;
  description?: string;
  image?: string;
  available: boolean;
  deliverable: boolean;
  priceCents: number;
  variants: { label: string; priceCents: number }[];
  sauces: string[];
  toppings: string[];
};
export type ApiSettings = {
  storeName?: string;
  address?: string;
  supportEmail?: string;
  open?: string;
  close?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
};
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number };
export type ApiUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin' | 'courier';
  active: boolean;
};
export type AuthResponse = { user: ApiUser; token: string; expiresAt: string };
export type ApiOrderItem = {
  productId: string;
  name: string;
  variant: string;
  qty: number;
  priceCents: number;
  sauce: string;
  topping: string;
  recipient: string;
};
export type ApiOrder = {
  id: string;
  customerId: string;
  customer: string;
  phone: string;
  fulfillment: 'collection' | 'delivery';
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  date: string;
  time: string;
  notes?: string;
  payment: string;
  totalCents: number;
  status: string;
  courierId?: string;
  items: ApiOrderItem[];
  createdAt?: string;
  /** The statuses the calling user may move this order to (see the API's allowedStatuses). */
  allowedStatuses?: string[];
};
export type OrderRequest = {
  fulfillment: 'collection' | 'delivery';
  date: string;
  time: string;
  notes: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: {
    productId: string;
    variant: string;
    qty: number;
    sauce: string;
    topping: string;
    recipient: string;
  }[];
};
