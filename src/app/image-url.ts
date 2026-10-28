/**
 * Smaller pictures for phones. Cloudinary and Unsplash can resize on the fly, so asking for the width a
 * screen needs (instead of the full upload) makes the menu load much faster. Other addresses are left alone.
 */
const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

/** The picture resized to about `width` pixels wide (and in a modern format where the host supports it). */
export function imageAt(url: string | null | undefined, width: number): string {
  if (!url) return '';
  const w = Math.max(16, Math.round(width));
  const cloudinary = CLOUDINARY.exec(url);
  if (cloudinary) {
    const [, base, rest] = cloudinary;
    // Already resized (by the API or by us): leave it alone.
    if (
      /^[a-z]{1,3}_[^/]*(,[a-z]{1,3}_[^/]*)*\//.test(rest!) &&
      /(^|,)w_\d+/.test(rest!.split('/')[0]!)
    )
      return url;
    return `${base}f_auto,q_auto,c_limit,w_${w}/${rest}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'images.unsplash.com') {
      parsed.searchParams.set('w', String(w));
      parsed.searchParams.set('q', '70');
      parsed.searchParams.set('auto', 'format');
      parsed.searchParams.set('fit', 'crop');
      return parsed.toString();
    }
  } catch {
    // Not an absolute address (a local path or a data address): nothing to resize.
  }
  return url;
}

/** A `srcset` of the picture at several widths, or '' when it cannot be resized. */
export function imageSet(url: string | null | undefined, widths: readonly number[]): string {
  if (!url) return '';
  const sizes = widths.map((w) => [imageAt(url, w), w] as const);
  if (sizes.every(([u]) => u === url)) return '';
  return sizes.map(([u, w]) => `${u} ${w}w`).join(', ');
}
