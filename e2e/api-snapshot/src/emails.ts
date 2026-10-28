import type { Email } from './mail.js';

export type Shop = { storeName: string; address: string; supportEmail: string };
export type MailOrder = {
  _id: unknown;
  customer?: string | null;
  fulfillment?: string | null;
  address?: string | null;
  date?: string | null;
  time?: string | null;
  notes?: string | null;
  status?: string | null;
  totalCents?: number | null;
  items?: {
    name?: string | null;
    variant?: string | null;
    qty?: number | null;
    sauce?: string | null;
    topping?: string | null;
    recipient?: string | null;
  }[];
};

/** `RT-` and the first 8 characters of the id, the reference customers know their order by. */
export const shortRef = (id: unknown): string => {
  const match = /^RT-([0-9a-f]{8})-/i.exec(String(id));
  return match ? `RT-${match[1]!.toUpperCase()}` : String(id);
};
export const rand = (cents: number | null | undefined): string => {
  const c = Math.round(cents ?? 0);
  return 'R' + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
};
const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const lines = (order: MailOrder): string[] =>
  (order.items ?? []).map((item) => {
    const extras = [item.variant, item.sauce, item.topping]
      .filter(Boolean)
      .join(', ');
    const who = item.recipient ? ` (for ${item.recipient})` : '';
    return `${item.qty ?? 1} × ${item.name ?? 'Item'}${extras ? ` – ${extras}` : ''}${who}`;
  });
const when = (order: MailOrder) =>
  `${order.date ?? ''} at ${order.time ?? ''}`.trim();
const how = (order: MailOrder, shop: Shop) =>
  order.fulfillment === 'delivery'
    ? `Delivery to ${order.address ?? ''}`
    : `Collection at ${shop.address}`;

/** Plain text plus a simple branded HTML version of the same message. */
function compose(
  shop: Shop,
  to: string,
  subject: string,
  paragraphs: string[],
  details: string[] = [],
  button?: { label: string; url: string },
): Email {
  const text = [
    ...paragraphs,
    ...(details.length ? ['', ...details] : []),
    ...(button ? ['', `${button.label}: ${button.url}`] : []),
    '',
    `${shop.storeName}${shop.supportEmail ? ` · ${shop.supportEmail}` : ''}`,
  ].join('\n');
  const html = `<!doctype html><html><body style="margin:0;background:#fff5f9;font-family:Arial,Helvetica,sans-serif;color:#2b1630">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="font-size:22px;font-weight:700;color:#c2185b;margin-bottom:16px">♛ ${escape(shop.storeName)}</div>
<div style="background:#fff;border:1px solid #f3c6da;border-radius:12px;padding:20px;line-height:1.5">
${paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join('\n')}
${details.length ? `<ul style="margin:0 0 12px;padding-left:18px">${details.map((d) => `<li>${escape(d)}</li>`).join('')}</ul>` : ''}
${button ? `<p style="margin:16px 0 0"><a href="${escape(button.url)}" style="display:inline-block;background:#e91e8c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700">${escape(button.label)}</a></p>` : ''}
</div>
<p style="font-size:12px;color:#7a6a80;margin:16px 0 0">${escape(shop.storeName)}${shop.supportEmail ? ` · ${escape(shop.supportEmail)}` : ''}</p>
</div></body></html>`;
  return { to, subject, text, html };
}

const summary = (order: MailOrder, shop: Shop) => [
  ...lines(order),
  how(order, shop),
  `For ${when(order)}`,
  `Total ${rand(order.totalCents)}, paid in cash`,
];

/** To the customer straight after they place an order. */
export function orderReceivedEmail(
  order: MailOrder,
  shop: Shop,
  to: string,
  siteUrl: string,
): Email {
  const ref = shortRef(order._id);
  return compose(
    shop,
    to,
    `We received your order ${ref}`,
    [
      `Thank you for your order, ${order.customer ?? ''}.`.replace(' ,', ','),
      'We will confirm your date and time soon. You can follow your order any time.',
    ],
    [`Order ${ref}`, ...summary(order, shop)],
    { label: 'View my orders', url: `${siteUrl}/orders` },
  );
}

