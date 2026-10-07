import fs from 'node:fs';
import assert from 'node:assert/strict';
import {previewTerrain,PREVIEW_HEIGHT_STEP} from '../public/editor/tile-terrain.js';
const shapes=JSON.parse(fs.readFileSync(new URL('../public/editor/terrain-shapes.json',import.meta.url)));
for(let level=-3;level<=3;level++){
 const tiles=[{x:0,z:0,height:0},...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return {x:Math.sin(a)*Math.sqrt(3)*10,z:Math.cos(a)*Math.sqrt(3)*10,height:level*PREVIEW_HEIGHT_STEP};})];
 const g=previewTerrain(tiles,shapes,[.4,.7,.2],[.3,.3,.3]);
 assert.equal(g.pieces.filter(p=>p.kind===0).length,42);
 assert.equal(g.pieces.filter(p=>p.kind===1&&!p.boundary).length,12);
 assert.equal(g.pieces.filter(p=>p.kind===2&&!p.boundary).length,6);
 assert.equal(g.pieces.filter(p=>p.kind===1&&p.boundary).length,18);
 assert.equal(g.pieces.filter(p=>p.kind===2&&p.boundary).length,6);
 const projectedArea=g.indices.reduce((sum,id,i)=>{
  if(i%3)return sum;const [a,b,c]=g.indices.slice(i,i+3).map(id=>g.positions.slice(id*3,id*3+3));
  return sum+Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))/2;
 },0);
 if(level===0)assert(Math.abs(projectedArea-7*150*Math.sqrt(3))<.01, 'Terrain must cover all seven full hexagons without overlapping faces');
 assert(g.positions.every(Number.isFinite));assert(g.normals.every(Number.isFinite));
 for(let i=0;i<g.positions.length;i+=3){assert(g.positions[i+1]>=10+Math.min(0,level*PREVIEW_HEIGHT_STEP)-1e-4);assert(g.positions[i+1]<=10+Math.max(0,level*PREVIEW_HEIGHT_STEP)+.014);assert(Math.abs(Math.hypot(...g.normals.slice(i,i+3))-1)<1e-6);}
 for(const p of g.pieces.filter(p=>p.kind===1&&p.index!==1)){
  const heights=g.indices.slice(p.start,p.start+p.count).map(i=>g.positions[i*3+1]);
  assert(Math.abs(Math.min(...heights)-(10+Math.min(0,level*PREVIEW_HEIGHT_STEP)))<1e-4);
  assert(Math.abs(Math.max(...heights)-(10+Math.max(0,level*PREVIEW_HEIGHT_STEP)))<1e-4);
 }
}
const single=previewTerrain([{x:0,z:0,height:0}],shapes,[.4,.7,.2],[.3,.3,.3]);
assert.equal(single.pieces.filter(p=>p.boundary).length,6);
console.log('Tile preview: full outer boundary, 18 outer edge strips, 6 outer corners; 42 sections, 12 shared edges, 6 three-tile corners; correct height bounds and unit normals at all seven height differences.');
