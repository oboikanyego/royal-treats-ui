export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Checks a picked profile photo before it is sent; returns a message, or null when it is fine. */
export function photoFileProblem(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Choose a JPG, PNG or WebP picture.';
  if (file.size > PHOTO_MAX_BYTES) return 'Choose a picture under 2 MB.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}
