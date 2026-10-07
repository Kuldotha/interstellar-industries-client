# Interstellar Industries

A browser colony-building game with a shared Rust simulation running in WebAssembly and on Solana's MagicBlock Ephemeral Rollup. Build housing, satisfy population needs, establish production chains and supply electricity on a spherical planet.

## Run locally

Use Node 24. Run `npm ci`, then `npm run dev`, and open `http://127.0.0.1:8768/`.

The development signer reads `~/keys/interstellar_admin.json`, or the path specified by `INTERSTELLAR_ADMIN_KEY`. The game uses the public devnet configuration in `public/chain-config.js`. The admin secret is required only for authorizing new sessions, planet creation and resets; ordinary gameplay uses the browser session key directly on the rollup.

## Architecture

- `public/`: browser renderer, UI, assets and compiled WebAssembly.
- `core/`: Rust planet geometry and browser bindings to the shared simulation.
- `public/chain-browser.js`: rollup discovery, direct account reads and transaction construction/submission.
- `worker/`: Cloudflare sponsor-signature endpoint.
- `server/`: local server and development tools.
- `tests/`: rendering, gameplay and authorization checks.

The shared production runtime and deterministic planet generation crates live in the sibling `interstellar-industries-program` repository. Place both projects in the same parent directory to rebuild Rust/WASM. Run `./build.sh` for the full client build and `npm run sync:protocol` to update the protocol bindings from that repository.

## Deployment

Run `npm run build:web` to package the static game, or `npm run deploy:check` to validate the Cloudflare deployment bundle. See [DEPLOYMENT.md](DEPLOYMENT.md) for signing secrets and deployment configuration.

## Tests

`npm run test:browser-chain` tests wallet message authorization, session-key transactions, constrained sponsor signing and direct account decoding without creating on-chain accounts or spending funds.

Live tests are separate and use a persisted test wallet. They close their planet accounts and report sponsor balance changes.

## Licence

Copyright (c) 2026 Kuldotha. All rights reserved.

Source published for review. No licence to reuse, modify, redistribute, or commercially exploit this software or its associated original assets is granted, except as permitted by applicable law or the repository hosting platform’s terms. Written permission is required for other uses. See [LICENSE](LICENSE).

Third-party dependencies and assets retain their respective licences.
