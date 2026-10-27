import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../src/app/api/api-errors';
import {
  authErrorMessage,
  consentProblem,
  passwordChangeProblem,
  profileProblem,
  registrationProblem,
} from '../src/app/api/auth-messages';
import { photoFileProblem, PHOTO_MAX_BYTES } from '../src/app/api/photo-file';
import { fromApiUser } from '../src/app/api/api-mappers';

const err = (status: number, message = 'x', details?: unknown) =>
  new ApiRequestError(status, message, details);
const invalid = (field: string) =>
  err(400, 'Invalid input', [{ path: [field], message: 'whatever the validator said' }]);

test('wrong credentials and rate limits read clearly on sign-in', () => {
  assert.equal(
    authErrorMessage(err(401, 'Invalid email or password'), 'login'),
    'Incorrect email or password.',
  );
  assert.match(authErrorMessage(err(429), 'login'), /Too many attempts/);
  assert.match(authErrorMessage(err(500), 'login'), /could not sign you in/);
});
test('an unreachable server keeps the client-side wording', () => {
  assert.equal(
    authErrorMessage(err(0, 'Cannot reach the server. Check your connection.'), 'login'),
    'Cannot reach the server. Check your connection.',
  );
});
test('registration maps each invalid field to something a customer can act on', () => {
  assert.match(authErrorMessage(invalid('password'), 'register'), /12 to 128 characters/);
  assert.match(authErrorMessage(invalid('email'), 'register'), /valid email/);
  assert.match(authErrorMessage(invalid('phone'), 'register'), /9 to 16 digits/);
  assert.match(authErrorMessage(invalid('name'), 'register'), /full name/);
  assert.match(authErrorMessage(invalid('somethingNew'), 'register'), /check your details/);
  assert.match(
    authErrorMessage(err(400, 'Invalid input', undefined), 'register'),
    /check your details/,
  );
});
test('a duplicate email is called out', () => {
  assert.equal(
    authErrorMessage(err(409, 'Record already exists'), 'register'),
    'That email is already registered.',
  );
});
test('profile picture failures', () => {
  assert.match(authErrorMessage(err(413), 'photo'), /under 2 MB/);
  assert.match(authErrorMessage(err(401), 'photo'), /sign in again/);
  assert.equal(
    authErrorMessage(
      err(400, 'Upload a valid JPG, PNG or WebP image under 16 megapixels'),
      'photo',
    ),
    'Upload a valid JPG, PNG or WebP image under 16 megapixels',
  );
});

const good = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  phone: '074 123 4567',
  password: 'a-long-enough-pass',
};
test('registration is checked against the API rules before any request', () => {
  assert.equal(registrationProblem(good), null);
  assert.match(registrationProblem({ ...good, password: 'x'.repeat(11) })!, /12 to 128/);
  assert.equal(registrationProblem({ ...good, password: 'x'.repeat(12) }), null);
  assert.match(registrationProblem({ ...good, password: 'x'.repeat(129) })!, /12 to 128/);
  assert.match(registrationProblem({ ...good, name: ' A ' })!, /full name/);
  assert.match(registrationProblem({ ...good, email: 'not-an-email' })!, /valid email/);
  assert.match(registrationProblem({ ...good, phone: '12345' })!, /9 to 16 digits/);
  assert.equal(registrationProblem({ ...good, phone: '+27 74 123 4567' }), null);
});

test('profile photos: type and size are checked before upload', () => {
  assert.equal(photoFileProblem({ type: 'image/png', size: 1000 }), null);
  assert.equal(photoFileProblem({ type: 'image/jpeg', size: PHOTO_MAX_BYTES }), null);
  assert.match(photoFileProblem({ type: 'image/gif', size: 1000 })!, /JPG, PNG or WebP/);
  assert.match(photoFileProblem({ type: 'image/svg+xml', size: 1000 })!, /JPG, PNG or WebP/);
  assert.match(photoFileProblem({ type: 'image/png', size: PHOTO_MAX_BYTES + 1 })!, /under 2 MB/);
  assert.match(photoFileProblem({ type: 'image/png', size: 0 })!, /empty/);
});

