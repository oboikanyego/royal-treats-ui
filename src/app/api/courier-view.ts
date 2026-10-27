import type { DeliveryOrder } from '../commerce-state.service';
import { shortRef } from './api-mappers';
import type { ApiCourierJob } from './api-types';

export type CourierJob = {
  id: string;
  ref: string;
  date: string;
  time: string;
  distanceKm: number | null;
};

export const fromApiJob = (j: ApiCourierJob): CourierJob => ({
  id: j.id,
  ref: shortRef(j.id),
  date: j.date,
  time: j.time,
  distanceKm: typeof j.distanceKm === 'number' ? j.distanceKm : null,
});

/** Soonest first, so the delivery that is due next is at the top. */
export const byDue = (
  a: { date: string; time: string },
  b: { date: string; time: string },
): number => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

/** "3.2 km from the store"; one decimal is plenty for a straight-line distance. */
export const distanceLabel = (km: number | null): string =>
  km === null ? 'Distance not available' : `${km.toFixed(1)} km from the store`;

/** A courier's deliveries: still to deliver first (soonest due), then the finished ones (newest first). */
export function splitDeliveries(orders: DeliveryOrder[]): {
  active: DeliveryOrder[];
  done: DeliveryOrder[];
} {
  const active = orders.filter((o) => o.status === 'Out for Delivery').sort(byDue);
  const done = orders.filter((o) => o.status !== 'Out for Delivery');
  return { active, done };
}
