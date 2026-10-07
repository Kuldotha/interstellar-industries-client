import {sessionPublicKey,sessionSign} from './session-core.js';
export async function sessionKey(database,owner,persist){
 const bytes=await sessionPublicKey(database,owner,persist);
 return {publicKey:new window.solanaWeb3.PublicKey(bytes),sign:message=>sessionSign(database,owner,message)};
}
