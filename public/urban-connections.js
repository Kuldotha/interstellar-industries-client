import { buildingDefinitions } from './building-definitions.js';
export function urbanLinks(id,buildings,neighbors,centers,definitions=buildingDefinitions){
  if(!definitions[buildings.get(id)?.[1]]?.urban)return [];
  const radius=t=>Math.hypot(...centers.slice(t*3,t*3+3));
  return Array.from(neighbors.slice(id*6,id*6+6)).filter(t=>definitions[buildings.get(t)?.[1]]?.urban&&Math.abs(radius(t)-radius(id))<.0001).sort((a,b)=>a-b);
}
export function urbanConnectionOwner(a,b,buildings,definitions=buildingDefinitions){
  const definition=id=>definitions[buildings.get(id)?.[1]];
  if(!definition(a)?.urban||!definition(b)?.urban)return null;
  return Math.min(a,b);
}
export function urbanConnectionPlacements(x,z,offset){
 const length=Math.hypot(x,z);if(length<1e-8)return [];
 const dx=z/length*offset,dz=-x/length*offset,yaw=Math.atan2(x,z);
 return [{x:x+dx,z:z+dz,yaw:yaw-Math.PI/2},{x:x-dx,z:z-dz,yaw:yaw+Math.PI/2}];
}
export const defaultUrbanConnection=model=>({model,appearance:'',count:2,spacing:16/3,position:[0,0,0],rotation:[0,-90,0],rotationStep:[0,180,0],scale:[1,1,1]});
export function urbanConnectionObjects(config,x,z){
 const c={...defaultUrbanConnection(config.model),...config},length=Math.hypot(x,z);if(length<1e-8)return [];
 const sin=x/length,cos=z/length,yaw=Math.atan2(x,z)*180/Math.PI;
 return Array.from({length:c.count},(_,i)=>{const along=c.position[0]+((c.count-1)/2-i)*c.spacing,across=c.position[2];return {id:'urban-'+i,model:c.model,appearance:c.appearance,position:[x+cos*along+sin*across,c.position[1],z-sin*along+cos*across],rotation:c.rotation.map((v,k)=>v+i*c.rotationStep[k]+(k===1?yaw:0)),scale:[...c.scale]};});
}
export function urbanEdgeMidpoint(B,id,other,centers,right,forward,scale){
 const center=B.Vector3.FromArray(centers.slice(id*3,id*3+3)),radius=center.length(),up=center.normalizeToNew(),next=B.Vector3.FromArray(centers.slice(other*3,other*3+3)).normalize(),middle=up.add(next).normalize(),plane=middle.scale(radius/B.Vector3.Dot(middle,up)).subtract(center);
 return {x:B.Vector3.Dot(plane,right)/scale,z:B.Vector3.Dot(plane,forward)/scale};
}
