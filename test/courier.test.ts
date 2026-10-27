import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../src/app/api/api-errors';
import { courierErrorMessage } from '../src/app/api/courier-messages';
import { byDue, distanceLabel, fromApiJob, splitDeliveries } from '../src/app/api/courier-view';
import type { DeliveryOrder } from '../src/app/commerce-state.service';

const err = (status: number, message = 'x') => new ApiRequestError(status, message);
const order = (id: string, status: string, date = '2026-11-01', time = '12:00'): DeliveryOrder =>
  ({ id, status, date, time }) as DeliveryOrder;

test('a job keeps only what the API reveals, with the short reference', () => {
  const job = fromApiJob({
    id: 'RT-1a2b3c4d-1111-2222-3333-444455556666',
    date: '2026-11-01',
    time: '12:00',
    distanceKm: 3.25,
  });
  assert.deepEqual(job, {
    id: 'RT-1a2b3c4d-1111-2222-3333-444455556666',
    ref: 'RT-1A2B3C4D',
    date: '2026-11-01',
    time: '12:00',
    distanceKm: 3.25,
  });
  assert.equal(fromApiJob({ id: 'x', date: 'd', time: 't' }).distanceKm, null);
});

test('distance reads naturally and copes with a missing value', () => {
  assert.equal(distanceLabel(3.25), '3.3 km from the store');
  assert.equal(distanceLabel(0.04), '0.0 km from the store');
  assert.equal(distanceLabel(null), 'Distance not available');
});

test('deliveries are ordered by due time; finished ones go last', () => {
  const { active, done } = splitDeliveries([
    order('late', 'Out for Delivery', '2026-11-02', '09:00'),
    order('finished', 'Completed'),
    order('soon', 'Out for Delivery', '2026-11-01', '15:30'),
  ]);
  assert.deepEqual(
    active.map((o) => o.id),
    ['soon', 'late'],
  );
  assert.deepEqual(
    done.map((o) => o.id),
    ['finished'],
  );
  assert.ok(
    byDue({ date: '2026-11-01', time: '09:00' }, { date: '2026-11-01', time: '10:00' }) < 0,
  );
});

test('courier messages are plain and specific', () => {
  assert.match(
    courierErrorMessage(err(0, 'Cannot reach the server. Check your connection.'), 'jobs'),
    /Cannot reach/,
  );
  assert.match(courierErrorMessage(err(429), 'accept'), /Too many requests/);
  assert.match(courierErrorMessage(err(401), 'jobs'), /sign in again/);
  assert.match(
    courierErrorMessage(err(409, 'Job is no longer available'), 'accept'),
    /Another courier has already taken/,
  );
  assert.match(courierErrorMessage(err(403), 'complete'), /out for delivery/);
  assert.match(courierErrorMessage(err(409), 'complete'), /changed/);
  assert.match(courierErrorMessage(err(500), 'jobs'), /could not load your deliveries/);
  assert.match(courierErrorMessage(err(500), 'accept'), /could not accept/);
  assert.match(courierErrorMessage(err(500), 'complete'), /could not mark/);
});
