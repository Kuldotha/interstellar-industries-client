mod industry;
mod props;
use std::{cell::RefCell, collections::BTreeMap};

#[derive(Clone, Copy, Debug, Default)]
struct V(f32, f32, f32);
impl V {
    fn add(self, b: Self) -> Self {
        Self(self.0 + b.0, self.1 + b.1, self.2 + b.2)
    }
    fn sub(self, b: Self) -> Self {
        Self(self.0 - b.0, self.1 - b.1, self.2 - b.2)
    }
    fn scale(self, s: f32) -> Self {
        Self(self.0 * s, self.1 * s, self.2 * s)
    }
    fn dot(self, b: Self) -> f32 {
        self.0 * b.0 + self.1 * b.1 + self.2 * b.2
    }
    fn cross(self, b: Self) -> Self {
        Self(
            self.1 * b.2 - self.2 * b.1,
            self.2 * b.0 - self.0 * b.2,
            self.0 * b.1 - self.1 * b.0,
        )
    }
    fn unit(self) -> Self {
        self.scale(1.0 / self.dot(self).sqrt())
    }
    fn lerp(self, b: Self, t: f32) -> Self {
        self.scale(1.0 - t).add(b.scale(t))
    }
}
include!("base.rs");
thread_local! { static WORLD_SEED: std::cell::Cell<u32> = std::cell::Cell::new(SEED); }
#[no_mangle] pub extern "C" fn set_planet_seed(seed: u32) { WORLD_SEED.with(|value|value.set(seed)); }
mod authored;
use authored::AUTHORED;
mod blue;
use blue::*;

fn geodesic(n: usize) -> (Vec<V>, Vec<[usize; 3]>) {
    let mut vertices = base_vertices();
    let mut edges = BTreeMap::new();
    for (a, b) in BASE_EDGES {
        let mut row = vec![a];
        for j in 1..n {
            row.push(vertices.len());
            vertices.push(vertices[a].lerp(vertices[b], j as f32 / n as f32).unit());
        }
        row.push(b);
        edges.insert((a, b), row.clone());
        row.reverse();
        edges.insert((b, a), row);
    }
    let mut triangles = Vec::new();
    for (a, b, c) in BASE_FACES {
        let mut rows = vec![vec![a]];
        for j in 1..n {
            let start = edges[&(a, b)][j];
            let end = edges[&(a, c)][j];
            let mut row = vec![start];
            for k in 1..j {
                row.push(vertices.len());
                vertices.push(
                    vertices[start]
                        .lerp(vertices[end], k as f32 / j as f32)
                        .unit(),
                );
            }
            row.push(end);
            rows.push(row);
        }
        rows.push(edges[&(b, c)].clone());
        for j in 0..n {
            for k in 0..=j {
                triangles.push([rows[j][k], rows[j + 1][k], rows[j + 1][k + 1]]);
                if k < j {
                    triangles.push([rows[j][k], rows[j + 1][k + 1], rows[j][k + 1]]);
                }
            }
        }
    }
    (vertices, triangles)
}

fn angle(reference: V, direction: V, axis: V) -> f32 {
    let unsigned = reference
        .unit()
        .dot(direction.unit())
        .clamp(-1.0, 1.0)
        .acos();
    let signed = if axis.dot(reference.cross(direction)) < 0.0 {
        -unsigned
    } else {
        unsigned
    };
    if signed < 0.0 {
        signed + std::f32::consts::TAU
    } else {
        signed
    }
}

#[derive(Default)]
struct Planet {
    edge_trees: usize,
    prop_matrices: Vec<f32>,
    prop_kinds: Vec<u32>,
    prop_tiles: Vec<u32>,
    prop_ids: Vec<u32>,
    prop_owners: Vec<u32>,
    section_owners: Vec<[u32; 3]>,
    features: Vec<u32>,
    matrices: Vec<f32>,
    normals: Vec<f32>,
    colors: Vec<f32>,
    vertex_colors: Vec<f32>,
    surfaces: Vec<u32>,
    tile_centers: Vec<f32>,
    tile_corners: Vec<f32>,
    neighbors: Vec<u32>,
    water_sections: usize,
    tile_ids: Vec<u32>,
    tiles: usize,
    pentagons: usize,
    kinds: Vec<u32>,
    sections: usize,
    edges: usize,
    corners: usize,
    #[cfg(test)]
    topology: Vec<[usize; 3]>,
}

// Source basis: XY unit-hex sector. A -> next corner, B -> center, C -> current corner.
fn section_matrix(d: V, e: V, f: V) -> [f32; 16] {
    let x = d.sub(f);
    let y = d.sub(e).sub(x.scale(0.5)).scale(2.0 / 3.0_f32.sqrt());
    let z = x.cross(y).unit();
    [
        x.0, x.1, x.2, 0.0, y.0, y.1, y.2, 0.0, z.0, z.1, z.2, 0.0, d.0, d.1, d.2, 1.0,
    ]
}

