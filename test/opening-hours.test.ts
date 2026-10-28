import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editableWeek,
  everydayHours,
  hoursOn,
  weekFrom,
  weekProblem,
  weekSummary,
  weekdayOf,
  withinHours,
} from '../src/app/opening-hours';

const base = { open: '10:00', close: '23:00' };
const week = (over: Record<number, Partial<ReturnType<typeof weekFrom>[number]>> = {}) =>
  weekFrom('10:00', '23:00').map((d, i) => ({ ...d, ...over[i] }));

test('weekdays come from the date itself, Sunday is 0', () => {
  assert.equal(weekdayOf('2026-11-01'), 0);
  assert.equal(weekdayOf('2026-11-02'), 1);
});
test('hours on a date: the everyday hours, or that weekday, or null when closed', () => {
  assert.deepEqual(hoursOn(base, '2026-11-01'), { open: '10:00', close: '23:00' });
  const w = {
    ...base,
    weeklyHours: week({ 0: { closed: true }, 1: { open: '09:00', close: '12:00' } }),
  };
  assert.equal(hoursOn(w, '2026-11-01'), null);
  assert.deepEqual(hoursOn(w, '2026-11-02'), { open: '09:00', close: '12:00' });
  assert.equal(hoursOn(base, ''), null, 'no date yet');
});
test('a time is inside hours at the edges, also across midnight, and never on a closed day', () => {
  const h = { open: '09:00', close: '17:00' };
  assert.equal(withinHours(h, '09:00') && withinHours(h, '17:00'), true);
  assert.equal(withinHours(h, '08:59') || withinHours(h, '17:01'), false);
  assert.equal(withinHours({ open: '18:00', close: '02:00' }, '01:00'), true);
  assert.equal(withinHours(null, '12:00'), false);
});
test('editing starts from the API week, or from the everyday hours', () => {
  assert.equal(editableWeek(base).length, 7);
  assert.ok(editableWeek(base).every((d) => !d.closed && d.open === '10:00'));
  const w = { ...base, weeklyHours: week({ 3: { closed: true } }) };
  const copy = editableWeek(w);
  copy[3]!.closed = false;
  assert.equal(w.weeklyHours[3]!.closed, true, 'the copy does not change the original');
});
test('the everyday hours the API needs are the first open day, Monday first', () => {
  assert.deepEqual(
    everydayHours(week({ 1: { closed: true }, 2: { open: '08:00', close: '12:00' } })),
    {
      open: '08:00',
      close: '12:00',
    },
  );
  assert.equal(
    everydayHours(
      week(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [i, { closed: true }]))),
    ),
    null,
  );
});
test('week problems name the day', () => {
  assert.equal(weekProblem(week()), null);
  assert.match(
    weekProblem(week(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((i) => [i, { closed: true }]))))!,
    /at least one day/,
  );
  assert.match(weekProblem(week({ 5: { open: '10:00', close: '10:00' } }))!, /differ on Friday/);
  assert.match(weekProblem(week({ 2: { open: '', close: '10:00' } }))!, /for Tuesday/);
});
test('the summary groups days with the same hours, Monday first', () => {
  assert.equal(weekSummary(base), 'Mon–Sun 10:00–23:00');
  assert.equal(
    weekSummary({
      ...base,
      weeklyHours: week({ 0: { closed: true }, 6: { open: '10:00', close: '14:00' } }),
    }),
    'Mon–Fri 10:00–23:00, Sat 10:00–14:00, Sun closed',
  );
});
