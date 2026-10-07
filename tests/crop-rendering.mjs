import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createCropGrass} from '../public/crop-grass.js';
import {mergeHousingParts} from '../public/housing-cluster.js';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js');
const engine=new B.NullEngine(),scene=new B.Scene(engine);
try{
 const configs=JSON.parse(readFileSync(new URL('../public/configs/tile-compositions.json',import.meta.url))).configs.filter(c=>c.crop);
 const root=new B.TransformNode('field',scene);root.position.set(.3,.9,.2);root.scaling.setAll(1/8);
 for(const {crop} of configs){
  const mesh=createCropGrass(B,scene,root,crop,{unit:.075,center:root.position.asArray()});
  const ao=mesh.getVerticesData('modelAO');assert.equal(ao.length,mesh.getTotalVertices());assert(ao.every(v=>v===1));
  assert(mesh.getVerticesData('color').some(v=>v>0&&v<1));assert(mesh.receiveShadows);
 }
 mergeHousingParts(B,root,scene,{addShadowCaster(){},removeShadowCaster(){}},{renderList:[]});
 assert.equal(root.getChildMeshes().length,configs.length);
 for(const mesh of root.getChildMeshes())assert(mesh.getVerticesData('modelAO').every(v=>v===1));
 console.log('All crop meshes retain neutral AO, crop colors, shadow reception and instances through building assembly.');
}finally{scene.dispose();engine.dispose();}
