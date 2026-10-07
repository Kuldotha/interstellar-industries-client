import {createPrivateKey,sign} from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '/tmp/interstellar-browser-tests/node_modules/playwright/index.mjs';
import {web3,api,loadAdmin,resolveER,send} from '../server/chain.mjs';
const keyPath=new URL('../../interstellar-industries-program/browser-test-wallet.json',import.meta.url);
let owner;
try{owner=web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await fs.readFile(keyPath,'utf8'))));}catch(e){if(e.code!=='ENOENT')throw e;owner=web3.Keypair.generate();await fs.writeFile(keyPath,JSON.stringify(Array.from(owner.secretKey)),{mode:0o600,flag:'wx'});}
const admin=await loadAdmin(),er=await resolveER(admin.publicKey),planet=api.starter(owner.publicKey),sponsor=api.sponsor(admin.publicKey);
const before=await er.getBalance(sponsor),errors=[],report={wallet:owner.publicKey.toBase58(),sponsorBefore:before};
let browser;
try{
 assert.equal(await er.getBalance(owner.publicKey),0);
 assert.equal(await er.getAccountInfo(planet),null,'Test planet already exists');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('testWalletSign',async bytes=>{
  const message=Buffer.from(bytes);assert.ok(message.toString().startsWith('Interstellar Industries — authorize browser session'));
  const key=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(owner.secretKey.subarray(0,32))]),format:'der',type:'pkcs8'});
  return Array.from(sign(null,message,key));
 });
 await page.addInitScript(({address,publicKey})=>{
  const account={address,publicKey:new Uint8Array(publicKey),chains:['solana:devnet'],features:['solana:signMessage']};
  const wallet={version:'1.0.0',name:'Integration test',icon:'',chains:['solana:devnet'],accounts:[account],features:{
   'standard:connect':{version:'1.0.0',connect:async()=>({accounts:[account]})},
   'standard:disconnect':{version:'1.0.0',disconnect:async()=>{}},
   'solana:signMessage':{version:'1.0.0',signMessage:async input=>[{signature:Uint8Array.from(await window.testWalletSign(Array.from(input.message)))}]}
  }};
  window.addEventListener('wallet-standard:app-ready',event=>event.detail.register(wallet));
 },{address:owner.publicKey.toBase58(),publicKey:Array.from(owner.publicKey.toBytes())});
 await page.goto('http://127.0.0.1:8768/');
 await page.getByRole('button',{name:'Connect Integration test'}).click();
 await page.getByRole('button',{name:'Generate planet',exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'Generate planet',exact:true}).click();
 await page.locator('#wallet-gate').waitFor({state:'detached',timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#tiles')?.textContent==='642',{timeout:60000});
 await page.waitForTimeout(2000);
 if(errors.length)throw Error(errors.join('\n'));
 await page.screenshot({path:'/tmp/interstellar-wallet-connected.png'});
 await page.reload();
 await page.locator('#wallet-gate').waitFor({state:'detached',timeout:45000});
 await page.waitForFunction(()=>document.querySelector('#tiles')?.textContent==='642',{timeout:60000});
 assert.equal(errors.length,0,errors.join('\n'));
 report.passed=true;
}catch(error){report.error=String(error);throw error;}
finally{
 await browser?.close();
 if(await er.getAccountInfo(planet)){report.cleanup=await send(er,new web3.Transaction().add(api.closePlanet(owner.publicKey,admin.publicKey,planet)),[owner]);}
 report.sponsorAfter=await er.getBalance(sponsor);report.rentReturned=report.sponsorAfter===before;report.walletBalance=await er.getBalance(owner.publicKey);
 await fs.writeFile(new URL('../../interstellar-industries-program/browser-planet-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
