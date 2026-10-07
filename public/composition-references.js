export function missingCompositionModels(data,library){
 const active=new Set(library.models.filter(m=>m.active).map(m=>m.id)),missing=new Map();
 for(const config of data.configs){
  const references=[...config.fixed.map(e=>({model:e.model,entry:e.name})),...config.scatter.flatMap(e=>e.models.map(model=>({model,entry:e.name}))),...(config.urbanConnections?[{model:config.urbanConnections.model,entry:'Connections'}]:[])];
  for(const {model,entry} of references){if(active.has(model))continue;if(!missing.has(model))missing.set(model,{id:model,name:library.models.find(m=>m.id===model)?.name||model,uses:[]});missing.get(model).uses.push({config:config.id,entry});}
 }
 return [...missing.values()];
}
export function replaceCompositionModel(data,from,to){
 for(const config of data.configs){
  for(const entry of config.fixed)if(entry.model===from){entry.model=to;entry.appearance='';}
  for(const entry of config.scatter)if(entry.models.includes(from)){entry.models=entry.models.map(id=>id===from?to:id);entry.appearance='';}
  if(config.urbanConnections?.model===from){config.urbanConnections.model=to;config.urbanConnections.appearance='';}
 }
}
export function availableComposition(config,library){
 const active=new Set(library.models.filter(m=>m.active).map(m=>m.id));
 return {...config,fixed:config.fixed.filter(e=>active.has(e.model)),scatter:config.scatter.filter(e=>e.models.every(id=>active.has(id))),urbanConnections:active.has(config.urbanConnections?.model)?config.urbanConnections:undefined};
}
