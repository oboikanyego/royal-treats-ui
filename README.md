# Royal Treats — Dessert Commerce UI

An Angular 20, mobile-first dessert storefront for Royal Treats in Thabazimbi, with staff workspaces for the admin and delivery couriers. It is the front end for [royal-treats-api](https://github.com/oboikanyego/royal-treats-api): products, accounts, orders, prices, stock and images all live there. Nothing about money or stock is decided in the browser.

## Local development

```bash
npm install
npm start             # the deployed API (src/environments/environment.ts)
npm run start:local   # an API on http://localhost:3000 (npm run dev in royal-treats-api)
npm run build         # production build, deployed API
npm run build:local   # build against the local API
npm test              # unit tests (money, API errors, mappers, token storage, messages, orders, admin, courier)
npm run format        # Prettier
```

The Netlify build uses `netlify.toml` (Node 22, `npm run build`, publish `dist/royal-treats-ui/browser`). The API address is in `src/environments/`, and the API must list this site's origin in its `CORS_ORIGINS` (set in Render's Environment tab; the API refuses to start in production without it). Render's free plan sleeps when idle, so the first request after a pause can take about a minute; the menu shows a "waking up the server" notice, reads are retried, and there is a "try again" button.

Loading feedback: a thin bar at the top of the page shows whenever a page change or a request to the API lasts more than 200 ms (quick ones never flash it). A tapped product card shows a spinner and further taps are ignored until the page opens. The code for the menu, product, basket, checkout and orders pages is downloaded in the background once the first page is up (`data: { preload: true }` on the route), so most taps do not wait for a download. Hover effects only apply on devices that really hover (`@media (hover: hover)`): on a phone the first tap on a card whose hover state changes can be swallowed as a hover.

## Customers

