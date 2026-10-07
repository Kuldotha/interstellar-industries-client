import fs from 'node:fs/promises';
import {join,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js');

export function importGLB(bytes){
 if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Choose a valid GLB 2.0 file.');
 let gltf,bin;
 for(let offset=12;offset<bytes.length;){
  if(offset+8>bytes.length)throw Error('Truncated GLB chunk.');
  const size=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4);offset+=8;
  if(offset+size>bytes.length)throw Error('Truncated GLB data.');
  if(type===0x4e4f534a)gltf=JSON.parse(bytes.toString('utf8',offset,offset+size));
  if(type===0x004e4942)bin=bytes.subarray(offset,offset+size);offset+=size;
 }
 if(!gltf||!bin)throw Error('The GLB must contain embedded mesh data.');
 if(gltf.extensionsRequired?.length)throw Error('Export without required GLTF extensions or mesh compression.');
 const read=id=>{
  const a=gltf.accessors?.[id],v=gltf.bufferViews?.[a?.bufferView];
  const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a?.type],format={5120:[1,'readInt8',127],5121:[1,'readUInt8',255],5122:[2,'readInt16LE',32767],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a?.componentType];
  if(!v||!width||!format||a.sparse||v.buffer!==0||!Number.isSafeInteger(a.count)||a.count<0||a.count>2_000_000)throw Error('Unsupported or invalid mesh accessor.');
  const [size,method,divisor]=format,stride=v.byteStride||width*size,start=(v.byteOffset||0)+(a.byteOffset||0),end=a.count?start+(a.count-1)*stride+width*size:start;
  if(start<0||stride<width*size||end>bin.length||end>(v.byteOffset||0)+v.byteLength)throw Error('Mesh data is outside its buffer.');
  return Array.from({length:a.count*width},(_,i)=>{const n=bin[method](start+Math.floor(i/width)*stride+i%width*size);if(!Number.isFinite(n))throw Error('Mesh contains non-finite values.');return a.normalized?Math.max(-1,n/divisor):n;});
 };
 let rootOrigin;
 const parts=[],visit=(id,parent,path=new Set())=>{
  if(path.has(id)||path.size>64)throw Error('Invalid model hierarchy.');
  const n=gltf.nodes?.[id];if(!n)throw Error('Missing model node.');
  if(n.skin!==undefined)throw Error('Export static meshes without skinning.');
  const local=n.matrix?B.Matrix.FromArray(n.matrix):B.Matrix.Compose(B.Vector3.FromArray(n.scale||[1,1,1]),B.Quaternion.FromArray(n.rotation||[0,0,0,1]),B.Vector3.FromArray(n.translation||[0,0,0]));
  if(path.size===0){rootOrigin??=local.getTranslation();local.setTranslation(local.getTranslation().subtract(rootOrigin));}
  const world=local.multiply(parent),det=world.determinant();if(!Number.isFinite(det)||Math.abs(det)<1e-12)throw Error('Model has a singular transform.');
  const normalMatrix=B.Matrix.Transpose(world.clone().invert());
  if(n.mesh!==undefined)for(const p of gltf.meshes[n.mesh].primitives){
   if((p.mode??4)!==4||p.targets)throw Error('Export triangulated static meshes without morph targets.');
   const positions=read(p.attributes.POSITION),normals=p.attributes.NORMAL===undefined?[]:read(p.attributes.NORMAL),count=positions.length/3;
   const indices=p.indices===undefined?Array.from({length:count},(_,i)=>i):read(p.indices);
   const uvs=p.attributes.TEXCOORD_0===undefined?Array(count*2).fill(0):read(p.attributes.TEXCOORD_0),uvs2=p.attributes.TEXCOORD_1===undefined?null:read(p.attributes.TEXCOORD_1);
   if(!count||count%1||indices.length%3||indices.some(i=>!Number.isInteger(i)||i<0||i>=count)||uvs.length!==count*2||(normals.length&&normals.length!==positions.length)||(uvs2&&uvs2.length!==count*2))throw Error('Mesh attributes have inconsistent sizes.');
   for(let i=0;i<count;i++){
    const point=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i*3),world);positions.splice(i*3,3,point.x,point.y,-point.z);
    if(normals.length){const normal=B.Vector3.TransformNormal(B.Vector3.FromArray(normals,i*3),normalMatrix).normalize();normals.splice(i*3,3,normal.x,normal.y,-normal.z);}
   }
   if(det>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
   if(!normals.length)B.VertexData.ComputeNormals(positions,indices,normals,{useRightHandedSystem:true});
   parts.push({material:gltf.materials?.[p.material]?.name||n.name||'Palette',positions,normals,uvs,...(uvs2?{uvs2}:{})});parts.at(-1).indices=indices;
  }
  for(const child of n.children||[])visit(child,world,new Set([...path,id]));
 };
 const scene=gltf.scenes?.[gltf.scene??0];if(!scene)throw Error('The GLB has no default scene.');
 for(const id of scene.nodes||[])visit(id,B.Matrix.Identity());
 if(!parts.length)throw Error('The GLB contains no mesh in its default scene.');
 return parts;
}

