const key='interstellar-connected-wallet-v1';

export function rememberedWallet(storage){
  try{
    const saved=JSON.parse(storage.getItem(key));
    return typeof saved?.address==='string'&&typeof saved?.name==='string'?saved:null;
  }catch{return null;}
}

export function rememberWallet(storage,address,name){
  try{storage.setItem(key,JSON.stringify({address,name}));}catch{}
}

export function forgetWallet(storage){
  try{storage.removeItem(key);}catch{}
}

export async function restoreWallet(storage,wallets){
  const saved=rememberedWallet(storage);
  if(!saved||!wallets.list().some(w=>w.name===saved.name))return null;
  const address=await wallets.silentConnect(saved.address,saved.name);
  return address===saved.address?address:null;
}
