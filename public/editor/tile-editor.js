import {meadowVariant,meadowGeometry} from '../meadow-variants.js';
import {fieldLayout} from '../field-layout.js';
import {createCropGrass} from '../crop-grass.js';
import {missingCompositionModels,replaceCompositionModel,availableComposition} from '../composition-references.js';
import {tileNeighborOffset} from '../model-units.js';
import {previewTerrain,PREVIEW_HEIGHT_STEP} from './tile-terrain.js';
import {defaultUrbanConnection,urbanConnectionObjects} from '../urban-connections.js';
import {previewUrbanConnections} from './tile-connections.js';
import {compositionTargets,defaultFixed,defaultScatter,generateComposition,validateCompositions,tilePolygon} from '../tile-composition.js';
import {loadCompositionData,compositionModels} from '../composition-models.js';
import {loadPalette,opaqueMaterial,groundMaterial} from '../palette-material.js';
import {createLighting} from '../lighting.js';
import {attachEditorCamera} from './camera-controls.js';
import {historyShortcut} from './region-editing.js';
import {createGrassCollision} from './grass-collision.js';
const B=window.BABYLON,$=id=>document.getElementById(id),canvas=$('view');
const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}),scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.035,.055,.065,1);
const camera=new B.ArcRotateCamera('tile-editor',-.8,1,38,new B.Vector3(0,11,0),scene);camera.minZ=.05;camera.maxZ=500;camera.wheelDeltaPercentage=.015;attachEditorCamera(camera,canvas);canvas.addEventListener('contextmenu',e=>e.preventDefault());
const {sun}=createLighting(B,scene);sun.position.set(12,30,10);const shadows=new B.ShadowGenerator(2048,sun);shadows.usePercentageCloserFiltering=true;shadows.bias=.0001;shadows.normalBias=.015;
await loadPalette(B,scene);const palette=scene.metadata.palette,material=opaqueMaterial(B,scene,'tile-editor-models',null,{atlas:true}),ground=groundMaterial(B,scene,'tile-editor-ground');
const waterMaterial=new B.StandardMaterial('preview-water',scene);waterMaterial.diffuseColor=new B.Color3(.15,.56,.62);waterMaterial.alpha=.5;waterMaterial.backFaceCulling=false;
const terrainShapes=await (await fetch('editor/terrain-shapes.json')).json();
const loaded=await loadCompositionData();let data=loaded.config;const {library,authoring}=loaded;let assets=compositionModels(B,scene,library,authoring);
let current='building:2',selected='',history=[],future=[],dirty=false,preview=null,roots=new Map(),hidden=new Set(),mode='move',gizmoDrag=false,connectionHandles=new Map(),connectionNodes=[],selectedConnection='';
const manager=new B.GizmoManager(scene);manager.usePointerToAttachGizmos=false;manager.positionGizmoEnabled=true;manager.rotationGizmoEnabled=true;manager.scaleGizmoEnabled=true;
const config=()=>data.configs.find(c=>c.id===current),entry=()=>[...config().fixed,...config().scatter].find(e=>e.id===selected),isFixed=()=>config().fixed.some(e=>e.id===selected);
const status=(s,error=false)=>{$('status').textContent=s;$('status').style.color=error?'#ffab91':'';if(error)$('preview-count').textContent=s;};
const run=fn=>async(...args)=>{try{await fn(...args);}catch(e){status(e.message,true);console.error(e);}};
function remember(){history.push(JSON.stringify(data));if(history.length>50)history.shift();future=[];}
function changed(){dirty=true;status('Unsaved changes');$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function mutate(fn){remember();fn();changed();renderPanel();rebuild();}
function field(label,value,callback,{type='number',min,max,step=.1}={}){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type=type;input.value=value;input.setAttribute('aria-label',label);if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(type==='number')input.step=step;input.onchange=()=>{if(!input.reportValidity())return;callback(type==='number'?Number(input.value):input.value);};wrap.append(input);return wrap;}
function selector(label,options,value,callback){const wrap=document.createElement('label');wrap.textContent=label;const select=document.createElement('select');select.setAttribute('aria-label',label);if(!options.some(([id])=>id===value))select.add(new Option('Missing: '+(library.models.find(m=>m.id===value)?.name||value),value));for(const [id,name] of options)select.add(new Option(name,id));select.value=value;select.onchange=()=>callback(select.value);wrap.append(select);return wrap;}
function vector(label,key){const title=document.createElement('h3');title.textContent=label;const fields=document.createElement('div');fields.className='vector';for(let axis=0;axis<3;axis++)fields.append(field(label+' '+'XYZ'[axis],entry()[key][axis],v=>mutate(()=>entry()[key][axis]=v),{min:key==='scale'?.01:key==='rotation'?-3600:-100,max:key==='scale'?20:key==='rotation'?3600:100,step:key==='rotation'?5:.1}));return [title,fields];}
function pair(label,key,min,max,step=1){const title=document.createElement('h3');title.textContent=label;const fields=document.createElement('div');fields.className='pair';['Minimum','Maximum'].forEach((name,i)=>fields.append(field(label+' '+name,entry()[key][i],v=>mutate(()=>{entry()[key][i]=v;if(entry()[key][0]>entry()[key][1])entry()[key][1-i]=v;}),{min,max,step})));return [title,fields];}
function renderPanel(){
 let repairs=$('missing-models');if(!repairs){repairs=document.createElement('section');repairs.id='missing-models';$('config-title').after(repairs);}repairs.replaceChildren();
 for(const missing of missingCompositionModels(data,library)){
  const title=document.createElement('strong');title.textContent='Missing model: '+missing.name;
  const uses=document.createElement('p');uses.className='hint';uses.textContent=missing.uses.map(u=>(compositionTargets.find(t=>t[0]===u.config)?.[1]||u.config)+' / '+u.entry).join(', ');
  repairs.append(title,uses,selector('Replace '+missing.name+' everywhere',[['','Choose replacement…'],...library.models.filter(m=>m.active).map(m=>[m.id,m.name])],'',id=>{if(id)mutate(()=>replaceCompositionModel(data,missing.id,id));}));
 }
 
 let cropPanel=$('crop-settings');if(!cropPanel){cropPanel=document.createElement('section');cropPanel.id='crop-settings';$('connection-settings').before(cropPanel);}cropPanel.replaceChildren();
 if(config().crop){const h=document.createElement('h3');h.textContent='Crops';cropPanel.append(h);const c=config().crop;cropPanel.append(selector('Crop model',[['fiber','Rough fibers'],['tuber','Tubers'],['biomass','Biomass']],c.model,v=>mutate(()=>config().crop.model=v))); 
 for(const [key,label,min,max] of [['height','Height (m)',.1,3],['spacing','Plant spacing (m)',.25,2],['rowSpacing','Row spacing (m)',.5,4],['rowWidth','Row width (m)',.1,c.rowSpacing]])cropPanel.append(field(label,c[key],v=>mutate(()=>{config().crop[key]=v;config().crop.rowWidth=Math.min(config().crop.rowWidth,config().crop.rowSpacing);}),{min,max,step:.05}));
 const hex='#'+c.color.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');cropPanel.append(field('Crop color',hex,v=>mutate(()=>config().crop.color=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255)),{type:'color'}));
 }
 const connections=$('connection-settings');connections.replaceChildren();if(current==='building:2'||current==='building:4'){
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=Boolean(config().urbanConnections);check.onchange=()=>mutate(()=>{if(check.checked)config().urbanConnections=defaultUrbanConnection(library.models.find(m=>m.active).id);else delete config().urbanConnections;});label.append(check,' Connect neighboring urban tiles');connections.append(label);
  if(config().urbanConnections){
   const u={...defaultUrbanConnection(config().urbanConnections.model),...config().urbanConnections},change=(key,value)=>mutate(()=>config().urbanConnections={...u,[key]:value});
   const edit=document.createElement('button');edit.textContent=selected==='urban-connection'?'Editing connections':'Edit connection placement';edit.onclick=()=>{selected='urban-connection';$('neighbors').checked=true;$('neighbor-type').value='same';$('neighbor-height').value=0;renderPanel();rebuild();};connections.append(edit);
   if(selected==='urban-connection'){
    connections.append(selector('Connection model',library.models.filter(m=>m.active).map(m=>[m.id,m.name]),u.model,v=>mutate(()=>{config().urbanConnections={...u,model:v,appearance:''};})),selector('Connection appearance',[['','Model default'],...Object.entries(authoring.appearances).filter(([,a])=>(authoring.models[u.model]?.regions||[]).every(r=>a.colors[r.id])).map(([id,a])=>[id,a.name])],u.appearance,v=>change('appearance',v)),field('Count per shared edge',u.count,v=>change('count',v),{min:0,max:16,step:1}),field('Spacing along edge (m)',Number(u.spacing.toFixed(3)),v=>change('spacing',v),{min:0,max:30,step:.001}));
    const hint=document.createElement('p');hint.className='hint';hint.textContent='X: along edge · Y: up · Z: toward neighbor. Positions are relative to the shared-edge midpoint.';connections.append(hint);
    for(const [key,title,min,max,step] of [['position','Offset (m)',-100,100,.1],['rotation','Rotation (°)',-3600,3600,5],['rotationStep','Rotation per copy (°)',-3600,3600,5],['scale','Scale',.01,20,.05]]){const h=document.createElement('h3');h.textContent=title;const fields=document.createElement('div');fields.className='vector';for(let axis=0;axis<3;axis++)fields.append(field(title+' '+'XYZ'[axis],u[key][axis],v=>{const next=[...u[key]];next[axis]=v;change(key,next);},{min,max,step}));connections.append(h,fields);}
   }
  }
 }
 $('density-total').textContent='Total density: '+config().scatter.reduce((n,e)=>n+e.count[0],0)+'–'+config().scatter.reduce((n,e)=>n+e.count[1],0)+' scattered props per tile';
 $('config-title').textContent=compositionTargets.find(t=>t[0]===current)[1];
 for(const [key,list] of [['fixed','fixed-list'],['scatter','scatter-list']]){
  $(list).replaceChildren();for(const e of config()[key]){const displayName=key==='fixed'?e.name:(library.models.find(m=>m.id===e.models[0])?.name||e.models[0]);const row=document.createElement('div');row.className='entry'+(e.id===selected?' selected':'');row.tabIndex=0;row.setAttribute('aria-label',displayName);const name=document.createElement('span');name.textContent=displayName;const count=document.createElement('small');count.textContent=key==='fixed'?'fixed':e.count.join('–');const eye=document.createElement('button');eye.textContent=hidden.has(e.id)?'○':'◉';eye.title=hidden.has(e.id)?'Show in preview':'Hide in preview';eye.setAttribute('aria-label',eye.title+' '+displayName);eye.onclick=ev=>{ev.stopPropagation();if(hidden.has(e.id))hidden.delete(e.id);else hidden.add(e.id);renderPanel();rebuild();};row.append(name,count,eye);if(e.id===selected){const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label','Remove '+displayName);remove.onclick=ev=>{ev.stopPropagation();mutate(()=>{config()[key]=config()[key].filter(x=>x.id!==e.id);selected='';});};row.append(remove);}row.onclick=()=>{selected=e.id;renderPanel();attach();};row.onkeydown=ev=>{if(ev.target===row&&ev.key==='Enter')row.click();};$(list).append(row);}
 }
 const panel=$('entry-panel');panel.replaceChildren();const e=entry();if(!e){const p=document.createElement('p');p.className='hint';p.textContent=selected==='urban-connection'?'Connection placement is shown above.':'Add or select an object to edit its placement.';panel.append(p);return;}
 if(e.animation)panel.append(field('Sweep angle (°)',e.animation.degrees,v=>mutate(()=>entry().animation.degrees=v),{min:0,max:30,step:1}),field('Sweep period (seconds)',e.animation.period,v=>mutate(()=>entry().animation.period=v),{min:10,max:120,step:1}));
 if(isFixed())panel.append(field('Name',e.name,v=>mutate(()=>entry().name=v),{type:'text'}));
 const models=library.models.filter(m=>m.active).map(m=>[m.id,m.name]);
 const compatible=look=>(isFixed()?[e.model]:e.models).every(id=>(authoring.models[id]?.regions||[]).every(r=>look.colors[r.id]));
 if(isFixed())panel.append(selector('Model',models,e.model,v=>mutate(()=>{entry().model=v;entry().appearance='';})));
 else panel.append(selector('Prop model',models,e.models[0],v=>mutate(()=>{entry().models=[v];entry().name=library.models.find(m=>m.id===v).name;entry().appearance='';})));
 panel.append(selector('Appearance',[['','Model default'],...Object.entries(authoring.appearances).filter(([,a])=>compatible(a)).map(([id,a])=>[id,a.name])],e.appearance,v=>mutate(()=>entry().appearance=v)));
 if(isFixed()){const reserve=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=e.blockScatter!==false;check.onchange=()=>mutate(()=>entry().blockScatter=check.checked);reserve.append(check,document.createTextNode(' Keep scattered props clear'));panel.append(reserve);panel.append(...vector('Position (m)','position'),...vector('Rotation (°)','rotation'),...vector('Scale','scale'));const h=document.createElement('h3');h.textContent='Random rotation offset (°)';panel.append(h);for(let axis=0;axis<3;axis++){const fields=document.createElement('div');fields.className='pair';for(let bound=0;bound<2;bound++)fields.append(field('XYZ'[axis]+' '+['minimum','maximum'][bound],e.randomRotation?.[axis]?.[bound]??0,v=>mutate(()=>{entry().randomRotation??=[[0,0],[0,0],[0,0]];const range=entry().randomRotation[axis];range[bound]=v;if(range[0]>range[1])range[1-bound]=v;}),{min:-3600,max:3600,step:5}));panel.append(fields);}const duplicate=document.createElement('button');duplicate.textContent='Duplicate object';duplicate.onclick=()=>mutate(()=>{const copy=structuredClone(entry());copy.id=crypto.randomUUID();copy.name+=' copy';copy.position[0]+=1;config().fixed.push(copy);selected=copy.id;});panel.append(duplicate);}
 else{panel.append(...pair('Density (props per tile)','count',0,256),field('Minimum spacing (m)',e.spacing,v=>mutate(()=>entry().spacing=v),{min:0,max:30}),field('Boundary margin (m)',e.margin,v=>mutate(()=>entry().margin=v),{min:0,max:10}),...pair('Scale variation','scale',.01,20,.05),...pair('Yaw (°)','yaw',-3600,3600,5),selector('Placement area',[['whole','Whole tile'],['interior','Interior'],['border','Along edges'],['corners','Near corners']],e.area,v=>mutate(()=>entry().area=v)),selector('Surface',[['land','Dry land'],['water','Underwater'],['any','Either']],e.surface,v=>mutate(()=>entry().surface=v)));}
}
function highlight(){if(!preview)return;for(const mesh of preview.getChildMeshes()){mesh.renderOverlay=Boolean(selected&&mesh.metadata?.compositionEntry===selected);if(mesh.renderOverlay){mesh.overlayColor=new B.Color3(.35,.95,.88);mesh.overlayAlpha=.3;}}}
function attach(){highlight();const connection=connectionHandles.get(selectedConnection)||connectionHandles.values().next().value;manager.attachToNode(selected==='urban-connection'?connection||null:isFixed()?roots.get(selected)||null:null);manager.positionGizmoEnabled=mode==='move';manager.rotationGizmoEnabled=mode==='rotate';manager.scaleGizmoEnabled=mode==='scale';for(const m of ['move','rotate','scale'])$(m).setAttribute('aria-pressed',String(mode===m));}
for(const gizmo of Object.values(manager.gizmos)){if(!gizmo)continue;gizmo.onDragStartObservable?.add(()=>{gizmoDrag=true;remember();});gizmo.onDragEndObservable?.add(()=>{if(selected==='urban-connection'){updateConnectionDrag();changed();gizmoDrag=false;renderPanel();rebuild();return;}const e=entry(),node=roots.get(selected);if(e&&node){e.position=node.position.asArray().map(v=>Math.round(v*1000)/1000);if(mode==='rotate')e.rotation=(node.rotationQuaternion?.toEulerAngles()||node.rotation).asArray().map((v,axis)=>Math.round((v*180/Math.PI-(node.metadata?.rotationOffset?.[axis]||0))*100)/100);e.scale=node.scaling.asArray().map(v=>Math.max(.01,Math.min(20,v)));changed();}gizmoDrag=false;renderPanel();rebuild();});}
function updateConnectionDrag(){
 const handle=connectionHandles.get(selectedConnection)||connectionHandles.values().next().value;if(!handle||!config().urbanConnections)return;
 const value={...defaultUrbanConnection(config().urbanConnections.model),...config().urbanConnections};
 if(mode==='move')value.position=handle.position.asArray().map(v=>Math.max(-100,Math.min(100,Math.round(v*1000)/1000)));
 if(mode==='rotate')value.rotation=(handle.rotationQuaternion?.toEulerAngles()||handle.rotation).asArray().map(v=>Math.round(v*180/Math.PI*100)/100);
 if(mode==='scale')value.scale=handle.scaling.asArray().map(v=>Math.max(.01,Math.min(20,v)));
 config().urbanConnections=value;
 for(const {node,edge,copy} of connectionNodes){const object=urbanConnectionObjects(value,...edge)[copy];node.position.set(...object.position);node.rotationQuaternion=B.Quaternion.FromEulerAngles(...object.rotation.map(v=>v*Math.PI/180));node.scaling.set(...object.scale);}
 for(const other of connectionHandles.values())if(other!==handle){other.position.set(...value.position);other.rotationQuaternion=B.Quaternion.FromEulerAngles(...value.rotation.map(v=>v*Math.PI/180));other.scaling.set(...value.scale);}
}
scene.onBeforeRenderObservable.add(()=>{if(gizmoDrag&&selected==='urban-connection')updateConnectionDrag();});
function makeTile(x,z,height,neighbors=false){
 const root=new B.TransformNode('preview-tile',scene);root.parent=preview;root.position.set(x,10+height,z);
 const polygon=tilePolygon();
 if($('guide').checked){const points=polygon.map(([x,z])=>new B.Vector3(x,.015,z));points.push(points[0].clone());const line=B.MeshBuilder.CreateLines('tile-boundary',{points},scene);line.parent=root;line.color=neighbors?new B.Color3(.25,.4,.4):new B.Color3(.6,.85,.78);line.isPickable=false;}
 return root;
}
function rebuild(){
 if(gizmoDrag)return;manager.attachToNode(null);if(preview){for(const m of preview.getChildMeshes())shadows.removeShadowCaster(m);preview.dispose();}roots=new Map();connectionHandles=new Map();connectionNodes=[];preview=new B.TransformNode('composition-preview',scene);
 const tiles=[{x:0,z:0,height:0,seed:Number($('seed').value)>>>0,main:true}],water=$('water').checked;
 if($('neighbors').checked)for(let i=0;i<6;i++){const [x,z]=tileNeighborOffset(i);tiles.push({x,z,height:Number($('neighbor-height').value)*PREVIEW_HEIGHT_STEP,seed:(Number($('seed').value)^Math.imul(i+1,2654435761))>>>0,main:false});}
 for(const t of tiles)t.config=t.main||$('neighbor-type').value!=='empty'?availableComposition(config(),library):null;
 const geometry=previewTerrain(tiles,terrainShapes,palette.swatches.find(s=>s.id===(current==='biome:2'?'snow-surface':'land-surface')).rgb,palette.swatches.find(s=>s.id==='cliff').rgb);
 const terrain=new B.Mesh('preview-terrain',scene),vertexData=new B.VertexData();for(const key of ['positions','normals','colors','indices'])vertexData[key]=geometry[key];vertexData.applyToMesh(terrain);terrain.parent=preview;terrain.material=ground;terrain.receiveShadows=true;terrain.isPickable=false;shadows.addShadowCaster(terrain);
 const connections=previewUrbanConnections(tiles),collisionParts=[],grassTiles=[],parents=[];let count=0,missed=[];
 const recordCollision=node=>{for(const mesh of node.getChildMeshes()){mesh.computeWorldMatrix(true);const p=mesh.getVerticesData(B.VertexBuffer.PositionKind),positions=[];for(let i=0;i<p.length;i+=3)positions.push(...B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),mesh.getWorldMatrix()).asArray());collisionParts.push({positions,indices:Array.from(mesh.getIndices())});}};
 for(const t of tiles){
  const parent=makeTile(t.x,t.z,t.height,!t.main);parents.push(parent);grassTiles.push(t);
  if(!t.main&&$('neighbor-type').value==='empty')continue;
  if(config().crop){
   const polygon=tilePolygon(),connected=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length],mx=t.x+a[0]+b[0],mz=t.z+a[1]+b[1];return tiles.some(o=>o!==t&&o.config&&Math.hypot(o.x-mx,o.z-mz)<1);});
   const height=(x,z)=>{const ray=new B.Ray(new B.Vector3(t.x+x,100,t.z+z),new B.Vector3(0,-1,0));terrain.computeWorldMatrix(true);const hit=ray.intersectsMesh(terrain);return hit.hit?hit.pickedPoint.y-(10+t.height):0;};
   const layout=fieldLayout(t.seed,{polygon,connected,height});createCropGrass(B,scene,parent,config().crop,{seed:t.seed,layout});
  }
  const generated=generateComposition(availableComposition(config(),library),t.seed,{water,footprints:assets.footprints});if(t.main){count=generated.objects.length;missed=generated.missed;}
  for(const object of generated.objects){if(hidden.has(object.entry))continue;const node=assets.spawn(object,parent,material,shadows,1,{coast:Math.sqrt(3)*5,water:Number($('water-height').value)-t.height+.04/.075});if(t.main&&object.fixed){node.metadata={rotationOffset:object.rotationOffset};roots.set(object.id,node);}for(const mesh of node.getChildMeshes())mesh.metadata={...mesh.metadata,mainTile:t.main};recordCollision(node);}
 }
 for(const {owner,edge,copy,object} of connections){
  const key=owner+':'+edge.join(':'),value={...defaultUrbanConnection(config().urbanConnections.model),...config().urbanConnections};
  if(!connectionHandles.has(key)){
   const frame=new B.TransformNode('connection-edge-frame',scene);frame.parent=parents[owner];frame.position.set(edge[0],0,edge[1]);frame.rotationQuaternion=B.Quaternion.FromEulerAngles(0,Math.atan2(edge[0],edge[1]),0);
   const handle=new B.TransformNode('connection-placement-handle',scene);handle.parent=frame;handle.position.set(...value.position);handle.rotationQuaternion=B.Quaternion.FromEulerAngles(...value.rotation.map(v=>v*Math.PI/180));handle.scaling.set(...value.scale);connectionHandles.set(key,handle);
  }
  const node=assets.spawn(object,parents[owner],material,shadows);connectionNodes.push({node,edge,copy});for(const mesh of node.getChildMeshes())mesh.metadata={...mesh.metadata,mainTile:true,connectionHandle:key};recordCollision(node);
 }

 if(water){const waterMesh=B.MeshBuilder.CreateGround('water-preview',{width:$('neighbors').checked?58:22,height:$('neighbors').checked?58:22},scene);waterMesh.position.y=10+Number($('water-height').value);waterMesh.material=waterMaterial;waterMesh.parent=preview;waterMesh.isPickable=false;}
 if($('grass').checked&&!water&&current!=='biome:2')makeGrass(grassTiles,collisionParts);
 $('preview-count').textContent=count+' objects on center tile'+(connections.length?' · '+connections.length+' connection objects':'')+(missed.length?' · Space limited: '+missed.map(m=>m.placed+'/'+m.requested+' placed').join(', '):'');attach();
}
function makeGrass(tiles,objects){
 const collision=createGrassCollision(objects),positions=[],normals=[],indices=[],colors=[],color=palette.swatches.find(s=>s.id==='land-surface').rgb;let seed=7213;const rand=()=>{seed=Math.imul(seed^seed>>>13,1597334677);return (seed>>>0)/4294967296;};
 for(const t of tiles)for(let i=0;i<1100;i++){
  const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*8.5,x=t.x+Math.sin(angle)*r,z=t.z+Math.cos(angle)*r,y=10+t.height;if(collision.contains([x,y+.01,z]))continue;
  const variant=meadowVariant(rand());if(variant){const g=meadowGeometry(variant),unit=.3+rand()*.12,yaw=rand()*Math.PI*2,c=Math.cos(yaw),s=Math.sin(yaw);for(let t=0;t<g.indices.length;t+=3){const points=g.indices.slice(t,t+3).map(i=>{const [px,py,pz]=g.positions.slice(i*3,i*3+3);return [x+(px*c+pz*s)*unit,y+py*unit,z+(-px*s+pz*c)*unit];});if(collision.intersects(points))continue;points.forEach((p,j)=>{const index=g.indices[t+j];positions.push(...p);normals.push(0,1,0);colors.push(...g.colors.slice(index*4,index*4+3).map((v,k)=>v*(variant===1?color[k]:1)),1);indices.push(indices.length);});}continue;}
  for(let j=0;j<3;j++){const a=rand()*Math.PI*2,h=.2+rand()*.25,w=.025+rand()*.025,triangle=[[x-Math.cos(a)*w,y,z-Math.sin(a)*w],[x+Math.cos(a)*w,y,z+Math.sin(a)*w],[x+.07*Math.sin(a),y+h,z+.07*Math.cos(a)]];if(collision.intersects(triangle))continue;for(const p of triangle){positions.push(...p);normals.push(0,1,0);colors.push(...color.map(c=>Math.min(1,c*(p[1]>y?1.08:1))),1);indices.push(indices.length);}}
 }
 const mesh=new B.Mesh('preview-grass',scene),g=new B.VertexData();Object.assign(g,{positions,normals,indices,colors});g.applyToMesh(mesh);mesh.setVerticesData('modelAO',new Float32Array(positions.length/3).fill(1),false,1);mesh.parent=preview;mesh.material=ground;mesh.receiveShadows=true;mesh.isPickable=false;
}
for(const target of compositionTargets)$('config').add(new Option(target[1],target[0]));$('config').value=current;
$('config').onchange=()=>{current=$('config').value;selected='';hidden.clear();$('water').checked=current==='biome:0';renderPanel();rebuild();};

