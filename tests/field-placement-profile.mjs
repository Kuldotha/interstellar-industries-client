import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createTileCompositions} from '../public/composition-runtime.js';
import {loadPalette} from '../public/palette-material.js';
import {mergeHousingParts} from '../public/housing-cluster.js';
import {METERS_TO_TILE_UNITS} from '../public/model-units.js';
const require=createRequire(import.meta.url),base=require('../public/vendor/babylon-9.28.0.js'),B={...base,RawCubeTexture:class extends base.BaseTexture{constructor(scene){super(scene);}}};
const json=p=>JSON.parse(readFileSync(new URL('../public/'+p,import.meta.url))),config=json('configs/tile-compositions.json');
for(const c of config.configs)if(c.id!=='feature:1'&&c.id!=='building:2'){c.fixed=[];c.scatter=[];}
const forest=config.configs.find(c=>c.id==='feature:1');forest.enabled=true;forest.scatter[0].count=[2,2];
const housing=config.configs.find(c=>c.id==='building:2');housing.enabled=true;housing.scatter=[];housing.fixed=housing.fixed.slice(0,1);housing.fixed[0].position=[2,1,3];housing.fixed[0].rotation=[0,0,0];
const originalFetch=globalThis.fetch;globalThis.fetch=async path=>({ok:true,json:async()=>path==='configs/tile-compositions.json'?config:json(path)});
const engine=new B.NullEngine(),scene=new B.Scene(engine),shadows={addShadowCaster(){},removeShadowCaster(){}};
try{
 await loadPalette(B,scene);const runtime=await createTileCompositions(B,scene,shadows),underwater={renderList:[]};runtime.setUnderwater(underwater);
 const {instance:{exports:core}}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{});
 const count=core.generate_blue(8,.02,23),features=new Uint32Array(core.memory.buffer,core.features_ptr(),core.tile_count());
 const matrices=new Float32Array(core.memory.buffer,core.matrices_ptr(),count*16),ids=new Uint32Array(core.memory.buffer,core.tile_ids_ptr(),count),kinds=new Uint32Array(core.memory.buffer,core.kinds_ptr(),count);
 runtime.update(core,8,1701,matrices,ids,kinds);
 const expected=Array.from(features).flatMap((f,i)=>f&1?[i]:[]);assert.equal(runtime.replacementTiles.size,core.tile_count());assert.equal(runtime.depositTiles.size,features.filter(f=>f&2).length);
 assert(underwater.renderList.length>0);let initial=underwater.renderList.reduce((sum,m)=>sum+m.thinInstanceCount,0);assert(initial>0);
 for(const mesh of underwater.renderList){assert(mesh.getVerticesData('position').every(Number.isFinite));assert(mesh.getBoundingInfo().boundingBox.minimumWorld.asArray().every(Number.isFinite));}
 runtime.show(false,true);assert(underwater.renderList.every(m=>!m.isEnabled()));runtime.setOccupied(new Set(expected));assert(underwater.renderList.every(m=>!m.isEnabled()));
 runtime.setOccupied(new Set());assert(underwater.renderList.every(m=>!m.isEnabled()));runtime.show(true,true);assert.equal(underwater.renderList.reduce((sum,m)=>sum+m.thinInstanceCount,0),initial);
 const root=new B.TransformNode('building',scene);root.position.set(.2,1,.3);root.scaling.setAll(1/8);root.rotationQuaternion=B.Quaternion.RotationYawPitchRoll(.5,.3,0);
 const result=runtime.building(2,77,root,null,shadows,underwater);assert(result);assert.equal(result.patches.length,1);
 const old=root.getChildMeshes()[0];const expectedPosition=B.Vector3.TransformCoordinates(B.Vector3.FromArray(old.getVerticesData('position')),old.computeWorldMatrix(true));
 mergeHousingParts(B,root,scene,shadows,underwater);
 const mesh=root.getChildMeshes()[0],actual=B.Vector3.TransformCoordinates(B.Vector3.FromArray(mesh.getVerticesData('position')),mesh.computeWorldMatrix(true));
 assert(B.Vector3.Distance(actual,expectedPosition)<1e-6,'Nested model transforms survive merging');
 assert(Math.abs(result.patches[0].x-2*METERS_TO_TILE_UNITS)<1e-9);

 const centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),core.tile_count()*3),corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),core.tile_count()*18),surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count());
 const {projectFieldPolygon}=await import('../public/field-layout.js');const timings=[];
 for(const id of Array.from(surfaces.keys()).filter(i=>surfaces[i]===1).slice(0,12)){
  const center=B.Vector3.FromArray(centers,id*3),up=center.normalizeToNew(),right=B.Vector3.Cross(Math.abs(up.y)>.95?B.Axis.X:B.Axis.Y,up).normalize(),forward=B.Vector3.Cross(right,up).normalize(),basis=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(right,up,forward,basis);
  const fieldRoot=new B.TransformNode('test-field',scene);fieldRoot.position=center;fieldRoot.rotationQuaternion=B.Quaternion.FromRotationMatrix(basis);fieldRoot.scaling.setAll(1/8);
  const polygon=projectFieldPolygon(center.asArray(),right.asArray(),forward.asArray(),corners.slice(id*18,id*18+18),.075/8);
  const start=performance.now();const result=runtime.building(12,id,fieldRoot,null,shadows,underwater,null,{polygon,connected:polygon.map(()=>true)});timings.push(performance.now()-start);
  assert.equal(result.patches.length,1);assert(result.patches[0].edges.length>=5);
  for(const mesh of fieldRoot.getChildMeshes())assert(mesh.getVerticesData('position').every(Number.isFinite));fieldRoot.dispose();
 }
 console.log('Field visual construction ms:',timings.map(t=>t.toFixed(1)).join(', '));
}finally{globalThis.fetch=originalFetch;scene.dispose();engine.dispose();}
