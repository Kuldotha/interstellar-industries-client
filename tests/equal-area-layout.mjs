import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadVisualLayout} from '../public/visual-layout.js';
import {cellMetrics} from '../tools/equal-area-layout.js';
const {instance:{exports:core}}=await WebAssembly.instantiate(fs.readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),originalFetch=globalThis.fetch;
try{
 globalThis.fetch=async path=>new Response(fs.readFileSync(new URL('../public/'+path,import.meta.url)));
 for(const n of [5,8,12,16]){
  core.visual_layout_buffer(0);core.generate_blue(n,.02,23);
  const count=core.tile_count(),read=(name,size)=>new Uint32Array(core.memory.buffer,core[name](),size).slice(),surfaces=read('surfaces_ptr',count),features=read('features_ptr',count),neighbors=read('tile_neighbors_ptr',count*6);
  (await loadVisualLayout(n))(core);core.generate_blue(n,.02,23);
  assert.deepEqual(read('surfaces_ptr',count),surfaces);assert.deepEqual(read('features_ptr',count),features);assert.deepEqual(read('tile_neighbors_ptr',count*6),neighbors);
  const corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),count*18),centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),count*3),target=4*Math.PI/count;
  for(let tile=0;tile<count;tile++){
   const vertices=Array.from({length:6},(_,side)=>Array.from(corners.slice(tile*18+side*3,tile*18+side*3+3))).filter(v=>Math.hypot(...v)>.1),center=Array.from(centers.slice(tile*3,tile*3+3)),length=Math.hypot(...center),m=cellMetrics(vertices,vertices.map((_,i)=>i),center.map(v=>v/length));
   assert(m.convex);assert(Math.abs(Math.abs(m.area)/target-1)<.0001);
  }
 }
}finally{globalThis.fetch=originalFetch;}
console.log('Equal-area assets: loader, corner ordering, convexity, area within 0.01%, unchanged surfaces/features/neighbors at all four resolutions.');
