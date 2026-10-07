# Model dimensions

One model unit is one metre. Use a nominal hexagonal tile radius of 10 metres: 20 metres between opposite corners and about 17.32 metres between opposite edges. Planet tiles vary slightly in shape and size.

Models use Y up in GLB. Place the ground contact at local Y = 0 and set the origin to the intended placement point. Root scene translation is ignored on import; relative part positions, rotation, and scale are retained.

The editor displays models in metres. Its Hexagon guide shows the 10-metre radius at the model origin. The game applies one shared metres-to-planet conversion and divides by planet resolution. There are no per-model size multipliers or random size changes.

Placement uses the authored origin at the surface. Import and extraction must not center meshes by their bounds, move their lowest vertex to ground, or add sinking/lifting offsets. Camera framing may center the view without modifying the model.
