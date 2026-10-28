import mongoose, { Schema } from 'mongoose';
const options = { timestamps: true, versionKey: false } as const;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'admin', 'courier'],
      default: 'customer',
      required: true,
    },
    active: { type: Boolean, default: true },
    /** When and to which version of the privacy notice and terms a customer agreed at sign-up. */
    termsAcceptedAt: Date,
    termsVersion: String,
    /** Digest of the ADMIN_PASSWORD last applied from the environment (see admin-bootstrap.ts). */
    envPasswordDigest: { type: String, select: false },
    photo: { type: Buffer, select: false },
  },
  options,
);
export const User = mongoose.model('User', userSchema);
export const Session = mongoose.model(
  'Session',
  new Schema(
    {
      tokenHash: { type: String, unique: true, required: true },
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    options,
  ),
);
/** A one-time, 1-hour password reset. Only a digest of the token is stored; the document expires itself. */
export const PasswordReset = mongoose.model(
  'PasswordReset',
  new Schema(
    {
      tokenHash: { type: String, unique: true, required: true },
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    options,
  ),
);
export const Product = mongoose.model(
  'Product',
  new Schema(
    {
      _id: String,
      name: { type: String, required: true },
      category: { type: String, required: true },
      description: String,
      image: String,
      available: { type: Boolean, default: true },
      deliverable: { type: Boolean, default: false },
      variants: [
        {
          _id: false,
          label: { type: String, required: true },
          priceCents: { type: Number, required: true, min: 0 },
        },
      ],
      sauces: [String],
      toppings: [String],
    },
    options,
  ),
);
export const Settings = mongoose.model(
  'Settings',
  new Schema(
    {
      _id: { type: String, default: 'business' },
      storeName: { type: String, default: 'Royal Treats' },
      address: { type: String, default: '34 10th Avenue, Thabazimbi' },
      supportEmail: { type: String, default: '' },
      open: { type: String, default: '10:00' },
      close: { type: String, default: '23:00' },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      radiusKm: { type: Number, default: 5 },
      ordersPaused: { type: Boolean, default: false },
      pauseMessage: { type: String, default: '' },
      weeklyHours: {
        type: [
          {
            _id: false,
            closed: { type: Boolean, default: false },
            open: String,
            close: String,
          },
        ],
        default: undefined,
      },
    },
    options,
  ),
);
/** Editable documents, like the receipt template: one record per name, seeded when the service starts. */
export const Template = mongoose.model(
  'Template',
  new Schema(
    {
      _id: String,
      html: { type: String, required: true },
    },
    options,
  ),
);
const orderSchema = new Schema(
  {
    _id: String,
    customerId: { type: Schema.Types.ObjectId, required: true, index: true },
    customer: String,
    phone: String,
    fulfillment: {
      type: String,
      enum: ['collection', 'delivery'],
      required: true,
    },
    address: String,
    latitude: Number,
    longitude: Number,
    distanceKm: Number,
    date: String,
    time: String,
    notes: String,
    payment: String,
    totalCents: { type: Number, required: true },
    status: { type: String, default: 'Pending', index: true },
    courierId: { type: Schema.Types.ObjectId, index: true },
    idempotencyKey: { type: String, required: true },
    requestHash: String,
    items: [
      {
        _id: false,
        productId: String,
        name: String,
        variant: String,
        qty: Number,
        priceCents: Number,
        sauce: String,
        topping: String,
        recipient: String,
      },
    ],
    history: [
      { _id: false, status: String, actorId: String, at: Date, note: String },
    ],
  },
  options,
);
orderSchema.index({ customerId: 1, idempotencyKey: 1 }, { unique: true });
export const Order = mongoose.model('Order', orderSchema);
export async function connectDatabase(uri: string) {
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([
    User.init(),
    Session.init(),
    PasswordReset.init(),
    Product.init(),
    Settings.init(),
    Template.init(),
    Order.init(),
  ]);
}
