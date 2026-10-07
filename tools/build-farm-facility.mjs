import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {geometryFingerprint,validateAuthoring} from '../public/editor/model-data.js';
import {importGLB} from '../server/model-library.mjs';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js'),engine=new B.NullEngine(),scene=new B.Scene(engine);
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),write=(p,d)=>fs.writeFileSync(new URL('../'+p,import.meta.url),JSON.stringify(d));
const palette=read('public/models/palette.json'),library=read('public/models/library.json'),authoring=read('public/models/authoring.json'),configs=read('public/configs/tile-compositions.json');
const tones={cream:[.84,.8,.68],teal:[.23,.44,.45],gold:[.88,.64,.22],copper:[.63,.38,.17],glass:[.12,.27,.32],steel:[.4,.46,.48],soil:[.3,.23,.16],green:[.44,.55,.2]};
const swatch=name=>palette.swatches.filter(s=>!s.emissive&&!s.metallic&&s.opacity===1).sort((a,b)=>a.rgb.reduce((s,v,i)=>s+(v-tones[name][i])**2,0)-b.rgb.reduce((s,v,i)=>s+(v-tones[name][i])**2,0))[0];
let parts=[],regions=[];
function add(mesh,color,position=[0,0,0],rotation=[0,0,0],name=color){mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.convertToFlatShadedMesh();const world=mesh.computeWorldMatrix(true),p=mesh.getVerticesData('position'),n=mesh.getVerticesData('normal'),indices=Array.from(mesh.getIndices()),positions=[],normals=[],uvs=[],s=swatch(color);for(let i=0;i<p.length;i+=3){positions.push(...B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),world).asArray());normals.push(...B.Vector3.TransformNormal(B.Vector3.FromArray(n,i),world).normalize().asArray());uvs.push(s.uvCenter[0],1-s.uvCenter[1]);}regions.push({id:name+'-'+parts.length,name,faces:indices.filter((_,i)=>i%3===0).map((_,f)=>[parts.length,f]),swatch:s.id});parts.push({material:'Project palette',positions,normals,uvs,uvs2:Array.from({length:uvs.length},(_,i)=>i%2?.5:1),indices});mesh.dispose();}
function box(size,pos,color='cream',rot=[0,0,0],name=color){add(B.MeshBuilder.CreateBox('box',{width:size[0],height:size[1],depth:size[2]},scene),color,pos,rot,name);}
function cylinder(radius,height,pos,color='cream',rot=[0,0,0],top=radius,name=color){add(B.MeshBuilder.CreateCylinder('cylinder',{diameterBottom:radius*2,diameterTop:top*2,height,tessellation:12},scene),color,pos,rot,name);}
function roof(x,z,width,depth,y,rise){const p=[-width/2,y,-depth/2,width/2,y,-depth/2,0,y+rise,-depth/2,-width/2,y,depth/2,width/2,y,depth/2,0,y+rise,depth/2],indices=[0,2,1,3,4,5,0,3,5,0,5,2,2,5,4,2,4,1,0,1,4,0,4,3],normals=[];B.VertexData.ComputeNormals(p,indices,normals);const mesh=new B.Mesh('roof',scene),d=new B.VertexData();Object.assign(d,{positions:p,indices,normals});d.applyToMesh(mesh);add(mesh,'teal',[x,0,z],[0,0,0],'roof');}
function tube(a,b,r,color){const va=new B.Vector3(...a),vb=new B.Vector3(...b),delta=vb.subtract(va),mesh=B.MeshBuilder.CreateCylinder('pipe',{height:delta.length(),diameter:r*2,tessellation:8},scene);const up=delta.normalize(),right=B.Vector3.Cross(Math.abs(up.y)>.9?B.Axis.X:B.Axis.Y,up).normalize(),forward=B.Vector3.Cross(right,up),m=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(right,up,forward,m);add(mesh,color,va.add(vb).scale(.5).asArray(),B.Quaternion.FromRotationMatrix(m).toEulerAngles().asArray(),'pipe');}
function finish(id,name){
 const model={id,name,active:true,legacyProp:false,parts};
 const chunks=[],views=[],accessors=[];let offset=0;
 const view=bytes=>{const i=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});let pad=(4-bytes.length%4)%4;chunks.push(bytes,Buffer.alloc(pad));offset+=bytes.length+pad;return i;};
 const acc=(values,type,width,index=false)=>{const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>index?bytes.writeUInt32LE(v,i*4):bytes.writeFloatLE(v,i*4));const a={bufferView:view(bytes),componentType:index?5125:5126,count:values.length/width,type};if(type==='VEC3'){a.min=[0,1,2].map(k=>Math.min(...values.filter((_,i)=>i%3===k)));a.max=[0,1,2].map(k=>Math.max(...values.filter((_,i)=>i%3===k)));}accessors.push(a);return accessors.length-1;};
 const primitives=parts.map(p=>{const xyz=v=>v.map((x,i)=>i%3===2?-x:x),indices=[...p.indices];for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];return {attributes:{POSITION:acc(xyz(p.positions),'VEC3',3),NORMAL:acc(xyz(p.normals),'VEC3',3),TEXCOORD_0:acc(p.uvs,'VEC2',2),TEXCOORD_1:acc(p.uvs2,'VEC2',2)},indices:acc(indices,'SCALAR',1,true),material:0};});
 const texture=view(fs.readFileSync(new URL('../public/models/project-base-color.png',import.meta.url)));
 const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives}],buffers:[{byteLength:offset}],bufferViews:views,accessors,images:[{bufferView:texture,mimeType:'image/png'}],textures:[{source:0}],materials:[{name:'Project palette',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.8}}]};
 const raw=JSON.stringify(doc),json=Buffer.from(raw.padEnd(Math.ceil(Buffer.byteLength(raw)/4)*4,' ')),bin=Buffer.concat(chunks),glb=Buffer.alloc(28+json.length+bin.length);glb.writeUInt32LE(0x46546c67);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(json.length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);glb.writeUInt32LE(bin.length,20+json.length);glb.writeUInt32LE(0x004e4942,24+json.length);bin.copy(glb,28+json.length);
 const hash=createHash('sha256').update(glb).digest('hex'),source=id+'-'+hash+'.glb';fs.writeFileSync(new URL('../models/'+id+'.glb',import.meta.url),glb);fs.writeFileSync(new URL('../models/imported/'+source,import.meta.url),glb);
 model.parts=importGLB(glb);Object.assign(model,{source,sourceName:id+'.glb',sourceHash:hash});
 const old=library.models.findIndex(m=>m.id===id);if(old>=0)library.models[old]=model;else library.models.push(model);
 authoring.models[id]={fingerprint:geometryFingerprint(model.parts),regions:regions.map(({swatch,...r})=>r),ao:model.parts.map(p=>p.indices.map(()=>1))};authoring.appearances[id]={name,colors:Object.fromEntries(regions.map(r=>[r.id,r.swatch]))};authoring.bindings[id]=id;
 console.log(name,parts.reduce((n,p)=>n+p.indices.length/3,0),'triangles');parts=[];regions=[];return id;
}

