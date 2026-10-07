import {METERS_TO_TILE_UNITS} from './model-units.js';
import {opaqueMaterial} from './palette-material.js';
import {enableFacets,facetStyles} from './facet-material.js?weighted-cells=4';
import {authoredParts} from './editor/model-data.js';
export async function loadDepositModel(palette){
  const response=await fetch('models/deposit_01.json');
  if(!response.ok)throw Error('Deposit model failed to load');
  const source=await response.json(),parts=await authoredParts('deposit_01',source.parts,palette);
  const model={positions:[],indices:[],uvs:[],uvs2:[],ao:[]};
  for(const p of parts){const offset=model.positions.length/3;model.positions.push(...p.positions);model.indices.push(...p.indices.map(i=>i+offset));model.uvs.push(...p.uvs);model.uvs2.push(...(p.uvs2||Array.from({length:p.positions.length/3},()=>[1,.5]).flat()));model.ao.push(...(p.ao||Array(p.positions.length/3).fill(1)));}
  return model;
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const r=Math.hypot(...a);return a.map(v=>v/r);};
const random=seed=>{let x=Math.imul(seed^(seed>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;};
function coordinates(patch,p){const d=sub(p,patch.center);return [dot(d,patch.right),dot(d,patch.forward)];}
export function insideDeposit(patch,point){const [x,z]=coordinates(patch,point);const radius=patch.radius??patch.width;return x*x+z*z<radius*radius;}
export function depositPatches(centers,features,neighbors,n){
  const patches=[];
  for(let tile=0;tile<features.length;tile++){
    if(!(features[tile]&2))continue;
    const center=Array.from(centers.slice(tile*3,tile*3+3)),up=unit(center),axis=unit(cross(Math.abs(up[1])>.95?[1,0,0]:[0,1,0],up)),other=cross(up,axis),yaw=random(tile*317)*Math.PI*2;
    const right=axis.map((v,k)=>v*Math.cos(yaw)+other[k]*Math.sin(yaw)),forward=cross(up,right);
    patches.push({center,owners:[tile],right,forward,width:1/n,shade:.97+random(tile+73)*.06});
  }
  return patches;
}
function rayHeight(direction,triangles){
  let height=-Infinity;
  for(const [a,b,c] of triangles){
    const ab=sub(b,a),ac=sub(c,a),normal=cross(ab,ac),den=dot(normal,direction);
    if(Math.abs(den)<1e-14)continue;
    const distance=dot(normal,a)/den;if(distance<=0)continue;
    const p=direction.map(v=>v*distance),ap=sub(p,a),aa=dot(ab,ab),bb=dot(ac,ac),d=dot(ab,ac),area=aa*bb-d*d;
    if(area<1e-20)continue;
    const u=(dot(ap,ab)*bb-dot(ap,ac)*d)/area,v=(dot(ap,ac)*aa-dot(ap,ab)*d)/area;
    if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)height=Math.max(height,distance);
  }
  return height;
}
export function createDeposits(B,scene,onMask,model,terrainMaterial=null,shadows=null){
  const mesh=new B.Mesh('deposit-bedrock',scene),material=opaqueMaterial(B,scene,'deposit-bedrock-material',null,{atlas:true});
  enableFacets(B,material,facetStyles.bedrock);
  material.backFaceCulling=false;
  mesh.material=material;mesh.receiveShadows=true;mesh.isPickable=false;shadows?.addShadowCaster(mesh);
  let modelRadius=0;for(let i=0;i<model.positions.length;i+=3)modelRadius=Math.max(modelRadius,Math.hypot(model.positions[i],model.positions[i+2]));
  let patches=[],occupied=new Set(),enabled=true,parts=[],byTile=new Map();
  function apply(){
    const active=patches.map(p=>enabled&&p.owners.every(id=>!occupied.has(id))),positions=[],normals=[],colors=[],uvs=[],uvs2=[],ao=[],indices=[];
    for(const part of parts){if(!active[part.patch])continue;const offset=positions.length/3;positions.push(...part.positions);normals.push(...part.normals);colors.push(...part.colors);uvs.push(...part.uvs);uvs2.push(...part.uvs2);ao.push(...part.ao);indices.push(...part.indices.map(i=>i+offset));}
    if(indices.length){const data=new B.VertexData();Object.assign(data,{positions,normals,colors,uvs,uvs2,indices});data.applyToMesh(mesh);mesh.setVerticesData('modelAO',ao,false,1);mesh.refreshBoundingInfo();}
    mesh.metadata={waterlineSurface:true,waterlineRevision:(mesh.metadata?.waterlineRevision||0)+1};mesh.setEnabled(indices.length>0);
    onMask((point,tile)=>{
      if(!enabled||occupied.has(tile))return 1;
      for(const i of byTile.get(tile)||[])if(active[i]&&insideDeposit(patches[i],point))return 0;
      return 1;
    });
  }
  return {mesh,
    show(value){enabled=value;apply();},
    setOccupied(value){const changed=patches.some(p=>p.owners.some(id=>occupied.has(id)!==value.has(id)));occupied=new Set(value);if(changed)apply();},
    surfacePoint(point,tile){
      let radius=Math.hypot(...point),changed=false;const direction=unit(point);
      for(const index of byTile.get(tile)||[]){
        const patch=patches[index];if(!insideDeposit(patch,point))continue;
        const height=rayHeight(direction,parts[index].triangles);if(!Number.isFinite(height))continue;
        radius=Math.max(radius,height);changed=true;
      }
      return changed?direction.map(v=>v*radius):point;
    },
    update(core,matrices,tileIds,kinds,n,excluded=new Set()){
      const count=core.tile_count(),centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),count*3).slice(),features=new Uint32Array(core.memory.buffer,core.features_ptr(),count).slice(),neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),count*6).slice();
      patches=depositPatches(centers,features,neighbors,n).filter(p=>!excluded.has(p.owners[0]));for(const p of patches)p.radius=modelRadius*METERS_TO_TILE_UNITS*p.width;byTile=new Map();parts=[];
      const terrain=new Map();
      for(let i=0;i<kinds.length;i++){
        if(kinds[i]>2)continue;
        const tile=tileIds[i];if(!(features[tile]&2))continue;
        const m=matrices.subarray(i*16,i*16+16),b=[m[12],m[13],m[14]],a=b.map((v,k)=>v-m[k]),c=b.map((v,k)=>v-.5*m[k]-.866025404*m[k+4]);
        if(!terrain.has(tile))terrain.set(tile,[]);terrain.get(tile).push([a,b,c]);
      }
      patches.forEach((patch,index)=>{
        const tile=patch.owners[0],surface=terrain.get(tile)||[],positions=[],normals=[],colors=[],uvs=[],uvs2=[],ao=[],indices=[],triangles=[];
        byTile.set(tile,[index]);
        const mapped=[];
        for(let i=0;i<model.positions.length;i+=3){
          const [x,y,z]=model.positions.slice(i,i+3),point=patch.center.map((v,k)=>v+patch.width*METERS_TO_TILE_UNITS*(patch.right[k]*x+patch.forward[k]*z)),direction=unit(point);
          const height=rayHeight(direction,surface),base=Number.isFinite(height)?height:Math.hypot(...patch.center);
          const radius=base+y*patch.width*METERS_TO_TILE_UNITS;
          mapped.push(direction.map(v=>v*radius));
        }
        for(let i=0;i<model.indices.length;i+=3){
          const corners=model.indices.slice(i,i+3),[a,b,c]=corners.map(id=>mapped[id]),normal=unit(cross(sub(b,a),sub(c,a)));
          if(!normal.every(Number.isFinite))continue;
          triangles.push([a,b,c]);
          for(const id of corners){indices.push(indices.length);positions.push(...mapped[id]);normals.push(...normal);colors.push(patch.shade,patch.shade,patch.shade,1);uvs.push(...(model.uvs?.slice(id*2,id*2+2)||[0,0]));uvs2.push(...(model.uvs2?.slice(id*2,id*2+2)||[1,.5]));ao.push(model.ao?.[id]??1);}
        }
        parts.push({patch:index,positions,normals,colors,uvs,uvs2,ao,indices,triangles});
      });
      apply();return patches.length;
    }
  };
}
