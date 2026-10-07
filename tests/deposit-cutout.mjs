import assert from 'node:assert/strict';
import {createDepositCutout,createWaterCutout,waterCutoutShader} from '../public/deposit-cutout.js';
const textures=[];
const B={RawTexture:{CreateRGBATexture:(values,width,height)=>{const t={values:values.slice(),width,height,update(v){this.values=v.slice();},dispose(){}};textures.push(t);return t;}},Texture:{NEAREST_SAMPLINGMODE:1,WRAP_ADDRESSMODE:1,CLAMP_ADDRESSMODE:0},Engine:{TEXTURETYPE_FLOAT:1},MaterialPluginBase:class{},ShadowDepthWrapper:class{constructor(material){this.baseMaterial=material;}}};
const material={},cut=createDepositCutout(B,{getEngine:()=>({isWebGPU:false})},material);
assert.equal(material.shadowDepthWrapper.baseMaterial,material);
const water={};cut.bind({setTexture:(name,texture)=>water[name]=texture});assert.equal(water.depositLookup,textures[0]);assert.equal(water.depositCenters,textures[1]);
const patches=[{center:[-1,0,0],width:.06},{center:[0,1,0],width:.06},{center:[0,-1,0],width:.06},{center:[1,0,0],width:.06}];
cut.update(patches,patches.map(()=>true));
function sample(p){const r=Math.hypot(...p),u=Math.atan2(p[2],p[0])/(2*Math.PI)+.5,v=Math.acos(p[1]/r)/Math.PI;const t=textures[0],x=Math.floor(u*t.width)%t.width,y=Math.min(t.height-1,Math.floor(v*t.height)),i=(y*t.width+x)*4;return t.values[i]+256*t.values[i+1];}
for(let i=0;i<patches.length;i++){
 const p=patches[i];assert.equal(sample(p.center),i+1);
 const up=p.center,right=Math.abs(up[1])>.5?[1,0,0]:[0,1,0],forward=[up[1]*right[2]-up[2]*right[1],up[2]*right[0]-up[0]*right[2],up[0]*right[1]-up[1]*right[0]];
 for(let a=0;a<100;a++){const angle=a/100*Math.PI*2,q=up.map((v,k)=>v+p.width*.399*(right[k]*Math.cos(angle)+forward[k]*Math.sin(angle)));assert.equal(sample(q),i+1);}
}
cut.update(patches,[false,true,true,true]);assert.equal(sample(patches[0].center),0);assert.equal(textures[1].values[3],0);
cut.update(patches,patches.map(()=>false));assert(textures[0].values.every(v=>v===0));assert(textures[1].values.every(v=>v===0));
console.log('Deposit cutouts: continuous coverage at poles and longitude seam; removing deposits clears both lookup and hole data; shadow wrapper shares terrain material.');

const waterTextures={};const waterCut=createWaterCutout(B,{}, {setTexture:(name,value)=>waterTextures[name]=value});
assert.notEqual(waterTextures.waterCutoutLookup,water.depositLookup);
assert(waterTextures.waterCutoutLookup.values.every(v=>v===0));
waterCut.update([{center:[1,0,0],radius:.025}]);
assert(Math.abs(waterTextures.waterCutoutCenters.values[3]-.025)<1e-8);
assert(textures[0].values.every(v=>v===0));
for(const wg of [false,true])assert(!JSON.stringify(waterCutoutShader(wg)).includes('deposit'));
waterCut.update([]);assert(waterTextures.waterCutoutLookup.values.every(v=>v===0));
