import {createPublicKey,verify} from 'node:crypto';
import {authorizationText,authorizationInstructions,seedFor,encodeBytes} from '../public/chain-browser.js';
export async function signAuthorization(W,api,admin,body,origin,now=Date.now()){
 if(body.origin!==origin||body.program!==api.program.toBase58())throw Error('Authorization origin or program mismatch');
 if(!Number.isSafeInteger(body.expires)||body.expires<=now||body.expires>now+120000)throw Error('Authorization expired');
 const owner=new W.PublicKey(body.owner),session=new W.PublicKey(body.session);
 if(owner.equals(session)||!W.PublicKey.isOnCurve(session.toBytes()))throw Error('Invalid session key');
 const tx=W.Transaction.from(Buffer.from(body.signedTransaction,'base64'));
 if(encodeBytes(tx.serializeMessage())!==body.transaction)throw Error('Transaction message mismatch');
 const signature=Buffer.from(body.authorizationSignature||'','base64'),key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),owner.toBuffer()]),format:'der',type:'spki'});
 if(signature.length!==64||!verify(null,Buffer.from(authorizationText(body)),key,signature))throw Error('Invalid wallet authorization');
 if(typeof body.migrate!=='boolean'||body.migrate&&body.action!=='reset')throw Error('Invalid migration');
 const expected=new W.Transaction({feePayer:session,recentBlockhash:tx.recentBlockhash}).add(...authorizationInstructions(api,owner,admin.publicKey,session,body.action,await seedFor(owner),body.migrate));
 if(!expected.serializeMessage().equals(tx.serializeMessage()))throw Error('Unsupported sponsor transaction');
 if(!tx.signatures.find(s=>s.publicKey.equals(session))?.signature||!tx.verifySignatures(false))throw Error('Invalid session signature');
 tx.partialSign(admin);return {transaction:tx.serialize().toString('base64')};
}
