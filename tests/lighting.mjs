import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createLighting,daylightFill,waterLightingUniforms,lightingStyle} from '../public/lighting.js';
import {normalMaterial} from '../public/normal-material.js';
import {opaqueMaterial} from '../public/palette-material.js';
const B=createRequire(import.meta.url)('../public/vendor/babylon-9.28.0.js'),engine=new B.NullEngine(),scene=new B.Scene(engine);
try{
  const {sun,cameraFill,bindWater}=createLighting(B,scene),values={};
  const effect={setFloat:(name,v)=>values[name]=v,setVector3:(name,v)=>values[name]=v.asArray(),setColor3:(name,v)=>values[name]=v.asArray()};
  bindWater(effect);assert.deepEqual(scene.ambientColor.asArray(),[0,0,0]);assert.equal(scene.environmentIntensity,1);
  assert.equal(values.lightingFill,lightingStyle.fill);assert.equal(sun.intensity,Math.PI*.9);
  assert.equal(daylightFill(-1),lightingStyle.ambient);assert.equal(daylightFill(-.12),lightingStyle.ambient);assert.equal(daylightFill(1),lightingStyle.ambient+lightingStyle.fill);
  assert(daylightFill(0)>lightingStyle.ambient&&daylightFill(0)<lightingStyle.ambient+lightingStyle.fill);assert.equal(values.lightingAmbient,lightingStyle.ambient);
  sun.diffuse=new B.Color3(.3,.5,.7);sun.intensity=2;sun.direction=new B.Vector3(0,-1,0);bindWater(effect);
  assert.deepEqual(values.lightingSunDirection.map(v=>v||0),[0,1,0]);assert.deepEqual(values.lightingSunColor,[.6,1,1.4]);
  sun.setEnabled(false);bindWater(effect);assert.deepEqual(values.lightingSunColor,[0,0,0]);assert.equal(values.lightingFill,0);assert.equal(values.lightingAmbient,lightingStyle.ambient);
  const camera=new B.FreeCamera('test-camera',new B.Vector3(0,0,-5),scene);camera.setTarget(B.Vector3.Zero());scene.render();bindWater(effect);assert.equal(cameraFill.shadowEnabled,false);assert.deepEqual(cameraFill.specular.asArray(),[0,0,0]);
  assert(cameraFill.direction.equalsWithEpsilon(camera.getForwardRay().direction));const firstDirection=values.lightingCameraDirection;
  camera.position.set(5,0,0);camera.setTarget(B.Vector3.Zero());scene.render();bindWater(effect);assert(cameraFill.direction.equalsWithEpsilon(camera.getForwardRay().direction));assert.notDeepEqual(values.lightingCameraDirection,firstDirection);assert(values.lightingCameraColor[0]>0);
  cameraFill.setEnabled(false);bindWater(effect);assert.deepEqual(values.lightingCameraColor,[0,0,0]);
  const material=opaqueMaterial(B,scene,'test');assert.equal(material.metallicF0Factor,.25);
  assert(material.pluginManager.getPlugin('PlanetLighting'));
  for(const webgpu of [false,true]){
    let shader;
    const mock={...B,ShaderMaterial:class{constructor(name,scene,path,options){shader={...path,options};}setFloat(){}setVector3(){}}};
    normalMaterial(mock,scene,webgpu,true);
    assert.equal(shader.fragmentSource.includes('visibility/3.141592654'),true);
    assert.equal(shader.fragmentSource.includes('return pow(max(c,'),true);
    for(const term of ['waterIncident','waterCutoutId','transmission','waterToDisplay(mix(body+highlights,','smoothstep(-0.12,0.25'])assert(shader.fragmentSource.includes(term));
    for(const term of ['volumeVisibility','waterGradient','causticPattern','candidateUV','lightingEnvironment','lightingAmbientColor','shallows','mix(0.15,1.0,volumeVisibility)'])assert(!shader.fragmentSource.includes(term));
    for(const name of waterLightingUniforms)assert(shader.options.uniforms.includes(name));
  }
  console.log('Lighting: neutral calibrated sun, nonzero night fill, daylight fill, disabled sun, matte reflectance, and PBR water paths pass for GLSL and WGSL.');
}finally{scene.dispose();engine.dispose();}
