import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGAL_UPDATED, privacySections, termsSections } from '../src/app/legal';

const shop = {
  storeName: 'Royal Treats',
  address: '34 10th Avenue, Thabazimbi',
  supportEmail: 'help@royaltreats.test',
};
const text = (sections: ReturnType<typeof privacySections>) =>
  sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join('\n');

test('the privacy notice covers what POPIA asks a notice to say', () => {
  const t = text(privacySections(shop));
  for (const needle of [
    'Protection of Personal Information Act',
    'responsible party',
    'What we collect',
    'Why we use it',
    'Who can see it',
    'How long we keep it',
    'Your rights',
    'Information Regulator',
    'Cookies and browser storage',
    'Your location',
    'outside South Africa',
    'reset your password',
    'email service',
  ])
    assert.ok(t.includes(needle), needle);
});

test('both pages quote the shop from the settings, and cope with no support email', () => {
  for (const sections of [privacySections(shop), termsSections(shop)]) {
    const t = text(sections);
    assert.ok(t.includes('Royal Treats') && t.includes('34 10th Avenue, Thabazimbi'));
  }
  assert.ok(text(privacySections(shop)).includes('help@royaltreats.test'));
  const none = text(privacySections({ ...shop, supportEmail: '  ' }));
  assert.ok(none.includes('use the Contact page') && !none.includes('email us at'));
});

test('the terms state the rules the app really enforces', () => {
  const t = text(termsSections(shop));
  assert.ok(t.includes('Only the shop can change or cancel an order'));
  assert.ok(t.includes('mini donuts') && t.includes('5 km'));
  assert.ok(t.includes('cash'));
  assert.ok(t.includes('Consumer Protection Act'));
});

test('the pages carry a date', () => assert.match(LEGAL_UPDATED, /^\d{1,2} \w+ \d{4}$/));
