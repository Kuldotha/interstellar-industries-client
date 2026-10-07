import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {updateBuildingBounds} from '../public/building-wrap.js';
const sandbox={console,setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};sandbox.window=sandbox;vm.runInNewContext(readFileSync(new URL('../public/vendor/babylon-9.28.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON,engine=new B.NullEngine(),scene=new B.Scene(engine);
for(const axis of [new B.Vector3(0,1,0),new B.Vector3(1,0,0),new B.Vector3(.3,-.6,.7).normalize()]){
  const root=new B.TransformNode('root',scene);root.position=axis.scale(1.105);root.scaling.setAll(.09375);root.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,axis,new B.Quaternion());
  const mesh=B.MeshBuilder.CreateBox('crate',{width:.17,height:.13,depth:.17},scene);mesh.parent=root;mesh.position.set(.25,-.37,1.9);
  const original=Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind));updateBuildingBounds(B,mesh,root.position);
  assert.deepEqual(Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind)),original);
  const world=mesh.getWorldMatrix(),bounds=mesh.getBoundingInfo();
  for(let i=0;i<original.length;i+=3){
    const p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(original,i),world),h=B.Vector3.Dot(p.subtract(root.position),axis),q=p.subtract(axis.scale(h)).normalize().scale(1.105+h);
    assert.ok(bounds.intersectsPoint(q),'Shader-deformed vertex must be inside the world-space culling bounds');
    for(const subMesh of mesh.subMeshes)assert.ok(subMesh.getBoundingInfo().intersectsPoint(q));
  }
  root.dispose();
}
scene.dispose();engine.dispose();console.log('Building bounds: displaced dock-crate vertices remain enclosed at equator, pole and oblique locations; source geometry unchanged.');
