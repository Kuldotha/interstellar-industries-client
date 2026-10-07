import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coastlineBuffers,segmentDistance,triangleVertices} from '../public/coast.js';
assert.equal(segmentDistance([.5,1,0],[0,0,0],[1,0,0]),1);
assert.equal(segmentDistance([2,0,0],[0,0,0],[1,0,0]),1);
const {instance:{exports:core}}=await WebAssembly.instantiate(await readFile(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
for(const resolution of [5,8]) {
 const count=core.generate_blue(resolution,.035,23),water=core.water_section_count();
 const radius=1+.65*.035;
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16);
 const coast=coastlineBuffers(matrices,count-water,water,radius,resolution);
 assert(coast.segmentCount>0);
 for(const buffer of coast.buffers){assert.equal(buffer.length,water*3);assert(buffer.every(id=>Number.isInteger(id)&&id>=0&&id<coast.segmentCount));}
 for(let id=0;id<coast.segmentCount;id++)for(let endpoint=0;endpoint<2;endpoint++) {
  const decoded=Array.from({length:3},(_,k)=>{const offset=id*16+endpoint*8+k*2;return (coast.textureData[offset]*256+coast.textureData[offset+1])*4/65535-2;});
  assert(Math.abs(Math.hypot(...decoded)-radius)<1e-4);
 }
 let checked=0,worst=0;
 for(let i=0;i<water;i++) {
  const vertices=triangleVertices(matrices.subarray((count-water+i)*16,(count-water+i+1)*16));
  const samples=[...vertices,...vertices.map((p,j)=>p.map((x,k)=>(x+vertices[(j+1)%3][k])/2))];
  const selected=coast.buffers.flatMap(buffer=>Array.from(buffer.subarray(i*3,i*3+3))).map(id=>coast.segments[id]);
  for(const p of samples){const exact=Math.min(...coast.segments.map(s=>segmentDistance(p,...s)));if(exact>.4/resolution)continue;const local=Math.min(...selected.map(s=>segmentDistance(p,...s)));worst=Math.max(worst,local-exact);checked++;assert(local-exact<.005/resolution,'coastal wave must follow the complete shoreline, not an isolated segment');}
 }
 console.log(`Coast ${resolution}: ${checked} coastal samples, maximum nearest-segment error ${worst}; packed shoreline references valid.`);
}
