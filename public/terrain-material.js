import {groundMaterial} from './palette-material.js';
import {enableFacets,facetStyles} from './facet-material.js?weighted-cells=4';
export function terrainMaterial(B,scene) {
  const material=groundMaterial(B,scene,'shadowed-terrain');
  
  material.backFaceCulling=false;
  class TerrainAttributes extends B.MaterialPluginBase {
    constructor(){super(material,'TerrainAttributes',200,{},true,true);}
    isCompatible(){return true;}
    getAttributes(attributes){attributes.push('normalA','normalB','normalC','tintA','tintB','tintC');}
    getCustomCode(type,language){
      const wg=language===B.ShaderLanguage.WGSL;
      if(type!=='vertex')return null;
      return {
        CUSTOM_VERTEX_DEFINITIONS: wg ? `attribute normalA: vec3f; attribute normalB: vec3f; attribute normalC: vec3f;
attribute tintA: vec4f; attribute tintB: vec4f; attribute tintC: vec4f;` : `attribute vec3 normalA; attribute vec3 normalB; attribute vec3 normalC;
attribute vec4 tintA; attribute vec4 tintB; attribute vec4 tintC;`,
        CUSTOM_VERTEX_MAIN_END: wg ? `
vertexOutputs.vNormalW=vertexInputs.normalC; vertexOutputs.vColor=vertexInputs.tintC;
if(vertexInputs.position.x < -0.75){vertexOutputs.vNormalW=vertexInputs.normalA; vertexOutputs.vColor=vertexInputs.tintA;}
if(vertexInputs.position.x > -0.25){vertexOutputs.vNormalW=vertexInputs.normalB; vertexOutputs.vColor=vertexInputs.tintB;}` : `
vNormalW=position.x < -0.75 ? normalA : (position.x > -0.25 ? normalB : normalC);
vColor=position.x < -0.75 ? tintA : (position.x > -0.25 ? tintB : tintC);`
      };
    }
  }
  new TerrainAttributes();enableFacets(B,material,facetStyles.ground);return material;
}
