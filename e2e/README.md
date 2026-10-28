# Browser tests

Playwright suites that drive the real site in Chromium (phone-sized and desktop) against a
**contract-faithful mock of the API**. The mock runs royal-treats-api's own validation, pricing and
order rules, with data in memory, so no database, Cloudinary or email service is needed.

```
npm install                 # the site's own dependencies (once, in the repo root)
npm install --prefix e2e    # this folder's dependencies (once)
npx --prefix e2e playwright install chromium
npm run e2e                 # builds the site (local API config), starts the mock and the site, runs every suite
node e2e/run.mjs 04 admin   # only suites whose file name contains a word
E2E_SKIP_BUILD=1 npm run e2e   # reuse the build in e2e/.dist
```

Each suite prints `PASS`/`FAIL` lines; the runner fails on any `FAIL`, any crash, or a suite with no
passing check, and keeps the logs of failed suites in `e2e/test-output`. CI runs the same command on every
pull request (`.github/workflows/e2e.yml`).

## The API contract

`api-snapshot/` holds verbatim copies of the API files the mock imports (see its README for the commit).
When the API's contract changes (settings, order rules, validation), refresh it in the same PR:

```
npm run sync-api --prefix e2e -- ../../royal-treats-api
```

To try against a live API checkout without copying: `API_SRC=../royal-treats-api/src npm run e2e`.

## Adding a suite

Copy a small suite (for example `06-storage-cleanup.js`), keep the `ok(condition, message)` helper that prints
`PASS`/`FAIL`, and read the addresses from `process.env.UI_URL` / `process.env.API_URL`. The mock's
behaviour switches (`POST /__mode`, `/__flag`) are documented at the top of `mock-api.mjs` and used by the
existing suites. Suites share one mock, so each starts by resetting it (`POST /__mode` with `{}`).
