import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../src/app/api/api-errors';
import { adminErrorMessage } from '../src/app/api/admin-messages';
import {
  optionListText,
  parseOptionList,
  productImageProblem,
  productProblem,
  settingsProblem,
  toAvailabilityPayload,
  toCourierRequest,
  toProductPayload,
  toSettingsPayload,
} from '../src/app/api/admin-payloads';
import type { CatalogueProduct, Settings } from '../src/app/commerce-state.service';
import { randToCents } from '../src/app/money';

const err = (status: number, message = 'x', details?: unknown) =>
  new ApiRequestError(status, message, details);
const none = { flavours: '', toppings: '' };
const donuts = (over: Partial<CatalogueProduct> = {}): CatalogueProduct => ({
  id: 'donuts',
  name: ' Mini Donuts ',
  category: 'Mini Donuts',
  price: 25,
  image: 'https://res.cloudinary.com/demo/image/upload/a.webp',
  description: 'Fresh',
  available: true,
  deliverable: true,
  variants: [
    { label: '6 donuts', price: 25 },
    { label: '12 donuts', price: 50.5 },
  ],
  ...over,
});
const settings = (over: Partial<Settings> = {}): Settings => ({
  storeName: 'Royal Treats',
  address: '34 10th Avenue',
  supportEmail: 'hello@example.com',
  open: '09:00',
  close: '21:00',
  latitude: -24.59,
  longitude: 27.41,
  radiusKm: 5,
  ...over,
});

test('randToCents rounds to the nearest cent without float drift', () => {
  assert.equal(randToCents(25), 2500);
  assert.equal(randToCents(50.5), 5050);
  assert.equal(randToCents(0.1 + 0.2), 30);
  assert.equal(randToCents(19.99), 1999);
});

test('option lists accept commas or lines, trim, and drop blanks and repeats', () => {
  assert.deepEqual(parseOptionList('Chocolate, Caramel\n  Milky White ,,\nchocolate'), [
    'Chocolate',
    'Caramel',
    'Milky White',
  ]);
  assert.deepEqual(parseOptionList('  \n , '), []);
  assert.equal(optionListText(['A', 'B']), 'A\nB');
  assert.equal(optionListText(undefined), '');
});

test('the product payload is in cents, trimmed, and has exactly the fields the API accepts', () => {
  const payload = toProductPayload(donuts(), { flavours: 'Chocolate\nCaramel', toppings: 'Oreo' });
  assert.deepEqual(payload, {
    name: 'Mini Donuts',
    category: 'Mini Donuts',
    description: 'Fresh',
    image: 'https://res.cloudinary.com/demo/image/upload/a.webp',
    available: true,
    deliverable: true,
    variants: [
      { label: '6 donuts', priceCents: 2500 },
      { label: '12 donuts', priceCents: 5050 },
    ],
    sauces: ['Chocolate', 'Caramel'],
    toppings: ['Oreo'],
  });
  assert.ok(!('id' in payload) && !('price' in payload) && !('options' in payload));
});

test('only mini donuts can be marked deliverable, whatever the form says', () => {
  const shake = donuts({ category: 'Milkshakes', deliverable: true });
  assert.equal(toProductPayload(shake, none).deliverable, false);
});

test('a sold-out toggle resends the stored product with only `available` changed', () => {
  const stored = donuts({
    options: { flavourLabel: 'sauce', flavours: ['Chocolate'], toppings: ['Oreo'] },
  });
  const payload = toAvailabilityPayload(stored, false);
  assert.equal(payload.available, false);
  assert.deepEqual(payload.sauces, ['Chocolate']);
  assert.deepEqual(payload.toppings, ['Oreo']);
  assert.equal(payload.image, stored.image); // the existing image is sent back unchanged
  assert.equal(payload.variants[1]!.priceCents, 5050);
});

