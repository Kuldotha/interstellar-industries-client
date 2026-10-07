import fs from 'node:fs';
const source=fs.readFileSync(new URL('../core/src/authored.rs',import.meta.url),'utf8');
const meshes=[...source.matchAll(/AuthoredMesh\s*\{\s*vertices:\s*&([\s\S]*?)\n\s*\},/g)].map(match=>{
 const result={},body='vertices: &'+match[1];
 for(const field of ['vertices','triangles','masks','normals','weights']){
  const start=body.indexOf(field+':')+field.length+1,open=body.indexOf('[',start);let depth=0,end=open;
  do{if(body[end]==='[')depth++;if(body[end]===']')depth--;end++;}while(depth);
  result[field]=JSON.parse(body.slice(open,end).replace(/,\s*]/g,']'));
 }
 return result;
});
if(meshes.length!==18)throw Error(`Expected 18 terrain shapes, got ${meshes.length}`);
fs.writeFileSync(new URL('../public/editor/terrain-shapes.json',import.meta.url),JSON.stringify(meshes));
