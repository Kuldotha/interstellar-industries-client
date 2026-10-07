import{readFileSync,writeFileSync,existsSync,rmSync}from'node:fs';
import{createHash}from'node:crypto';
import{readPng}from'./png.mjs';
import{bakeRampParts}from'./ao-ramp.mjs';
const root=new URL('../',import.meta.url),b=readFileSync(new URL('models/house_01.glb',root)),len=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+len)),bin=b.subarray(28+len);
const config=JSON.parse(readFileSync(new URL('models/house_01.import.json',root))),palette=JSON.parse(readFileSync(new URL('models/project-palette/manifest.json',root)));
const node=g.nodes.find(n=>n.name==='house_01');if(!node||node.matrix||node.rotation||node.scale||node.translation)throw Error('Expected house with applied transforms');
function read(id){const a=g.accessors[id],v=g.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[a.type],size={5126:4,5123:2,5125:4}[a.componentType],method={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE'}[a.componentType];if(!width||!size||a.sparse)throw Error('Unsupported accessor');return Array.from({length:a.count*width},(_,i)=>bin[method]((v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/width)*(v.byteStride||width*size)+(i%width)*size));}
let parts=g.meshes[node.mesh].primitives.map(p=>{const positions=read(p.attributes.POSITION),normals=read(p.attributes.NORMAL),uvs=read(p.attributes.TEXCOORD_0),indices=read(p.indices),uvs2=p.attributes.TEXCOORD_1===undefined?null:read(p.attributes.TEXCOORD_1);for(let i=2;i<positions.length;i+=3){positions[i]*=-1;normals[i]*=-1;}for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];return{material:g.materials[p.material].name,positions,normals,uvs,uvs2,indices};});
const bakePath=new URL('models/baked/house_01.json',root),bake=existsSync(bakePath)?JSON.parse(readFileSync(bakePath)):null;
if(parts.every(p=>p.uvs2)){
  if(config.aoUV2!=='gradient')throw Error('UV2 must use the shared AO gradient');
}else if(bake?.sourceSha256===createHash('sha256').update(b).digest('hex')){
  const fitted=bakeRampParts(bake.parts,readPng(new URL('models/baked/house_01-ao.png',root)));parts=fitted.parts;console.log('AO ramp fit RMSE:',fitted.rmse.toFixed(4));
}
const glass=palette.swatches.find(s=>s.id==='house-glass');
for(const part of parts){
  if(!part.uvs2)part.uvs2=Array.from({length:part.positions.length/3*2},(_,i)=>i%2?.5:1);
  for(let i=0;i<part.uvs.length;i+=2){if(part.material==='Shades'){part.uvs[i]=glass.uvCenter[0];part.uvs[i+1]=1-glass.uvCenter[1];}else part.uvs[i+1]*=config.paletteRows/palette.rows;}
}
writeFileSync(new URL('public/models/house_01.json',root),JSON.stringify({parts,ao:'gradient'}));
rmSync(new URL('public/models/house-ao.png',root),{force:true});
