# Housing density and neighboring tile overlap

Implement visual housing density in the tile editor and game using the same placement code. This is an implementation plan; gameplay behavior is unchanged until the work below is completed.

## Agreed behavior

| Adjacent urban tiles | Housing density |
| --- | --- |
| 0–3 | Low |
| 4–5 | Medium |
| 6 | High |

Count adjacent buildings with the urban attribute, including Commons. Do not calculate distance from the village outskirts. Neighbor count is independent of roads and utility coverage. A pentagon has at most five neighbors and therefore reaches medium density under these thresholds.

The number of visible cottages is purely cosmetic. It must not alter housing capacity, residents, needs, workforce, construction costs, or on-chain state.

An arrangement may visibly reshuffle when neighboring development changes. Results must be deterministic for the same planet, buildings, facings, composition configuration, and model geometry.

The principal overlap requirement is between cottages on different tiles. Two overlapping candidates cannot both appear. Same-tile checks should also prevent intersections, but optional overlapping slots on one tile are not the main design objective.

Road design is separate. Editable feature edges and corners are also separate work and should not be bundled into this implementation.

## Composition authoring

Extend fixed entries with density eligibility: low, medium, and high. An entry can belong to more than one band. Existing entries default to all bands so loading a configuration does not remove its houses.

Keep each slot's stable ID, model, appearance, position, rotation, random rotation range, and scale. Model alternatives and whole-layout variants can be added later; they are not required for this first implementation.

Only house slots explicitly marked to participate in building overlap checks compete. Trees, grass, and decorative props must not accidentally suppress cottages. Reuse the existing prop and grass exclusion behavior separately.

Generate a footprint from the model geometry, with a visible editor overlay. Use a projected polygon or oriented bounds rather than the existing circular scatter radius. Keep clearance small and configurable. Include vertical bounds so buildings on separate height levels are not rejected solely because their plan-view footprints overlap. Reimporting a model invalidates its derived footprint.

## Deterministic placement

1. Read building occupancy, urban flags, tile adjacency, heights, and stored facings.
2. Assign each housing tile its density band.
3. Generate eligible candidates using the shared composition generator. Apply saved facing and all slot transforms before testing overlap.
4. Give each candidate a stable priority derived from planet seed, tile ID, and slot ID. Use IDs as a final tie-breaker. Never use frame timing, iteration order, or a fresh random draw during regeneration.
5. Use spatial bounds to find potentially intersecting candidates, including those across tile boundaries. Do not assume neighboring tile centers are enough to bound oversized models.
6. Compare footprints in a shared coordinate frame. Account for the spherical building deformation used by the renderer and vertical separation. Reserve occupied space for non-housing buildings rather than hiding those buildings to accommodate a cottage.
7. Process candidates once in priority order, accepting a candidate only if it does not intersect an already accepted candidate or reserved building footprint.
8. Send accepted objects to the existing model/material instance groups.

The first pass prioritizes deterministic, nonintersecting results over maximizing the number of accepted cottages. Do not add a convergence loop or an iterative packing solver.

## Refresh dependencies

Cache candidate generation separately from conflict resolution. A build, demolition, or facing change invalidates the changed tile and the housing tiles whose neighbor counts changed. Reimports and composition edits invalidate users of the affected models or configurations.

Conflict effects can travel farther than one neighbor ring: accepting one cottage can suppress another, which can allow a third. A one-ring-only refresh is therefore insufficient in general.

Maintain a candidate conflict graph. Resolve affected connected components in one deterministic priority pass, including suppressed candidates and both the previous and updated graph connections. This handles components that split after demolition as well as components that merge after construction. Isolated tiles and unaffected components remain cached.

A densely connected village may require a larger component refresh. Measure that case instead of promising a fixed one-ring cost. Only render groups whose accepted objects changed should be marked dirty. Keep the work client-side and event-driven, not per frame.

## Editor controls

Add density checkboxes to housing slots and a footprint overlay for selected objects. Show accepted cottages normally and optionally show suppressed candidates as translucent outlines with their conflict reason.

Provide six individual neighbor toggles and retain the height-difference control. The automatic preview derives density from the toggles; an explicit low/medium/high override helps author each band without changing the saved composition.

Preview the center and neighboring arrangements together through the same resolver as the game. Test per-tile facings, not only identically oriented neighbors. Preserve undo/redo, placement handles, model replacement recovery, and saved model references.

Neighbor tiles containing Commons or another urban building should count toward density and reserve their actual footprints. They do not acquire housing cottages merely by being urban.

## Game integration

Apply density only to housing compositions. Read the generic urban attribute for neighbor counting rather than hardcoding pairs of building types.

Retire the separate shared-edge cottage spawns for housing when enabling density-based housing; otherwise both mechanisms would add cottages. Preserve the authored connection configuration data until a deliberate migration is applied. Roads and future edge compositions can use a separate connection system.

Use the stored building facing for the entire arrangement. Random facing selection occurs during placement and is already passed into the saved building state; regeneration must not reroll it.

The placement ghost should use the proposed building state and show the prospective arrangement. Reconciliation and demolition must produce the same arrangement as loading that final state from scratch.

## Relevant files

- public/tile-composition.js: composition schema, validation, fixed and scattered candidate generation.
- public/composition-references.js: missing model detection and replacement.
- public/composition-models.js: model geometry and appearances.
- public/composition-runtime.js: game composition generation and instance groups.
- public/industry.js: building visual lifecycle, stored facing, and occupancy changes.
- public/urban-connections.js: urban adjacency and existing connection placement.
- public/building-wrap.js: spherical deformation and bounds.
- public/editor/tile-editor.js: composition controls and preview.
- public/editor/tile-connections.js: current preview connections.
- public/editor/tile-terrain.js: preview terrain and height transitions.
- public/model-units.js: scale and edge-facing tile coordinates.
- public/configs/tile-compositions.json: saved authoring data; preserve user edits.

## Implementation sequence

1. Add density fields with backward-compatible defaults and pure neighbor-count tests.
2. Build footprint extraction, transformed overlap checks, and a deterministic candidate resolver with synthetic two-tile and three-tile fixtures.
3. Add editor controls and diagnostics. Validate one authored housing composition at all three densities.
4. Integrate candidate caching, conflict-component refresh, and instance-group updates in the game.
5. Disable redundant shared-edge housing visuals when density is enabled, then verify ghosts, construction, demolition, and reloads.

## Acceptance checks

- Neighbor counts 0–3, 4–5, and 6 select the correct bands; Commons count as urban and non-urban industry does not.
- Pentagons never request a nonexistent sixth neighbor or facing.
- Boundary-crossing cottages cannot intersect across two or three tiles, including rotated arrangements.
- Same-state regeneration, different traversal orders, and reloads produce identical accepted candidate IDs and transforms.
- A chain of overlapping candidates resolves correctly after both addition and removal; incremental results match a full rebuild.
- Unequal heights, irregular equal-area tiles, spherical wrapping, and model scale are covered by geometry tests.
- The editor and game agree on eligibility and conflict results for equivalent inputs.
- Existing configurations remain valid; missing-model recovery and undo/redo preserve density fields.
- Population and production state remain unchanged by density selection.
- Measure construction and demolition refresh time in a dense village and verify only changed render groups rebuild.

Start implementation with the schema and pure resolver tests. Do not modify saved housing arrangements merely to make a test pass.
