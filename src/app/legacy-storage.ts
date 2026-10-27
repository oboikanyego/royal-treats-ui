/** Keys the browser-only demo used. The site now keeps all of this on the server. */
export const LEGACY_LOCAL_KEYS = [
  'royal-products-v2',
  'royal-accounts-v2',
  'royal-settings-v2',
  'royal-deliveries-v2',
  'rt-orders',
];
export const LEGACY_SESSION_KEYS = ['royal-demo-session'];

type Removable = Pick<Storage, 'removeItem'>;

/**
 * Deletes what the old demo left in a returning visitor's browser, including demo accounts whose
 * passwords were stored unencrypted. Safe to run on every start; never throws.
 */
export function clearLegacyDemoData(local: Removable, session: Removable): void {
  for (const [storage, keys] of [
    [local, LEGACY_LOCAL_KEYS],
    [session, LEGACY_SESSION_KEYS],
  ] as const) {
    for (const key of keys) {
      try {
        storage.removeItem(key);
      } catch {
        // Storage can be blocked (private mode); there is nothing to clean up then.
      }
    }
  }
}
