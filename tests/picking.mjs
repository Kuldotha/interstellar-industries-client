import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTileIndex,triangleHit} from '../public/tile-picking.js';
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),core=instance.exports;
for(const flags of [7,23]){
 const count=core.generate_blue(5,.035,flags);
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16).slice();
 const ids=new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),count).slice(),kinds=new Uint32Array(core.memory.buffer,core.kinds_ptr(),count).slice();
 const centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),core.tile_count()*3).slice();
 const index=createTileIndex(matrices,ids,kinds,centers);
 assert.equal(index.pick([0,0,4],[0,0,1]),null);
 let checks=0;
 for(let i=0;i<core.tile_count();i+=7){
  const p=Array.from(centers.subarray(i*3,i*3+3)),length=Math.hypot(...p),direction=p.map(x=>-x/length),origin=p.map(x=>x*3/length);
  const hit=index.pick(origin,direction);assert.ok(hit);assert.equal(hit.tile,i);checks+=hit.checks;
  let closest=Infinity;
  for(const t of index.triangles)closest=Math.min(closest,triangleHit(origin,direction,t.a,t.b,t.c));
  assert.ok(Math.abs(hit.distance-closest)<1e-7);
 }
 // Oblique rays verify frontmost cliff/water visibility, not just radial tile centers.
 for(let i=0;i<20;i++){
  const origin=[0,0,3],d=[(i%5-2)*.12,(Math.floor(i/5)-1.5)*.16,-1],l=Math.hypot(...d),direction=d.map(x=>x/l);
  const hit=index.pick(origin,direction);
  let closest=Infinity;for(const t of index.triangles)closest=Math.min(closest,triangleHit(origin,direction,t.a,t.b,t.c));
  assert.equal(!!hit,Number.isFinite(closest));if(hit)assert.ok(Math.abs(hit.distance-closest)<1e-7);
 }
 console.log(`Picking flags ${flags}: radial tile IDs, oblique nearest hits and empty space pass; average ${Math.round(checks/36)} triangle checks vs ${count} triangles.`);
}
