import { createTileHighlights } from './tile-highlights.js';
import { createTileIndex } from './tile-picking.js';
export function createTileSelection(B,scene,camera,canvas,definition) {
  let index=null,selected=null,hovered=null,pointer=null,press=null,lastView=null,surfaces=[],features=[],centers=[],heightStep=.035;
  let onChange=()=>{},onActivate=()=>false,onHover=()=>{};
  const card=document.getElementById('selection-card'),summary=document.getElementById('selection-summary');
  const identity=B.Matrix.Identity(),highlights=createTileHighlights(B,scene);
  let hoverColor=[.65,1,.89];
  const metrics={rays:0,totalRayMs:0,maxRayMs:0,highlightUpdates:0,maxHighlightMs:0};
  function draw(tile,isSelected){
    const start=performance.now();
    highlights.show(isSelected?'selection':'hover',tile===null?[]:[tile],{color:isSelected?[1,.82,.3]:hoverColor,alpha:isSelected?.23:.13});
    metrics.highlightUpdates++;metrics.maxHighlightMs=Math.max(metrics.maxHighlightMs,performance.now()-start);
  }
  function select(tile) {
    if(tile===selected)return;
    selected=tile;highlights.clear('selection');
    card.hidden=tile===null;
    if(tile===null){onChange(tile);return;}
    draw(tile,true);
    const p=centers.slice(tile*3,tile*3+3),r=Math.hypot(...p);
    document.getElementById('selection-title').textContent=`Tile ${tile}`;
    const f=features[tile],parts=[definition.surfaces[surfaces[tile]].name];
    if(f&1)parts.push('Forest');if(f&2)parts.push('Stone deposit');
    summary.textContent=parts.join(' · ');
    document.getElementById('selection-height').textContent=`Elevation ${Math.round((r-1)/heightStep)}`;
    onChange(tile);
  }
  const rayAt=(x,y)=>{
    const rect=canvas.getBoundingClientRect(),engine=scene.getEngine();
    const ray=scene.createPickingRay((x-rect.left)*engine.getRenderWidth()*engine.getHardwareScalingLevel()/rect.width,(y-rect.top)*engine.getRenderHeight()*engine.getHardwareScalingLevel()/rect.height,identity,camera,false);
    const start=performance.now(),hit=index?.pick(ray.origin.asArray(),ray.direction.asArray());
    const elapsed=performance.now()-start;metrics.rays++;metrics.totalRayMs+=elapsed;metrics.maxRayMs=Math.max(metrics.maxRayMs,elapsed);
    return hit;
  };
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;press={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
  canvas.addEventListener('pointermove',e=>{
    pointer={x:e.clientX,y:e.clientY};
    if(press && Math.hypot(e.clientX-press.x,e.clientY-press.y)>6)press.moved=true;
  });
  canvas.addEventListener('pointerup',e=>{
    if(press?.id===e.pointerId && !press.moved){const hit=rayAt(e.clientX,e.clientY)?.tile??null;if(!onActivate(hit))select(hit);}
    press=null;
  });
  for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>press=null);
  canvas.addEventListener('pointerleave',()=>{pointer=null;lastView=null;hovered=null;highlights.clear('hover');});
  document.getElementById('clear-selection').addEventListener('click',()=>select(null));
  window.addEventListener('keydown',e=>{if(e.key==='Escape')select(null);});
  function update() {
    if(!index || !pointer || press?.moved)return;
    const eye=camera.position,target=camera.getTarget(),engine=scene.getEngine();
    const view=[pointer.x,pointer.y,eye.x,eye.y,eye.z,target.x,target.y,target.z,engine.getRenderWidth(),engine.getRenderHeight()];
    if(lastView && view.every((v,i)=>v===lastView[i]))return;
    lastView=view;const tile=rayAt(pointer.x,pointer.y)?.tile??null;
    if(tile===hovered)return;hovered=tile;onHover(tile);
    if(tile===null)highlights.clear('hover');else draw(tile,false);
    canvas.style.cursor=tile===null?'grab':'pointer';
  }
  function rebuild(core,matrices,ids,kinds,height) {
    heightStep=height;lastView=null;
    select(null);hovered=null;highlights.clear('hover');
    surfaces=new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count()).slice();
    features=new Uint32Array(core.memory.buffer,core.features_ptr(),core.tile_count()).slice();
    centers=new Float32Array(core.memory.buffer,core.tile_centers_ptr(),core.tile_count()*3).slice();
    index=createTileIndex(matrices,ids,kinds,centers);
    const corners=new Float32Array(core.memory.buffer,core.tile_corners_ptr(),core.tile_count()*18).slice();
    const resolution=Math.round(Math.sqrt((core.tile_count()-2)/10));
    highlights.configure(centers,corners,1+definition.water.heightInLevels*height,resolution);
  }

  return {highlights,rebuild,update,select,onActivate:callback=>{onActivate=callback;},onHover:callback=>{onHover=callback;},getHovered:()=>hovered,setHoverColor:color=>{hoverColor=color;if(hovered!==null)draw(hovered,false);},onSelect:callback=>{onChange=callback;},getSelected:()=>selected,stats:()=>({...metrics,averageRayMs:metrics.totalRayMs/Math.max(1,metrics.rays)})};
}