/** To the customer when the shop moves their order along; null for a status that needs no email. */
export function orderStatusEmail(
  order: MailOrder,
  shop: Shop,
  to: string,
  siteUrl: string,
  options: { automatic?: boolean } = {},
): Email | null {
  const ref = shortRef(order._id);
  const delivery = order.fulfillment === 'delivery';
  const say = (subject: string, message: string[]) =>
    compose(
      shop,
      to,
      subject,
      message,
      [`Order ${ref}`, ...summary(order, shop)],
      {
        label: 'View my orders',
        url: `${siteUrl}/orders`,
      },
    );
  switch (order.status) {
    case 'Confirmed':
      return say(`Your order ${ref} was accepted`, [
        'Good news: we accepted your order and the date and time you asked for.',
      ]);
    case 'Preparing':
      return say(`Your order ${ref} is being prepared`, [
        'We are making your treats now.',
      ]);
    case 'Ready for Collection':
      return say(`Your order ${ref} is ready for collection`, [
        `Your order is ready. Please collect it at ${shop.address}.`,
      ]);
    case 'Ready for Delivery':
      return say(`Your order ${ref} is ready`, [
        'Your order is ready and is waiting for a delivery person to pick it up.',
      ]);
    case 'Out for Delivery':
      return say(`Your order ${ref} is on its way`, [
        'A delivery person has your order and is on the way. They may call you, so please keep your phone close.',
      ]);
    case 'Completed':
      return say(
        delivery
          ? `Your order ${ref} was delivered`
          : `Your order ${ref} was collected`,
        [
          delivery
            ? 'Your order was delivered. Enjoy your treats!'
            : 'Thank you for collecting your order. Enjoy your treats!',
        ],
      );
    case 'Cancelled':
      return say(`Your order ${ref} was cancelled`, [
        options.automatic
          ? 'Your order was cancelled automatically because it was not completed within one working day of the date and time you chose.'
          : 'Your order was cancelled.',
        `If you have a question${shop.supportEmail ? `, write to ${shop.supportEmail}` : ', contact us through the website'}.`,
      ]);
    default:
      return null;
  }
}

/** To the customer after their account was deleted at their request. */
export function accountDeletedEmail(
  shop: Shop,
  to: string,
  name: string,
): Email {
  return compose(shop, to, 'Your account was deleted', [
    `Hello ${name},`,
    'As you asked, we deleted your account and removed your name, phone number, saved details and profile picture.',
    'Records of past orders are kept for the shop’s accounts, with your personal details taken out of them.',
    `If you did not ask for this, please contact us${shop.supportEmail ? ` at ${shop.supportEmail}` : ''} straight away.`,
  ]);
}

/** To the shop when a customer places an order. */
export function newOrderEmail(
  order: MailOrder,
  shop: Shop,
  to: string,
  siteUrl: string,
): Email {
  const ref = shortRef(order._id);
  return compose(
    shop,
    to,
    `New order ${ref} from ${order.customer ?? 'a customer'}`,
    [
      `${order.customer ?? 'A customer'} placed a new order. It is waiting to be accepted.`,
    ],
    [
      `Order ${ref}`,
      ...summary(order, shop),
      ...(order.notes ? [`Notes: ${order.notes}`] : []),
    ],
    { label: 'Open the orders', url: `${siteUrl}/account?screen=orders` },
  );
}

export function passwordResetEmail(
  shop: Shop,
  to: string,
  name: string,
  link: string,
): Email {
  return compose(
    shop,
    to,
    `Reset your ${shop.storeName} password`,
    [
      `Hello ${name},`,
      'We received a request to reset your password. Use the button below to choose a new one. The link works once and expires in 1 hour.',
      'If you did not ask for this, you can ignore this email; your password stays as it is.',
    ],
    [],
    { label: 'Choose a new password', url: link },
  );
}
