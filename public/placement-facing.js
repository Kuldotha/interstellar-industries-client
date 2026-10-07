export function createPlacementFacing(random=Math.random){
 let choices=new Map(),preferred;
 const choose=(tile,options)=>{
  if(!options.length)return 0;
  if(options.includes(preferred))return preferred;
  if(!options.includes(choices.get(tile)))choices.set(tile,options[Math.floor(random()*options.length)]);
  return choices.get(tile);
 };
 return {choose,reset(facing){choices.clear();preferred=facing;},rotate(tile,options){if(!options.length)return 0;preferred=options[(options.indexOf(choose(tile,options))+1)%options.length];choices.set(tile,preferred);return preferred;}};
}