test('product validation names the problem', () => {
  assert.equal(productProblem(donuts(), none), null);
  assert.match(productProblem(donuts({ name: '  ' }), none)!, /product name/);
  assert.match(productProblem(donuts({ variants: [] }), none)!, /at least one size/);
  assert.match(
    productProblem(
      donuts({
        variants: [
          { label: 'A', price: 1 },
          { label: 'A', price: 2 },
        ],
      }),
      none,
    )!,
    /"A" is listed twice/,
  );
  assert.match(
    productProblem(donuts({ variants: [{ label: ' ', price: 1 }] }), none)!,
    /needs a name/,
  );
  assert.match(
    productProblem(donuts({ variants: [{ label: 'A', price: -1 }] }), none)!,
    /Enter a price/,
  );
  assert.match(
    productProblem(donuts({ variants: [{ label: 'A', price: 1.234 }] }), none)!,
    /two decimals/,
  );
  assert.match(
    productProblem(donuts({ variants: [{ label: 'A', price: 100001 }] }), none)!,
    /too high/,
  );
  assert.match(
    productProblem(donuts({ variants: [{ label: 'A', price: NaN }] }), none)!,
    /Enter a price/,
  );
  assert.match(
    productProblem(donuts(), {
      flavours: Array.from({ length: 31 }, (_, i) => 'F' + i).join(','),
      toppings: '',
    })!,
    /at most 30/,
  );
});

test('settings validation mirrors the API', () => {
  assert.equal(settingsProblem(settings()), null);
  assert.equal(
    settingsProblem(settings({ supportEmail: '', latitude: null, longitude: null })),
    null,
  );
  assert.match(settingsProblem(settings({ storeName: ' ' }))!, /store name/);
  assert.match(settingsProblem(settings({ supportEmail: 'nope' }))!, /support email/);
  assert.match(settingsProblem(settings({ open: '09:00', close: '09:00' }))!, /must differ/);
  assert.match(settingsProblem(settings({ open: '' }))!, /times/);
  assert.match(
    settingsProblem(settings({ latitude: null }))!,
    /both the latitude and the longitude/,
  );
  assert.match(settingsProblem(settings({ latitude: 91 }))!, /latitude/);
  assert.match(settingsProblem(settings({ longitude: -181 }))!, /longitude/);
});

test('the settings payload drops the fixed radius and trims text', () => {
  const payload = toSettingsPayload(
    settings({ storeName: ' Royal Treats ', address: ' 34 10th Avenue ' }),
  );
  assert.equal(payload.storeName, 'Royal Treats');
  assert.equal(payload.address, '34 10th Avenue');
  assert.ok(!('radiusKm' in payload));
});

test('a courier request is trimmed but the password is sent as typed', () => {
  assert.deepEqual(
    toCourierRequest({
      name: ' Sipho ',
      email: ' s@example.com ',
      phone: ' 074 000 0001 ',
      password: ' pass word ',
    }),
    { name: 'Sipho', email: 's@example.com', phone: '074 000 0001', password: ' pass word ' },
  );
});

test('product pictures: type and size are checked before uploading', () => {
  assert.equal(productImageProblem({ type: 'image/png', size: 1000 }), null);
  assert.match(productImageProblem({ type: 'image/gif', size: 1000 })!, /JPG, PNG or WebP/);
  assert.match(productImageProblem({ type: 'image/png', size: 0 })!, /empty/);
  assert.match(
    productImageProblem({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })!,
    /under 5 MB/,
  );
});

