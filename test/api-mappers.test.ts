import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromApiProduct, fromApiSettings } from '../src/app/api/api-mappers';
import type { ApiProduct } from '../src/app/api/api-types';

// Shaped like royal-treats-api's productView for the seeded launch products.
const donuts: ApiProduct = {
  id: 'donuts',
  name: 'Mini Donuts',
  category: 'Mini Donuts',
  description: 'Fresh mini donuts with your favourite toppings',
  image: 'https://example.test/donuts.jpg',
  available: true,
  deliverable: true,
  priceCents: 2500,
  variants: [
    { label: '6 donuts', priceCents: 2500 },
    { label: '12 donuts', priceCents: 5000 },
  ],
  sauces: ['Chocolate', 'Caramel', 'Milky White'],
  toppings: ['Nuts', 'Oreo'],
};
const defaults = {
  open: '10:00',
  close: '23:00',
  latitude: null,
  longitude: null,
  radiusKm: 5,
  storeName: 'Royal Treats',
  address: '34 10th Avenue, Thabazimbi',
  supportEmail: '',
};

test('a product maps cents to rand and keeps its id, stock and delivery flags', () => {
  const p = fromApiProduct(donuts);
  assert.equal(p.id, 'donuts');
  assert.equal(p.price, 25);
  assert.deepEqual(p.variants, [
    { label: '6 donuts', price: 25 },
    { label: '12 donuts', price: 50 },
  ]);
  assert.equal(p.available, true);
  assert.equal(p.deliverable, true);
});
test('sauces and toppings become the product options, labelled by category', () => {
  assert.deepEqual(fromApiProduct(donuts).options, {
    flavourLabel: 'sauce',
    flavours: ['Chocolate', 'Caramel', 'Milky White'],
    toppings: ['Nuts', 'Oreo'],
  });
  const shake = fromApiProduct({
    ...donuts,
    id: 'shake',
    category: 'Milkshakes',
    sauces: ['Vanilla'],
    toppings: [],
  });
  assert.equal(shake.options?.flavourLabel, 'flavour');
  assert.deepEqual(shake.options?.toppings, []);
  // A category the UI has never heard of still gets a usable label.
  assert.equal(fromApiProduct({ ...donuts, category: 'Cakes' }).options?.flavourLabel, 'sauce');
});
test('empty sauces mean no flavour step (the API accepts an empty choice then)', () => {
  const sundae = fromApiProduct({ ...donuts, category: 'Ice Cream Sundaes', sauces: [] });
  assert.deepEqual(sundae.options?.flavours, []);
});
test('fractional prices survive the conversion', () => {
  const p = fromApiProduct({
    ...donuts,
    priceCents: 2550,
    variants: [{ label: 'x', priceCents: 2550 }],
  });
  assert.equal(p.price, 25.5);
  assert.equal(p.variants[0]?.price, 25.5);
});
test('optional text fields default to empty strings', () => {
  const { description, image, ...bare } = donuts;
  void description;
  void image;
  const p = fromApiProduct(bare);
  assert.equal(p.description, '');
  assert.equal(p.image, '');
});
test('settings overlay the defaults, and unconfigured coordinates are null', () => {
  assert.deepEqual(
    fromApiSettings({ storeName: 'Royal Treats', supportEmail: '', radiusKm: 5 }, defaults),
    defaults,
  );
  const s = fromApiSettings(
    { open: '09:00', close: '20:00', latitude: -24.59, longitude: 27.41, supportEmail: 'a@b.test' },
    defaults,
  );
  assert.equal(s.open, '09:00');
  assert.equal(s.latitude, -24.59);
  assert.equal(s.supportEmail, 'a@b.test');
  assert.equal(s.address, defaults.address);
});
