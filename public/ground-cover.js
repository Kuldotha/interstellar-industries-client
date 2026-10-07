const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
export function createGroundCover(areas){
  const cell=.05,buckets=new Map(),key=p=>p.map(v=>Math.floor(v/cell)).join(',');
  for(const area of areas){
    const radius=Math.hypot(...area.center),up=area.center.map(v=>v/radius);
    for(const patch of area.patches){
      const raw=area.center.map((v,i)=>v+area.scale*(area.right[i]*patch.x+area.forward[i]*patch.z)),length=Math.hypot(...raw),center=raw.map(v=>v*radius/length);
      const reach=(Math.hypot(patch.halfX,patch.halfZ)+.15)*area.scale,entry={...area,...patch,radius,up,cs:Math.cos(patch.yaw),sn:Math.sin(patch.yaw)};
      const lo=center.map(v=>Math.floor((v-reach)/cell)),hi=center.map(v=>Math.floor((v+reach)/cell));
      for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const k=`${x},${y},${z}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(entry);}
    }
  }
  const mask=point=>{
    let keep=1;
    for(const p of buckets.get(key(point))||[]){
      if(Math.abs(Math.hypot(...point)-p.radius)>(p.edges ? .8 : .15)*p.scale)continue;
      const denominator=dot(point,p.up);if(denominator<=0)continue;
      const q=point.map((v,i)=>v*p.radius/denominator-p.center[i]),x=dot(q,p.right)/p.scale-p.x,z=dot(q,p.forward)/p.scale-p.z;
      const localX=x*p.cs-z*p.sn,localZ=x*p.sn+z*p.cs;
      const distance=p.edges?Math.max(...p.edges.map(e=>e.margin-(localX-e.a[0])*e.n[0]-(localZ-e.a[1])*e.n[1])):Math.max(Math.abs(localX)-p.halfX,Math.abs(localZ)-p.halfZ);
      keep=Math.min(keep,Math.max(0,Math.min(1,(distance-.055)/.09)));
      if(keep===0)return 0;
    }
    return keep;
  };
  mask.cells=new Set(buckets.keys());mask.key=key;return mask;
}
