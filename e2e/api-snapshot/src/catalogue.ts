/**
 * The four launch products and the sauce/topping choices customers get for each.
 * Orders are validated against these lists, so they must match what the storefront
 * offers. Confirm them against the real menu before launch.
 */
export type SeedProduct = {
  _id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  deliverable: boolean;
  variants: { label: string; priceCents: number }[];
  sauces: string[];
  toppings: string[];
};
export const seedProducts: SeedProduct[] = [
  {
    _id: 'slush',
    name: 'Slushies',
    category: 'Slushies',
    description: 'Lemon Lime, Strawberry or Blueberry',
    image:
      'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=85',
    deliverable: false,
    variants: [
      { label: 'Small cup', priceCents: 1500 },
      { label: 'Big cup', priceCents: 3000 },
    ],
    sauces: ['Lemon Lime', 'Strawberry', 'Blueberry'],
    toppings: [],
  },
  {
    _id: 'donuts',
    name: 'Mini Donuts',
    category: 'Mini Donuts',
    description: 'Fresh mini donuts with your favourite toppings',
    image:
      'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=85',
    deliverable: true,
    variants: [
      { label: '6 donuts', priceCents: 2500 },
      { label: '12 donuts', priceCents: 5000 },
      { label: '24 donuts', priceCents: 9500 },
      { label: '50 donuts', priceCents: 21000 },
    ],
    sauces: ['Chocolate', 'Caramel', 'Milky White'],
    toppings: [
      'Nuts',
      'Oreo',
      'Chocolate chips',
      'Rainbow sprinkles',
      'Plain sprinkles',
    ],
  },
  {
    _id: 'shake',
    name: 'Milkshakes',
    category: 'Milkshakes',
    description: 'Creamy milkshakes',
    image:
      'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=900&q=85',
    deliverable: false,
    variants: [
      { label: 'Small', priceCents: 2500 },
      { label: 'Large', priceCents: 4000 },
    ],
    sauces: ['Bubblegum', 'Chocolate', 'Strawberry', 'Vanilla'],
    toppings: [],
  },
  {
    _id: 'sundae',
    name: 'Ice Cream Sundaes',
    category: 'Ice Cream Sundaes',
    description: 'Sage, Legacy and Royal Buffet sundaes',
    image:
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=85',
    deliverable: false,
    variants: [
      { label: 'Sage', priceCents: 3000 },
      { label: 'Legacy', priceCents: 5000 },
      { label: 'Chocolate Classic', priceCents: 12000 },
      { label: 'Royal Buffet', priceCents: 15000 },
    ],
    sauces: [],
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
];

type StoredOptions = { _id: unknown; sauces?: string[]; toppings?: string[] };
export type OptionChange = {
  id: string;
  sauces: { from: string[]; to: string[] };
  toppings: { from: string[]; to: string[] };
};
const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
/**
 * Compares stored products with the launch catalogue and reports which ones
 * have different sauce/topping lists (order matters: it is the display order).
 * Products that are not stored yet are listed in `missing`; seeding creates them.
 */
export function planOptionSync(
  stored: StoredOptions[],
  wanted: SeedProduct[] = seedProducts,
) {
  const changes: OptionChange[] = [];
  const missing: string[] = [];
  for (const product of wanted) {
    const current = stored.find((s) => String(s._id) === product._id);
    if (!current) {
      missing.push(product._id);
      continue;
    }
    const from = {
      sauces: current.sauces ?? [],
      toppings: current.toppings ?? [],
    };
    if (
      same(from.sauces, product.sauces) &&
      same(from.toppings, product.toppings)
    )
      continue;
    changes.push({
      id: product._id,
      sauces: { from: from.sauces, to: product.sauces },
      toppings: { from: from.toppings, to: product.toppings },
    });
  }
  return { changes, missing };
}
