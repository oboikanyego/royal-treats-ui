import Handlebars from 'handlebars';
import { shortRef } from './emails.js';
import { ApiError } from './security.js';

/** The values a receipt template can use, shown to the admin next to the editor. */
export const RECEIPT_PLACEHOLDERS: { name: string; description: string }[] = [
  { name: '{{shop.name}}', description: 'The shop name' },
  { name: '{{shop.address}}', description: 'The shop address' },
  {
    name: '{{shop.email}}',
    description: 'The shop support email (may be empty)',
  },
  {
    name: '{{order.ref}}',
    description: 'The short order reference, like RT-1A2B3C4D',
  },
  { name: '{{order.status}}', description: 'The order status' },
  { name: '{{order.placedAt}}', description: 'When the order was placed' },
  {
    name: '{{order.date}} {{order.time}}',
    description: 'The date and time the customer chose',
  },
  {
    name: '{{order.fulfillmentLabel}}',
    description: '"Collection" or "Delivery"',
  },
  {
    name: '{{order.address}}',
    description: 'The delivery address (empty for collection)',
  },
  {
    name: '{{order.payment}}',
    description: 'How the customer pays, like Cash on Collection',
  },
  {
    name: '{{order.notes}}',
    description: "The customer's notes (may be empty)",
  },
  { name: '{{customer.name}} {{customer.phone}}', description: 'The customer' },
  {
    name: '{{#each items}} … {{/each}}',
    description:
      'One block per line, with {{qty}} {{name}} {{options}} {{recipient}} {{unitPrice}} {{lineTotal}}',
  },
  {
    name: '{{totals.total}}',
    description: 'The order total, like R150 or R25.50',
  },
  { name: '{{printedAt}}', description: 'When the receipt was printed' },
  {
    name: '{{#if …}} {{#unless …}} {{#each …}}',
    description: 'Conditions and loops (Handlebars)',
  },
];

