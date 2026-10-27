import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../src/app/api/api-errors';
import { fromApiOrder, shortRef } from '../src/app/api/api-mappers';
import { orderErrorMessage } from '../src/app/api/order-messages';
import { AttemptKeys, buildOrderRequest } from '../src/app/api/order-request';
import type { ApiOrder } from '../src/app/api/api-types';
import type { CartItem } from '../src/app/cart.service';
import type { DeliveryOrder } from '../src/app/commerce-state.service';
import { groupByRecipient, mergeOrders, stepDone, stepsFor } from '../src/app/order-view';

const cart: CartItem[] = [
  {
    productId: 'donuts',
    name: 'Mini Donuts',
    image: 'x',
    variant: '12 donuts',
    price: 50,
    qty: 2,
    sauce: 'Chocolate',
    topping: 'Oreo',
    recipient: ' Lerato ',
  },
  {
    productId: 'shake',
    name: 'Milkshakes',
    image: 'y',
    variant: 'Large',
    price: 40,
    qty: 1,
    sauce: '',
    topping: '',
  },
];
const collection = {
  fulfillment: 'collection' as const,
  date: '2026-11-03',
  time: '12:00',
  notes: ' No nuts ',
  address: 'ignored',
  latitude: -24.6,
  longitude: 27.4,
};

test('the order request carries ids and choices, never prices or customer details', () => {
  const r = buildOrderRequest(cart, collection);
  assert.deepEqual(Object.keys(r).sort(), ['date', 'fulfillment', 'items', 'notes', 'time']);
  assert.equal(r.notes, 'No nuts');
  assert.deepEqual(r.items[0], {
    productId: 'donuts',
    variant: '12 donuts',
    qty: 2,
    sauce: 'Chocolate',
    topping: 'Oreo',
    recipient: 'Lerato',
  });
  assert.deepEqual(r.items[1], {
    productId: 'shake',
    variant: 'Large',
    qty: 1,
    sauce: '',
    topping: '',
    recipient: '',
  });
  for (const item of r.items)
    assert.deepEqual(Object.keys(item).sort(), [
      'productId',
      'qty',
      'recipient',
      'sauce',
      'topping',
      'variant',
    ]);
  assert.ok(!JSON.stringify(r).includes('price') && !JSON.stringify(r).includes('image'));
});
test('delivery details are sent only for a delivery', () => {
  const delivery = buildOrderRequest(cart, {
    ...collection,
    fulfillment: 'delivery',
    address: ' 12 Main St ',
  });
  assert.equal(delivery.address, '12 Main St');
  assert.equal(delivery.latitude, -24.6);
  assert.equal(delivery.longitude, 27.4);
  const noFix = buildOrderRequest(cart, {
    ...collection,
    fulfillment: 'delivery',
    latitude: null,
    longitude: null,
  });
  assert.ok(!('latitude' in noFix) && !('longitude' in noFix));
  const pickup = buildOrderRequest(cart, collection);
  assert.ok(!('address' in pickup) && !('latitude' in pickup));
});

test('a retried order reuses its idempotency key; a changed order gets a new one', () => {
  let n = 0;
  const keys = new AttemptKeys(() => `key-${++n}`);
  const a = buildOrderRequest(cart, collection);
  const first = keys.keyFor(a);
  assert.equal(keys.keyFor(buildOrderRequest(cart, collection)), first); // same order, e.g. after a timeout
  assert.notEqual(keys.keyFor(buildOrderRequest(cart, { ...collection, time: '13:00' })), first);
  assert.notEqual(keys.keyFor(buildOrderRequest([{ ...cart[0]!, qty: 3 }], collection)), first);
});
test('after an order is placed the next one starts with a new key', () => {
  let n = 0;
  const keys = new AttemptKeys(() => `key-${++n}`);
  const request = buildOrderRequest(cart, collection);
  const first = keys.keyFor(request);
  keys.reset();
  assert.notEqual(keys.keyFor(request), first);
});
test('generated keys satisfy the API format (8-100 characters of A-Z a-z 0-9 _ -)', () => {
  const key = new AttemptKeys().keyFor(buildOrderRequest(cart, collection));
  assert.match(key, /^[A-Za-z0-9_-]{8,100}$/);
});

const err = (status: number, message = 'x') => new ApiRequestError(status, message);
test('checkout errors say what to do', () => {
  assert.equal(
    orderErrorMessage(err(409, 'An item is unavailable'), 'place'),
    'An item is now out of stock. Please update your cart.',
  );
  assert.match(
    orderErrorMessage(err(409, 'Store coordinates are not configured'), 'place'),
    /choose collection/,
  );
  assert.equal(
    orderErrorMessage(err(400, 'Time is outside store hours'), 'place'),
    'Time is outside store hours',
  );
  assert.equal(
    orderErrorMessage(err(400, 'Address is outside the 5 km delivery area'), 'place'),
    'Address is outside the 5 km delivery area',
  );
  assert.match(orderErrorMessage(err(400, 'Invalid input'), 'place'), /check your order/);
  assert.match(orderErrorMessage(err(403), 'place'), /customer accounts/);
  assert.match(orderErrorMessage(err(401), 'place'), /sign in again/);
  assert.match(orderErrorMessage(err(429), 'place'), /Too many/);
  assert.match(orderErrorMessage(err(500), 'place'), /could not place your order/);
  assert.equal(
    orderErrorMessage(err(0, 'Cannot reach the server. Check your connection.'), 'place'),
    'Cannot reach the server. Check your connection.',
  );
  assert.equal(
    orderErrorMessage(err(409, 'something unexpected'), 'place'),
    'something unexpected',
  );
});
test('cancel and list errors', () => {
  assert.match(orderErrorMessage(err(403), 'cancel'), /no longer be cancelled/);
  assert.match(orderErrorMessage(err(409), 'cancel'), /no longer be cancelled/);
  assert.match(orderErrorMessage(err(404), 'cancel'), /could not find/);
  assert.match(orderErrorMessage(err(500), 'list'), /could not load your orders/);
});

