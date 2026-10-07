import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {instance:{exports:c}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
c.generate_blue(8,.02,23);c.industry_begin_restore();c.industry_restore_pool(0,100,0);
const n=c.tile_count(),s=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),n).slice(),adj=new Uint32Array(c.memory.buffer,c.tile_neighbors_ptr(),n*6).slice();
const ns=t=>Array.from(adj.slice(t*6,t*6+6)).filter(x=>x<n),main=Array.from(s.keys()).find(t=>s[t]&&ns(t).filter(t=>s[t]).length>=4),plots=ns(main).filter(t=>s[t]);
const face=t=>Array.from(adj.slice(t*6,t*6+6)).indexOf(main);
assert.equal(c.industry_validate(plots[0],15),10);
assert.equal(c.industry_build_facing(main,10,31-Math.clz32(c.industry_valid_sides(main,10))),0);
for(const [i,t] of plots.slice(0,3).entries()){assert.equal(c.industry_build_facing(t,15,face(t)),0);assert.equal(c.industry_fields(main),i+1);assert.equal(c.industry_field_parent(t),main);assert.equal(c.industry_workers(),15+5*i);}
assert.equal(c.industry_validate(plots[3],15),10);assert.equal(c.industry_worker_cost(15),5);assert.equal(c.industry_build_cost(15),8);
assert.equal(c.industry_pause(plots[0]),8);assert.equal(c.industry_pause(main),0);assert.equal(c.industry_workers(),0);
c.industry_remove(plots[0]);assert.equal(c.industry_fields(main),2);assert.equal(c.industry_build_facing(plots[0],15,face(plots[0])),0);
assert.equal(c.industry_pause(main),0);assert.equal(c.industry_workers(),25);
c.industry_remove(plots[0]);assert.equal(c.industry_workers(),20);
c.industry_remove(main);assert.equal(c.industry_count(),0);assert.equal(c.industry_workers(),0);assert.equal(new Uint32Array(c.memory.buffer,c.industry_pool_ptr(),8)[1],100);
console.log('Generator modules: ownership, limit, five workers per module, parent pause, removal and refunds pass.');
