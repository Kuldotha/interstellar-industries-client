import assert from 'node:assert/strict';
import {subdivideBuildingGeometry} from '../public/building-wrap.js';
const source={positions:[-1,.2,0,1,.2,0,0,.2,2],normals:[0,-1,0,0,-1,0,0,-1,0],uvs:[0,0,1,0,.5,1],indices:[0,1,2]},before=structuredClone(source);
const mesh=subdivideBuildingGeometry(source,1.1,.15);
assert.deepEqual(source,before);
assert.ok(mesh.indices.length>3);
let area=0;
for(let i=0;i<mesh.positions.length;i+=3){assert.ok(Math.abs(mesh.positions[i+1]-.2)<1e-12);assert.ok(mesh.positions[i+2]>=0&&mesh.positions[i+2]<=2);assert.ok(Math.hypot(mesh.normals[i],mesh.normals[i+1]+1,mesh.normals[i+2])<1e-12);}
for(let i=0;i<mesh.indices.length;i+=3){
  const [a,b,c]=mesh.indices.slice(i,i+3).map(j=>mesh.positions.slice(j*3,j*3+3));
  const signed=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);assert.ok(signed>0);area+=signed/2;
}
assert.ok(Math.abs(area-2)<1e-10);
assert.equal(mesh.uvs.length,mesh.positions.length/3*2);
console.log('Building geometry: subdivision preserves the unwarped plane, area, winding, normals, UVs and source data.');
