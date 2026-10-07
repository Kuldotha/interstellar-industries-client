import assert from 'node:assert/strict';
import{enableCloseOcclusion}from'../public/close-occlusion.js';
let creations=0,disposals=0,before,cleanup;
const B={Vector3:{Distance:(a,b)=>Math.abs(a-b)},SSAO2RenderingPipeline:class{static IsSupported=true;constructor(){creations++;}dispose(){disposals++;}}};
const scene={onBeforeRenderObservable:{add:f=>before=f},onDisposeObservable:{add:f=>cleanup=f}},camera={position:5,getTarget:()=>0};
const pipeline=enableCloseOcclusion(B,scene,camera);
for(let pass=0;pass<10;pass++)for(const distance of [5,1.7,1.5,.5,1.8,2,5]){camera.position=distance;before();assert.equal(creations,1);assert.equal(disposals,0);assert(pipeline.totalStrength>=0&&pipeline.totalStrength<=.65);if(distance>=1.6)assert.equal(pipeline.totalStrength,0);}
cleanup();assert.equal(disposals,1);console.log('AO: repeated zoom transitions preserve the pipeline and fade strength to zero at distance.');
