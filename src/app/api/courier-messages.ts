import type { ApiRequestError } from './api-errors';

export type CourierContext = 'jobs' | 'accept' | 'complete';
const TOO_MANY = 'Too many requests. Please wait a moment and try again.';

/** A message for a courier, instead of the API's developer-facing text. */
export function courierErrorMessage(error: ApiRequestError, context: CourierContext): string {
  if (error.status === 0) return error.message; // unreachable / slow: already friendly
  if (error.status === 429) return TOO_MANY;
  if (error.status === 401) return 'Your session has ended. Please sign in again.';
  if (error.status === 403) {
    return context === 'complete'
      ? 'Only your own delivery that is out for delivery can be marked delivered.'
      : 'Your account is not allowed to do that.';
  }
  if (context === 'accept') {
    if (error.status === 409 || error.status === 404)
      return 'Another courier has already taken that delivery. The list has been refreshed.';
    return 'We could not accept the delivery. Please try again.';
  }
  if (context === 'complete') {
    if (error.status === 409)
      return 'This delivery changed while you were looking at it. The list has been refreshed.';
    if (error.status === 404) return 'We could not find that delivery.';
    return 'We could not mark the delivery as delivered. Please try again.';
  }
  return 'We could not load your deliveries. Please try again.';
}
