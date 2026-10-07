import {METERS_TO_TILE_UNITS} from './model-units.js';
import {authoredParts} from './editor/model-data.js';
import {loadPalette,buildingPaletteMaterial} from './palette-material.js';
export async function loadHouseModel(B,scene){
  const response=await fetch('models/house_01.json');if(!response.ok)throw Error('House model failed to load');
  const source=await response.json();
  await loadPalette(B,scene);
  const parts=await authoredParts('house_01',source.parts,scene.metadata.palette);
  const atlas=buildingPaletteMaterial(B,scene);
  return (root,x,z,yaw,size,ghost,shadows,underwater)=>{
    for(const part of parts){if(!part.indices.length)continue;const mesh=new B.Mesh('house-'+part.material,scene),data=new B.VertexData();Object.assign(data,part);data.applyToMesh(mesh);if(part.ao)mesh.setVerticesData('modelAO',part.ao,false,1);mesh.parent=root;mesh.scaling.setAll(METERS_TO_TILE_UNITS);mesh.position.set(x,0,z);mesh.rotationQuaternion=B.Quaternion.RotationYawPitchRoll(yaw,0,0);mesh.material=ghost||atlas;mesh.receiveShadows=true;mesh.isPickable=false;shadows.addShadowCaster(mesh);underwater.renderList.push(mesh);}
  };
}
