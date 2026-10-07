import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {geometryFingerprint,validateAuthoring} from '../public/editor/model-data.js';
import {importGLB} from '../server/model-library.mjs';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js'),engine=new B.NullEngine(),scene=new B.Scene(engine);
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),write=(p,d)=>fs.writeFileSync(new URL('../'+p,import.meta.url),JSON.stringify(d));
const palette=read('public/models/palette.json'),library=read('public/models/library.json'),authoring=read('public/models/authoring.json'),configs=read('public/configs/tile-compositions.json');
const swatches={cream:'building-wall',teal:'building-roof',gold:'building-trim',steel:'gunmetal-brushed',glass:'teal-paint-02',glow:'amber-light',bright:'ivory-light',fuel:'meadow-08'};
const swatch=name=>{const id=swatches[name];const found=palette.swatches.find(s=>s.id===id);if(!found)throw Error('Missing swatch '+id);return found;};
let parts=[],regions=[];
function add(mesh,color,position=[0,0,0],rotation=[0,0,0],name=color){mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.convertToFlatShadedMesh();const world=mesh.computeWorldMatrix(true),p=mesh.getVerticesData('position'),n=mesh.getVerticesData('normal'),indices=Array.from(mesh.getIndices()),positions=[],normals=[],uvs=[],s=swatch(color);for(let i=0;i<p.length;i+=3){positions.push(...B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),world).asArray());normals.push(...B.Vector3.TransformNormal(B.Vector3.FromArray(n,i),world).normalize().asArray());uvs.push(s.uvCenter[0],1-s.uvCenter[1]);}let region=regions.find(r=>r.id===name);if(!region){region={id:name,name,faces:[],swatch:s.id,sourceSwatches:[s.id]};regions.push(region);}region.faces.push(...indices.filter((_,i)=>i%3===0).map((_,f)=>[parts.length,f]));parts.push({material:'Project palette',positions,normals,uvs,uvs2:Array.from({length:uvs.length},(_,i)=>i%2?.5:1),indices});mesh.dispose();}
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
function ring(radius,thickness,pos,color,rot=[0,0,0],name=color){add(B.MeshBuilder.CreateTorus('ring',{diameter:radius*2,thickness,tessellation:12},scene),color,pos,rot,name);}
function bevelBox(w,h,d,ch,pos,color,name){
 const shape=[[-w/2,0],[w/2,0],[w/2,h-ch],[w/2-ch,h],[-w/2+ch,h],[-w/2,h-ch]],positions=shape.flatMap(([x,y])=>[x,y,-d/2]).concat(shape.flatMap(([x,y])=>[x,y,d/2])),indices=[];
 for(let i=1;i<5;i++){indices.push(0,i+1,i,6,6+i,7+i);}for(let i=0;i<6;i++){const j=(i+1)%6;indices.push(i,j,j+6,i,j+6,i+6);}for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);const mesh=new B.Mesh(name,scene),data=new B.VertexData();Object.assign(data,{positions,indices,normals});data.applyToMesh(mesh);add(mesh,color,pos,[0,0,0],name);
}
function generator(x,z){
 const axis=[0,0,Math.PI/2],ax=(r,len,dx,y,color,name,top=r)=>cylinder(r,len,[x+dx,y,z],color,axis,top,name);
 box([8.7,.22,4],[x,.11,z],'cream',[0,0,0],'machine-foundation');
 for(const dx of [-2.25,1.9]){box([.65,.65,3.2],[x+dx,.55,z],'steel',[0,0,0],'mounting-feet');}
 ax(1.55,4.8,0,2.25,'teal','generator-casing');
 ax(1.55,.5,-2.65,2.25,'teal','generator-casing',1.08);
 ax(1.05,.6,2.65,2.25,'teal','generator-casing',1.55);
 for(const dx of [-1.45,1.25])ax(1.58,.58,dx,2.25,'cream','casing-bands');
 for(const dx of [-2.42,2.43])ring(1.51,.14,[x+dx,2.25,z],'gold',axis,'casing-trim');
 ax(.42,7.6,0,2.25,'steel','drive-shaft');
 for(const dx of [-3.6,3.6]){
  bevelBox(.82,2.35,1.3,.22,[x+dx,.23,z],'gold','bearing-pedestals');
  ax(.66,.9,dx,2.25,'gold','bearing-collars');ax(.43,.95,dx,2.25,'steel','shaft-caps');
 }
 ax(.96,.24,2.97,2.25,'gold','end-ring');ax(.74,.27,3,2.25,'steel','end-plate');
 for(const dx of [-.7,-.25,.2,.65])box([.11,.055,.8],[x+dx,3.815,z],'steel',[0,0,0],'cooling-vents');
 for(const dx of [-.85,-.28,.28,.85])box([.12,.65,.07],[x+dx,2.25,z+1.57],'steel',[0,0,0],'cooling-vents');
 box([.65,.8,.4],[x+1.9,1.4,z+1.75],'teal',[0,0,0],'terminal-box');
 box([.37,.18,.04],[x+1.9,1.62,z+1.97],'glow',[0,0,0],'status-lights');
 tube([x+1.9,.8,z+1.75],[x+1.9,.3,z+1.75],.1,'steel');
}
function storage(x,z){
 box([3.4,.18,3.2],[x,.09,z],'cream',[0,0,0],'storage-foundation');
 box([3.2,2.35,.2],[x,1.35,z-1.4],'cream',[0,0,0],'storage-walls');
 for(const dx of [-1.5,1.5])box([.18,2.35,2.8],[x+dx,1.35,z],'cream',[0,0,0],'storage-walls');
 bevelBox(3.7,.6,3.45,.4,[x,2.5,z],'teal','storage-roof');
 box([2.7,.65,2.3],[x,.53,z],'fuel',[0,0,0],'biomass');
 for(const dz of [-.6,0,.6])for(const dx of [-.85,0,.85])cylinder(.34,.5,[x+dx,1.05,z+dz],'fuel',[0,0,0],.23,'biomass');
 for(const dx of [-1.3,1.3])box([.16,2.3,.18],[x+dx,1.32,z+1.4],'gold',[0,0,0],'storage-trim');
}
function controlHall(){
 bevelBox(7.2,2.9,3.3,.65,[.1,.12,-4.4],'cream','control-walls');
 bevelBox(7.55,.7,3.65,.5,[.1,2.9,-4.4],'teal','control-roof');
 box([4.8,.65,.07],[.55,2,-2.72],'glass',[0,0,0],'control-windows');
 for(const dx of [-1.65,-.4,.85,2.1])box([.065,.7,.09],[dx,2,-2.67],'gold',[0,0,0],'window-trim');
 box([1,1.95,.1],[-2.6,1.1,-2.69],'gold',[0,0,0],'control-door');
 box([.6,.38,.12],[-2.6,1.58,-2.62],'glass',[0,0,0],'control-windows');
 box([1.7,.18,.9],[-2.6,2.3,-2.45],'teal',[0,0,0],'door-canopy');
 box([1.5,.2,.8],[-2.6,.1,-2.15],'cream',[0,0,0],'control-steps');
}
function chamber(){
 const x=-4.9,z=-.35;
 cylinder(1.18,.28,[x,.14,z],'steel',[0,0,0],1.18,'chamber-base');
 cylinder(1.0,2.7,[x,1.62,z],'cream',[0,0,0],1.0,'chamber-shell');
 cylinder(1.15,.5,[x,3.05,z],'teal',[0,0,0],.8,'chamber-cap');
 cylinder(.88,.2,[x,1.85,z+.87],'gold',[Math.PI/2,0,0],.88,'chamber-rim');
 cylinder(.7,.23,[x,1.85,z+.96],'glow',[Math.PI/2,0,0],.7,'chamber-emission');
 cylinder(.34,.25,[x,1.85,z+1.0],'bright',[Math.PI/2,0,0],.34,'chamber-core');
 for(const dx of [-.36,.36])box([.07,1.25,.07],[x+dx,1.85,z+1.13],'gold',[0,0,0],'chamber-grille');
 tube([x,1.2,z-1],[x,1.2,-2.8],.14,'gold');tube([x,1.2,-2.8],[-3.4,1.2,-2.8],.14,'gold');
}
generator(.7,2.3);controlHall();chamber();
tube([-4.9,.45,.35],[.7,.45,.35],.13,'steel');tube([.7,.45,.35],[.7,1.3,.85],.13,'steel');
box([2.2,.9,1.7],[-5.35,.6,3.8],'cream',[0,0,0],'feed-bin');
box([1.9,.12,1.35],[-5.35,1.08,3.8],'fuel',[0,0,0],'biomass');
box([.7,.2,2.35],[-5.1,.75,1.92],'steel',[.2,0,0],'feed-conveyor');
finish('biomass_power_station_01','Biomass power station');
generator(0,1.65);storage(-1.8,-3.75);
tube([-1.8,.6,-2.25],[-1.8,.6,-.4],.16,'steel');
finish('generator_module_01','Generator module');
for(const [kind,id]of [[10,'biomass_power_station_01'],[15,'generator_module_01']]){
 const config=configs.configs.find(c=>c.id==='building:'+kind);if(!config)throw Error('Missing building '+kind);
 config.fixed=[{id:id+'-main',name:library.models.find(m=>m.id===id).name,model:id,appearance:'',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],blockScatter:false}];config.scatter=[];
}
validateAuthoring(authoring);library.revision++;write('public/models/library.json',library);write('public/models/authoring.json',authoring);write('public/configs/tile-compositions.json',configs);engine.dispose();
