import {enableVertexAO} from './vertex-ao.js';
import {enablePlanetLighting,lightingStyle} from './lighting.js';
import {enableBuildingWrap} from './building-wrap.js';
const palettes=new WeakMap();
export async function loadPalette(B,scene){
  if(palettes.has(scene))return palettes.get(scene);
  const promise=(async()=>{
    const manifest=await(await fetch('models/palette.json')).json();
    const swatches=manifest.swatches.map(s=>({...s,rgb:s.rgb??[1,3,5].map(i=>parseInt(s.color.slice(i,i+2),16)/255)}));
    const texture=new B.Texture('models/project-base-color.png',scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
    const metal=new B.Texture('models/project-orm.png',scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);metal.gammaSpace=false;
    const emission=new B.Texture('models/project-emission.png',scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
    const ao=new B.Texture('models/ao-gradient.png',scene,false,false,B.Texture.BILINEAR_SAMPLINGMODE);ao.gammaSpace=false;ao.coordinatesIndex=1;ao.wrapU=ao.wrapV=B.Texture.CLAMP_ADDRESSMODE;
    const faces=Array.from({length:6},(_,face)=>{const data=new Uint8Array(16*16*3);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const t=face===2?1:face===3?0:1-y/15;for(let c=0;c<3;c++)data[(y*16+x)*3+c]=Math.round(90*(1-t)+210*t);}return data;});
    const environment=new B.RawCubeTexture(scene,faces,16,B.Engine.TEXTUREFORMAT_RGB,B.Engine.TEXTURETYPE_UNSIGNED_BYTE,true,false,B.Texture.TRILINEAR_SAMPLINGMODE);environment.level=.55;
    const palette={columns:manifest.columns,rows:manifest.rows,swatches,texture,metal,emission,ao,environment,matches:new Map()};scene.metadata={...scene.metadata,palette};return palette;
  })();palettes.set(scene,promise);return promise;
}
export function nearestSwatch(scene,rgb,metallic=false){
  const swatches=scene.metadata?.palette?.swatches;
  if(!swatches)return {rgb,metallic:0,roughness:.85,uvCenter:[.5,.5]};
  const matches=scene.metadata.palette.matches,key=Array.from(rgb).join(',')+':'+metallic;
  if(matches.has(key))return matches.get(key);
  let best=null,distance=Infinity;
  for(const s of swatches){if(s.emissive||s.opacity<1||Boolean(s.metallic)!==metallic)continue;const d=s.rgb.reduce((sum,v,i)=>sum+(v-rgb[i])**2,0);if(d<distance){distance=d;best=s;}}
  matches.set(key,best);return best;
}
export function opaqueMaterial(B,scene,name,rgb=null,{metallic=false,atlas=false}={}){
  const palette=scene.metadata?.palette;
  const material=new B.PBRMaterial(name,scene);
  material.ambientColor=B.Color3.Black();
  material.metallicF0Factor=lightingStyle.dielectricReflection;
  material.backFaceCulling=false;material.metallic=0;material.roughness=.85;
  if(palette){material.reflectionTexture=palette.environment;material.environmentIntensity=lightingStyle.reflection;}
  if(atlas&&palette){
    material.ambientTexture=palette.ao;material.ambientTextureStrength=.7;material.ambientTextureImpactOnAnalyticalLights=0;
    material.albedoTexture=palette.texture;material.metallicTexture=palette.metal;
    material.metallic=material.roughness=1;
    material.useRoughnessFromMetallicTextureAlpha=false;material.useRoughnessFromMetallicTextureGreen=true;material.useMetallnessFromMetallicTextureBlue=true;
    material.emissiveTexture=palette.emission;material.emissiveColor=B.Color3.White();material.emissiveIntensity=.7;
  }else if(rgb){const s=nearestSwatch(scene,rgb,metallic);material.albedoColor=new B.Color3(...s.rgb).toLinearSpace();material.metallic=s.metallic;material.roughness=s.roughness;}
  enableVertexAO(B,material);enablePlanetLighting(B,scene,material);
  return material;
}
export function applySwatch(B,mesh,swatch,material){
  const uvs=new Float32Array(mesh.getTotalVertices()*2);
  for(let i=0;i<uvs.length;i+=2){uvs[i]=swatch.uvCenter[0];uvs[i+1]=1-swatch.uvCenter[1];}
  mesh.setVerticesData(B.VertexBuffer.UVKind,uvs);
  if(!mesh.isVerticesDataPresent?.(B.VertexBuffer.UV2Kind))mesh.setVerticesData(B.VertexBuffer.UV2Kind,whiteAO(mesh.getTotalVertices()));
  mesh.material=material;
}

export function whiteAO(vertices){return Float32Array.from({length:vertices*2},(_,i)=>i%2?.5:1);}
export function buildingPaletteMaterial(B,scene){
  const palette=scene.metadata.palette;
  if(!palette.buildingMaterial){palette.buildingMaterial=opaqueMaterial(B,scene,'building-palette',null,{atlas:true});enableBuildingWrap(B,palette.buildingMaterial,scene);}
  return palette.buildingMaterial;
}
export function groundMaterial(B,scene,name){
  const material=opaqueMaterial(B,scene,name);
  class GroundColorSpace extends B.MaterialPluginBase{
    constructor(){super(material,'GroundColorSpace',210,{},true,true);}
    isCompatible(){return true;}
    getCustomCode(stage,language){return stage==='fragment'?{CUSTOM_FRAGMENT_UPDATE_ALBEDO:`surfaceAlbedo=${language===B.ShaderLanguage.WGSL?'toLinearSpaceVec3':'toLinearSpace'}(surfaceAlbedo);`}:null;}
  }
  new GroundColorSpace();return material;
}

export function paletteSwatch(scene,id,fallback){return scene.metadata?.palette?.swatches.find(s=>s.id===id)||nearestSwatch(scene,fallback);}
