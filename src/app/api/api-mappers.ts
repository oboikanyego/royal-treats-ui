import { flavourLabelFor } from '../catalogue-config';
import type { CatalogueProduct, Settings } from '../commerce-state.service';
import { centsToRand } from '../money';
import type { ApiProduct, ApiSettings } from './api-types';

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
  };
}
