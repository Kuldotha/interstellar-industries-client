const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a);return l>1e-10?a.map(v=>v/l):[0,0,0];};
export const faceKey=([p,f])=>`${p}:${f}`;
const pointKey=p=>p.map(v=>Math.round(v*1e6)).join(',');
export function topology(parts){
 const faces=new Map(),edges=new Map();
 parts.forEach((p,part)=>{for(let f=0;f<p.indices.length/3;f++){
  const points=p.indices.slice(f*3,f*3+3).map(i=>p.positions.slice(i*3,i*3+3)),keys=points.map(pointKey),id=faceKey([part,f]);
  const face={id,ref:[part,f],points,keys,normal:unit(cross(sub(points[1],points[0]),sub(points[2],points[0]))),links:[]};faces.set(id,face);
  for(let i=0;i<3;i++){const edge=[keys[i],keys[(i+1)%3]].sort().join('|');if(!edges.has(edge))edges.set(edge,[]);edges.get(edge).push({id,edge,corners:[i,(i+1)%3]});}
 }});
 for(const entries of edges.values())if(entries.length===2){for(const a of entries){const b=entries.find(x=>x!==a);faces.get(a.id).links.push({...a,to:b.id,other:b.corners});}}
 return {faces,edges};
}
export function connected(topo,start,seams=[],coplanar=false){
 const seen=new Set(start),queue=[...start],blocked=new Set(seams);
 for(let i=0;i<queue.length;i++){const f=topo.faces.get(queue[i]);for(const l of f.links){if(blocked.has(l.edge)||seen.has(l.to)||coplanar&&dot(f.normal,topo.faces.get(l.to).normal)<.9999)continue;seen.add(l.to);queue.push(l.to);}}
 return [...seen];
}
function project(face,turn){
 let up=sub([0,1,0],face.normal.map(v=>v*face.normal[1]));if(Math.hypot(...up)<1e-6)up=sub([0,0,1],face.normal.map(v=>v*face.normal[2]));up=unit(up);const right=unit(cross(up,face.normal));
 return face.points.map(p=>{let x=dot(p,right),y=dot(p,up);for(let i=0;i<((turn%4)+4)%4;i++)[x,y]=[-y,x];return [x,y];});
}
function unfold(parent,child,link,uv){
 const a=link.corners[0],b=link.corners[1],ca=child.keys.indexOf(parent.keys[a]),cb=child.keys.indexOf(parent.keys[b]),cc=[0,1,2].find(i=>i!==ca&&i!==cb),pc=[0,1,2].find(i=>i!==a&&i!==b);
 const edge=sub(uv[b],uv[a]),length=Math.hypot(...edge);if(length<1e-9)throw Error('Cannot map a degenerate face');const dx=edge[0]/length,dy=edge[1]/length;
 const da=Math.hypot(...sub(child.points[cc],child.points[ca])),db=Math.hypot(...sub(child.points[cc],child.points[cb])),x=(da*da-db*db+length*length)/(2*length),h=Math.sqrt(Math.max(0,da*da-x*x));
 const side=Math.sign(dx*(uv[pc][1]-uv[a][1])-dy*(uv[pc][0]-uv[a][0]))||1,result=[];result[ca]=[...uv[a]];result[cb]=[...uv[b]];result[cc]=[uv[a][0]+dx*x+dy*h*side,uv[a][1]+dy*x-dx*h*side];return result;
}
export function mapFaces(topo,ids,{continuous=false,turn=0,start=1,end=1,seams=[]}={}){
 const result={},pending=new Set(ids),blocked=new Set(seams);
 while(pending.size){
  const seed=pending.values().next().value,initial=project(topo.faces.get(seed),turn),raw=new Map([[seed,initial]]),queue=[seed];pending.delete(seed);
  if(continuous)for(let i=0;i<queue.length;i++){const id=queue[i],face=topo.faces.get(id);for(const link of face.links){if(blocked.has(link.edge)||!ids.includes(link.to))continue;const next=unfold(face,topo.faces.get(link.to),link,raw.get(id));if(raw.has(link.to)){if(next.some((p,k)=>Math.hypot(...sub(p,raw.get(link.to)[k]))>1e-4))throw Error('This surface cannot unfold continuously. Add seams or select a smaller strip.');continue;}if(!pending.has(link.to))continue;pending.delete(link.to);raw.set(link.to,next);queue.push(link.to);}}
  const mins=[0,1].map(k=>Math.min(...initial.map(p=>p[k]))),spans=[0,1].map(k=>Math.max(...initial.map(p=>p[k]))-mins[k]);
  for(const [id,uv] of raw)result[id]={uv:uv.map(p=>p.map((v,k)=>(v-mins[k])/Math.max(spans[k],1e-8))),start,end,turn,layout:continuous?'continuous':'repeat'};
 }
 return result;
}
export function bakeMappings(model,mappings){model.aoMapping??={};for(const [id,m] of Object.entries(mappings)){model.aoMapping[id]=m;const [part,face]=id.split(':').map(Number);m.uv.forEach((p,i)=>model.ao[part][face*3+i]=m.start+(m.end-m.start)*p[1]);}}
export function matchEdges(topo,model,ids){
 if(ids.length<2)throw Error('Select a starting face and at least one connected face');
 const visited=new Set([ids[0]]),queue=[ids[0]],blocked=new Set(model.aoSeams||[]);
 for(let q=0;q<queue.length;q++)for(const l of topo.faces.get(queue[q]).links){if(!ids.includes(l.to)||visited.has(l.to)||blocked.has(l.edge))continue;visited.add(l.to);queue.push(l.to);}
 if(visited.size!==ids.length)throw Error('Select connected faces without seams between them');
 const values=new Map();
 for(const id of queue){const face=topo.faces.get(id),[p,f]=face.ref;face.keys.forEach((key,i)=>{if(!values.has(key))values.set(key,model.ao[p][f*3+i]);});}
 for(const id of queue.slice(1)){const face=topo.faces.get(id),[p,f]=face.ref;face.keys.forEach((key,i)=>model.ao[p][f*3+i]=values.get(key));delete model.aoMapping?.[id];}
}
