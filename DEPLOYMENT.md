# Deployment

Use Node 24 and run `npm ci`, then `npm run build:web`. The `dist/` directory contains the static game, shared wallet modules, protocol bindings and WebAssembly engine. Model editor pages are excluded.

The browser discovers the delegated sponsor's ER endpoint, reads planet accounts, builds transactions, signs with its local session key and submits directly to the ER. The main wallet signs a message when authorizing a session or resetting a colony. It never signs gameplay transactions.

`POST /api/chain/sign` validates the wallet's signed authorization, session signature and exact permitted transaction before adding the sponsor signature. The signer performs no RPC reads or transaction submissions. The sponsor secret must only exist in the server or Worker secret store.

## Cloudflare Pages

1. Run `npm run deploy:check` to compile the Pages Functions and package static assets without publishing.
2. Set `PUBLIC_ORIGIN` in `wrangler.jsonc` to `https://interstellar-industries.pages.dev`.
3. Configure `INTERSTELLAR_ADMIN_SECRET` with `wrangler pages secret put INTERSTELLAR_ADMIN_SECRET --project-name interstellar-industries`. Its value is the JSON byte array for the admin key identified by `public/chain-config.js`. Never commit it.
4. Run `npm run deploy`. The production branch is `main`.
5. Open the hosted game, connect a wallet and verify returning to an existing colony. Static files and the signing endpoint must share the configured origin.

## Local Node server

Run `npm run dev`. Development uses `~/keys/interstellar_admin.json` unless `INTERSTELLAR_ADMIN_KEY` or `INTERSTELLAR_ADMIN_SECRET` is supplied. For production, set `PUBLIC_ORIGIN` and one of those secret settings, then run `npm start`. Production disables editor mutation endpoints and editor HTML pages.

## Shared Rust engine

For source builds, place `interstellar-industries-program` beside this repository. Run `npm run sync:protocol` after changing the program's JavaScript protocol bindings. `build.sh` builds the shared Rust/WASM engine and runs gameplay tests; hosting the prebuilt game only requires `npm run build:web`.

## Validation

`npm run test:browser-chain` checks authorization, session-only transaction signing, sponsor transaction restrictions, direct account decoding and router connection caching without spending funds. `tests/wallet-api.mjs` is a live test using the persisted program test wallet; it closes its planet and engine accounts in a `finally` block and reports sponsor balance changes.
