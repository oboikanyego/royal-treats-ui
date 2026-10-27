import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { BusyGate } from '../src/app/busy-gate';

const setup = (ms = 200) => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const shown: boolean[] = [];
  return { gate: new BusyGate(ms, (v) => shown.push(v)), shown };
};

test('work that ends quickly never shows the loader', () => {
  const { gate, shown } = setup();
  gate.set(true);
  mock.timers.tick(150);
  gate.set(false);
  mock.timers.tick(500);
  assert.deepEqual(shown, [false]); // only the "hide" is reported; nothing was ever shown
  mock.timers.reset();
});

test('work that lasts shows the loader after the delay, and hides it when done', () => {
  const { gate, shown } = setup();
  gate.set(true);
  mock.timers.tick(199);
  assert.deepEqual(shown, []);
  mock.timers.tick(1);
  assert.deepEqual(shown, [true]);
  gate.set(false);
  assert.deepEqual(shown, [true, false]);
  mock.timers.reset();
});

test('a repeated "working" does not restart the wait', () => {
  const { gate, shown } = setup();
  gate.set(true);
  mock.timers.tick(150);
  gate.set(true);
  gate.set(true);
  mock.timers.tick(50);
  assert.deepEqual(shown, [true]);
  mock.timers.reset();
});

test('the loader can show again for later work', () => {
  const { gate, shown } = setup();
  gate.set(true);
  mock.timers.tick(200);
  gate.set(false);
  gate.set(true);
  mock.timers.tick(200);
  assert.deepEqual(shown, [true, false, true]);
  mock.timers.reset();
});
