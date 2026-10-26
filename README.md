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
