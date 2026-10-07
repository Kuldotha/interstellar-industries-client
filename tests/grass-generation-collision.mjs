import {createPropGrassCollision} from '../public/prop-grass-collision.js';
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
 const grass=createGrass(B,scene,camera),collision=createPropGrassCollision(B,JSON.parse(fs.readFileSync(new URL('../public/props.json',import.meta.url))),{count:core.prop_count(),groups:new Uint32Array(core.memory.buffer,core.prop_kinds_ptr(),core.prop_count()),matrices:new Float32Array(core.memory.buffer,core.prop_matrices_ptr(),core.prop_count()*16),owners:new Uint32Array(core.memory.buffer,core.prop_owners_ptr(),core.prop_count()*3)});
 const original=grass.generate(core,matrices,tints,terrain,8,1.013,collision);
 assert(original>1000,`Expected land grass, got ${original}`);
 for(const tint of tints)tint.fill(.5);
 assert.equal(grass.generate(core,matrices,tints,terrain,8,1.013,collision),original,'Grass eligibility must not depend on palette colors');
 grass.update(0,true);assert(grass.stats().visible>0,'Grass should be visible close to the planet');
 const blockedVisible=grass.stats().visible;
 grass.setOccupied(new Set(Array.from({length:core.tile_count()},(_,i)=>i)));grass.update(1,true);
 assert(grass.stats().visible>blockedVisible,'Removing props should reveal grass');
 grass.setOccupied(new Set());grass.update(2,true);assert.equal(grass.stats().visible,blockedVisible,'Restoring props should restore grass exclusions');
 console.log(`${original} grass candidates; neutral palette preserves placement; ${grass.stats().visible} visible close up.`);
}finally{scene.dispose();engine.dispose();}
