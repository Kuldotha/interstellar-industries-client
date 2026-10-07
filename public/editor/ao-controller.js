import {topology,connected,mapFaces,bakeMappings,matchEdges,faceKey} from './ao-tools.js';
export function createAOController({getParts,getModel,remember,changed,refresh,overlay,status,isVisible=()=>true}){
 const $=id=>document.getElementById(id);let topo,selection=[],clipboard=null,editing=false,identity=null;
 const model=()=>getModel(),settings=()=>model().aoMapping?.[selection[0]],refs=()=>selection.map(id=>id.split(':').map(Number));
 function render(){
  const m=settings();$('ao-selection').textContent=selection.length?`${selection.length} ${selection.length===1?'face':'faces'} selected · Start: ${selection[0]}${m?'':' · Unmapped'}`:'No faces selected';
  for(const id of ['ao-map','ao-left','ao-right','ao-start','ao-end','ao-start-number','ao-end-number','ao-gradient-reset','ao-invert','ao-white','ao-copy','ao-match','ao-seam','ao-unseam','ao-connected','ao-planar'])$(id).disabled=!selection.length;
  $('ao-paste').disabled=!selection.length||!clipboard;
  if(m)$('ao-layout').value=m.layout||'repeat';
  const values=selection.length?(()=>{const [p,f]=refs()[0];return model().ao[p].slice(f*3,f*3+3);})():[1];const shown=m||{start:Math.min(...values),end:Math.max(...values)};for(const key of ['start','end']){$('ao-'+key).value=shown[key];$('ao-'+key+'-number').value=shown[key];}
 }
 function transaction(fn,merge=false){
  if(!selection.length)throw Error('Select faces first');const next=structuredClone(model());fn(next);
  if(next.ao.some(a=>a.some(v=>!Number.isFinite(v)||Math.abs(v)>100)))throw Error('Gradient extends too far. Shorten the range or select a smaller surface.');
  if(!merge||!editing)remember();if(merge)editing=true;Object.assign(model(),next);changed();refresh();render();
 }
 function handle(fn){return()=>{try{fn();}catch(e){status(e.message,true);}};}
 function map(next,turn=settings()?.turn||0,start=settings()?.start??1,end=settings()?.end??1){bakeMappings(next,mapFaces(topo,selection,{continuous:$('ao-layout').value==='continuous',turn,start,end,seams:next.aoSeams||[]}));}
 function endpoints(start,end,merge=false){transaction(next=>{const mappings={};for(const id of selection){const source=next.aoMapping?.[id]||mapFaces(topo,[id])[id];mappings[id]={...source,start,end};}bakeMappings(next,mappings);},merge);}
 $('ao-map').onclick=handle(()=>transaction(next=>map(next,0,1,1)));
 $('ao-left').onclick=handle(()=>transaction(next=>map(next,(settings()?.turn||0)-1)));
 $('ao-right').onclick=handle(()=>transaction(next=>map(next,(settings()?.turn||0)+1)));
 $('ao-layout').onchange=handle(()=>transaction(next=>map(next)));
 for(const key of ['start','end']){
  for(const suffix of ['', '-number']){
   const element=$('ao-'+key+suffix);element.oninput=()=>{try{const start=key==='start'?Number(element.value):Number($('ao-start-number').value),end=key==='end'?Number(element.value):Number($('ao-end-number').value);if(!element.value||!Number.isFinite(start+end))return;endpoints(start,end,true);}catch(e){status(e.message,true);}};
   element.onchange=()=>editing=false;element.onblur=()=>{editing=false;render();};
  }
 }
 $('ao-gradient-reset').onclick=handle(()=>endpoints(0,1));
 $('ao-white').onclick=handle(()=>endpoints(1,1));
 $('ao-invert').onclick=handle(()=>transaction(next=>{for(const id of selection){const [p,f]=id.split(':').map(Number);for(let i=0;i<3;i++)next.ao[p][f*3+i]=1-next.ao[p][f*3+i];const m=next.aoMapping?.[id];if(m){m.start=1-m.start;m.end=1-m.end;}}}));
 $('ao-copy').onclick=handle(()=>{clipboard=structuredClone(settings()||mapFaces(topo,[selection[0]],{start:0,end:1})[selection[0]]);if(!settings()){const [p,f]=refs()[0];clipboard.uv.forEach((v,i)=>v[1]=model().ao[p][f*3+i]);}render();status('Starting face mapping copied');});
 $('ao-paste').onclick=handle(()=>transaction(next=>{if(!clipboard)return;if($('ao-layout').value==='continuous')map(next,clipboard.turn,clipboard.start,clipboard.end);else bakeMappings(next,Object.fromEntries(selection.map(id=>[id,{...structuredClone(clipboard),layout:'repeat'}])));}));
 $('ao-match').onclick=handle(()=>transaction(next=>matchEdges(topo,next,selection)));
 function seam(remove){transaction(next=>{if(selection.length!==2)throw Error('Select exactly two neighbouring faces');const edge=topo.faces.get(selection[0]).links.find(l=>l.to===selection[1])?.edge;if(!edge)throw Error('These faces do not share an edge');const seams=new Set(next.aoSeams||[]);if(remove)seams.delete(edge);else seams.add(edge);next.aoSeams=[...seams];});status(remove?'Shared seam cleared':'Shared seam marked');}
 $('ao-seam').onclick=handle(()=>seam(false));$('ao-unseam').onclick=handle(()=>seam(true));
 for(const [id,planar] of [['ao-connected',false],['ao-planar',true]])$(id).onclick=()=>{selection=connected(topo,selection,model().aoSeams,planar).filter(id=>isVisible(topo.faces.get(id).ref));render();overlay();};
 $('ao-clear').onclick=()=>{selection=[];render();overlay();};
 return {refs,render,
  load(){topo=topology(getParts());if(identity!==model()){selection=selection.filter(id=>topo.faces.has(id));identity=model();}render();},
  clear(){selection=[];render();},
  seamLines(){return (model().aoSeams||[]).flatMap(edge=>{const entry=topo?.edges.get(edge)?.[0];if(!entry)return [];const face=topo.faces.get(entry.id);return isVisible(face.ref)?[entry.corners.map(i=>face.points[i])]:[];});},
  select(faces,{add=false,remove=false,toggle=false}={}){const ids=faces.filter(isVisible).map(faceKey),set=new Set(add||remove||toggle?selection:[]);for(const id of ids){if(remove||toggle&&set.has(id))set.delete(id);else set.add(id);}selection=[...set];editing=false;render();overlay();}
 };
}
