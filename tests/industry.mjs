import assert from 'node:assert/strict';
import {restoreInventory} from '../public/industry-inventory.js';
const Q=16777216n;
import {readFileSync} from 'node:fs';
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),c=instance.exports;
c.generate_blue(8,.035,23);
const surfaces=new Uint32Array(c.memory.buffer,c.surfaces_ptr(),c.tile_count()).slice(),features=new Uint32Array(c.memory.buffer,c.features_ptr(),c.tile_count()).slice(),neighbors=new Uint32Array(c.memory.buffer,c.tile_neighbors_ptr(),c.tile_count()*6).slice();
const stocks=()=>Array.from(new BigUint64Array(c.memory.buffer,c.industry_stock_ptr(),3));
const flow=()=>[0,1,2].map(r=>[c.industry_carry(r),c.industry_made(r)]);
const pool=()=>Array.from(new Uint32Array(c.memory.buffer,c.industry_pool_ptr(),3));
const buildings=()=>Array.from({length:c.industry_count()},(_,i)=>Array.from(new Uint32Array(c.memory.buffer,c.industry_buildings_ptr()+i*44,11)));
const dry=Array.from(surfaces.keys()).filter(i=>surfaces[i]!==0),quarry=dry.find(t=>features[t]&2),dock=dry.find(t=>c.industry_valid_sides(t,3)),inland=dry.find(t=>!c.industry_valid_sides(t,3));
for(const t of surfaces.keys()){
  const adjacent=Array.from(neighbors.slice(t*6,t*6+6)).filter(x=>x!==0xffffffff);
  assert.ok(adjacent.length===5||adjacent.length===6);
  for(const n of adjacent)assert.ok(neighbors.slice(n*6,n*6+6).includes(t));
  for(let side=0;side<6;side++)assert.equal(Boolean(c.industry_valid_sides(t,3)&(1<<side)),neighbors[t*6+side]!==0xffffffff&&surfaces[neighbors[t*6+side]]===0);
}
c.industry_reset();c.industry_restore_progression(20,6,0,0,0);assert.equal(c.industry_population(),0);
assert.equal(c.industry_build(inland,3),6);assert.equal(c.industry_build(surfaces.indexOf(0),3),3);
const wetSides=Array.from({length:6},(_,s)=>s).filter(s=>c.industry_valid_sides(dock,3)&(1<<s));
assert.equal(c.industry_build_facing(dock,3,wetSides[0]),0);assert.equal(c.industry_workers(),5);
c.industry_advance(60);assert.equal(pool()[2],0);assert.equal(buildings()[0][3],3);
const wrong=Array.from({length:6},(_,s)=>s).find(s=>!wetSides.includes(s));
if(wrong!==undefined){assert.equal(c.industry_rotate(dock,wrong),7);assert.equal(buildings()[0][6],wetSides[0]);}
for(const side of wetSides){assert.equal(c.industry_rotate(dock,side),0);assert.equal(buildings()[0][6],side);}
const home=dry.find(t=>t!==dock&&t!==quarry);assert.equal(c.industry_build(home,2),0);
assert.equal(c.industry_population(),2);assert.equal(c.industry_assigned_workers(dock),2);assert.equal(c.industry_pause(home),8);
c.industry_advance(150);assert.ok(stocks()[2]>0n);assert.equal(buildings().find(b=>b[0]===home)[10],1);assert.equal(buildings().find(b=>b[0]===home)[8],0);
c.industry_restore_needs(home,0,60);c.industry_advance(48);assert.equal(c.industry_population(),5);assert.equal(c.industry_happiness(home),70);assert.equal(c.industry_assigned_workers(dock),5);
assert.equal(buildings().find(b=>b[0]===home)[8],0);
const houseSides=c.industry_valid_sides(home,2),newSide=Array.from({length:6},(_,s)=>s).filter(s=>houseSides&(1<<s)).at(-1);
assert.equal(c.industry_rotate(home,newSide),0);
assert.equal(c.industry_restore_tier(3,Number(Q),103),0);
const saved={version:13,tier:Array.from(new BigUint64Array(c.memory.buffer,c.industry_tier_ptr(),5),Number),stocks:stocks().map(String),flow:flow(),pool:pool(),tick:c.industry_tick(),needs:Object.fromEntries(buildings().filter(b=>b[1]===2).map(b=>[b[0],[c.industry_need(b[0],0),c.industry_need(b[0],1)]])),buildings:buildings()};
function restore(s){
  c.industry_reset();c.industry_begin_restore();c.industry_restore_pool(0,100,0);
  for(const b of s.buildings){assert.equal(c.industry_build_facing(b[0],b[1],b[6]),0);if(b[1]!==2)c.industry_pause(b[0]);c.industry_restore_progress(b[0],b[4]);c.industry_restore_input(b[0],b[5]);if(b[1]===2)c.industry_restore_house(b[0],...b.slice(7));}
  for(const b of s.buildings)if(b[1]!==2&&!b[2])c.industry_pause(b[0]);
  for(const [tile,needs] of Object.entries(s.needs))c.industry_restore_needs(Number(tile),...needs);
  if(s.tier)assert.equal(c.industry_restore_tier(s.tier[1],s.tier[3],s.tier[4]),0);
  c.industry_restore_pool(s.pool[0],s.pool[1],s.tick);c.industry_restore_fish(s.pool[2]);restoreInventory(c,s);c.industry_restore_progression(20,6,0,0,0);c.industry_refresh();
}
restore(saved);assert.deepEqual(buildings(),saved.buildings);assert.deepEqual(pool(),saved.pool);assert.deepEqual(stocks().map(String),saved.stocks);assert.deepEqual(flow(),saved.flow);
c.industry_advance(900);const future={pool:pool(),stocks:stocks(),flow:flow(),buildings:buildings()};restore(saved);for(let i=0;i<900;i++)c.industry_advance(1);assert.deepEqual({pool:pool(),stocks:stocks(),flow:flow(),buildings:buildings()},future);
c.industry_pause(dock);c.industry_restore_stock(2,0,0);c.industry_restore_house(home,10,0,0,1);c.industry_advance(80);assert.equal(c.industry_population(),2);assert.equal(c.industry_happiness(home),50);assert.equal(c.industry_workers(),0);
c.industry_remove(home);assert.equal(c.industry_population(),0);c.industry_pause(dock);assert.equal(c.industry_assigned_workers(dock),0);
console.log('Housing/docks WASM: topology, coastal placement, water-only rotation, workforce bootstrap, fish consumption, growth/shrinkage, happiness, reload and fast-forward pass.');

