import { z } from 'zod';
import { ORDER_STATUSES } from './statuses.js';
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{9,16}$/);
export const account = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    phone,
    password: z.string().min(12).max(128),
  })
  .strict();
/** Self-registration: the account fields plus an explicit agreement to the privacy notice and terms. */
export const registration = account
  .extend({
    remember: z.boolean().optional(),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({
        message: 'You must accept the privacy notice and terms to register',
      }),
    }),
  })
  .strict();
export const accountDeletion = z
  .object({ password: z.string().min(1).max(128) })
  .strict();
export const receiptTemplateInput = z
  .object({ html: z.string().max(100_000) })
  .strict();
export const forgotPassword = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
  })
  .strict();
export const resetPassword = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
export const passwordChange = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const settingsInput = z
  .object({
    storeName: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(300),
    supportEmail: z.union([z.literal(''), z.string().email().max(254)]),
    open: time,
    close: time,
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    ordersPaused: z.boolean().optional(),
    pauseMessage: z.string().trim().max(200).optional(),
    weeklyHours: z
      .array(
        z
          .object({ closed: z.boolean(), open: time, close: time })
          .strict()
          .refine(
            (d) => d.closed || d.open !== d.close,
            'Opening and closing time must differ',
          ),
      )
      .length(7)
      .refine(
        (week) => week.some((d) => !d.closed),
        'Open on at least one day of the week',
      )
      .optional(),
  })
  .strict()
  .refine(
    (s) => (s.latitude === null) === (s.longitude === null),
    'Provide both coordinates',
  );
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(80),
    description: z.string().max(1500),
    // Empty, or an https URL. Which URLs are acceptable is decided by the image store
    // (uploads only); see assertProductImage.
    image: z
      .string()
      .max(2000)
      .refine((v) => v === '' || v.startsWith('https://')),
    available: z.boolean(),
    deliverable: z.boolean(),
    variants: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(80),
            priceCents: z.number().int().min(0).max(10000000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    sauces: z.array(z.string().trim().min(1).max(80)).max(30),
    toppings: z.array(z.string().trim().min(1).max(80)).max(30),
  })
  .strict()
  .refine(
    (p) => !p.deliverable || p.category === 'Mini Donuts',
    'Only mini donuts are deliverable',
  )
  .refine(
    (p) => new Set(p.variants.map((v) => v.label)).size === p.variants.length,
    'Variant labels must be unique',
  );
export const orderInput = z
  .object({
    fulfillment: z.enum(['collection', 'delivery']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time,
    notes: z.string().max(1000).default(''),
    address: z.string().trim().max(300).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(80),
            variant: z.string().max(80),
            qty: z.number().int().min(1).max(100),
            sauce: z.string().max(80).default(''),
            topping: z.string().max(80).default(''),
            recipient: z.string().trim().max(45).default(''),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
/** `?status=Pending` or `?status=Confirmed,Preparing`: one or more known order statuses. */
export const statusFilter = z
  .string()
  .max(200)
  .transform((value) => value.split(',').map((s) => s.trim()))
  .pipe(z.array(z.enum(ORDER_STATUSES)).min(1).max(ORDER_STATUSES.length));
export type OrderInput = z.infer<typeof orderInput>;
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
