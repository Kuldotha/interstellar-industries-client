import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {buildingDefinitions} from '../public/building-definitions.js';
const {instance:{exports:c}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
const Q=16777216;
c.generate_blue(8,.02,23);c.industry_begin_restore();c.industry_restore_pool(0,10000,0);c.industry_restore_progression(100,11,0,0,0);
const dry=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),c.tile_count()).slice(),used=new Set();
function place(kind){
 const tile=Array.from(dry.keys()).find(t=>dry[t]&&!used.has(t)&&c.industry_valid_sides(t,kind));assert.notEqual(tile,undefined);
 assert.equal(c.industry_build_facing(tile,kind,31-Math.clz32(c.industry_valid_sides(tile,kind))),0);used.add(tile);return tile;
}
for(let i=0;i<3;i++)place(2);const dock=place(3);
c.industry_restore_tier(15,Q,0);c.industry_restore_stock(2,100*Q,0);c.industry_refresh();
assert.equal(c.industry_storage_cap(),100);
const producing=c.industry_production(2),net=c.industry_rate(2)*60;
assert.ok(producing>0&&producing<.5,'Full fish storage should still replenish consumption');
assert.ok(Math.abs(net)<1e-6,'Full storage must have no net increase');
c.industry_pause(dock);
assert.equal(c.industry_production(2),0);assert.ok(c.industry_rate(2)<0,'Consumption continues from reserves');
for(const b of buildingDefinitions)for(const key of ['icon','buildingIcon'])assert.ok(existsSync(new URL('../public/icons/'+b[key],import.meta.url)),b[key]);
console.log('Storage: capped replenishment, reserve consumption, cap export and icon assets pass.');
