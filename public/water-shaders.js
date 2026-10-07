export const vertexWGSL = `
uniform seaRadius: f32;
varying vObjectRange: vec2f;
varying coast5: vec3f;
varying coast4: vec3f;
varying coast3: vec3f;
varying coast2: vec3f;
varying coast1: vec3f;
varying coast0: vec3f;

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
varying vPosition: vec3<f32>;
varying vNormal: vec3<f32>;
varying vFace: vec3<f32>;
varying vColor: vec4<f32>;
@vertex
fn main(input: VertexInputs) -> FragmentInputs {
#include<instancesVertex>
 vertexOutputs.vObjectRange=vec2f(vertexInputs.tintA.w,vertexInputs.tintB.w);
 vertexOutputs.vPosition = normalize((finalWorld * vec4<f32>(vertexInputs.position,1.0)).xyz)*uniforms.seaRadius;
 vertexOutputs.position = scene.viewProjection * vec4f(vertexOutputs.vPosition,1.0);
 var normal = vertexInputs.normalC;
 if (vertexInputs.position.x < -0.75) { normal = vertexInputs.normalA; }
 if (vertexInputs.position.x > -0.25) { normal = vertexInputs.normalB; }
 vertexOutputs.coast0=vertexInputs.normalA.xyz;
 vertexOutputs.coast1=vertexInputs.normalB.xyz;
 vertexOutputs.coast2=vertexInputs.normalC.xyz;
 vertexOutputs.coast3=vertexInputs.tintA.xyz;
 vertexOutputs.coast4=vertexInputs.tintB.xyz;
 vertexOutputs.coast5=vertexInputs.tintC.xyz;
 vertexOutputs.vNormal = normalize(vertexOutputs.vPosition);
 vertexOutputs.vFace = -normalize(finalWorld[2].xyz);
 vertexOutputs.vColor = vertexInputs.tintC;
 if (vertexInputs.position.x < -0.75) { vertexOutputs.vColor = vertexInputs.tintA; }
 if (vertexInputs.position.x > -0.25) { vertexOutputs.vColor = vertexInputs.tintB; }
}
`;

