import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError, isTransient, toApiError } from '../src/app/api/api-errors';

test("uses the API's { error, details } body", () => {
  const e = toApiError({
    status: 400,
    error: { error: 'Invalid input', details: [{ path: ['phone'], message: 'Invalid' }] },
  });
  assert.equal(e.status, 400);
  assert.equal(e.message, 'Invalid input');
  assert.deepEqual(e.details, [{ path: ['phone'], message: 'Invalid' }]);
});
test('falls back to a generic message when the body has none (e.g. a plain-text 429)', () => {
  const e = toApiError({ status: 429, error: 'Too many requests' });
  assert.equal(e.status, 429);
  assert.equal(e.message, 'The server returned an error (429).');
});
test('status 0 means the server could not be reached', () => {
  const e = toApiError({ status: 0, error: { type: 'error' } });
  assert.equal(e.status, 0);
  assert.match(e.message, /Cannot reach the server/);
});
test('an rxjs TimeoutError becomes a friendly status-0 error', () => {
  const e = toApiError({ name: 'TimeoutError' });
  assert.equal(e.status, 0);
  assert.match(e.message, /too long/);
});
test('anything unrecognised is still an ApiRequestError, and one passes through unchanged', () => {
  assert.equal(toApiError(undefined).status, 0);
  assert.equal(toApiError('boom').status, 0);
  const original = new ApiRequestError(409, 'Conflict');
  assert.equal(toApiError(original), original);
});
test('only network and gateway failures are retried', () => {
  for (const status of [0, 502, 503, 504])
    assert.equal(isTransient(new ApiRequestError(status, 'x')), true);
  for (const status of [400, 401, 403, 404, 409, 429, 500])
    assert.equal(isTransient(new ApiRequestError(status, 'x')), false);
});
