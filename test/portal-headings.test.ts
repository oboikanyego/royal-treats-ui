import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalHeading } from '../src/app/portal-headings';

test('the admin header names the screen, not always "Store overview"', () => {
  const titles = (['home', 'orders', 'products', 'couriers', 'settings', 'account'] as const).map(
    (screen) => portalHeading('admin', screen).title,
  );
  assert.deepEqual(titles, [
    'Store overview',
    'Orders',
    'Products',
    'Delivery team',
    'Settings',
    'My account',
  ]);
});

test('couriers and customers keep their own headings, and everyone gets My account', () => {
  assert.equal(portalHeading('courier', 'home').title, 'Delivery workspace');
  assert.equal(portalHeading('customer', 'home').title, 'Your Royal account');
  assert.equal(portalHeading('courier', 'account').title, 'My account');
  assert.equal(portalHeading('customer', 'account').title, 'My account');
});

import { authCopy } from '../src/app/portal-headings';

test('the sign-in, register and forgot-password screens each have their own title', () => {
  assert.equal(authCopy('signin').title, 'Welcome back');
  assert.equal(authCopy('register').title, 'Join Royal Treats');
  assert.equal(authCopy('forgot').title, 'Forgot your password?');
  assert.match(authCopy('forgot').subtitle, /shop will approve it/);
});
