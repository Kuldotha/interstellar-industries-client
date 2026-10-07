import {createGrassCollision} from './editor/grass-collision.js';

const modelCaches=new WeakMap();
export function createPropGrassCollision(B,models,instances){
  const cell=.04,buckets=new Map(),key=(x,y,z)=>`${x},${y},${z}`;
  const entries=models.map(model=>{
    if(!modelCaches.has(model))modelCaches.set(model,createGrassCollision([{positions:Array.from(model.positions),indices:Array.from(model.indices)}]));
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<model.positions.length;i++) {const axis=i%3;lo[axis]=Math.min(lo[axis],model.positions[i]);hi[axis]=Math.max(hi[axis],model.positions[i]);}
    return {collision:modelCaches.get(model),lo,hi};
  });
  for(let i=0;i<instances.count;i++){
    if(instances.enabled&&!instances.enabled(i))continue;
    const model=entries[instances.groups[i]],matrix=B.Matrix.FromArray(instances.matrices,i*16),inverse=matrix.clone().invert();
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let corner=0;corner<8;corner++){
      const p=B.Vector3.TransformCoordinates(new B.Vector3(...model.lo.map((v,a)=>corner&(1<<a)?model.hi[a]:v)),matrix).asArray();
      for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a]);}
    }
    const entry={...model,inverse,owners:Array.from(instances.owners.subarray(i*3,i*3+3))};
    for(let x=Math.floor(lo[0]/cell);x<=Math.floor(hi[0]/cell);x++)for(let y=Math.floor(lo[1]/cell);y<=Math.floor(hi[1]/cell);y++)for(let z=Math.floor(lo[2]/cell);z<=Math.floor(hi[2]/cell);z++){
      const k=key(x,y,z);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(entry);
    }
  }
  return {blockers(matrix,positions){
    const world=[];for(let i=0;i<positions.length;i+=3)world.push(B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i),matrix));
    const lo=[0,1,2].map(a=>Math.floor(Math.min(...world.map(p=>p.asArray()[a]))/cell)),hi=[0,1,2].map(a=>Math.floor(Math.max(...world.map(p=>p.asArray()[a]))/cell));
    const nearby=new Set();
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(const entry of buckets.get(key(x,y,z))||[])nearby.add(entry);
    const result=[];
    for(const entry of nearby){
      const local=world.map(p=>B.Vector3.TransformCoordinates(p,entry.inverse).asArray());
      if(entry.lo.some((v,a)=>local.every(p=>p[a]<v))||entry.hi.some((v,a)=>local.every(p=>p[a]>v)))continue;
      for(let i=0;i<local.length;i+=3)if(entry.collision.intersects(local.slice(i,i+3))){result.push(entry.owners);break;}
    }
    return result;
  }};
}
