/** Opening hours for one day; `null` means the shop is closed that day. */
export type DayHours = { open: string; close: string } | null;
export type WeeklyHours = { closed: boolean; open: string; close: string }[];
type Hours = {
  open: string;
  close: string;
  weeklyHours?: WeeklyHours | null;
};

/** Day of the week for a YYYY-MM-DD date, 0 = Sunday. The same in every time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The hours that apply on a date: that weekday's own hours when set, otherwise the everyday open/close. */
export function hoursFor(settings: Hours, date: string): DayHours {
  const week = settings.weeklyHours;
  if (Array.isArray(week) && week.length === 7) {
    const day = week[weekdayOf(date)];
    if (!day || day.closed) return null;
    return { open: day.open, close: day.close };
  }
  return { open: settings.open, close: settings.close };
}

/** Whether an HH:MM time falls inside the hours (which may run past midnight, like 18:00 to 02:00). */
export function withinHours(hours: DayHours, time: string): boolean {
  if (!hours) return false;
  return hours.open <= hours.close
    ? time >= hours.open && time <= hours.close
    : time >= hours.open || time <= hours.close;
}

const addDays = (date: string, days: number) =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);

/** The scheduled moment of an order (South African time, UTC+2 all year). */
export const scheduledAt = (date: string, time: string) =>
  new Date(`${date}T${time}:00+02:00`);

/**
 * One full working day after the order's scheduled time: the same time of day on the next day the
 * shop is open. An order still not completed after this moment is overdue.
 */
export function overdueAfter(
  order: { date: string; time: string },
  settings: Hours,
): Date {
  for (let step = 1; step <= 7; step++) {
    const date = addDays(order.date, step);
    if (hoursFor(settings, date)) return scheduledAt(date, order.time);
  }
  return scheduledAt(addDays(order.date, 1), order.time);
}
