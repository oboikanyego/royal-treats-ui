/** A place found for an address: the point deliveries are measured from. */
export type GeoPoint = { latitude: number; longitude: number; label: string };

type Fetch = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'json'>>;

/** OpenStreetMap's search, restricted to South Africa. Only the shop's own address is sent. */
export function geocodeUrl(address: string): string {
  const q = encodeURIComponent(address.trim().replace(/\s+/g, ' '));
  return `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&addressdetails=0&q=${q}`;
}

/** The best match for an address, or null when nothing is found or the lookup fails. Never throws. */
export async function geocodeAddress(
  address: string,
  fetchImpl: Fetch = (url, init) => fetch(url, init),
  timeoutMs = 8000,
): Promise<GeoPoint | null> {
  if (!address.trim()) return null;
  try {
    const res = await fetchImpl(geocodeUrl(address), { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const hits = (await res.json()) as unknown;
    const hit = Array.isArray(hits) ? (hits[0] as Record<string, unknown> | undefined) : undefined;
    const latitude = Number(hit?.['lat']);
    const longitude = Number(hit?.['lon']);
    if (
      !hit ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      return null;
    return {
      latitude: Math.round(latitude * 1e6) / 1e6,
      longitude: Math.round(longitude * 1e6) / 1e6,
      label: typeof hit['display_name'] === 'string' ? hit['display_name'] : address.trim(),
    };
  } catch {
    return null;
  }
}

/** A link to the point on OpenStreetMap, so the admin can see where deliveries are measured from. */
export function mapLink(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}
