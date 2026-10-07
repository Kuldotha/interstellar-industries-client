#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 tools/compile_blue.py
node tools/export-preview-terrain.mjs
cargo test --manifest-path core/Cargo.toml
cargo build --release --target wasm32-unknown-unknown --manifest-path core/Cargo.toml
cp "${CARGO_TARGET_DIR:-core/target}/wasm32-unknown-unknown/release/planet_geometry.wasm" public/planet_geometry.wasm
node tests/wasm.mjs
node tests/shared-generation.mjs

node tests/camera.mjs

node tests/coast.mjs

node tests/picking.mjs

node tests/industry.mjs

node tests/building-status.mjs

node tests/simulation-clock.mjs

node tests/building-wrap.mjs

node tests/building-bounds.mjs

node tests/prop-groups.mjs

node tests/housing-cluster.mjs

node tests/ground-cover.mjs

node tests/commons.mjs

node tests/housing-upgrade.mjs

node tests/utility-coverage.mjs

node tests/construction-costs.mjs

node tests/tile-highlights.mjs

node tests/water-geometry.mjs

node tests/object-coast.mjs

node tests/progression.mjs

node tests/deposits.mjs

node tests/deposit-cutout.mjs

node tests/tile-terrain.mjs

node tests/tile-orientation.mjs

node tests/tier-one.mjs

node tests/farms-power.mjs

node tests/generator-modules.mjs
