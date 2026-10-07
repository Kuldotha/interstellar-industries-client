import {urbanConnectionOwner,urbanConnectionObjects} from '../urban-connections.js';
import {TILE_RADIUS_METERS} from '../model-units.js';
export function previewUrbanConnections(tiles){
 const buildings=new Map(tiles.flatMap((t,id)=>t.config?.id.startsWith('building:')?[[id,[id,Number(t.config.id.split(':')[1])]]]:[])),result=[],distance=Math.sqrt(3)*TILE_RADIUS_METERS;
 for(let a=0;a<tiles.length;a++)for(let b=a+1;b<tiles.length;b++){
  const first=tiles[a],second=tiles[b];
  if(Math.abs(first.height-second.height)>.0001||Math.abs(Math.hypot(first.x-second.x,first.z-second.z)-distance)>.001)continue;
  const owner=urbanConnectionOwner(a,b,buildings);if(owner===null)continue;
  const tile=tiles[owner],config=tile.config.urbanConnections;if(!config)continue;
  const x=(first.x+second.x)/2-tile.x,z=(first.z+second.z)/2-tile.z;
  for(const [copy,object] of urbanConnectionObjects(config,x,z).entries())result.push({owner,edge:[x,z],copy,object:{...object,id:`connection-${a}-${b}-${result.length}`,entry:'urban-connection'}});
 }
 return result;
}
