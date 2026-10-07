import fs from 'node:fs/promises';
import {web3,api,base,loadAdmin,rpc,targetUrl,resolveER,send} from './chain.mjs';
import {planetRent,ephemeralRent,layout} from '../../interstellar-industries-program/client/onchain.mjs';
const admin=await loadAdmin(),sponsor=api.sponsor(admin.publicKey),report={sponsor:sponsor.toBase58(),admin:admin.publicKey.toBase58(),before:await base.getBalance(admin.publicKey),transactions:[]};
try{
 const validator=new web3.PublicKey((await rpc(targetUrl,'getIdentity')).identity);
 report.validator=validator.toBase58();
 const account=await base.getAccountInfo(sponsor);
 if(!account){
  report.funding=Number(ephemeralRent(layout.topologyBytes)+2n*planetRent);
  report.transactions.push(await send(base,new web3.Transaction().add(...api.initializeAndDelegate(admin.publicKey,BigInt(report.funding),validator)),[admin]));
 }else if(account.owner.equals(api.program)){
  report.transactions.push(await send(base,new web3.Transaction().add(api.delegateSponsor(admin.publicKey,validator)),[admin]));
 }else if(!account.owner.equals(api.delegation))throw Error('Unexpected sponsor owner');
 let er;
 for(let i=0;i<30;i++){try{er=await resolveER(admin.publicKey);const a=await er.getAccountInfo(sponsor);if(a?.owner.equals(api.program))break;er=null;}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!er)throw Error('Sponsor propagation pending');
 report.rpc=er.rpcEndpoint;
 if((await rpc(er.rpcEndpoint,'getIdentity')).identity!==validator.toBase58())throw Error('Wrong rollup');
 for(let i=0;i<3;i++){
  if((await er.getAccountInfo(api.topology))?.data.length===layout.topologyBytes)break;
  report.transactions.push(await send(er,new web3.Transaction().add(api.prepareTopology(admin.publicKey)),[admin]));
 }
 const top=await er.getAccountInfo(api.topology);if(top?.data.length!==layout.topologyBytes||!top.owner.equals(api.program))throw Error('Topology not ready');
 report.ready=true;report.sponsorBalanceER=await er.getBalance(sponsor);
} catch(e){report.error=String(e);throw e;}
finally{
 report.after=await base.getBalance(admin.publicKey);report.baseDebit=report.before-report.after;
 await fs.writeFile(new URL('../../interstellar-industries-program/er-devnet.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
