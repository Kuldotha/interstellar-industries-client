import * as core from './wallet-core.js';
let name=null;
export const list=()=>core.walletNames().map((name,i)=>({name,icon:core.walletIcons()[i]}));
export const next=core.walletsChanged;
export const connect=async index=>{const address=await core.walletConnect(index);name=core.walletNames()[index];return address;};
export const silentConnect=async(address,provider)=>{const result=await core.walletSilentConnect(address,provider);if(result)name=provider;return result;};
export const connectedName=()=>name;
export const signMessage=core.walletSignMessage;
export const disconnect=async()=>{name=null;await core.walletDisconnect();};
