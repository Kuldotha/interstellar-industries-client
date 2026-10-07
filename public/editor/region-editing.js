export function paintRegions(regions,selected,faces,{erase=false,unassigned=true}={}){
 const target=regions.find(r=>r.id===selected);if(!erase&&!target)return false;
 const owners=new Map(regions.flatMap(r=>r.faces.map(f=>[f.join(':'),r.id])));
 const chosen=new Map(faces.filter(f=>{const owner=owners.get(f.join(':'));return erase?owner!==undefined:owner!==selected&&(!unassigned||owner===undefined);}).map(f=>[f.join(':'),f]));
 if(!chosen.size)return false;
 for(const r of regions)r.faces=r.faces.filter(f=>!chosen.has(f.join(':')));
 if(!erase)target.faces.push(...chosen.values());return true;
}
export function historyShortcut(event){
 if(!(event.ctrlKey||event.metaKey||event.altKey))return null;
 const key=event.code||'Key'+event.key?.toUpperCase();
 if(key==='KeyZ')return event.shiftKey?'redo':'undo';
 if(key==='KeyY'&&(event.ctrlKey||event.metaKey))return 'redo';
 return null;
}
