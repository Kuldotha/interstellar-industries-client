import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {readPng} from './png.mjs';
import {importGLB} from '../server/model-library.mjs';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js');
const root=new URL('../',import.meta.url),read=name=>JSON.parse(readFileSync(new URL(name,root)));
const palette=read('public/models/palette.json'),swatch=id=>palette.swatches.find(s=>s.id===id);
const image=readPng(new URL('public/props-color.png',root));
const texture=readFileSync(new URL('models/project-palette/base-color.png',root));
const props=read('public/props.json'),craters=read('public/craters.json');
for(const model of [...props,...craters]){
 const path=new URL(`models/${model.name}.glb`,root);
 if(existsSync(path)){console.log(`Kept existing ${model.name}.glb`);continue;}
 const positions=[...model.positions],indices=[...model.indices],normals=[...(model.normals||[])],uvs=[];
 if(!normals.length)B.VertexData.ComputeNormals(positions,indices,normals,{useRightHandedSystem:true});
 for(let i=0;i<positions.length/3;i++){
  let color=swatch('rock');
  if(model.name.startsWith('tree')){
   const x=Math.max(0,Math.min(image.width-1,Math.floor(model.uvs[i*2]*image.width)));
   const y=Math.max(0,Math.min(image.height-1,Math.floor(model.uvs[i*2+1]*image.height))),pixel=(y*image.width+x)*4;
   color=swatch(image.pixels[pixel+1]>image.pixels[pixel]?'tree-foliage':'tree-bark');
  }
  uvs.push(color.uvCenter[0],1-color.uvCenter[1]);
 }
 // GLTF and the renderer use opposite Z axes and winding.
 for(let i=2;i<positions.length;i+=3){positions[i]*=-1;normals[i]*=-1;}
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const chunks=[],views=[],accessors=[];let offset=0;
 function bufferView(bytes,target){const padding=(4-bytes.length%4)%4,index=views.length;views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes,Buffer.alloc(padding));offset+=bytes.length+padding;return index;}
 function accessor(values,type,width,index=false){
  const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>index?bytes.writeUInt32LE(v,i*4):bytes.writeFloatLE(v,i*4));
  const a={bufferView:bufferView(bytes,index?34963:34962),componentType:index?5125:5126,count:values.length/width,type};
  if(type==='VEC3'){a.min=Array.from({length:3},(_,k)=>Math.min(...values.filter((_,i)=>i%3===k)));a.max=Array.from({length:3},(_,k)=>Math.max(...values.filter((_,i)=>i%3===k)));}
  accessors.push(a);return accessors.length-1;
 }
 const primitive={attributes:{POSITION:accessor(positions,'VEC3',3),NORMAL:accessor(normals,'VEC3',3),TEXCOORD_0:accessor(uvs,'VEC2',2)},indices:accessor(indices,'SCALAR',1,true),material:0};
 const textureView=bufferView(texture);
 const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:model.name,mesh:0}],meshes:[{name:model.name,primitives:[primitive]}],buffers:[{byteLength:offset}],bufferViews:views,accessors,images:[{bufferView:textureView,mimeType:'image/png'}],samplers:[{magFilter:9728,minFilter:9728,wrapS:33071,wrapT:33071}],textures:[{source:0,sampler:0}],materials:[{name:'Project palette',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.85}}]};
 const json=JSON.stringify(doc),jsonBytes=Buffer.from(json.padEnd(Math.ceil(Buffer.byteLength(json)/4)*4,' ')),bin=Buffer.concat(chunks),out=Buffer.alloc(28+jsonBytes.length+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(jsonBytes.length,12);out.writeUInt32LE(0x4e4f534a,16);jsonBytes.copy(out,20);out.writeUInt32LE(bin.length,20+jsonBytes.length);out.writeUInt32LE(0x004e4942,24+jsonBytes.length);bin.copy(out,28+jsonBytes.length);
 const [check]=importGLB(out);
 if(check.indices.some((v,i)=>v!==model.indices[i])||check.positions.some((v,i)=>Math.abs(v-model.positions[i])>1e-6))throw Error(`Geometry changed: ${model.name}`);
 writeFileSync(path,out);console.log(`${model.name}.glb: ${indices.length/3} triangles, verified import`);
}
