export function triangleHit(o,d,a,b,c) {
  const e=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const p=[d[1]*f[2]-d[2]*f[1],d[2]*f[0]-d[0]*f[2],d[0]*f[1]-d[1]*f[0]];
  const det=e[0]*p[0]+e[1]*p[1]+e[2]*p[2];if(Math.abs(det)<1e-12)return Infinity;
  const t=[o[0]-a[0],o[1]-a[1],o[2]-a[2]],u=(t[0]*p[0]+t[1]*p[1]+t[2]*p[2])/det;
  if(u < -1e-6 || u>1+1e-6)return Infinity;
  const q=[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]];
  const v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])/det;
  if(v < -1e-6 || u+v>1+1e-6)return Infinity;
  const distance=(f[0]*q[0]+f[1]*q[1]+f[2]*q[2])/det;
  return distance>1e-7?distance:Infinity;
}
export function createTileIndex(matrices,ids,kinds,centers) {
  const triangles=Array.from(ids,(tile,i)=>{
    const m=matrices.subarray(i*16,i*16+16);
    const a=[m[12]-m[0],m[13]-m[1],m[14]-m[2]],b=[m[12],m[13],m[14]],c=[m[12]-.5*m[0]-.866025403784*m[4],m[13]-.5*m[1]-.866025403784*m[5],m[14]-.5*m[2]-.866025403784*m[6]];
    return {a,b,c,tile,kind:kinds[i],min:a.map((v,k)=>Math.min(v,b[k],c[k])),max:a.map((v,k)=>Math.max(v,b[k],c[k]))};
  });
  const build=list=>{
    if(!list.length)return null;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const i of list)for(let k=0;k<3;k++){min[k]=Math.min(min[k],triangles[i].min[k]);max[k]=Math.max(max[k],triangles[i].max[k]);}
    if(list.length<=12)return {min,max,list};
    const spans=max.map((v,k)=>v-min[k]),axis=spans.indexOf(Math.max(...spans));
    list.sort((a,b)=>triangles[a].min[axis]+triangles[a].max[axis]-triangles[b].min[axis]-triangles[b].max[axis]);
    const middle=list.length>>1;return {min,max,left:build(list.slice(0,middle)),right:build(list.slice(middle))};
  };
  const tree=build(triangles.map((_,i)=>i));
  const directions=Array.from({length:centers.length/3},(_,i)=>{const p=Array.from(centers.subarray(i*3,i*3+3)),l=Math.hypot(...p);return p.map(v=>v/l);});
  function pick(origin,direction) {
    let best=Infinity,hit=null,checks=0;
    const box=node=>{
      let near=0,far=best;
      for(let k=0;k<3;k++) {
        if(Math.abs(direction[k])<1e-12){if(origin[k]<node.min[k] || origin[k]>node.max[k])return Infinity;continue;}
        const a=(node.min[k]-origin[k])/direction[k],b=(node.max[k]-origin[k])/direction[k];
        near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return Infinity;
      }
      return near;
    };
    const walk=node=>{
      if(!node)return;
      const entry=box(node);if(!Number.isFinite(entry) || entry>best)return;
      if(node.list){for(const i of node.list){const t=triangles[i];checks++;const distance=triangleHit(origin,direction,t.a,t.b,t.c);if(distance<best){best=distance;hit=t;}}return;}
      const a=box(node.left),b=box(node.right);
      if(a<b){walk(node.left);walk(node.right);}else{walk(node.right);walk(node.left);}
    };
    walk(tree);if(!hit)return null;
    const point=origin.map((v,k)=>v+direction[k]*best);
    let tile=hit.tile;
    if(hit.kind===1 || hit.kind===2) {
      let score=-Infinity;
      directions.forEach((d,i)=>{const s=d[0]*point[0]+d[1]*point[1]+d[2]*point[2];if(s>score){score=s;tile=i;}});
    }
    return {tile,point,distance:best,kind:hit.kind,checks};
  }
  return {pick,triangles};
}