/** The receipt every shop starts with; seeded into the database when the service starts. */
export const DEFAULT_RECEIPT_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt {{order.ref}}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font: 14px/1.45 Arial, Helvetica, sans-serif; color: #2b1d27; background: #fff; }
  .receipt { max-width: 420px; margin: 0 auto; }
  header { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #ed1680; }
  header h1 { margin: 0 0 4px; font: 700 24px Georgia, serif; color: #b81361; }
  header p { margin: 0; font-size: 12px; color: #6f5a68; }
  h2 { margin: 18px 0 2px; font-size: 16px; }
  .muted { margin: 0 0 12px; font-size: 12px; color: #7d6676; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 14px; }
  dt { color: #7d6676; }
  dd { margin: 0; text-align: right; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #7d6676; border-bottom: 1px solid #e9d9e1; padding: 6px 0; }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 8px 0; border-bottom: 1px dashed #e9d9e1; vertical-align: top; }
  td small { display: block; color: #7d6676; font-size: 11px; }
  .total { display: flex; justify-content: space-between; margin-top: 12px; font-size: 18px; font-weight: 700; }
  .notes { margin-top: 12px; padding: 8px 10px; background: #fff0f7; border-radius: 8px; font-size: 12px; }
  footer { margin-top: 22px; text-align: center; font-size: 12px; color: #7d6676; }
  @media print { body { padding: 0; } .receipt { max-width: none; } }
</style>
</head>
<body>
<main class="receipt">
  <header>
    <h1>{{shop.name}}</h1>
    <p>{{shop.address}}</p>
    {{#if shop.email}}<p>{{shop.email}}</p>{{/if}}
  </header>
  <h2>Order {{order.ref}}</h2>
  <p class="muted">Placed {{order.placedAt}} · {{order.status}}</p>
  <dl>
    <dt>Customer</dt><dd>{{customer.name}}</dd>
    <dt>Phone</dt><dd>{{customer.phone}}</dd>
    <dt>{{order.fulfillmentLabel}}</dt><dd>{{order.date}} at {{order.time}}</dd>
    {{#if order.address}}<dt>Address</dt><dd>{{order.address}}</dd>{{/if}}
    <dt>Payment</dt><dd>{{order.payment}}</dd>
  </dl>
  <table>
    <thead><tr><th>Item</th><th>Each</th><th>Total</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{qty}} × {{name}}{{#if options}}<small>{{options}}</small>{{/if}}{{#if recipient}}<small>For {{recipient}}</small>{{/if}}</td>
        <td>{{unitPrice}}</td>
        <td>{{lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="total"><span>Total</span><span>{{totals.total}}</span></div>
  {{#if order.notes}}<p class="notes">Notes: {{order.notes}}</p>{{/if}}
  <footer>Thank you for choosing {{shop.name}}.<br>Printed {{printedAt}}</footer>
</main>
</body>
</html>
`;

export const MAX_TEMPLATE_CHARS = 20_000;

/** Whole rand without decimals, otherwise two: R150, R25.50 (the same as the site shows). */
export function formatRand(cents: number): string {
  const rand = (Number.isFinite(cents) ? cents : 0) / 100;
  return 'R' + (Number.isInteger(rand) ? String(rand) : rand.toFixed(2));
}

type ReceiptOrder = {
  _id?: unknown;
  createdAt?: Date | string;
  date?: string;
  time?: string;
  status?: string;
  fulfillment?: string;
  payment?: string;
  notes?: string;
  address?: string;
  customer?: string;
  phone?: string;
  totalCents?: number;
  items?: {
    qty?: number;
    name?: string;
    variant?: string;
    sauce?: string;
    topping?: string;
    recipient?: string;
    priceCents?: number;
  }[];
};
type ReceiptShop = {
  storeName?: string;
  address?: string;
  supportEmail?: string;
};

const stamp = (value: Date | string | undefined) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  // South African time, to the minute.
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
};

/** Only the values documented in RECEIPT_PLACEHOLDERS, as plain strings and numbers. */
export function receiptData(
  order: ReceiptOrder,
  shop: ReceiptShop,
  now = new Date(),
) {
  const delivery = order.fulfillment === 'delivery';
  return {
    shop: {
      name: shop.storeName || 'Royal Treats',
      address: shop.address || '',
      email: shop.supportEmail || '',
    },
    order: {
      ref: shortRef(String(order._id ?? '')),
      status: order.status ?? '',
      placedAt: stamp(order.createdAt),
      date: order.date ?? '',
      time: order.time ?? '',
      fulfillmentLabel: delivery ? 'Delivery' : 'Collection',
      address: delivery ? (order.address ?? '') : '',
      payment: order.payment ?? '',
      notes: order.notes ?? '',
    },
    customer: { name: order.customer ?? '', phone: order.phone ?? '' },
    items: (order.items ?? []).map((line) => ({
      qty: line.qty ?? 0,
      name: line.name ?? '',
      options: [line.variant, line.sauce, line.topping]
        .filter(Boolean)
        .join(' · '),
      recipient: line.recipient ?? '',
      unitPrice: formatRand(line.priceCents ?? 0),
      lineTotal: formatRand((line.priceCents ?? 0) * (line.qty ?? 0)),
    })),
    totals: { total: formatRand(order.totalCents ?? 0) },
    printedAt: stamp(now),
  };
}

/** A sample order for previews and for checking a template before it is saved. */
export const SAMPLE_RECEIPT = receiptData(
  {
    _id: 'RT-1A2B3C4D-0000-0000-0000-000000000000',
    createdAt: new Date('2026-11-02T09:15:00Z'),
    date: '2026-11-04',
    time: '12:30',
    status: 'Confirmed',
    fulfillment: 'delivery',
    payment: 'Cash on Delivery',
    notes: 'Please ring the bell',
    address: '12 Rietbok Street, Thabazimbi',
    customer: 'Thandi Mokoena',
    phone: '074 123 4567',
    totalCents: 12550,
    items: [
      {
        qty: 2,
        name: 'Mini Donuts',
        variant: '12 donuts',
        sauce: 'Chocolate',
        topping: 'Oreo',
        recipient: 'Lerato',
        priceCents: 5000,
      },
      {
        qty: 1,
        name: 'Milkshake',
        variant: 'Large',
        sauce: 'Vanilla',
        recipient: '',
        priceCents: 2550,
      },
    ],
  },
  {
    storeName: 'Royal Treats',
    address: '34 10th Avenue, Thabazimbi',
    supportEmail: 'orders@royaltreats.example',
  },
  new Date('2026-11-04T08:00:00Z'),
);

// A private Handlebars environment with the built-in conditions and loops only, and no logging.
const hbs = Handlebars.create();
hbs.registerHelper('log', () => '');
const options = {
  knownHelpersOnly: true,
  knownHelpers: { log: false } as Record<string, boolean>,
};

/** Raw output ({{{x}}} or {{&x}}) would put customer text into the page unescaped, so it is not allowed. */
const RAW_OUTPUT = /\{\{\{|\{\{\s*&/;

/** Throws a 400 with a plain message when the template cannot be used. */
export function validateReceiptTemplate(html: unknown): string {
  if (typeof html !== 'string' || !html.trim())
    throw new ApiError(400, 'The receipt template cannot be empty');
  if (html.length > MAX_TEMPLATE_CHARS)
    throw new ApiError(
      400,
      `The receipt template is too long (at most ${MAX_TEMPLATE_CHARS} characters)`,
    );
  if (RAW_OUTPUT.test(html))
    throw new ApiError(
      400,
      'Use {{value}} instead of {{{value}}} or {{&value}}: raw output is not allowed',
    );
  try {
    hbs.compile(html, options)(SAMPLE_RECEIPT);
  } catch (error) {
    throw new ApiError(
      400,
      `The receipt template has a problem: ${(error as Error).message.split('\n')[0]}`,
    );
  }
  return html;
}

/** Fills a template with an order's values; every value is HTML-escaped. */
export function renderReceipt(
  html: string,
  data: ReturnType<typeof receiptData>,
): string {
  return hbs.compile(html, options)(data);
}
