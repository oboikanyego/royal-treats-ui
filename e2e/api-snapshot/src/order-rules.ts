import { ApiError } from './security.js';
import { hoursFor, withinHours } from './schedule.js';
import type { OrderInput } from './validation.js';
export { ORDER_STATUSES } from './statuses.js';
export function distanceKm(
  lat: number,
  lng: number,
  storeLat: number,
  storeLng: number,
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const a =
    Math.sin(rad(lat - storeLat) / 2) ** 2 +
    Math.cos(rad(storeLat)) *
      Math.cos(rad(lat)) *
      Math.sin(rad(lng - storeLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function priceOrder(
  input: OrderInput,
  products: any[],
  settings: any,
  now = new Date(),
) {
  const scheduled = new Date(`${input.date}T${input.time}:00+02:00`);
  const validDate = new Date(`${input.date}T00:00:00Z`);
  if (
    !Number.isFinite(scheduled.getTime()) ||
    !Number.isFinite(validDate.getTime()) ||
    validDate.toISOString().slice(0, 10) !== input.date ||
    scheduled <= now ||
    scheduled.getTime() - now.getTime() > 90 * 86400000
  )
    throw new ApiError(400, 'Choose a future date within 90 days');
  const hours = hoursFor(settings, input.date);
  if (!hours) throw new ApiError(400, 'We are closed on that day');
  if (!withinHours(hours, input.time))
    throw new ApiError(400, 'Time is outside store hours');
  const items = input.items.map((line) => {
    const p = products.find((p) => String(p._id) === line.productId);
    if (!p?.available) throw new ApiError(409, 'An item is unavailable');
    const variant = p.variants.find((v: any) => v.label === line.variant);
    if (!variant) throw new ApiError(400, 'Unknown product variant');
    if (
      (line.sauce && !p.sauces.includes(line.sauce)) ||
      (line.topping && !p.toppings.includes(line.topping))
    )
      throw new ApiError(400, 'Unknown sauce or topping');
    if (
      input.fulfillment === 'delivery' &&
      (p.category !== 'Mini Donuts' || !p.deliverable)
    )
      throw new ApiError(400, 'Only available mini donuts can be delivered');
    return { ...line, name: p.name, priceCents: variant.priceCents };
  });
  let distance: number | undefined;
  if (input.fulfillment === 'delivery') {
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !input.address
    )
      throw new ApiError(400, 'Delivery address and coordinates required');
    if (settings.latitude == null || settings.longitude == null)
      throw new ApiError(409, 'Store coordinates are not configured');
    distance = distanceKm(
      input.latitude,
      input.longitude,
      settings.latitude,
      settings.longitude,
    );
    if (distance > 5)
      throw new ApiError(400, 'Address is outside the 5 km delivery area');
  }
  return {
    items,
    totalCents: items.reduce(
      (sum, item) => sum + item.priceCents * item.qty,
      0,
    ),
    distanceKm: distance,
    payment:
      input.fulfillment === 'delivery'
        ? 'Cash on Delivery'
        : 'Cash on Collection',
  };
}
export function nextStatuses(status: string, fulfillment: string): string[] {
  const ready =
    fulfillment === 'delivery' ? 'Ready for Delivery' : 'Ready for Collection';
  const transitions: Record<string, string[]> = {
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Preparing', 'Cancelled'],
    Preparing: [ready, 'Cancelled'],
    'Ready for Collection': ['Completed', 'Cancelled'],
    'Ready for Delivery': ['Cancelled'],
    'Out for Delivery': ['Completed'],
  };
  return transitions[status] ?? [];
}
type Actor = { _id: unknown; role: string };
type StatusSubject = {
  status?: string | null;
  fulfillment?: string | null;
  customerId?: unknown;
  courierId?: unknown;
};
/**
 * Statuses `user` may move this order to: the order's valid transitions,
 * narrowed by role. Only an admin may cancel an order, or move it on in any
 * other way: a customer has no status changes (to cancel, they contact the
 * shop), a courier can only complete their own delivery that is Out for
 * Delivery, and an admin may take any valid transition.
 */
export function allowedStatuses(order: StatusSubject, user: Actor): string[] {
  const valid = nextStatuses(order.status ?? '', order.fulfillment ?? '');
  const mine = (id: unknown) => id != null && String(id) === String(user._id);
  if (user.role === 'admin') return valid;
  if (user.role === 'courier')
    return mine(order.courierId) && order.status === 'Out for Delivery'
      ? valid.filter((s) => s === 'Completed')
      : [];
  return [];
}
/** Throws the error PATCH /orders/:id/status returns when `user` may not set `status`. */
export function assertStatusChange(
  order: StatusSubject,
  user: Actor,
  status: string,
) {
  if (allowedStatuses(order, user).includes(status)) return;
  if (user.role === 'customer')
    throw new ApiError(
      403,
      'Only the shop can change an order. Contact us to cancel it',
    );
  if (user.role === 'courier')
    throw new ApiError(403, 'Only your assigned delivery can be completed');
  throw new ApiError(409, 'Invalid status transition');
}
