import {TILE_RADIUS_METERS,tileCornerOffset} from '../model-units.js';
import {createAOController} from './ao-controller.js';
import {createEditorEnvironment} from './environment.js';
import {paintRegions,historyShortcut} from './region-editing.js';
import {attachEditorCamera} from './camera-controls.js';
import {loadPalette,opaqueMaterial,applySwatch} from '../palette-material.js';
import {createLighting} from '../lighting.js';
import {UNASSIGNED_REGION_ID,UNASSIGNED_COLOR,unassignedRegion,createRegions,captureRegionSources,remapRegions,compileAppearance,validateAuthoring,geometryFingerprint} from './model-data.js';
const B=window.BABYLON,$=id=>document.getElementById(id),canvas=$('view');
const hiddenRegions=new Set();let strokeSaved=false,editMode='regions',ao;document.body.dataset.mode=editMode;
let data,parts,selected='',modelId='house_01',meshes=[],overlay=null,aoLines=null,history=[],future=[],dirty=false,loading=false,stroke=false;
const status=(text,error=false)=>{$('status').textContent=text;$('status').style.color=error?'#ffa08c':'';};
const run=fn=>async(...args)=>{try{await fn(...args);}catch(e){status(e.message,true);console.error(e);}};
const engine=await(async()=>{if(new URLSearchParams(location.search).get('backend')!=='webgl'&&await B.WebGPUEngine.IsSupportedAsync){const e=new B.WebGPUEngine(canvas);await e.initAsync();return e;}return new B.Engine(canvas,true);})();
const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.035,.055,.065,1);scene.useRightHandedSystem=true;
const camera=new B.ArcRotateCamera('editor',-1.1,1.15,6,new B.Vector3(0,10,0),scene);camera.minZ=.001;camera.maxZ=1000;camera.wheelDeltaPercentage=.01;attachEditorCamera(camera,canvas);canvas.addEventListener('contextmenu',e=>e.preventDefault());
const hexPoints=Array.from({length:6},(_,i)=>new B.Vector3(tileCornerOffset(i)[0],.003,tileCornerOffset(i)[1]));
hexPoints.push(hexPoints[0].clone());
const hexGuide=B.MeshBuilder.CreateLines('tile-size-reference',{points:hexPoints},scene);
hexGuide.color=new B.Color3(.45,.85,.92);hexGuide.isPickable=false;hexGuide.renderingGroupId=1;scene.setRenderingAutoClearDepthStencil(1,false);hexGuide.material.depthFunction=B.Engine.ALWAYS;hexGuide.material.disableDepthWrite=true;
hexGuide.position.y=10;
$('hex-reference').onchange=()=>{hexGuide.setEnabled($('hex-reference').checked);frameRegion(true);};
const {sun}=createLighting(B,scene);sun.position.set(3,12,2.4);const shadows=new B.ShadowGenerator(1024,sun);shadows.usePercentageCloserFiltering=true;shadows.bias=.0001;shadows.normalBias=.001;
await loadPalette(B,scene);const palette=scene.metadata.palette,material=opaqueMaterial(B,scene,'editor-palette',null,{atlas:true});
const highlight=new B.StandardMaterial('region-highlight',scene);highlight.disableLighting=true;highlight.emissiveColor=new B.Color3(1,.65,.14);highlight.alpha=.28;highlight.backFaceCulling=false;highlight.disableDepthWrite=true;highlight.zOffset=-2;
B.Effect.ShadersStore.aoEditorVertexShader='precision highp float;attribute vec3 position;attribute float modelAO;uniform mat4 worldViewProjection;varying float vAO;void main(){vAO=modelAO;gl_Position=worldViewProjection*vec4(position,1.0);}';
B.Effect.ShadersStore.aoEditorFragmentShader='precision highp float;varying float vAO;void main(){gl_FragColor=vec4(vec3(clamp(vAO,0.0,1.0)),1.0);}';
const aoMaterial=new B.ShaderMaterial('ao-preview',scene,{vertex:'aoEditor',fragment:'aoEditor'},{attributes:['position','modelAO'],uniforms:['worldViewProjection']});aoMaterial.backFaceCulling=false;
const props=await(await fetch('props.json')).json();
let library=await(await fetch('/api/models',{cache:'no-store'})).json();
const catalog=new Map();
function refreshCatalog(){catalog.clear();$('model').replaceChildren();for(const entry of library.models.filter(m=>m.active)){catalog.set(entry.id,entry);$('model').add(new Option(entry.name,entry.id));}}
refreshCatalog();modelId=catalog.has(modelId)?modelId:catalog.keys().next().value;
data=await(await fetch('models/authoring.json',{cache:'no-store'})).json();validateAuthoring(data);
let environment=null;
$('environment').onchange=run(async()=>{if(!environment){$('environment').disabled=true;try{environment=await createEditorEnvironment(B,scene,shadows,library,data);environment.fit(parts);}finally{$('environment').disabled=false;}}environment.show($('environment').checked);});
const model=()=>data.models[modelId],appearance=()=>data.appearances[data.bindings[modelId]],region=()=>selected===UNASSIGNED_REGION_ID?unassignedRegion(parts,model()):model().regions.find(r=>r.id===selected);
const regionColor=id=>appearance().colors[id]??(id===UNASSIGNED_REGION_ID?UNASSIGNED_COLOR:undefined);
function seed(id){const generated=createRegions(parts,palette),appearanceId=id+'-default';data.models[id]={fingerprint:generated.fingerprint,regions:generated.regions,ao:generated.ao};data.appearances[appearanceId]={name:catalog.get(id).name+' default',colors:generated.colors};data.bindings[id]=appearanceId;}
function remember(){history.push(JSON.stringify(data));if(history.length>50)history.shift();future=[];dirty=true;}
function changed(){dirty=true;status('Unsaved changes');$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function faceRegion(part,face){return model().regions.find(r=>r.faces.some(f=>f[0]===part&&f[1]===face))??{id:UNASSIGNED_REGION_ID};}
function rebuild(compiled=compileAppearance(parts,model(),appearance(),palette)){
 for(const mesh of meshes){shadows.removeShadowCaster(mesh);mesh.dispose();}meshes=[];
 compiled.forEach((p,part)=>{
  const mesh=new B.Mesh('part-'+part,scene),g=new B.VertexData();Object.assign(g,p);g.applyToMesh(mesh);mesh.setVerticesData('modelAO',p.ao,true,1);mesh.position.y=10;mesh.metadata={part,fullIndices:p.indices};mesh.material=editMode==='ao'&&$('ao-preview').checked?aoMaterial:material;mesh.receiveShadows=true;shadows.addShadowCaster(mesh);
  const visible=[];for(let f=0;f<p.indices.length/3;f++)if(!hiddenRegions.has(faceRegion(part,f)?.id))visible.push(f);
  mesh.metadata.visibleFaces=visible;mesh.setIndices(visible.length?visible.flatMap(f=>[f*3,f*3+1,f*3+2]):[0,0,0]);mesh.setEnabled(visible.length>0);
  meshes.push(mesh);
 });material.wireframe=aoMaterial.wireframe=$('wire').checked;showOverlay();
}
function showOverlay(){overlay?.dispose();overlay=null;aoLines?.dispose();aoLines=null;if(editMode==='ao'&&ao){const lines=ao.seamLines().map(edge=>edge.map(p=>new B.Vector3(p[0],p[1]+10,p[2])));const first=ao.refs()[0];if(first){const [part,f]=first,points=parts[part].indices.slice(f*3,f*3+3).map(i=>new B.Vector3(...parts[part].positions.slice(i*3,i*3+3)));points.forEach(p=>p.y+=10);points.push(points[0].clone());lines.push(points);}if(lines.length){aoLines=B.MeshBuilder.CreateLineSystem('ao-edges',{lines},scene);aoLines.color=new B.Color3(1,.35,.15);aoLines.isPickable=false;}}const faces=editMode==='ao'?(ao?.refs()||[]):(region()&&!hiddenRegions.has(selected)&&$('highlight').checked?region().faces:[]);const positions=[];for(const [part,f] of faces){if(hiddenRegions.has(faceRegion(part,f)?.id))continue;for(const i of parts[part].indices.slice(f*3,f*3+3))positions.push(...parts[part].positions.slice(i*3,i*3+3));}if(!positions.length)return;overlay=new B.Mesh('selection',scene);const g=new B.VertexData();g.positions=positions;g.indices=Array.from({length:positions.length/3},(_,i)=>i);g.applyToMesh(overlay);overlay.position.y=10;overlay.material=highlight;overlay.isPickable=false;}
const eyeIcon=hidden=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(hidden?'<path d="m3 3 18 18"/>':'')+'</svg>';
function renameRegion(r,slot){
 if(slot.querySelector('input'))return;const input=document.createElement('input');input.className='name-input';input.value=r.name;input.setAttribute('aria-label','Region name');slot.replaceWith(input);input.focus();input.select();let finished=false;
 const finish=cancel=>{if(finished)return;finished=true;const name=input.value.trim();if(!cancel&&name&&name!==r.name){if(model().regions.some(other=>other!==r&&other.name===name)){status('Region name already exists',true);}else{remember();r.name=name;changed();}}repaint();};
 input.onclick=e=>e.stopPropagation();input.onblur=()=>finish(false);input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finish(false);}if(e.key==='Escape'){e.preventDefault();finish(true);}};
}
function repaint(){
 $('regions').replaceChildren();for(const r of [...model().regions,unassignedRegion(parts,model())]){
  const swatch=palette.swatches.find(s=>s.id===regionColor(r.id)),row=document.createElement('div'),chip=document.createElement('button'),name=document.createElement('span'),count=document.createElement('small'),eye=document.createElement('button');
  row.className='region'+(r.id===selected?' selected':'')+(hiddenRegions.has(r.id)?' hidden-region':'');row.dataset.region=r.id;row.tabIndex=0;row.setAttribute('aria-label',r.name+' region');
  chip.className='chip';chip.style.background=swatch?.color||'#444';chip.title=editMode==='appearance'||r.id===UNASSIGNED_REGION_ID?'Choose palette entry':'Select region';chip.setAttribute('aria-label','Color for '+r.name);chip.onclick=e=>{e.stopPropagation();selected=r.id;repaint();showOverlay();if(editMode==='appearance'||r.id===UNASSIGNED_REGION_ID)openPalette();};
  name.className='name';name.textContent=r.name;name.title=r.id===UNASSIGNED_REGION_ID?'Faces without a region':'Click the selected name to rename';name.onclick=e=>{if(editMode==='regions'&&r.id!==UNASSIGNED_REGION_ID&&selected===r.id){e.stopPropagation();renameRegion(r,name);}};count.textContent=r.faces.length;
  eye.className='eye';eye.innerHTML=eyeIcon(hiddenRegions.has(r.id));eye.title=hiddenRegions.has(r.id)?'Show region':'Hide region';eye.setAttribute('aria-label',(hiddenRegions.has(r.id)?'Show ':'Hide ')+r.name);eye.setAttribute('aria-pressed',String(!hiddenRegions.has(r.id)));eye.onclick=e=>{e.stopPropagation();if(hiddenRegions.has(r.id))hiddenRegions.delete(r.id);else hiddenRegions.add(r.id);rebuild();repaint();};
  row.append(chip,name,count,eye);if(editMode==='regions'&&r.id!==UNASSIGNED_REGION_ID&&r.id===selected){const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.title='Delete region';remove.setAttribute('aria-label','Delete '+r.name);remove.onclick=e=>{e.stopPropagation();remember();model().regions=model().regions.filter(other=>other!==r);hiddenRegions.delete(r.id);selected=model().regions[0]?.id||'';repaint();rebuild();changed();};row.append(remove);}
  row.onclick=()=>{selected=r.id;repaint();showOverlay();};row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=r.id;repaint();showOverlay();}};$('regions').append(row);
 }
 $('appearance').replaceChildren(...Object.entries(data.appearances).map(([id,a])=>new Option(a.name,id)));$('appearance').value=data.bindings[modelId];$('appearance-name').value=appearance().name;paintPalette();updatePreview();$('undo').disabled=!history.length;$('redo').disabled=!future.length;
}
function paintPalette(){const filter=$('palette-filter').value.toLowerCase();$('palette').style.gridTemplateColumns='repeat('+palette.columns+',minmax(0,1fr))';$('palette').replaceChildren();for(const swatch of palette.swatches){const button=document.createElement('button');button.style.background=swatch.color;button.title=swatch.name+' · '+swatch.color+' · Row '+(swatch.row+1)+' / Column '+(swatch.column+1);button.setAttribute('aria-label',swatch.name);button.classList.toggle('chosen',regionColor(selected)===swatch.id);button.classList.toggle('search-dim',!!filter&&!((swatch.name+' '+swatch.group).toLowerCase().includes(filter)));button.disabled=swatch.opacity<1;button.onmouseenter=()=>{$('palette-info').textContent=button.title;updatePreview(swatch);};button.onmouseleave=()=>updatePreview();button.onclick=run(()=>{if(!region())throw Error('Select a region first');if(regionColor(selected)===swatch.id)return;remember();appearance().colors[selected]=swatch.id;rebuild();repaint();changed();});$('palette').append(button);}}
function frameRegion(all=false){const points=[];if(all)for(const p of parts)points.push(...p.positions);else for(const [part,f] of (editMode==='ao'?ao.refs():region()?.faces||[]))for(const i of parts[part].indices.slice(f*3,f*3+3))points.push(...parts[part].positions.slice(i*3,i*3+3));if(all&&$('hex-reference').checked)for(const p of hexPoints)points.push(p.x+hexGuide.position.x,p.y,p.z+hexGuide.position.z);if(!points.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<points.length;i++) {const k=i%3;lo[k]=Math.min(lo[k],points[i]);hi[k]=Math.max(hi[k],points[i]);}camera.setTarget(new B.Vector3((lo[0]+hi[0])/2,10+(lo[1]+hi[1])/2,(lo[2]+hi[2])/2));camera.radius=Math.max(.08,Math.hypot(...hi.map((x,i)=>x-lo[i]))*1.3/Math.min(1,engine.getRenderWidth()/engine.getRenderHeight()));}
function enablePainting(enabled){$('ao-panel').inert=!enabled;$('regions').inert=!enabled;for(const id of ['add-region','appearance','appearance-name','new-appearance','choose-color'])$(id).disabled=!enabled;for(const control of $('regions').querySelectorAll('button,input'))control.disabled=!enabled;}
async function load(id,{frame=true}={}){if(modelId!==id)ao?.clear();loading=true;hiddenRegions.clear();modelId=id;parts=structuredClone(catalog.get(id).parts);$('model').value=id;
 if(catalog.get(id).legacyProp){
  const s=palette.swatches.find(s=>s.id==='rock');if(id.startsWith('rock'))parts[0].uvs=Array.from({length:parts[0].positions.length/3},()=>[s.uvCenter[0],1-s.uvCenter[1]]).flat();
  else {const image=await createImageBitmap(await(await fetch('props-color.png')).blob()),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;image.close();const p=parts[0];for(let i=0;i<p.uvs.length;i+=2){const x=Math.min(c.width-1,Math.max(0,Math.floor(p.uvs[i]*c.width))),y=Math.min(c.height-1,Math.max(0,Math.floor(p.uvs[i+1]*c.height))),offset=(y*c.width+x)*4,swatch=palette.swatches.find(s=>s.id===(pixels[offset+1]>pixels[offset]?'tree-foliage':'tree-bark'));p.uvs[i]=swatch.uvCenter[0];p.uvs[i+1]=1-swatch.uvCenter[1];}}
 }
 if(!data.models[id]){seed(id);dirty=true;}
 if(model().fingerprint!==geometryFingerprint(parts)){if($('palette-dialog').open)$('palette-dialog').close();const fresh=createRegions(parts,palette);selected='';repaint();rebuild(compileAppearance(parts,fresh,{colors:fresh.colors},palette));enablePainting(false);environment?.fit(parts);if(frame)frameRegion(true);status('Mesh changed. Saved painting is retained. Use Remap regions from mesh colors to edit this version.',true);$('reset-regions').disabled=false;return;}
 captureRegionSources(parts,model(),palette);selected=model().regions[0]?.id||'';ao?.load();repaint();enablePainting(true);rebuild();environment?.fit(parts);if(frame)frameRegion(true);loading=false;status(dirty?'Unsaved changes':'Ready');}