$('add-fixed').onclick=()=>mutate(()=>{const e=defaultFixed(library.models.find(m=>m.active).id);config().fixed.push(e);selected=e.id;});
$('add-scatter').onclick=()=>mutate(()=>{const e=defaultScatter(library.models.find(m=>m.active&&m.id.startsWith('tree'))?.id||library.models.find(m=>m.active).id);config().scatter.push(e);selected=e.id;});
for(const id of ['seed','neighbors','grass','guide','water','neighbor-type','neighbor-height','water-height'])$(id).onchange=()=>{if($(id).reportValidity())rebuild();};
$('reroll').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];rebuild();};
$('frame').onclick=()=>{camera.setTarget(new B.Vector3(0,11,0));camera.radius=($('neighbors').checked?70:38)/Math.min(1,canvas.clientWidth/canvas.clientHeight);};
for(const m of ['move','rotate','scale'])$(m).onclick=()=>{mode=m;attach();};
scene.onPointerObservable.add(info=>{if(info.type!==B.PointerEventTypes.POINTERPICK||gizmoDrag)return;const hit=info.pickInfo;if(hit?.pickedMesh?.metadata?.mainTile){selected=hit.pickedMesh.metadata.compositionEntry;if(hit.pickedMesh.metadata.connectionHandle)selectedConnection=hit.pickedMesh.metadata.connectionHandle;renderPanel();attach();}});
async function save(){
 const responseLibrary=await fetch('/api/models',{cache:'no-store'});if(!responseLibrary.ok)throw Error('Cannot refresh model library');Object.assign(library,await responseLibrary.json());
 const responseAuthoring=await fetch('models/authoring.json',{cache:'no-store'});if(!responseAuthoring.ok)throw Error('Cannot refresh model appearances');Object.assign(authoring,await responseAuthoring.json());
 assets=compositionModels(B,scene,library,authoring);renderPanel();rebuild();
 validateCompositions(data,library,authoring);const response=await fetch('/api/tile-compositions',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error||'Save failed');dirty=false;status('Saved · reload game to apply');}
$('save').onclick=run(save);
function undo(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(JSON.stringify(data));data=JSON.parse(from.pop());changed();renderPanel();rebuild();}
$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){e.preventDefault();run(save)();return;}if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const command=historyShortcut(e);if(command){e.preventDefault();undo(command==='redo');}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const border=$('panel-border');let dragging=false;const panelWidth=value=>{document.body.style.setProperty('--panel-width',Math.max(260,Math.min(innerWidth*.6,value))+'px');engine.resize();};border.onpointerdown=e=>{dragging=true;border.setPointerCapture(e.pointerId);};border.onpointermove=e=>{if(dragging)panelWidth(innerWidth-e.clientX);};border.onpointerup=()=>dragging=false;border.onpointercancel=()=>dragging=false;border.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();panelWidth($('inspector').getBoundingClientRect().width+(e.key==='ArrowLeft'?20:-20));}};
window.addEventListener('resize',()=>engine.resize());renderPanel();rebuild();status('Ready');engine.runRenderLoop(()=>{camera.minZ=Math.max(.02,Math.min(.2,camera.radius*.002));scene.render();});
