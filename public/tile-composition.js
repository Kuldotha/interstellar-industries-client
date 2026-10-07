import {missingCompositionModels} from './composition-references.js';
import {defaultUrbanConnection} from './urban-connections.js';
import {TILE_RADIUS_METERS,tileCornerOffset} from './model-units.js';

export const compositionTargets=[
 ['biome:1','Temperate ground','biome',1],['biome:0','Ocean floor','biome',0],['biome:2','Polar ground','biome',2],
 ['feature:1','Forest','feature',1],['feature:2','Stone deposit','feature',2],
 ['building:2','Housing','building',2],['building:3','Fishing docks','building',3],['building:0','Granule quarry','building',0],['building:1','Concrete factory','building',1],['building:4','Commons','building',4],
["building:5","Fiber Farm","building",5],["building:6","Weaving Mill","building",6],["building:7","Tuber Farm","building",7],["building:8","Brewery","building",8],["building:9","Biomass Farm","building",9],["building:10","Biomass Power Station","building",10],["building:11","Radio Station","building",11],["building:12","Fiber Field","building",12],["building:13","Tuber Field","building",13],["building:14","Biomass Field","building",14],["building:15","Generator Module","building",15]
];
export const tilePolygon=()=>Array.from({length:6},(_,i)=>tileCornerOffset(i));
export const defaultFixed=model=>({id:crypto.randomUUID(),name:'Fixed object',model,appearance:'',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],blockScatter:true});
export const defaultScatter=model=>({id:crypto.randomUUID(),name:'Scattered props',models:[model],appearance:'',count:[6,10],spacing:1,scale:[1,1],yaw:[0,360],area:'whole',surface:'land',margin:.3});
export function validateCompositions(data,library,authoring){
 const fail=message=>{throw Error(message);},finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(data?.version!==1||!Array.isArray(data.configs)||data.configs.length!==compositionTargets.length)fail('Invalid tile configurations');
 const missing=missingCompositionModels(data,library);
 if(missing.length)fail('Missing models: '+missing.map(m=>m.name+' — '+m.uses.map(u=>(compositionTargets.find(t=>t[0]===u.config)?.[1]||u.config)+' / '+u.entry).join(', ')).join('; '));
 const targets=new Set(),models=new Set(library.models.filter(m=>m.active).map(m=>m.id));
 const pair=(p,min,max)=>Array.isArray(p)&&p.length===2&&p.every(v=>finite(v,min,max))&&p[0]<=p[1];
 const vector=(v,min,max)=>Array.isArray(v)&&v.length===3&&v.every(n=>finite(n,min,max));
 for(const c of data.configs){
  if(!compositionTargets.some(t=>t[0]===c.id)||targets.has(c.id))fail('Invalid configuration target');targets.add(c.id);
  if(c.crop&&(!['fiber','tuber','biomass'].includes(c.crop.model)||!Array.isArray(c.crop.color)||c.crop.color.length!==3||c.crop.color.some(v=>!finite(v,0,1))||!finite(c.crop.height,.1,3)||!finite(c.crop.spacing,.25,2)||!finite(c.crop.rowSpacing,.5,4)||!finite(c.crop.rowWidth,.1,c.crop.rowSpacing)||!finite(c.crop.extent,1,8)))fail('Invalid crop configuration');
  for(const e of c.fixed||[])if(e.animation&&(e.animation.axis!=='y'||!finite(e.animation.degrees,0,30)||!finite(e.animation.period,10,120)))fail('Invalid irrigation animation');
  if(!Array.isArray(c.fixed)||!Array.isArray(c.scatter)||c.fixed.length>128||c.scatter.length>32)fail('Invalid composition');
  if(c.urbanConnections&&(!models.has(c.urbanConnections.model)||typeof c.urbanConnections.appearance!=='string'||c.urbanConnections.appearance&&!authoring.appearances[c.urbanConnections.appearance]))fail('Invalid urban connection');
  if(c.urbanConnections){const u={...defaultUrbanConnection(c.urbanConnections.model),...c.urbanConnections};if(!Number.isInteger(u.count)||u.count<0||u.count>16||!finite(u.spacing,0,30)||!vector(u.position,-100,100)||!vector(u.rotation,-3600,3600)||!vector(u.rotationStep,-3600,3600)||!vector(u.scale,.01,20))fail('Invalid connection placement');}
  const ids=new Set();
  for(const e of [...c.fixed,...c.scatter]){
   if(typeof e.id!=='string'||!e.id.length||e.id.length>100||ids.has(e.id)||typeof e.name!=='string'||e.name.length>100)fail('Invalid entry');ids.add(e.id);
   if(typeof e.appearance!=='string'||e.appearance&&!authoring.appearances[e.appearance])fail('Unknown appearance');
  }
  for(const e of c.fixed){if(e.randomRotation&&(!Array.isArray(e.randomRotation)||e.randomRotation.length!==3||!e.randomRotation.every(r=>pair(r,-3600,3600))))fail('Invalid random rotation');if(!models.has(e.model)||!vector(e.position,-100,100)||!vector(e.rotation,-3600,3600)||!vector(e.scale,.01,20)||(e.blockScatter!==undefined&&typeof e.blockScatter!=='boolean'))fail('Invalid fixed object');}
  for(const e of c.scatter){if(!Array.isArray(e.models)||e.models.length!==1||e.models.some(m=>!models.has(m))||!pair(e.count,0,256)||!e.count.every(Number.isInteger)||!pair(e.scale,.01,20)||!pair(e.yaw,-3600,3600)||!finite(e.spacing,0,30)||!finite(e.margin,0,10)||!['whole','interior','border','corners'].includes(e.area)||!['any','land','water'].includes(e.surface))fail('Invalid scatter rule');}
  if(c.scatter.reduce((sum,e)=>sum+e.count[1],c.fixed.length)>512)fail('At most 512 objects per tile');
 }
 return data;
}
export function pointInPolygon(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,az]=polygon[i],[bx,bz]=polygon[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;}return inside;}
const distanceToSegment=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);};
function randomStream(seed){let state=seed>>>0;return()=>{state=(state+0x6d2b79f5)|0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
function hash(seed,text){for(const c of text)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;}
export function modelFootprint(parts){let radius=0;for(const p of parts)for(let i=0;i<p.positions.length;i+=3)radius=Math.max(radius,Math.hypot(p.positions[i],p.positions[i+2]));return radius;}
export function generateComposition(config,seed,{polygon=tilePolygon(),water=false,footprints={}}={}){
 const objects=config.fixed.map(e=>{const random=randomStream(hash(seed,e.id)),rotationOffset=(e.randomRotation||[[0,0],[0,0],[0,0]]).map(([min,max])=>min+random()*(max-min));return {...structuredClone(e),rotation:e.rotation.map((v,i)=>v+rotationOffset[i]),rotationOffset,entry:e.id,fixed:true};}),missed=[];
 const occupied=objects.filter(o=>o.blockScatter!==false).map(o=>({x:o.position[0],z:o.position[2],radius:(footprints[o.model]||0)*Math.max(o.scale[0],o.scale[2])}));
 const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]),lo=[Math.min(...xs),Math.min(...zs)],hi=[Math.max(...xs),Math.max(...zs)];
 for(const rule of config.scatter){
  if(rule.surface!=='any'&&(rule.surface==='water')!==water)continue;
  const random=randomStream(hash(seed,rule.id)),target=rule.count[0]+Math.floor(random()*(rule.count[1]-rule.count[0]+1));let placed=0;
  for(let attempt=0;attempt<target*80&&placed<target;attempt++){
   const x=lo[0]+random()*(hi[0]-lo[0]),z=lo[1]+random()*(hi[1]-lo[1]);if(!pointInPolygon(x,z,polygon))continue;
   const edge=Math.min(...polygon.map((a,i)=>distanceToSegment(x,z,a,polygon[(i+1)%polygon.length])));
   if(edge<rule.margin||rule.area==='interior'&&edge<2||rule.area==='border'&&edge>2.5||rule.area==='corners'&&Math.min(...polygon.map(p=>Math.hypot(x-p[0],z-p[1])))>3)continue;
   const model=rule.models[Math.floor(random()*rule.models.length)],scale=rule.scale[0]+random()*(rule.scale[1]-rule.scale[0]),radius=(footprints[model]||0)*scale;
   if(occupied.some(o=>Math.hypot(x-o.x,z-o.z)<Math.max(rule.spacing,o.radius+radius)))continue;
   objects.push({id:rule.id+':'+placed,entry:rule.id,model,appearance:rule.appearance,position:[x,0,z],rotation:[0,rule.yaw[0]+random()*(rule.yaw[1]-rule.yaw[0]),0],scale:[scale,scale,scale],fixed:false});occupied.push({x,z,radius});placed++;
  }
  if(placed<target)missed.push({entry:rule.id,requested:target,placed});
 }
 return {objects,missed};
}
export function tileConfigurations(data,surface,features){
 return data.configs.filter(c=>(c.id==='biome:'+surface&&!features||c.id==='feature:1'&&(features&1)||c.id==='feature:2'&&(features&2)));
}
