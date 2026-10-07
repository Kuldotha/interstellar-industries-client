import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {instance:{exports:c}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
c.generate_blue(8,.02,23);c.industry_begin_restore();c.industry_restore_pool(0,10000,0);
const Q=16777216,n=c.tile_count(),s=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),n).slice(),adj=new Uint32Array(c.memory.buffer,c.tile_neighbors_ptr(),n*6).slice(),used=new Set();
const neighbors=t=>Array.from(adj.slice(t*6,t*6+6)).filter(t=>t<n);
function build(t,k,side){assert.equal(c.industry_build_facing(t,k,side),0);used.add(t);return t;}
function place(k){let t=Array.from(s.keys()).find(t=>s[t]&&!used.has(t)&&c.industry_valid_sides(t,k));return build(t,k,31-Math.clz32(c.industry_valid_sides(t,k)));}
for(let i=0;i<10;i++)place(2);
const farm=Array.from(s.keys()).find(t=>s[t]&&!used.has(t)&&neighbors(t).filter(t=>s[t]&&!used.has(t)).length>=4);
build(farm,5,31-Math.clz32(c.industry_valid_sides(farm,5)));
assert.equal(c.industry_restore_tier(100,Q,0),0);c.industry_restore_progression(100,11,0,0,0);c.industry_refresh();assert.equal(c.industry_productivity(5),0);
const fields=neighbors(farm).filter(t=>s[t]&&!used.has(t));
for(let i=0;i<3;i++){let t=fields[i];build(t,12,Array.from(adj.slice(t*6,t*6+6)).indexOf(farm));assert.equal(c.industry_fields(farm),i+1);assert.equal(c.industry_field_parent(t),farm);assert.equal(c.industry_productivity(5),Math.floor((i+1)*100/3));}
assert.equal(c.industry_validate(fields[3],12),10);assert.equal(c.industry_worker_cost(12),0);
const factory=place(1);c.industry_restore_stock(0,10*Q,0);c.industry_restore_stock(1,20*Q,0);c.industry_refresh();assert.equal(c.industry_productivity(1),50);
const generator=place(10);c.industry_restore_stock(7,10*Q,0);c.industry_refresh();assert.equal(c.industry_productivity(1),100);assert.equal(c.industry_factory_power(),100);
c.industry_pause(generator);assert.equal(c.industry_productivity(1),50);c.industry_pause(generator);
c.industry_pause(farm);assert.equal(c.industry_productivity(5),0);c.industry_remove(fields[0]);c.industry_pause(farm);assert.equal(c.industry_productivity(5),66);
const before=new Uint32Array(c.memory.buffer,c.industry_pool_ptr(),8)[1];c.industry_remove(farm);assert.equal(c.industry_fields(farm),0);assert.equal(new Uint32Array(c.memory.buffer,c.industry_pool_ptr(),8)[1],before+5);
console.log('Farms: ownership, capacity, limits, pause, removal and refunds. Power: half/full factory output and generator pause pass.');
