import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreInventory} from '../public/industry-inventory.js';
import {buildingDefinitions} from '../public/building-definitions.js';
import {validateCompositions,compositionTargets} from '../public/tile-composition.js';
const json=p=>JSON.parse(readFileSync(new URL('../public/'+p,import.meta.url)));
validateCompositions(json('configs/tile-compositions.json'),json('models/library.json'),json('models/authoring.json'));
assert.equal(buildingDefinitions.length,16);assert.equal(compositionTargets.length,21);
const {instance:{exports:c}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
c.generate_blue(8,.02,23);c.industry_reset();c.industry_restore_progression(100,5,0,0,0);c.industry_restore_pool(0,1000,0);
const surface=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),c.tile_count()).slice();const dry=Array.from(surface.keys()).filter(t=>surface[t]);
const placed=[];for(const kind of [2,5,6,7,8,9,10,11]){const tile=dry.shift(),mask=c.industry_valid_sides(tile,kind),side=31-Math.clz32(mask);assert.equal(c.industry_build_facing(tile,kind,side),0);placed.push(tile);}
assert.equal(c.industry_resource_count(),8);assert.equal(c.industry_worker_cost(5),5);assert.equal(c.industry_unlock_population(6),60);assert.equal(c.industry_unlock_population(11),100);
const Q=16777216n;for(let r=0;r<8;r++)c.industry_restore_stock(r,Number(Q*10n),0);c.industry_refresh();c.industry_advance(5);
const stocks=()=>Array.from(new BigUint64Array(c.memory.buffer,c.industry_stock_ptr(),8));
const saved={version:14,stocks:stocks().map(String),flow:Array.from({length:8},(_,r)=>[c.industry_carry(r),c.industry_made(r)])};
for(let r=0;r<8;r++)c.industry_restore_stock(r,0,0);restoreInventory(c,saved);assert.deepEqual(stocks().map(String),saved.stocks);
assert.equal(c.industry_need(placed[0],2),60);assert.equal(c.industry_need(placed[0],3),60);
console.log('Tier one: all new types place, unlocks, eight-resource save restoration, needs and compositions pass.');
