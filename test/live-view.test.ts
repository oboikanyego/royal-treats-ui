import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addAlert,
  alertText,
  isLiveOrder,
  pendingCount,
  socketOrigin,
  titleWithCount,
} from '../src/app/api/live-view';

const order = {
  id: 'RT-1a2b3c4d-1111-4222-8333-444455556666',
  customer: 'Thandi',
  fulfillment: 'collection',
  totalCents: 18000,
  itemCount: 4,
  date: '2026-11-01',
  time: '12:00',
  createdAt: '2026-10-30T10:00:00.000Z',
};

test('the socket is on the API host, not under /api/v1', () => {
  assert.equal(
    socketOrigin('https://royal-treats-api.onrender.com/api/v1'),
    'https://royal-treats-api.onrender.com',
  );
  assert.equal(socketOrigin('http://localhost:3000/api/v1'), 'http://localhost:3000');
});

test('only well-formed pushes are accepted', () => {
  assert.ok(isLiveOrder(order));
  for (const bad of [
    null,
    undefined,
    5,
    {},
    { ...order, id: 1 },
    { ...order, totalCents: '18000' },
    { ...order, itemCount: undefined },
  ])
    assert.equal(isLiveOrder(bad), false);
  assert.equal(pendingCount({ count: 3 }), 3);
  assert.equal(pendingCount({ count: 0 }), 0);
  for (const bad of [null, {}, { count: -1 }, { count: 1.5 }, { count: '2' }])
    assert.equal(pendingCount(bad), null);
});

test('the alert says who, what, how much and when', () => {
  assert.equal(
    alertText(order),
    'RT-1A2B3C4D · Thandi · 4 items · R180 · collection 2026-11-01 12:00',
  );
  assert.equal(
    alertText({ ...order, itemCount: 1, fulfillment: 'delivery', customer: ' ', totalCents: 2550 }),
    'RT-1A2B3C4D · A customer · 1 item · R25.50 · delivery 2026-11-01 12:00',
  );
});

test('alerts are newest first, one per order, and capped', () => {
  let list = addAlert([], { id: 'a', text: 'A' });
  list = addAlert(list, { id: 'b', text: 'B' });
  list = addAlert(list, { id: 'a', text: 'A again' });
  assert.deepEqual(
    list.map((a) => a.text),
    ['A again', 'B'],
  );
  list = addAlert(addAlert(list, { id: 'c', text: 'C' }), { id: 'd', text: 'D' });
  assert.deepEqual(
    list.map((a) => a.id),
    ['d', 'c', 'a'],
  );
});

test('the tab title carries the number of orders waiting', () => {
  assert.equal(titleWithCount('Our Menu | Royal Treats', 2), '(2) Our Menu | Royal Treats');
  assert.equal(titleWithCount('(2) Our Menu | Royal Treats', 5), '(5) Our Menu | Royal Treats');
  assert.equal(titleWithCount('(2) Our Menu | Royal Treats', 0), 'Our Menu | Royal Treats');
  assert.equal(titleWithCount('Our Menu | Royal Treats', null), 'Our Menu | Royal Treats');
});
