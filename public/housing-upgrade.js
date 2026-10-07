export function housingUpgradeReadiness(building,commonsCovered,fishFulfilled=Boolean(building?.[10]),extraNeeds=[false,false,false]){
  if(!building)return {ready:false,reason:'Choose a housing unit'};
  if(building[1]!==2)return {ready:false,reason:'Only housing can upgrade'};
  const missing=[];
  if(!commonsCovered)missing.push('Commons');
  if(!fishFulfilled)missing.push('Fish');
  ['Worker clothes','Beer','Radio'].forEach((name,i)=>{if(!extraNeeds[i])missing.push(name);});
  if(missing.length)return {ready:false,reason:'Unfulfilled needs: '+missing.join(', ')};
  if(building[7]<15)return {ready:false,reason:`Full habitation required · ${building[7]} / 15 residents`};
  return {ready:true,reason:'All needs met · Fully inhabited · Next tier not available yet'};
}
