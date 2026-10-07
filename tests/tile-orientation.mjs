import fs from 'node:fs';
import assert from 'node:assert/strict';
import {tilePolygon} from '../public/tile-composition.js';
import {tileNeighborOffset} from '../public/model-units.js';
const polygon=tilePolygon();
for(let side=0;side<6;side++){
 const [x,z]=tileNeighborOffset(side),a=polygon[(side+5)%6],b=polygon[side];
 assert(Math.hypot((a[0]+b[0])/2-x/2,(a[1]+b[1])/2-z/2)<1e-10);
}
assert(Math.abs(polygon[0][0]-5)<1e-10);
assert.deepEqual(tileNeighborOffset(0),[0,Math.sqrt(3)*10]);
const {instance:{exports:core}}=await WebAssembly.instantiate(fs.readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
const bytes=fs.readFileSync(new URL('../public/layouts/equal-area-8.bin',import.meta.url)),values=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
const pointer=core.visual_layout_buffer(642);
new Float32Array(core.memory.buffer,pointer,values.length).set(values);core.generate_blue(8,.02,87);
const centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),642*3),corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),642*18),neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),642*6);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=a=>a.map(v=>v/Math.hypot(...a)),tangent=(p,up)=>unit(p.map((v,i)=>v-up[i]*dot(p,up)));
let tested=0;
for(let tile=0;tile<642;tile++){
 if(neighbors[tile*6+5]===0xffffffff)continue;
 const up=unit(Array.from(centers.slice(tile*3,tile*3+3))),points=Array.from({length:6},(_,i)=>Array.from(corners.slice(tile*18+i*3,tile*18+i*3+3)));
 for(let side=0;side<6;side++){
  const other=neighbors[tile*6+side],forward=tangent(unit(Array.from(centers.slice(other*3,other*3+3))),up);
  const angle=v=>Math.acos(Math.max(-1,Math.min(1,v)));
  const cornerAngle=Math.min(...points.map(p=>angle(dot(tangent(p,up),forward))));
  const edgeAngle=Math.min(...points.map((p,i)=>angle(dot(tangent(p.map((v,k)=>v+points[(i+1)%6][k]),up),forward))));
  assert(cornerAngle>.25,'Building forward must not point at a corner');
  assert(edgeAngle<cornerAngle,'Building forward must align with an edge rather than a corner');tested++;
 }
}
console.log(`Editor +Z faces an edge; all ${tested} game hexagon facings match that convention.`);
