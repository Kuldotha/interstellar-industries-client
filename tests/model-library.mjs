import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createModelLibrary,importGLB} from '../server/model-library.mjs';
import {geometryFingerprint,createRegions,compileAppearance} from '../public/editor/model-data.js';
function glb(translation=[0,0,0],nested=false){
 const bin=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((n,i)=>bin.writeFloatLE(n,i*4));
 const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,translation}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}]};
 if(nested){doc.nodes=[{children:[1]},{mesh:0,translation}];}
 const json=Buffer.from(JSON.stringify(doc).padEnd(Math.ceil(JSON.stringify(doc).length/4)*4,' ')),out=Buffer.alloc(28+json.length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);out.writeUInt32LE(bin.length,20+json.length);out.writeUInt32LE(0x004e4942,24+json.length);bin.copy(out,28+json.length);return out;
}
const bytes=glb(),parts=importGLB(bytes);assert.deepEqual(parts[0].indices,[0,2,1]);assert.equal(parts[0].normals.length,9);
assert.deepEqual(importGLB(glb([2,3,4]))[0].positions.slice(0,3),[0,0,-0]);
assert.deepEqual(importGLB(glb([2,3,4],true))[0].positions.slice(0,3),[2,3,-4]);
assert.throws(()=>importGLB(Buffer.alloc(20)),/valid GLB/);
assert.throws(()=>importGLB(bytes.subarray(0,bytes.length-1)),/valid GLB/);
const palette=JSON.parse(await fs.readFile(new URL('../public/models/palette.json',import.meta.url),'utf8'));
const authored=createRegions(parts,palette),appearance={colors:authored.colors};
const same=importGLB(bytes);assert.equal(geometryFingerprint(same),authored.fingerprint);compileAppearance(same,authored,appearance,palette);
assert.throws(()=>compileAppearance(importGLB(glb([0,1,0],true)),authored,appearance,palette),/mesh changed/);
const house=importGLB(await fs.readFile(new URL('../models/house_01.glb',import.meta.url)));assert(house.length>0);assert(house.every(p=>p.positions.length&&p.indices.length));
const temp=await fs.mkdtemp(join(tmpdir(),'interstellar-model-library-'));
try{
 const root=join(temp,'public'),sources=join(temp,'sources');await fs.mkdir(join(root,'models'),{recursive:true});
 await fs.writeFile(join(root,'models/house_01.json'),JSON.stringify({parts}));await fs.writeFile(join(root,'props.json'),'[]');
 let library=createModelLibrary(root,sources);
 async function call(method,path,revision,body=bytes){
  const req=Readable.from(method==='DELETE'||method==='GET'?[]:[body]);Object.assign(req,{method,url:path,headers:{host:'localhost','x-library-revision':String(revision),'x-model-filename':'test.glb'}});
  let status,result;await library.route(req,{writeHead(s){status=s;},end(s){result=JSON.parse(s);}});return {status,result};
 }
 let r=await call('POST','/api/models',0);assert.equal(r.status,200);const id=r.result.selectedId,source=r.result.models.find(m=>m.id===id).source;assert.equal(r.result.models.length,2);
 library=createModelLibrary(root,sources);assert.equal((await library.read()).models.length,2);
 assert.equal((await call('PUT','/api/models/'+id,0)).status,400);
 r=await call('PUT','/api/models/'+id,1);assert.equal(r.status,200);assert.equal(r.result.selectedId,id);assert.equal(geometryFingerprint(r.result.models.find(m=>m.id===id).parts),authored.fingerprint);
 r=await call('PUT','/api/models/'+id,2,glb([0,1,0],true));assert.equal(r.status,200);assert.notEqual(geometryFingerprint(r.result.models.find(m=>m.id===id).parts),authored.fingerprint);
 r=await call('DELETE','/api/models/'+id,3);assert.equal(r.status,200);assert.equal(r.result.models.find(m=>m.id===id).active,false);assert.deepEqual(await fs.readFile(join(sources,source)),bytes);
 assert.equal((await call('DELETE','/api/models/house_01',4)).status,400);
 assert.equal((await call('POST','/api/models',4,Buffer.alloc(20))).status,400);assert.equal((await library.read()).revision,4);
 console.log('Model library: GLB transforms, generated normals, real house import, persistence, reimport identity, stale updates, invalid files, and non-destructive removal pass.');
}finally{await fs.rm(temp,{recursive:true,force:true});}
