import * as W from '@solana/web3.js';
import {createOnchainClient} from '../public/onchain.js';
import {chainConfig} from '../public/chain-config.js';
import {signAuthorization} from '../server/sponsor-signing.mjs';
const api=createOnchainClient(W,chainConfig.program);
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/healthz')return Response.json({ok:true});
  if(url.pathname!=='/api/chain/sign')return new Response('Not found',{status:404});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});
  if(!env.PUBLIC_ORIGIN||url.origin!==env.PUBLIC_ORIGIN||request.headers.get('Origin')!==env.PUBLIC_ORIGIN)return new Response('Origin not allowed',{status:403});
  if(!env.INTERSTELLAR_ADMIN_SECRET)return Response.json({error:'Session authorization unavailable'},{status:503});
  try{
   let body='';const reader=request.body?.getReader();if(!reader)throw Error('Missing request');
   const decoder=new TextDecoder();for(;;){const {value,done}=await reader.read();if(done)break;body+=decoder.decode(value,{stream:true});if(body.length>16000){await reader.cancel();throw Error('Request too large');}}
   const admin=W.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env.INTERSTELLAR_ADMIN_SECRET)));
   if(admin.publicKey.toBase58()!==chainConfig.admin)throw Error('Sponsor configuration mismatch');
   return Response.json(await signAuthorization(W,api,admin,JSON.parse(body),env.PUBLIC_ORIGIN),{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Session authorization failed. Please reconnect and try again.'},{status:400,headers:{'Cache-Control':'no-store'}});}
 }
};
