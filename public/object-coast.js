import {triangleVertices,segmentDistance} from './coast.js';
export function waterlineSegments(positions,indices,radius){
  const result=[];
  for(let i=0;i<indices.length;i+=3){
    const points=Array.from(indices.slice(i,i+3),id=>Array.from(positions.slice(id*3,id*3+3))),crossings=[];
    for(let j=0;j<3;j++){
      const a=points[j],b=points[(j+1)%3],above=Math.hypot(...a)>radius;
      if(above===(Math.hypot(...b)>radius))continue;
      let lo=0,hi=1;
      for(let k=0;k<20;k++){
        const t=(lo+hi)/2,p=a.map((x,c)=>x+(b[c]-x)*t);
        if((Math.hypot(...p)>radius)===above)lo=t;else hi=t;
      }
      crossings.push(a.map((x,c)=>x+(b[c]-x)*(lo+hi)/2));
    }
    if(crossings.length===2 && Math.hypot(...crossings[0].map((x,k)=>x-crossings[1][k]))>1e-7)result.push(crossings);
  }
  return result;
}
export function objectCoastBuffers(segments,matrices,radius,resolution){
  const count=matrices.length/16,ranges=new Float32Array(count*2),packed=[];
  const cell=.5/resolution,grid=new Map();
  const key=(x,y,z)=>`${x},${y},${z}`;
  for(let id=0;id<segments.length;id++){
    const [a,b]=segments[id],min=a.map((v,k)=>Math.floor(Math.min(v,b[k])/cell)),max=a.map((v,k)=>Math.floor(Math.max(v,b[k])/cell));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
      const k=key(x,y,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(id);
    }
  }
  for(let i=0;i<count;i++){
    const points=triangleVertices(matrices.subarray(i*16,i*16+16));
    let center=points[0].map((v,k)=>(v+points[1][k]+points[2][k])/3);const length=Math.hypot(...center);center=center.map(v=>v*radius/length);
    const reach=Math.max(...points.map(p=>Math.hypot(...p.map((v,k)=>v-center[k]))))+.36/resolution;
    const min=center.map(v=>Math.floor((v-reach)/cell)),max=center.map(v=>Math.floor((v+reach)/cell)),ids=new Set();
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++)for(const id of grid.get(key(x,y,z))||[])ids.add(id);
    ranges[i*2]=packed.length/8;
    for(const id of ids)if(segmentDistance(center,...segments[id])<=reach){for(const p of segments[id])packed.push(...p,0);}
    ranges[i*2+1]=packed.length/8-ranges[i*2];
  }
  const width=256,height=Math.max(1,Math.ceil(packed.length/(width*4))),data=new Float32Array(width*height*4);data.set(packed);
  return {ranges,data,width,height};
}
export function createObjectCoast(B,scene,material,waterMesh){
  const cache=new WeakMap();let texture;
  return {update(meshes,matrices,radius,resolution){
    const segments=[];
    for(const mesh of meshes){
      if(mesh.isDisposed()||!mesh.isEnabled())continue;
      const centers=mesh.getVerticesData('buildingCenter');
      if(!centers&&!mesh.metadata?.waterlineProp&&!mesh.metadata?.waterlineSurface)continue;
      const world=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData(B.VertexBuffer.PositionKind),indices=mesh.getIndices();
      const key=[radius,mesh.metadata?.waterlineRevision||0,...world.asArray()].join(',');
      let entry=cache.get(mesh);
      if(!entry||entry.key!==key||entry.positions!==positions){
        const pieces=[],transforms=mesh.metadata?.waterlineProp?mesh.thinInstanceGetWorldMatrices():[B.Matrix.Identity()];
        for(const instance of transforms){
          const transform=instance.multiply(world),transformed=new Float32Array(positions.length);
          let low=Infinity,high=0;
          for(let i=0;i<positions.length;i+=3){
            let p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i),transform);
            if(centers){const center=B.Vector3.FromArray(centers,i),r=center.length(),up=center.scale(1/r),h=B.Vector3.Dot(p.subtract(center),up);p=p.subtract(up.scale(h)).normalize().scale(r+h);}
            const r=p.length();low=Math.min(low,r);high=Math.max(high,r);transformed.set(p.asArray(),i);
          }
          if(low<=radius&&high>=radius)pieces.push(...waterlineSegments(transformed,indices,radius));
        }
        entry={key,positions,segments:pieces};cache.set(mesh,entry);
      }
      segments.push(...entry.segments);
    }
    const packed=objectCoastBuffers(segments,matrices,radius,resolution);
    texture?.dispose();texture=B.RawTexture.CreateRGBATexture(packed.data,packed.width,packed.height,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE,B.Engine.TEXTURETYPE_FLOAT);
    material.setTexture('objectSegments',texture);
    for(let channel=0;channel<2;channel++){
      const coast=waterMesh.metadata.coastBuffers[3+channel],buffer=new Float32Array(packed.ranges.length*2);
      for(let i=0;i<packed.ranges.length/2;i++){buffer.set(coast.subarray(i*3,i*3+3),i*4);buffer[i*4+3]=packed.ranges[i*2+channel];}
      waterMesh.thinInstanceSetBuffer(['tintA','tintB'][channel],buffer,4,true);
    }
  }};
}
