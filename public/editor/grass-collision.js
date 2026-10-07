const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const epsilon=1e-8;
function rayTriangle(origin,direction,triangle){
 const [a,b,c]=triangle,e1=sub(b,a),e2=sub(c,a),p=cross(direction,e2),det=dot(e1,p);if(Math.abs(det)<epsilon)return null;
 const t=sub(origin,a),u=dot(t,p)/det;if(u< -epsilon||u>1+epsilon)return null;
 const q=cross(t,e1),v=dot(direction,q)/det;if(v< -epsilon||u+v>1+epsilon)return null;
 const distance=dot(e2,q)/det;return distance>=-epsilon?Math.max(0,distance):null;
}
function trianglesIntersect(a,b){
 const ea=a.map((p,i)=>sub(a[(i+1)%3],p)),eb=b.map((p,i)=>sub(b[(i+1)%3],p)),na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
 const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y))),...ea.map(e=>cross(na,e)),...eb.map(e=>cross(nb,e))];
 for(const axis of axes){const length=Math.hypot(...axis);if(length<epsilon)continue;const pa=a.map(p=>dot(p,axis)),pb=b.map(p=>dot(p,axis)),tolerance=epsilon*length;if(Math.max(...pa)<Math.min(...pb)-tolerance||Math.max(...pb)<Math.min(...pa)-tolerance)return false;}
 return true;
}
export function createGrassCollision(objects){
 const cell=.15,grid=new Map();
 objects.forEach((object,id)=>{for(let i=0;i<object.indices.length;i+=3){const points=object.indices.slice(i,i+3).map(v=>object.positions.slice(v*3,v*3+3));if(Math.hypot(...cross(sub(points[1],points[0]),sub(points[2],points[0])))<epsilon)continue;
  const lo=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...points.map(p=>p[a]))),triangle={points,lo,hi,id};
  for(let x=Math.floor(lo[0]/cell);x<=Math.floor(hi[0]/cell);x++)for(let z=Math.floor(lo[2]/cell);z<=Math.floor(hi[2]/cell);z++){const key=x+':'+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(triangle);}
 }});
 const contains=point=>{
  const hits=new Map();for(const triangle of grid.get(Math.floor(point[0]/cell)+':'+Math.floor(point[2]/cell))||[]){const distance=rayTriangle(point,[0,1,0],triangle.points);if(distance===null)continue;if(distance<epsilon)return true;if(!hits.has(triangle.id))hits.set(triangle.id,[]);hits.get(triangle.id).push(distance);}
  for(const distances of hits.values()){distances.sort((a,b)=>a-b);let count=0,last=-Infinity;for(const d of distances)if(d-last>epsilon){count++;last=d;}if(count%2)return true;}return false;
 };
 return {
  contains,
  intersects(blade){
   const lo=[0,1,2].map(a=>Math.min(...blade.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...blade.map(p=>p[a]))),seen=new Set();
   for(let x=Math.floor(lo[0]/cell);x<=Math.floor(hi[0]/cell);x++)for(let z=Math.floor(lo[2]/cell);z<=Math.floor(hi[2]/cell);z++)for(const triangle of grid.get(x+':'+z)||[]){if(seen.has(triangle))continue;seen.add(triangle);if(triangle.lo.some((v,a)=>v>hi[a]+epsilon)||triangle.hi.some((v,a)=>v<lo[a]-epsilon))continue;if(trianglesIntersect(blade,triangle.points))return true;}
   return contains(blade[0]);
  }
 };
}