export const fragmentWGSL = `



uniform waterProjection: mat4x4f;
uniform waterInverse: mat4x4f;
uniform seaRadius: f32;
uniform waterDensity: f32;
var underwaterColor: texture_2d<f32>;
var underwaterColorSampler: sampler;
var underwaterDepth: texture_depth_2d;
varying vObjectRange: vec2f;
var objectSegments: texture_2d<f32>;
fn objectPoint(index:i32)->vec3f {return textureLoad(objectSegments,vec2i(index%256,index/256),0).xyz;}
uniform shadowMatrix: mat4x4f;
uniform shadowsEnabled: f32;
var coastShadowSampler: sampler_comparison;
var coastShadow: texture_depth_2d;
fn waterShadow(p:vec3f)->f32 {
 let clip=uniforms.shadowMatrix*vec4f(p,1.0);let ndc=clip.xyz/clip.w;
 let uv=ndc.xy*0.5+vec2f(0.5);let depth=clamp(ndc.z-0.0002,0.0,0.999999);
 if(uniforms.shadowsEnabled<0.5 || uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0){return 1.0;}
 return textureSampleCompareLevel(coastShadow,coastShadowSampler,uv,depth);
}
uniform waterColor: vec4f;
uniform coastWidth: f32;
varying coast5: vec3f;
varying coast4: vec3f;
varying coast3: vec3f;
varying coast2: vec3f;
varying coast1: vec3f;
varying coast0: vec3f;

varying vPosition: vec3<f32>;
uniform waterTime: f32;
uniform eye: vec3<f32>;
varying vNormal: vec3<f32>;
varying vFace: vec3<f32>;
varying vColor: vec4<f32>;
uniform normalMode: f32;
fn waterHash(p: vec3f) -> f32 { return fract(sin(dot(p,vec3f(127.1,311.7,74.7)))*43758.5453); }
fn waterNoise(p: vec3f) -> f32 {
 let i=floor(p);let f=fract(p);let u=f*f*(vec3f(3.0)-2.0*f);
 return mix(mix(mix(waterHash(i),waterHash(i+vec3f(1,0,0)),u.x),mix(waterHash(i+vec3f(0,1,0)),waterHash(i+vec3f(1,1,0)),u.x),u.y),mix(mix(waterHash(i+vec3f(0,0,1)),waterHash(i+vec3f(1,0,1)),u.x),mix(waterHash(i+vec3f(0,1,1)),waterHash(i+vec3f(1,1,1)),u.x),u.y),u.z);
}
fn coastDistance(p:vec3f,a:vec3f,b:vec3f)->f32 {let ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/max(dot(ab,ab),0.0000001),0.0,1.0));}
var shoreSegments: texture_2d<f32>;
fn shorePoint(id:i32,endpoint:i32)->vec3f {
 let a=round(textureLoad(shoreSegments,vec2i(endpoint*2,id),0)*255.0);
 let b=round(textureLoad(shoreSegments,vec2i(endpoint*2+1,id),0)*255.0);
 return vec3f(a.x*256.0+a.y,a.z*256.0+a.w,b.x*256.0+b.y)*(4.0/65535.0)-vec3f(2.0);
}


@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {

 var n = normalize(fragmentInputs.vNormal);
 if (uniforms.normalMode > 0.5 && uniforms.normalMode < 1.5) { n = normalize(fragmentInputs.vFace); }
 if (uniforms.normalMode > 1.5) {
   fragmentOutputs.color = vec4<f32>(n * 0.5 + vec3<f32>(0.5), 1.0);
 } else {
   

   let p = fragmentInputs.vPosition;
   let direction=normalize(p);
   let view = normalize(uniforms.eye-p);
   let rim = pow(1.0-clamp(dot(n,view),0.0,1.0),3.0);
   let t=uniforms.waterTime*0.012;
   let q=vec3f(direction.x*cos(t)-direction.z*sin(t),direction.y,direction.x*sin(t)+direction.z*cos(t))*28.0;
   let wave=waterNoise(q)+0.25*waterNoise(q*2.13+vec3f(17.0));
   let stripe=(smoothstep(0.62,0.66,wave)-smoothstep(0.68,0.72,wave))*0.10;

   var distance=10.0;
   let coastIndices=array<vec3f,6>(fragmentInputs.coast0,fragmentInputs.coast1,fragmentInputs.coast2,fragmentInputs.coast3,fragmentInputs.coast4,fragmentInputs.coast5);
   for(var i:i32=0;i<6;i++){for(var j:i32=0;j<3;j++){
     let id=i32(round(coastIndices[i][j]));
     if(id>=0){distance=min(distance,coastDistance(p,shorePoint(id,0),shorePoint(id,1)));}
   }}
   let terrainShore=distance/uniforms.coastWidth;
   var objectDistance=10.0;
   for(var item:i32=0;item<i32(fragmentInputs.vObjectRange.y);item++){
     let index=(i32(fragmentInputs.vObjectRange.x)+item)*2;
     objectDistance=min(objectDistance,coastDistance(p,objectPoint(index),objectPoint(index+1)));
   }
   let objectShore=objectDistance/uniforms.coastWidth;
   let shore=min(terrainShore,objectShore);
   let breakup=waterNoise(direction*135.0+vec3f(uniforms.waterTime*0.06));
   let contactBreath=1.0+0.2*sin(uniforms.waterTime*1.25+waterNoise(direction*8.0)*6.283185);
   let edge=max(1.0-smoothstep(0.22+breakup*0.035,0.32+breakup*0.045,terrainShore/contactBreath),1.0-smoothstep(0.065+breakup*0.01,0.10+breakup*0.014,objectShore/contactBreath));
   let phase=fract(shore*1.6+uniforms.waterTime*0.22+breakup*0.08);
   let waveBreaks=smoothstep(0.38,0.50,0.75*waterNoise(direction*48.0+vec3f(uniforms.waterTime*0.035))+0.25*waterNoise(direction*113.0+vec3f(19.0)));
   let crest=(1.0-smoothstep(0.03,0.13,abs(phase-0.5)))*(1.0-smoothstep(0.3,1.8,shore))*0.55*waveBreaks;
   let visibility=waterShadow(p);
 let light=waterIncident(n,visibility);
   let illumination=light;
   let foam=clamp(max(edge,crest),0.0,1.0);
   
   let refractClip=uniforms.waterProjection*vec4f(p,1.0);
   let refractNdc=refractClip.xyz/refractClip.w;
   let refractUV=refractNdc.xy*0.5+vec2f(0.5);
   let depthSize=textureDimensions(underwaterDepth);
   let baseDepth=textureLoad(underwaterDepth,vec2i(clamp(refractUV,vec2f(0.001),vec2f(0.999))*vec2f(depthSize)),0);
   let baseWorld=uniforms.waterInverse*vec4f(refractNdc.xy,baseDepth,1.0);
   let basePoint=baseWorld.xyz/baseWorld.w;
   let viewRay=normalize(p-uniforms.eye);
   let eyeProjection=dot(uniforms.eye,viewRay);
   let discriminant=eyeProjection*eyeProjection+uniforms.seaRadius*uniforms.seaRadius-dot(uniforms.eye,uniforms.eye);
   let halfChord=sqrt(max(0.0,discriminant));
   let entry=max(0.0,-eyeProjection-halfChord);
   let exit=-eyeProjection+halfChord;
   var end=exit;
   if(baseDepth<0.999999){end=min(exit,dot(basePoint-uniforms.eye,viewRay));}
   var waterDistance=max(0.0,end-entry);
   if(discriminant<=0.0){waterDistance=0.0;}
   let background=waterToLinear(textureSampleLevel(underwaterColor,underwaterColorSampler,refractUV,0.0).rgb);
   let transmission=exp(-uniforms.waterDensity*waterDistance);
   let submerged=mix(waterToLinear(uniforms.waterColor.rgb)*light,background,transmission);
   let reflection=waterToLinear(uniforms.waterColor.rgb)*light;
   let body=mix(submerged,reflection,rim*0.12);
   let highlights=waterToLinear(vec3f(0.18,0.42,0.46))*stripe*illumination;
   fragmentOutputs.color=vec4f(waterToDisplay(mix(body+highlights,waterToLinear(vec3f(0.94,0.98,1.0))*illumination,foam)),1.0);
 }
}
`;

