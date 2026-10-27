import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToRand, formatRand } from '../src/app/money';

test('cents convert to rand exactly', () => {
  assert.equal(centsToRand(2500), 25);
  assert.equal(centsToRand(2550), 25.5);
  assert.equal(centsToRand(1), 0.01);
  assert.equal(centsToRand(0), 0);
});
test('whole rand has no decimals, anything else has two', () => {
  assert.equal(formatRand(25), 'R25');
  assert.equal(formatRand(25.5), 'R25.50');
  assert.equal(formatRand(0), 'R0');
  assert.equal(formatRand(1234), 'R1234');
});
test('float noise is rounded to the cent before formatting', () => {
  assert.equal(formatRand(0.1 + 0.2), 'R0.30');
  assert.equal(formatRand(25.5 * 3), 'R76.50');
  assert.equal(formatRand(19.999999999), 'R20');
});
test('missing amounts show as R0 instead of NaN', () => {
  assert.equal(formatRand(null), 'R0');
  assert.equal(formatRand(undefined), 'R0');
});
