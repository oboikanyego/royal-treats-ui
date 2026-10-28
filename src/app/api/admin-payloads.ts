import { isDeliverableCategory } from '../catalogue-config';
import type { CatalogueProduct, Settings } from '../commerce-state.service';
import { randToCents } from '../money';
import { weekProblem } from '../opening-hours';
import type { CourierRequest, ProductPayload, SettingsPayload } from './api-types';

const MAX_PRICE_CENTS = 10_000_000; // the API's per-variant ceiling (R100 000)
const MAX_VARIANTS = 20;
const MAX_OPTIONS = 30;

/** "Chocolate, Caramel" or one per line, as a clean list: trimmed, no blanks, no repeats. */
export function parseOptionList(text: string): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const option = raw.trim();
    if (option && !seen.has(option.toLowerCase())) {
      seen.add(option.toLowerCase());
      list.push(option);
    }
  }
  return list;
}

export const optionListText = (list: string[] | undefined): string => (list ?? []).join('\n');

const wholeCents = (rand: number) => Math.abs(rand * 100 - randToCents(rand)) < 1e-6;

/** Mirrors the API's product rules so mistakes are caught before a request; null when it is fine. */
export function productProblem(
  p: CatalogueProduct,
  optionText: { flavours: string; toppings: string },
): string | null {
  if (!p.name.trim()) return 'Enter a product name.';
  if (p.name.trim().length > 100) return 'The product name can be at most 100 characters.';
  if (!p.category.trim()) return 'Choose a category.';
  if (p.description.length > 1500) return 'The description can be at most 1500 characters.';
  if (!p.variants.length) return 'Add at least one size or pack with a price.';
  if (p.variants.length > MAX_VARIANTS) return `Use at most ${MAX_VARIANTS} sizes or packs.`;
  const labels = new Set<string>();
  for (const v of p.variants) {
    const label = v.label.trim();
    if (!label) return 'Every size or pack needs a name.';
    if (label.length > 80) return 'Size and pack names can be at most 80 characters.';
    if (labels.has(label))
      return `"${label}" is listed twice. Size and pack names must be different.`;
    labels.add(label);
    if (typeof v.price !== 'number' || !Number.isFinite(v.price) || v.price < 0)
      return `Enter a price for "${label}".`;
    if (!wholeCents(v.price)) return `The price for "${label}" can have at most two decimals.`;
    if (randToCents(v.price) > MAX_PRICE_CENTS) return `The price for "${label}" is too high.`;
  }
  for (const list of [parseOptionList(optionText.flavours), parseOptionList(optionText.toppings)]) {
    if (list.length > MAX_OPTIONS) return `Offer at most ${MAX_OPTIONS} choices per list.`;
    if (list.some((o) => o.length > 80)) return 'Each choice can be at most 80 characters.';
  }
  return null;
}

/** The body for POST/PUT /admin/products. The image is whatever an upload (or the product already) holds. */
export function toProductPayload(
  p: CatalogueProduct,
  optionText: { flavours: string; toppings: string },
): ProductPayload {
  return {
    name: p.name.trim(),
    category: p.category.trim(),
    description: p.description,
    image: p.image,
    available: p.available,
    // Only mini donuts can be delivered (the API refuses anything else).
    deliverable: p.deliverable && isDeliverableCategory(p.category.trim()),
    variants: p.variants.map((v) => ({ label: v.label.trim(), priceCents: randToCents(v.price) })),
    sauces: parseOptionList(optionText.flavours),
    toppings: parseOptionList(optionText.toppings),
  };
}

/** A sold-out/restock toggle: the stored product again, with only `available` changed. */
export function toAvailabilityPayload(p: CatalogueProduct, available: boolean): ProductPayload {
  return toProductPayload(
    { ...p, available },
    {
      flavours: optionListText(p.options?.flavours),
      toppings: optionListText(p.options?.toppings),
    },
  );
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function settingsProblem(s: Settings): string | null {
  if (!s.storeName.trim()) return 'Enter the store name.';
  if (!s.address.trim()) return 'Enter the store address.';
  const email = s.supportEmail.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254))
    return 'Enter a valid support email address, or leave it blank.';
  const shopPhone = (s.supportPhone ?? '').trim();
  if (shopPhone && !/^\+?[0-9 ]{9,16}$/.test(shopPhone))
    return 'Enter a valid shop phone number (digits and spaces), or leave it blank.';
  if (!TIME.test(s.open) || !TIME.test(s.close)) return 'Enter opening and closing times.';
  if (s.open === s.close) return 'Opening and closing time must differ.';
  if ((s.pauseMessage ?? '').trim().length > 200)
    return 'The pause message can be at most 200 characters.';
  if (s.weeklyHours) {
    const week = weekProblem(s.weeklyHours);
    if (week) return week;
  }
  const lat = s.latitude;
  const lng = s.longitude;
  if ((lat === null) !== (lng === null))
    return 'Enter both the latitude and the longitude, or neither.';
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
    return 'The latitude must be between -90 and 90.';
  if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
    return 'The longitude must be between -180 and 180.';
  return null;
}

export function toSettingsPayload(s: Settings): SettingsPayload {
  return {
    storeName: s.storeName.trim(),
    address: s.address.trim(),
    supportEmail: s.supportEmail.trim(),
    ...(s.supportPhone === undefined ? {} : { supportPhone: s.supportPhone.trim() }),
    open: s.open,
    close: s.close,
    latitude: s.latitude,
    longitude: s.longitude,
    ordersPaused: !!s.ordersPaused,
    pauseMessage: (s.pauseMessage ?? '').trim(),
    ...(s.weeklyHours ? { weeklyHours: s.weeklyHours } : {}),
  };
}

export function toCourierRequest(c: CourierRequest): CourierRequest {
  return {
    name: c.name.trim(),
    email: c.email.trim(),
    phone: c.phone.trim(),
    password: c.password,
  };
}

/** What the API accepts for an admin-created image: a JPG, PNG or WebP of at most 5 MB. */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export function productImageProblem(file: { type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Choose a JPG, PNG or WebP picture.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return 'Choose a picture under 5 MB.';
  return null;
}
