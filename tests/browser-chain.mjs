import assert from 'node:assert/strict';
import {createPrivateKey,sign,createHash} from 'node:crypto';
import * as W from '@solana/web3.js';
import {createOnchainClient,layout} from '../public/onchain.js';
import {authorizationInstructions,authorizationText,seedFor,encodeBytes,createBrowserChain} from '../public/chain-browser.js';
import {signAuthorization} from '../server/sponsor-signing.mjs';
const owner=W.Keypair.generate(),session=W.Keypair.generate(),admin=W.Keypair.generate(),api=createOnchainClient(W),origin='https://colony.example',now=Date.now();
const privateKey=pair=>createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),pair.secretKey.subarray(0,32)]),format:'der',type:'pkcs8'});
async function bodyFor(action,migrate=false,alter=()=>{}){
 const tx=new W.Transaction({feePayer:session.publicKey,recentBlockhash:W.PublicKey.default.toBase58()}).add(...authorizationInstructions(api,owner.publicKey,admin.publicKey,session.publicKey,action,await seedFor(owner.publicKey),migrate));alter(tx);tx.partialSign(session);
 const body={action,owner:owner.publicKey.toBase58(),session:session.publicKey.toBase58(),program:api.program.toBase58(),origin,expires:now+120000,migrate,transaction:encodeBytes(tx.serializeMessage()),signedTransaction:tx.serialize({requireAllSignatures:false}).toString('base64')};
 body.authorizationSignature=sign(null,Buffer.from(authorizationText(body)),privateKey(owner)).toString('base64');return body;
}
assert.equal(await seedFor(owner.publicKey),createHash('sha256').update('interstellar-starter-v1').update(owner.publicKey.toBytes()).digest().readUInt32LE(0));
for(const [action,migrate]of [['create',false],['session',false],['reset',false],['reset',true]]){
 const body=await bodyFor(action,migrate),result=await signAuthorization(W,api,admin,body,origin,now),tx=W.Transaction.from(Buffer.from(result.transaction,'base64'));
 assert(tx.verifySignatures());assert(!tx.signatures.some(s=>s.publicKey.equals(owner.publicKey)),'Main wallet must never sign an ER transaction');assert(tx.feePayer.equals(session.publicKey));
}
const body=await bodyFor('create');
await assert.rejects(signAuthorization(W,api,admin,{...body,origin:'https://other.example'},origin,now));
await assert.rejects(signAuthorization(W,api,admin,{...body,authorizationSignature:Buffer.alloc(64).toString('base64')},origin,now));
await assert.rejects(signAuthorization(W,api,admin,body,origin,now+120001));
await assert.rejects(signAuthorization(W,api,admin,{...body,program:W.PublicKey.default.toBase58()},origin,now));
const extra=await bodyFor('create',false,tx=>tx.add(W.SystemProgram.transfer({fromPubkey:session.publicKey,toPubkey:owner.publicKey,lamports:1})));
await assert.rejects(signAuthorization(W,api,admin,extra,origin,now),/Unsupported sponsor transaction/);
let discovery=0;class Connection{constructor(url){this.rpcEndpoint=url;}async getMultipleAccountsInfo(){return [null,null];}}
const config={program:api.program.toBase58(),admin:admin.publicKey.toBase58(),router:'https://router.example',signer:'/api/chain/sign'};
const client=createBrowserChain({...W,Connection},config,{fetcher:async(url,options)=>{assert.equal(url,config.router);assert.equal(JSON.parse(options.body).method,'getDelegationStatus');discovery++;return {ok:true,json:async()=>({result:{isDelegated:true,fqdn:'https://devnet-eu.magicblock.app/'}})};}});
const er=await client.resolve();assert.equal(await client.resolve(),er);assert.equal(discovery,1);assert.equal(await client.snapshot(er,owner.publicKey),null);
let sent=0,signedMessages=0;er.getLatestBlockhash=async()=>({blockhash:W.PublicKey.default.toBase58()});er.sendRawTransaction=async bytes=>{assert(W.Transaction.from(bytes).verifySignatures());sent++;return 'confirmed-signature';};
const browser=createBrowserChain({...W,Connection},config,{fetcher:async(url,options)=>{assert.equal(url,config.signer);return {ok:true,json:async()=>signAuthorization(W,api,admin,JSON.parse(options.body),origin)};}});
const result=await browser.authorize(er,owner.publicKey,{publicKey:session.publicKey,sign:async message=>sign(null,Buffer.from(message),privateKey(session))},'create',async message=>{signedMessages++;return sign(null,Buffer.from(message),privateKey(owner));},origin);
assert.equal(result,'confirmed-signature');assert.equal(sent,1);assert.equal(signedMessages,1);
console.log('Browser builds and submits; wallet signs only a message; sponsor signs only the exact authorized operation. No on-chain accounts or funds used.');
const bytes=Buffer.alloc(layout.planetBytes+16).subarray(8,8+layout.planetBytes);bytes.write('IIWORLD2');owner.publicKey.toBuffer().copy(bytes,8);api.sponsor(admin.publicKey).toBuffer().copy(bytes,40);session.publicKey.toBuffer().copy(bytes,6288);bytes.writeBigInt64LE(17n,392+27*8);
const engine=Buffer.alloc(layout.engineBytes+16).subarray(8,8+layout.engineBytes);engine.writeBigUInt64LE(123n,97*8);
er.getMultipleAccountsInfo=async()=>[{owner:api.program,data:bytes},{owner:api.program,data:engine}];
const snapshot=await browser.snapshot(er,owner.publicKey);assert.equal(snapshot.stocks[0],123n);assert.equal(snapshot.carry[0],17);assert.equal(snapshot.address,api.starter(owner.publicKey).toBase58());
er.getMultipleAccountsInfo=async()=>[{owner:owner.publicKey,data:bytes},{owner:api.program,data:engine}];await assert.rejects(browser.snapshot(er,owner.publicKey),/Invalid planet accounts/);
console.log('Direct account reads validate ownership and decode buffer offsets correctly.');