- Browse the menu (search, categories, availability filter, sorting), choose sizes, sauces/flavours and toppings, and label each line with a person's name for group orders.
- **Register and sign in** with a full name, email, call number and a password of 12 to 128 characters. **"Keep me signed in on this device"** is ticked by default: the bearer token is then kept in `localStorage` and the API issues a 30-day session, so closing the browser (or a phone dropping the tab) does not sign you out. Untick it on a shared device and the token stays in `sessionStorage` (8-hour session, gone when the tab closes). **Sign out** is a labelled button in the header, the mobile menu and the account page, and removes the token and ends the session on the server. On reload the app checks the token with `GET /me`, and one the server rejects ends the session with a "Your session ended" message. The profile picture is uploaded to the API (JPG, PNG or WebP, up to 2 MB).
- **Checkout** sends the cart without prices (the API prices it from its own catalogue, so the total on the confirmation and in the list is the server's) with an `Idempotency-Key` that is reused if the same order is submitted again after a lost response, so a retry can never create a duplicate. Name and phone come from the account. Collection works for every available product; delivery is for in-stock mini donuts within 5 km (straight line) of the store. Payment is cash on collection or delivery. Known refusals (item out of stock, outside the delivery area or store hours) are shown as plain messages.
- **Privacy Notice and Terms of Use** (`/privacy`, `/terms`, linked in the footer and from registration) are written for POPIA and South African consumer law and quote the shop's name, address and support email from the live settings. **Registering needs an explicit tick** on "I have read the Privacy Notice and the Terms of Use and I agree"; the API requires it and records the time and the version of the texts the customer agreed to (`TERMS_VERSION` in royal-treats-api; keep it in step with `LEGAL_UPDATED` in `src/app/legal.ts` when the wording changes). The texts are a draft written from how the site works; have them reviewed before relying on them.
- **My account** (every role, including admin and courier): change your name and phone number (the email and role cannot be changed), and change your password. Changing the password signs every other device out. An admin who changes their password here keeps it across restarts until a different `ADMIN_PASSWORD` is set on the API.
- **Forgot password**: when the API has email set up (`passwordResetEnabled` in `GET /settings`) the sign-in screen shows "Forgot your password?". The emailed link opens `/reset-password?token=...`; the page removes the token from the address bar, and the link works once and expires in 1 hour. Using it signs every device out. The answer never says whether an address has an account.
- **Overdue orders**: the API cancels an order that is still open one full working day after its scheduled time (same time on the next open day). The customer's My orders page and email say it was cancelled automatically.
- **Phone navigation**: a floating bottom tab bar with drawn icons (the same on iOS and Android) and a slide-in side menu with an account card, backdrop, and Sign out.
- **Admin on phones** is an app of its own: a sticky app bar with the section title, an avatar menu (My account, Sign out) and tabs for Overview, Orders (with the Pending count), Products, Delivery and Settings. The shop header, tabs and footer step aside, and it respects phone safe areas (notch, home bar). Tablets and desktops keep the sidebar.
- **Show / Hide** on every password box (sign-in, registration, add-courier, change-password).
- **My Orders** lists the signed-in customer's orders with a status timeline, refreshes every 30 seconds, groups items by recipient, and tells the customer to contact the shop to change or cancel an order: **only an admin can cancel an order** (the API refuses it for anyone else). `/track` redirects there.

## Admin workspace

For admin accounts (created on the API, not here).

- **Overview**: order totals by status and completed sales from the API's dashboard, plus store hours.
- **Live new-order alerts**: while an admin is signed in the site keeps a Socket.IO connection to the API (admins only; the library is downloaded only for them). A new order raises a toast on whichever page the admin is on, with a short two-tone sound (switchable on the Orders screen, remembered in `localStorage`; after a page reload browsers allow sound only once the admin has clicked something), shows the number of Pending orders on the **Orders** button and in the tab title, and refreshes the Orders list and Overview without waiting. The alert shows the reference, customer name, item count, total and time, never a phone number or address. If the connection is down everything still works on the 30 s refresh.
- **Orders**: every customer's orders, newest first, 30 s refresh, with a status filter that the API applies, so it covers every order (not only the ones loaded). An order moves only along the transitions the API offers in `allowedStatuses`; cancelling asks first. The API's last status, `Completed`, reads as **Collected** for a collection and **Delivered** for a delivery, for customers and staff alike. A delivery that is Ready for Delivery waits for a courier to accept it, or the admin can **assign a courier** from the order card (and reassign one that is already out). Delivery orders have an **Open in Maps** link for the admin and the courier. The header names the screen you are on.
- **Products**: add, edit, sold out / restock. Prices are entered in rand and sent as cents; sizes, sauces/flavours and toppings are editable.
- **Product photos are uploaded as files only.** There is no image-URL field: the chosen JPG, PNG or WebP (up to 5 MB) is sent to the API, which re-encodes it and stores it in Cloudinary, and the product keeps the URL it returns. A product that still has an older photo keeps it unless a new file is uploaded. If Cloudinary is not configured on the API the editor says uploads are not set up.
- **Delivery team**: add a courier (12+ character password), deactivate (which also signs them out) or reactivate.
- **Settings** (a stack of cards: pause orders, shop, opening hours, contact, delivery): store name, address, support email, and **opening hours for each weekday** with closed days (checkout then offers only that day's times and says when the shop is closed). **Pause orders** switches new orders off with an optional message: customers see a banner on every page, the place-order button is disabled, and the API refuses orders too; orders already placed are unaffected. There are no coordinate fields: when the address changes, the admin page looks it up on OpenStreetMap (the address only, South Africa only) and saves the point it finds, because the API measures the fixed 5 km delivery area from it. An address that cannot be found is refused, so deliveries are never measured from the wrong place; a link shows the point on the map.

## Courier workspace

For courier accounts (created by the admin).

- **Available jobs**, soonest first, refreshed every 30 s. The API shows only the due time and distance until a job is accepted, so no customer details appear before that. The first courier to accept gets the job; losing a race gives a plain message.
- **My deliveries** with the customer's name, a tap-to-call phone link, address, items by recipient, notes and the cash to collect. **Mark delivered** asks for confirmation and is offered only when the API's `allowedStatuses` allows it.

## Support

No messaging integrations and no owner phone numbers are shown publicly. The support page composes a `mailto:` message to the **support email an admin configured**; this site does not send email itself; order and password-reset emails are sent by the API (Resend), see royal-treats-api.

## Security notes

- Roles are enforced by the API; the UI only hides what a role cannot use. The API refuses admin and courier calls from other roles.
- Passwords are sent to the API over HTTPS and stored hashed there. The token lives in `localStorage` (kept) or `sessionStorage` (tab only), never in a cookie.
- Prices, stock, delivery distance and store hours are checked by the API on every order; the checks in the browser only save a round trip.
- Not yet built: online/EFT payment, SMS/WhatsApp messages, and driving-distance (rather than straight-line) delivery checks.

## Formatting and CI

- `npm run format` formats TypeScript, templates and styles with Prettier; `npm run format:check` verifies it.
- Pull requests run `.github/workflows/pr-build.yml`: unit tests, then a build against the deployed API and a build against a local API.
