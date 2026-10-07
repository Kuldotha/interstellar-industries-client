import {meadowVariant,meadowGeometry} from '../meadow-variants.js';
import {TILE_RADIUS_METERS} from '../model-units.js';
import {createGrassCollision} from './grass-collision.js';
import {opaqueMaterial,whiteAO,groundMaterial} from '../palette-material.js';
import {enableFacets,facetStyles} from '../facet-material.js?weighted-cells=4';
import {compileAppearance} from './model-data.js';

export async function createEditorEnvironment(B,scene,shadows,library,authoring){
 const scale=TILE_RADIUS_METERS/2.4;
 const root=new B.TransformNode('editor-environment',scene);root.position.set(0,10,0);root.setEnabled(false);
 const palette=scene.metadata.palette,swatch=id=>palette.swatches.find(s=>s.id===id);
 const groundMat=groundMaterial(B,scene,'editor-ground');enableFacets(B,groundMat,{...facetStyles.ground,scale:1.5});
 const stoneMat=opaqueMaterial(B,scene,'editor-stone',null,{atlas:true});enableFacets(B,stoneMat,{...facetStyles.stone,scale:8});
 const treeMat=opaqueMaterial(B,scene,'editor-trees',null,{atlas:true});
 const register=(mesh,cast=true)=>{mesh.parent=root;mesh.isPickable=false;mesh.receiveShadows=true;if(cast)shadows.addShadowCaster(mesh);return mesh;};
 const ground=register(B.MeshBuilder.CreateCylinder('editor-meadow',{height:.1*scale,diameter:TILE_RADIUS_METERS*2,tessellation:64},scene),false);ground.position.y=-.05*scale;ground.material=groundMat;
 const color=swatch('land-surface').rgb;ground.setVerticesData(B.VertexBuffer.ColorKind,Array.from({length:ground.getTotalVertices()},()=>[...color,1]).flat());
 const trees=library.models.filter(m=>m.active&&m.id.startsWith('tree')),rocks=library.models.filter(m=>m.active&&m.id.startsWith('rock'));
 const obstacles=[];
 const treePositions=[[-1.25,.85],[-.85,1.45],[.95,1.35],[1.45,.55]],rockPositions=[[-1.35,-.6],[-1.1,-.85],[1.25,-.8],[1.5,-.45]];
 for(const [placements,sources,tree] of [[treePositions,trees,true],[rockPositions,rocks,false]])placements.forEach(([x,z],i)=>{
  if(!sources.length)return;
  const source=sources[i%sources.length],model=authoring.models[source.id],appearance=authoring.appearances[authoring.bindings[source.id]];
  let parts=source.parts;if(model&&appearance){try{parts=compileAppearance(parts,model,appearance,palette);}catch(error){console.warn(source.id+': '+error.message);}}
  for(const p of parts){
   const mesh=register(new B.Mesh('environment-'+source.id,scene)),g=new B.VertexData();Object.assign(g,p);g.uvs2=p.uvs2||whiteAO(p.positions.length/3);g.applyToMesh(mesh);if(p.ao)mesh.setVerticesData('modelAO',p.ao,false,1);mesh.material=tree?treeMat:stoneMat;mesh.position.set(x*scale,0,z*scale);mesh.rotation.y=i*2.4;
   const transform=B.Matrix.Compose(mesh.scaling,B.Quaternion.RotationYawPitchRoll(mesh.rotation.y,0,0),mesh.position),positions=[];for(let v=0;v<p.positions.length;v+=3)positions.push(...B.Vector3.TransformCoordinates(B.Vector3.FromArray(p.positions,v),transform).asArray());obstacles.push({positions,indices:p.indices});
  }
 });
 const grass=register(new B.Mesh('editor-grass',scene),false);grass.material=groundMat;
 function fit(parts){
  const collision=createGrassCollision([...obstacles,...parts.map(p=>({indices:p.indices,positions:p.positions}))]);
  const positions=[],normals=[],colors=[],indices=[];
  let seed=0x713ac;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  const hash=(x,z)=>{let h=Math.imul(x,374761393)^Math.imul(z,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const patch=(x,z)=>{x*=1.8/scale;z*=1.8/scale;const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,a=u*u*(3-2*u),b=v*v*(3-2*v);return (hash(ix,iz)*(1-a)+hash(ix+1,iz)*a)*(1-b)+(hash(ix,iz+1)*(1-a)+hash(ix+1,iz+1)*a)*b;};
  for(let i=0;i<4500;i++){
   const angle=random()*Math.PI*2,r=(TILE_RADIUS_METERS-.1)*Math.sqrt(random()),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
   if(random()>(.35+.65*patch(x,z))||collision.contains([x,.00001,z]))continue;
   const size=(.65+random()*.8)*scale,blades=3+Math.floor(random()*4),yaw=random()*Math.PI*2;
   const variant=meadowVariant(random());
   if(variant){const g=meadowGeometry(variant),unit=.07*size,c=Math.cos(yaw),s=Math.sin(yaw);for(let t=0;t<g.indices.length;t+=3){const points=g.indices.slice(t,t+3).map(i=>{const [px,py,pz]=g.positions.slice(i*3,i*3+3);return [x+(px*c+pz*s)*unit,py*unit,z+(-px*s+pz*c)*unit];});if(collision.intersects(points))continue;points.forEach((p,j)=>{const index=g.indices[t+j];positions.push(...p);normals.push(0,1,0);colors.push(...g.colors.slice(index*4,index*4+3).map((v,k)=>v*(variant===1?color[k]:1)),1);indices.push(indices.length);});}continue;}
   for(let blade=0;blade<blades;blade++){const a=yaw+blade*2.4+(random()-.5),dx=Math.cos(a),dz=Math.sin(a),h=(.05+.04*random())*size,w=(.007+.007*random())*size,lean=(.005+.025*random())*size;const triangle=[[x-dz*w,0,z+dx*w],[x+dz*w,0,z-dx*w],[x+dx*lean,h,z+dz*lean]];if(collision.intersects(triangle))continue;for(const [px,py,pz] of triangle){positions.push(px,py,pz);normals.push(0,1,0);colors.push(...color.map(c=>Math.min(1,c*(py>0?1.08:1))),1);indices.push(indices.length);}}
  }
  const geometry=new B.VertexData();Object.assign(geometry,{positions,normals,colors,indices});geometry.applyToMesh(grass);grass.setVerticesData('modelAO',new Float32Array(positions.length/3).fill(1),false,1);
 }
 return {fit,show:enabled=>root.setEnabled(enabled)};
}