fn generate_planet(n: usize, inset: f32) -> Planet {
    generate_surface(n, inset, 0.0, 1)
}

fn emit(
    out: &mut Planet,
    points: &[V],
    mut ids: [usize; 3],
    tile: usize,
    kind: u32,
    color: [f32; 4],
) {
    let [a, b, c] = ids.map(|i| points[i]);
    if b.sub(a).cross(c.sub(a)).dot(a.add(b).add(c)) < 0.0 {
        ids.swap(0, 2);
    }
    let [a, b, c] = ids.map(|i| points[i]);
    out.matrices.extend(section_matrix(b, c, a));
    let normal = b.sub(a).cross(c.sub(a)).unit();
    for _ in 0..3 {
        out.normals.extend([normal.0, normal.1, normal.2]);
    }
    out.colors.extend(color);
    for _ in 0..3 {
        out.vertex_colors.extend(color);
    }
    out.tile_ids.push(tile as u32);
    out.section_owners.push([tile as u32; 3]);
    out.kinds.push(kind);
    #[cfg(test)]
    out.topology.push(ids);
}

fn corner_rotation(h: [i32; 3]) -> usize {
    if h[2] >= h[1] && h[2] > h[0] {
        2
    } else if h[1] >= h[0] && h[1] > h[2] {
        1
    } else {
        0
    }
}

fn footprint(p: [f32; 3], kind: u32, t: [V; 4]) -> (V, V, V) {
    let [x, _, z] = p;
    match kind {
        0 => {
            let h = 0.4 * 3.0_f32.sqrt();
            let e = -z / h;
            let f = (-x - 0.4 * e) / 0.8;
            let de = t[1].sub(t[0]);
            let df = t[2].sub(t[0]);
            (
                t[0].add(de.scale(e)).add(df.scale(f)),
                df.scale(-1.0 / 0.8),
                de.scale(-1.0 / h).add(df.scale(0.5 / h)),
            )
        }
        1 => {
            let uz = 0.4 * 3.0_f32.sqrt();
            let vz = -0.1 * 3.0_f32.sqrt();
            let determinant = -0.4 * vz + 0.3 * uz;
            let u = ((x + 0.4) * vz + 0.3 * (z + uz)) / determinant;
            let v = (-0.4 * (z + uz) - uz * (x + 0.4)) / determinant;
            let du = t[1].sub(t[0]).lerp(t[2].sub(t[3]), v);
            let dv = t[3].sub(t[0]).lerp(t[2].sub(t[1]), u);
            (
                t[0].lerp(t[1], u).lerp(t[3].lerp(t[2], u), v),
                du.scale(vz / determinant).add(dv.scale(-uz / determinant)),
                du.scale(0.3 / determinant)
                    .add(dv.scale(-0.4 / determinant)),
            )
        }
        _ => {
            let h = 0.1 * 3.0_f32.sqrt();
            let sum = (-x - 0.8) / 0.3;
            let diff = z / h;
            let e = (sum - diff) * 0.5;
            let f = (sum + diff) * 0.5;
            let de = t[1].sub(t[0]);
            let df = t[2].sub(t[0]);
            (
                t[0].add(de.scale(e)).add(df.scale(f)),
                de.add(df).scale(-1.0 / 0.6),
                df.sub(de).scale(0.5 / h),
            )
        }
    }
}

fn authored_position(p: [f32; 3], kind: u32, targets: [V; 4], level: i32, height_step: f32) -> V {
    let (q, _, _) = footprint(p, kind, targets);
    q.unit()
        .scale(1.0 + (level as f32 + p[1] / 0.2) * height_step)
}

fn deformation_jacobian(
    p: [f32; 3],
    kind: u32,
    targets: [V; 4],
    level: i32,
    height_step: f32,
) -> [V; 3] {
    let (q, qx, qz) = footprint(p, kind, targets);
    let length = q.dot(q).sqrt();
    let up = q.scale(1.0 / length);
    let radius = 1.0 + (level as f32 + p[1] / 0.2) * height_step;
    let tangent = |v: V| v.sub(up.scale(up.dot(v))).scale(radius / length);
    [tangent(qx), up.scale(height_step / 0.2), tangent(qz)]
}

fn authored_normal(
    p: [f32; 3],
    source: V,
    kind: u32,
    targets: [V; 4],
    level: i32,
    height_step: f32,
) -> V {
    let [jx, jy, jz] = deformation_jacobian(p, kind, targets, level, height_step);
    let cofactor = jy
        .cross(jz)
        .scale(source.0)
        .add(jz.cross(jx).scale(source.1))
        .add(jx.cross(jy).scale(source.2));
    let determinant = jx.dot(jy.cross(jz));
    if cofactor.dot(cofactor) < 1e-18 || determinant.abs() < 1e-14 {
        // At zero height scale the deformation collapses a dimension; an inverse does not exist.
        return authored_position(p, kind, targets, level, height_step).unit();
    }
    cofactor
        .scale(if determinant < 0.0 { -1.0 } else { 1.0 })
        .unit()
}

