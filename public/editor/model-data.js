export const UNASSIGNED_REGION_ID='__unassigned__';
export const UNASSIGNED_COLOR='warm-neutrals-14';
export function unassignedRegion(parts,model){
 const assigned=new Set(model.regions.flatMap(r=>r.faces.map(f=>f.join(':')))),faces=[];
 parts.forEach((p,part)=>{for(let face=0;face<p.indices.length/3;face++)if(!assigned.has(part+':'+face))faces.push([part,face]);});
 return {id:UNASSIGNED_REGION_ID,name:'unassigned',faces};
}
export function geometryFingerprint(parts){
 let h=2166136261;for(const p of parts)for(const list of [p.positions,p.indices])for(const n of list)for(const c of String(n)+',')h=Math.imul(h^c.charCodeAt(0),16777619);
 return (h>>>0).toString(16);
}
export function createRegions(parts,palette){
 const groups=new Map(),ao=parts.map(p=>p.indices.map(i=>p.ao?.[i]??(p.uvs2?Math.max(0,Math.min(1,(p.uvs2[i*2]-.4375)/.125)):1)));
 parts.forEach((p,part)=>{for(let f=0;f<p.indices.length/3;f++){
 const i=p.indices[f*3],x=Math.max(0,Math.min(palette.columns-1,Math.floor((p.uvs?.[i*2]??0)*palette.columns))),y=Math.max(0,Math.min(palette.rows-1,Math.floor((p.uvs?.[i*2+1]??0)*palette.rows))),s=palette.swatches[y*palette.columns+x];
 if(!groups.has(s.id))groups.set(s.id,{id:s.id,name:s.name,faces:[],swatch:s.id,sourceSwatches:[s.id]});groups.get(s.id).faces.push([part,f]);
 }});
 return {fingerprint:geometryFingerprint(parts),regions:[...groups.values()].map(({swatch,...r})=>r),ao,colors:Object.fromEntries([...groups.values()].map(r=>[r.id,r.swatch]))};
}
export function captureRegionSources(parts,model,palette){
 if(model.fingerprint!==geometryFingerprint(parts))return false;
 const generated=createRegions(parts,palette),colors=new Map(generated.regions.flatMap(r=>r.faces.map(f=>[f.join(':'),generated.colors[r.id]])));let changed=false;
 for(const region of model.regions){const sourceSwatches=[...new Set(region.faces.map(f=>colors.get(f.join(':'))).filter(Boolean))].sort();if(sourceSwatches.length&&JSON.stringify(region.sourceSwatches)!==JSON.stringify(sourceSwatches)){region.sourceSwatches=sourceSwatches;changed=true;}}
 return changed;
}
export function remapRegions(parts,previous,appearance,palette){
 previous=structuredClone(previous);captureRegionSources(parts,previous,palette);
 const generated=createRegions(parts,palette),same=previous.fingerprint===generated.fingerprint;
 const model={...structuredClone(previous),fingerprint:generated.fingerprint,regions:previous.regions.map(r=>({...structuredClone(r),faces:[]}))};
 if(!same){model.ao=generated.ao;delete model.aoMapping;delete model.aoSeams;}
 const colors={...appearance.colors};
 for(const source of generated.regions){
  const swatch=generated.colors[source.id];let matches=previous.regions.filter(r=>r.sourceSwatches?.includes(swatch));
  if(!matches.length)matches=previous.regions.filter(r=>r.id===swatch);
  if(!matches.length)matches=previous.regions.filter(r=>appearance.colors[r.id]===swatch);
  if(matches.length>1){
   if(!same)throw Error('Several regions use '+source.name+'. Their names are retained; distinct mesh palette entries are needed to remap changed geometry.');
   for(const face of source.faces){const owner=matches.find(r=>r.faces.some(f=>f[0]===face[0]&&f[1]===face[1]));if(!owner)throw Error('Ambiguous region assignment for '+source.name);model.regions.find(r=>r.id===owner.id).faces.push(face);}
  }else if(matches.length===1){model.regions.find(r=>r.id===matches[0].id).faces.push(...source.faces);}
  else{
   let id=source.id,n=2;while(model.regions.some(r=>r.id===id))id=source.id+'-'+n++;
   model.regions.push({...source,id});colors[id]=swatch;
  }
 }
 captureRegionSources(parts,model,palette);
 return {model,colors};
}
export function validateAuthoring(data){
 if(data?.version!==1||!data.models||!data.appearances||!data.bindings)throw Error('Invalid authoring document');
 const safe=s=>typeof s==='string'&&s.length>0&&s.length<160&&!['__proto__','prototype','constructor'].includes(s);
 for(const [id,m] of Object.entries(data.models)){
  if(!safe(id)||!safe(m.fingerprint)||!Array.isArray(m.regions)||!Array.isArray(m.ao))throw Error('Invalid model');
  const names=new Set(),faces=new Set();for(const r of m.regions){if(r.sourceSwatches&&(!Array.isArray(r.sourceSwatches)||r.sourceSwatches.some(s=>!safe(s))))throw Error('Invalid region palette sources');if(r.id===UNASSIGNED_REGION_ID||!safe(r.id)||!safe(r.name)||names.has(r.id)||!Array.isArray(r.faces))throw Error('Invalid region');names.add(r.id);for(const face of r.faces){if(!Array.isArray(face)||face.length!==2||face.some(n=>!Number.isSafeInteger(n)||n<0)||faces.has(face.join(':')))throw Error('Invalid or overlapping face assignment');faces.add(face.join(':'));}}
  if(m.aoSeams&&(!Array.isArray(m.aoSeams)||m.aoSeams.some(e=>typeof e!=='string'||e.length>256)))throw Error('Invalid AO seams');
  for(const [key,map] of Object.entries(m.aoMapping||{})){
   const [part,face]=key.split(':').map(Number);
   if(!/^\d+:\d+$/.test(key)||!m.ao[part]||face*3+2>=m.ao[part].length||!Array.isArray(map.uv)||map.uv.length!==3||map.uv.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)))||!Number.isFinite(map.start)||!Number.isFinite(map.end)||!Number.isInteger(map.turn))throw Error('Invalid AO mapping');
  }
  if(m.ao.some(p=>!Array.isArray(p)||p.some(v=>!Number.isFinite(v)||Math.abs(v)>100)))throw Error('Invalid AO values');
 }
 for(const [id,a] of Object.entries(data.appearances))if(!safe(id)||!safe(a.name)||!a.colors||Object.entries(a.colors).some(([r,s])=>!safe(r)||!safe(s)))throw Error('Invalid appearance');
 for(const [model,appearance] of Object.entries(data.bindings))if(!data.models[model]||!data.appearances[appearance])throw Error('Invalid appearance binding');
 return data;
}
export function compileAppearance(parts,model,appearance,palette,{includeUnassigned=true}={}){
 if(model.fingerprint!==geometryFingerprint(parts))throw Error('The mesh changed. Rebuild its regions before applying this appearance.');
 const lookup=new Map(palette.swatches.map(s=>[s.id,s])),faces=new Map();
 const unassigned=lookup.get(appearance.colors[UNASSIGNED_REGION_ID]??UNASSIGNED_COLOR);
 if(appearance.colors[UNASSIGNED_REGION_ID]&&!unassigned)throw Error('Choose a swatch for unassigned');
 if(unassigned?.opacity<1)throw Error('Transparent glass needs a separate material; choose reflective glass for now.');
 for(const r of model.regions){const s=lookup.get(appearance.colors[r.id]);if(!s)throw Error('Choose a swatch for '+r.name);if(s.opacity<1)throw Error('Transparent glass needs a separate material; choose reflective glass for now.');for(const [part,f] of r.faces){if(!parts[part]||f>=parts[part].indices.length/3)throw Error('Region face is outside the mesh');faces.set(part+':'+f,s);}}
 return parts.map((p,part)=>{
  if(model.ao[part]?.length!==p.indices.length)throw Error('AO values do not match the mesh');
  const out={material:p.material||'Atlas',positions:[],normals:[],uvs:[],uvs2:[],ao:[],indices:[]};
  for(let corner=0;corner<p.indices.length;corner++){
   const assigned=faces.get(part+':'+Math.floor(corner/3));if(!includeUnassigned&&!assigned)continue;
   const i=p.indices[corner],swatch=assigned??unassigned;out.positions.push(...p.positions.slice(i*3,i*3+3));out.normals.push(...p.normals.slice(i*3,i*3+3));
   out.uvs.push(...(swatch?[swatch.uvCenter[0],1-swatch.uvCenter[1]]:p.uvs.slice(i*2,i*2+2)));out.uvs2.push(1,.5);out.ao.push(model.ao[part][corner]);out.indices.push(out.indices.length);
  }return out;
 });
}
let libraryPromise;
export async function authoredParts(id,parts,palette){
 libraryPromise??=fetch('models/library.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const entries=(await libraryPromise)?.models;
 const entry=Array.isArray(entries)?entries.find(m=>m.id===id):null;
 if(entry?.sourceHash)parts=entry.parts;
 const response=await fetch('models/authoring.json',{cache:'no-store'});if(!response.ok)return parts;
 const data=await response.json(),model=data.models?.[id],appearance=data.appearances?.[data.bindings?.[id]];if(!model||!appearance)return parts;
 try{return compileAppearance(parts,model,appearance,palette,{includeUnassigned:false});}catch(error){console.warn(id+': '+error.message);return parts;}
}
