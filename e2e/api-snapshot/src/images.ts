import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ApiError } from './security.js';

export type StoredImage = { url: string; width: number; height: number };
/** Where product images live. Production uses Cloudinary; tests inject a fake. */
export type ImageStore = {
  /** Uploads an already-processed image and returns its public URL. */
  upload(image: Buffer): Promise<StoredImage>;
  /** True for URLs this store produced, the only image URLs a product may use. */
  isOwnUrl(url: string): boolean;
};

const MAX_EDGE = 1200;
const MAX_INPUT_PIXELS = 25_000_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Validates an uploaded file really is a JPG, PNG or WebP, then re-encodes it as
 * WebP no larger than 1200 px on a side. Re-encoding drops metadata and anything
 * that is not pixels, so what gets stored is never the uploaded bytes.
 */
export async function processProductImage(input: Buffer): Promise<Buffer> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format ?? ''))
      throw new Error('Unsupported image');
    const output = await image
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (output.length > MAX_OUTPUT_BYTES) throw new Error('Too large');
    return output;
  } catch {
    throw new ApiError(
      400,
      'Upload a valid JPG, PNG or WebP image (up to 25 megapixels)',
    );
  }
}

/**
 * A product's image must come from an upload, never a typed-in URL. Allowed:
 * empty (no photo yet), a URL from our own image store, or - on an update - the
 * image the product already has, so a legacy product can still be edited.
 */
export function assertProductImage(
  image: string,
  store: ImageStore,
  existing?: string | null,
) {
  if (image === '' || store.isOwnUrl(image) || (existing && image === existing))
    return;
  throw new ApiError(
    400,
    'Product images must be uploaded with POST /api/v1/admin/images; image URLs are not accepted',
  );
}

/** Cloudinary signature: sorted `key=value` pairs joined with &, secret appended, SHA-1 hex. */
export function cloudinarySignature(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};
const FOLDER = 'royal-treats/products';

export function createCloudinaryStore(
  cloud: CloudinaryConfig,
  deps: { fetch?: typeof fetch; now?: () => number } = {},
): ImageStore {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const prefix = `/${cloud.cloudName}/image/upload/`;
  const isOwnUrl = (value: string) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.hostname === 'res.cloudinary.com' &&
        url.port === '' &&
        url.username === '' &&
        url.password === '' &&
        url.pathname.startsWith(prefix) &&
        url.pathname.length > prefix.length
      );
    } catch {
      return false;
    }
  };
  return {
    isOwnUrl,
    async upload(image) {
      const timestamp = Math.floor(now() / 1000);
      const signed = { folder: FOLDER, timestamp };
      const form = new FormData();
      form.set(
        'file',
        new Blob([new Uint8Array(image)], { type: 'image/webp' }),
        'product.webp',
      );
      form.set('api_key', cloud.apiKey);
      form.set('folder', FOLDER);
      form.set('timestamp', String(timestamp));
      form.set('signature', cloudinarySignature(signed, cloud.apiSecret));
      let response: Response;
      try {
        response = await doFetch(
          `https://api.cloudinary.com/v1_1/${cloud.cloudName}/image/upload`,
          { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) },
        );
      } catch {
        throw new ApiError(502, 'The image service could not be reached');
      }
      if (!response.ok)
        throw new ApiError(502, 'The image service rejected the upload');
      const body = (await response.json().catch(() => ({}))) as {
        secure_url?: unknown;
        width?: unknown;
        height?: unknown;
      };
      // Trust nothing we did not produce: the URL must be ours.
      if (typeof body.secure_url !== 'string' || !isOwnUrl(body.secure_url))
        throw new ApiError(502, 'Unexpected response from the image service');
      return {
        url: body.secure_url,
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
      };
    },
  };
}

/** Used when Cloudinary is not configured: nothing can be uploaded, and no URL is "ours". */
export const unconfiguredImageStore: ImageStore = {
  isOwnUrl: () => false,
  upload: async () => {
    throw new ApiError(503, 'Image uploads are not configured');
  },
};