test('the API user becomes the Account the templates use, with no password', () => {
  const account = fromApiUser(
    { id: 'u1', name: 'T', email: 't@e.test', phone: '0741234567', role: 'courier', active: true },
    'blob:photo',
  );
  assert.deepEqual(account, {
    id: 'u1',
    name: 'T',
    email: 't@e.test',
    phone: '0741234567',
    role: 'courier',
    active: true,
    photo: 'blob:photo',
  });
  assert.equal(
    fromApiUser(
      { id: 'u1', name: 'T', email: 'e', phone: 'p', role: 'customer', active: true },
      null,
    ).photo,
    undefined,
  );
});

test('registration needs the privacy notice and terms to be accepted', () => {
  assert.equal(consentProblem(true), null);
  assert.match(consentProblem(false)!, /accept the privacy notice and terms/);
  assert.match(
    authErrorMessage(invalid('acceptedTerms'), 'register'),
    /accept the privacy notice and terms/,
  );
});

test('profile details are checked like the API checks them', () => {
  assert.equal(profileProblem({ name: 'Thandi', phone: '074 123 4567' }), null);
  assert.match(profileProblem({ name: ' T ', phone: '074 123 4567' })!, /full name/);
  assert.match(profileProblem({ name: 'Thandi', phone: 'abc' })!, /valid phone number/);
  assert.match(authErrorMessage(invalid('phone'), 'profile'), /valid phone number/);
  assert.match(authErrorMessage(err(500), 'profile'), /could not save your details/);
});

test('the change-password form says what is wrong', () => {
  const ok = {
    current: 'old-long-password',
    next: 'new-long-password',
    confirm: 'new-long-password',
  };
  assert.equal(passwordChangeProblem(ok), null);
  assert.match(passwordChangeProblem({ ...ok, current: '' })!, /current password/);
  assert.match(passwordChangeProblem({ ...ok, next: 'short', confirm: 'short' })!, /12 to 128/);
  assert.match(
    passwordChangeProblem({ ...ok, confirm: 'different-long-password' })!,
    /do not match/,
  );
  assert.match(
    passwordChangeProblem({ ...ok, next: ok.current, confirm: ok.current })!,
    /not used just now/,
  );
});

test('the API refusing a password change reads clearly, and a 401 asks to sign in again', () => {
  assert.equal(
    authErrorMessage(err(400, 'Current password is incorrect'), 'password'),
    'Current password is incorrect',
  );
  assert.match(authErrorMessage(invalid('newPassword'), 'password'), /12 to 128/);
  assert.match(authErrorMessage(err(401), 'password'), /sign in again/);
  assert.match(authErrorMessage(err(429), 'password'), /Too many attempts/);
  assert.match(authErrorMessage(err(500), 'password'), /could not change your password/);
});

import { resetProblem } from '../src/app/api/auth-messages';

test('the reset page checks the two passwords before asking the API', () => {
  assert.equal(resetProblem({ next: 'new-long-password', confirm: 'new-long-password' }), null);
  assert.match(resetProblem({ next: 'short', confirm: 'short' })!, /12 to 128/);
  assert.match(
    resetProblem({ next: 'new-long-password', confirm: 'other-long-password' })!,
    /do not match/,
  );
});

test('forgot and reset errors are plain, and a dead link says how to get a new one', () => {
  assert.match(authErrorMessage(err(400), 'forgot'), /valid email/);
  assert.match(authErrorMessage(err(429), 'forgot'), /Too many attempts/);
  assert.match(authErrorMessage(err(500), 'forgot'), /could not send the email/);
  assert.match(
    authErrorMessage(err(400, 'This reset link is invalid or has expired'), 'reset'),
    /invalid or has expired.*new one/,
  );
  assert.match(authErrorMessage(invalid('newPassword'), 'reset'), /12 to 128/);
  assert.match(authErrorMessage(err(500), 'reset'), /could not change your password/);
});
