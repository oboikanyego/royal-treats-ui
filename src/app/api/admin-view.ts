import { statusLabel } from '../order-view';
import type { ApiDashboard } from './api-types';

const ACTIVE = [
  'Confirmed',
  'Preparing',
  'Ready for Collection',
  'Ready for Delivery',
  'Out for Delivery',
];
/** Order of the status breakdown; any status the API adds later is listed after these. */
const STATUS_ORDER = ['Pending', ...ACTIVE, 'Completed', 'Cancelled'];

export type DashboardSummary = {
  orders: number;
  pending: number;
  active: number;
  completed: number;
  cancelled: number;
  revenueCents: number;
  breakdown: { status: string; label: string; count: number; totalCents: number }[];
};

/** The API's per-status totals, as the handful of numbers the overview shows. */
export function dashboardSummary(d: ApiDashboard): DashboardSummary {
  const count = (statuses: string[]) =>
    d.ordersByStatus.filter((s) => statuses.includes(s._id)).reduce((sum, s) => sum + s.count, 0);
  const rank = (status: string) => {
    const i = STATUS_ORDER.indexOf(status);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  return {
    orders: d.ordersByStatus.reduce((sum, s) => sum + s.count, 0),
    pending: count(['Pending']),
    active: count(ACTIVE),
    completed: count(['Completed']),
    cancelled: count(['Cancelled']),
    revenueCents: d.completedRevenueCents,
    breakdown: d.ordersByStatus
      .map((s) => ({
        status: s._id,
        // The dashboard groups collections and deliveries together, so it cannot say which.
        label: s._id === 'Completed' ? 'Collected / delivered' : s._id,
        count: s.count,
        totalCents: s.totalCents,
      }))
      .sort((a, b) => rank(a.status) - rank(b.status) || a.status.localeCompare(b.status)),
  };
}

/** The filters on the admin orders list, applied to the orders already loaded. */
export type OrderFilter = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';
export function matchesFilter(status: string, filter: OrderFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'pending':
      return status === 'Pending';
    case 'active':
      return ACTIVE.includes(status);
    case 'completed':
      return status === 'Completed';
    case 'cancelled':
      return status === 'Cancelled';
  }
}

/** The button text for moving an order to `status`. */
export function statusActionLabel(status: string, fulfillment: string): string {
  return status === 'Cancelled' ? 'Cancel order' : `Mark ${statusLabel(status, fulfillment)}`;
}
