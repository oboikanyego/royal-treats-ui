# Royal Treats — Dessert Commerce UI

An Angular 20, mobile-first dessert storefront and demonstration admin workspace for Royal Treats in Thabazimbi. **Frontend-only:** products, user profiles, orders, uploaded images and settings are stored in each device's browser for demonstration.

## Local development

```bash
npm install
npm run format
npm run build
npm start
```

The Netlify build uses `netlify.toml` (Node 22, `npm run build`, publish `dist/royal-treats-ui/browser`).

## Demo mode and API mode

The default build is the browser-only demo described below. A second mode loads the **catalogue and business settings** from [royal-treats-api](https://github.com/oboikanyego/royal-treats-api) instead of `localStorage`:

```bash
npm run start:live    # use the deployed API (src/environments/environment.live.ts)
npm run start:local   # use an API on http://localhost:3000 (npm run dev in royal-treats-api)
npm run build:live    # production build in API mode
npm test              # unit tests (money, API errors, mappers, token storage, auth messages, orders, admin)
```

API mode is **in progress and off by default**. Today it covers the public catalogue, **customer accounts**, **customer orders** and the **admin workspace**:

- **Catalogue and settings:** products (prices converted from cents, sauces/toppings as options) and store settings, with a "waking up the server" banner for a slow first request, retries for network and gateway failures, and a "try again" button.
- **Sign-in:** register, sign in and sign out against the API. The bearer token is kept in **`sessionStorage`** (it survives a refresh of the tab, is gone when the tab closes, and is never put in `localStorage`); on reload the app checks it with `GET /me`. A token the server rejects ends the session with a "Your session ended" message. Passwords must be 12 to 128 characters, as the API requires, and the profile picture is uploaded to the API (JPG, PNG or WebP, up to 2 MB).
- **Checkout and My Orders:** the order is sent without prices (the API prices it from its own catalogue, so the total on the confirmation and in the list is the server's), with an `Idempotency-Key` that is reused if the same order is submitted again after a lost response, so a retry can never create a duplicate. Name and phone come from the account. Known API refusals (item out of stock, outside the delivery area or store hours) are shown as plain messages. **My Orders** replaces guest tracking: it lists the signed-in customer's orders with a status timeline, refreshes every 30 seconds, groups items by recipient, and offers "Cancel order" only while the API's `allowedStatuses` says it is allowed (a Pending order). `/track` redirects there.
- **Admin workspace** (admin accounts): an overview from the API's dashboard; **orders** (all customers, newest first, 30 s refresh) moved only along the transitions the API offers in `allowedStatuses`, with a confirmation before cancelling; **products** (add, edit, sold out / restock) with sizes and prices in rand (sent as cents) and the sauce/flavour and topping choices; **delivery team** (add a courier, deactivate or reactivate, which also signs them out); and **settings** (hours, address, support email, store coordinates; the 5 km radius is fixed by the API).
- **Product photos are uploaded as files only.** There is no image-URL field: the chosen JPG, PNG or WebP (up to 5 MB) is sent to the API, which re-encodes it and stores it in Cloudinary, and the product keeps the URL it returns. A product that still has an older photo keeps it unless a new file is uploaded. If Cloudinary is not configured on the API the editor says uploads are not set up.

Still on the browser demo: the courier tools. Courier accounts can sign in, but their workspace shows a "being connected" notice instead of the demo data. The API address is in `src/environments/`, and the API must list this site's origin in its `CORS_ORIGINS` (set in Render's Environment tab).

## Customer storefront

- Branded first-visit donut loader with skip action and reduced-motion support
- Responsive product cards, search, categories, availability-only filter, sorting and eight-item pages
- Product variations, flavours and toppings
- Group orders: label each line with a person's name; put multiple people's items through one checkout
- Customers register with full name, email, required call number and a **demo-only** password
- Signed-in profiles with styled image upload, resized to a small square and stored in the browser
- Collection for all available products; delivery for **in-stock mini donuts only** within 5 km straight-line distance of a configured store location
- Cash on collection or delivery; **no EFT/online checkout yet**
- Order tracking inside the browser

## Business support — email only

No messaging integrations and no owner phone numbers are displayed publicly. The support page uses the **business support email configured by an admin**, if available. A user composes a subject and message, and `mailto:` opens their own email application; the frontend **does not transmit emails**. No real support address is assumed or hardcoded.

## Admin & delivery workspace

Demo admin credentials: `admin@royaltreats.demo` / `Demo@12345`. This is intentionally a public demo credential and is **not suitable for production**.

- Dark-sidebar operations dashboard for orders, catalogue, couriers and business settings
- Product onboarding and editing with modal, photo picker and preview, category, prices, variants, stock and delivery eligibility
- Stock-state confirmation dialogs
- Business address, geographical coordinates, operating times and optional support email
- Courier registration and a browser-local available/assigned job queue
- Staff can see recipient labels attached to shared orders

## Important data and security limitations

**Do not enter real customer data, real passwords or real identity documents into this demo.** Passwords and account details are stored unencrypted in `localStorage`; visitors can alter local data, and there is no server-side authentication, authorization, shared database, or reliable multi-device order synchronization. Image files are stored as browser-local data URLs; sizes are limited to reduce quota problems. The 5 km restriction uses device geolocation and straight-line Haversine distance, not a server-verified driving route. Email contact launches a local mail app rather than sending email through the site.

Production requires a secure API/database, authenticated accounts and permissions, server-side stock/fulfilment checks, validated media uploads, persistent orders and courier assignment, proper support email delivery, and POPIA-aware handling of personal information.

## Formatting

- `npm run format` — format TypeScript/Angular templates and styles with Prettier
- `npm run format:check` — verify source formatting

The GitHub workflow also formats and builds on updates to `main`.
