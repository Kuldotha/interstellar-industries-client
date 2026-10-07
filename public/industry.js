import {createStorageOverview} from './storage-overview.js';
import {agriculturalKind,projectFieldPolygon} from './field-layout.js';
import {createOptimisticActions} from './optimistic-actions.js';
import {restoreInventory} from './industry-inventory.js';
import { tilesInRange, coveringUtilities, createUtilityOverlay } from './utility-coverage.js';
import { housingUpgradeReadiness } from './housing-upgrade.js';
import { buildingDefinitions,resourceNames } from './building-definitions.js';
import { urbanLinks, urbanConnectionOwner, urbanEdgeMidpoint } from './urban-connections.js';
import { mergeHousingParts } from './housing-cluster.js';
import { createBuildMenu } from './build-menu.js?quest-art=1';
import { subdivideBuildingGeometry, enableBuildingWrap, updateBuildingBounds } from './building-wrap.js';
import { createSimulationClock } from './simulation-clock.js';
import { createBuildingStatuses, buildingStatus, statusLabels } from './building-status.js';
const names=buildingDefinitions.map(building=>building.name);
const errors=['','Invalid tile.','This tile is occupied.','Needs dry land.','Needs a stone deposit.','Not enough concrete.','Needs an adjacent water tile.','This side cannot face the building.','Housing cannot be paused.','Reach the required population to unlock this building.','Needs an adjacent farm with room for fields.'];
export async function createIndustry(B,scene,shadows,core,selection,underwater,onOccupied,onGroundCover,onWaterlineChange=()=>{},chain=null,compositions=null) {
  const shadowRegistry=shadows,underwaterRegistry=underwater;
  const ui=document.getElementById('industry-actions'),stock=document.getElementById('planet-stock');
  stock.innerHTML='<span class="stock-item" title="Concrete · construction material"><img src="icons/concrete.svg" alt="Concrete"><strong id="concrete-stock">0</strong></span><details id="economy-overview"><summary aria-label="Open colony overview">Colony <span id="population-stock"></span></summary><div id="economy-details"></div></details>';
  const storageOverview=createStorageOverview(core,stock);
  let tile=null,centers=[],corners=[],neighbors=[],resolution=8,heightStep=.035,saveKey='',models=new Map(),ready=false,coverageKey='',listKey='',interactionUntil=0,pendingUi=false,pendingSave=false,lastUi=0,lastSave=0;
  const refund=id=>{const s=state();return core.industry_refund(id)+s.buildings.filter(b=>b[1]>=12&&core.industry_field_parent(b[0])===id).reduce((sum,b)=>sum+core.industry_refund(b[0]),0);};
  const drafts=new Map(),sides=(id,kind,parent=null)=>id===null?[]:Array.from({length:6},(_,i)=>i).filter(i=>(core.industry_valid_sides(id,kind)&(1<<i))&&(parent===null||neighbors[id*6+i]===parent));
  const direction=(id,side)=>{const up=B.Vector3.FromArray(centers.slice(id*3,id*3+3)).normalize(),other=B.Vector3.FromArray(centers.slice(neighbors[id*6+side]*3,neighbors[id*6+side]*3+3)).normalize();return other.subtract(up.scale(B.Vector3.Dot(other,up))).normalize();};
  let ghost=null,ghostKey='';
  const ghostMaterials=[false,true].map(invalid=>{
    const material=new B.StandardMaterial('placement-'+invalid,scene);
    material.diffuseColor=material.emissiveColor=new B.Color3(...(invalid?[.95,.24,.20]:[.42,.87,.78]));
    material.alpha=.48;material.specularColor=B.Color3.Black();material.disableLighting=true;
    enableBuildingWrap(B,material,scene);return material;
  });
  function showGhost(id,kind,side,invalid=false){
    const key=[id,kind,side,invalid].join(':');if(key===ghostKey)return;
    ghostKey=key;ghost?.dispose();ghost=null;
    if(id===null||kind===undefined||!ready)return;
    if(neighbors[id*6+side]>=centers.length/3)side=sides(id,2)[0]??0;
    const b=[id,kind,0,0,0,0,side],byTile=new Map(state().buildings.map(b=>[b[0],b]));byTile.set(id,b);
    ghost=createModel(b,urbanLinks(id,byTile,neighbors,centers),byTile,ghostMaterials[Number(invalid)]).root;
    for(const mesh of ghost.getChildMeshes()){mesh.receiveShadows=false;mesh.isPickable=false;}
  }
  let toolMeshes=[],toolTargetKey='';
  function showToolTarget(id,mode){
    const root=id===null?null:models.get(id)?.root;
    const key=[id,mode,root?.uniqueId].join(':');if(key===toolTargetKey)return;
    toolTargetKey=key;
    for(const mesh of toolMeshes)mesh.renderOverlay=false;
    toolMeshes=[];
    if(!root)return;
    const color=new B.Color3(...(mode==='demolish'?[1,.28,.16]:mode==='upgrade'?[1,.8,.25]:[.4,1,.85]));
    for(const mesh of root.getChildMeshes()){mesh.renderOverlay=true;mesh.overlayColor=color;mesh.overlayAlpha=.6;toolMeshes.push(mesh);}
  }
  const utilityOverlay=createUtilityOverlay(B,scene,selection);
  const providerOutline=new B.HighlightLayer('utility-outlines',scene,{isStroke:true,mainTextureRatio:1,blurHorizontalSize:1,blurVerticalSize:1});
  providerOutline.innerGlow=false;
  providerOutline.isEnabled=false;
  const providerMask=new B.StandardMaterial('utility-outline-mask',scene);
  providerMask.disableLighting=true;
  providerMask.emissiveColor=new B.Color3(.4,1,.78);
  enableBuildingWrap(B,providerMask,scene);
  let highlightedProviders=[];
  function outlineProvider(id){
    for(const mesh of models.get(id)?.root.getChildMeshes()||[]){
      if(!mesh.isVerticesDataPresent('buildingCenter'))continue;
      providerOutline.setMaterialForRendering(mesh,providerMask);
      providerOutline.addMesh(mesh,providerMask.emissiveColor);
      highlightedProviders.push(mesh);
    }
    providerOutline.isEnabled=highlightedProviders.length>0;
  }
  function showCoverage(id,kind=4,placing=false,parent=null){
    const buildings=ready?state().buildings:[],providers=id===null?[]:kind===2?coveringUtilities(id,buildings,neighbors):[];
    const key=JSON.stringify([id,kind,placing,parent,buildings.filter(b=>b[1]===2||buildingDefinitions[b[1]]?.utility).map(b=>[b[0],b[1],b[2]])]);
    const message=kind===2&&id!==null?(providers.length?'Utilities ✓ · '+providers.length+' in range':'No utilities in range'):'';
    if(coverageKey===key)return message;
    coverageKey=key;
    for(const mesh of highlightedProviders)providerOutline.setMaterialForRendering(mesh,undefined);
    providerOutline.removeAllMeshes();
    providerOutline.isEnabled=false;
    highlightedProviders=[];
    utilityOverlay.clear();
    if(id===null)return message;
    const tiles=buildingDefinitions[kind]?.utility?tilesInRange(id,neighbors):parent!==null?new Set(Array.from(neighbors.slice(parent*6,parent*6+6)).filter(n=>n<centers.length/3&&!core.industry_validate(n,kind))):new Set();
    if(parent!==null)outlineProvider(parent);
    for(const provider of providers)outlineProvider(provider[0]);
    if(buildingDefinitions[kind]?.utility)for(const house of buildings)if(house[1]===2&&tiles.has(house[0]))outlineProvider(house[0]);
    const highlighted=kind===2?new Set(providers.map(b=>b[0])):new Set();
    utilityOverlay.show(tiles,highlighted,centers,corners,resolution,1+.65*heightStep);
    return message;
  }
  ui.addEventListener('pointerdown',()=>{interactionUntil=performance.now()+350;});
  ui.addEventListener('focusout',()=>setTimeout(()=>render(),0));
  const statuses=createBuildingStatuses(B,scene);
  const clock=createSimulationClock(ticks=>{if(!ready)return;core.industry_advance(ticks);pendingUi=true;pendingSave=true;},performance.now());
  const timeControls=document.getElementById('time-controls');
  const showRate=()=>{for(const button of timeControls.querySelectorAll('[data-speed]'))button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===clock.getRate()));};
  for(const button of timeControls.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{clock.setRate(Number(button.dataset.speed),performance.now());showRate();});
  document.getElementById('step-minute').addEventListener('click',()=>{clock.step(60,performance.now());save();render();});
  showRate();
  const state=()=>{const pointer=core.industry_buildings_ptr();return {pool:Array.from(new Uint32Array(core.memory.buffer,core.industry_pool_ptr(),8)),buildings:Array.from({length:core.industry_count()},(_,i)=>Array.from(new Uint32Array(core.memory.buffer,pointer+i*44,11))),tutorial:core.industry_tutorial(),tick:core.industry_tick()};};
  function save(){if(chain){pendingSave=false;localStorage.setItem(saveKey,JSON.stringify({storySeen,storyVersion:2}));document.getElementById('save-status').textContent='Connected · Devnet Europe';return;}pendingSave=false;lastSave=performance.now();try{localStorage.setItem(saveKey,JSON.stringify({version:15,stocks:Array.from(new BigUint64Array(core.memory.buffer,core.industry_stock_ptr(),8),String),flow:Array.from({length:8},(_,i)=>i).map(r=>[core.industry_carry(r),core.industry_made(r)]),storySeen,peakPopulation:core.industry_peak_population(),produced:[0,1,2].map(r=>core.industry_produced(r)),tier:Array.from(new BigUint64Array(core.memory.buffer,core.industry_tier_ptr(),5),Number),paidCosts:Object.fromEntries(state().buildings.map(b=>[b[0],core.industry_refund(b[0])])),...state(),buildings:state().buildings.map(b=>b.slice(0,7))}));document.getElementById('save-status').textContent='Local prototype · saved';}catch{document.getElementById('save-status').textContent='Save unavailable';}}
  function createModel(b,links,byTile,ghostMaterial=null){
    const shadows=ghostMaterial?{addShadowCaster(){},removeShadowCaster(){}}:shadowRegistry;
    const underwater=ghostMaterial?{renderList:[]}:underwaterRegistry;
      const [id,kind]=b;let patches=[];
      const root=new B.TransformNode('building-'+id,scene),up=B.Vector3.FromArray(centers.slice(id*3,id*3+3)).normalize();
      root.position=B.Vector3.FromArray(centers.slice(id*3,id*3+3));
      const forward=direction(id,b[6]),right=B.Vector3.Cross(up,forward).normalize();
      const basis=B.Matrix.Identity();B.Matrix.FromXYZAxesToRef(right,up,forward,basis);root.rotationQuaternion=B.Quaternion.FromRotationMatrix(basis);root.scaling.setAll(1/resolution);
      const neighbor=B.Vector3.FromArray(centers.slice(neighbors[id*6+b[6]]*3,neighbors[id*6+b[6]]*3+3));
      const shoreline={coast:B.Vector3.Distance(up,neighbor.normalize())*resolution/(2*.075),water:((1+.65*heightStep-root.position.length())*resolution+.04)/.075};
      const polygon=projectFieldPolygon(root.position.asArray(),right.asArray(),forward.asArray(),corners.slice(id*18,id*18+18),.075/resolution);
      const adjacent=Array.from(neighbors.slice(id*6,id*6+6)).filter(n=>n<centers.length/3&&n!==id);
      const connected=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;let nearest=null,best=-Infinity;for(const n of adjacent){const d=B.Vector3.FromArray(centers,n*3).subtract(root.position),nx=B.Vector3.Dot(d,right),nz=B.Vector3.Dot(d,forward),score=(x*nx+z*nz)/Math.hypot(nx,nz);if(score>best){best=score;nearest=n;}}return agriculturalKind(byTile.get(nearest)?.[1]);});
      const composition=compositions?.building(kind,id,root,ghostMaterial,shadows,underwater,shoreline,{polygon,connected});
      if(composition)patches.push(...composition.patches);
      if(composition?.urbanConnections)for(const other of links){if(urbanConnectionOwner(id,other,byTile)!==id)continue;const edge=urbanEdgeMidpoint(B,id,other,centers,right,forward,1/resolution);patches.push(...compositions.connection(composition.urbanConnections,root,edge.x,edge.z,ghostMaterial,shadows,underwater));}
      mergeHousingParts(B,root,scene,shadows,underwater);
      for(const mesh of root.getChildMeshes()){
        if(mesh.metadata?.cropGrass)continue;
        const geometry=subdivideBuildingGeometry({positions:mesh.getVerticesData(B.VertexBuffer.PositionKind),normals:mesh.getVerticesData(B.VertexBuffer.NormalKind),uvs:mesh.getVerticesData(B.VertexBuffer.UVKind),uvs2:mesh.getVerticesData(B.VertexBuffer.UV2Kind),ao:mesh.getVerticesData('modelAO'),indices:mesh.getIndices()},root.position.length(),1/resolution);
        const data=new B.VertexData();Object.assign(data,geometry);data.applyToMesh(mesh);if(geometry.ao)mesh.setVerticesData('modelAO',geometry.ao,false,1);
        const anchors=new Float32Array(geometry.positions.length);
        for(let i=0;i<anchors.length;i+=3){anchors[i]=root.position.x;anchors[i+1]=root.position.y;anchors[i+2]=root.position.z;}
        mesh.setVerticesData('buildingCenter',anchors,false,3);mesh.refreshBoundingInfo();
        updateBuildingBounds(B,mesh,root.position);
      }

    return {root,patches,coverFrame:{id,center:root.position.asArray(),right:right.asArray(),forward:forward.asArray(),scale:1/resolution}};
  }
  function visuals(force=false){
    coverageKey='';
    const buildings=state().buildings,byTile=new Map(buildings.map(b=>[b[0],b])),live=new Set(byTile.keys());
    const links=new Map(buildings.map(b=>[b[0],agriculturalKind(b[1])?Array.from(neighbors.slice(b[0]*6,b[0]*6+6)).filter(n=>agriculturalKind(byTile.get(n)?.[1])):buildingDefinitions[b[1]]?.urban?urbanLinks(b[0],byTile,neighbors,centers):[]]));
    let groundChanged=force;
    for(const [id,entry] of models){
      const b=byTile.get(id);
      if(!force && live.has(id) && entry.kind===b[1] && entry.side===b[6] && entry.links===(links.get(id)||[]).join(','))continue;
      groundChanged=true;
      const children=new Set(entry.root.getChildMeshes());
      for(const mesh of children)shadows.removeShadowCaster(mesh);
      underwater.renderList=underwater.renderList.filter(mesh=>!children.has(mesh));entry.root.dispose();models.delete(id);
    }
    onOccupied(live);
    for(const b of buildings){
      if(models.has(b[0]))continue;
      const [id,kind]=b,{root,patches,coverFrame}=createModel(b,links.get(b[0])||[],byTile);
      groundChanged=true;
      models.set(id,{root,kind,patches,coverFrame,side:b[6],links:(links.get(id)||[]).join(',')});
    }
    if(groundChanged)onWaterlineChange();
    if(groundChanged)onGroundCover([...models.values()].filter(e=>e.patches.length).map(e=>({...e.coverFrame,patches:e.patches})));
  }
  let observedQuestStage=null,storySeen=-1;
  function render(){
    if(!ready)return;
    const questStage=core.industry_tutorial();
    const questCompleted=observedQuestStage!==null && questStage>observedQuestStage;
    observedQuestStage=questStage;
    if(questCompleted){menu.reset();selection.select(null);tile=null;interactionUntil=0;}
    pendingUi=false;lastUi=performance.now();
    const elapsed=core.industry_tick(),hours=Math.floor(elapsed/3600),minutes=Math.floor(elapsed/60)%60,seconds=elapsed%60;
    document.getElementById('simulation-time').textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    menu.refresh();const s=state();
    if(!menu.isPlacing()){const selected=s.buildings.find(b=>b[0]===tile);showCoverage(selected&&(selected[1]===2||buildingDefinitions[selected[1]]?.utility)?tile:null,selected?.[1]);}document.getElementById('concrete-stock').textContent=s.pool[1].toLocaleString();
    document.getElementById('population-stock').textContent=core.industry_population();
    storageOverview.update();
    document.getElementById('economy-details').innerHTML=`<div class="stat-row"><span>Power supplied</span><b>${(core.industry_power()/16777216).toFixed(1)}</b></div><h3>Workforce</h3><div class="stat-row"><span>Residents available</span><b>${core.industry_population()}</b></div><div class="stat-row"><span>Workers needed</span><b>${core.industry_workers()}</b></div>`;

    statuses.sync(s.buildings,centers,resolution,id=>core.industry_assigned_workers(id));
    const nextListKey=JSON.stringify(s.buildings.map(b=>[b[0],b[1],buildingStatus(b,core.industry_assigned_workers(b[0]))]));
    if(nextListKey!==listKey){
      listKey=nextListKey;const list=document.getElementById('planet-buildings');list.replaceChildren();
      for(const b of s.buildings){const button=document.createElement('button'),status=buildingStatus(b,core.industry_assigned_workers(b[0]));button.textContent=`${names[b[1]]} · ${b[0]}${status?' · '+statusLabels[status]:''}`;button.addEventListener('click',()=>selection.select(b[0]));list.append(button);}
    }
    if(performance.now()<interactionUntil || ui.contains(document.activeElement) && document.activeElement.tagName==='SELECT')return;
    ui.replaceChildren();if(tile===null)return;
    const building=s.buildings.find(b=>b[0]===tile);
    const text=document.createElement('p');ui.append(text);
    const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.addEventListener('click',action);ui.append(b);return b;};
    const act=(fn,geometry=true)=>{clock.update(performance.now());const result=fn();if(result){document.getElementById('industry-message').textContent=errors[result];return;}document.getElementById('industry-message').textContent='';if(geometry)visuals();save();interactionUntil=0;document.activeElement?.blur();render();};
    if(building){
      const title=document.getElementById('selection-title'),icon=document.createElement('img');
      icon.src='icons/'+buildingDefinitions[building[1]].buildingIcon;icon.alt='';icon.className='building-title-icon';
      title.replaceChildren(icon,document.createTextNode(names[building[1]]));
      const kind=building[1],workers=core.industry_assigned_workers(tile);
      if(kind===2){
        const capacity=core.industry_tier_capacity(),residents=core.industry_population();
        text.className='residence-total';text.innerHTML=`<strong>${residents}<small>/ ${capacity}</small></strong><span>Colonists · ${residents<capacity?'Growing':residents>capacity?'Declining':'Settled'}</span>`;
        const happiness=core.industry_happiness(tile),fishLocked=!core.industry_unlocked(3);
        const mood=happiness===50?'Neutral':happiness===100?'Overjoyed':happiness===0?'Hostile':happiness>50?'Happy':'Unhappy';
        const needRow=(name,icon,value,residents,bonus,locked=false)=>{
          const percent=Math.round(value/60*100),label=value===60?'Fulfilled':value===0?(locked?'Locked':'Unfulfilled'):'Partially fulfilled';
          return `<div class="need-detail"><div class="need-row ${value===60?'met':'unmet'}"><img src="icons/${icon}" alt=""><span>${name}<small>${label}</small></span><b>${residents?`+${residents} residents`:``}<small>${bonus?`+${bonus} happiness`:``}</small></b></div><div class="need-bar" role="meter" aria-label="${name} fulfillment" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div></div>`;
        };
        const info=document.createElement('div');info.innerHTML=`<div class="stat-row"><span>Happiness · ${mood}</span><b>${happiness}%</b></div><div class="happiness-bar" role="meter" aria-label="Happiness" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${happiness}" aria-valuetext="${happiness}% · ${mood}"><i style="width:${happiness}%"></i></div><div class="happiness-scale"><span>Hostile</span><span>Neutral</span><span>Overjoyed</span></div><div class="stat-row"><span>Colonist workforce</span><b>${residents}</b></div><h3>Population needs</h3>${needRow('Commons','commons.svg',core.industry_need(tile,0),5,10,!core.industry_unlocked(4))}${needRow('Fish','fish.svg',core.industry_need(tile,1),3,20,fishLocked)}${needRow('Worker clothes','clothes.svg',core.industry_need(tile,2),5,0,!core.industry_unlocked(6))}${needRow('Beer','beer.svg',core.industry_need(tile,3),0,15,!core.industry_unlocked(8))}${needRow('Radio','radio.svg',core.industry_need(tile,4),0,10,!core.industry_unlocked(11))}${fishLocked?'<small class="need-note">Fish unlocks at 4 residents.</small>':''}`;ui.append(info);
      }else if(buildingDefinitions[kind].utility){
        const served=s.buildings.filter(b=>b[1]===2 && core.industry_covered(b[0])).length;
        text.className='production-state';text.textContent=building[2]?'Paused':kind===11?(core.industry_productivity(kind)+'% broadcast coverage'):'Serving nearby homes';
        const need=document.createElement('p');need.innerHTML=`<div class="stat-row"><span>Service range</span><b>2 tiles</b></div><div class="stat-row"><span>Workers required</span><b>None</b></div><h3>Household benefits</h3><div class="stat-row"><span>Resident capacity</span><b>${kind===4?'+5':'—'}</b></div><div class="stat-row"><span>Happiness</span><b>+10</b></div><small>${kind===11?'Requires 1 power.':served+' homes served.'} Benefits do not stack.</small>`;ui.append(need);
        button(building[2]?'Resume':'Pause',()=>chain?onlineAction('pause',tile,!building[2]):act(()=>core.industry_pause(tile),false));
      }else if(buildingDefinitions[kind].farm!==undefined){
        text.textContent='Cultivated field';const parent=core.industry_field_parent(tile);
        button('Select farm',()=>selection.select(parent));
      }else{
        if(buildingDefinitions[kind].field!==undefined){
          const fields=core.industry_fields(tile),row=document.createElement('p');row.textContent=fields+' / 3 fields';ui.append(row);
          const farm=tile;button('Add fields',()=>menu.place(buildingDefinitions[kind].field,undefined,farm),fields>=3);
        }
        if(buildingDefinitions[kind].powerBoost){const row=document.createElement('p');row.textContent='Power · '+(50+core.industry_factory_power()/2).toFixed(0)+'% capacity';ui.append(row);}
        const condition=buildingStatus(building,workers),output=buildingDefinitions[kind].output,productivity=condition?0:core.industry_productivity(kind),cycle=productivity;
        text.className='production-state';text.textContent=statusLabels[condition]||'Producing';
        const production=document.createElement('div');production.className='production-overview';
        production.innerHTML=`<div class="recipe-row">${buildingDefinitions[kind].input?`<span class="recipe-good"><img src="icons/${buildingDefinitions[kind].input}.svg" alt="${buildingDefinitions[kind].input}"><span>${kind===10?'0.1':'1'}</span></span><span class="recipe-arrow">→</span>`:''}<span class="recipe-good"><img src="icons/${buildingDefinitions[kind].icon}" alt="${output}"><span>1</span></span></div><div class="productivity-dial ${condition?'stopped':''}" role="progressbar" aria-label="Productivity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(cycle)}" aria-valuetext="${productivity}% productivity"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="dial-track" cx="60" cy="60" r="52"/><circle class="dial-progress" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${cycle} 100"/></svg><div><strong>${productivity}%</strong><span>Productivity</span></div></div><div class="stat-row"><span>Workers</span><b>${building[2]?0:(core.industry_worker_cost(kind)*Math.min(1,core.industry_population()/Math.max(1,core.industry_workers()))).toFixed(1)} / ${core.industry_worker_cost(kind)}</b></div><div class="stat-row"><span>${kind===10?'Power output':'Output / min'}</span><b>${(productivity/(kind===10?10:100)).toFixed(1)}</b></div>`;
        ui.append(production);
        button(building[2]?'Resume':'Pause',()=>chain?onlineAction('pause',tile,!building[2]):act(()=>core.industry_pause(tile),false));
      }
      button(`Demolish · Refund ${refund(tile)} concrete`,()=>chain?onlineAction('demolish',tile):act(()=>{core.industry_remove(tile);showCoverage(null);return 0;})).classList.add('demolish');
    }else{
      text.textContent='Choose Housing, Commons, Fish or Concrete from the build menu to start placing buildings.';
    }
  }

  selection.onSelect(value=>{if(value!==null)menu.reset();interactionUntil=0;document.activeElement?.blur();tile=value;const b=ready?state().buildings.find(b=>b[0]===tile):null;showCoverage(b&&(b[1]===4||b[1]===2)?tile:null,b?.[1]);render();});
  const menu=createBuildMenu({selection,showToolTarget,cost:kind=>core.industry_build_cost(kind),refund,unlocked:kind=>Boolean(core.industry_unlocked(kind)),unlockPopulation:kind=>core.industry_unlock_population(kind),acknowledgeStory:(key,stage)=>{if(ready&&key===saveKey){storySeen=Math.max(storySeen,stage);save();}},tutorial:()=>({storyKey:ready?saveKey:null,storySeen,stage:core.industry_tutorial(),fiberFields:state().buildings.filter(b=>b[1]===12).length,tuberFields:state().buildings.filter(b=>b[1]===13).length,biomassFields:state().buildings.filter(b=>b[1]===14).length,generators:state().buildings.filter(b=>b[1]===10&&!b[2]).length,clothes:Number(state().buildings.some(b=>b[1]===2&&core.industry_need(b[0],2)===60)),beer:Number(state().buildings.some(b=>b[1]===2&&core.industry_need(b[0],3)===60)),radio:Number(state().buildings.some(b=>b[1]===2&&core.industry_need(b[0],4)===60)),ready:Number(state().buildings.some(b=>b[1]===2&&b[7]>=15&&[0,1,2,3,4].every(n=>core.industry_need(b[0],n)===60))),population:core.industry_population(),produced:[0,1,2].map(r=>core.industry_produced(r)),quarries:state().buildings.filter(b=>b[1]===0).length,factories:state().buildings.filter(b=>b[1]===1).length,fed:state().buildings.filter(b=>b[1]===2&&core.industry_need(b[0],1)===60).length,homes:state().buildings.filter(b=>b[1]===2).length,covered:state().buildings.filter(b=>b[1]===2&&core.industry_need(b[0],0)===60).length}),showCoverage,buildingAt:id=>state().buildings.find(b=>b[0]===id),demolish:id=>{
    if(chain){onlineAction('demolish',id);return;}
    clock.update(performance.now());core.industry_remove(id);showCoverage(null);visuals();save();render();
  },upgradeInfo:id=>{
    const b=state().buildings.find(b=>b[0]===id);
    return {allowed:false,...housingUpgradeReadiness(b,id!==null&&core.industry_need(id,0)===60,id!==null&&core.industry_need(id,1)===60,[2,3,4].map(n=>id!==null&&core.industry_need(id,n)===60))};
  },upgrade:()=>{},validate:(id,kind)=>ready?core.industry_validate(id,kind):1,sides,showGhost,errors,build:(id,kind,side)=>{
    if(chain)return onlineAction('build',id,kind,side);
    clock.update(performance.now());const error=core.industry_build_facing(id,kind,side);document.getElementById('industry-message').textContent=error?errors[error]:'';
    if(!error){visuals();save();render();}return error;
  }});
  function loadSnapshot(snapshot){
    core.industry_reset();core.industry_begin_restore();core.industry_restore_pool(0,10000,0);
    for(const b of [...snapshot.buildings].sort((a,b)=>Number(a.kind>=12)-Number(b.kind>=12))){
      const error=core.industry_build_facing(b.tile,b.kind,b.facing);if(error)throw Error('Planet terrain and building state disagree: '+b.tile+' ('+error+')');
      core.industry_restore_cost(b.tile,b.paid);if(b.paused)core.industry_pause(b.tile);
    }
    snapshot.stocks.forEach((amount,r)=>core.industry_restore_stock(r,Number(amount&0xffffffffn),Number(amount>>32n)));
    snapshot.carry.forEach((carry,r)=>core.industry_restore_flow(r,carry,0));
    core.industry_restore_extra_needs(Number(snapshot.clothesFulfillment??0n),Number(snapshot.beerFulfillment??0n));
    if(core.industry_restore_tier(Number(snapshot.population),Number(snapshot.foodFulfillment),Number(snapshot.growth)))throw Error('Invalid population state');
    core.industry_restore_progression(Number(snapshot.peakPopulation),Number(snapshot.phase),0,0,0);
    core.industry_refresh();core.industry_advance(Math.max(0,Math.min(3600,Math.floor(Date.now()/1000)-Number(snapshot.tick))));clock.reset(performance.now());pendingUi=true;pendingSave=false;
  }
  const online=chain?createOptimisticActions({
    initial:chain.current,
    apply({action,args}){
      clock.update(performance.now());
      if(action==='build')return core.industry_build_facing(...args);
      const building=state().buildings.find(b=>b[0]===args[0]);
      if(!building)return 1;
      if(action==='demolish'){core.industry_remove(args[0]);return 0;}
      return Boolean(building[2])===Boolean(args[1])?0:core.industry_pause(args[0]);
    },
    restore:loadSnapshot,
    send:({action,args})=>chain.action(action,...args),
    refresh:()=>chain.refresh(),
    changed(){visuals();render();},
    status(error,count){document.getElementById('industry-message').textContent=error?error.message:count?'Saving '+count+' action'+(count===1?'':'s')+'…':'';}
  }):null;
  function onlineAction(action,...args){
    const error=online.enqueue(action,...args);
    if(error)document.getElementById('industry-message').textContent=errors[error]||'Action unavailable';
    return error;
  }
  function rebuild(n,height){
    observedQuestStage=null;storySeen=-1;ready=false;
    menu.reset();showGhost(null);showCoverage(null);ready=false;resolution=n;heightStep=height;centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),core.tile_count()*3).slice();neighbors=new Uint32Array(core.memory.buffer,core.tile_neighbors_ptr(),core.tile_count()*6).slice();corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),core.tile_count()*18).slice();drafts.clear();
    saveKey=`interstellar-blue-1701-gen${core.planet_generator_version()}-industry-v1-${n}-${height}`;core.industry_reset();
    if(chain){
      saveKey='interstellar-story-'+chain.owner;
      try{const saved=JSON.parse(localStorage.getItem(saveKey)||'null');storySeen=saved?.storyVersion===2?saved.storySeen:Math.min(4,saved?.storySeen??-1);}catch{storySeen=-1;}
      loadSnapshot(chain.current);ready=true;tile=selection.getSelected();visuals(true);render();save();return;
    }
    try{
      const saved=JSON.parse(localStorage.getItem(saveKey)||'null');
      if(saved){
        storySeen=Number.isInteger(saved.storySeen)?Math.max(-1,Math.min(11,saved.version<12?(saved.storySeen>=4?saved.storySeen-1:Math.min(2,saved.storySeen)):saved.storySeen)):-1;
        if(![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].includes(saved.version)||!Array.isArray(saved.buildings)||saved.buildings.length>core.tile_count()||!Array.isArray(saved.pool)||saved.pool.length!==(saved.version>=14?8:saved.version>=5?3:2)||!saved.pool.every(x=>Number.isInteger(x)&&x>=0&&x<=1e9))throw Error('Invalid save');
        core.industry_begin_restore();core.industry_restore_pool(0,core.tile_count()*8+10,0);
        for(const b of [...saved.buildings].sort((a,b)=>Number(a[1]>=12)-Number(b[1]>=12))){
          if(!Array.isArray(b)||!b.slice(0,3).every(Number.isInteger)||b[0]<0||b[1]<0||b[1]>(saved.version>=15?14:saved.version>=14?11:saved.version>=6?4:saved.version===5?3:1)||b[2]<0||b[2]>1)throw Error('Invalid building');
          const side=saved.version>=5?b[6]:sides(b[0],b[1])[0];
          if(!Number.isInteger(side)||core.industry_build_facing(b[0],b[1],side))throw Error('Invalid placement');
          const paid=saved.version>=7?saved.paidCosts?.[b[0]]:1;
          if(!Number.isInteger(paid)||paid<0||paid>8)throw Error('Invalid construction cost');
          core.industry_restore_cost(b[0],paid);
          if(b[1]!==2&&b[1]<12)core.industry_pause(b[0]);
          if(saved.version>=2){
            if(!Number.isInteger(b[4])||b[4]<0||b[4]>(saved.version===2?4:299))throw Error('Invalid progress');
            core.industry_restore_progress(b[0],saved.version===2?b[4]*60:b[4]);
            if(saved.version>=4 && b[5]!==0 && b[5]!==1)throw Error('Invalid reserved input');
            core.industry_restore_input(b[0],saved.version>=4?b[5]:Number(b[1]===1 && b[4]>0));
          }
          if(b[1]===2&&saved.version<13){if(b.length!==11||!b.slice(7).every(x=>Number.isInteger(x)&&x>=0)||b[7]<2||b[7]>(saved.version>=10?10:12)||b[8]>(saved.version>=10?3000:saved.version>=8?3600:600)||b[9]>205||b[10]>1)throw Error('Invalid residence');core.industry_restore_house(b[0],b[7],Math.round(b[8]*(saved.version>=10?1:saved.version>=8?5/6:5)),b[9],b[10]);}
        }
        for(const b of saved.buildings)if(b[1]!==2 && b[1]<12 && !b[2] && core.industry_pause(b[0]))throw Error('Invalid workers');
        core.industry_restore_pool(saved.pool[0],saved.pool[1],Number.isInteger(saved.tick)?saved.tick:0);core.industry_restore_fish(saved.pool[2]??0);
        restoreInventory(core,saved);
        for(const b of saved.buildings.filter(b=>b[1]===2&&saved.version<13)){
          const needs=saved.version>=9?saved.needs?.[b[0]]:[core.industry_covered(b[0])?60:0,b[10]?60:0];
          if(!Array.isArray(needs)||needs.length!==2||!needs.every(v=>Number.isInteger(v)&&v>=0&&v<=60))throw Error('Invalid needs');
          core.industry_restore_needs(b[0],...needs);
        }
        if(saved.version>=13){
          const t=saved.tier;
          if(!Array.isArray(t)||t.length!==5||!t.every(x=>Number.isSafeInteger(x)&&x>=0)||t[1]>65536||t[2]>t[0]||t[3]>16777216||t[4]>205||t[0]!==saved.buildings.filter(b=>b[1]===2).length||core.industry_restore_tier(t[1],t[3],t[4]))throw Error('Invalid population tier');
        }
        if(saved.version>=10){
          if(!Number.isInteger(saved.peakPopulation)||saved.peakPopulation<0||!Number.isInteger(saved.tutorial)||saved.tutorial<0||saved.tutorial>11||!Array.isArray(saved.produced)||saved.produced.length!==3||!saved.produced.every(v=>Number.isInteger(v)&&v>=0))throw Error('Invalid progression');
          const stage=saved.version<12?(saved.tutorial>=4?saved.tutorial-1:Math.min(2,saved.tutorial)):saved.tutorial;
          core.industry_restore_progression(saved.peakPopulation,stage,...saved.produced);
        }else{
          const kinds=new Set(saved.buildings.map(b=>b[1]));
          const peak=Math.max(core.industry_population(),kinds.has(4)?20:kinds.has(0)||kinds.has(1)?10:kinds.has(3)?4:0);
          const stage=kinds.has(4)?5:kinds.has(1)?3:kinds.has(0)?2:kinds.has(3)?2:saved.buildings.filter(b=>b[1]===2).length>=2?1:0;
          core.industry_restore_progression(peak,stage,stage>=3?1:0,stage>=4?1:0,0);
        }
      }
    }catch{core.industry_reset();document.getElementById('save-status').textContent='Invalid save; started a new planet';}
    core.industry_refresh();ready=true;clock.reset(performance.now());tile=selection.getSelected();visuals(true);render();
    document.getElementById('reset-colony').disabled=false;
  }
  const resetDialog=document.getElementById('reset-colony-dialog');
  document.getElementById('reset-colony').addEventListener('click',()=>{
    if(!ready)return;
    resetDialog.returnValue='cancel';resetDialog.showModal();
  });
  resetDialog.addEventListener('close',()=>{
    if(resetDialog.returnValue!=='reset'||!ready)return;
    menu.reset();showGhost(null);showCoverage(null);showToolTarget(null);
    ready=false;storySeen=-1;core.industry_reset();core.industry_refresh();
    clock.reset(performance.now());clock.setRate(1,performance.now());showRate();
    drafts.clear();interactionUntil=0;pendingSave=false;pendingUi=false;listKey='';
    selection.select(null);tile=null;ready=true;
    document.getElementById('industry-message').textContent='';
    visuals(true);save();render();
  });
  window.addEventListener('pagehide',()=>{if(ready)save();});
  document.addEventListener('visibilitychange',()=>{if(ready && document.hidden)save();});
  function update(now){if(!ready)return;statuses.update();if(!chain&&document.getElementById('quest-story-dialog')?.open)clock.reset(now);else clock.update(now);const stocks=new BigUint64Array(core.memory.buffer,core.industry_stock_ptr(),8);const rate=core.industry_rate(1),concrete=Number(stocks[1])/16777216+rate*clock.getRemainder();const progress=concrete-Math.floor(concrete),badge=document.getElementById('concrete-stock').parentElement;badge.style.background=rate>0?'linear-gradient(to right,rgba(143,195,179,.24) '+(progress*100)+'%,transparent '+(progress*100)+'%)':'';badge.title=rate>0?'Next concrete in '+Math.ceil((1-progress)/rate)+'s':'Concrete · construction material';document.getElementById('concrete-stock').textContent=Math.floor(Math.max(0,Math.min(Math.max(100,Number(stocks[1])/16777216),concrete))).toLocaleString();if(pendingSave && now-lastSave>=1000)save();if(pendingUi && now-lastUi>=100)render();}
  return {rebuild,update};
}
