import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {web3,api,loadAdmin,resolveER,send,seedFor} from '../server/chain.mjs';
import {decodePlanet,planetRent} from '../../interstellar-industries-program/client/onchain.mjs';
const owner=await loadAdmin(),session=web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await fs.readFile('/Users/tedosijses/keys/interstellar_deploy_buffer.json','utf8'))));
const er=await resolveER(owner.publicKey),planet=api.starter(owner.publicKey),sponsor=api.sponsor(owner.publicKey);
const report={rpc:er.rpcEndpoint,planet:planet.toBase58(),sponsorBefore:await er.getBalance(sponsor),sessionBefore:await er.getBalance(session.publicKey),transactions:[]};
if(await er.getAccountInfo(planet))throw Error('Test planet already exists; inspect before overwriting.');
const transaction=ix=>new web3.Transaction().add(web3.ComputeBudgetProgram.setComputeUnitLimit({units:200000}),ix);
try{
 report.transactions.push(await send(er,transaction(api.createPlanet(owner.publicKey,owner.publicKey,0n,seedFor(owner.publicKey),session.publicKey)),[owner]));
 const account=await er.getAccountInfo(planet),state=decodePlanet(account.data);
 assert.equal(state.seed,seedFor(owner.publicKey));assert.equal(state.nonce,0n);assert.equal(state.next,0xffffffffffffffffn);assert.deepEqual(Buffer.from(state.session),session.publicKey.toBuffer());
 assert.equal(report.sponsorBefore-await er.getBalance(sponsor),Number(planetRent));
 await assert.rejects(send(er,transaction(api.createPlanet(owner.publicKey,owner.publicKey,0n,1,session.publicKey)),[owner]));
 await assert.rejects(send(er,transaction(api.createPlanet(owner.publicKey,owner.publicKey,1n,1,session.publicKey)),[owner]));
 const {instance}=await WebAssembly.instantiate(await fs.readFile(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),core=instance.exports;
 core.set_planet_seed(state.seed);core.generate_blue(8,.02,15);
 const surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count());
 const neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),core.tile_count()*6);
 const tile=surfaces.findIndex(x=>x!==0),side=Array.from({length:6},(_,i)=>i).find(i=>neighbors[tile*6+i]<642);
 report.transactions.push(await send(er,transaction(api.build(session.publicKey,planet,tile,2,side)),[session]));
 assert.equal(decodePlanet((await er.getAccountInfo(planet)).data).buildings.length,1);
 report.sessionAfter=await er.getBalance(session.publicKey);assert.equal(report.sessionAfter,report.sessionBefore);assert.equal(report.sessionAfter,0);
 report.transactions.push(await send(er,transaction(api.authorizeSession(owner.publicKey,api.program)),[owner]));
 await assert.rejects(send(er,transaction(api.demolish(session.publicKey,planet,tile)),[session]));
 report.passed=true;
}finally{
 const p=await er.getAccountInfo(planet);
 if(p){report.cleanup=await send(er,transaction(api.closePlanet(owner.publicKey,owner.publicKey,planet)),[owner]);}
 report.planetClosed=!(await er.getAccountInfo(planet));report.engineClosed=!(await er.getAccountInfo(api.engine(planet)));
 report.sponsorAfter=await er.getBalance(sponsor);report.rentReturned=report.sponsorAfter===report.sponsorBefore;
 await fs.writeFile(new URL('../../interstellar-industries-program/live-planet-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
