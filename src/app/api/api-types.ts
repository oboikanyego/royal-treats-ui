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
  /** True when the API can send email, so "Forgot password?" can work. */
  passwordResetEnabled?: boolean;
  /** While true the API refuses new orders; customers see `pauseMessage`. */
  ordersPaused?: boolean;
  pauseMessage?: string;
  /** Seven days, Sunday first; absent means every day uses open/close. */
  weeklyHours?: { closed: boolean; open: string; close: string }[] | null;
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
  history?: { status: string; actorId?: string; at?: string; note?: string }[];
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

/** What the admin tools send and receive (royal-treats-api /admin/*). */
export type ProductPayload = {
  name: string;
  category: string;
  description: string;
  image: string;
  available: boolean;
  deliverable: boolean;
  variants: { label: string; priceCents: number }[];
  sauces: string[];
  toppings: string[];
};
export type SettingsPayload = {
  storeName: string;
  address: string;
  supportEmail: string;
  open: string;
  close: string;
  latitude: number | null;
  longitude: number | null;
  ordersPaused?: boolean;
  pauseMessage?: string;
  weeklyHours?: { closed: boolean; open: string; close: string }[];
};
export type ApiDashboard = {
  ordersByStatus: { _id: string; count: number; totalCents: number }[];
  completedRevenueCents: number;
  products: number;
  /** Pending password requests (0 from an older API). */
  passwordRequests?: number;
};
export type ApiPasswordRequest = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  requestedAt: string;
  orderCount: number;
  lastOrderAt: string | null;
};
export type ApiImage = { url: string; width: number; height: number };
export type CourierRequest = { name: string; email: string; phone: string; password: string };
export type ApiCourierJob = { id: string; date: string; time: string; distanceKm?: number };

/** What the API pushes to a signed-in admin over Socket.IO (royal-treats-api, `order:new`). */
export type ApiLiveOrder = {
  id: string;
  customer: string;
  fulfillment: string;
  totalCents: number;
  itemCount: number;
  date: string;
  time: string;
  createdAt: string;
};
