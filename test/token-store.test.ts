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
test('the token lives under its own key, so it cannot clash with other keys', () => {
  const storage = memory();
  new TokenStore(storage, () => NOW).write('abc', later);
  assert.deepEqual([...storage.data.keys()], ['royal-api-session']);
});
test('a kept sign-in and a tab-only one live in different storages and sign-out clears both', async () => {
  const { SessionService } = await import('../src/app/api/session.service');
  const stores = { local: memory(), session: memory() };
  const g = globalThis as Record<string, unknown>;
  g['localStorage'] = stores.local;
  g['sessionStorage'] = stores.session;
  const user = { id: 'u', name: 'N', email: 'e', phone: 'p', role: 'customer', active: true };
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const s = new SessionService();
  s.start(user, 'kept-token', soon, true);
  assert.equal(stores.local.data.size, 1);
  assert.equal(stores.session.data.size, 0);
  assert.equal(s.token(), 'kept-token');
  s.start(user, 'tab-token', soon, false);
  assert.equal(stores.local.data.size, 0, 'the earlier kept token is replaced');
  assert.equal(stores.session.data.size, 1);
  assert.equal(s.token(), 'tab-token');
  s.start(user, 'again', soon, true);
  s.clear();
  assert.equal(stores.local.data.size + stores.session.data.size, 0);
  assert.equal(s.token(), null);
});
