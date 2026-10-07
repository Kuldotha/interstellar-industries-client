import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=async path=>(await WebAssembly.instantiate(readFileSync(new URL(path,import.meta.url)),{})).instance.exports;
const g=await load('../public/planet_geometry.wasm'),e=await load('../../interstellar-industries-program/public/engine.wasm'),Q=1n<<24n;
g.generate_blue(8,.02,23);g.industry_reset();g.industry_restore_progression(20,5,0,0,0);g.industry_restore_pool(0,50,0);
const n=g.tile_count(),s=new Uint32Array(g.memory.buffer,g.surfaces_ptr(),n).slice(),f=new Uint32Array(g.memory.buffer,g.features_ptr(),n).slice();
const dry=[...s.keys()].filter(i=>s[i]),dock=dry.find(i=>g.industry_valid_sides(i,3)),quarry=dry.find(i=>i!==dock&&(f[i]&2)),others=dry.filter(i=>i!==dock&&i!==quarry),houses=others.slice(0,2),factory=others[2];
for(const [tile,kind] of [...houses.map(h=>[h,2]),[dock,3],[quarry,0],[factory,1]])assert.equal(g.industry_build(tile,kind),0);
const state=()=>new BigUint64Array(e.memory.buffer,e.state_ptr(),e.state_words()),clock=()=>new BigUint64Array(e.memory.buffer,e.colony_clock_ptr(),e.colony_clock_words()),homes=()=>new BigUint64Array(e.memory.buffer,e.colony_tiers_ptr(),5),inventory=()=>new BigUint64Array(g.memory.buffer,g.industry_stock_ptr(),3);
const resources=[27,16,23],indices=[97,387,93];
state().fill(0n);clock().fill(0n);state().set([Q,Q,Q]);clock()[2]=10n;clock()[5]=1n;homes().set([2n,4n,0n,0n,0n]);
for(let r=0;r<3;r++){state()[indices[r]]=inventory()[r];state()[e.caps_offset()+resources[r]]=100n*Q+1n;}
assert.equal(e.colony_update(1,0n,1),0);
for(let tick=1;tick<=240;tick++){
 if(tick===121){g.industry_pause(dock);g.industry_restore_stock(2,0,0);g.industry_refresh();state()[2]=0n;state()[93]=0n;clock()[2]=5n;clock()[5]=1n;assert.equal(e.colony_update(1,BigInt(tick-1),1),0);}
 g.industry_advance(1);assert.equal(e.colony_update(1,BigInt(tick),0),0);
 assert.equal(clock()[3],BigInt(g.industry_population()),'population '+tick);
 for(const h of houses){assert.equal(homes()[2],BigInt(g.industry_need(h,0)));assert.equal(homes()[3]*60n/Q,BigInt(g.industry_need(h,1)));}
 for(let r=0;r<3;r++)assert.equal(state()[indices[r]],inventory()[r],`stock ${r} tick ${tick}`);
}
console.log('Game and colony engine: exact stocks, population and needs through growth, workforce changes, producer pause and food depletion.');
