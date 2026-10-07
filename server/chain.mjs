import {homedir} from 'node:os';
import {join} from 'node:path';
import {assertRequestOrigin} from './request-origin.mjs';
import {createConnections,confirmSignature} from '../public/casino-client/transport.js';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {signAuthorization} from './sponsor-signing.mjs';
import {createOnchainClient,decodePlanet,layout} from '../public/onchain.js';
const require=createRequire(import.meta.url);
export const web3=require('@solana/web3.js');
export const api=createOnchainClient(web3);
export const adminKeyPath=process.env.INTERSTELLAR_ADMIN_KEY||(process.env.NODE_ENV!=='production'?join(homedir(),'keys/interstellar_admin.json'):undefined);
export const loadAdmin=async()=>web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.INTERSTELLAR_ADMIN_SECRET||await fs.readFile(adminKeyPath,'utf8'))));
export const baseUrl='https://rpc.magicblock.app/devnet',routerUrl='https://devnet-router.magicblock.app/',targetUrl='https://devnet-eu.magicblock.app';
const connection=createConnections(web3.Connection);
export const base=connection(baseUrl);
export async function rpc(url,method,params=[]){
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();if(body.error)throw Error(body.error.message);return body.result;
}
export const seedFor=owner=>createHash('sha256').update('interstellar-starter-v1').update(owner.toBytes()).digest().readUInt32LE(0);
export async function resolveER(admin){
 const status=await rpc(routerUrl,'getDelegationStatus',[api.sponsor(admin).toBase58()]);
 if(!status?.isDelegated || !status?.fqdn)throw Error('Planet service is not ready: sponsor is not delegated.');
 const endpoint=new URL(status.fqdn);if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.magicblock.app'))throw Error('Unexpected rollup endpoint');
 return connection(endpoint.href);
}
export async function send(connection,transaction,signers){
 const latest=await connection.getLatestBlockhash('confirmed');
 transaction.recentBlockhash=latest.blockhash;transaction.feePayer=signers[0].publicKey;transaction.sign(...signers);
 const signature=await connection.sendRawTransaction(transaction.serialize(),{skipPreflight:false,maxRetries:3});
 return confirmSignature(connection,signature);
}
export function createChainRoutes(){
 let admin;
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/chain/'))return false;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   assertRequestOrigin(req);
   if(url.pathname!=='/api/chain/sign'||req.method!=='POST'){json(404,{error:'Unknown endpoint'});return true;}
   let data='';for await(const part of req){data+=part;if(data.length>16000)throw Error('Request too large');}
   admin??=await loadAdmin();json(200,await signAuthorization(web3,api,admin,JSON.parse(data),req.headers.origin));
  }catch(error){json(400,{error:error.message});}
  return true;
 };
}
