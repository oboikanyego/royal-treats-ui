# Royal Treats UI

Angular 20 frontend prototype for Royal Treats dessert pre-orders. Hosted on Netlify Free. All demo state is browser-local; **there is no backend, real authentication, payment processing, or cross-device sync**.

## Start

```bash
npm install
npm run format
npm run build
npm start
```

## Customer experience

- Register with full name, email, required call number, optional WhatsApp number and demo password
- Sign in, browse seeded products, customise sizes/flavours/toppings, and place an order
- Pre-order time slots follow the configurable business hours (initially 10:00–23:00)
- Sold-out products cannot be added or checked out
- Collection for all available products, cash on collection
- Delivery for **in-stock mini donuts only**, cash on delivery, subject to a **5 km straight-line radius**
- Address plus device geolocation are required for delivery
- Order tracking in the same browser

## Admin demo

Sign in using **admin@royaltreats.demo** and **Demo@12345**. This account is only for UI demonstrations, not for production.

- Add and edit products, pack sizes and prices; upload small image files or enter an image URL
- Set products in or out of stock, enable donut delivery
- Register, activate and deactivate delivery personnel
- Configure business opening and closing times and the store's address and coordinates
- View and update order statuses (including Ready for Delivery)

**Store coordinates must be set by the admin using a device physically at the store** (or entered accurately). Until then delivery checkout is disabled.

## Courier demo

The admin creates a delivery-person account. Sign out, then sign in with the courier account on the **same browser**. When admin marks an eligible order Ready for Delivery, a courier may accept the job, see its details and mark it delivered.

## Demo-only limitations and security

- Passwords and profile data are stored in localStorage **in plaintext**. Use fake details only; do not enter real personal information or reuse actual passwords.
- No actual access control: browser storage can be modified by visitors. The public demo admin credentials are not secure.
- localStorage is per browser/device. Admin, courier and customer data won't automatically synchronise between phones.
- Uploaded product images are saved as browser-local data URLs. Use images smaller than 400 KB; browser storage can fill quickly.
- Distances use Haversine straight-line measurement, not driving distance. GPS accuracy, eligibility and delivery dispatch must be validated again in the future backend.
- There is no EFT option yet. Checkout displays cash on collection/delivery only.
- The app is **not ready to handle real orders or personal data** until backend authentication, authorization, database storage and validation have been implemented.

## Deployment

Netlify configuration in `netlify.toml`: Node 22, build `npm run build`, publish `dist/royal-treats-ui/browser`.

## Formatting

Run `npm run format` (Prettier) or `npm run format:check`.
