import type { DeliveryOrder } from './commerce-state.service';

export const COLLECTION_STEPS = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Collection',
  'Completed',
];
export const DELIVERY_STEPS = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Delivery',
  'Out for Delivery',
  'Completed',
];

/** The progress steps shown for an order, which depend on how it is fulfilled. */
export const stepsFor = (fulfillment: string): readonly string[] =>
  fulfillment === 'delivery' ? DELIVERY_STEPS : COLLECTION_STEPS;

/** True for `step` and every step before the order's current status. */
export function stepDone(steps: readonly string[], status: string, step: string): boolean {
  let current = steps.indexOf(status);
  // "Ready for ..." is one step whichever way the order is fulfilled.
  if (current < 0 && status.startsWith('Ready'))
    current = steps.findIndex((s) => s.startsWith('Ready'));
  return steps.indexOf(step) <= current;
}

/**
 * The API stores the last status as "Completed". Customers and staff read it as "Collected" for a
 * collection order and "Delivered" for a delivery; every other status is shown as it is.
 */
export function statusLabel(status: string, fulfillment: string): string {
  if (status !== 'Completed') return status;
  return fulfillment === 'delivery' ? 'Delivered' : 'Collected';
}

export const SHARED_LABEL = 'Shared treats';

/** An order's lines grouped by the person each treat is for, in first-seen order. */
export function groupByRecipient<T extends { recipient?: string }>(
  items: readonly T[],
): { recipient: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const who = item.recipient?.trim() || SHARED_LABEL;
    groups.set(who, [...(groups.get(who) ?? []), item]);
  }
  return [...groups].map(([recipient, lines]) => ({ recipient, items: lines }));
}

/**
 * Folds a freshly fetched first page into the orders already on screen: fresh orders come first
 * (newest first, as the API sorts them) with their latest status, then any older ones that were
 * loaded earlier with "show more".
 */
export function mergeOrders(existing: DeliveryOrder[], fresh: DeliveryOrder[]): DeliveryOrder[] {
  const freshIds = new Set(fresh.map((o) => o.id));
  return [...fresh, ...existing.filter((o) => !freshIds.has(o.id))];
}
