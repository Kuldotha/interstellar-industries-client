import {scaleModelMatrices} from './model-units.js';
import {createPropGrassCollision} from './prop-grass-collision.js';
import {authoredParts} from './editor/model-data.js';
import {opaqueMaterial,nearestSwatch,applySwatch,whiteAO,paletteSwatch} from './palette-material.js';
import {enableFacets,facetStyles} from './facet-material.js?weighted-cells=4';
import {propTint} from './prop-tint.js';
const variation=seed=>{
  let x=seed>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/4294967296;
};
export async function createProps(B,scene,shadows) {
  const models=await (await fetch('props.json?deposits=1')).json();
  const image=await createImageBitmap(await(await fetch('props-color.png')).blob());
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);image.close();
  const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
  const tree=models[0];
  for(let i=0;i<tree.uvs.length;i+=2){
    const x=Math.max(0,Math.min(canvas.width-1,Math.floor(tree.uvs[i]*canvas.width))),y=Math.max(0,Math.min(canvas.height-1,Math.floor(tree.uvs[i+1]*canvas.height)));
    const offset=(y*canvas.width+x)*4,s=paletteSwatch(scene,pixels[offset+1]>pixels[offset]?'tree-foliage':'tree-bark',[pixels[offset]/255,pixels[offset+1]/255,pixels[offset+2]/255]);
    tree.uvs[i]=s.uvCenter[0];tree.uvs[i+1]=1-s.uvCenter[1];
  }
  const rockMaterial=opaqueMaterial(B,scene,'stone-palette',null,{atlas:true});enableFacets(B,rockMaterial,facetStyles.stone,{instances:true});
  const rockSwatch=paletteSwatch(scene,'rock',[.58,.59,.60]);
  const sources=await Promise.all(models.map(async(model,kind)=>{if(kind>0)model.uvs=Array.from({length:model.positions.length/3},()=>[rockSwatch.uvCenter[0],1-rockSwatch.uvCenter[1]]).flat();return (await authoredParts(model.name,[model],scene.metadata?.palette))[0];}));
  const meshes=models.map((model,kind)=>{
    const source=sources[kind];
    const mesh=new B.Mesh(model.name,scene);
    const geometry=new B.VertexData();
    for(const name of ['positions','normals','uvs','indices']) geometry[name]=source[name];
    geometry.uvs2=source.uvs2||whiteAO(source.positions.length/3);if(source.indices.length)geometry.applyToMesh(mesh);if(source.ao?.length)mesh.setVerticesData('modelAO',source.ao,false,1);
    const material=kind===0?opaqueMaterial(B,scene,model.name+'-material',null,{atlas:true}):rockMaterial;
    mesh.material=material;mesh.receiveShadows=true;shadows.addShadowCaster(mesh);return mesh;
  });
  let totals=meshes.map(()=>0),occupied=new Set(),cache=null,groupsByTile=new Map(),excluded=new Set();
  const dirty=new Set(),rebuilds=meshes.map(()=>0);
  const show=(trees,stones)=>meshes.forEach((mesh,i)=>mesh.setEnabled(sources[i].indices.length>0 && totals[i]>0 && (i===0?trees:stones)));
  function setOccupied(value){
    for(const tile of new Set([...occupied,...value]))if(occupied.has(tile)!==value.has(tile))for(const kind of groupsByTile.get(tile)||[])dirty.add(kind);
    occupied=new Set(value);
  }
  function flush(trees,stones){
    if(!cache || !dirty.size)return null;
    const {count,matrices,ids,kinds,groups,tiles,surfaces,features,owners}=cache;
    const visible=i=>![...cache.owners.subarray(i*3,i*3+3)].some(t=>excluded.has(t))&&!occupied.has(owners[i*3])&&!occupied.has(owners[i*3+1])&&!occupied.has(owners[i*3+2]);
    for(const kind of dirty){
      let total=0;for(let i=0;i<count;i++)if(groups[i]===kind&&visible(i))total++;
      totals[kind]=total;
      const buffer=new Float32Array(total*16),colors=new Float32Array(total*4);let cursor=0;
      for(let i=0;i<count;i++)if(groups[i]===kind&&visible(i)){buffer.set(matrices.subarray(i*16,i*16+16),cursor*16);colors.set(propTint(ids[i],kinds[i]),cursor*4);cursor++;}
      const mesh=meshes[kind];
      if(total&&sources[kind].indices.length){mesh.thinInstanceSetBuffer('matrix',buffer,16,true);mesh.thinInstanceSetBuffer('color',colors,4,true);mesh.thinInstanceRefreshBoundingInfo(true);}else mesh.thinInstanceCount=0;
      rebuilds[kind]++;mesh.metadata={...mesh.metadata,waterlineProp:true,waterlineRevision:rebuilds[kind]};
    }
    dirty.clear();show(trees,stones);
    let submerged=0;for(let i=0;i<count;i++)if(kinds[i]===1&&visible(i)&&surfaces[tiles[i]]===0)submerged++;
    return {trees:totals[0],stones:totals.slice(1).reduce((a,b)=>a+b,0),submerged,forestTiles:features.filter(x=>(x&1)!==0).length};
  }
  return {
    show,setOccupied,flush,setExcluded:value=>{excluded=new Set(value);meshes.forEach((_,kind)=>dirty.add(kind));},grassCollision:()=>createPropGrassCollision(B,sources,{...cache,enabled:i=>!Array.from(cache.owners.subarray(i*3,i*3+3)).some(t=>excluded.has(t))}),stats:()=>({rebuilds:[...rebuilds],dirty:[...dirty]}),
    update(core,trees,stones,surfacePoint=null){
      const count=core.prop_count();
      cache={count,owners:new Uint32Array(core.memory.buffer,core.prop_owners_ptr(),count*3).slice(),matrices:new Float32Array(core.memory.buffer,core.prop_matrices_ptr(),count*16).slice(),ids:new Uint32Array(core.memory.buffer,core.prop_ids_ptr(),count).slice(),kinds:new Uint32Array(core.memory.buffer,core.prop_kinds_ptr(),count).slice(),tiles:new Uint32Array(core.memory.buffer,core.prop_tiles_ptr(),count).slice(),surfaces:new Uint32Array(core.memory.buffer,core.surfaces_ptr(),core.tile_count()).slice(),features:new Uint32Array(core.memory.buffer,core.features_ptr(),core.tile_count()).slice()};
      scaleModelMatrices(cache.matrices);
      if(surfacePoint)for(let i=0;i<count;i++)if(cache.kinds[i]===1){const offset=i*16+12,point=Array.from(cache.matrices.subarray(offset,offset+3));cache.matrices.set(surfacePoint(point,cache.tiles[i]),offset);}
      cache.groups=cache.kinds.map((kind,i)=>kind===0?0:1+Math.floor(variation(cache.ids[i]^0x48291)*(meshes.length-1)));
      groupsByTile=new Map();for(let i=0;i<count;i++){for(const tile of cache.owners.subarray(i*3,i*3+3)){if(!groupsByTile.has(tile))groupsByTile.set(tile,new Set());groupsByTile.get(tile).add(cache.groups[i]);}}
      meshes.forEach((_,kind)=>dirty.add(kind));return flush(trees,stones);
    }
  };
}
