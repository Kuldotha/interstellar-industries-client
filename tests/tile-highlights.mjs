import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createTileHighlights} from '../public/tile-highlights.js';
const sandbox={console,setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};sandbox.window=sandbox;
vm.runInNewContext(readFileSync(new URL('../public/vendor/babylon-9.28.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON,engine=new B.NullEngine(),scene=new B.Scene(engine);
const {instance}=await WebAssembly.instantiate(readFileSync(new URL('../public/planet_geometry.wasm',import.meta.url)),{}),c=instance.exports;
c.generate_blue(8,.2,23);
const centers=new Float32Array(c.memory.buffer,c.tile_centers_ptr(),c.tile_count()*3).slice(),corners=new Float32Array(c.memory.buffer,c.tile_corners_ptr(),c.tile_count()*18).slice();
const highlights=createTileHighlights(B,scene);highlights.configure(centers,corners,1.13,8);
const style={color:[1,.8,.3],alpha:.2};
for(const name of ['hover','selection','utility-focus']){
 highlights.show(name,[0],style);
 assert(scene.meshes.some(m=>m.name===name+'-fill'));
 assert(scene.meshes.some(m=>m.name===name+'-outline'));
}
const fills=scene.meshes.filter(m=>m.name.endsWith('-fill'));
for(const fill of fills)assert.deepEqual(Array.from(fill.getVerticesData('position')),Array.from(fills[0].getVerticesData('position')));
const before=scene.meshes.length;highlights.show('hover',[0],style);assert.equal(scene.meshes.length,before);
for(const mesh of scene.meshes){
 const vertices=mesh.getVerticesData('position'),bounds=mesh.getBoundingInfo();
 for(let i=0;i<vertices.length;i+=3)assert(bounds.intersectsPoint(B.Vector3.FromArray(vertices,i)));
 assert.equal(mesh.isPickable,false);
}
highlights.configure(centers,corners,1.13,8);assert.equal(scene.meshes.length,0);
scene.dispose();engine.dispose();
console.log('Shared highlights: identical tile geometry, fills and outlines in every mode, exact bounds, stable caching and clean disposal.');
