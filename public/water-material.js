import {vertexWGSL,vertexGLSL,fragmentWGSL,fragmentGLSL} from './water-shaders.js';
import {waterLightingShader,waterLightingUniforms} from './lighting.js';
import {waterCutoutShader} from './deposit-cutout.js?v=2';
export function createWaterMaterial(B,scene,webgpu){
  const cut=waterCutoutShader(webgpu),lighting=waterLightingShader(webgpu);
  let fragment=webgpu?fragmentWGSL:fragmentGLSL;
  const declarations=lighting+'\n'+cut.CUSTOM_FRAGMENT_DEFINITIONS+'\n';
  const cutout=cut.CUSTOM_FRAGMENT_MAIN_BEGIN.replaceAll(webgpu?'fragmentInputs.vPositionW':'vPositionW',webgpu?'fragmentInputs.vPosition':'vPosition');
  if(webgpu)fragment=declarations+fragment.replace('fn main(input: FragmentInputs) -> FragmentOutputs {','fn main(input: FragmentInputs) -> FragmentOutputs {\n'+cutout);
  else fragment=fragment.replace('void main() {',declarations+'\nvoid main() {\n'+cutout);
  const material=new B.ShaderMaterial('cartoon-water',scene,{vertexSource:webgpu?vertexWGSL:vertexGLSL,fragmentSource:fragment},{
    attributes:['position','normalA','normalB','normalC','tintA','tintB','tintC'],
    uniforms:['world','viewProjection','normalMode','waterTime','eye','waterColor','coastWidth','shadowMatrix','shadowsEnabled','waterProjection','waterInverse','seaRadius','waterDensity',...waterLightingUniforms],
    samplers:['waterCutoutLookup','waterCutoutCenters','coastShadow','shoreSegments','objectSegments','underwaterColor','underwaterDepth'],
    needAlphaBlending:true,uniformBuffers:webgpu?['Scene','Mesh']:[],shaderLanguage:webgpu?B.ShaderLanguage.WGSL:B.ShaderLanguage.GLSL
  });
  material.backFaceCulling=false;material.disableDepthWrite=false;material.forceDepthWrite=true;
  material.setFloat('normalMode',0);material.setFloat('waterTime',0);material.setVector3('eye',B.Vector3.Zero());
  return material;
}
