export function enableVertexAO(B,material){
 class VertexAO extends B.MaterialPluginBase{
  constructor(){super(material,'VertexAO',225,{VERTEX_AO:false},true,true);}
  isCompatible(){return true;}
  prepareDefines(defines,scene,mesh){defines.VERTEX_AO=mesh.isVerticesDataPresent('modelAO');}
  getAttributes(list,scene,mesh){if(mesh.isVerticesDataPresent('modelAO'))list.push('modelAO');}
  getCustomCode(stage,language){const wg=language===B.ShaderLanguage.WGSL,v=wg?'vec3f':'vec3',input=wg?'fragmentInputs.':'';
   if(stage==='vertex')return {CUSTOM_VERTEX_DEFINITIONS:'#ifdef VERTEX_AO\n'+(wg?'attribute modelAO: f32; varying vModelAO: f32;':'attribute float modelAO; varying float vModelAO;')+'\n#endif',CUSTOM_VERTEX_MAIN_END:'#ifdef VERTEX_AO\n'+(wg?'vertexOutputs.vModelAO=vertexInputs.modelAO;':'vModelAO=modelAO;')+'\n#endif'};
   if(stage!=='fragment')return null;
   const declarations='#ifdef VERTEX_AO\n'+(wg?'varying vModelAO: f32;':'varying float vModelAO;')+'\n#endif';
   return {CUSTOM_FRAGMENT_DEFINITIONS:declarations,CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION:`#ifdef VERTEX_AO
finalAmbient*=clamp(${input}vModelAO,0.0,1.0);
#ifdef REFLECTION
finalIrradiance*=clamp(${input}vModelAO,0.0,1.0);
#endif
aoOut.ambientOcclusionColor*=${v}(clamp(${input}vModelAO,0.0,1.0));
#endif`};
  }
 }return new VertexAO();
}
