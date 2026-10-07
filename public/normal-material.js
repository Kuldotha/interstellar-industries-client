import {createWaterMaterial} from './water-material.js';
export function normalMaterial(B, scene, webgpu, water = false) {
  if(water)return createWaterMaterial(B,scene,webgpu);
  let shared = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>
#include<instancesDeclaration>
attribute position: vec3<f32>;
attribute normalA: vec3<f32>;
attribute normalB: vec3<f32>;
attribute normalC: vec3<f32>;
attribute tintA: vec4<f32>;
attribute tintB: vec4<f32>;
attribute tintC: vec4<f32>;
varying vNormal: vec3<f32>;
varying vFace: vec3<f32>;
varying vColor: vec4<f32>;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
#include<instancesVertex>
 vertexOutputs.position = scene.viewProjection * finalWorld * vec4<f32>(vertexInputs.position, 1.0);
 var normal = vertexInputs.normalC;
 if (vertexInputs.position.x < -0.75) { normal = vertexInputs.normalA; }
 if (vertexInputs.position.x > -0.25) { normal = vertexInputs.normalB; }
 vertexOutputs.vNormal = normal;
 vertexOutputs.vFace = -normalize(finalWorld[2].xyz);
 vertexOutputs.vColor = vertexInputs.tintC;
 if (vertexInputs.position.x < -0.75) { vertexOutputs.vColor = vertexInputs.tintA; }
 if (vertexInputs.position.x > -0.25) { vertexOutputs.vColor = vertexInputs.tintB; }
}`;
  let fragment = `
varying vNormal: vec3<f32>;
varying vFace: vec3<f32>;
varying vColor: vec4<f32>;
uniform normalMode: f32;
@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {
 var n = normalize(fragmentInputs.vNormal);
 if (uniforms.normalMode > 0.5 && uniforms.normalMode < 1.5) { n = normalize(fragmentInputs.vFace); }
 if (uniforms.normalMode > 1.5) {
   fragmentOutputs.color = vec4<f32>(n * 0.5 + vec3<f32>(0.5), 1.0);
 } else {
   let hemi = 0.5 + 0.5 * dot(n, normalize(vec3<f32>(0.3,1.0,0.2)));
   let sun = max(0.0, dot(n, normalize(vec3<f32>(1.0,0.6,0.8))));
   let light = mix(vec3<f32>(0.16,0.22,0.28),vec3<f32>(0.70),hemi) + vec3<f32>(sun * 0.55);
   fragmentOutputs.color = vec4<f32>(fragmentInputs.vColor.rgb * light, 1.0);
 }
}`;
  let glVertex = `precision highp float;
attribute vec3 position;
attribute vec3 normalA;
attribute vec3 normalB;
attribute vec3 normalC;
attribute vec4 tintA;
attribute vec4 tintB;
attribute vec4 tintC;
uniform mat4 viewProjection;
#include<instancesDeclaration>
varying vec3 vNormal;
varying vec3 vFace;
varying vec4 vColor;
void main() {
#include<instancesVertex>
 gl_Position = viewProjection * finalWorld * vec4(position,1.0);
 vNormal = position.x < -0.75 ? normalA : (position.x > -0.25 ? normalB : normalC);
 vFace = -normalize(finalWorld[2].xyz);
 vColor = position.x < -0.75 ? tintA : (position.x > -0.25 ? tintB : tintC);
}`;
  let glFragment = `precision highp float;
varying vec3 vNormal;
varying vec3 vFace;
varying vec4 vColor;
uniform float normalMode;
void main() {
 vec3 n=normalize(vNormal);
 if(normalMode>0.5 && normalMode<1.5) n=normalize(vFace);
 if(normalMode>1.5) { gl_FragColor=vec4(n*0.5+0.5,1.0); }
 else {
 float hemi=0.5+0.5*dot(n,normalize(vec3(0.3,1.0,0.2)));
 float sun=max(0.0,dot(n,normalize(vec3(1.0,0.6,0.8))));
 vec3 light=mix(vec3(0.16,0.22,0.28),vec3(0.70),hemi)+vec3(sun*0.55);
 gl_FragColor=vec4(vColor.rgb*light,1.0);
 }
}`;
  const material=new B.ShaderMaterial('deformed-normals',scene,{vertexSource:webgpu?shared:glVertex,fragmentSource:webgpu?fragment:glFragment},{attributes:['position','normalA','normalB','normalC','tintA','tintB','tintC'],uniforms:['world','viewProjection','normalMode'],uniformBuffers:webgpu?['Scene','Mesh']:[],shaderLanguage:webgpu?B.ShaderLanguage.WGSL:B.ShaderLanguage.GLSL});
  material.backFaceCulling=false;material.setFloat('normalMode',0);return material;
}
