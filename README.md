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
- **Register and sign in** with a full name, email, call number and a password of 12 to 128 characters. The bearer token is kept in **`sessionStorage`** (it survives a refresh of the tab, is gone when the tab closes, and is never put in `localStorage`); on reload the app checks it with `GET /me`, and a token the server rejects ends the session with a "Your session ended" message. The profile picture is uploaded to the API (JPG, PNG or WebP, up to 2 MB).
- **Checkout** sends the cart without prices (the API prices it from its own catalogue, so the total on the confirmation and in the list is the server's) with an `Idempotency-Key` that is reused if the same order is submitted again after a lost response, so a retry can never create a duplicate. Name and phone come from the account. Collection works for every available product; delivery is for in-stock mini donuts within 5 km (straight line) of the store. Payment is cash on collection or delivery. Known refusals (item out of stock, outside the delivery area or store hours) are shown as plain messages.
- **My Orders** lists the signed-in customer's orders with a status timeline, refreshes every 30 seconds, groups items by recipient, and offers "Cancel order" only while the API's `allowedStatuses` allows it (a Pending order). `/track` redirects there.

## Admin workspace

For admin accounts (created on the API, not here).

- **Overview**: order totals by status and completed sales from the API's dashboard, plus store hours.
- **Live new-order alerts**: while an admin is signed in the site keeps a Socket.IO connection to the API (admins only; the library is downloaded only for them). A new order raises a toast on whichever page the admin is on, with a short two-tone sound (switchable on the Orders screen, remembered in `localStorage`; after a page reload browsers allow sound only once the admin has clicked something), shows the number of Pending orders on the **Orders** button and in the tab title, and refreshes the Orders list and Overview without waiting. The alert shows the reference, customer name, item count, total and time, never a phone number or address. If the connection is down everything still works on the 30 s refresh.
- **Orders**: every customer's orders, newest first, 30 s refresh, with a status filter. An order moves only along the transitions the API offers in `allowedStatuses`; cancelling asks first. The API's last status, `Completed`, reads as **Collected** for a collection and **Delivered** for a delivery, for customers and staff alike. A delivery that is Ready for Delivery waits for a courier to accept it.
- **Products**: add, edit, sold out / restock. Prices are entered in rand and sent as cents; sizes, sauces/flavours and toppings are editable.
- **Product photos are uploaded as files only.** There is no image-URL field: the chosen JPG, PNG or WebP (up to 5 MB) is sent to the API, which re-encodes it and stores it in Cloudinary, and the product keeps the URL it returns. A product that still has an older photo keeps it unless a new file is uploaded. If Cloudinary is not configured on the API the editor says uploads are not set up.
- **Delivery team**: add a courier (12+ character password), deactivate (which also signs them out) or reactivate.
- **Settings**: store name, hours, address, support email and coordinates. The 5 km radius is fixed by the API.

## Courier workspace

For courier accounts (created by the admin).

- **Available jobs**, soonest first, refreshed every 30 s. The API shows only the due time and distance until a job is accepted, so no customer details appear before that. The first courier to accept gets the job; losing a race gives a plain message.
- **My deliveries** with the customer's name, a tap-to-call phone link, address, items by recipient, notes and the cash to collect. **Mark delivered** asks for confirmation and is offered only when the API's `allowedStatuses` allows it.

## Support

No messaging integrations and no owner phone numbers are shown publicly. The support page composes a `mailto:` message to the **support email an admin configured**; this site does not send email.

## Security notes

- Roles are enforced by the API; the UI only hides what a role cannot use. The API refuses admin and courier calls from other roles.
- Passwords are sent to the API over HTTPS and stored hashed there. The token lives only in `sessionStorage`.
- Prices, stock, delivery distance and store hours are checked by the API on every order; the checks in the browser only save a round trip.
- Not yet built: online/EFT payment, automatic confirmation emails or messages, and driving-distance (rather than straight-line) delivery checks.

## Formatting and CI

- `npm run format` formats TypeScript, templates and styles with Prettier; `npm run format:check` verifies it.
- Pull requests run `.github/workflows/pr-build.yml`: unit tests, then a build against the deployed API and a build against a local API.