box([6.5,3.1,5],[-2,1.55,-2]);roof(-2,-2,7,5.6,3.1,1.3);
box([4.8,.8,.12],[-2,2.25,.57],'glass');box([1.8,2.2,.15],[-3.5,1.1,.65],'gold');
for(const x of [-4.8,.8])for(const z of [1.1,4.4])box([.2,2.5,.2],[x,1.25,z],'steel');
box([6.2,.22,4],[-2,2.65,2.8],'teal');
box([5.6,.12,3.4],[-2,.07,2.8],'cream');
for(const z of [-3.4,.1]){cylinder(1.3,3.5,[4,2.2,z],'cream');cylinder(1.3,.65,[4,4.275,z],'teal',[0,0,0],.35);cylinder(1.34,.3,[4,2.9,z],'gold');for(const x of [3.2,4.8])box([.16,.6,.16],[x,.3,z],'steel');}
tube([4,1,-3.4],[4,1,3.5],.13,'teal');tube([4,1,3.5],[1,1,3.5],.13,'teal');
box([2.1,.75,1.6],[-3,.48,2.8],'gold');box([1.3,.6,1.6],[-.6,.4,2.8],'cream');
box([2.4,1.2,2],[3.8,.6,4.4],'teal');cylinder(.45,.6,[3.8,1.5,4.4],'steel');
finish('farm_facility_01','Farm facility');
const fixed=(id,model,position=[0,0,0])=>({id,name:library.models.find(m=>m.id===model).name,model,appearance:'',position,rotation:[0,0,0],scale:[1,1,1],blockScatter:false});
for(const kind of [5,7,9]){const c=configs.configs.find(c=>c.id==='building:'+kind);delete c.crop;c.fixed=[fixed('farm-facility','farm_facility_01')];c.scatter=[];}
for(const kind of [12,13,14]){const c=configs.configs.find(c=>c.id==='building:'+kind);c.fixed=[];c.scatter=[];}
validateAuthoring(authoring);library.revision++;write('public/models/library.json',library);write('public/models/authoring.json',authoring);write('public/configs/tile-compositions.json',configs);engine.dispose();
