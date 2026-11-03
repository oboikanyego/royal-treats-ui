import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_MS, IdleTracker } from '../src/app/wake-up.service';

test('a tab that was away for a while wakes up when it comes back', () => {
  const tracker = new IdleTracker();
  tracker.hide(1_000);
  assert.equal(tracker.show(1_000 + IDLE_MS), true);
});

test('a quick switch away and back does not wake it', () => {
  const tracker = new IdleTracker();
  tracker.hide(1_000);
  assert.equal(tracker.show(1_000 + IDLE_MS - 1), false);
});

test('coming back without ever having been hidden does nothing', () => {
  assert.equal(new IdleTracker().show(500_000), false);
});

test('a page restored from the back/forward cache always wakes, even after a short time', () => {
  const tracker = new IdleTracker();
  tracker.hide(1_000);
  assert.equal(tracker.show(2_000, true), true);
});

test('several events from one return wake it only once', () => {
  const tracker = new IdleTracker();
  tracker.hide(0);
  assert.equal(tracker.show(IDLE_MS + 10), true);
  assert.equal(tracker.show(IDLE_MS + 500, true), false);
  tracker.hide(IDLE_MS + 1_000);
  assert.equal(tracker.show(IDLE_MS * 3), true);
});

test('hiding twice keeps the first time, so the whole absence counts', () => {
  const tracker = new IdleTracker();
  tracker.hide(0);
  tracker.hide(IDLE_MS - 5);
  assert.equal(tracker.show(IDLE_MS + 5), true);
});