export const vertexGLSL = `
varying vec2 vObjectRange;
varying vec3 coast5;
varying vec3 coast4;
varying vec3 coast3;
varying vec3 coast2;
varying vec3 coast1;
varying vec3 coast0;
precision highp float;
uniform float seaRadius;
attribute vec3 position;
attribute vec3 normalA;
attribute vec3 normalB;
attribute vec3 normalC;
attribute vec4 tintA;
attribute vec4 tintB;
attribute vec4 tintC;
uniform mat4 viewProjection;
#include<instancesDeclaration>
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vFace;
varying vec4 vColor;
void main() {
#include<instancesVertex>
 vObjectRange=vec2(tintA.w,tintB.w);
 vPosition=normalize((finalWorld*vec4(position,1.0)).xyz)*seaRadius;
 gl_Position = viewProjection * vec4(vPosition,1.0);
 vNormal = position.x < -0.75 ? normalA : (position.x > -0.25 ? normalB : normalC);
 coast0=normalA.xyz;
 coast1=normalB.xyz;
 coast2=normalC.xyz;
 coast3=tintA.xyz;
 coast4=tintB.xyz;
 coast5=tintC.xyz;
 vNormal=normalize(vPosition);
 vFace = -normalize(finalWorld[2].xyz);
 vColor = position.x < -0.75 ? tintA : (position.x > -0.25 ? tintB : tintC);
}
`;

