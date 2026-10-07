import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
c=json.loads((root/'public/blue-home.json').read_text())
s='pub const SURFACE_COLORS: [[f32;4];3] = '+str([b['color'] for b in c['surfaces']])+';\n'
s+='pub const CLIFF_COLORS: [[f32;4];3] = '+str([b['cliff'] for b in c['surfaces']])+';\n'
s+='pub const SURFACE_WATER: [bool;3] = ['+', '.join(str(b['water']).lower() for b in c['surfaces'])+'];\n'
s+='pub const WATER_COLOR: [f32;4] = '+str(c['water']['color'])+';\n'
s+=f"pub const WATER_LEVEL: f32 = {c['water']['heightInLevels']};\npub const LAND_VARIATION: f32 = {c['landVariation']};\npub const SEED: u32 = {c['seed']};\n"
(root/'core/src/blue.rs').write_text(s)
