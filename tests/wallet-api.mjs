import {createPrivateKey,sign} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {web3,api,loadAdmin,resolveER,send,seedFor} from '../server/chain.mjs';
import {createBrowserChain} from '../public/chain-browser.js';
import {chainConfig} from '../public/chain-config.js';
import {signWithSession,confirmSignature} from '../public/casino-client/transport.js';
const owner=web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await fs.readFile(new URL('../../interstellar-industries-program/browser-test-wallet.json',import.meta.url),'utf8'))));
const admin=await loadAdmin(),er=await resolveER(admin.publicKey),planet=api.starter(owner.publicKey),sponsor=api.sponsor(admin.publicKey),before=await er.getBalance(sponsor);
const origin=process.env.INTERSTELLAR_TEST_ORIGIN||'http://127.0.0.1:8768';
const browser=createBrowserChain(web3,{...chainConfig,signer:origin+'/api/chain/sign'},{fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});
const signingKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),owner.secretKey.subarray(0,32)]),format:'der',type:'pkcs8'});
const signMessage=async bytes=>sign(null,Buffer.from(bytes),signingKey);
async function newSession(){const pair=await crypto.subtle.generateKey('Ed25519',false,['sign']);return {publicKey:new web3.PublicKey(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),sign:async bytes=>new Uint8Array(await crypto.subtle.sign('Ed25519',pair.privateKey,bytes))};}
const session=await newSession(),report={wallet:owner.publicKey.toBase58(),sponsorBefore:before};
assert.equal(await er.getAccountInfo(planet),null,'Use an empty persisted test wallet');
try{
 report.creation=await browser.authorize(er,owner.publicKey,session,'create',signMessage,origin);await confirmSignature(er,report.creation);
 assert.equal((await browser.snapshot(er,owner.publicKey)).seed,seedFor(owner.publicKey));
 await assert.rejects(browser.authorize(er,owner.publicKey,session,'create',signMessage,origin),/already exists/);
 const {instance:{exports:core}}=await WebAssembly.instantiate(await fs.readFile(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
 core.set_planet_seed(seedFor(owner.publicKey));core.generate_blue(8,.02,15);
 const surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),642),neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),642*6),tile=surfaces.findIndex(s=>s!==0),side=[0,1,2,3,4,5].find(s=>neighbors[tile*6+s]<642);
 const signed=await signWithSession(web3.Transaction,er,session,[api.build(session.publicKey,planet,tile,2,side)]);
 assert(!signed.signatures.some(s=>s.publicKey.equals(owner.publicKey)));
 report.build=await er.sendRawTransaction(signed.serialize());await confirmSignature(er,report.build);
 assert((await browser.snapshot(er,owner.publicKey)).buildings.some(b=>b.tile===tile&&b.kind===2));
 assert.equal(await er.getBalance(session.publicKey),0);
 const replacement=await newSession();report.replacement=await browser.authorize(er,owner.publicKey,replacement,'session',signMessage,origin);await confirmSignature(er,report.replacement);
 const revoked=await signWithSession(web3.Transaction,er,session,[api.demolish(session.publicKey,planet,tile)]);await assert.rejects(er.sendRawTransaction(revoked.serialize()));
 report.reset=await browser.authorize(er,owner.publicKey,replacement,'reset',signMessage,origin);await confirmSignature(er,report.reset);
 assert.equal(await browser.snapshot(er,owner.publicKey),null);assert.equal(await er.getAccountInfo(api.engine(planet)),null);
 report.regenerated=await browser.authorize(er,owner.publicKey,session,'create',signMessage,origin);await confirmSignature(er,report.regenerated);report.passed=true;
}finally{
 if(await er.getAccountInfo(planet))report.cleanup=await send(er,new web3.Transaction().add(api.closePlanet(owner.publicKey,admin.publicKey,planet)),[owner]);
 report.sponsorAfter=await er.getBalance(sponsor);report.rentReturned=before===report.sponsorAfter;
 await fs.writeFile(new URL('../../interstellar-industries-program/wallet-api-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
