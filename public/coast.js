const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function segmentDistance(p,a,b) {
  const ab=sub(b,a),ap=sub(p,a),t=Math.max(0,Math.min(1,dot(ap,ab)/Math.max(dot(ab,ab),1e-12)));
  return Math.hypot(...ap.map((v,i)=>v-t*ab[i]));
}
export function triangleVertices(m) {
  const b=[m[12],m[13],m[14]];
  return [b.map((x,i)=>x-m[i]),b,b.map((x,i)=>x-.5*m[i]-Math.sqrt(3)/2*m[4+i])];
}
function simplifyCoast(segments,tolerance) {
  const nodes=new Map(),edges=[];
  const node=p=>{const key=p.map(x=>Math.round(x*100000)).join(',');if(!nodes.has(key))nodes.set(key,{p,edges:[]});return nodes.get(key);};
  for(const [a,b] of segments){const x=node(a),y=node(b);if(x===y)continue;const edge={a:x,b:y,used:false};x.edges.push(edge);y.edges.push(edge);edges.push(edge);}
  const result=[];
  function simplify(points){let distance=0,index=0;for(let i=1;i<points.length-1;i++){const d=segmentDistance(points[i],points[0],points.at(-1));if(d>distance){distance=d;index=i;}}
    if(distance>tolerance){simplify(points.slice(0,index+1));simplify(points.slice(index));}else result.push([points[0],points.at(-1)]);
  }
  for(const edge of edges){if(edge.used)continue;let start=edge.a.edges.length!==2?edge.a:edge.b.edges.length!==2?edge.b:edge.a;const points=[start.p];let current=start,next=edge;
    while(next && !next.used){next.used=true;current=next.a===current?next.b:next.a;points.push(current.p);if(current===start || current.edges.length!==2)break;next=current.edges.find(e=>!e.used);}
    simplify(points);
  }
  return result;
}
export function coastlineBuffers(matrices,terrainCount,waterCount,radius,resolution=8) {
  let segments=[];
  for(let i=0;i<terrainCount;i++) {
    const points=triangleVertices(matrices.subarray(i*16,i*16+16));
    const crossings=[];
    for(let j=0;j<3;j++) {
      const a=points[j],b=points[(j+1)%3];
      const above=Math.hypot(...a)>radius;
      if(above===(Math.hypot(...b)>radius))continue;
      let lo=0,hi=1;
      for(let k=0;k<18;k++){const t=(lo+hi)/2,p=a.map((x,c)=>x+(b[c]-x)*t);if((Math.hypot(...p)>radius)===above)lo=t;else hi=t;}
      crossings.push(a.map((x,c)=>x+(b[c]-x)*(lo+hi)/2));
    }
    if(crossings.length===2)segments.push(crossings);
  }
  segments=simplifyCoast(segments,.015/resolution);
  const buffers=Array.from({length:6},()=>new Float32Array(waterCount*3));
  const textureHeight=Math.max(1,segments.length);
  const textureData=new Uint8Array(4*textureHeight*4);
  for(let id=0;id<segments.length;id++)for(let endpoint=0;endpoint<2;endpoint++) {
    for(let component=0;component<3;component++) {
      const value=Math.round((segments[id][endpoint][component]+2)/4*65535);
      const offset=id*16+endpoint*8+component*2;
      textureData[offset]=value>>8;textureData[offset+1]=value&255;
    }
  }
  for(let i=0;i<waterCount;i++) {
    const points=triangleVertices(matrices.subarray((terrainCount+i)*16,(terrainCount+i+1)*16));
    const center=points[0].map((x,k)=>(x+points[1][k]+points[2][k])/3);
    const nearest=segments.map((segment,id)=>({id,d:segmentDistance(center,...segment)})).sort((a,b)=>a.d-b.d).slice(0,18);
    for(let j=0;j<18;j++)buffers[Math.floor(j/3)][i*3+j%3]=nearest[j]?.id??nearest[0]?.id??-1;
  }
  return {buffers,segments,textureData,textureHeight,segmentCount:segments.length};
}
