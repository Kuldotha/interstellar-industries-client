import assert from 'node:assert/strict';
import {fieldLayout,fieldSoilGeometry,agriculturalKind} from '../public/field-layout.js';
import {cropPoints} from '../public/crop-grass.js';
import {tilePolygon,pointInPolygon} from '../public/tile-composition.js';
const config={height:1,spacing:.38,rowSpacing:1.6,rowWidth:1.05};
for(const polygon of [tilePolygon(),Array.from({length:5},(_,i)=>[Math.sin(i*2*Math.PI/5)*8,Math.cos(i*2*Math.PI/5)*8])]){
 const layout=fieldLayout(171,{polygon,height:(x,z)=>.1*x+.05*z}),points=cropPoints(config,171,layout);
 assert(points.length>100);assert.deepEqual(points,cropPoints(config,171,fieldLayout(171,{polygon,height:(x,z)=>.1*x+.05*z})));
 for(const p of points){assert(pointInPolygon(p.x,p.z,polygon));assert(!layout.sample(p.x,p.z).path);assert(Math.abs(p.y-(.1*p.x+.05*p.z))<1e-9);}
 const geometry=fieldSoilGeometry(layout);assert(geometry.positions.every(Number.isFinite));assert(geometry.indices.every(i=>i>=0&&i<geometry.positions.length/3));
 const open=fieldLayout(171,{polygon,connected:polygon.map(()=>true)});
 const edge=layout.edges[0],b=polygon[1],x=(edge.a[0]+b[0])/2+edge.n[0]*.2,z=(edge.a[1]+b[1])/2+edge.n[1]*.2;
 assert.equal(layout.sample(x,z),null);assert(open.sample(x,z));
}
for(const kind of [5,7,9,12,13,14])assert(agriculturalKind(kind));for(const kind of [0,2,11,undefined])assert(!agriculturalKind(kind));
console.log('Field footprints, pentagons, connected margins, deterministic plots and terrain heights pass.');
const {projectFieldPolygon}=await import('../public/field-layout.js');
for(const radius of [1,1.02,1.12]){
 const center=[0,radius,0],right=[1,0,0],forward=[0,0,1],unit=.075/8;
 const corners=tilePolygon().flatMap(([x,z])=>{const p=[x*unit,1,z*unit],length=Math.hypot(...p);return p.map(v=>v/length);});
 const polygon=projectFieldPolygon(center,right,forward,corners,unit);
 for(const [x,z]of polygon){const p=[x*unit,radius,z*unit],length=Math.hypot(...p),direction=p.map(v=>v/length);assert(Array.from({length:6},(_,i)=>Math.hypot(...direction.map((v,j)=>v-corners[i*3+j]))).some(d=>d<1e-10),'Projected boundary must meet its spherical tile corner at every height');}
}
console.log('Spherical field boundaries align at all tested tile heights.');
