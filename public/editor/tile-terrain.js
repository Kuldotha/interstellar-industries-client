import {tilePolygon} from '../tile-composition.js';
export const PREVIEW_HEIGHT_STEP=.02*8/.075;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),scale=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],lerp=(a,b,t)=>add(a,scale(sub(b,a),t));
function footprint([x,,z],kind,t){
 if(kind===0){const e=-z/(.4*Math.sqrt(3)),f=(-x-.4*e)/.8;return add(t[0],add(scale(sub(t[1],t[0]),e),scale(sub(t[2],t[0]),f)));}
 if(kind===1){const uz=.4*Math.sqrt(3),vz=-.1*Math.sqrt(3),d=-.4*vz+.3*uz,u=((x+.4)*vz+.3*(z+uz))/d,v=(-.4*(z+uz)-uz*(x+.4))/d;return lerp(lerp(t[0],t[1],u),lerp(t[3],t[2],u),v);}
 const sum=(-x-.8)/.3,diff=z/(.1*Math.sqrt(3));return add(t[0],add(scale(sub(t[1],t[0]),(sum-diff)/2),scale(sub(t[2],t[0]),(sum+diff)/2)));
}
export function previewTerrain(tiles,shapes,surface,cliff){
 const positions=[],normals=[],colors=[],indices=[],pieces=[],corners=new Map(),polygon=tilePolygon();
 const inner=(tile,p)=>[tile.x+p[0]*.8,0,tile.z+p[1]*.8];
 function emit(index,kind,targets,height,step){
  const mesh=shapes[index],start=indices.length;
  const point=p=>{const q=footprint(p,kind,targets);q[1]=10+height+p[1]/.2*step;return q;};
  for(let face=0;face<mesh.triangles.length;face++){
   const ids=mesh.triangles[face],vertices=ids.map(id=>point(mesh.vertices[id]));
   for(let j=0;j<3;j++){
    const p=mesh.vertices[ids[j]],q=point(p),eps=.001;
    const dx=scale(sub(point(add(p,[eps,0,0])),q),1/eps),dy=[0,step/.2,0],dz=scale(sub(point(add(p,[0,0,eps])),q),1/eps),n=mesh.normals[face];
    let normal=add(add(scale(cross(dy,dz),n[0]),scale(cross(dz,dx),n[1])),scale(cross(dx,dy),n[2]));
    normal=scale(normal,(dot(dx,cross(dy,dz))<0?-1:1)/(Math.hypot(...normal)||1));
    const weights=mesh.weights[face][j],color=weights.reduce((s,v)=>s+v,0)<.02?cliff:surface;
    positions.push(...vertices[j]);normals.push(...normal);colors.push(...color,1);
   }
   const first=positions.length/3-3,geometric=cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0]));
   indices.push(...(dot(geometric,normals.slice(first*3,first*3+3))<0?[first+2,first+1,first]:[first,first+1,first+2]));
  }
  pieces.push({kind,index,start,count:indices.length-start});
 }
 tiles.forEach((tile,id)=>polygon.forEach((p,i)=>{
  emit(0,0,[[tile.x,0,tile.z],inner(tile,p),inner(tile,polygon[(i+1)%6])],tile.height,PREVIEW_HEIGHT_STEP);
  const key=[tile.x+p[0],tile.z+p[1]].map(v=>Math.round(v*1e5)).join(':');
  if(!corners.has(key))corners.set(key,[]);corners.get(key).push({id,p});
 }));
 const cornerKey=(tile,p)=>[tile.x+p[0],tile.z+p[1]].map(v=>Math.round(v*1e5)).join(':');
 tiles.forEach((tile,id)=>polygon.forEach((p,i)=>{
  const q=polygon[(i+1)%6],atP=corners.get(cornerKey(tile,p)),atQ=corners.get(cornerKey(tile,q));
  if(atP.some(a=>a.id!==id&&atQ.some(b=>b.id===a.id)))return;
  emit(1,1,[inner(tile,p),inner(tile,q),[tile.x+q[0],0,tile.z+q[1]],[tile.x+p[0],0,tile.z+p[1]]],tile.height,PREVIEW_HEIGHT_STEP);
  pieces.at(-1).boundary=true;
 }));
 for(const entries of corners.values()){
  if(entries.length!==2)continue;
  const [a,b]=entries,tile=tiles[a.id],tip=[tile.x+a.p[0],0,tile.z+a.p[1]];
  emit(5,2,[inner(tile,a.p),inner(tiles[b.id],b.p),tip],tile.height,PREVIEW_HEIGHT_STEP);
  pieces.at(-1).boundary=true;
 }
 const edges=new Map();
 for(const entries of corners.values())for(let a=0;a<entries.length;a++)for(let b=a+1;b<entries.length;b++){
  const pair=[entries[a],entries[b]].sort((a,b)=>a.id-b.id),key=pair.map(e=>e.id).join(':');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(pair);
 }
 for(const endpoints of edges.values()){
  if(endpoints.length!==2)continue;
  const [a,b]=endpoints[0].map(e=>e.id),high=tiles[a].height>=tiles[b].height?a:b,low=high===a?b:a;
  let first=endpoints[0],second=endpoints[1];
  const get=(end,id)=>inner(tiles[id],end.find(e=>e.id===id).p);
  if(cross(sub(get(first,high),[tiles[high].x,0,tiles[high].z]),sub(get(second,high),[tiles[high].x,0,tiles[high].z]))[1]<0)[first,second]=[second,first];
  const delta=tiles[high].height-tiles[low].height,levels=Math.min(3,Math.ceil(delta/PREVIEW_HEIGHT_STEP));
  emit(1+levels,1,[get(first,high),get(second,high),get(second,low),get(first,low)],tiles[high].height,levels?delta/levels:PREVIEW_HEIGHT_STEP);
 }
 for(const entries of corners.values()){
  if(entries.length!==3)continue;
  const cx=entries.reduce((s,e)=>s+tiles[e.id].x,0)/3,cz=entries.reduce((s,e)=>s+tiles[e.id].z,0)/3;
  entries.sort((a,b)=>Math.atan2(tiles[a.id].x-cx,tiles[a.id].z-cz)-Math.atan2(tiles[b.id].x-cx,tiles[b.id].z-cz));
  const h=entries.map(e=>tiles[e.id].height),rotation=h[2]>=h[1]&&h[2]>h[0]?2:h[1]>=h[0]&&h[1]>h[2]?1:0,ordered=[0,1,2].map(i=>entries[(i+rotation)%3]);
  const high=tiles[ordered[0].id].height,delta=high-Math.min(...h),levels=Math.min(3,Math.ceil(delta/PREVIEW_HEIGHT_STEP)),step=levels?delta/levels:PREVIEW_HEIGHT_STEP;
  const [d0,d1]=ordered.slice(1).map(e=>Math.round((high-tiles[e.id].height)/step));
  emit(d0===0?5:6+(d0-1)*4+d1,2,ordered.map(e=>inner(tiles[e.id],e.p)),high,step);
 }
 return {positions,normals,colors,indices,pieces};
}
