use super::*;
mod samples {
    include!("spawn_points.rs");
}
mod config { include!("prop_config.rs"); }
fn hash(mut x: u32) -> u32 {
    x ^= x >> 16;
    x = x.wrapping_mul(0x7feb352d);
    x ^= x >> 15;
    x = x.wrapping_mul(0x846ca68b);
    x ^ (x >> 16)
}
fn random(x: u32) -> f32 {
    (hash(x) & 65535) as f32 / 65535.0
}
fn hit(d: V, a: V, b: V, c: V) -> Option<V> {
    let e = b.sub(a);
    let f = c.sub(a);
    let n = e.cross(f);
    let denom = n.dot(d);
    if denom.abs() < 1e-10 {
        return None;
    }
    let t = n.dot(a) / denom;
    if t <= 0.0 {
        return None;
    }
    let p = d.scale(t);
    let v = p.sub(a);
    let ee = e.dot(e);
    let ff = f.dot(f);
    let ef = e.dot(f);
    let det = ee * ff - ef * ef;
    if det.abs() < 1e-16 {
        return None;
    }
    let u = (v.dot(e) * ff - v.dot(f) * ef) / det;
    let w = (v.dot(f) * ee - v.dot(e) * ef) / det;
    if u >= -1e-4 && w >= -1e-4 && u + w <= 1.0001 {
        Some(p)
    } else {
        None
    }
}
pub fn generate(out: &mut Planet, polygons: &[Vec<usize>], centers: &[V], points: &[V], n: usize, height_step: f32) {
    let mut triangles = vec![Vec::new(); out.tiles];
    let mut connections = vec![Vec::new(); out.tiles];
    for i in 0..out.kinds.len() {
        if out.kinds[i] > 2 {
            continue;
        }
        let m = &out.matrices[i * 16..i * 16 + 16];
        let b = V(m[12], m[13], m[14]);
        let a = b.sub(V(m[0], m[1], m[2]));
        let c = b
            .sub(V(m[0], m[1], m[2]).scale(0.5))
            .sub(V(m[4], m[5], m[6]).scale(3.0f32.sqrt() / 2.0));
        let tile = out.tile_ids[i] as usize;
        if out.kinds[i] == 0 {
            triangles[tile].push([a, b, c]);
        } else if b
            .sub(a)
            .cross(c.sub(a))
            .unit()
            .dot(a.add(b).add(c).unit())
            .abs()
            > 0.82
        {
            let owners = out.section_owners[i];
            let owner = *owners.iter().min().unwrap() as usize;
            connections[owner].push(([a, b, c], owners));
        }
    }
    let separation = 0.11 / n as f32;
    let cell = separation;
    let mut occupied: BTreeMap<(i32, i32, i32), Vec<V>> = BTreeMap::new();
    for kind in [1u32, 0u32] {
        for (tile, faces) in polygons.iter().enumerate() {
            let feature = out.features[tile] & (1 << kind) != 0;
            if !feature && out.features[tile] != 0 { continue; }
            let background_chance = config::BLUE_PLANET.background_chance[out.surfaces[tile] as usize][kind as usize];
            if !feature && background_chance == 0.0 { continue; }
            let matching: Vec<_> = connections[tile].iter().filter(|(_, owners)|
                owners.iter().all(|&owner| out.features[owner as usize] & (1 << kind) != 0)
            ).collect();
            let d = points[tile].unit();
            for (section, &face) in faces.iter().enumerate() {
                let seed = hash(
                    (tile as u32).wrapping_mul(7919)
                        ^ (section as u32).wrapping_mul(193)
                        ^ kind * 1031
                        ^ SEED,
                );
                let count = if !feature {
                    usize::from(random(seed ^ 0x714) < background_chance)
                } else if kind == 0 {
                    3 + (seed % 3) as usize
                } else {
                    2 + usize::from(seed % 5 == 0)
                };
                let start = hash(seed ^ 91) as usize % (samples::SPAWN_POINTS.len() - count + 1);
                let e = d.lerp(centers[face].unit(), 0.8);
                let f = d.lerp(centers[faces[(section + 1) % faces.len()]].unit(), 0.8);
                let border_count = if !feature { 0 } else if kind == 0 { 4 } else { usize::from(section % 3 == 0) };
                for slot in 0..(count + border_count) {
                    let mut owners = [tile as u32; 3];
                    let p = if slot < count {
                        let [a, b] = samples::SPAWN_POINTS[start + slot];
                        let direction = d.scale(1.0 - a - b).add(e.scale(a)).add(f.scale(b)).unit();
                        let Some(p) = triangles[tile]
                            .iter()
                            .find_map(|t| hit(direction, t[0], t[1], t[2]))
                        else {
                            continue;
                        };
                        p
                    } else {
                        if matching.is_empty() {
                            continue;
                        }
                        let salt = seed.wrapping_add(slot as u32 * 101);
                        let &(tri, shared) = matching[hash(salt) as usize % matching.len()];
                        owners = shared;
                        let a = random(salt ^ 61).sqrt();
                        let b = random(salt ^ 417);
                        tri[0]
                            .scale(1.0 - a)
                            .add(tri[1].scale(a * (1.0 - b)))
                            .add(tri[2].scale(a * b))
                    };
                    if kind==0 && p.dot(p).sqrt() <= 1.0+WATER_LEVEL*height_step {continue;}
                    let min_distance = if kind == 1 {
                        separation * 0.5
                    } else {
                        separation
                    };
                    let key = (
                        (p.0 / cell).floor() as i32,
                        (p.1 / cell).floor() as i32,
                        (p.2 / cell).floor() as i32,
                    );
                    let mut clear = true;
                    for x in -1..=1 {
                        for y in -1..=1 {
                            for z in -1..=1 {
                                if let Some(ps) = occupied.get(&(key.0 + x, key.1 + y, key.2 + z)) {
                                    if ps.iter().any(|q| {
                                        p.sub(*q).dot(p.sub(*q)) < min_distance * min_distance
                                    }) {
                                        clear = false;
                                    }
                                }
                            }
                        }
                    }
                    if !clear {
                        continue;
                    }
                    occupied.entry(key).or_default().push(p);
                    if kind == 0 && slot >= count {
                        out.edge_trees += 1;
                    }
                    let id =
                        (tile as u32) * 1024 + (section as u32) * 64 + (slot as u32) * 2 + kind;
                    let yaw = random(id ^ 317) * std::f32::consts::TAU;
                    let up = p.unit();
                    let helper = if up.1.abs() < 0.95 {
                        V(0.0, 1.0, 0.0)
                    } else {
                        V(1.0, 0.0, 0.0)
                    };
                    let x = helper.cross(up).unit();
                    let z = x.cross(up);
                    let side = x.scale(yaw.cos()).add(z.scale(yaw.sin()));
                    let forward = side.cross(up);
                    let scale = 1.0 / n as f32;
                    let base = p;
                    let x = side.scale(scale);
                    let y = up.scale(scale);
                    let z = forward.scale(scale);
                    out.prop_matrices.extend([
                        x.0, x.1, x.2, 0.0, y.0, y.1, y.2, 0.0, z.0, z.1, z.2, 0.0, base.0, base.1,
                        base.2, 1.0,
                    ]);
                    out.prop_kinds.push(kind);
                    out.prop_tiles.push(tile as u32);
                    out.prop_owners.extend(owners);
                    out.prop_ids.push(id);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn forest_regions_and_prop_placement_obey_rules() {
        let out = generate_surface(8, 0.8, 0.035, 63);
        let count = out.prop_kinds.len();
        assert!(count > 500);
        assert!(out.edge_trees > 100);
        let mut deposits = BTreeMap::new();
        for (&kind, &tile) in out.prop_kinds.iter().zip(&out.prop_tiles) {
            if kind == 1 && out.features[tile as usize] & 2 != 0 {
                *deposits.entry(tile).or_insert(0) += 1;
            }
        }
        assert!(deposits.values().filter(|&&count| count >= 8).count() > deposits.len() / 2);
        assert!(deposits.values().all(|&count| count <= 18), "deposit density must remain bounded");
        assert_eq!(
            out.prop_ids
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len(),
            count
        );
        let (_, faces) = geodesic(8);
        let mut neighbors = vec![Vec::new(); out.tiles];
        for [a, b, c] in faces {
            for (x, y) in [(a, b), (b, c), (c, a)] {
                neighbors[x].push(y);
                neighbors[y].push(x);
            }
        }
        let mut rock_sections: BTreeMap<u32,std::collections::BTreeSet<u32>>=BTreeMap::new();
        for i in 0..out.prop_kinds.len() {
            if out.prop_kinds[i]==1 && out.features[out.prop_tiles[i] as usize]&2!=0 {rock_sections.entry(out.prop_tiles[i]).or_default().insert((out.prop_ids[i]%1024)/64);}
        }
        for (&tile,sections) in &rock_sections {
            let neighbor_count=neighbors[tile as usize].iter().collect::<std::collections::BTreeSet<_>>().len();
            assert_eq!(sections.len(),neighbor_count,"deposit must cover every tile section");
        }
        let mut seen = vec![false; out.tiles];
        let mut largest = 0;
        for tile in 0..out.tiles {
            if seen[tile] || out.features[tile] & 1 == 0 {
                continue;
            }
            let mut group = vec![tile];
            seen[tile] = true;
            let mut cursor = 0;
            while cursor < group.len() {
                let id = group[cursor];
                cursor += 1;
                for &j in &neighbors[id] {
                    if !seen[j] && out.features[j] & 1 != 0 {
                        seen[j] = true;
                        group.push(j);
                    }
                }
            }

            largest = largest.max(group.len());
        }
        assert!(largest>=2,"forest should include adjacent tiles");
        assert!(out.features.iter().filter(|&&f|f&1!=0).count()>largest);
        assert!(out.features.iter().all(|&f|f!=3));
        let mut submerged = 0;
        let mut snow_stones = 0;
        for i in 0..count {
            let m = &out.prop_matrices[i * 16..i * 16 + 16];
            assert!(m.iter().all(|x| x.is_finite()));
            let p = V(m[12], m[13], m[14]);
            let up = V(m[4], m[5], m[6]).unit();
            assert!(up.dot(p.unit()) > 0.99999);
            let tile = out.prop_tiles[i] as usize;
            if out.prop_kinds[i] == 0 {
                assert_eq!(out.surfaces[tile], 1);
            } else {
                assert!(V(m[0],m[1],m[2]).dot(V(m[0],m[1],m[2])).sqrt()<=1.0/8.0+0.000001);
                if out.surfaces[tile] == 0 && out.prop_owners[i*3..i*3+3].iter().all(|&owner| owner as usize == tile) {
                    submerged += 1;
                    assert!(p.dot(p).sqrt() < 1.0 + 0.65 * 0.035);
                }
                if out.surfaces[tile] == 2 {
                    snow_stones += 1;
                }
            }
            for j in 0..i {
                let m = &out.prop_matrices[j * 16..j * 16 + 16];
                let q = V(m[12], m[13], m[14]);
                assert!(p.sub(q).dot(p.sub(q)).sqrt() > 0.055 / 8.0 - 0.00001);
            }
        }
        assert!(submerged > 0 && snow_stones > 0);
        let mut shared = [0; 2];
        let mut background = [0; 3];
        let mut sparse_counts = BTreeMap::new();
        for i in 0..count {
            let tile = out.prop_tiles[i] as usize;
            let owners = &out.prop_owners[i*3..i*3+3];
            let kind = out.prop_kinds[i] as usize;
            if owners.iter().any(|&owner| owner as usize != tile) {
                shared[kind] += 1;
                assert!(owners.iter().all(|&owner| out.features[owner as usize] & (1 << kind) != 0));
                for &a in owners { for &b in owners {
                    assert!(a == b || neighbors[a as usize].contains(&(b as usize)));
                }}
            }
            if out.features[tile] == 0 {
                background[out.surfaces[tile] as usize] += 1;
                *sparse_counts.entry(tile).or_insert(0) += 1;
                assert!(config::BLUE_PLANET.background_chance[out.surfaces[tile] as usize][kind] > 0.0);
                assert!(owners.iter().all(|&owner| owner as usize == tile));
            }
        }
        assert!(shared.iter().all(|&count| count > 0));
        assert_eq!(background[0], 0);
        assert!(background[1] > 0);
        assert_eq!(background[2], 0);
        for (&kind, &tile) in out.prop_kinds.iter().zip(&out.prop_tiles) {
            if kind == 1 { assert!(out.features[tile as usize] & 2 != 0); }
        }
        assert!(sparse_counts.values().all(|&count| count <= 6));
        let dry = generate_surface(8, 0.8, 0.035, 47);
        assert_eq!(out.prop_ids, dry.prop_ids);
        assert_eq!(out.prop_matrices, dry.prop_matrices);
    }
}
