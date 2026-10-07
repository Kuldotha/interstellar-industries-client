import {buildingDefinitions} from './building-definitions.js';
import {tilePolygon} from './tile-composition.js';
const hash=n=>{n=Math.imul(n^(n>>>16),0x21f0aaad);return ((n^(n>>>15))>>>0)/4294967296;};
export const agriculturalKind=kind=>buildingDefinitions[kind]?.farm!==undefined||buildingDefinitions[kind]?.field!==undefined;
export function fieldLayout(seed=0,{polygon=tilePolygon(),connected=[],height=()=>0}={}){
 const signed=polygon.reduce((s,a,i)=>{const b=polygon[(i+1)%polygon.length];return s+a[0]*b[1]-b[0]*a[1];},0),sign=Math.sign(signed);
 const edges=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);return {a,n:[-dz/length*sign,dx/length*sign],margin:connected[i]?.08:.65};});
 const sites=Array.from({length:5},(_,i)=>{const angle=(i+hash(seed+i*19)*.5)*Math.PI*2/5,r=3+hash(seed+i*31+7)*2;return [Math.cos(angle)*r,Math.sin(angle)*r];});
 function sample(x,z){
  if(edges.some(e=>(x-e.a[0])*e.n[0]+(z-e.a[1])*e.n[1]<e.margin))return null;
  const distances=sites.map((s,i)=>({i,d:(x-s[0])**2+(z-s[1])**2})).sort((a,b)=>a.d-b.d),a=sites[distances[0].i],b=sites[distances[1].i];
  const path=(distances[1].d-distances[0].d)/(2*Math.hypot(a[0]-b[0],a[1]-b[1]))<.24;
  return {plot:distances[0].i,path};
 }
 const heights=new Map(),sampleHeight=(x,z)=>{const key=Math.round(x*1e5)+':'+Math.round(z*1e5);if(!heights.has(key))heights.set(key,height(x,z));return heights.get(key);};
 return {polygon,edges,sites,sample,height:sampleHeight,extent:Math.max(...polygon.flat().map(Math.abs))};
}
export function fieldSoilGeometry(layout){
 const positions=[],normals=[],colors=[],indices=[],step=1;
 const clip=(poly,e)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[0]-e.a[0])*e.n[0]+(a[1]-e.a[1])*e.n[1]-e.margin,db=(b[0]-e.a[0])*e.n[0]+(b[1]-e.a[1])*e.n[1]-e.margin;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};

 const surfaces=[{edges:layout.edges,color:[.47,.36,.23],lift:.025}];
 for(let i=0;i<layout.sites.length;i++){
  const a=layout.sites[i],edges=[...layout.edges];
  for(let j=0;j<layout.sites.length;j++){if(i===j)continue;const b=layout.sites[j],length=Math.hypot(a[0]-b[0],a[1]-b[1]);edges.push({a:[(a[0]+b[0])/2,(a[1]+b[1])/2],n:[(a[0]-b[0])/length,(a[1]-b[1])/length],margin:.24});}
  surfaces.push({edges,color:[.29,.24,.15],lift:.035});
 }
 for(const surface of surfaces)for(let z=-layout.extent;z<layout.extent;z+=step)for(let x=-layout.extent;x<layout.extent;x+=step){
  let poly=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]];for(const e of surface.edges){poly=clip(poly,e);if(!poly.length)break;}if(poly.length<3)continue;
  const base=positions.length/3;
  for(const [px,pz]of poly){positions.push(px,layout.height(px,pz)+surface.lift,pz);normals.push(0,1,0);colors.push(...surface.color,1);}for(let i=1;i<poly.length-1;i++)indices.push(base,base+i+1,base+i);
 }return {positions,normals,colors,indices};
}

export function projectFieldPolygon(center,right,forward,corners,unit){
 const radius=Math.hypot(...center),up=center.map(v=>v/radius),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),polygon=[];
 for(let i=0;i<corners.length;i+=3){const p=Array.from(corners.slice(i,i+3));if(Math.hypot(...p)<.1)continue;const scale=radius/dot(p,up),delta=p.map((v,j)=>v*scale-center[j]),q=[dot(delta,right)/unit,dot(delta,forward)/unit];if(!polygon.some(v=>Math.hypot(v[0]-q[0],v[1]-q[1])<.01))polygon.push(q);}
 return polygon.sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
}
