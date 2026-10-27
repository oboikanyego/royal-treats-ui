import { centsToRand, formatRand } from '../money';
import { shortRef } from './api-mappers';
import type { ApiLiveOrder } from './api-types';

export type LiveAlert = { id: string; text: string };
const MAX_ALERTS = 3;

/** Socket.IO lives on the API's own host, one path level above `/api/v1`. */
export const socketOrigin = (apiUrl: string): string => new URL(apiUrl).origin;

/** Anything that arrives over the socket is checked before it is shown. */
export function isLiveOrder(value: unknown): value is ApiLiveOrder {
  const v = value as Partial<ApiLiveOrder> | null;
  return (
    !!v &&
    typeof v.id === 'string' &&
    typeof v.customer === 'string' &&
    typeof v.fulfillment === 'string' &&
    typeof v.totalCents === 'number' &&
    typeof v.itemCount === 'number' &&
    typeof v.date === 'string' &&
    typeof v.time === 'string'
  );
}

export function pendingCount(value: unknown): number | null {
  const count = (value as { count?: unknown } | null)?.count;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;
}

/** "RT-1A2B3C4D · Thandi · 2 items · R180 · collection 2026-11-01 12:00" */
export function alertText(order: ApiLiveOrder): string {
  const items = `${order.itemCount} ${order.itemCount === 1 ? 'item' : 'items'}`;
  const how = order.fulfillment === 'delivery' ? 'delivery' : 'collection';
  const customer = order.customer.trim() || 'A customer';
  return `${shortRef(order.id)} · ${customer} · ${items} · ${formatRand(centsToRand(order.totalCents))} · ${how} ${order.date} ${order.time}`;
}

/** Newest first, one per order, and only the latest few so a busy hour does not bury the screen. */
export function addAlert(list: LiveAlert[], alert: LiveAlert, max = MAX_ALERTS): LiveAlert[] {
  return [alert, ...list.filter((a) => a.id !== alert.id)].slice(0, max);
}

/** The page title with the number of orders waiting, e.g. "(2) Our Menu | Royal Treats". */
export function titleWithCount(title: string, count: number | null): string {
  const bare = title.replace(/^\(\d+\)\s+/, '');
  return count ? `(${count}) ${bare}` : bare;
}