test('long API order ids are shown as a short reference', () => {
  assert.equal(shortRef('RT-1a2b3c4d-1111-4222-8333-444455556666'), 'RT-1A2B3C4D');
  assert.equal(shortRef('RT-12345678'), 'RT-12345678'); // already short (demo orders)
  assert.equal(shortRef('weird'), 'weird');
});

const apiOrder: ApiOrder = {
  id: 'RT-1a2b3c4d-1111-4222-8333-444455556666',
  customerId: 'c1',
  customer: 'Thandi',
  phone: '0741234567',
  fulfillment: 'delivery',
  address: '12 Main St',
  latitude: -24.6,
  longitude: 27.4,
  distanceKm: 1.234,
  date: '2026-11-03',
  time: '12:00',
  notes: 'Hi',
  payment: 'Cash on Delivery',
  totalCents: 12550,
  status: 'Pending',
  createdAt: '2026-10-27T10:00:00.000Z',
  allowedStatuses: ['Cancelled'],
  items: [
    {
      productId: 'donuts',
      name: 'Mini Donuts',
      variant: '12 donuts',
      qty: 2,
      priceCents: 5000,
      sauce: 'Chocolate',
      topping: 'Oreo',
      recipient: 'Lerato',
    },
    {
      productId: 'cake',
      name: 'Cake Slice',
      variant: 'Slice',
      qty: 1,
      priceCents: 2550,
      sauce: '',
      topping: '',
      recipient: '',
    },
  ],
};
test('an API order maps to the UI order with rand amounts', () => {
  const o = fromApiOrder(apiOrder);
  assert.equal(o.ref, 'RT-1A2B3C4D');
  assert.equal(o.id, apiOrder.id);
  assert.equal(o.total, 125.5);
  assert.deepEqual(o.items[0], {
    name: 'Mini Donuts',
    qty: 2,
    price: 50,
    recipient: 'Lerato',
    variant: '12 donuts',
    sauce: 'Chocolate',
    topping: 'Oreo',
  });
  assert.equal(o.items[1]!.price, 25.5);
  assert.equal(o.address, '12 Main St');
  assert.deepEqual(o.allowedStatuses, ['Cancelled']);
  assert.equal(o.createdAt, '2026-10-27T10:00:00.000Z');
  assert.equal(
    fromApiOrder({ ...apiOrder, address: undefined, allowedStatuses: undefined }).address,
    '',
  );
  assert.deepEqual(fromApiOrder({ ...apiOrder, allowedStatuses: undefined }).allowedStatuses, []);
});

test('timeline steps follow the fulfilment method, and "Ready for ..." counts as one step', () => {
  assert.deepEqual(stepsFor('delivery').slice(3, 5), ['Ready for Delivery', 'Out for Delivery']);
  assert.ok(!stepsFor('collection').includes('Out for Delivery'));
  const steps = stepsFor('delivery');
  assert.equal(stepDone(steps, 'Preparing', 'Confirmed'), true);
  assert.equal(stepDone(steps, 'Preparing', 'Preparing'), true);
  assert.equal(stepDone(steps, 'Preparing', 'Ready for Delivery'), false);
  assert.equal(
    stepDone(stepsFor('collection'), 'Ready for Delivery', 'Ready for Collection'),
    true,
  ); // a mismatched "Ready" still lines up
  assert.equal(stepDone(steps, 'Cancelled', 'Pending'), false);
});
test('lines are grouped by recipient in first-seen order, with a shared group', () => {
  const groups = groupByRecipient([
    { recipient: 'Lerato', n: 1 },
    { recipient: '', n: 2 },
    { recipient: 'Lerato', n: 3 },
    { n: 4 },
    { recipient: '  ', n: 5 },
  ]);
  assert.deepEqual(
    groups.map((g) => g.recipient),
    ['Lerato', 'Shared treats'],
  );
  assert.deepEqual(
    groups[0]!.items.map((i) => i.n),
    [1, 3],
  );
  assert.deepEqual(
    groups[1]!.items.map((i) => i.n),
    [2, 4, 5],
  );
});

const o = (id: string, status: string): DeliveryOrder => ({
  id,
  customerId: 'c',
  customer: 'c',
  phone: 'p',
  address: '',
  fulfillment: 'collection',
  status,
  payment: 'x',
  total: 1,
  items: [],
  date: 'd',
  time: 't',
});
test('refreshing merges the newest page into what is on screen', () => {
  const onScreen = [o('c', 'Pending'), o('b', 'Pending'), o('a', 'Completed')];
  const fresh = [o('d', 'Pending'), o('c', 'Confirmed'), o('b', 'Pending')];
  const merged = mergeOrders(onScreen, fresh);
  assert.deepEqual(
    merged.map((x) => `${x.id}:${x.status}`),
    ['d:Pending', 'c:Confirmed', 'b:Pending', 'a:Completed'],
  );
  assert.deepEqual(
    mergeOrders([], fresh).map((x) => x.id),
    ['d', 'c', 'b'],
  );
  assert.deepEqual(
    mergeOrders(onScreen, []).map((x) => x.id),
    ['c', 'b', 'a'],
  );
});
