import assert from 'node:assert/strict';
import {waterGeometry} from '../public/water-geometry.js';
for(const subdivisions of [1,8]){
 const mesh=waterGeometry({VertexData:class {}},subdivisions);
 assert.equal(mesh.indices.length,subdivisions*subdivisions*3);
 let area=0;
 for(let i=0;i<mesh.positions.length;i+=9){
  const p=mesh.positions.slice(i,i+9);
  const cross=(p[3]-p[0])*(p[7]-p[1])-(p[4]-p[1])*(p[6]-p[0]);
  assert(cross<0);area-=cross/2;
 }
 assert(Math.abs(area-Math.sqrt(3)/4)<1e-12);
}
const exitDistance=(eye,ray,radius,backgroundDistance=Infinity)=>{
 const projection=eye.reduce((sum,x,i)=>sum+x*ray[i],0);
 const discriminant=projection*projection+radius*radius-eye.reduce((sum,x)=>sum+x*x,0);
 const near=Math.max(0,-projection-Math.sqrt(Math.max(0,discriminant)));
 const far=-projection+Math.sqrt(Math.max(0,discriminant));
 return discriminant>0?Math.max(0,Math.min(far,backgroundDistance)-near):0;
};
assert.equal(exitDistance([0,0,2],[0,0,-1],1),2);
assert(exitDistance([1,0,2],[0,0,-1],1)<1e-12);
assert.equal(exitDistance([0,0,2],[0,0,-1],1,.9),0);
assert.equal(exitDistance([0,0,2],[0,0,-1],1,1),0);
assert.equal(exitDistance([0,0,2],[0,0,-1],1,1.5),.5);
assert.equal(exitDistance([0,0,2],[0,0,-1],1,4),2);
assert.equal(exitDistance([0,0,0],[0,0,-1],1,.25),.25);
assert.equal(exitDistance([0,0,2],[0,0,1],1),0);
assert.equal(exitDistance([1.01,0,2],[0,0,-1],1),0);
console.log('Water subdivision preserves area and winding; sphere traversal vanishes at the sky tangent.');
