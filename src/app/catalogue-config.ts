import type { CatalogueProduct } from './commerce-state.service';

/** Customer choices a product offers on its page. Empty lists hide that step. */
export type ProductOptions = { flavourLabel: string; flavours: string[]; toppings: string[] };

/** Defaults used when a product does not carry its own `options` (older saved data, new products). */
export const CATEGORY_OPTIONS: Record<string, ProductOptions> = {
  Slushies: {
    flavourLabel: 'flavour',
    flavours: ['Lemon Lime', 'Strawberry', 'Blueberry'],
    toppings: [],
  },
  'Mini Donuts': {
    flavourLabel: 'sauce',
    flavours: ['Chocolate', 'Caramel', 'Milky White'],
    toppings: ['Nuts', 'Oreo', 'Chocolate chips', 'Rainbow sprinkles', 'Plain sprinkles'],
  },
  Milkshakes: {
    flavourLabel: 'flavour',
    flavours: ['Bubblegum', 'Chocolate', 'Strawberry', 'Vanilla'],
    toppings: [],
  },
  'Ice Cream Sundaes': {
    flavourLabel: 'flavour',
    flavours: [],
    toppings: [
      'Wafer',
      'Oreo biscuit',
      'Marshmallows',
      'Chocolate sticks',
      'Caramel popcorn',
      'Gummy bears',
      'Peanuts',
    ],
  },
};

/** A category we have no configuration for still gets a sensible sauce choice. */
const FALLBACK_OPTIONS: ProductOptions = {
  flavourLabel: 'sauce',
  flavours: ['Chocolate', 'Caramel', 'Milky White'],
  toppings: [],
};

export const optionsFor = (
  product: Pick<CatalogueProduct, 'category' | 'options'>,
): ProductOptions => product.options ?? CATEGORY_OPTIONS[product.category] ?? FALLBACK_OPTIONS;

/** The MVP only delivers products from these categories. */
export const DELIVERABLE_CATEGORIES = ['Mini Donuts'];
export const isDeliverableCategory = (category: string): boolean =>
  DELIVERABLE_CATEGORIES.includes(category);

/** Straight-line delivery radius from the store. */
export const DELIVERY_RADIUS_KM = 5;
