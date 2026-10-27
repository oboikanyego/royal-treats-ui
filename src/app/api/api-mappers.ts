import { flavourLabelFor } from '../catalogue-config';
import type { Account, CatalogueProduct, DeliveryOrder, Settings } from '../commerce-state.service';
import { centsToRand } from '../money';
import type { ApiOrder, ApiProduct, ApiSettings, ApiUser } from './api-types';

/** The API's product, in the shape the storefront already uses (prices in rand). */
export function fromApiProduct(p: ApiProduct): CatalogueProduct {
  const variants = p.variants.map((v) => ({ label: v.label, price: centsToRand(v.priceCents) }));
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: centsToRand(p.priceCents),
    image: p.image ?? '',
    description: p.description ?? '',
    available: p.available,
    deliverable: p.deliverable,
    variants,
    // The API only has flat `sauces`/`toppings`; the label ("sauce" vs "flavour") comes from the category.
    options: {
      flavourLabel: flavourLabelFor(p.category),
      flavours: p.sauces,
      toppings: p.toppings,
    },
  };
}

/** API settings over the defaults, since a fresh API may only return part of them. */
export function fromApiSettings(s: ApiSettings, defaults: Settings): Settings {
  return {
    storeName: s.storeName ?? defaults.storeName,
    address: s.address ?? defaults.address,
    supportEmail: s.supportEmail ?? defaults.supportEmail,
    open: s.open ?? defaults.open,
    close: s.close ?? defaults.close,
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    radiusKm: s.radiusKm ?? defaults.radiusKm,
    passwordResetEnabled: s.passwordResetEnabled ?? defaults.passwordResetEnabled ?? false,
  };
}

/** The signed-in API user as the `Account` the UI already uses (there is no password on the client). */
export function fromApiUser(user: ApiUser, photoUrl: string | null): Account {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    active: user.active,
    photo: photoUrl ?? undefined,
  };
}

/** API order ids are `RT-` plus a 36-character UUID; customers see `RT-` and its first 8 characters. */
export function shortRef(id: string): string {
  const match = /^RT-([0-9a-f]{8})-[0-9a-f-]{27}$/i.exec(id);
  return match ? `RT-${match[1]!.toUpperCase()}` : id;
}

/** An API order (cents) as the DeliveryOrder the UI already renders (rand). */
export function fromApiOrder(o: ApiOrder): DeliveryOrder {
  return {
    id: o.id,
    ref: shortRef(o.id),
    customerId: o.customerId,
    customer: o.customer,
    phone: o.phone,
    address: o.address ?? '',
    latitude: o.latitude,
    longitude: o.longitude,
    distanceKm: o.distanceKm,
    fulfillment: o.fulfillment,
    courierId: o.courierId,
    status: o.status,
    payment: o.payment,
    total: centsToRand(o.totalCents),
    items: o.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      price: centsToRand(i.priceCents),
      recipient: i.recipient,
      variant: i.variant,
      sauce: i.sauce,
      topping: i.topping,
    })),
    date: o.date,
    time: o.time,
    notes: o.notes,
    createdAt: o.createdAt,
    allowedStatuses: o.allowedStatuses ?? [],
  };
}