// Existing concrete-chain behavior with the workforce now supplied by housing.
c.industry_reset();c.industry_restore_progression(20,6,0,0,0);c.industry_restore_pool(0,100,0);
const homes=dry.filter(t=>t!==quarry).slice(0,10),factories=dry.filter(t=>t!==quarry&&!homes.includes(t)).slice(0,5);
for(const t of homes)assert.equal(c.industry_build(t,2),0);
for(const t of factories)assert.equal(c.industry_build(t,1),0);
assert.equal(c.industry_workers(),15);c.industry_restore_pool(100,5,0);c.industry_refresh();
assert.equal(c.industry_population(),20);assert.equal(c.industry_workers(),15);for(const t of factories)assert.equal(c.industry_assigned_workers(t),3);
c.industry_advance(300);assert.ok(Math.abs(Number(stocks()[0])/Number(Q)-87.5)<0.0001);assert.ok(Math.abs(Number(stocks()[1])/Number(Q)-17.5)<0.0001);
c.industry_pause(factories[0]);for(const t of factories.slice(1))assert.equal(c.industry_assigned_workers(t),3);c.industry_pause(factories[0]);
for(const t of factories)c.industry_remove(t);
c.industry_restore_pool(2,100,0);for(const t of factories)c.industry_build(t,1);
assert.equal(c.industry_workers(),15);assert.equal(pool()[0],2);c.industry_advance(60);
assert.ok(stocks()[0]<Q/100000n);assert.equal(c.industry_workers(),15);c.industry_advance(1);assert.equal(c.industry_productivity(1),0);
assert.ok(buildings().filter(b=>b[1]===1).every(b=>b[3]===1&&b[5]===0));
c.industry_pause(factories[0]);assert.equal(c.industry_workers(),12);
restoreInventory(c,{version:10,pool:[3,4,5],buildings:[[0,1,0,0,0,1],[1,2,0,0,0,0,0,5,1500]]});
assert.deepEqual(stocks(),[4n*Q,4n*Q,5n*Q+Q/2n]);
console.log('Industry WASM: fractional production, shared workforce, exhaustion, pause, exact save continuation and inventory migration pass.');
const migrated={version:11,tutorial:5,stocks:stocks().map(String),flow:flow()};
const previousConcrete=stocks()[1];restoreInventory(c,migrated);assert.equal(stocks()[1],previousConcrete+5n*Q);
const current={...migrated,version:12,stocks:stocks().map(String)};restoreInventory(c,current);assert.equal(stocks()[1],previousConcrete+5n*Q);
console.log('Tutorial save migration grants newly applicable rewards once.');
