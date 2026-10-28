import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageAt, imageSet } from '../src/app/image-url';

test('Cloudinary pictures get a size and a modern format inserted, once', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1700000000/royal-treats/cake.jpg';
  assert.equal(
    imageAt(url, 400),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_400/v1700000000/royal-treats/cake.jpg',
  );
  // Already sized: not sized again.
  const sized = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/v1/cake.jpg';
  assert.equal(imageAt(sized, 400), sized);
});
test('Unsplash pictures get the width and quality set, replacing any width already there', () => {
  const out = new URL(imageAt('https://images.unsplash.com/photo-1?auto=format&w=1200&q=90', 480));
  assert.equal(out.searchParams.get('w'), '480');
  assert.equal(out.searchParams.get('q'), '70');
  assert.equal(out.searchParams.get('auto'), 'format');
});
test('other addresses, empty values and local paths are left alone', () => {
  assert.equal(imageAt('https://example.com/a.png', 400), 'https://example.com/a.png');
  assert.equal(imageAt('/assets/a.png', 400), '/assets/a.png');
  assert.equal(imageAt('data:image/png;base64,AAAA', 400), 'data:image/png;base64,AAAA');
  assert.equal(imageAt('', 400), '');
  assert.equal(imageAt(null, 400), '');
  assert.equal(imageAt(undefined, 400), '');
});
test('a srcset lists each width, and is empty when the picture cannot be resized', () => {
  const set = imageSet('https://images.unsplash.com/photo-1', [320, 640]);
  assert.match(set, /w=320[^,]* 320w, .*w=640[^,]* 640w$/);
  assert.equal(imageSet('https://example.com/a.png', [320, 640]), '');
  assert.equal(imageSet('', [320]), '');
});
test('the width is kept sensible', () => {
  assert.ok(imageAt('https://res.cloudinary.com/d/image/upload/v1/a.jpg', 3).includes('w_16'));
  assert.ok(imageAt('https://res.cloudinary.com/d/image/upload/v1/a.jpg', 399.6).includes('w_400'));
});
