/** One day of the week: closed, or open between two HH:MM times. */
export type DayHours = { closed: boolean; open: string; close: string };
export type Hours = { open: string; close: string; weeklyHours?: DayHours[] | null };

/** Weekdays as the API stores them: index 0 is Sunday. */
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
/** The order shown to people: Monday first. */
export const WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Day of the week for a YYYY-MM-DD date, 0 = Sunday, the same in every time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The hours on a date, or null when the shop is closed that day (or the date is not a date). */
export function hoursOn(settings: Hours, date: string): { open: string; close: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(weekdayOf(date))) return null;
  const week = settings.weeklyHours;
  if (Array.isArray(week) && week.length === 7) {
    const day = week[weekdayOf(date)];
    return !day || day.closed ? null : { open: day.open, close: day.close };
  }
  return { open: settings.open, close: settings.close };
}

/** Whether an HH:MM time is inside the hours; hours may run past midnight (18:00 to 02:00). */
export function withinHours(hours: { open: string; close: string } | null, time: string): boolean {
  if (!hours) return false;
  return hours.open <= hours.close
    ? time >= hours.open && time <= hours.close
    : time >= hours.open || time <= hours.close;
}

/** Seven identical open days, to start editing from the everyday hours. */
export function weekFrom(open: string, close: string): DayHours[] {
  return Array.from({ length: 7 }, () => ({ closed: false, open, close }));
}

/** A copy of the week, or one built from the everyday hours when the API sent none. */
export function editableWeek(settings: Hours): DayHours[] {
  const week = settings.weeklyHours;
  return Array.isArray(week) && week.length === 7
    ? week.map((d) => ({ ...d }))
    : weekFrom(settings.open, settings.close);
}

/** The everyday open/close the API still requires: the first open day's hours, Monday first. */
export function everydayHours(week: DayHours[]): { open: string; close: string } | null {
  for (const index of WEEK_DISPLAY_ORDER) {
    const day = week[index];
    if (day && !day.closed) return { open: day.open, close: day.close };
  }
  return null;
}

export function weekProblem(week: DayHours[]): string | null {
  if (week.length !== 7) return 'Set the hours for every day of the week.';
  if (week.every((d) => d.closed)) return 'Open on at least one day of the week.';
  for (const index of WEEK_DISPLAY_ORDER) {
    const d = week[index]!;
    if (d.closed) continue;
    if (!TIME.test(d.open) || !TIME.test(d.close))
      return `Enter opening and closing times for ${WEEKDAYS[index]}.`;
    if (d.open === d.close) return `Opening and closing time must differ on ${WEEKDAYS[index]}.`;
  }
  return null;
}

/** "Mon–Fri 09:00–17:00, Sat 10:00–14:00, Sun closed", for a summary line. */
export function weekSummary(settings: Hours): string {
  const week = editableWeek(settings);
  const label = (d: DayHours) => (d.closed ? 'closed' : `${d.open}–${d.close}`);
  const groups: { days: number[]; text: string }[] = [];
  for (const index of WEEK_DISPLAY_ORDER) {
    const text = label(week[index]!);
    const last = groups.at(-1);
    if (last && last.text === text) last.days.push(index);
    else groups.push({ days: [index], text });
  }
  return groups
    .map((g) => {
      const first = WEEKDAYS[g.days[0]!].slice(0, 3);
      const end = WEEKDAYS[g.days.at(-1)!].slice(0, 3);
      return `${g.days.length > 1 ? `${first}–${end}` : first} ${g.text}`;
    })
    .join(', ');
}
