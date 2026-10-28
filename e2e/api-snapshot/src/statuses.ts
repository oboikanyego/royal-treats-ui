/** Every status an order can have, in the order it normally moves through them. */
export const ORDER_STATUSES = [
  'Pending',
  'Confirmed',
  'Preparing',
  'Ready for Collection',
  'Ready for Delivery',
  'Out for Delivery',
  'Completed',
  'Cancelled',
] as const;
