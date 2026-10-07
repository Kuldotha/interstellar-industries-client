import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {readPng} from '../tools/png.mjs';
import {fitRamp,rampStart,rampWidth,sampleAO} from '../tools/ao-ramp.mjs';
const root=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('models/project-palette/manifest.json',root))),base=readPng(new URL('models/project-palette/base-color.png',root)),orm=readPng(new URL('models/project-palette/orm.png',root)),ramp=readPng(new URL('models/project-palette/ao-gradient.png',root));
assert.equal(manifest.swatches.length,256);
assert.equal(new Set(manifest.swatches.map(s=>s.id)).size,256);
assert.equal(manifest.rows,16);assert.equal(manifest.columns,16);
for(let row=0;row<11;row++){
 const shades=manifest.swatches.slice(row*16,row*16+16);
 assert.equal(new Set(shades.map(s=>s.group)).size,1);
 const luminance=s=>s.rgb.reduce((v,c,i)=>v+c**2.2*[.2126,.7152,.0722][i],0);
 for(let i=1;i<16;i++)assert(luminance(shades[i])>=luminance(shades[i-1]));
}
for(const s of manifest.swatches){const x=Math.floor(s.uvCenter[0]*base.width),y=Math.floor((1-s.uvCenter[1])*base.height),i=(y*base.width+x)*4;assert.deepEqual(Array.from(base.pixels.slice(i,i+3)),[1,3,5].map(i=>parseInt(s.color.slice(i,i+2),16)));assert.equal(orm.pixels[i+1],Math.round(s.roughness*255));assert.equal(orm.pixels[i+2],Math.round(s.metallic*255));}
assert.deepEqual(manifest.swatches.find(s=>s.id==='land-surface').rgb,[157/255,169/255,78/255]);
assert.deepEqual(manifest.swatches.find(s=>s.id==='tree-foliage').rgb,[86/255,107/255,49/255]);
assert(manifest.swatches.some(s=>s.transmission>0));assert(manifest.swatches.some(s=>s.emissive));
const u0=rampStart+rampWidth*.1,u1=rampStart+rampWidth*10.1;
assert(u1>1);assert(sampleAO(ramp,u0+(u1-u0)*.1,.5)>.99);assert(sampleAO(ramp,u0,.5)<.11);
const samples=[];for(const x of [0,.2,.4])for(const y of [0,.025,.05,.1,.3,.5])samples.push([x,y,Math.max(0,Math.min(1,.1+10*y))]);
const fit=fitRamp(samples);assert(fit.error<1e-12);assert(Math.abs(fit.plane[2]-10)<1e-6);
const house=JSON.parse(readFileSync(new URL('public/models/house_01.json',root)));assert.equal(house.ao,'gradient');for(const part of house.parts){assert.equal(part.uvs2.length,part.positions.length/3*2);assert(part.uvs2.every(Number.isFinite));assert(part.uvs2.filter((_,i)=>i%2).every(v=>v===.5));}
assert(!existsSync(new URL('public/models/house-ao.png',root)));
console.log('Palette: art surface/prop colors, all atlas map channels, opaque/transparent glass, extended AO ramp, analytical edge falloff and UV2-only house AO pass.');
