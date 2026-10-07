export function createOptimisticActions({apply,restore,send,refresh,changed,status,initial}){
 const pending=[];let running=false,recovering=false,confirmed=initial;
 const report=()=>status(null,pending.length);
 function enqueue(action,...args){
  if(recovering)return 1;
  const command={action,args},error=apply(command);if(error)return error;
  pending.push(command);changed();report();void drain();return 0;
 }
 async function drain(){
  if(running)return;running=true;
  try{
   while(pending.length){
    const command=pending[0];
    try{
     const snapshot=await send(command);pending.shift();confirmed=snapshot;restore(snapshot);
     for(const queued of pending){const error=apply(queued);if(error)throw Error('Pending action is no longer valid ('+error+').');}
     changed();report();
    }catch(error){
     recovering=true;pending.length=0;
     if(confirmed){restore(confirmed);changed();}
     try{confirmed=await refresh();restore(confirmed);recovering=false;}catch(syncError){status(new Error(error.message+' Unable to resync; reload to reconnect. '+syncError.message),0);return;}
     changed();status(error,0);return;
    }
   }
  }finally{running=false;}
 }
 return {enqueue,get pending(){return pending.length;}};
}
