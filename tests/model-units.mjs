import assert from 'node:assert/strict';
import {TILE_RADIUS_METERS,TILE_RADIUS_UNITS,metersToWorldScale,scaleModelMatrices} from '../public/model-units.js';
assert.equal(TILE_RADIUS_METERS,10);
for(const n of [4,8,16]){
 assert.equal(metersToWorldScale(n)*10,TILE_RADIUS_UNITS/n);
 const m=new Float32Array([1/n,0,0,0,0,1/n,0,0,0,0,1/n,0,2,3,4,1]);scaleModelMatrices(m);
 for(const i of [0,5,10])assert(Math.abs(m[i]-metersToWorldScale(n))<1e-8);
 assert.deepEqual(Array.from(m.slice(12)),[2,3,4,1]);
}
console.log('Model metres: shared conversion, resolution scaling, and unchanged instance positions pass.');
