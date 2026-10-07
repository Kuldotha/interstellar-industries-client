import assert from 'node:assert/strict';
import {createProps} from '../public/props.js';
const oldDocument=globalThis.document,oldBitmap=globalThis.createImageBitmap;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([80,120,40,255])})})})};
const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({blob:async()=>new Blob(),json:async()=>[{name:'tree',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],uvs:[.5,.5,.5,.5,.5,.5]},{name:'rock',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]}]});
const meshes=[];
const B={MaterialPluginBase:class{},RawTexture:{CreateRGBATexture:()=>({})},Mesh:class{constructor(){meshes.push(this);}getTotalVertices(){return 3;}setVerticesData(){}setEnabled(v){this.enabled=v;}thinInstanceSetBuffer(name,value){this[name]=value;}thinInstanceRefreshBoundingInfo(){}},VertexData:class{applyToMesh(){}},Texture:class{},VertexBuffer:{UVKind:"uv"},PBRMaterial:class{getClassName(){return "PBRMaterial";}},Color3:class{static Black(){return {};}}};
try{
 const props=await createProps(B,{}, {addShadowCaster(){}}),memory={buffer:new ArrayBuffer(2048)};
 new Float32Array(memory.buffer,0,48).fill(1);new Uint32Array(memory.buffer,192,3).set([0,1,2]);new Uint32Array(memory.buffer,204,3).set([0,0,1]);new Uint32Array(memory.buffer,216,3).set([0,1,2]);new Uint32Array(memory.buffer,228,4).set([1,1,1,1]);new Uint32Array(memory.buffer,244,4).set([1,1,2,0]);
 new Uint32Array(memory.buffer,300,9).set([0,0,0,1,1,1,2,2,3]);
 const c={memory,prop_owners_ptr:()=>300,prop_count:()=>3,prop_matrices_ptr:()=>0,prop_ids_ptr:()=>192,prop_kinds_ptr:()=>204,prop_tiles_ptr:()=>216,surfaces_ptr:()=>228,features_ptr:()=>244,tile_count:()=>4};
 props.update(c,true,true);assert.deepEqual(props.stats().rebuilds,[1,1]);
 props.setOccupied(new Set([0]));props.setOccupied(new Set([0,1]));assert.deepEqual(props.stats().rebuilds,[1,1]);props.flush(true,true);
 assert.deepEqual(props.stats().rebuilds,[2,1]);assert.equal(meshes[0].enabled,false);assert.equal(meshes[1].enabled,true);
 props.setOccupied(new Set([0,1]));assert.equal(props.flush(true,true),null);
 props.setOccupied(new Set([0,1,3]));props.flush(true,true);assert.deepEqual(props.stats().rebuilds,[2,2]);assert.equal(meshes[1].enabled,false);
 props.setOccupied(new Set([1,2]));props.flush(true,true);assert.deepEqual(props.stats().rebuilds,[3,3]);assert.equal(meshes[0].matrix.length,16);assert.equal(meshes[1].enabled,false);
 props.setOccupied(new Set());props.flush(true,true);assert.equal(meshes[0].matrix.length,32);assert.equal(meshes[1].matrix.length,16);
 console.log('Prop groups: dirty groups only, batched edits, unchanged/empty tiles skipped, zero-instance groups hidden and demolition restores instances.');
}finally{globalThis.fetch=oldFetch;globalThis.document=oldDocument;globalThis.createImageBitmap=oldBitmap;}
