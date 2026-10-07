import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),c=instance.exports;
c.generate_blue(8,.035,23);
const count=c.tile_count(),s=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),count).slice(),n=new Uint32Array(c.memory.buffer,c.tile_neighbors_ptr(),count*6).slice(),f=new Uint32Array(c.memory.buffer,c.features_ptr(),count).slice();
const adjacent=t=>Array.from(n.slice(t*6,t*6+6)).filter(t=>t<count);
const dry=Array.from(s.keys()).filter(t=>s[t]);
const center=dry.find(t=>adjacent(t).filter(x=>s[x]).length>=3);
const homes=adjacent(center).filter(t=>s[t]).slice(0,2);
c.industry_reset();c.industry_restore_progression(20,6,0,0,0);c.industry_restore_pool(0,100,0);
for(const h of homes)assert.equal(c.industry_build(h,2),0);
assert.equal(c.industry_build(center,4),0);c.industry_advance(60);
assert.equal(c.industry_workers(),0);
for(const h of homes){assert.equal(c.industry_covered(h),1);assert.equal(c.industry_happiness(h),60);assert.equal(c.industry_capacity(h),7);}
assert.equal(c.industry_population(),14);
c.industry_pause(center);c.industry_advance(70);assert.equal(c.industry_population(),4);
for(const h of homes){assert.equal(c.industry_covered(h),0);assert.equal(c.industry_happiness(h),50);}
c.industry_pause(center);c.industry_restore_fish(100);c.industry_advance(80);assert.equal(c.industry_population(),20);
for(const h of homes)assert.equal(c.industry_happiness(h),80);
c.industry_remove(center);assert.equal(c.industry_covered(homes[0]),0);
console.log('Commons coverage, gradual fulfillment, five-resident capacity bonus, pause, happiness and removal pass.');
