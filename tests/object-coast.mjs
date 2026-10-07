import assert from 'node:assert/strict';
import {waterlineSegments,objectCoastBuffers} from '../public/object-coast.js';
const positions=[-.1,-.1,.9,.1,-.1,.9,.1,.1,.9,-.1,.1,.9,-.1,-.1,1.1,.1,-.1,1.1,.1,.1,1.1,-.1,.1,1.1];
const indices=new Uint32Array([0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,0,2,1,0,3,2,4,5,6,4,6,7]);
const segments=waterlineSegments(positions,indices,1);
assert.equal(segments.length,8);
for(const segment of segments)for(const p of segment)assert(Math.abs(Math.hypot(...p)-1)<1e-6);
const nodes=new Map();for(const segment of segments)for(const p of segment){const key=p.map(x=>x.toFixed(5)).join(',');nodes.set(key,(nodes.get(key)||0)+1);}
assert([...nodes.values()].every(n=>n===2));
assert.equal(waterlineSegments(positions.map(v=>v*.7),indices,1).length,0);
assert.equal(waterlineSegments(positions.map((v,i)=>i%3===2?v+.5:v),indices,1).length,0);
const matrix=new Float32Array([.2,0,0,0,0,.2,0,0,0,0,1,0,.1,.05,1,1]);
const packed=objectCoastBuffers(segments,matrix,1,8);
assert.equal(packed.ranges[1],8);
for(let i=0;i<segments.length;i++){
 const decoded=[Array.from(packed.data.slice(i*8,i*8+3)),Array.from(packed.data.slice(i*8+4,i*8+7))];
 assert(segments.some(segment=>segment.every((p,j)=>p.every((v,k)=>Math.abs(v-decoded[j][k])<1e-6))));
}
assert.deepEqual(objectCoastBuffers([],matrix,1,8).ranges,new Float32Array([0,0]));
console.log('Object waterlines: closed crossings, typed indices, submerged/above-water exclusion, section lookup and texture packing pass.');
