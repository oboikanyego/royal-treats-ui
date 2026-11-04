import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installPlatform } from '../src/app/install-prompt';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

test('an iPhone and an Android phone are told apart', () => {
  assert.equal(installPlatform({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false }), 'ios');
  assert.equal(
    installPlatform({ userAgent: ANDROID, maxTouchPoints: 5, standalone: false }),
    'android',
  );
});

test('an iPad that calls itself a Mac counts as iOS, a real Mac does not', () => {
  assert.equal(installPlatform({ userAgent: MAC, maxTouchPoints: 5, standalone: false }), 'ios');
  assert.equal(installPlatform({ userAgent: MAC, maxTouchPoints: 0, standalone: false }), 'other');
});

test('computers get no offer', () => {
  assert.equal(
    installPlatform({ userAgent: WINDOWS, maxTouchPoints: 0, standalone: false }),
    'other',
  );
});

test('someone already using the Home Screen shortcut is never asked', () => {
  assert.equal(
    installPlatform({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true }),
    'installed',
  );
  assert.equal(
    installPlatform({ userAgent: ANDROID, maxTouchPoints: 5, standalone: true }),
    'installed',
  );
});