test('admin error messages are plain and specific', () => {
  assert.match(
    adminErrorMessage(err(0, 'Cannot reach the server. Check your connection.'), 'products'),
    /Cannot reach/,
  );
  assert.match(adminErrorMessage(err(429), 'products'), /Too many requests/);
  assert.match(adminErrorMessage(err(401), 'orders'), /sign in again/);
  assert.match(adminErrorMessage(err(403), 'orders'), /not allowed/);
  assert.match(adminErrorMessage(err(503), 'image'), /not set up/);
  assert.match(adminErrorMessage(err(413), 'image'), /under 5 MB/);
  assert.match(adminErrorMessage(err(502), 'image'), /did not accept/);
  assert.equal(adminErrorMessage(err(409), 'couriers'), 'That email is already registered.');
  assert.equal(
    adminErrorMessage(err(409, 'Order changed; refresh and retry'), 'status'),
    'Order changed; refresh and retry',
  );
  assert.match(adminErrorMessage(err(404), 'products'), /could not find the product/);
  assert.equal(
    adminErrorMessage(err(400, 'Only available mini donuts can be delivered'), 'products'),
    'Only available mini donuts can be delivered',
  );
  assert.equal(
    adminErrorMessage(
      err(400, 'Invalid input', [{ path: ['variants', 0, 'label'], message: 'Required' }]),
      'products',
    ),
    'variants › 0 › label: Required',
  );
  assert.match(adminErrorMessage(err(400, 'Invalid input'), 'products'), /check the details/);
  assert.match(adminErrorMessage(err(500), 'orders'), /could not load the orders/);
  assert.match(adminErrorMessage(err(500), 'settings'), /could not save the settings/);
});

import { dashboardSummary, matchesFilter, statusActionLabel } from '../src/app/api/admin-view';

test('the dashboard summary counts orders by group and orders the breakdown', () => {
  const summary = dashboardSummary({
    ordersByStatus: [
      { _id: 'Completed', count: 3, totalCents: 30000 },
      { _id: 'Pending', count: 2, totalCents: 8000 },
      { _id: 'Preparing', count: 1, totalCents: 5000 },
      { _id: 'Out for Delivery', count: 1, totalCents: 2500 },
      { _id: 'Cancelled', count: 4, totalCents: 9000 },
      { _id: 'Mystery', count: 1, totalCents: 1 },
    ],
    completedRevenueCents: 30000,
    products: 5,
  });
  assert.equal(summary.orders, 12);
  assert.equal(summary.pending, 2);
  assert.equal(summary.active, 2);
  assert.equal(summary.completed, 3);
  assert.equal(summary.cancelled, 4);
  assert.equal(summary.revenueCents, 30000);
  assert.deepEqual(
    summary.breakdown.map((b) => b.status),
    ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled', 'Mystery'],
  );
  assert.deepEqual(
    dashboardSummary({ ordersByStatus: [], completedRevenueCents: 0, products: 0 }).breakdown,
    [],
  );
});

test('order filters and action labels', () => {
  assert.ok(matchesFilter('Preparing', 'active') && matchesFilter('Out for Delivery', 'active'));
  assert.ok(!matchesFilter('Pending', 'active') && !matchesFilter('Completed', 'active'));
  assert.ok(matchesFilter('Pending', 'pending') && matchesFilter('Cancelled', 'cancelled'));
  assert.ok(matchesFilter('Anything', 'all'));
  assert.equal(statusActionLabel('Confirmed', 'collection'), 'Mark Confirmed');
  assert.equal(statusActionLabel('Cancelled', 'delivery'), 'Cancel order');
  assert.equal(statusActionLabel('Completed', 'collection'), 'Mark Collected');
  assert.equal(statusActionLabel('Completed', 'delivery'), 'Mark Delivered');
});

test('the dashboard names the finished group for both ways of fulfilling an order', () => {
  const rows = dashboardSummary({
    ordersByStatus: [
      { _id: 'Completed', count: 1, totalCents: 100 },
      { _id: 'Pending', count: 1, totalCents: 100 },
    ],
    completedRevenueCents: 100,
    products: 1,
  }).breakdown;
  assert.deepEqual(
    rows.map((r) => [r.status, r.label]),
    [
      ['Pending', 'Pending'],
      ['Completed', 'Collected / delivered'],
    ],
  );
});
