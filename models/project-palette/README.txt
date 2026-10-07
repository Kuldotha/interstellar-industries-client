INTERSTELLAR MATERIAL PALETTE

256 swatches, 16 columns x 16 rows. 1024 x 1024 pixels. Each swatch is 64 x 64 pixels.
Rows 1–11: warm neutrals, stone, earth/bark, meadow, forest, cream, teal,
slate blue, ochre, terracotta and plum. Each row runs dark to light.
Rows 12–14: matching metals in brushed, polished and worn finishes.
Row 15: emission colors. Row 16: eight opaque glass colors, then eight transparent glass colors.

reference.html labels each material and its UV center.
manifest.json contains exact source RGB values, their color space, material properties and UV centers.

UV0: position faces inside a palette swatch.
UV2: shared ambient occlusion. V = 0.5.
U <= 0.4375: black. U >= 0.5625: white. Linear transition between them.
Coordinates beyond 0..1 are supported with Clamp addressing.
Long white/black extensions allow a short transition on a large face.
Faces can have separate UV2 coordinates at shared geometric vertices.
An independent enclosed shadow within a face needs additional geometry or another mask.

base-color.png: sRGB color.
metallic.png, roughness.png: linear scalar maps.
orm.png: R = 1, G = roughness, B = metallic. Linear.
emission.png: sRGB emissive color.
opacity.png: linear opacity, white = opaque.
transmission.png: linear transmission, white = full transmission.
ao-gradient.png: linear shared AO ramp. Bilinear filtering, no mipmaps, Clamp addressing.

Opaque reflective glass uses the same palette material as other opaque surfaces.
Transparent glass requires a separate transparent material/pass.
AO affects ambient lighting; direct illumination stays independent.

Model import settings: paletteRows must match the atlas used when exporting.
Use paletteRows = 16 for this atlas. aoUV2 = "gradient" accepts authored TEXCOORD_1 coordinates.