export const fragmentGLSL = `
precision highp float;
uniform mat4 waterProjection;
uniform mat4 waterInverse;
uniform float seaRadius;
uniform float waterDensity;
uniform sampler2D underwaterColor;
uniform sampler2D underwaterDepth;
uniform vec4 waterColor;
uniform float coastWidth;
varying vec3 coast5;
varying vec3 coast4;
varying vec3 coast3;
varying vec3 coast2;
varying vec3 coast1;
varying vec3 coast0;
varying vec3 vPosition;
uniform float waterTime;
uniform vec3 eye;
varying vec3 vNormal;
varying vec3 vFace;
varying vec4 vColor;
uniform float normalMode;
float waterHash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float waterNoise(vec3 p) {
 vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(vec3(3.0)-2.0*f);
 return mix(mix(mix(waterHash(i),waterHash(i+vec3(1,0,0)),u.x),mix(waterHash(i+vec3(0,1,0)),waterHash(i+vec3(1,1,0)),u.x),u.y),mix(mix(waterHash(i+vec3(0,0,1)),waterHash(i+vec3(1,0,1)),u.x),mix(waterHash(i+vec3(0,1,1)),waterHash(i+vec3(1,1,1)),u.x),u.y),u.z);
}
float coastDistance(vec3 p,vec3 a,vec3 b){vec3 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/max(dot(ab,ab),0.0000001),0.0,1.0));}
uniform mat4 shadowMatrix;
uniform float shadowsEnabled;
uniform highp sampler2DShadow coastShadow;
float waterShadow(vec3 p) {
 vec4 clip=shadowMatrix*vec4(p,1.0);vec3 ndc=clip.xyz/clip.w;
 vec2 uv=ndc.xy*0.5+vec2(0.5);float depth=clamp(ndc.z*0.5+0.5-0.0002,0.0,0.999999);
 if(shadowsEnabled<0.5 || uv.x<0.0 || uv.x>1.0 || uv.y<0.0 || uv.y>1.0)return 1.0;
 return texture(coastShadow,vec3(uv,depth));
}
uniform sampler2D shoreSegments;
vec3 shorePoint(int id,int endpoint){vec4 a=floor(texelFetch(shoreSegments,ivec2(endpoint*2,id),0)*255.0+0.5);vec4 b=floor(texelFetch(shoreSegments,ivec2(endpoint*2+1,id),0)*255.0+0.5);return vec3(a.x*256.0+a.y,a.z*256.0+a.w,b.x*256.0+b.y)*(4.0/65535.0)-vec3(2.0);}
varying vec2 vObjectRange;
uniform sampler2D objectSegments;
vec3 objectPoint(int index){return texelFetch(objectSegments,ivec2(index%256,index/256),0).xyz;}





void main() {

 vec3 n=normalize(vNormal);
 if(normalMode>0.5 && normalMode<1.5) n=normalize(vFace);
 if(normalMode>1.5) { gl_FragColor=vec4(n*0.5+0.5,1.0); }
 else {
 

 vec3 p=vPosition;
 float rim=pow(1.0-clamp(dot(n,normalize(eye-p)),0.0,1.0),3.0);
 vec3 direction=normalize(p);
 float t=waterTime*0.012;
 vec3 q=vec3(direction.x*cos(t)-direction.z*sin(t),direction.y,direction.x*sin(t)+direction.z*cos(t))*28.0;
 float wave=waterNoise(q)+0.25*waterNoise(q*2.13+vec3(17.0));
 float stripe=(smoothstep(0.62,0.66,wave)-smoothstep(0.68,0.72,wave))*0.10;

 float distance=10.0;
 vec3 coastIndices[6];coastIndices[0]=coast0;coastIndices[1]=coast1;coastIndices[2]=coast2;coastIndices[3]=coast3;coastIndices[4]=coast4;coastIndices[5]=coast5;
 for(int i=0;i<6;i++){for(int j=0;j<3;j++){int id=int(floor(coastIndices[i][j]+0.5));if(id>=0)distance=min(distance,coastDistance(p,shorePoint(id,0),shorePoint(id,1)));}}
 float terrainShore=distance/coastWidth;
 float objectDistance=10.0;
 for(int item=0;item<int(vObjectRange.y);item++){
   int index=(int(vObjectRange.x)+item)*2;
   objectDistance=min(objectDistance,coastDistance(p,objectPoint(index),objectPoint(index+1)));
 }
 float objectShore=objectDistance/coastWidth;
 float shore=min(terrainShore,objectShore);
 float breakup=waterNoise(direction*135.0+vec3(waterTime*0.06));
 float contactBreath=1.0+0.2*sin(waterTime*1.25+waterNoise(direction*8.0)*6.283185);
 float edge=max(1.0-smoothstep(0.22+breakup*0.035,0.32+breakup*0.045,terrainShore/contactBreath),1.0-smoothstep(0.065+breakup*0.01,0.10+breakup*0.014,objectShore/contactBreath));
 float phase=fract(shore*1.6+waterTime*0.22+breakup*0.08);
 float waveBreaks=smoothstep(0.38,0.50,0.75*waterNoise(direction*48.0+vec3(waterTime*0.035))+0.25*waterNoise(direction*113.0+vec3(19.0)));
 float crest=(1.0-smoothstep(0.03,0.13,abs(phase-0.5)))*(1.0-smoothstep(0.3,1.8,shore))*0.55*waveBreaks;
 float visibility=waterShadow(p);
 vec3 light=waterIncident(n,visibility);
 vec3 illumination=light;
 float foam=clamp(max(edge,crest),0.0,1.0);
 
 vec4 refractClip=waterProjection*vec4(p,1.0);
 vec3 refractNdc=refractClip.xyz/refractClip.w;
 vec2 refractUV=refractNdc.xy*0.5+0.5;
 float baseDepth=texture2D(underwaterDepth,refractUV).r;
 vec4 baseWorld=waterInverse*vec4(refractNdc.xy,baseDepth*2.0-1.0,1.0);
 vec3 basePoint=baseWorld.xyz/baseWorld.w;
 vec3 viewRay=normalize(p-eye);
 float eyeProjection=dot(eye,viewRay);
 float discriminant=eyeProjection*eyeProjection+seaRadius*seaRadius-dot(eye,eye);
 float halfChord=sqrt(max(0.0,discriminant));
 float entry=max(0.0,-eyeProjection-halfChord);
 float exit=-eyeProjection+halfChord;
 float end=baseDepth>=0.999999?exit:min(exit,dot(basePoint-eye,viewRay));
 float waterDistance=discriminant>0.0?max(0.0,end-entry):0.0;
 vec3 background=waterToLinear(texture2D(underwaterColor,refractUV).rgb);
 float transmission=exp(-waterDensity*waterDistance);
 vec3 submerged=mix(waterToLinear(waterColor.rgb)*light,background,transmission);
 vec3 reflection=waterToLinear(waterColor.rgb)*light;
 vec3 body=mix(submerged,reflection,rim*0.12);
 vec3 highlights=waterToLinear(vec3(0.18,0.42,0.46))*stripe*illumination;
 gl_FragColor=vec4(waterToDisplay(mix(body+highlights,waterToLinear(vec3(0.94,0.98,1.0))*illumination,foam)),1.0);
 }
}
`;
