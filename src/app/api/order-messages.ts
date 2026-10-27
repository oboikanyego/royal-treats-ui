import type { ApiRequestError } from './api-errors';

export type OrderContext = 'place' | 'list';
const TOO_MANY = 'Too many requests. Please wait a moment and try again.';

/** Known 409 texts from the API, as something a customer can act on. */
const CONFLICTS: Record<string, string> = {
  'An item is unavailable': 'An item is now out of stock. Please update your cart.',
  'Store coordinates are not configured':
    'Delivery is not available yet. Please choose collection.',
  'Business settings must be configured':
    'The store is not ready to take orders yet. Please try again later.',
  'Idempotency key already used for another order':
    'Something went wrong with this order. Please refresh the page and try again.',
};

/** A message for the customer. The API's own 400 texts ("Time is outside store hours") are already plain English. */
export function orderErrorMessage(error: ApiRequestError, context: OrderContext): string {
  if (error.status === 0) return error.message; // unreachable / slow: already friendly
  if (error.status === 429) return TOO_MANY;
  if (error.status === 401) return 'Please sign in again to continue.';
  if (context === 'list') return 'We could not load your orders. Please try again.';
  if (error.status === 403) return 'Only customer accounts can place orders.';
  if (error.status === 409) return CONFLICTS[error.message] ?? error.message;
  if (error.status === 400)
    return error.message && error.message !== 'Invalid input'
      ? error.message
      : 'Please check your order and try again.';
  return 'We could not place your order. Please try again.';
}