fn emit_authored(
    out: &mut Planet,
    mesh_index: usize,
    targets: [V; 4],
    tile: usize,
    kind: u32,
    level: i32,
    height_step: f32,
    palette: [[f32; 4]; 3],
    cliff: [f32; 4],
) {
    let mesh = &AUTHORED[mesh_index];
    let positions: Vec<V> = mesh
        .vertices
        .iter()
        .map(|&p| authored_position(p, kind, targets, level, height_step))
        .collect();
    for (((indices, &mask), source), weights) in mesh
        .triangles
        .iter()
        .zip(mesh.masks)
        .zip(mesh.normals)
        .zip(mesh.weights)
    {
        let [a, b, c] = indices.map(|i| positions[i]);
        let normal = b.sub(a).cross(c.sub(a));
        if normal.dot(normal) < 1e-18 {
            continue;
        }
        let color = if mask == 3 {
            cliff
        } else {
            palette[mask as usize]
        };
        let mut ordered = *indices;
        let mut ordered_weights = *weights;
        if normal.dot(a.add(b).add(c)) < 0.0 {
            ordered.swap(0, 2);
            ordered_weights.swap(0, 2);
        }
        emit(out, &positions, *indices, tile, kind, color);
        let color_start = out.vertex_colors.len() - 12;
        for j in 0..3 {
            let color = ownership_color(ordered_weights[j], palette, cliff);
            out.vertex_colors[color_start + j * 4..color_start + j * 4 + 4].copy_from_slice(&color);
        }
        let start = out.normals.len() - 9;
        for (j, &i) in ordered.iter().enumerate() {
            let n = authored_normal(
                mesh.vertices[i],
                V(source[0], source[1], source[2]),
                kind,
                targets,
                level,
                height_step,
            );
            out.normals[start + j * 3..start + j * 3 + 3].copy_from_slice(&[n.0, n.1, n.2]);
        }
    }
}

fn ownership_color(w: [f32; 3], palette: [[f32; 4]; 3], cliff: [f32; 4]) -> [f32; 4] {
    let sum = w[0] + w[1] + w[2];
    if sum < 0.02 {
        return cliff;
    }
    let mut color = [0.0, 0.0, 0.0, 1.0];
    for i in 0..3 {
        color[i] = (palette[0][i] * w[0] + palette[1][i] * w[1] + palette[2][i] * w[2]) / sum;
    }
    color
}

fn blue_tile(d: V, id: usize, resolution:usize, permutation:&[u8;256]) -> (usize, i32, u32, [f32; 4], [f32; 4]) {
    let coords=[d.0,d.1,d.2].map(|x|(x*1048576.0).round() as i64);
    let tile=planet_generation_core::sample(coords,resolution as u32,id as u32,permutation,WORLD_SEED.with(|value|value.get()));
    let surface=tile[1] as usize;
    let level=tile[0] as i8 as i32;
    let color = SURFACE_COLORS[surface];
    (surface, level, tile[2] as u32, color, CLIFF_COLORS[surface])
}

