import {meadowVariant,meadowGeometry} from './meadow-variants.js';
import {groundMaterial} from './palette-material.js';
import {enableFacets,facetStyles} from './facet-material.js?weighted-cells=4';
import { createGroundCover } from './ground-cover.js';
const hash=x=>{x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function createGrass(B,scene,camera) {
  const mesh=new B.Mesh('opaque-grass-tufts',scene);
  const data=new B.VertexData();
  const positions=[],normals=[],colors=[],indices=[];
  for(let blade=0;blade<5;blade++) {
    const angle=blade*2.4, x=Math.cos(angle),z=Math.sin(angle),h=.65+hash(blade+17)*.35;
    const points=[[x*.13-z*.1,0,z*.13+x*.1],[x*.13+z*.1,0,z*.13-x*.1],[x*.32,h,z*.32]];
    for(let j=0;j<3;j++) {positions.push(...points[j]);normals.push(0,1,0);colors.push(...(j===2?[1.02,1.02,1.02,1]:[1,1,1,1]));indices.push(indices.length);}
  }
  Object.assign(data,{positions,normals,colors,indices});data.applyToMesh(mesh);mesh.setVerticesData('modelAO',new Float32Array(positions.length/3).fill(1),false,1);
  const material=groundMaterial(B,scene,'grass-root-to-tip');
  material.backFaceCulling=false;mesh.material=material;mesh.receiveShadows=true;
  class GrassGroundNormal extends B.MaterialPluginBase {
    constructor(){super(material,'GrassGroundNormal',200,{},true,true);}
    isCompatible(){return true;}
    getAttributes(attributes){attributes.push('groundNormal');}
    getCustomCode(type,language){
      if(type!=='vertex')return null;
      return language===B.ShaderLanguage.WGSL?{
        CUSTOM_VERTEX_DEFINITIONS:'attribute groundNormal: vec3f;',
        CUSTOM_VERTEX_MAIN_END:'vertexOutputs.vNormalW=vertexInputs.groundNormal;'
      }:{
        CUSTOM_VERTEX_DEFINITIONS:'attribute vec3 groundNormal;',
        CUSTOM_VERTEX_MAIN_END:'vNormalW=groundNormal;'
      };
    }
  }
  new GrassGroundNormal();
  enableFacets(B,material,facetStyles.ground,{roots:true});
  let groundCover=createGroundCover([]),depositCover=()=>1,coverAreas=new Map(),coverCandidates=new Map();
  const applyGroundCover=()=>{for(const c of candidates)c.keep=groundCover(c.p)*depositCover(c.p,c.tile);dirty=true;};
  const groups=[{mesh,positions,triangles:5},...[1,2].map(kind=>{const geometry=meadowGeometry(kind),m=new B.Mesh(kind===1?'meadow-stalks':'meadow-flowers',scene),d=new B.VertexData();Object.assign(d,geometry);d.applyToMesh(m);m.setVerticesData('modelAO',new Float32Array(geometry.positions.length/3).fill(1),false,1);m.material=material;m.receiveShadows=true;m.isPickable=false;return {mesh:m,positions:geometry.positions,triangles:geometry.indices.length/3};})];
 let renderedTriangles=0;
  let occupied=new Set(),blockedByTile=new Map();
  function setOccupied(value){
    const changed=new Set();
    for(const tile of new Set([...occupied,...value]))if(occupied.has(tile)!==value.has(tile))for(const c of blockedByTile.get(tile)||[])changed.add(c);
    occupied=new Set(value);
    for(const c of changed)c.blocked=c.blockers.some(owners=>owners.every(tile=>!occupied.has(tile)));
    dirty=true;
  }
  let candidates=[],enabled=true,density=.5,resolution=8,lastUpdate=-Infinity,dirty=true,lastEye=[Infinity,0,0],visible=0;
  const show=value=>{enabled=value;dirty=true;if(!value)for(const g of groups)g.mesh.setEnabled(false);};
  const setDensity=value=>{density=value;dirty=true;};
  function generate(core,matrices,tints,terrainCount,n,seaRadius,collision) {
    resolution=n;candidates=[];
    const groundNormals=new Float32Array(core.memory.buffer,core.normals_ptr(),terrainCount*9);
    const tileIds=new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),matrices.length/16);
    const surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count());
    blockedByTile=new Map();
    const scatterDensity=180000*Math.min(2,(n/8)**2);
    for(let i=0;i<terrainCount;i++) {
      if(surfaces[tileIds[i]]!==1)continue;
      const m=matrices.subarray(i*16,i*16+16);
      const a=[m[12]-m[0],m[13]-m[1],m[14]-m[2]],b=[m[12],m[13],m[14]],c=[m[12]-.5*m[0]-.866025404*m[4],m[13]-.5*m[1]-.866025404*m[5],m[14]-.5*m[2]-.866025404*m[6]];
      const ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
      const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      const area=Math.hypot(...cross)*.5,center=a.map((v,k)=>(v+b[k]+c[k])/3),radius=Math.hypot(...center);
      if(area<1e-10 || radius<seaRadius+.0005 || Math.abs(cross.reduce((v,x,k)=>v+x*center[k],0))/(2*area*radius)<.88)continue;
      const expected=area*scatterDensity,count=Math.floor(expected)+(hash(i*97+5)<expected%1?1:0);
      for(let j=0;j<count;j++) {
        const seed=Math.imul(i+1,8191)+j*131;
        const root=Math.sqrt(hash(seed)),v=hash(seed+1),w=[1-root,root*(1-v),root*v];
        const tint=[0,1,2].map(k=>w.reduce((s,x,l)=>s+x*tints[l][i*4+k],0));
        const p=a.map((x,k)=>x*w[0]+b[k]*w[1]+c[k]*w[2]);
        const r=Math.hypot(...p);if(r<seaRadius+.0005)continue;
        const patch=(Math.sin(p[0]*47+Math.sin(p[2]*21))*Math.cos(p[1]*39-p[2]*13)+1)*.5;
        if(hash(seed+2)>.20+.75*smooth((patch-.15)/.7))continue;
        const up=B.Vector3.FromArray(p).normalize();
        const right=B.Vector3.Cross(Math.abs(up.y)>.95?B.Axis.X:B.Axis.Y,up).normalize();
        const forward=B.Vector3.Cross(right,up).normalize();
        const yaw=hash(seed+3)*Math.PI*2,cs=Math.cos(yaw),sn=Math.sin(yaw);
        const x=right.scale(cs).add(forward.scale(sn)),z=forward.scale(cs).subtract(right.scale(sn));
        const h=(.042/n)*(.7+hash(seed+4)*.6),matrix=B.Matrix.Identity();
        B.Matrix.FromXYZAxesToRef(x.scale(h),up.scale(h),z.scale(h),matrix);
        matrix.setTranslation(B.Vector3.FromArray(p).subtract(up.scale(.00015)));
        const normal=[0,1,2].map(k=>w.reduce((sum,weight,l)=>sum+weight*groundNormals[i*9+l*3+k],0));
        const variant=meadowVariant(hash(seed+11));
        const blockers=collision.blockers(matrix,groups[variant].positions);
        const candidate={variant,tile:tileIds[i],p,h,m:matrix.toArray(),tint,normal,rank:hash(seed+5),coverRank:hash(seed+7),keep:1,blockers,blocked:blockers.some(owners=>owners.every(tile=>!occupied.has(tile)))};
        candidates.push(candidate);
        for(const tile of new Set(blockers.flat())){if(!blockedByTile.has(tile))blockedByTile.set(tile,[]);blockedByTile.get(tile).push(candidate);}
      }
    }
    for(let i=0;i<groups.length;i++){const g=groups[i],count=candidates.filter(c=>c.variant===i).length;g.matrixUpload=new Float32Array(count*16);g.tintUpload=new Float32Array(count*4);g.normalUpload=new Float32Array(count*3);}
    coverCandidates=new Map();for(const c of candidates){const key=groundCover.key(c.p);if(!coverCandidates.has(key))coverCandidates.set(key,[]);coverCandidates.get(key).push(c);}
    applyGroundCover();dirty=true;lastUpdate=-Infinity;return candidates.length;
  }
  function setGroundCover(areas){
    const next=new Map(areas.map((area,i)=>[area.id??i,area])),changed=[];
    for(const id of new Set([...coverAreas.keys(),...next.keys()])){const a=coverAreas.get(id),b=next.get(id);if(a?.patches===b?.patches&&a?.scale===b?.scale&&a?.center===b?.center)continue;if(a)changed.push(a);if(b)changed.push(b);}
    coverAreas=next;if(!changed.length)return;
    const affected=createGroundCover(changed).cells;groundCover=createGroundCover(areas);
    for(const key of affected)for(const c of coverCandidates.get(key)||[])c.keep=groundCover(c.p)*depositCover(c.p,c.tile);
    dirty=true;
  }
  function update(now,force=false) {
    if(!enabled)return;
    if(!force && now-lastUpdate<100)return;
    const eye=camera.position;
    if(!force && !dirty && Math.hypot(eye.x-lastEye[0],eye.y-lastEye[1],eye.z-lastEye[2])<.001)return;
    lastEye=[eye.x,eye.y,eye.z];lastUpdate=now;dirty=false;
    const pixels=scene.getEngine().getRenderHeight()/(2*Math.tan(camera.fov*.5));
    for(const g of groups)g.count=0;
    for(const c of candidates) {
      if(c.blocked || c.rank>density || c.keep===0 || c.coverRank>c.keep)continue;
      const [x,y,z]=c.p;
      if(x*eye.x+y*eye.y+z*eye.z<x*x+y*y+z*z)continue;
      const distance=Math.hypot(x-eye.x,y-eye.y,z-eye.z),size=pixels*c.h/distance;
      const fade=smooth((size-.9)/1.8)*smooth((1.65-distance)/.55);if(fade<.03)continue;
      const g=groups[c.variant],{matrixUpload,tintUpload,normalUpload}=g,count=g.count++,start=count*16;matrixUpload.set(c.m,start);tintUpload.set(c.variant===2?[1,1,1]:c.tint,count*4);tintUpload[count*4+3]=1;normalUpload.set(c.normal,count*3);
      for(const offset of [0,1,2,4,5,6,8,9,10])matrixUpload[start+offset]*=fade;
    }
    visible=0;renderedTriangles=0;
    for(const g of groups){const {mesh,count,matrixUpload,tintUpload,normalUpload}=g;visible+=count;renderedTriangles+=count*g.triangles;mesh.setEnabled(count>0);
     if(count){mesh.thinInstanceSetBuffer('matrix',matrixUpload.subarray(0,count*16),16,true);mesh.thinInstanceSetBuffer('color',tintUpload.subarray(0,count*4),4,true);mesh.thinInstanceSetBuffer('groundNormal',normalUpload.subarray(0,count*3),3,true);mesh.thinInstanceRefreshBoundingInfo(true);}
    }
  }
  return {mesh,meshes:groups.map(g=>g.mesh),show,setDensity,setOccupied,generate,update,setDepositCover:mask=>{depositCover=mask;applyGroundCover();},setGroundCover,stats:()=>({candidates:candidates.length,visible:enabled?visible:0,triangles:enabled?renderedTriangles:0})};
}
