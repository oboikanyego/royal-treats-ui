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
