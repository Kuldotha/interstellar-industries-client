import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createGrass} from '../public/grass.js';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js');
const engine=new B.NullEngine(),scene=new B.Scene(engine),camera=new B.FreeCamera('test',new B.Vector3(0,0,1.1),scene);
const {instance:{exports:core}}=await WebAssembly.instantiate(fs.readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
try{
 const count=core.generate_blue(8,.02,23),terrain=count-core.water_section_count();
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16).slice();
 const colors=new Float32Array(core.memory.buffer,core.vertex_colors_ptr(),count*12);
 const tints=Array.from({length:3},(_,j)=>Float32Array.from({length:count*4},(_,i)=>colors[Math.floor(i/4)*12+j*4+i%4]));
 const grass=createGrass(B,scene,camera),collision={blockers:()=>[]};
 const original=grass.generate(core,matrices,tints,terrain,8,1.013,collision);
 assert(original>1000,`Expected land grass, got ${original}`);
 for(const tint of tints)tint.fill(.5);
 assert.equal(grass.generate(core,matrices,tints,terrain,8,1.013,collision),original,'Grass eligibility must not depend on palette colors');
 grass.update(0,true);assert(grass.stats().visible>0,'Grass should be visible close to the planet');
 assert.equal(grass.meshes.length,3);assert(grass.meshes.every(m=>m.thinInstanceCount>0),'All meadow variants should be present');assert(grass.stats().triangles<grass.stats().visible*5.2,'Sparse variants keep triangle cost close to ordinary grass');grass.show(false);assert(grass.meshes.every(m=>!m.isEnabled()));grass.show(true);grass.update(200,true);
 const baseline=grass.stats().visible,areas=[],times=[];
 const centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),core.tile_count()*3);
 for(let id=0;id<80;id++){
  const center=B.Vector3.FromArray(centers,id*3),up=center.normalizeToNew(),right=B.Vector3.Cross(Math.abs(up.y)>.95?B.Axis.X:B.Axis.Y,up).normalize(),forward=B.Vector3.Cross(right,up).normalize();
  areas.push({id,center:center.asArray(),right:right.asArray(),forward:forward.asArray(),scale:1/8,patches:[{x:0,z:0,yaw:0,halfX:.6,halfZ:.6}]});
  const start=performance.now();grass.setGroundCover(areas);times.push(performance.now()-start);
 }
 grass.setGroundCover([]);grass.update(400,true);assert.equal(grass.stats().visible,baseline,'Removing cover restores the same visible grass');
 console.log('Cover update ms, first ten / last ten:',(times.slice(0,10).reduce((a,b)=>a+b)/10).toFixed(2),(times.slice(-10).reduce((a,b)=>a+b)/10).toFixed(2));
 console.log(`${original} grass candidates; neutral palette preserves placement; ${grass.stats().visible} visible close up.`);
}finally{scene.dispose();engine.dispose();}
