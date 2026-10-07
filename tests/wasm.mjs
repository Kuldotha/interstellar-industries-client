import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const bytes = await readFile(new URL('../public/planet_geometry.wasm', import.meta.url));
const {instance:{exports:core}} = await WebAssembly.instantiate(bytes, {});
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const transform = (m,x,y) => [0,1,2].map(i=>m[i]*x+m[4+i]*y+m[12+i]);
for (const n of [1,2,5,8,16,32]) {
  const count = core.generate(n,1);
  assert.equal(count,60*n*n);
  assert.equal(core.tile_count(),10*n*n+2);
  assert.equal(core.pentagon_count(),12);
  const matrices = new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16).slice();
  const ids = new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),count).slice();
  const counts = new Map();
  for (const id of ids) counts.set(id,(counts.get(id)??0)+1);
  assert.equal(counts.size,10*n*n+2);
  assert.equal([...counts.values()].filter(x=>x===5).length,12);
  assert([...counts.values()].every(x=>x===5||x===6));
  for (let i=0;i<count;i++) {
    const m=matrices.subarray(i*16,i*16+16);
    assert(m.every(Number.isFinite));
    const a=transform(m,-1,0), b=transform(m,0,0), c=transform(m,-.5,-Math.sqrt(3)/2);
    for (const p of [a,b,c]) assert(Math.abs(dot(p,p)-1)<2e-6);
    assert(dot(cross(sub(b,a),sub(c,a)),b)>0);
  }
  core.generate(n,1);
  assert.deepEqual(new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16),matrices);
  console.log(`resolution ${n}: ${core.tile_count()} tiles, ${count} instances; topology, winding, radius and repeatability pass`);
}
assert.equal(core.generate(0,1),0);
assert.equal(core.generate(65,1),0);
assert.equal(core.generate(8,NaN),0);
console.log('WASM ABI and invalid-input checks pass.');
for (const n of [1,8,32]) {
  for (const height of [0,0.035,0.12]) {
    const count = core.generate_connected(n,height,7);
    assert.equal(count,140*n*n);
    assert.equal(core.section_count(),60*n*n);
    assert.equal(core.edge_count(),30*n*n);
    assert.equal(core.corner_count(),20*n*n);
    const m = new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16);
    assert(m.every(Number.isFinite));
    const kinds = new Uint32Array(core.memory.buffer,core.kinds_ptr(),count);
    assert.equal(kinds.filter(k=>k===0).length,60*n*n);
    assert.equal(kinds.filter(k=>k===1).length,60*n*n);
    assert.equal(kinds.filter(k=>k===2).length,20*n*n);
  }
  assert.equal(core.generate_connected(n,.035,1),60*n*n);
  assert.equal(core.generate_connected(n,.035,2),60*n*n);
  assert.equal(core.generate_connected(n,.035,4),20*n*n);
  assert.equal(core.generate_connected(n,.035,0),0);
}
console.log('Connected WASM counts, piece flags and mixed-height buffers pass.');
for (const resolution of [1,8,16]) {
  for (const height of [0,.035,.12]) {
    const count=core.generate_authored(resolution,height,7);
    assert(count>140*resolution*resolution);
    const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16);
    assert(matrices.every(Number.isFinite));
    const colors=new Float32Array(core.memory.buffer,core.colors_ptr(),count*4);
    assert(colors.every(Number.isFinite));
    console.log(`authored resolution ${resolution}, step ${height}: ${count} triangles, finite matrices/colors`);
  }
}
assert.equal(core.generate_authored(17,.035,7),0);
assert.equal(core.generate_authored(8,.035,0),0);
console.log('Authored WASM checks pass.');
for (const height of [0,.035,.12]) {
 const count=core.generate_authored(8,height,7);
 const normals=new Float32Array(core.memory.buffer,core.normals_ptr(),count*9);
 assert(normals.every(Number.isFinite));
 for(let i=0;i<normals.length;i+=3) assert(Math.abs(Math.hypot(...normals.subarray(i,i+3))-1)<2e-5);
 const kinds=new Uint32Array(core.memory.buffer,core.kinds_ptr(),count);
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16);
 for(let i=0;i<count;i++) {
  if(kinds[i]!==0) continue;
  const m=matrices.subarray(i*16,i*16+16);
  const vertices=[transform(m,-1,0),transform(m,0,0),transform(m,-.5,-Math.sqrt(3)/2)];
  for(let j=0;j<3;j++) {
   const n=normals.subarray(i*9+j*3,i*9+j*3+3),p=vertices[j];
   assert(dot(n,p)/Math.hypot(...p)>.99999);
  }
 }
}
console.log('Normal buffers are finite/unit length, and every section vertex points radially outward.');
const definition=JSON.parse(await readFile(new URL('../public/blue-home.json',import.meta.url),'utf8'));
for(const resolution of [5,8,16]) {
 const count=core.generate_blue(resolution,.035,23);
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16).slice();
 const colors=new Float32Array(core.memory.buffer,core.vertex_colors_ptr(),count*12).slice();
 const normals=new Float32Array(core.memory.buffer,core.normals_ptr(),count*9).slice();
 const kinds=new Uint32Array(core.memory.buffer,core.kinds_ptr(),count).slice();
 const surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count()).slice();
 const ids=new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),count).slice();
 assert(matrices.every(Number.isFinite)); assert(colors.every(Number.isFinite));
 assert.equal(new Set(surfaces).size,3);
 const waterCount=core.water_section_count();
 assert.equal(waterCount,kinds.filter(x=>x===3).length);
 assert(kinds.some((kind,i)=>kind===3 && surfaces[ids[i]]!==0), "water must extend under coastal land to reach cliffs");
 for(let i=0;i<count;i++) {
  if(kinds[i]!==3) continue;
  assert(surfaces[ids[i]]<=2);
  const m=matrices.subarray(i*16,i*16+16);
  const vertices=[transform(m,-1,0),transform(m,0,0),transform(m,-.5,-Math.sqrt(3)/2)];
  for(let j=0;j<3;j++) {
   assert(Math.abs(Math.hypot(...vertices[j])-(1+.65*.035))<2e-6);
   assert(dot(normals.subarray(i*9+j*3,i*9+j*3+3),vertices[j])/Math.hypot(...vertices[j])>.99999);
   for(let c=0;c<4;c++) assert(Math.abs(colors[i*12+j*4+c]-definition.water.color[c])<1e-7);
  }
 }
 const dryCount=core.generate_blue(resolution,.035,7);
 assert.equal(count-dryCount,waterCount);
 assert.deepEqual(new Float32Array(core.memory.buffer,core.matrices_ptr(),dryCount*16),matrices.subarray(0,dryCount*16));
 assert.deepEqual(new Float32Array(core.memory.buffer,core.vertex_colors_ptr(),dryCount*12),colors.subarray(0,dryCount*12));
 assert(new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),dryCount).some(id=>surfaces[id]===0));
 console.log(`Blue world ${resolution}: one planetary biome, three surface types, ${waterCount} uniform full-size water sections; underlying terrain unchanged.`);
}
for(const n of [5,8,16]) {
 core.generate_blue(n,.035,23);
 const count=core.prop_count();assert(count>0);
 const matrices=new Float32Array(core.memory.buffer,core.prop_matrices_ptr(),count*16).slice();
 const ids=new Uint32Array(core.memory.buffer,core.prop_ids_ptr(),count).slice();
 const kinds=new Uint32Array(core.memory.buffer,core.prop_kinds_ptr(),count);
 const tiles=new Uint32Array(core.memory.buffer,core.prop_tiles_ptr(),count);
 const features=new Uint32Array(core.memory.buffer,core.features_ptr(),core.tile_count());
 assert(matrices.every(Number.isFinite));assert.equal(new Set(ids).size,count);
 const owners=new Uint32Array(core.memory.buffer,core.prop_owners_ptr(),count*3);
 for(let i=0;i<count;i++) {
   assert(features[tiles[i]]===0 || features[tiles[i]]&(1<<kinds[i]));
   for(const owner of owners.subarray(i*3,i*3+3)) {
     assert(owner<core.tile_count());
     if(owner!==tiles[i])assert(features[owner]&(1<<kinds[i]));
   }
 }
 core.generate_blue(n,.035,7);assert.equal(core.prop_count(),count);
 assert.deepEqual(new Float32Array(core.memory.buffer,core.prop_matrices_ptr(),count*16),matrices);
 assert.deepEqual(new Uint32Array(core.memory.buffer,core.prop_ids_ptr(),count),ids);
 console.log(`Props ${n}: ${count} instances; feature membership, unique IDs and water-independent matrices pass.`);
}

for(const height of [.01,.2]){
 const count=core.generate_blue(8,height,23);
 assert(count>0);assert.equal(core.tile_count(),642);
 assert(new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16).every(Number.isFinite));
 assert(new Float32Array(core.memory.buffer,core.normals_ptr(),count*9).every(Number.isFinite));
 assert(core.water_section_count()>0);
}
assert.equal(core.generate_blue(8,.201,23),0);
console.log('Blue planet height boundaries: visible finite geometry at 0.2 and rejection above the supported range.');
