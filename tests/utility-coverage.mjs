import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tilesInRange,coverageBoundary,coverageSurface,coveringUtilities} from '../public/utility-coverage.js';
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),c=instance.exports;
for(const height of [.02,.2]){
 c.generate_blue(8,height,23);c.industry_reset();c.industry_restore_progression(20,6,0,0,0);c.industry_restore_pool(0,100,0);
 const count=c.tile_count(),neighbors=new Uint32Array(c.memory.buffer,c.tile_neighbors_ptr(),count*6).slice(),corners=new Float32Array(c.memory.buffer,c.tile_corners_ptr(),count*18).slice(),surfaces=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),count).slice();
 assert.equal(coverageBoundary(new Set(Array.from({length:count},(_,i)=>i)),corners).length,0);
 const tile=surfaces.findIndex(s=>s!==0);assert.equal(c.industry_build(tile,4),0);
 const tiles=tilesInRange(tile,neighbors);
 for(let t=0;t<count;t++)assert.equal(tiles.has(t),Boolean(c.industry_covered(t)));
 const centers=new Float32Array(c.memory.buffer,c.tile_centers_ptr(),count*3).slice();
 const geometry=coverageSurface(tiles,centers,corners,1+.65*height);
 assert(geometry.positions.every(Number.isFinite));assert(geometry.indices.every(i=>i<geometry.positions.length/3));
 const radius=t=>Math.max(Math.hypot(...centers.slice(t*3,t*3+3)),1+.65*height);
 const first=Array.from({length:count},(_,i)=>i).find(t=>Array.from(neighbors.slice(t*6,t*6+6)).some(n=>n<count&&Math.abs(radius(t)-radius(n))>.001));
 const second=Array.from(neighbors.slice(first*6,first*6+6)).find(n=>n<count&&Math.abs(radius(first)-radius(n))>.001);
 assert.equal(coverageSurface(new Set([first,second]),centers,corners,1+.65*height).connectorTriangles,12);
 assert.equal(coverageSurface(new Set([first]),centers,corners,1+.65*height).connectorTriangles,0);
 const boundary=coverageBoundary(tiles,corners);assert(boundary.length>0);
 const endpointCounts=new Map(),key=p=>p.map(v=>Math.round(v*1e6)).join(',');
 for(const e of boundary)for(const p of [e.a,e.b])endpointCounts.set(key(p),(endpointCounts.get(key(p))||0)+1);
 assert([...endpointCounts.values()].every(n=>n===2));
 assert(tilesInRange(null,neighbors).size===0);
 assert.equal(coveringUtilities(tile,[[tile,4,0]],neighbors).length,1);
 assert.equal(coveringUtilities(tile,[[tile,4,1]],neighbors).length,0);
 assert.equal(coveringUtilities(tile,[[tile,2,0]],neighbors).length,0);
}
console.log('Utility coverage matches simulation, excludes paused providers, and has closed borders with no internal edges.');
