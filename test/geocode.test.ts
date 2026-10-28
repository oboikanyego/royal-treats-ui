import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeAddress, geocodeUrl, mapLink } from '../src/app/api/geocode';

const reply =
  (body: unknown, ok = true) =>
  async () => ({ ok, json: async () => body });

test('the lookup is limited to South Africa and the address is encoded', () => {
  const url = geocodeUrl('  34 10th Avenue,   Thabazimbi ');
  assert.ok(url.startsWith('https://nominatim.openstreetmap.org/search?'));
  assert.ok(url.includes('countrycodes=za'));
  assert.ok(url.endsWith('q=34%2010th%20Avenue%2C%20Thabazimbi'));
});
test('the first match becomes the store point, rounded to 6 decimals', async () => {
  const hit = [
    { lat: '-24.5912345678', lon: '27.4112345678', display_name: '10th Ave, Thabazimbi' },
  ];
  assert.deepEqual(await geocodeAddress('34 10th Avenue', reply(hit)), {
    latitude: -24.591235,
    longitude: 27.411235,
    label: '10th Ave, Thabazimbi',
  });
});
test('no match, a bad answer, an error status or a network failure all give null, never a throw', async () => {
  assert.equal(await geocodeAddress('nowhere', reply([])), null);
  assert.equal(await geocodeAddress('x', reply({ lat: 1 })), null);
  assert.equal(await geocodeAddress('x', reply([{ lat: 'abc', lon: '1' }])), null);
  assert.equal(await geocodeAddress('x', reply([{ lat: '95', lon: '1' }])), null);
  assert.equal(await geocodeAddress('x', reply([], false)), null);
  assert.equal(
    await geocodeAddress('x', async () => {
      throw new Error('offline');
    }),
    null,
  );
  let called = false;
  assert.equal(
    await geocodeAddress('   ', async () => {
      called = true;
      return { ok: true, json: async () => [] };
    }),
    null,
  );
  assert.equal(called, false, 'a blank address makes no request');
});
test('the map link points at the store', () => {
  assert.equal(
    mapLink(-24.59, 27.41),
    'https://www.openstreetmap.org/?mlat=-24.59&mlon=27.41#map=17/-24.59/27.41',
  );
});
