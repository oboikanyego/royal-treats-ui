import type { ApiRequestError } from './api-errors';

export type AdminContext =
  'products' | 'image' | 'settings' | 'couriers' | 'orders' | 'dashboard' | 'status';
const TOO_MANY = 'Too many requests. Please wait a moment and try again.';

const NOUN: Record<AdminContext, string> = {
  products: 'the product',
  image: 'the picture',
  settings: 'the settings',
  couriers: 'the delivery person',
  orders: 'the orders',
  dashboard: 'the overview',
  status: 'the order',
};

/** The first validation message the API reported, when it sent any (zod issue list). */
function firstDetail(details: unknown): string | undefined {
  if (!Array.isArray(details)) return undefined;
  const issue = details[0] as { path?: unknown; message?: unknown } | undefined;
  if (!issue || typeof issue.message !== 'string') return undefined;
  const field = Array.isArray(issue.path) && issue.path.length ? issue.path.join(' › ') : '';
  return field ? `${field}: ${issue.message}` : issue.message;
}

/** A message for staff. Their own 400/409 texts from the API are plain English, so they are shown. */
export function adminErrorMessage(error: ApiRequestError, context: AdminContext): string {
  if (error.status === 0) return error.message; // unreachable / slow: already friendly
  if (error.status === 429) return TOO_MANY;
  if (error.status === 401) return 'Your session has ended. Please sign in again.';
  if (error.status === 403) return 'Your account is not allowed to do that.';
  if (context === 'image') {
    if (error.status === 503) return 'Picture uploads are not set up on the server yet.';
    if (error.status === 413) return 'That picture is too large. Choose one under 5 MB.';
    if (error.status === 502)
      return 'The picture service did not accept the upload. Please try again.';
    if (error.status === 400) return error.message || 'That file could not be used as a picture.';
    return 'We could not upload the picture. Please try again.';
  }
  if (error.status === 404) return `We could not find ${NOUN[context]}. Refresh and try again.`;
  if (error.status === 409) {
    if (context === 'couriers') return 'That email is already registered.';
    return error.message || 'That change conflicts with the latest data. Refresh and try again.';
  }
  if (error.status === 400) {
    if (error.message && error.message !== 'Invalid input') return error.message;
    return firstDetail(error.details) ?? 'Please check the details and try again.';
  }
  if (context === 'orders' || context === 'dashboard')
    return `We could not load ${NOUN[context]}. Please try again.`;
  return `We could not save ${NOUN[context]}. Please try again.`;
}