function pick(x,y){const hit=scene.pick(x,y,m=>meshes.includes(m));if(!hit?.hit)return null;const part=hit.pickedMesh.metadata.part,face=hit.pickedMesh.metadata.visibleFaces?.[hit.faceId]??hit.faceId;return {part,face,hit};}
function pointer(e){const rect=canvas.getBoundingClientRect();return [(e.clientX-rect.left)*engine.getRenderWidth()/rect.width,(e.clientY-rect.top)*engine.getRenderHeight()/rect.height];}
function paint(e){const [x,y]=pointer(e),picked=pick(x,y);if(!picked)return;
 const current=region(),erase=e.ctrlKey||(editMode==='regions'&&selected===UNASSIGNED_REGION_ID);if(editMode==='regions'&&!erase&&(!current||hiddenRegions.has(selected)))return;
 const radius=Number($('radius').value)*engine.getRenderWidth()/canvas.clientWidth,through=$('through').checked;
 const vp=camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()),transform=scene.getTransformMatrix();
 const visible=(p,screen)=>{if(through)return true;const h=scene.pick(screen.x,screen.y,m=>meshes.includes(m));return h?.hit&&B.Vector3.Distance(h.pickedPoint,p)<.006;};
 const chosen=[];for(let part=0;part<parts.length;part++){const p=parts[part];for(let f=0;f<p.indices.length/3;f++){if(hiddenRegions.has(faceRegion(part,f)?.id))continue;const ids=p.indices.slice(f*3,f*3+3),center=B.Vector3.Zero();for(const i of ids)center.addInPlace(B.Vector3.FromArray(p.positions,i*3).scale(1/3));center.y+=10;const screen=B.Vector3.Project(center,B.Matrix.Identity(),transform,vp);if(screen.z<0||screen.z>1||Math.hypot(screen.x-x,screen.y-y)>radius||!visible(center,screen))continue;chosen.push([part,f]);}}
 if(!chosen.some(([p,f])=>p===picked.part&&f===picked.face))chosen.push([picked.part,picked.face]);
 if(editMode==='ao'){ao.select(chosen,{add:true,remove:e.ctrlKey});return;}
 const next=structuredClone(model().regions);if(!paintRegions(next,selected,chosen,{erase,unassigned:$('unassigned').checked}))return;
 if(!strokeSaved){remember();strokeSaved=true;}model().regions=next;rebuild();repaint();changed();
}
const brush=$('brush-cursor');let lastPointer=null;
function brushCursor(e){if(e)lastPointer=e;if(!lastPointer)return;const rect=canvas.getBoundingClientRect(),radius=Number($('radius').value);brush.style.left=(lastPointer.clientX-rect.left)+'px';brush.style.top=(lastPointer.clientY-rect.top)+'px';brush.style.width=brush.style.height=radius*2+'px';brush.classList.toggle('erase',!!lastPointer.ctrlKey);}
canvas.addEventListener('pointerenter',e=>{brush.hidden=editMode!=='regions';brushCursor(e);});canvas.addEventListener('pointerleave',()=>brush.hidden=true);
canvas.addEventListener('pointerdown',e=>{if(e.button!==0){brush.hidden=true;return;}if(loading)return;e.preventDefault();const [x,y]=pointer(e),picked=pick(x,y);
 if(editMode==='appearance'){if(picked){selected=faceRegion(picked.part,picked.face)?.id||'';repaint();showOverlay();}return;}
 stroke=true;strokeSaved=false;if(editMode==='ao'){ao.select(picked?[[picked.part,picked.face]]:[],{toggle:e.shiftKey,remove:e.ctrlKey});}else paint(e);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{brush.hidden=editMode!=='regions'||e.buttons!==0&&e.buttons!==1;brushCursor(e);if(stroke)paint(e);});
const endStroke=()=>{stroke=false;strokeSaved=false;};canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('lostpointercapture',endStroke);window.addEventListener('blur',()=>{endStroke();brush.hidden=true;});
$('radius').oninput=()=>brushCursor();for(const event of ['keydown','keyup'])window.addEventListener(event,e=>{if(lastPointer){lastPointer={clientX:lastPointer.clientX,clientY:lastPointer.clientY,ctrlKey:e.ctrlKey};brushCursor();}});
$('model').onchange=run(()=>load($('model').value));$('palette-filter').oninput=paintPalette;
for(const id of ['wire','highlight'])$(id).onchange=()=>{if(!loading)rebuild();};
$('frame').onclick=()=>frameRegion(true);$('frame-region').onclick=()=>frameRegion();$('ao-preview').onchange=()=>rebuild();
$('choose-color').onclick=()=>{openPalette();paintPalette();};$('close-palette').onclick=()=>$('palette-dialog').close();$('palette-dialog').addEventListener('close',()=>{previewAnchor.after(previewBlock);$('choose-color').hidden=false;previewEngine.resize();updatePreview();});
$('add-region').onclick=run(()=>{let n=1;while(model().regions.some(r=>r.name==='Region '+n))n++;remember();selected=crypto.randomUUID();const r={id:selected,name:'Region '+n,faces:[]};model().regions.push(r);appearance().colors[selected]='building-wall';repaint();rebuild();changed();renameRegion(r,$('regions').querySelector('.selected .name'));});
$('appearance').onchange=run(()=>{remember();data.bindings[modelId]=$('appearance').value;for(const r of model().regions)appearance().colors[r.id]??='building-wall';repaint();rebuild();changed();});
$('appearance-name').onchange=run(()=>{const name=$('appearance-name').value.trim();if(!name)throw Error('Enter a name');remember();appearance().name=name;repaint();changed();});
$('new-appearance').onclick=run(()=>{remember();const a=structuredClone(appearance()),id=crypto.randomUUID();a.name+=' copy';data.appearances[id]=a;data.bindings[modelId]=id;repaint();changed();});
async function undo(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(JSON.stringify(data));data=JSON.parse(from.pop());if(!model()){seed(modelId);}changed();await load(modelId,{frame:false});}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;const action=historyShortcut(e);if(action){e.preventDefault();endStroke();undo(action==='redo');}});
async function save(){validateAuthoring(data);const response=await fetch('/api/authoring',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok)throw Error((await response.json()).error||'Save failed');dirty=false;status('Saved · reload the game to apply');}
$('save').onclick=run(save);
let libraryBusy=false;
async function updateLibrary(method,file){
 if(libraryBusy)return;libraryBusy=true;
 const buttons=['add-model','reimport-model','remove-model','save','model'];for(const id of buttons)$(id).disabled=true;
 try{
  endStroke();captureRegionSources(parts,model(),palette);await save();
  const response=await fetch('/api/models'+(method==='POST'?'':'/'+encodeURIComponent(modelId)),{method,headers:{'Content-Type':'model/gltf-binary','X-Library-Revision':String(library.revision),...(file?{'X-Model-Filename':encodeURIComponent(file.name)}:{})},...(file?{body:file}:{})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Model update failed');
  library=result;refreshCatalog();history=[];future=[];
  modelId=catalog.has(result.selectedId)?result.selectedId:catalog.keys().next().value;$('model').value=modelId;
  await load(modelId);if(dirty)await save();
  if(!loading)status(method==='DELETE'?'Removed from library · source file kept':method==='PUT'?'Model reimported · reload the game to apply':'Model imported');
 }finally{libraryBusy=false;for(const id of buttons)$(id).disabled=false;}
}
$('add-model').onclick=()=>$('model-file').click();
$('reimport-model').onclick=()=>$('replacement-file').click();
$('model-file').onchange=run(async()=>{try{const file=$('model-file').files[0];if(file)await updateLibrary('POST',file);}finally{$('model-file').value='';}});
$('replacement-file').onchange=run(async()=>{try{const file=$('replacement-file').files[0];if(file)await updateLibrary('PUT',file);}finally{$('replacement-file').value='';}});
$('remove-model').onclick=run(async()=>{if(confirm('Remove '+catalog.get(modelId).name+' from the library? Source files and saved appearances will be kept.'))await updateLibrary('DELETE');});
window.addEventListener('keydown',e=>{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||(e.code!=='KeyS'&&e.key?.toLowerCase()!=='s'))return;
 e.preventDefault();e.stopPropagation();if(e.repeat||loading)return;
 document.activeElement?.blur();endStroke();$('save').click();
},true);
$('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download='authoring.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('import').onchange=run(async()=>{const file=$('import').files[0];if(!file)return;const incoming=validateAuthoring(JSON.parse(await file.text()));remember();data=incoming;await load(modelId);changed();});
$('reset-regions').onclick=run(()=>{
 const converted=remapRegions(parts,model(),appearance(),palette);remember();data.models[modelId]=converted.model;
 Object.assign(appearance().colors,converted.colors);loading=false;selected=converted.model.regions.find(r=>r.id===selected)?.id||converted.model.regions[0]?.id||'';
 ao.load();rebuild();repaint();enablePainting(true);frameRegion(true);changed();status('Regions remapped · names and appearance links preserved');
});
const previewBlock=document.querySelector('.material-preview'),previewAnchor=document.createElement('div');previewBlock.before(previewAnchor);
function openPalette(){if((editMode!=='appearance'&&selected!==UNASSIGNED_REGION_ID)||$('palette-dialog').open)return;$('palette-filter').before(previewBlock);$('choose-color').hidden=true;$('palette-dialog').showModal();previewEngine.resize();}
const previewCanvas=$('material-view'),previewEngine=new B.Engine(previewCanvas,true),previewScene=new B.Scene(previewEngine);previewScene.clearColor=new B.Color4(.035,.055,.065,1);previewScene.useRightHandedSystem=true;createLighting(B,previewScene);await loadPalette(B,previewScene);
const previewCamera=new B.ArcRotateCamera('material-preview',-1.1,1.15,3.3,new B.Vector3(0,10,0),previewScene),sphere=B.MeshBuilder.CreateSphere('material-sphere',{diameter:1.8,segments:32},previewScene),previewMaterial=opaqueMaterial(B,previewScene,'preview-palette',null,{atlas:true});sphere.position.y=10;
function updatePreview(swatch){swatch??=palette.swatches.find(s=>s.id===regionColor(selected));sphere.setEnabled(!!swatch);$('choose-color').disabled=!region();$('color-title').textContent=swatch?.name||'Select a region';$('material-info').textContent=swatch?swatch.color+' · '+(swatch.emissive?'Emissive':swatch.metallic?'Metallic':'Matte')+' · Roughness '+swatch.roughness:'';if(swatch)applySwatch(B,sphere,swatch,previewMaterial);}
const border=$('panel-border');let resizing=false;
function panelWidth(width){width=Math.max(220,Math.min(width,Math.min(680,innerWidth-180)));document.body.style.setProperty('--panel-width',width+'px');border.setAttribute('aria-valuenow',Math.round(width));engine.resize();previewEngine.resize();}
border.addEventListener('pointerdown',e=>{e.preventDefault();resizing=true;border.setPointerCapture(e.pointerId);});border.addEventListener('pointermove',e=>{if(resizing)panelWidth(innerWidth-e.clientX);});border.addEventListener('pointerup',()=>resizing=false);border.addEventListener('lostpointercapture',()=>resizing=false);border.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();panelWidth($('inspector').getBoundingClientRect().width+(e.key==='ArrowLeft'?20:-20));}});
new ResizeObserver(()=>{engine.resize();previewEngine.resize();}).observe($('viewport'));
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});window.addEventListener('resize',()=>panelWidth($('inspector').getBoundingClientRect().width));
ao=createAOController({getParts:()=>parts,getModel:model,remember,changed,refresh:()=>rebuild(),overlay:showOverlay,status,isVisible:([part,f])=>!hiddenRegions.has(faceRegion(part,f)?.id)});
function setMode(mode){endStroke();editMode=mode;document.body.dataset.mode=mode;brush.hidden=true;if($('palette-dialog').open)$('palette-dialog').close();
 for(const b of document.querySelectorAll('#editor-modes button'))b.setAttribute('aria-selected',String(b.dataset.mode===mode));
 $('region-panel').hidden=mode==='ao';$('appearance-panel').hidden=mode!=='appearance';$('ao-panel').hidden=mode!=='ao';$('add-region').hidden=mode!=='regions';$('unassigned').parentElement.hidden=mode!=='regions';$('through').parentElement.hidden=mode==='appearance';$('radius').parentElement.hidden=mode==='appearance';
 document.querySelector('.help').textContent=mode==='regions'?'Left drag: paint · Ctrl + paint: erase · Right drag: orbit · Middle drag: pan · Wheel: zoom':mode==='ao'?'Click / Shift-click: select faces · Drag: add faces · Ctrl-drag: remove · Right drag: orbit':'Click a region, then choose its palette entry · Right drag: orbit · Middle drag: pan';
 repaint();if(!loading)rebuild();ao.render();engine.resize();previewEngine.resize();
}
for(const button of document.querySelectorAll('#editor-modes button'))button.onclick=()=>setMode(button.dataset.mode);
window.addEventListener('keydown',e=>{if(editMode!=='ao'||!(e.ctrlKey||e.metaKey)||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;const id=e.code==='KeyC'?'ao-copy':e.code==='KeyV'?'ao-paste':null;if(id&&!$(id).disabled){e.preventDefault();$(id).click();}});
await load(modelId);setMode('regions');engine.runRenderLoop(()=>{camera.minZ=Math.max(.005,Math.min(.2,camera.radius*.002));scene.render();});previewEngine.runRenderLoop(()=>previewScene.render());
