export function restoreInventory(core,saved){
        if(saved.version>=11){
          if(!Array.isArray(saved.stocks)||saved.stocks.length!==(saved.version>=14?8:3)||!Array.isArray(saved.flow)||saved.flow.length!==(saved.version>=14?8:3))throw Error('Invalid inventory');
          saved.stocks.forEach((value,r)=>{const q=BigInt(value);if(q<0n||q>(1n<<40n))throw Error('Invalid inventory');core.industry_restore_stock(r,Number(q&0xffffffffn),Number(q>>32n));const flow=saved.flow[r];if(!Array.isArray(flow)||flow.length!==2||!flow.every(Number.isInteger)||Math.abs(flow[0])>=60||flow[1]<0||flow[1]>=60*16777216)throw Error('Invalid flow');core.industry_restore_flow(r,...flow);});
        }else{
          const migrated=saved.pool.map(x=>BigInt(x)*16777216n);while(migrated.length<3)migrated.push(0n);
          for(const b of saved.buildings){if(b[1]===1&&(saved.version>=4?b[5]:b[4]>0))migrated[0]+=16777216n;if(b[1]===2&&b[8])migrated[2]+=BigInt(Math.round(b[8]*16777216/(saved.version>=10?3000:saved.version>=8?3600:600)));}
          migrated.forEach((q,r)=>core.industry_restore_stock(r,Number(q&0xffffffffn),Number(q>>32n)));
        }
  const reward=saved.version<12&&saved.tutorial>=4?2+(saved.tutorial>=5?3:0):0;
  if(reward){const q=new BigUint64Array(core.memory.buffer,core.industry_stock_ptr(),3)[1]+BigInt(reward)*16777216n;core.industry_restore_stock(1,Number(q&0xffffffffn),Number(q>>32n));}
}
