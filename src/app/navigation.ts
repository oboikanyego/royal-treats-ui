import { environment } from '../environments/environment';

/**
 * With the API, customers follow their orders under "My orders" (signed in); the browser demo
 * keeps the lookup-by-reference "Track order" page.
 */
export const ORDERS_PATH = environment.useApi ? '/orders' : '/track';
export const ORDERS_LABEL = environment.useApi ? 'My Orders' : 'Track Order';
export const ORDERS_SHORT_LABEL = environment.useApi ? 'Orders' : 'Track';
