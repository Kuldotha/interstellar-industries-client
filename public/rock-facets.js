export const rockPalette=[
  [151,153,154],[167,166,159],[137,146,155],[177,177,169],
  [157,150,142],[146,151,158],[163,163,162],[185,182,171]
];
export function rockFacets(model){
  const positions=[],normals=[],uvs=[],indices=[];
  for(let i=0;i<model.indices.length;i+=3){
    const points=model.indices.slice(i,i+3).map(id=>model.positions.slice(id*3,id*3+3));
    const a=points[1].map((v,j)=>v-points[0][j]),b=points[2].map((v,j)=>v-points[0][j]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n)||1;
    for(const point of points){indices.push(indices.length);positions.push(...point);normals.push(...n.map(v=>v/length));uvs.push((i/3+.5)/(model.indices.length/3),.5);}
  }
  return {positions,normals,uvs,indices};
}

export function enableRockFacets(B,material){
  class RockFacetPattern extends B.MaterialPluginBase {
    constructor(){super(material,'RockFacetPattern',200,{},true,true);}
    isCompatible(){return true;}
    getCustomCode(type,language){
      if(type!=='vertex')return null;
      return {CUSTOM_VERTEX_MAIN_END:language===B.ShaderLanguage.WGSL?`
#ifdef DIFFUSE
let rockSeed=dot(finalWorld[3].xyz,vec3f(127.1,311.7,74.7));
let rockFace=fract(sin(rockSeed+vertexInputs.uv.x*913.7)*43758.5453);
#if DIFFUSEDIRECTUV == 1
vertexOutputs.vMainUV1=vec2f((floor(rockFace*8.0)+0.5)/8.0,0.5);
#else
vertexOutputs.vDiffuseUV=vec2f((floor(rockFace*8.0)+0.5)/8.0,0.5);
#endif
#endif`:`
#ifdef DIFFUSE
float rockSeed=dot(finalWorld[3].xyz,vec3(127.1,311.7,74.7));
float rockFace=fract(sin(rockSeed+uv.x*913.7)*43758.5453);
#if DIFFUSEDIRECTUV == 1
vMainUV1=vec2((floor(rockFace*8.0)+0.5)/8.0,0.5);
#else
vDiffuseUV=vec2((floor(rockFace*8.0)+0.5)/8.0,0.5);
#endif
#endif`};
    }
  }
  new RockFacetPattern();
}
