import assert from 'node:assert/strict';
import {orbitPose,orbitInertia} from '../public/orbit-camera.js';
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
for(const latitude of [-1.553,0,1.553]) for(const zoom of [0,.34,1]) {
 const pose=orbitPose(-1.05,latitude,zoom);
 const offset=pose.position.map((x,i)=>x-pose.target[i]);
 const distance=Math.hypot(...offset);
 assert(Math.abs(distance-(.5+4.5*(1-zoom)**2))<1e-10);
 assert(Math.abs(dot(offset,pose.up))<1e-10);
 assert(Math.abs(Math.hypot(...pose.up)-1)<1e-10);
 assert(Math.abs(dot(offset,pose.target)/distance-Math.cos(zoom**2*80*Math.PI/180))<1e-10);
 assert(Math.hypot(...pose.position)>1.19);
}
console.log('Camera: surface focus, quadratic distance, eased 0–80 degree tilt, orthogonal up and finite polar frames pass.');

for(const fps of [30,60,144]){
 let velocity=2,distance=0;
 for(let frame=0;frame<fps;frame++){
  const step=orbitInertia(velocity,1/fps);distance+=step.distance;velocity=step.velocity;
 }
 assert(Math.abs(distance-2*(1-Math.exp(-9))/9)<1e-12);
 assert(velocity<.001);
}
assert.equal(orbitInertia(0,.1).distance,0);
assert(orbitInertia(-2,.1).distance<0);
console.log('Orbit inertia: frame-rate independent travel, damping, signed motion and stationary input pass.');

const {createOrbitCamera}=await import('../public/orbit-camera.js');
const events=()=>({listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},fire(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}});
globalThis.window=events();globalThis.document=events();
const vector=()=>({copyFromFloats(...v){this.values=v;}});
const B={Vector3:{Zero:vector,FromArray:a=>a},FreeCamera:class{constructor(){this.position=vector();this.upVector=vector();}setTarget(t){this.target=t;}}};
const canvas=events(),orbit=createOrbitCamera(B,{},canvas),initial=[...orbit.camera.target];
const key=(code,tagName='CANVAS')=>({code,target:{tagName},preventDefault(){this.prevented=true;}});
window.fire('keydown',key('KeyD'));for(let i=0;i<60;i++)orbit.update(1/60,false);
const longitude=()=>Math.atan2(orbit.camera.target[2],orbit.camera.target[0]);
assert(longitude()<-1.05);
window.fire('keyup',key('KeyD'));for(let i=0;i<180;i++)orbit.update(1/60,false);
const settled=longitude();orbit.update(1,false);assert(Math.abs(longitude()-settled)<1e-5);
orbit.reset();orbit.update(0,false);window.fire('keydown',key('ArrowUp'));orbit.update(1,false);assert(orbit.camera.target[1]>initial[1]);
window.fire('blur');const stopped=[...orbit.camera.target];orbit.update(1,false);assert.deepEqual(orbit.camera.target,stopped);
orbit.reset();orbit.update(0,false);window.fire('keydown',key('KeyD','INPUT'));orbit.update(1,false);assert.deepEqual(orbit.camera.target,initial);
window.fire('keydown',key('KeyD'));document.fire('focusin',{target:{tagName:'TEXTAREA'}});orbit.update(1,false);assert.deepEqual(orbit.camera.target,initial);
console.log('Keyboard orbit: WASD/arrows, release damping, blur cancellation and UI-field exclusion pass.');
orbit.reset();orbit.update(0,false);
window.fire('keydown',key('ArrowRight'));window.fire('keyup',key('ArrowRight'));orbit.update(.1,false);
assert(longitude()<-1.05);
orbit.reset();orbit.update(0,false);
const fallback={key:'w',code:'',target:{tagName:'CANVAS'},preventDefault(){}};
window.fire('keydown',fallback);window.fire('keyup',fallback);orbit.update(.1,false);
assert(orbit.camera.target[1]>initial[1]);
console.log('Keyboard taps between frames and key-only events both move the camera.');
