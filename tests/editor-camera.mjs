import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {attachEditorCamera} from '../public/editor/camera-controls.js';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js');
const engine=new B.NullEngine(),scene=new B.Scene(engine),camera=new B.ArcRotateCamera('editor',-1,1,5,new B.Vector3(0,10,0),scene);
try{
 attachEditorCamera(camera,null);
 const pointers=camera.inputs.attached.pointers,target=camera.target.clone();
 pointers.onButtonDown({button:2,ctrlKey:false,altKey:false,shiftKey:false});pointers.onTouch(null,100,40);
 assert.notEqual(camera.movement.rotationAccumulatedPixels.x,0);
 assert.equal(camera.movement.panAccumulatedPixels.lengthSquared(),0);
 scene.render();assert(camera.target.equalsWithEpsilon(target));
 pointers.onButtonDown({button:1,ctrlKey:false,altKey:false,shiftKey:false});pointers.onTouch(null,100,40);
 assert.notEqual(camera.movement.panAccumulatedPixels.lengthSquared(),0);
 assert.equal(camera.movement.input.resolveInteraction('pointer',{button:0}),null);
 const distances=[.6,6,12],pan=[];for(const radius of distances){camera.radius=radius;camera.movement.panAccumulatedPixels.setAll(0);pointers.onTouch(null,100,0);pan.push(Math.abs(camera.movement.panAccumulatedPixels.x));}
 assert(Math.abs(pan[0]/pan[1]-.1)<1e-9);assert(Math.abs(pan[2]/pan[1]-2)<1e-9);
 assert(Math.abs(pan[1]-100/960)<1e-9);
 console.log('Editor camera: right drag rotates without moving the target; middle drag pans; left button remains available for painting.');
}finally{scene.dispose();engine.dispose();}
