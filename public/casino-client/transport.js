export function createConnections(Connection){
 const connections=new Map();
 return endpoint=>{if(!connections.has(endpoint))connections.set(endpoint,new Connection(endpoint,'confirmed'));return connections.get(endpoint);};
}
export async function signWithSession(Transaction,connection,session,instructions){
 const latest=await connection.getLatestBlockhash('confirmed');
 const transaction=new Transaction({feePayer:session.publicKey,recentBlockhash:latest.blockhash}).add(...instructions);
 transaction.addSignature(session.publicKey,await session.sign(transaction.serializeMessage()));
 return transaction;
}
export async function confirmSignature(connection,signature){
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  const {value:[status]}=await connection.getSignatureStatuses([signature]);
  if(status?.err)throw Error('Transaction failed: '+JSON.stringify(status.err));
  if(status&&(status.confirmationStatus==='confirmed'||status.confirmationStatus==='finalized'))return signature;
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 throw Error('Transaction confirmation timed out. Reopen your planet to check its state.');
}
