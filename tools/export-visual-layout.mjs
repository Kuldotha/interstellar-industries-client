import fs from 'node:fs/promises';
import {unit,triangleArea,topologyEdges,optimizeLayout,quantizeLayout} from './equal-area-layout.js';
const root=new URL('../public/',import.meta.url),{instance:{exports:core}}=await WebAssembly.instantiate(await fs.readFile(new URL('planet_geometry.wasm',root)),{});
export function extractLayout(n){
 core.generate_blue(n,.02,23);const count=core.tile_count(),c=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),count*3),corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),count*18),adj=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),count*6);
 const vertices=[],cells=[],centers=[],neighbors=[],ids=new Map();
 for(let i=0;i<count;i++){
  const center=unit(Array.from(c.slice(i*3,i*3+3))),cell=[];
  for(let j=0;j<6;j++){const p=Array.from(corners.slice(i*18+j*3,i*18+j*3+3));if(Math.hypot(...p)<.1)continue;const key=p.join(',');if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(unit(p));}cell.push(ids.get(key));}
  if(triangleArea(center,vertices[cell[0]],vertices[cell[1]])<0)cell.reverse();cells.push(cell);centers.push(center);neighbors.push(Array.from(adj.slice(i*6,i*6+6)).filter(v=>v!==0xffffffff));
 }
 const edges=topologyEdges(cells);if(edges.some(e=>e.tiles.length!==2))throw Error('Non-manifold topology');
 return {resolution:n,vertices,cells,centers,neighbors};
}
await fs.mkdir(new URL('layouts/',root),{recursive:true});
for(const resolution of [5,8,12,16]){
 const baseline=extractLayout(resolution),layout=quantizeLayout(optimizeLayout(baseline,{iterations:1000,uniformEdges:true,edgeWeight:0,radiusWeight:0,inradiusWeight:0,anchorWeight:0}).layout);
 core.generate_blue(resolution,.02,23);
 const count=core.tile_count(),corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),count*18),buffer=new Float32Array(count*21);
 layout.cells.forEach((cell,tile)=>{
  buffer.set(layout.centers[tile],tile*21);const assigned=new Set();
  for(let side=0;side<cell.length;side++){
   const p=corners.subarray(tile*18+side*3,tile*18+side*3+3),dot=id=>baseline.vertices[id].reduce((s,v,k)=>s+v*p[k],0),id=cell.reduce((a,b)=>dot(a)>dot(b)?a:b);
   if(assigned.has(id))throw Error('Duplicate visual corner');assigned.add(id);buffer.set(layout.vertices[id],tile*21+3+side*3);
  }
 });
 const bytes=new DataView(new ArrayBuffer(buffer.byteLength));buffer.forEach((v,i)=>bytes.setFloat32(i*4,v,true));
 await fs.writeFile(new URL(`layouts/equal-area-${resolution}.bin`,root),Buffer.from(bytes.buffer));
}