export function createModelLibrary(root,sourceRoot){
 const file=join(root,'models/library.json');let queue=Promise.resolve();
 const atomic=async(path,value)=>{const temp=path+'.'+randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(value)+'\n');await fs.rename(temp,path);}finally{await fs.unlink(temp).catch(()=>{});}};
 const read=async()=>{
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const [house,props]=await Promise.all(['models/house_01.json','props.json'].map(p=>fs.readFile(join(root,p),'utf8').then(JSON.parse)));
  return {version:1,revision:0,models:[{id:'house_01',name:'House',parts:house.parts,active:true},...props.map(p=>({id:p.name,name:p.name.replaceAll('_',' '),parts:[p],active:true,legacyProp:true,runtimeProp:true}))]};
 };
 const change=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 return {read,async route(req,res){
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/models'))return false;
  const send=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   if(req.method==='GET'&&url.pathname==='/api/models'){send(200,await read());return true;}
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Error('Origin not allowed');
   const id=decodeURIComponent(url.pathname.slice('/api/models/'.length));
   let bytes;
   if(req.method==='POST'||req.method==='PUT'){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20_000_000)throw Error('Model exceeds 20 MB.');chunks.push(chunk);}bytes=Buffer.concat(chunks);}
   const result=await change(async()=>{
    const library=await read();
    if(Number(req.headers['x-library-revision'])!==library.revision)throw Error('The model library changed. Reload the editor before trying again.');
    let entry=library.models.find(m=>m.id===id);
    if(req.method==='DELETE'){
     if(!entry?.active)throw Error('Model not found');
     if(library.models.filter(m=>m.active).length===1)throw Error('Keep at least one model in the library.');entry.active=false;
    }else if(req.method==='POST'||req.method==='PUT'){
     if(req.method==='PUT'&&!entry?.active)throw Error('Model not found');
     const parts=importGLB(bytes),sourceName=basename(decodeURIComponent(req.headers['x-model-filename']||'model.glb'));
     if(!sourceName.toLowerCase().endsWith('.glb'))throw Error('Choose a GLB file.');
     if((entry?.runtimeProp||entry?.legacyProp)&&parts.length!==1)throw Error('This prop currently requires a single mesh primitive.');
     if(req.method==='POST'){entry={id:'model-'+randomUUID(),name:sourceName.replace(/\.glb$/i,''),active:true};library.models.push(entry);}
     const hash=createHash('sha256').update(bytes).digest('hex');await fs.mkdir(sourceRoot,{recursive:true});
     const source=entry.id+'-'+hash+'.glb';await fs.writeFile(join(sourceRoot,source),bytes);
     Object.assign(entry,{parts,legacyProp:false,sourceName,source,sourceHash:hash});
    }else throw Error('Unsupported library operation');
    library.revision++;await atomic(file,library);return {...library,selectedId:entry.id};
   });send(200,result);
  }catch(e){send(400,{error:e.message});}return true;
 }};
}
