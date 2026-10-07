import {fitShoreline} from './composition-shoreline.js';
import {compileAppearance} from './editor/model-data.js';
import {modelFootprint} from './tile-composition.js';
import {whiteAO} from './palette-material.js';
export async function loadCompositionData(){
 const paths=['configs/tile-compositions.json','models/library.json','models/authoring.json'];
 const [config,library,authoring]=await Promise.all(paths.map(async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('Cannot load '+p);return r.json();}));
 return {config,library,authoring};
}
export function compositionModels(B,scene,library,authoring){
 const templates=new Map(),entries=new Map(library.models.filter(m=>m.active).map(m=>[m.id,m]));
 const footprints={},radii=new Map();
 for(const id of entries.keys())Object.defineProperty(footprints,id,{get(){if(!radii.has(id))radii.set(id,modelFootprint(parts(id)));return radii.get(id);}});
 function parts(id,appearance=''){
  const key=id+'|'+appearance;if(templates.has(key))return templates.get(key);
  const source=entries.get(id);if(!source)throw Error('Model unavailable: '+id);
  const model=authoring.models[id],look=authoring.appearances[appearance||authoring.bindings[id]];
  const result=model&&look?compileAppearance(source.parts,model,look,scene.metadata.palette,{includeUnassigned:false}):source.parts;
  templates.set(key,result);return result;
 }
 function geometry(id,appearance=''){
  const result={positions:[],normals:[],uvs:[],uvs2:[],ao:[],indices:[]};
  for(const p of parts(id,appearance)){const base=result.positions.length/3;result.positions.push(...p.positions);result.normals.push(...p.normals);result.uvs.push(...p.uvs);result.uvs2.push(...(p.uvs2||whiteAO(p.positions.length/3)));result.ao.push(...(p.ao||Array(p.positions.length/3).fill(1)));result.indices.push(...p.indices.map(i=>i+base));}
  return result;
 }
 function spawn(object,parent,material,shadows,unit=1,shoreline=null){
  const root=new B.TransformNode('object-'+object.id,scene);root.parent=parent;root.position.set(...object.position.map(v=>v*unit));root.scaling.set(...object.scale.map(v=>v*unit));root.rotationQuaternion=B.Quaternion.FromEulerAngles(...object.rotation.map(v=>v*Math.PI/180));
  const source=parts(object.model,object.appearance),renderParts=object.shoreline&&shoreline?fitShoreline(B,source,entries.get(object.model).parts.map(p=>p.name),shoreline):source;
  for(const p of renderParts){
   if(!p.indices.length)continue;
   const mesh=new B.Mesh(object.model,scene),g=new B.VertexData();Object.assign(g,p);g.applyToMesh(mesh);if(p.ao)mesh.setVerticesData('modelAO',p.ao,false,1);mesh.parent=root;mesh.material=material;mesh.receiveShadows=true;mesh.metadata={compositionEntry:object.entry,compositionObject:object.id};shadows?.addShadowCaster(mesh);
  }
  if(object.animation){const a=object.animation,base=root.rotationQuaternion.clone(),observer=scene.onBeforeRenderObservable.add(()=>{root.rotationQuaternion=base.multiply(B.Quaternion.FromEulerAngles(0,Math.sin(performance.now()*.001*2*Math.PI/a.period)*a.degrees*Math.PI/180,0));});for(const mesh of root.getChildMeshes()){mesh.metadata={...mesh.metadata,animated:true};mesh.alwaysSelectAsActiveMesh=true;}root.onDisposeObservable.add(()=>scene.onBeforeRenderObservable.remove(observer));}
  return root;
 }
 return {footprints,parts,geometry,spawn};
}
