import {fieldLayout} from './field-layout.js';
import {createCropGrass,createFieldSoil} from './crop-grass.js';
import {urbanConnectionObjects} from './urban-connections.js';
import {propTint} from './prop-tint.js';
import {loadCompositionData,compositionModels} from './composition-models.js';
import {generateComposition,tileConfigurations} from './tile-composition.js';
import {METERS_TO_TILE_UNITS,metersToWorldScale} from './model-units.js';
import {opaqueMaterial,buildingPaletteMaterial} from './palette-material.js';
import {createPropGrassCollision} from './prop-grass-collision.js';

export async function createTileCompositions(B,scene,shadows){
 const data=await loadCompositionData(),assets=compositionModels(B,scene,data.library,data.authoring),material=opaqueMaterial(B,scene,'composition-props',null,{atlas:true});
 let terrainSample=null;
 let counts={trees:0,stones:0,submerged:0,forestTiles:0},batches=[],occupied=new Set(),underwater=null,visibleTrees=true,visibleStones=true,collision={blockers:()=>[]};
 const replacementTiles=new Set(),depositTiles=new Set();
 function show(trees=true,stones=true){visibleTrees=trees;visibleStones=stones;for(const b of batches)b.mesh.setEnabled(b.visible>0&&(b.tree?trees:stones));}
 function flush(groups=batches){for(const b of groups){const matrices=[],colors=[];for(const item of b.items)if(!occupied.has(item.tile)){matrices.push(...item.matrix);colors.push(...item.tint);}b.visible=matrices.length/16;if(matrices.length){b.mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);b.mesh.thinInstanceSetBuffer('color',new Float32Array(colors),4,true);b.mesh.thinInstanceRefreshBoundingInfo(true);}else b.mesh.thinInstanceCount=0;b.mesh.setEnabled(b.visible>0&&(b.tree?visibleTrees:visibleStones));}}
 function setOccupied(value){if(value.size===occupied.size&&[...value].every(t=>occupied.has(t)))return;const changed=new Set([...occupied,...value].filter(t=>occupied.has(t)!==value.has(t)));occupied=new Set(value);flush(batches.filter(b=>b.items.some(i=>changed.has(i.tile))));}
 function update(core,n,seed,matrices,tileIds,kinds){
  const old=new Set(batches.map(b=>b.mesh));for(const mesh of old){shadows.removeShadowCaster(mesh);mesh.dispose();}if(underwater)underwater.renderList=underwater.renderList.filter(m=>!old.has(m));batches=[];replacementTiles.clear();depositTiles.clear();
  const count=core.tile_count(),centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),count*3),corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),count*18),neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),count*6),surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),count),features=new Uint32Array(core.memory.buffer,core.features_ptr(),count),unit=metersToWorldScale(n),groups=new Map();
  counts={trees:0,stones:0,submerged:0,forestTiles:features.filter(f=>f&1).length};
  for(let tile=0;tile<count;tile++){replacementTiles.add(tile);if(features[tile]&2)depositTiles.add(tile);}
  const triangles=new Map();
  for(let i=0;i<kinds.length;i++){if(kinds[i]>2)continue;const m=matrices.subarray(i*16,i*16+16),b=[m[12],m[13],m[14]],a=b.map((v,k)=>v-m[k]),c=b.map((v,k)=>v-.5*m[k]-.866025404*m[k+4]);if(!triangles.has(tileIds[i]))triangles.set(tileIds[i],[]);triangles.get(tileIds[i]).push([a,b,c].map(p=>new B.Vector3(...p)));}
  const sample=(point,tile)=>{const direction=point.normalizeToNew(),ray=new B.Ray(B.Vector3.Zero(),direction);let height=0;for(const owner of [tile,...neighbors.subarray(tile*6,tile*6+6)])for(const [a,b,c] of triangles.get(owner)||[]){const hit=ray.intersectsTriangle(a,b,c);if(hit&&hit.distance>height)height=hit.distance;}return height||point.length();};
  terrainSample=sample;
  for(let tile=0;tile<count;tile++){
   const configs=tileConfigurations(data.config,surfaces[tile],features[tile]);if(!configs.length)continue;
   const center=B.Vector3.FromArray(centers,tile*3),up=center.normalizeToNew(),right=B.Vector3.Cross(Math.abs(up.y)>.95?B.Axis.X:B.Axis.Y,up).normalize(),forward=B.Vector3.Cross(right,up).normalize();
   const polygon=[];for(let j=0;j<6;j++){const corner=B.Vector3.FromArray(corners,tile*18+j*3);if(corner.lengthSquared()<.01)continue;const p=corner.subtract(center);if(polygon.some(v=>Math.hypot(v[0]-B.Vector3.Dot(p,right)/unit,v[1]-B.Vector3.Dot(p,forward)/unit)<.01))continue;polygon.push([B.Vector3.Dot(p,right)/unit,B.Vector3.Dot(p,forward)/unit]);}
   const config={fixed:configs.flatMap(c=>c.fixed),scatter:configs.flatMap(c=>c.scatter)},result=generateComposition(config,(seed^Math.imul(tile+1,2654435761))>>>0,{polygon,water:surfaces[tile]===0,footprints:assets.footprints});
   for(const o of result.objects){
    const key=o.model+'|'+o.appearance;let group=groups.get(key);if(!group){const geometry=assets.geometry(o.model,o.appearance);if(!geometry.indices.length)continue;group={geometry,tree:/tree|conifer/i.test(data.library.models.find(m=>m.id===o.model)?.name||o.model),items:[]};groups.set(key,group);}
    const point=center.add(right.scale(o.position[0]*unit)).add(forward.scale(o.position[2]*unit)),normal=point.normalizeToNew();point.copyFrom(normal.scale(sample(point,tile)+o.position[1]*unit));
    const tangent=right.subtract(normal.scale(B.Vector3.Dot(right,normal))).normalize(),north=B.Vector3.Cross(tangent,normal).normalize(),basis=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(tangent,normal,north,basis);
    const rotation=B.Quaternion.FromRotationMatrix(basis).multiply(B.Quaternion.FromEulerAngles(...o.rotation.map(v=>v*Math.PI/180))),matrix=B.Matrix.Compose(new B.Vector3(...o.scale.map(v=>v*unit)),rotation,point);group.items.push({tile,matrix:matrix.asArray(),tint:propTint((tile*1024+result.objects.indexOf(o))>>>0,group.tree?0:1)});counts[group.tree?'trees':'stones']++;if(!group.tree&&surfaces[tile]===0)counts.submerged++;
   }
  }
  const models=[],allMatrices=[],owners=[],groupIndices=[];
  for(const [key,b] of groups){const mesh=new B.Mesh('composition-'+key,scene),g=new B.VertexData();Object.assign(g,b.geometry);g.applyToMesh(mesh);mesh.setVerticesData('modelAO',b.geometry.ao,false,1);mesh.material=material;mesh.receiveShadows=true;mesh.isPickable=false;mesh.metadata={waterlineProp:true};shadows.addShadowCaster(mesh);underwater?.renderList.push(mesh);b.mesh=mesh;batches.push(b);const index=models.length;models.push(b.geometry);for(const item of b.items){allMatrices.push(...item.matrix);owners.push(item.tile,item.tile,item.tile);groupIndices.push(index);}}
  collision=models.length?createPropGrassCollision(B,models,{count:groupIndices.length,groups:groupIndices,matrices:new Float32Array(allMatrices),owners:new Uint32Array(owners)}):{blockers:()=>[]};flush();
 }
 function building(kind,id,root,ghost,shadowRegistry,renderTarget,shoreline=null,field=null){
  const config=data.config.configs.find(c=>c.id==='building:'+kind);if(!config)return null;
  const result=generateComposition(config,id,{footprints:assets.footprints});
  const patches=[];
  for(const object of result.objects){const node=assets.spawn(object,root,ghost||buildingPaletteMaterial(B,scene),shadowRegistry,METERS_TO_TILE_UNITS,shoreline);for(const mesh of node.getChildMeshes())renderTarget.renderList.push(mesh);
   const radius=assets.footprints[object.model]*Math.max(object.scale[0],object.scale[2])*METERS_TO_TILE_UNITS;patches.push({x:object.position[0]*METERS_TO_TILE_UNITS,z:object.position[2]*METERS_TO_TILE_UNITS,yaw:0,halfX:radius,halfZ:radius});}
  if(config.crop){
   const world=root.computeWorldMatrix(true),unit=METERS_TO_TILE_UNITS;
   const interior=field?.polygon?.map((a,i)=>{const b=field.polygon[(i+1)%field.polygon.length],dx=b[0]-a[0],dz=b[1]-a[1];return {a:a.map(v=>v*.8),dx,dz};});
   const height=(x,z)=>{if(!terrainSample||interior?.every(e=>(x-e.a[0])*-e.dz+(z-e.a[1])*e.dx>=0))return 0;const point=B.Vector3.TransformCoordinates(new B.Vector3(x*unit,0,z*unit),world);return (terrainSample(point,id)-root.position.length())/(root.scaling.x*unit);};
   const layout=fieldLayout(id,{...field,height}),options={unit,center:root.position.asArray(),seed:id,layout,material:ghost};
   if(ghost)createFieldSoil(B,scene,root,layout,options);else createCropGrass(B,scene,root,config.crop,options);
   patches.push({x:0,z:0,yaw:0,halfX:layout.extent*unit,halfZ:layout.extent*unit,edges:layout.edges.map(e=>({a:e.a.map(v=>v*unit),n:e.n,margin:e.margin*unit}))});
  }
  return {patches,urbanConnections:config.urbanConnections};
 }
 function connection(config,root,x,z,ghost,registry,target){
  const patches=[];
  for(const object of urbanConnectionObjects(config,x/METERS_TO_TILE_UNITS,z/METERS_TO_TILE_UNITS)){
   const node=assets.spawn(object,root,ghost||buildingPaletteMaterial(B,scene),registry,METERS_TO_TILE_UNITS);for(const mesh of node.getChildMeshes())target.renderList.push(mesh);
   const radius=assets.footprints[object.model]*Math.max(object.scale[0],object.scale[2])*METERS_TO_TILE_UNITS;patches.push({x:object.position[0]*METERS_TO_TILE_UNITS,z:object.position[2]*METERS_TO_TILE_UNITS,yaw:object.rotation[1]*Math.PI/180,halfX:radius,halfZ:radius});
  }
  return patches;
 }

 return {connection,update,setOccupied,show,building,replacementTiles,depositTiles,stats:()=>counts,collision:()=>collision,setUnderwater:value=>{underwater=value;}};
}
