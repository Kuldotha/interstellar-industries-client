export function createDepositCutout(B,scene,material){
  return createCutout(B,scene,material,'deposit');
}
export function createWaterCutout(B,scene,material){
  const cutout=createCutout(B,scene,null,'waterCutout');
  cutout.bind(material);
  return {update(volumes){cutout.update(volumes.map(v=>({center:v.center,width:v.radius/.40})),volumes.map(()=>true));},dispose:()=>cutout.dispose()};
}
function createCutout(B,scene,material,prefix){
  const width=512,height=256,rows=64,dataWidth=256;
  const map=new Uint8Array(width*height*4),centers=new Float32Array(dataWidth*rows*4);
  const lookup=B.RawTexture.CreateRGBATexture(map,width,height,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
  const data=B.RawTexture.CreateRGBATexture(centers,dataWidth,rows,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE,B.Engine.TEXTURETYPE_FLOAT);
  lookup.wrapU=B.Texture.WRAP_ADDRESSMODE;lookup.wrapV=B.Texture.CLAMP_ADDRESSMODE;
  class DepositCutout extends B.MaterialPluginBase{
    constructor(){super(material,'DepositCutout',210,{},true,true);}
    isCompatible(){return true;}
    getSamplers(list){list.push('depositLookup','depositCenters');}
    bindForSubMesh(buffer){buffer.setTexture('depositLookup',lookup);buffer.setTexture('depositCenters',data);}
    getCustomCode(type,language){
      if(type!=='fragment')return null;
      const wg=language===B.ShaderLanguage.WGSL;
      return depositCutoutShader(wg);
    }
  }
  if(material){
  new DepositCutout();
  material.shadowDepthWrapper=new B.ShadowDepthWrapper(material,scene,scene.getEngine().isWebGPU?{remappedVariables:['vNormalW','vertexOutputs.vNormalW']}:{});
  }
  return {
    bind(material){material.setTexture(prefix+'Lookup',lookup);material.setTexture(prefix+'Centers',data);},
    update(patches,active){
      if(patches.length>dataWidth*rows)throw new Error('Deposit cutout capacity exceeded');
      map.fill(0);centers.fill(0);
      const nearest=new Float32Array(width*height);nearest.fill(-2);
      patches.forEach((p,index)=>{
        if(!active[index])return;
        centers.set([...p.center,p.width*.40],index*4);
        const radius=Math.hypot(...p.center),up=p.center.map(x=>x/radius),angle=Math.asin(p.width*.48/radius)+Math.PI/height*2;
        const lat=Math.acos(up[1]),lon=Math.atan2(up[2],up[0]);
        const y0=Math.max(0,Math.floor((lat-angle)/Math.PI*height)),y1=Math.min(height-1,Math.ceil((lat+angle)/Math.PI*height));
        const span=lat<=angle||lat+angle>=Math.PI?Math.PI:Math.asin(Math.min(1,Math.sin(angle)/Math.sin(lat))),x0=span>=Math.PI?0:Math.floor((lon-span+Math.PI)/(2*Math.PI)*width),x1=span>=Math.PI?width-1:Math.ceil((lon+span+Math.PI)/(2*Math.PI)*width);
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const u=((x%width)+width)%width,a=(u+.5)/width*2*Math.PI-Math.PI,b=(y+.5)/height*Math.PI;
          const distance=Math.sin(b)*Math.cos(a)*up[0]+Math.cos(b)*up[1]+Math.sin(b)*Math.sin(a)*up[2];
          if(distance<Math.cos(angle)||distance<=nearest[y*width+u])continue;
          nearest[y*width+u]=distance;
          const offset=(y*width+u)*4,id=index+1;map[offset]=id%256;map[offset+1]=Math.floor(id/256);map[offset+3]=255;
        }
      });lookup.update(map);data.update(centers);
    },
    dispose(){lookup.dispose();data.dispose();}
  };
}

export function depositCutoutShader(wg){
      return wg?{
        CUSTOM_FRAGMENT_DEFINITIONS:'var depositLookup: texture_2d<f32>; var depositLookupSampler: sampler; var depositCenters: texture_2d<f32>; var depositCentersSampler: sampler;',
        CUSTOM_FRAGMENT_MAIN_BEGIN:`
let depositUp=normalize(fragmentInputs.vPositionW);
let depositUV=vec2f(atan2(depositUp.z,depositUp.x)/6.283185307+0.5,acos(clamp(depositUp.y,-1.0,1.0))/3.141592654);
let depositCode=textureSampleLevel(depositLookup,depositLookupSampler,depositUV,0.0).rg;
let depositId=floor(depositCode.x*255.0+0.5)+floor(depositCode.y*255.0+0.5)*256.0;
if(depositId>0.0){
let depositIndex=depositId-1.0;
let hole=textureSampleLevel(depositCenters,depositCentersSampler,vec2f((depositIndex%256.0+0.5)/256.0,(floor(depositIndex/256.0)+0.5)/64.0),0.0);
let delta=fragmentInputs.vPositionW-hole.xyz;let vertical=dot(delta,normalize(hole.xyz));
if(hole.w>0.0 && dot(delta,delta)-vertical*vertical<hole.w*hole.w && abs(vertical)<hole.w){discard;}
}`
      }:{
        CUSTOM_FRAGMENT_DEFINITIONS:'uniform sampler2D depositLookup; uniform sampler2D depositCenters;',
        CUSTOM_FRAGMENT_MAIN_BEGIN:`
vec3 depositUp=normalize(vPositionW);
vec2 depositUV=vec2(atan(depositUp.z,depositUp.x)/6.283185307+0.5,acos(clamp(depositUp.y,-1.0,1.0))/3.141592654);
vec2 depositCode=texture2D(depositLookup,depositUV).rg;
float depositId=floor(depositCode.x*255.0+0.5)+floor(depositCode.y*255.0+0.5)*256.0;
if(depositId>0.0){
float depositIndex=depositId-1.0;
vec4 hole=texture2D(depositCenters,vec2((mod(depositIndex,256.0)+0.5)/256.0,(floor(depositIndex/256.0)+0.5)/64.0));
vec3 delta=vPositionW-hole.xyz;float vertical=dot(delta,normalize(hole.xyz));
if(hole.w>0.0 && dot(delta,delta)-vertical*vertical<hole.w*hole.w && abs(vertical)<hole.w)discard;
}`
      };
}

export function waterCutoutShader(wg){
  return Object.fromEntries(Object.entries(depositCutoutShader(wg)).map(([key,value])=>[key,value.replaceAll('deposit','waterCutout')]));
}