fn generate_surface(n: usize, inset: f32, height_step: f32, flags: u32) -> Planet {
    let (vertices, triangles) = geodesic(n);
    let mut polygons = vec![Vec::new(); vertices.len()];
    let mut face_centers = vec![V::default(); triangles.len()];
    let mut shared_edges: BTreeMap<(usize, usize), Vec<usize>> = BTreeMap::new();
    for i in 0..triangles.len() {
        let face = (i + 12) % triangles.len();
        let ids = triangles[face];
        let center = vertices[ids[0]]
            .add(vertices[ids[1]])
            .add(vertices[ids[2]])
            .scale(1.0 / 3.0);
        face_centers[face] = center;
        for id in ids {
            polygons[id].push(face);
        }
        for (a, b) in [(ids[0], ids[1]), (ids[1], ids[2]), (ids[2], ids[0])] {
            shared_edges
                .entry((a.min(b), a.max(b)))
                .or_default()
                .push(face);
        }
    }
    let mut out = Planet {
        tiles: polygons.len(),
        edges: shared_edges.len(),
        corners: triangles.len(),
        ..Default::default()
    };
    let visual = VISUAL_LAYOUT.with(|v| v.borrow().clone());
    let visual = if visual.len() == polygons.len()*21 { Some(visual) } else { None };
    let mut render_faces = face_centers.clone();
    let mut points = vec![V::default(); polygons.len()];
    let mut corner_points = BTreeMap::new();
    let mut colors = Vec::new();
    let mut cliffs = Vec::new();
    let blue_planet = flags & 32 != 0;
    let mut levels = Vec::new();
    let mut radii = Vec::new();
    let use_authored = flags & 8 != 0;
    let mut permutation=[0u8;256];
    planet_generation_core::shuffle(&mut permutation,WORLD_SEED.with(|value|value.get()));
    let mut directions=vec![V::default();out.tiles];
    for (id, faces) in polygons.iter_mut().enumerate() {
        let center = faces
            .iter()
            .fold(V::default(), |a, &f| a.add(face_centers[f]))
            .scale(1.0 / faces.len() as f32);
        let reference = face_centers[faces[0]].sub(center);
        faces.sort_by(|&a, &b| {
            angle(reference, face_centers[a].sub(center), center).total_cmp(&angle(
                reference,
                face_centers[b].sub(center),
                center,
            ))
        });
        let d = center.unit();
        directions[id]=d;
        let (surface, blue_level, feature, biome_color, cliff) = blue_tile(d, id,n,&permutation);
        out.features.push(feature);
        let level = if blue_planet {
            blue_level as f32
        } else {
            ((d.0 * 2.8 + d.1 * 1.7 + d.2 * 0.9).sin() * 1.6 + 1.6).floor()
        };
        out.surfaces.push(surface as u32);
        cliffs.push(if blue_planet {
            cliff
        } else {
            [0.13, 0.20, 0.24, 1.0]
        });
        let radius = 1.0 + level * height_step;
        levels.push(level as i32);
        radii.push(radius);
        let d = if let Some(ref values) = visual {
            for (side, &face) in faces.iter().enumerate() {
                let offset=id*21+3+side*3;
                render_faces[face]=V(values[offset],values[offset+1],values[offset+2]).unit();
            }
            V(values[id*21],values[id*21+1],values[id*21+2]).unit()
        } else { d };
        points[id] = d.scale(radius);
        out.tile_centers.extend([points[id].0, points[id].1, points[id].2]);
        for &face in faces.iter() {
            let corner=render_faces[face].unit();
            out.tile_corners.extend([corner.0,corner.1,corner.2]);
        }
        for _ in faces.len()..6 {out.tile_corners.extend([0.0,0.0,0.0]);}
        let pentagon = faces.len() == 5;
        if pentagon {
            out.pentagons += 1;
        }
        let shade = 0.72 + ((id * 37) % 29) as f32 / 100.0;
        colors.push(if blue_planet {
            biome_color
        } else if pentagon {
            [0.96, 0.56, 0.22, 1.0]
        } else {
            [0.18 * shade, 0.72 * shade, 0.65 * shade, 1.0]
        });
        for &face in faces.iter() {
            corner_points.insert((id, face), points.len());
            points.push(d.lerp(render_faces[face].unit(), inset).scale(radius));
        }
    }
    out.neighbors=vec![u32::MAX;out.tiles*6];
    let mut adjacency=vec![Vec::new();out.tiles];
    for &(a,b) in shared_edges.keys(){adjacency[a].push(b);adjacency[b].push(a);}
    for id in 0..out.tiles {
        let up=directions[id];
        let reference=if up.1.abs()>0.95{V(1.0,0.0,0.0)}else{V(0.0,1.0,0.0)};
        let adjacent=&mut adjacency[id];
        let tangent=reference.sub(up.scale(reference.dot(up))).unit();
        let bearing=|n:usize|{let d=directions[n];up.dot(tangent.cross(d)).atan2(tangent.dot(d))};
        adjacent.sort_by(|&a,&b|bearing(a).total_cmp(&bearing(b)));
        let first=adjacent.iter().enumerate().min_by_key(|(_,id)|*id).unwrap().0;
        adjacent.rotate_left(first);
        for (side,&neighbor) in adjacent.iter().enumerate(){out.neighbors[id*6+side]=neighbor as u32;}
    }
    for (id, faces) in polygons.iter().enumerate() {
        out.sections += faces.len();
        if flags & 1 == 0 {
            continue;
        }
        for j in 0..faces.len() {
            let e = corner_points[&(id, faces[j])];
            let f = corner_points[&(id, faces[(j + 1) % faces.len()])];
            if use_authored {
                let r = 1.0 / radii[id];
                emit_authored(
                    &mut out,
                    0,
                    [
                        points[id].scale(r),
                        points[e].scale(r),
                        points[f].scale(r),
                        V::default(),
                    ],
                    id,
                    0,
                    levels[id],
                    height_step,
                    [colors[id]; 3],
                    cliffs[id],
                );
            } else {
                emit(&mut out, &points, [f, id, e], id, 0, colors[id]);
            }
        }
    }
    if flags & 2 != 0 {
        for (&(a, b), faces) in &shared_edges {
            let start = out.kinds.len();
            if use_authored {
                let (high, low) = if levels[a] >= levels[b] {
                    (a, b)
                } else {
                    (b, a)
                };
                let mut first = faces[0];
                let mut second = faces[1];
                let order = &polygons[high];
                let at = order.iter().position(|&f| f == first).unwrap();
                if order[(at + 1) % order.len()] != second {
                    std::mem::swap(&mut first, &mut second);
                }
                let targets = [
                    points[corner_points[&(high, first)]].scale(1.0 / radii[high]),
                    points[corner_points[&(high, second)]].scale(1.0 / radii[high]),
                    points[corner_points[&(low, second)]].scale(1.0 / radii[low]),
                    points[corner_points[&(low, first)]].scale(1.0 / radii[low]),
                ];
                emit_authored(
                    &mut out,
                    (1 + levels[high] - levels[low]) as usize,
                    targets,
                    high,
                    1,
                    levels[high],
                    height_step,
                    [colors[high], colors[low], colors[low]],
                    cliffs[high],
                );
                out.section_owners[start..].fill([a as u32, b as u32, b as u32]);
                continue;
            }
            let p = corner_points[&(a, faces[0])];
            let q = corner_points[&(a, faces[1])];
            let r = corner_points[&(b, faces[1])];
            let t = corner_points[&(b, faces[0])];
            // A spherical four-corner strip need not be planar; two exact triangles avoid affine-quad gaps.
            emit(&mut out, &points, [p, q, r], a, 1, [0.23, 0.40, 0.55, 1.0]);
            emit(&mut out, &points, [p, r, t], a, 1, [0.23, 0.40, 0.55, 1.0]);
            out.section_owners[start..].fill([a as u32, b as u32, b as u32]);
        }
    }
    if flags & 4 != 0 {
        for (face, &[a, b, c]) in triangles.iter().enumerate() {
            let start = out.kinds.len();
            if use_authored {
                let tiles = [a, b, c];
                let h = [levels[a], levels[b], levels[c]];
                let i = corner_rotation(h);
                let ids = [tiles[i], tiles[(i + 1) % 3], tiles[(i + 2) % 3]];
                let high = levels[ids[0]];
                let d0 = high - levels[ids[1]];
                let d1 = high - levels[ids[2]];
                let index = if d0 == 0 { 5 } else { 6 + (d0 - 1) * 4 + d1 };
                let targets = [
                    points[corner_points[&(ids[0], face)]].scale(1.0 / radii[ids[0]]),
                    points[corner_points[&(ids[1], face)]].scale(1.0 / radii[ids[1]]),
                    points[corner_points[&(ids[2], face)]].scale(1.0 / radii[ids[2]]),
                    V::default(),
                ];
                emit_authored(
                    &mut out,
                    index as usize,
                    targets,
                    ids[0],
                    2,
                    high,
                    height_step,
                    [colors[ids[0]], colors[ids[1]], colors[ids[2]]],
                    cliffs[ids[0]],
                );
                out.section_owners[start..].fill([a as u32, b as u32, c as u32]);
                continue;
            }
            let ids = [
                corner_points[&(a, face)],
                corner_points[&(b, face)],
                corner_points[&(c, face)],
            ];
            emit(&mut out, &points, ids, a, 2, [0.74, 0.40, 0.78, 1.0]);
            out.section_owners[start..].fill([a as u32, b as u32, c as u32]);
        }
    }
    if blue_planet && flags & 64 == 0 {
        props::generate(&mut out, &polygons, &render_faces, &points, n, height_step);
    }
    if blue_planet && flags & 16 != 0 {
        let radius = 1.0 + WATER_LEVEL * height_step;
        for (id, faces) in polygons.iter().enumerate() {
            let ocean=SURFACE_WATER[out.surfaces[id] as usize];
            let coast=faces.iter().any(|&face|triangles[face].iter().any(|&other|SURFACE_WATER[out.surfaces[other] as usize]));
            if !ocean && !coast {continue;}
            let d = points[id].unit().scale(radius);
            for j in 0..faces.len() {
                let e = render_faces[faces[j]].unit().scale(radius);
                let f = render_faces[faces[(j + 1) % faces.len()]]
                    .unit()
                    .scale(radius);
                let inner_e = d.lerp(e, inset).unit().scale(radius);
                let inner_f = d.lerp(f, inset).unit().scale(radius);
                let sectors = if ocean { vec![[f, d, e]] } else {
                    let touches_water = [faces[j], faces[(j + 1) % faces.len()]].iter().any(|&face|
                        triangles[face].iter().any(|&other| SURFACE_WATER[out.surfaces[other] as usize]));
                    if !touches_water { continue; }
                    vec![[f, inner_f, inner_e], [f, inner_e, e]]
                };
                for positions in sectors {
                emit(&mut out, &positions, [0, 1, 2], id, 3, WATER_COLOR);
                let start = out.normals.len() - 9;
                for (k, p) in positions.iter().enumerate() {
                    let n = p.unit();
                    out.normals[start + k * 3..start + k * 3 + 3].copy_from_slice(&[n.0, n.1, n.2]);
                }
                out.water_sections += 1;
                }
            }
        }
    }
    out
}
thread_local! { static VISUAL_LAYOUT: RefCell<Vec<f32>> = RefCell::new(Vec::new()); }
#[no_mangle]
pub extern "C" fn visual_layout_buffer(tiles: u32) -> *mut f32 {
    VISUAL_LAYOUT.with(|v| {let mut values=v.borrow_mut();values.clear();if tiles<=2562 {values.resize(tiles as usize*21,0.0);}values.as_mut_ptr()})
}
thread_local! { static PLANET: RefCell<Planet> = RefCell::new(Planet::default()); }
#[no_mangle]
pub extern "C" fn generate(resolution: u32, inset: f32) -> u32 {
    if !(1..=64).contains(&resolution) || !inset.is_finite() || !(0.1..=1.0).contains(&inset) {
        return 0;
    }
    PLANET.with(|p| {
        *p.borrow_mut() = generate_planet(resolution as usize, inset);
        p.borrow().tile_ids.len() as u32
    })
}
#[no_mangle]
pub extern "C" fn generate_connected(resolution: u32, height_step: f32, flags: u32) -> u32 {
    if !(1..=64).contains(&resolution)
        || !height_step.is_finite()
        || !(0.0..=0.2).contains(&height_step)
    {
        return 0;
    }
    PLANET.with(|p| {
        *p.borrow_mut() = generate_surface(resolution as usize, 0.8, height_step, flags & 7);
        p.borrow().tile_ids.len() as u32
    })
}
#[no_mangle]
pub extern "C" fn generate_authored(resolution: u32, height_step: f32, flags: u32) -> u32 {
    if !(1..=16).contains(&resolution)
        || !height_step.is_finite()
        || !(0.0..=0.2).contains(&height_step)
    {
        return 0;
    }
    PLANET.with(|p| {
        *p.borrow_mut() = generate_surface(resolution as usize, 0.8, height_step, (flags & 7) | 8);
        p.borrow().tile_ids.len() as u32
    })
}
#[no_mangle]
pub extern "C" fn generate_blue(resolution: u32, height_step: f32, flags: u32) -> u32 {
    if !(5..=16).contains(&resolution)
        || !height_step.is_finite()
        || !(0.01..=0.2).contains(&height_step)
    {
        return 0;
    }
    PLANET.with(|p| {
        *p.borrow_mut() =
            generate_surface(resolution as usize, 0.8, height_step, (flags & 87) | 40);
        p.borrow().tile_ids.len() as u32
    })
}
#[no_mangle]
pub extern "C" fn vertex_colors_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().vertex_colors.as_ptr())
}
#[no_mangle]
pub extern "C" fn surfaces_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().surfaces.as_ptr())
}
#[no_mangle]
pub extern "C" fn water_section_count() -> u32 {
    PLANET.with(|p| p.borrow().water_sections as u32)
}
#[no_mangle]
pub extern "C" fn kinds_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().kinds.as_ptr())
}
#[no_mangle]
pub extern "C" fn section_count() -> u32 {
    PLANET.with(|p| p.borrow().sections as u32)
}
#[no_mangle]
pub extern "C" fn edge_count() -> u32 {
    PLANET.with(|p| p.borrow().edges as u32)
}
#[no_mangle]
pub extern "C" fn corner_count() -> u32 {
    PLANET.with(|p| p.borrow().corners as u32)
}
#[no_mangle]
pub extern "C" fn normals_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().normals.as_ptr())
}
#[no_mangle]
pub extern "C" fn matrices_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().matrices.as_ptr())
}
#[no_mangle]
pub extern "C" fn colors_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().colors.as_ptr())
}
#[no_mangle]
pub extern "C" fn tile_ids_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().tile_ids.as_ptr())
}
#[no_mangle]
pub extern "C" fn tile_corners_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().tile_corners.as_ptr())
}
#[no_mangle]
pub extern "C" fn tile_centers_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().tile_centers.as_ptr())
}
#[no_mangle]
pub extern "C" fn tile_count() -> u32 {
    PLANET.with(|p| p.borrow().tiles as u32)
}
#[no_mangle]
pub extern "C" fn pentagon_count() -> u32 {
    PLANET.with(|p| p.borrow().pentagons as u32)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn transform(m: &[f32], p: V) -> V {
        V(
            m[0] * p.0 + m[4] * p.1 + m[8] * p.2 + m[12],
            m[1] * p.0 + m[5] * p.1 + m[9] * p.2 + m[13],
            m[2] * p.0 + m[6] * p.1 + m[10] * p.2 + m[14],
        )
    }
    fn close(a: V, b: V) {
        assert!(a.sub(b).dot(a.sub(b)) < 1e-11, "{a:?} != {b:?}");
    }
    #[test]
    fn water_covers_ocean_tiles_but_not_dry_tile_interiors() {
        for n in [2, 8, 16] {
            let p = generate_surface(n, 0.8, 0.02, 63);
            let (vertices, _) = geodesic(n);
            let mut counts = vec![0; vertices.len()];
            let mut dry_connections = 0;
            for i in p.tile_ids.len()-p.water_sections..p.tile_ids.len() {
                let id = p.tile_ids[i] as usize;
                counts[id] += 1;
                let m = &p.matrices[i*16..i*16+16];
                let a = transform(m, V(-1.0, 0.0, 0.0));
                let b = transform(m, V(0.0, 0.0, 0.0));
                let c = transform(m, V(-0.5, -3.0_f32.sqrt()/2.0, 0.0));
                assert!(b.sub(a).cross(c.sub(a)).dot(b) > 0.0);
                if !SURFACE_WATER[p.surfaces[id] as usize] {
                    dry_connections += 1;
                    for u in 0..=10 { for v in 0..=10-u {
                        let q = a.scale(u as f32/10.0).add(b.scale(v as f32/10.0)).add(c.scale((10-u-v) as f32/10.0)).unit();
                        assert!(q.sub(vertices[id].unit()).dot(q.sub(vertices[id].unit())) > (0.1/n as f32).powi(2));
                    }}
                }
            }
            assert!(dry_connections > 0);
            for (id, count) in counts.iter().enumerate() {
                if SURFACE_WATER[p.surfaces[id] as usize] { assert!([5,6].contains(count)); }
            }
        }
    }
    #[test]
    fn canonical_triangle_maps_to_section() {
        let d = V(0.2, 0.7, 0.6);
        let e = V(-0.1, 0.8, 0.4);
        let f = V(0.5, 0.4, 0.7);
        let m = section_matrix(d, e, f);
        close(transform(&m, V(-1.0, 0.0, 0.0)), f);
        close(transform(&m, V(0.0, 0.0, 0.0)), d);
        close(transform(&m, V(-0.5, -3.0_f32.sqrt() / 2.0, 0.0)), e);
    }
    #[test]
    fn topology_is_closed_and_all_sectors_face_outward() {
        for n in [1, 2, 5, 8, 16, 32] {
            let (v, t) = geodesic(n);
            assert_eq!(v.len(), 10 * n * n + 2);
            assert_eq!(t.len(), 20 * n * n);
            let mut edges = BTreeMap::new();
            for [a, b, c] in t {
                for (x, y) in [(a, b), (b, c), (c, a)] {
                    *edges.entry((x.min(y), x.max(y))).or_insert(0) += 1;
                }
            }
            assert!(edges.values().all(|&uses| uses == 2));
            let p = generate_planet(n, 1.0);
            assert_eq!(p.pentagons, 12);
            assert_eq!(p.tile_ids.len(), 60 * n * n);
            for m in p.matrices.chunks_exact(16) {
                assert!(m.iter().all(|v| v.is_finite()));
                let a = transform(m, V(-1.0, 0.0, 0.0));
                let b = transform(m, V(0.0, 0.0, 0.0));
                let c = transform(m, V(-0.5, -3.0_f32.sqrt() / 2.0, 0.0));
                assert!(b.sub(a).cross(c.sub(a)).dot(b) > 0.0);
                for q in [a, b, c] {
                    assert!((q.dot(q) - 1.0).abs() < 2e-6);
                }
            }
        }
    }
    #[test]
    fn connections_form_a_closed_surface_at_mixed_heights() {
        for n in [1, 2, 5, 8, 16, 32] {
            for height in [0.0, 0.035, 0.12] {
                let p = generate_surface(n, 0.8, height, 7);
                assert_eq!(p.sections, 60 * n * n);
                assert_eq!(p.edges, 30 * n * n);
                assert_eq!(p.corners, 20 * n * n);
                assert_eq!(p.topology.len(), 140 * n * n);
                let mut edges = BTreeMap::new();
                let mut vertices = std::collections::BTreeSet::new();
                let mut positions: BTreeMap<usize, V> = BTreeMap::new();
                for (ids, m) in p.topology.iter().zip(p.matrices.chunks_exact(16)) {
                    let abc = [
                        transform(m, V(-1.0, 0.0, 0.0)),
                        transform(m, V(0.0, 0.0, 0.0)),
                        transform(m, V(-0.5, -3.0_f32.sqrt() / 2.0, 0.0)),
                    ];
                    for (id, point) in ids.iter().zip(abc) {
                        if let Some(previous) = positions.insert(*id, point) {
                            close(point, previous);
                        }
                        vertices.insert(*id);
                    }
                    let [a, b, c] = abc;
                    assert!(b.sub(a).cross(c.sub(a)).dot(a.add(b).add(c)) > 0.0);
                    for (x, y) in [(ids[0], ids[1]), (ids[1], ids[2]), (ids[2], ids[0])] {
                        let e = edges.entry((x.min(y), x.max(y))).or_insert((0, 0));
                        e.0 += 1;
                        e.1 += if x < y { 1 } else { -1 };
                    }
                }
                assert!(edges
                    .values()
                    .all(|&(count, balance)| count == 2 && balance == 0));
                assert_eq!(
                    vertices.len() as isize - edges.len() as isize + p.topology.len() as isize,
                    2
                );
            }
        }
    }
    #[test]
    fn all_corner_height_combinations_have_a_high_to_low_variant() {
        for a in 0..4 {
            for b in 0..4 {
                for c in 0..4 {
                    let h = [a, b, c];
                    let i = corner_rotation(h);
                    let high = h[i];
                    assert_eq!(high, a.max(b).max(c));
                    let d0 = high - h[(i + 1) % 3];
                    let d1 = high - h[(i + 2) % 3];
                    assert!(d0 > 0 || d1 == 0);
                    let index = if d0 == 0 { 5 } else { 6 + (d0 - 1) * 4 + d1 };
                    assert!((index as usize) < AUTHORED.len());
                }
            }
        }
    }
    #[test]
    fn authored_frames_are_finite_and_height_anchors_match() {
        for n in [1, 5, 8] {
            for step in [0.0, 0.035, 0.12] {
                let p = generate_surface(n, 0.8, step, 15);
                assert!(p.matrices.iter().all(|x| x.is_finite()));
                assert!(p.tile_ids.len() > 140 * n * n);
            }
        }
        let targets = [
            V(1.0, 0.0, 0.0),
            V(1.0, 0.2, 0.0),
            V(1.0, 0.2, 0.2),
            V(1.0, 0.0, 0.2),
        ];
        let z = 0.1 * 3.0_f32.sqrt();
        let e = authored_position([-0.4, 0.0, -4.0 * z], 1, targets, 3, 0.035);
        let g = authored_position([-1.1, -0.6, -z], 1, targets, 3, 0.035);
        close(e, targets[0].unit().scale(1.105));
        close(g, targets[2].unit());
        let c = authored_position([-1.1, -0.4, z], 2, targets, 3, 0.035);
        close(c, targets[2].unit().scale(1.035));
    }
    #[test]
    fn jacobian_matches_finite_differences_under_unequal_skew() {
        let targets = [
            V(0.8, 0.7, 0.1),
            V(0.5, 1.0, 0.2),
            V(0.3, 0.8, 0.5),
            V(0.9, 0.6, 0.7),
        ];
        for (kind, p) in [
            (0, [-0.3, -0.1, -0.2]),
            (1, [-0.75, -0.1, -0.43]),
            (2, [-1.0, -0.1, 0.03]),
        ] {
            let j = deformation_jacobian(p, kind, targets, 2, 0.04);
            for axis in 0..3 {
                let mut lo = p;
                let mut hi = p;
                lo[axis] -= 0.0005;
                hi[axis] += 0.0005;
                let numerical = authored_position(hi, kind, targets, 2, 0.04)
                    .sub(authored_position(lo, kind, targets, 2, 0.04))
                    .scale(1000.0);
                assert!(numerical.sub(j[axis]).dot(numerical.sub(j[axis])) < 2e-6);
            }
            let n = authored_normal(p, V(0.0, 1.0, 0.0), kind, targets, 2, 0.04);
            close(n, authored_position(p, kind, targets, 2, 0.04).unit());
            let source = V(0.4, 0.8, -0.3).unit();
            let tangent = source.cross(V(1.0, 0.0, 0.0)).unit();
            let deformed = j[0]
                .scale(tangent.0)
                .add(j[1].scale(tangent.1))
                .add(j[2].scale(tangent.2));
            let normal = authored_normal(p, source, kind, targets, 2, 0.04);
            assert!(normal.dot(deformed).abs() < 1e-6);
            assert!(normal.0.is_finite() && normal.1.is_finite() && normal.2.is_finite());
        }
    }
}

