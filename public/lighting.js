export const lightingStyle=Object.freeze({sun:Math.PI*.9,fill:.09,ambient:.025,cameraFill:Math.PI*.32,reflection:.65,dielectricReflection:.25});

export function createLighting(B,scene){
  scene.environmentIntensity=1;
  scene.ambientColor=B.Color3.Black();
  scene.imageProcessingConfiguration.toneMappingEnabled=false;
  scene.imageProcessingConfiguration.exposure=1;
  scene.imageProcessingConfiguration.contrast=1;
  const sun=new B.DirectionalLight('sun',new B.Vector3(-1,-.6,-.8),scene);
  sun.intensity=lightingStyle.sun;
  sun.diffuse=B.Color3.White();sun.position=new B.Vector3(3,2,2.4);
  const cameraFill=new B.DirectionalLight('camera-fill',new B.Vector3(0,-1,0),scene);
  cameraFill.intensity=lightingStyle.cameraFill;
  cameraFill.diffuse=B.Color3.White();cameraFill.specular=B.Color3.Black();cameraFill.shadowEnabled=false;
  const followCamera=()=>{const camera=scene.activeCamera;if(camera)cameraFill.direction.copyFrom(camera.getForwardRay().direction);};
  scene.onBeforeRenderObservable.add(followCamera);followCamera();
  const lighting={sun,cameraFill,fill:lightingStyle.fill,ambient:lightingStyle.ambient};
  scene.metadata={...scene.metadata,lighting};
  function bindWater(effect){
    effect.setVector3('lightingSunDirection',sun.direction.negate().normalize());
    effect.setColor3('lightingSunColor',sun.diffuse.scale(sun.getScaledIntensity()*(sun.isEnabled()?1:0)));
    effect.setFloat('lightingFill',sun.isEnabled()?lighting.fill:0);
    effect.setFloat('lightingAmbient',lighting.ambient);
    followCamera();effect.setVector3('lightingCameraDirection',cameraFill.direction.negate().normalize());
    effect.setColor3('lightingCameraColor',cameraFill.diffuse.scale(cameraFill.getScaledIntensity()*(cameraFill.isEnabled()?1:0)));
  }
  return {...lighting,bindWater};
}

export function daylightFill(cosine,strength=lightingStyle.fill,ambient=lightingStyle.ambient){
  const t=Math.max(0,Math.min(1,(cosine+.12)/.37));
  return ambient+strength*t*t*(3-2*t);
}

export function enablePlanetLighting(B,scene,material){
  class PlanetLighting extends B.MaterialPluginBase{
    constructor(){super(material,'PlanetLighting',230,{},true,true);}
    isCompatible(){return true;}
    getUniforms(language){
      return {ubo:[{name:'planetSunDirection',size:3,type:'vec3'},{name:'planetFill',size:1,type:'float'},{name:'planetAmbient',size:1,type:'float'}],
        fragment:language===B.ShaderLanguage.WGSL?'':'#ifndef UNIFORMBUFFERS\nuniform vec3 planetSunDirection;\nuniform float planetFill;\nuniform float planetAmbient;\n#endif'};
    }
    bindForSubMesh(buffer){
      const state=scene.metadata?.lighting,sun=state?.sun;
      const direction=sun?.direction.negate().normalize();
      buffer.updateFloat3('planetSunDirection',direction?.x??0,direction?.y??1,direction?.z??0);
      buffer.updateFloat('planetFill',sun?.isEnabled()?state.fill:0);
      buffer.updateFloat('planetAmbient',state?.ambient??0);
    }
    getCustomCode(stage,language){
      if(stage!=='fragment')return null;
      const wg=language===B.ShaderLanguage.WGSL,u=wg?'uniforms.':'',p=wg?'fragmentInputs.vPositionW':'vPositionW';
      const fill=`${u}planetAmbient+${u}planetFill*smoothstep(-0.12,0.25,dot(normalize(${p}),${u}planetSunDirection))`;
      const reflection={CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION:`#if defined(REFLECTION) && !defined(UNLIT)
finalIrradiance=vec3${wg?'f':''}(0.0);
finalRadianceScaled*=mix(0.3,1.0,smoothstep(-0.12,0.25,dot(normalize(${p}),${u}planetSunDirection)));
#endif`};
      return {...reflection,CUSTOM_FRAGMENT_BEFORE_FOG:`#ifndef UNLIT\nfinalColor=vec4${wg?'f':''}(finalColor.rgb+mix(surfaceAlbedo,reflectivityOut.colorReflectanceF0,reflectivityOut.metallic)*aoOut.ambientOcclusionColor*(${fill})*mix(1.0,0.65,reflectivityOut.metallic),finalColor.a);
finalColor=vec4${wg?'f':''}(finalColor.rgb/max(1.0,max(finalColor.r,max(finalColor.g,finalColor.b))),finalColor.a);\n#endif`};
    }
  }
  return new PlanetLighting();
}

export const waterLightingUniforms=['lightingSunDirection','lightingSunColor','lightingFill','lightingAmbient','lightingCameraDirection','lightingCameraColor'];
export function waterLightingShader(wg){
  const v=wg?'vec3f':'vec3',u=wg?'uniforms.':'';
  const fn=(name,args,type,body)=>wg?`fn ${name}(${args.map(([n,t])=>`${n}:${t}`).join(',')})->${type}{${body}}`:`${type} ${name}(${args.map(([n,t])=>`${t} ${n}`).join(',')}){${body}}`;
  return (wg?'uniform lightingSunDirection: vec3f;\nuniform lightingSunColor: vec3f;\nuniform lightingFill: f32;\nuniform lightingAmbient: f32;\nuniform lightingCameraDirection: vec3f;\nuniform lightingCameraColor: vec3f;':'uniform vec3 lightingSunDirection;\nuniform vec3 lightingSunColor;\nuniform float lightingFill;\nuniform float lightingAmbient;\nuniform vec3 lightingCameraDirection;\nuniform vec3 lightingCameraColor;')+'\n'+
    fn('waterToLinear',[['c',v]],v,`return pow(max(c,${v}(0.0)),${v}(2.2));`)+'\n'+
    fn('waterToDisplay',[['c',v]],v,`return pow(max(c,${v}(0.0))/max(1.0,max(c.r,max(c.g,c.b))),${v}(1.0/2.2));`)+'\n'+
    fn('waterIncident',[['n',v],['visibility',wg?'f32':'float']],v,`return ${v}(${u}lightingAmbient+${u}lightingFill*smoothstep(-0.12,0.25,dot(n,${u}lightingSunDirection)))+${u}lightingSunColor*max(0.0,dot(n,${u}lightingSunDirection))*visibility/3.141592654+${u}lightingCameraColor*max(0.0,dot(n,${u}lightingCameraDirection))/3.141592654;`);
}
