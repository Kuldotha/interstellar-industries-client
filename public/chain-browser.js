import {createOnchainClient,decodePlanet,layout} from './onchain.js';
import {createConnections} from './casino-client/transport.js';
export const encodeBytes=value=>btoa(String.fromCharCode(...value));
export const decodeBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function seedFor(owner){
 const prefix=new TextEncoder().encode('interstellar-starter-v1'),bytes=new Uint8Array(prefix.length+32);bytes.set(prefix);bytes.set(owner.toBytes(),prefix.length);
 return new DataView(await crypto.subtle.digest('SHA-256',bytes)).getUint32(0,true);
}
export function authorizationInstructions(api,owner,admin,session,action,seed,migrate=false){
 if(action==='create')return [api.createWithSession(owner,admin,session,seed)];
 if(action==='session')return [api.linkSession(owner,admin,session)];
 if(action==='reset')return [api.linkSession(owner,admin,session),...(migrate?[api.migratePlanet(session,admin,api.starter(owner))]:[]),api.closePlanet(session,admin,api.starter(owner))];
 throw Error('Unknown action');
}
export function authorizationText({action,owner,session,program,origin,expires,transaction}){
 if(!['create','session','reset'].includes(action))throw Error('Unknown action');
 return [
  'Interstellar Industries — authorize browser session',
  'This message authorizes '+(action==='reset'?'permanent deletion of your colony, buildings and resources.':action==='create'?'creation of your starting planet.':'replacement of your planet session key.'),
  'Wallet: '+owner,'Session: '+session,'Program: '+program,'Network: Solana devnet',
  'Origin: '+origin,'Expires: '+new Date(expires).toISOString(),'Transaction message: '+transaction,
 ].join('\n');
}
export function createBrowserChain(W,config,{fetcher=fetch}={}){
 const api=createOnchainClient(W,config.program),admin=new W.PublicKey(config.admin),connection=createConnections(W.Connection);let resolving;
 async function resolve(){
  const response=await fetcher(config.router,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getDelegationStatus',params:[api.sponsor(admin).toBase58()]}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Cannot reach the rollup router');const body=await response.json();if(body.error)throw Error(body.error.message);
  const status=body.result;if(!status?.isDelegated||!status.fqdn)throw Error('Planet service is not ready: sponsor is not delegated.');
  const url=new URL(status.fqdn);if(url.protocol!=='https:'||!url.hostname.endsWith('.magicblock.app')||url.username||url.password)throw Error('Unexpected rollup endpoint');return connection(url.href);
 }
 async function snapshot(er,owner){
  const planet=api.starter(owner),accounts=await er.getMultipleAccountsInfo([planet,api.engine(planet)],'confirmed');if(!accounts[0])return null;
  if(!accounts.every(a=>a?.owner.equals(api.program))||accounts[1].data.length!==layout.engineBytes)throw Error('Invalid planet accounts');
  const bytes=accounts[0].data,data=decodePlanet(bytes);
  if(!new W.PublicKey(data.owner).equals(owner)||data.nonce!==0n||!new W.PublicKey(data.sponsor).equals(api.sponsor(admin)))throw Error('Planet owner or sponsor mismatch');
  const engine=accounts[1].data,view=new DataView(engine.buffer,engine.byteOffset,engine.byteLength),p=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return {...data,address:planet.toBase58(),stocks:[97,387,93,106,450,114,376,86].map(i=>view.getBigUint64(i*8,true)),carry:[27,16,23,55,79,75,5,6].map(r=>Number(p.getBigInt64(392+r*8,true)))};
 }
 async function authorize(er,owner,session,action,signMessage,origin){
  const state=await snapshot(er,owner);if(action==='create'&&state)throw Error('Your starting planet already exists. Reload to open it.');if(action!=='create'&&!state)throw Error('Planet not found');
  const migrate=action==='reset'&&!state.needsVersion,seed=await seedFor(owner),{blockhash}=await er.getLatestBlockhash('confirmed');
  const tx=new W.Transaction({feePayer:session.publicKey,recentBlockhash:blockhash}).add(...authorizationInstructions(api,owner,admin,session.publicKey,action,seed,migrate));
  const message=encodeBytes(tx.serializeMessage()),expires=Date.now()+120000;
  const proof={action,owner:owner.toBase58(),session:session.publicKey.toBase58(),program:config.program,origin,expires,transaction:message};
  const signature=await signMessage(new TextEncoder().encode(authorizationText(proof)));
  tx.addSignature(session.publicKey,await session.sign(tx.serializeMessage()));
  const response=await fetcher(config.signer,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...proof,migrate,authorizationSignature:encodeBytes(signature),signedTransaction:encodeBytes(tx.serialize({requireAllSignatures:false}))})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Session authorization unavailable');
  const signed=W.Transaction.from(decodeBytes(result.transaction));
  if(encodeBytes(signed.serializeMessage())!==message||!signed.verifySignatures())throw Error('Invalid sponsor signature');
  return er.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:3});
 }
 return {api,admin,resolve:()=>resolving||=(resolve().catch(error=>{resolving=null;throw error;})),snapshot,authorize};
}
