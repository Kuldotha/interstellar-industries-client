import {showLoading,hideLoading} from './loading-screen.js';
import {signWithSession,confirmSignature} from '/casino-client/transport.js';
import * as wallets from '/casino-client/wallet.js';
import {sessionKey} from '/casino-client/session.js';
import {rememberedWallet,rememberWallet,forgetWallet,restoreWallet} from './remembered-wallet.js';
import {chainConfig} from './chain-config.js';
import {createBrowserChain} from './chain-browser.js';
const W=window.solanaWeb3,browserChain=createBrowserChain(W,chainConfig),api=browserChain.api;
export async function connectPlanet(){
 const gate=document.createElement('section');gate.id='wallet-gate';
 gate.innerHTML='<div class="wallet-card"><p class="eyebrow">INTERSTELLAR INDUSTRIES</p><h1>A world of your own</h1><p>Connect your wallet to discover your starting planet.</p><div id="wallet-choices"></div><button id="planet-enter" hidden>Generate planet</button><button id="planet-reset" hidden>Reset colony…</button><button id="wallet-disconnect" hidden>Disconnect wallet</button><p id="wallet-status" role="status"></p><small>Devnet · Europe</small></div>';document.body.append(gate);document.body.classList.add('wallet-locked');
 const choices=gate.querySelector('#wallet-choices'),enter=gate.querySelector('#planet-enter'),status=gate.querySelector('#wallet-status'),reset=gate.querySelector('#planet-reset'),disconnect=gate.querySelector('#wallet-disconnect');
 let wallet,owner,session,config,er,busy=false,readyResolve;
 const ready=new Promise(resolve=>readyResolve=resolve);
 const report=error=>{hideLoading();console.error(error);status.textContent=error.message||String(error);busy=false;enter.disabled=false;reset.disabled=false;for(const b of choices.querySelectorAll('button'))b.disabled=false;};
 async function disconnectWallet(){
  disconnect.disabled=true;forgetWallet(localStorage);
  try{await wallets.disconnect();}
  catch(error){console.error(error);}
  finally{location.reload();}
 }
 disconnect.onclick=disconnectWallet;
 const confirm=signature=>confirmSignature(er,signature);
 async function authorize(action){await confirm(await browserChain.authorize(er,owner,session,action,wallets.signMessage,location.origin));}
 const snapshot=()=>browserChain.snapshot(er,owner);
 async function sessionTransaction(instruction){
  const tx=await signWithSession(W.Transaction,er,session,[instruction]);
  const signature=await er.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:3});await confirm(signature);return signature;
 }
 async function catchUp(){
  let state=await snapshot();
  if(state&&!state.needsVersion){await sessionTransaction(api.migratePlanet(session.publicKey,new W.PublicKey(config.admin),api.starter(owner)));state=await snapshot();}
  if(state&&state.rulesVersion<2){await sessionTransaction(api.updateRules(session.publicKey,api.starter(owner)));state=await snapshot();}
  for(let i=0;state&&state.next<=BigInt(Math.floor(Date.now()/1000))&&i<32;i++){
   await sessionTransaction(api.advance(api.starter(owner)));state=await snapshot();
  }
  if(state?.next<=BigInt(Math.floor(Date.now()/1000)))throw Error('Your colony is catching up. Please open it again.');
  if(state&&BigInt(Math.floor(Date.now()/1000))-state.tick>2n){await sessionTransaction(api.advance(api.starter(owner)));state=await snapshot();}
  return state;
 }
 const chain={
  get owner(){return owner?.toBase58();},get initial(){return this.current;},current:null,
  async refresh(){const state=await snapshot();if(!state)throw Error('Planet not found');this.current=state;return state;},
  async action(kind,...args){
   if(busy)throw Error('Please wait for the previous action.');busy=true;
   try{
    if(!this.current)throw Error('Planet not found');
    const planet=api.starter(owner),authority=session.publicKey;
    if(kind==='build'&&args[1]>=5&&!this.current.needsVersion){
     try{await sessionTransaction(api.migratePlanet(authority,new W.PublicKey(config.admin),planet));this.current=await snapshot();}
     catch(error){throw Error('Colony update failed: '+error.message,{cause:error});}
    }
    const instruction=kind==='build'?api.build(authority,planet,...args):kind==='demolish'?api.demolish(authority,planet,...args):api.setPaused(authority,planet,...args);
    try{await sessionTransaction(instruction);}catch(error){if(!String(error).includes('0x64'))throw error;await catchUp();await sessionTransaction(instruction);}
    this.current=await snapshot();return this.current;
   }finally{busy=false;}
  },
 };
 async function open(automatic=false){
  if(busy)return;busy=true;enter.disabled=true;reset.disabled=true;
  try{
   let state=await snapshot();
   if(automatic&&(!state||!new W.PublicKey(state.session).equals(session.publicKey))){
    busy=false;enter.disabled=false;reset.disabled=false;status.textContent=state?'Authorize this browser to continue.':'Your wallet can claim one starting planet.';return;
   }
   if(!state){status.textContent='Sign a message to authorize your starting planet.';await authorize('create');state=await snapshot();}
   else if(!new W.PublicKey(state.session).equals(session.publicKey)){status.textContent='Sign a message to authorize this browser.';await authorize('session');}
   showLoading('Opening your colony…');status.textContent='Opening your colony…';chain.current=await catchUp();
   if(!chain.current)throw Error('Planet is not available yet. Please try again.');
   gate.remove();document.body.classList.remove('wallet-locked');
   const badge=document.createElement('div');badge.id='wallet-account';
   const address=document.createElement('span');address.textContent=owner.toBase58().slice(0,4)+'…'+owner.toBase58().slice(-4);address.title=owner.toBase58();
   const leave=document.createElement('button');leave.type='button';leave.title='Disconnect wallet';leave.setAttribute('aria-label','Disconnect wallet');
   leave.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/></svg>';
   leave.onclick=()=>{leave.disabled=true;void disconnectWallet();};
   badge.append(address,leave);document.getElementById('industry-bar').append(badge);
   busy=false;readyResolve(chain);
  }catch(error){report(error);}
 }
 async function connect(provider,automatic=false){
  if(busy)return;busy=true;for(const b of choices.querySelectorAll('button'))b.disabled=true;
  restoreAttempted=true;
  try{
   wallet=provider;status.textContent='Connecting wallet…';
   const address=automatic?await restoreWallet(localStorage,wallets):await wallets.connect(provider);
   if(!address){report(new Error('Reconnect your wallet to continue.'));return;}
   disconnect.hidden=false;
   owner=new W.PublicKey(address);
   rememberWallet(localStorage,address,wallets.connectedName());
   session=await sessionKey('interstellar-sessions-v2',owner.toBase58(),true);config=chainConfig;er=await browserChain.resolve();
   choices.hidden=true;enter.hidden=false;enter.textContent='Open planet';reset.hidden=false;
   const state=await snapshot();enter.textContent=state?'Open planet':'Generate planet';reset.hidden=!state;
   status.textContent=state?'Your colony is ready.':'Your wallet can claim one starting planet.';
   busy=false;
   if(automatic)await open(true);
  }catch(error){report(error);}
 }
 let selectedWallet=0,restoreAttempted=false;
 function scan(){
  const list=wallets.list();choices.replaceChildren();
  if(!list.length){status.textContent='Open this page in a browser with a Solana wallet installed.';return;}
  selectedWallet=Math.min(selectedWallet,list.length-1);
  const picker=document.createElement('details');picker.className='wallet-picker';
  const summary=document.createElement('summary');summary.setAttribute('aria-label','Choose wallet');
  const label=document.createElement('span');label.className='wallet-option-label';
  const arrow=document.createElement('span');arrow.textContent='▾';arrow.className='wallet-picker-arrow';
  summary.append(label,arrow);picker.append(summary);
  const options=document.createElement('div');options.className='wallet-options';options.setAttribute('role','listbox');options.setAttribute('aria-label','Wallets');
  const connectButton=document.createElement('button');connectButton.className='wallet-connect';
  const fill=(element,entry)=>{
   element.replaceChildren();
   if(entry.icon?.startsWith('data:image/')){const image=document.createElement('img');image.src=entry.icon;image.alt='';image.width=28;image.height=28;element.append(image);}
   else{const icon=document.createElement('span');icon.className='wallet-icon-placeholder';icon.textContent='◈';element.append(icon);}
   const name=document.createElement('span');name.textContent=entry.name;element.append(name);
  };
  const select=index=>{
   selectedWallet=index;fill(label,list[index]);connectButton.textContent='Connect '+list[index].name;
   [...options.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));
   picker.open=false;
  };
  list.forEach((entry,i)=>{
   const option=document.createElement('button');option.type='button';option.setAttribute('role','option');fill(option,entry);
   option.onclick=()=>{select(i);summary.focus();};options.append(option);
  });
  picker.append(options);connectButton.onclick=()=>connect(selectedWallet);select(selectedWallet);choices.append(picker,connectButton);
  picker.addEventListener('keydown',event=>{if(event.key==='Escape'){picker.open=false;summary.focus();}});
  const saved=rememberedWallet(localStorage),rememberedIndex=list.findIndex(w=>w.name===saved?.name);
  if(!restoreAttempted&&!busy&&rememberedIndex>=0){restoreAttempted=true;select(rememberedIndex);void connect(rememberedIndex,true);}
 }
 scan();(async()=>{while(gate.isConnected){await wallets.next(wallets.list().length);scan();}})();
 const resetDialog=document.createElement('dialog');resetDialog.id='wallet-reset-dialog';resetDialog.innerHTML='<h2>Reset your colony?</h2><p>All buildings, resources and population will be permanently deleted. You can then generate a fresh starting planet for this wallet.</p><form method="dialog"><button value="cancel" autofocus>Cancel</button><button value="reset">Reset colony</button></form>';gate.append(resetDialog);
 reset.onclick=()=>{if(busy)return;resetDialog.returnValue='cancel';resetDialog.showModal();};
 resetDialog.addEventListener('close',async()=>{
  if(resetDialog.returnValue!=='reset'||busy)return;busy=true;enter.disabled=reset.disabled=true;
  try{status.textContent='Sign a message to confirm resetting your colony.';await authorize('reset');chain.current=null;reset.hidden=true;enter.textContent='Generate planet';status.textContent='Colony reset. You can generate a fresh planet.';}
  catch(error){report(error);}
  finally{busy=false;enter.disabled=reset.disabled=false;}
 });
 enter.onclick=()=>open();return ready;
}
