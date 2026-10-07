export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>{const length=Math.hypot(...a);return a.map(v=>v/length);};
export const triangleArea=(c,a,b)=>2*Math.atan2(dot(c,cross(a,b)),1+dot(c,a)+dot(a,b)+dot(b,c));
export const polygonCenter=(polygon,vertices)=>unit(polygon.reduce((sum,id)=>sum.map((v,k)=>v+vertices[id][k]),[0,0,0]));
export function topologyEdges(cells){
 const map=new Map();cells.forEach((cell,tile)=>cell.forEach((a,i)=>{const b=cell[(i+1)%cell.length],key=a<b?a+':'+b:b+':'+a;if(!map.has(key))map.set(key,{a:Math.min(a,b),b:Math.max(a,b),tiles:[]});map.get(key).tiles.push(tile);}));return [...map.values()];
}
export function cellMetrics(vertices,cell,center){
 let area=0,inradius=Infinity,circumradius=0,minEdge=Infinity,maxEdge=0,convex=true;
 for(let i=0;i<cell.length;i++){
  const a=vertices[cell[i]],b=vertices[cell[(i+1)%cell.length]],normal=unit(cross(a,b));area+=triangleArea(center,a,b);
  inradius=Math.min(inradius,Math.asin(Math.max(-1,Math.min(1,dot(center,normal)))));
  circumradius=Math.max(circumradius,Math.acos(Math.max(-1,Math.min(1,dot(center,a)))));
  const edge=Math.acos(Math.max(-1,Math.min(1,dot(a,b))));minEdge=Math.min(minEdge,edge);maxEdge=Math.max(maxEdge,edge);
  if(cell.some(id=>dot(vertices[id],normal)<-1e-8))convex=false;
 }
 return {area,inradius,circumradius,edgeRatio:maxEdge/minEdge,convex,usableFraction:Math.PI*Math.sin(inradius)**2/area};
}
const stats=values=>{const mean=values.reduce((s,v)=>s+v,0)/values.length;return {min:Math.min(...values),max:Math.max(...values),mean,cv:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length)/mean};};
export function measureLayout(layout){
 const {vertices,cells,centers,neighbors}=layout,target=4*Math.PI/cells.length,metrics=cells.map((c,i)=>cellMetrics(vertices,c,centers[i])),pent=new Set(cells.flatMap((c,i)=>c.length===5?[i]:[]));
 const groups={pentagons:[],neighbors:[],hexagons:[]};metrics.forEach((m,i)=>groups[pent.has(i)?'pentagons':neighbors[i].some(id=>pent.has(id))?'neighbors':'hexagons'].push(m));
 return {targetArea:target,area:stats(metrics.map(m=>m.area/target)),inradius:stats(metrics.map(m=>m.inradius)),edgeRatio:stats(metrics.map(m=>m.edgeRatio)),usableFraction:stats(metrics.map(m=>m.usableFraction)),nonConvex:metrics.filter(m=>!m.convex).length,invalid:metrics.filter(m=>m.area<=0||m.inradius<=0||!Number.isFinite(m.edgeRatio)).length,totalArea:metrics.reduce((s,m)=>s+m.area,0),groups:Object.fromEntries(Object.entries(groups).map(([id,list])=>[id,{count:list.length,area:stats(list.map(m=>m.area/target)),inradius:stats(list.map(m=>m.inradius)),edgeRatio:stats(list.map(m=>m.edgeRatio))}]))};
}
export function areaObjective(layout,{uniformEdges=false,edgeWeight=.015,anchorWeight=.0001,radiusWeight=0,inradiusWeight=.05}={}){
 const {cells,centers}=layout,edges=topologyEdges(cells),target=4*Math.PI/cells.length;
 const ideals=cells.map(c=>Math.sqrt(4*target*Math.tan(Math.PI/(uniformEdges?6:c.length))/(uniformEdges?6:c.length)));
 const add=(g,id,vector,multiplier)=>{for(let k=0;k<3;k++)g[id*3+k]+=vector[k]*multiplier;};
 return x=>{
  const vertices=[],lengths=[];for(let i=0;i<x.length;i+=3){const p=Array.from(x.slice(i,i+3)),length=Math.hypot(...p);vertices.push(p.map(v=>v/length));lengths.push(length);}
  const g=new Float64Array(x.length);let energy=0;
  cells.forEach((cell,tile)=>{
   const center=centers[tile],triangles=[];let area=0;
   for(let i=0;i<cell.length;i++){
    const a=vertices[cell[i]],b=vertices[cell[(i+1)%cell.length]],det=dot(center,cross(a,b)),den=1+dot(center,a)+dot(a,b)+dot(b,center),div=den*den+det*det;
    area+=2*Math.atan2(det,den);
    const da=cross(b,center).map((v,k)=>2*(den*v-det*(center[k]+b[k]))/div),db=cross(center,a).map((v,k)=>2*(den*v-det*(a[k]+center[k]))/div);
    triangles.push([cell[i],cell[(i+1)%cell.length],da,db]);
   }
   const error=area/target-1,multiplier=2*error/(target*cells.length);energy+=error*error/cells.length;
   for(const [a,b,da,db] of triangles){add(g,a,da,multiplier);add(g,b,db,multiplier);}
  });
  if(inradiusWeight)cells.forEach(cell=>{
   const sum=cell.reduce((s,id)=>s.map((v,k)=>v+vertices[id][k]),[0,0,0]),length=Math.hypot(...sum),center=sum.map(v=>v/length),floor=Math.sin(.92*Math.sqrt(target/(2*Math.sqrt(3)))),centerGradient=[0,0,0];
   for(let i=0;i<cell.length;i++){
    const a=vertices[cell[i]],b=vertices[cell[(i+1)%cell.length]],w=cross(a,b),wl=Math.hypot(...w),normal=w.map(v=>v/wl),distance=dot(center,normal),error=Math.max(0,1-distance/floor);
    if(!error)continue;
    energy+=inradiusWeight*error*error/(cells.length*cell.length);const multiplier=-2*inradiusWeight*error/(floor*cells.length*cell.length),gw=center.map((v,k)=>multiplier*(v-distance*normal[k])/wl);
    add(g,cell[i],cross(b,gw),1);add(g,cell[(i+1)%cell.length],cross(gw,a),1);for(let k=0;k<3;k++)centerGradient[k]+=multiplier*normal[k];
   }
   const radial=dot(centerGradient,center),shared=centerGradient.map((v,k)=>(v-radial*center[k])/length);for(const id of cell)add(g,id,shared,1);
  });
  if(radiusWeight)cells.forEach(cell=>{
   const sum=cell.reduce((s,id)=>s.map((v,k)=>v+vertices[id][k]),[0,0,0]),length=Math.hypot(...sum),center=sum.map(v=>v/length),radius2=2*target/(cell.length*Math.sin(2*Math.PI/cell.length)),centerGradient=[0,0,0];
   for(const id of cell){const delta=vertices[id].map((v,k)=>v-center[k]),error=dot(delta,delta)/radius2-1,multiplier=4*radiusWeight*error/(cells.length*cell.length*radius2);energy+=radiusWeight*error*error/(cells.length*cell.length);add(g,id,delta,multiplier);for(let k=0;k<3;k++)centerGradient[k]-=delta[k]*multiplier;}
   const radial=dot(centerGradient,center),shared=centerGradient.map((v,k)=>(v-radial*center[k])/length);for(const id of cell)add(g,id,shared,1);
  });
  for(const edge of edges){
   const a=vertices[edge.a],b=vertices[edge.b],delta=a.map((v,k)=>v-b[k]),length=Math.hypot(...delta),ideal=edge.tiles.reduce((s,t)=>s+ideals[t],0)/edge.tiles.length,error=length/ideal-1,multiplier=edgeWeight*2*error/(edges.length*ideal*length);
   energy+=edgeWeight*error*error/edges.length;add(g,edge.a,delta,multiplier);add(g,edge.b,delta,-multiplier);
  }
  vertices.forEach((p,i)=>{const delta=p.map((v,k)=>v-layout.vertices[i][k]);energy+=anchorWeight*dot(delta,delta)/(vertices.length*target);add(g,i,delta,2*anchorWeight/(vertices.length*target));});
  vertices.forEach((p,i)=>{const radial=p.reduce((s,v,k)=>s+v*g[i*3+k],0);for(let k=0;k<3;k++)g[i*3+k]=(g[i*3+k]-p[k]*radial)/lengths[i];});
  return {energy,gradient:g};
 };
}
export function optimizeLayout(layout,{iterations=1000,uniformEdges=false,edgeWeight=.015,anchorWeight=.0001,radiusWeight=0,inradiusWeight=.05,progress=()=>{}}={}){
 const evaluate=areaObjective(layout,{uniformEdges,edgeWeight,anchorWeight,radiusWeight,inradiusWeight}),history=[];let x=Float64Array.from(layout.vertices.flat()),state=evaluate(x),steps=0;
 const inner=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;};
 for(;steps<iterations;steps++){
  const direction=Float64Array.from(state.gradient),alpha=[];
  for(let i=history.length-1;i>=0;i--){const h=history[i],a=inner(h.s,direction)/h.ys;alpha[i]=a;for(let j=0;j<x.length;j++)direction[j]-=a*h.y[j];}
  const last=history.at(-1),gamma=last?last.ys/inner(last.y,last.y):1;for(let j=0;j<x.length;j++)direction[j]*=gamma;
  for(let i=0;i<history.length;i++){const h=history[i],b=inner(h.y,direction)/h.ys;for(let j=0;j<x.length;j++)direction[j]+=h.s[j]*(alpha[i]-b);}
  for(let j=0;j<x.length;j++)direction[j]=-direction[j];let slope=inner(state.gradient,direction);
  if(slope>=0){history.length=0;for(let j=0;j<x.length;j++)direction[j]=-state.gradient[j];slope=-inner(state.gradient,state.gradient);}
  if(Math.sqrt(inner(state.gradient,state.gradient))<1e-10)break;
  let step=1,next,candidate;for(let backtrack=0;backtrack<24;backtrack++){candidate=x.map((v,j)=>v+step*direction[j]);next=evaluate(candidate);if(Number.isFinite(next.energy)&&next.energy<=state.energy+1e-4*step*slope)break;step*=.5;}
  if(!next||next.energy>=state.energy)break;
  const s=candidate.map((v,j)=>v-x[j]),y=next.gradient.map((v,j)=>v-state.gradient[j]),ys=inner(y,s);
  if(ys>1e-16){history.push({s,y,ys});if(history.length>12)history.shift();}
  x=candidate;state=next;if(steps%100===0)progress({step:steps,energy:state.energy});
 }
 const vertices=[];for(let i=0;i<x.length;i+=3)vertices.push(unit(Array.from(x.slice(i,i+3))));
 const centers=layout.cells.map(cell=>polygonCenter(cell,vertices));
 return {layout:{...layout,vertices,centers},iterations:steps,energy:state.energy};
}
export function quantizeLayout(layout){const q=1048576,fixedVertices=layout.vertices.map(p=>p.map(v=>Math.round(v*q))),fixedCenters=layout.centers.map(p=>p.map(v=>Math.round(v*q)));return {...layout,vertices:fixedVertices.map(p=>unit(p.map(v=>v/q))),centers:fixedCenters.map(p=>unit(p.map(v=>v/q))),fixedVertices,fixedCenters,coordinateScale:q};}
