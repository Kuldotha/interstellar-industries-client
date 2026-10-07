export function tilesInRange(origin,neighbors,range=2){
  const count=neighbors.length/6,seen=new Set();
  if(origin===null||origin<0||origin>=count)return seen;
  seen.add(origin);let frontier=[origin];
  for(let step=0;step<range;step++){
    const next=[];
    for(const tile of frontier)for(const n of neighbors.slice(tile*6,tile*6+6)){
      if(n<count&&!seen.has(n)){seen.add(n);next.push(n);}
    }
    frontier=next;
  }
  return seen;
}
export function coverageBoundary(tiles,corners){
  const edges=new Map(),key=p=>p.map(v=>Math.round(v*1e6)).join(',');
  for(const tile of tiles){
    const points=[];
    for(let i=0;i<6;i++){const p=Array.from(corners.slice(tile*18+i*3,tile*18+i*3+3));if(Math.hypot(...p)>.5)points.push(p);}
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],id=[key(a),key(b)].sort().join('|');
      if(edges.has(id))edges.delete(id);else edges.set(id,{a,b,tile});
    }
  }
  return [...edges.values()];
}
export function coverageSurface(tiles,centers,corners,waterRadius){
  const positions=[],indices=[],edges=new Map(),steps=6;
  const unit=p=>{const length=Math.hypot(...p);return p.map(v=>v/length);};
  const key=p=>p.map(v=>Math.round(v*1e6)).join(',');
  const at=(p,r)=>unit(p).map(v=>v*r);
  const triangle=(a,b,c)=>{const i=positions.length/3;positions.push(...a,...b,...c);indices.push(i,i+1,i+2);};
  let connectorTriangles=0;
  for(const tile of tiles){
    const center=Array.from(centers.slice(tile*3,tile*3+3)),radius=Math.max(Math.hypot(...center),waterRadius)+.002,up=unit(center),points=[];
    for(let i=0;i<6;i++){const p=Array.from(corners.slice(tile*18+i*3,tile*18+i*3+3));if(Math.hypot(...p)>.5)points.push(p);}
    for(let side=0;side<points.length;side++){
      const a=points[side],b=points[(side+1)%points.length],id=[key(a),key(b)].sort().join('|');
      const sample=(i,j)=>at(up.map((v,k)=>v+(a[k]-v)*i/steps+(b[k]-v)*j/steps),radius);
      for(let i=0;i<steps;i++)for(let j=0;j<steps-i;j++){
        triangle(sample(i,j),sample(i+1,j),sample(i,j+1));
        if(i+j<steps-1)triangle(sample(i+1,j),sample(i+1,j+1),sample(i,j+1));
      }
      const other=edges.get(id);
      if(!other){edges.set(id,{radius});continue;}
      if(Math.abs(radius-other.radius)<1e-6)continue;
      for(let i=0;i<steps;i++){
        const start=a.map((v,k)=>v+(b[k]-v)*i/steps),end=a.map((v,k)=>v+(b[k]-v)*(i+1)/steps);
        triangle(at(start,radius),at(end,radius),at(start,other.radius));
        triangle(at(end,radius),at(end,other.radius),at(start,other.radius));connectorTriangles+=2;
      }
    }
  }
  return {positions,indices,connectorTriangles};
}
export function coveringUtilities(tile,buildings,neighbors){
  return buildings.filter(b=>(b[1]===4||b[1]===11)&&!b[2]&&tilesInRange(b[0],neighbors).has(tile));
}
export function createUtilityOverlay(B,scene,selection){
  const renderer=selection.highlights;
  return {
    clear(){renderer.clear('utility');renderer.clear('utility-focus');},
    show(tiles,highlighted){
      renderer.show('utility',tiles,{color:[1,.78,.32],alpha:.20,wall:true});
      renderer.show('utility-focus',highlighted,{color:[.4,1,.78],alpha:.32});
    }
  };
}
