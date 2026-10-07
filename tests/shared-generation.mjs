import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {instance:{exports:core}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)));
const maps=JSON.parse(readFileSync(new URL('../../interstellar-industries-program/planet-generation-bench/maps.json',import.meta.url)));
assert.equal(core.planet_generator_version(),3);
for(const n of [5,8,12,16]){
 const ref=maps.find(m=>m.resolution===n&&m.seed===1701),top=readFileSync(new URL(`../../interstellar-industries-program/planet-generation-bench/fixtures/fixed-topology-${n}.bin`,import.meta.url));
 let previous;
 for(const step of [.02,.035,.12]){
  core.generate_blue(n,step,15);const count=core.tile_count();
  const centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),count*3).slice();
  const features=new Uint32Array(core.memory.buffer,core.features_ptr(),count).slice();
  const surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),count).slice();
  const neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),count*6).slice();
  for(let i=0;i<count;i++){
   const [h,s,f]=ref.tiles[i],height=h>127?h-256:h;
   assert.equal(features[i],f,`feature ${n}:${i}`);assert.equal(surfaces[i],s,`surface ${n}:${i}`);
   assert(Math.abs((Math.hypot(...centers.slice(i*3,i*3+3))-1)/step-height)<.0001,`height ${n}:${i}`);
   for(let side=0;side<6;side++)assert.equal(neighbors[i*6+side],top.readUInt32LE(20+i*36+side*4),`neighbor ${n}:${i}:${side}`);
  }
  if(previous)assert.deepEqual(neighbors,previous);previous=neighbors;
 }
}
console.log('Shared generation: renderer heights, surfaces, features and canonical neighbours match SBF fixtures across four resolutions and three height scales.');
