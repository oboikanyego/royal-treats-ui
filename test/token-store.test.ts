import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenStore } from '../src/app/api/token-store';

const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};
const NOW = Date.parse('2026-11-01T12:00:00Z');
const later = '2026-11-01T20:00:00Z';
const earlier = '2026-11-01T11:00:00Z';

test('a saved token is read back until it expires', () => {
  const storage = memory();
  const store = new TokenStore(storage, () => NOW);
  assert.equal(store.read(), null);
  store.write('abc', later);
  assert.equal(store.read(), 'abc');
  assert.equal(new TokenStore(storage, () => Date.parse(later) + 1).read(), null);
});
test('an expired token is removed, not just ignored', () => {
  const storage = memory();
  new TokenStore(storage, () => NOW).write('old', earlier);
  assert.equal(new TokenStore(storage, () => NOW).read(), null);
  assert.equal(storage.data.size, 0);
});
test('malformed or incomplete data reads as no token', () => {
  for (const raw of [
    'not json',
    '{}',
    '{"token":1,"expiresAt":"x"}',
    '{"token":"t"}',
    '{"token":"t","expiresAt":"nonsense"}',
    'null',
  ]) {
    const storage = memory();
    storage.data.set('royal-api-session', raw);
    assert.equal(new TokenStore(storage, () => NOW).read(), null, raw);
  }
});
test('clear forgets the token', () => {
  const store = new TokenStore(memory(), () => NOW);
  store.write('abc', later);
  store.clear();
  assert.equal(store.read(), null);
});
test('blocked or full storage never throws', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
  const store = new TokenStore(broken, () => NOW);
  assert.doesNotThrow(() => store.write('abc', later));
  assert.equal(store.read(), null);
  assert.doesNotThrow(() => store.clear());
});
test('the token lives under its own key, so it cannot clash with the demo session', () => {
  const storage = memory();
  new TokenStore(storage, () => NOW).write('abc', later);
  assert.deepEqual([...storage.data.keys()], ['royal-api-session']);
});
