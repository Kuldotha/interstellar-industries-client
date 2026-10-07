export const facetStyles={
  ground:{scale:30,tint:.035,normal:.025,sizeVariation:.12},
  stone:{scale:170,tint:.10,normal:.12,sizeVariation:.08},
  bedrock:{scale:65,tint:.07,normal:.08,sizeVariation:.10}
};

export function enableFacets(B,material,style,{roots=false,instances=false}={}) {
  const number=v=>Number(v).toFixed(6);
  class FacetMaterial extends B.MaterialPluginBase {
    constructor(){super(material,'SpatialFacets',220,{},true,true);}
    isCompatible(){return true;}
    getCustomCode(type,language){
      const wg=language===B.ShaderLanguage.WGSL;
      const vec=wg?'vec3f':'vec3',v4=wg?'vec4f':'vec4';
      const decl=(name,value,kind=vec)=>wg?`var ${name}: ${kind}=${value};`:`${kind} ${name}=${value};`;
      const varying=wg?'varying facetAnchor: vec3f;':'varying vec3 facetAnchor;';
      if(type==='vertex')return roots||instances?{
        CUSTOM_VERTEX_DEFINITIONS:varying,
        CUSTOM_VERTEX_MAIN_END:`${wg?'vertexOutputs.':''}facetAnchor=finalWorld[3].xyz;`
      }:null;
      if(type!=='fragment')return null;
      const inputs=wg?'fragmentInputs.':'';
      const position=roots?`(${inputs}facetAnchor+normalize(${inputs}facetAnchor)*0.00015)`:`${inputs}vPositionW`;
      const definitions=`${roots||instances?varying:''}
${wg?'fn facetHash(p: vec3f) -> vec3f':'vec3 facetHash(vec3 p)'} {
return fract(sin(${vec}(dot(p,${vec}(127.1,311.7,74.7)),dot(p,${vec}(269.5,183.3,246.1)),dot(p,${vec}(113.5,271.9,124.6))))*43758.5453);
}
${wg?'fn facetCell(p: vec3f) -> vec3f':'vec3 facetCell(vec3 p)'} {
${decl('grid','floor(p)')}${decl('local','fract(p)')}${decl('closest','100.0',wg?'f32':'float')}${decl('cell',`${vec}(0.0)`)}
for(${wg?'var z: i32':'int z'}=-1;z<=1;z++){
for(${wg?'var y: i32':'int y'}=-1;y<=1;y++){
for(${wg?'var x: i32':'int x'}=-1;x<=1;x++){
${decl('offset',`${vec}(${wg?'f32':'float'}(x),${wg?'f32':'float'}(y),${wg?'f32':'float'}(z))`)}
${decl('seed','facetHash(grid+offset)')}${decl('delta','offset+0.5+(seed-0.5)*0.8-local')}
${decl('distance',`dot(delta,delta)-(seed.z*2.0-1.0)*${number(style.sizeVariation??0)}`,wg?'f32':'float')}
if(distance<closest){closest=distance;cell=seed;}
}}}return cell;
}`;
      return {
        CUSTOM_FRAGMENT_DEFINITIONS:definitions,
        CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
${decl('facetSeed',`facetCell(${position}*${number(style.scale)}${instances?`+${inputs}facetAnchor*137.0`:''})`)}
${decl('facetShade',`1.0+(facetSeed.x*2.0-1.0)*${number(style.tint)}`,wg?'f32':'float')}
${decl('facetWarmth',`(facetSeed.y*2.0-1.0)*${number(style.tint*.22)}`,wg?'f32':'float')}
${material.getClassName()==='PBRMaterial'?`surfaceAlbedo=surfaceAlbedo*facetShade*${vec}(1.0+facetWarmth,1.0,1.0-facetWarmth);`:`baseColor=${v4}(baseColor.rgb*facetShade*${vec}(1.0+facetWarmth,1.0,1.0-facetWarmth),baseColor.a);`}
${style.normal?`${decl('facetDirection','facetSeed*2.0-1.0')}
${decl('facetTangent','facetDirection-normalW*dot(facetDirection,normalW)')}
facetTangent=facetTangent/max(length(facetTangent),0.0001);
normalW=normalize(mix(normalW,normalize(normalW+facetTangent),${number(style.normal)}));`:''}`
      };
    }
  }
  return new FacetMaterial();
}
