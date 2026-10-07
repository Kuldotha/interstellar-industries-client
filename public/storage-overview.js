import {resourceNames} from './building-definitions.js';

const icons=['granules.svg','concrete.svg','fish.svg','fibers.svg','clothes.svg','tubers.svg','beer.svg','biomass.svg'];
const rate=value=>Math.abs(value)<1e-7?'0':Math.abs(value)<.01?'<0.01':Math.abs(value).toLocaleString(undefined,{maximumFractionDigits:2});
export function createStorageOverview(core,bar){
  const details=document.createElement('details');
  details.id='storage-overview';
  details.innerHTML='<summary>Storage</summary><section class="storage-panel" aria-label="Storage overview"><div class="storage-heading"><h3>Storage</h3><button type="button" aria-label="Close storage">×</button></div><p>Production and consumption per minute</p><div class="storage-scroll"><table><thead><tr><th scope="col">Resource</th><th scope="col">Stored</th><th scope="col">Produced</th><th scope="col">Consumed</th><th scope="col">Net</th></tr></thead><tbody></tbody></table></div></section>';
  bar.append(details);
  details.querySelector('button').onclick=()=>{details.open=false;};
  details.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;details.querySelector('summary').focus();}});
  details.addEventListener('toggle',()=>{if(details.open){bar.querySelector('#economy-overview').open=false;update();}});
  bar.querySelector('#economy-overview').addEventListener('toggle',e=>{if(e.target.open)details.open=false;});
  const body=details.querySelector('tbody');
  function update(){
    if(!details.open)return;
    const stocks=new BigUint64Array(core.memory.buffer,core.industry_stock_ptr(),resourceNames.length),cap=core.industry_storage_cap();
    body.innerHTML=resourceNames.map((name,r)=>{
      const amount=Number(stocks[r])/16777216,production=core.industry_production(r),net=core.industry_rate(r)*60,consumption=Math.max(0,production-net),full=amount>=cap-1e-7;
      const status=full?(production>1e-7&&Math.abs(net)<1e-7?'Full · matching consumption':'Full'):net< -1e-7?'Using reserves':'';
      return '<tr><th scope="row"><span class="storage-resource"><img src="icons/'+icons[r]+'" alt="">'+name+'</span>'+(status?'<small>'+status+'</small>':'')+'</th><td><span>'+Math.floor(amount).toLocaleString()+' / '+cap+'</span><meter min="0" max="'+cap+'" value="'+Math.min(cap,amount)+'" aria-label="'+name+' stored"></meter></td><td>'+rate(production)+'</td><td>'+rate(consumption)+'</td><td class="'+(net>1e-7?'stock-rising':net< -1e-7?'stock-falling':'')+'">'+(net>1e-7?'+':net< -1e-7?'−':'')+rate(net)+'</td></tr>';
    }).join('');
  }
  return {update};
}