#[no_mangle]
pub extern "C" fn prop_matrices_ptr() -> *const f32 {
    PLANET.with(|p| p.borrow().prop_matrices.as_ptr())
}
#[no_mangle]
pub extern "C" fn prop_kinds_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().prop_kinds.as_ptr())
}
#[no_mangle]
pub extern "C" fn prop_tiles_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().prop_tiles.as_ptr())
}
#[no_mangle]
pub extern "C" fn prop_ids_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().prop_ids.as_ptr())
}
#[no_mangle]
pub extern "C" fn features_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().features.as_ptr())
}
#[no_mangle]
pub extern "C" fn prop_count() -> u32 {
    PLANET.with(|p| p.borrow().prop_kinds.len() as u32)
}

#[no_mangle]
pub extern "C" fn edge_tree_count() -> u32 {
    PLANET.with(|p| p.borrow().edge_trees as u32)
}


#[no_mangle] pub extern "C" fn tile_neighbors_ptr()->*const u32 {PLANET.with(|p|p.borrow().neighbors.as_ptr())}

#[no_mangle]
pub extern "C" fn prop_owners_ptr() -> *const u32 {
    PLANET.with(|p| p.borrow().prop_owners.as_ptr())
}

#[no_mangle] pub extern "C" fn planet_generator_version()->u32 {planet_generation_core::VERSION as u32}
