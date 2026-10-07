import {fieldLayout,fieldSoilGeometry} from './field-layout.js';
import {cropGeometry} from './crop-mesh.js';
import {groundMaterial} from './palette-material.js';
import {enableBuildingWrap} from './building-wrap.js';
const materials=new WeakMap();
const hash=n=>{n=Math.imul(n^(n>>>16),0x21f0aaad);return ((n^(n>>>15))>>>0)/4294967296;};
export function cropPoints(config,seed=0,layout=fieldLayout(seed)){
 const points=[];for(let z=-layout.extent;z<=layout.extent;z+=config.spacing)for(let x=-layout.extent;x<=layout.extent;x+=config.spacing){

  const id=Math.round((x+40)*1009+(z+40)*9173)+seed*97,px=x+(hash(id+1)-.5)*config.spacing*.65,pz=z+(hash(id+2)-.5)*config.spacing*.5;
  const plot=layout.sample(px,pz);if(!plot||plot.path)continue;
  const angle=plot.plot*.63,row=px*Math.sin(angle)+pz*Math.cos(angle);
  if(Math.abs(row/config.rowSpacing-Math.round(row/config.rowSpacing))*config.rowSpacing>config.rowWidth/2)continue;
  points.push({x:px,z:pz,y:layout.height(px,pz),height:config.height*(.8+hash(id+3)*.4),yaw:hash(id+4)*Math.PI*2,rank:hash(id+5)});
 }return points.sort((a,b)=>a.rank-b.rank);
}
export function createCropGrass(B,scene,parent,config,{unit=1,center=null,seed=0,layout=fieldLayout(seed)}={}){
 let cache=materials.get(scene);if(!cache){cache=new Map();materials.set(scene,cache);}const key=Boolean(center);let material=cache.get(key);
 if(!material){material=groundMaterial(B,scene,'crop-grass-'+key);material.backFaceCulling=false;
  class Wind extends B.MaterialPluginBase{
   constructor(){super(material,'CropWind',190,{},true,true);}
   isCompatible(){return true;}
   getUniforms(language){return {ubo:[{name:'cropTime',size:1,type:'float'}],vertex:language===1?'':'#ifndef UNIFORMBUFFERS\nuniform float cropTime;\n#endif'};}
   bindForSubMesh(buffer){buffer.updateFloat('cropTime',performance.now()*.0015);}
   getCustomCode(stage,language){if(stage!=='vertex')return null;return {CUSTOM_VERTEX_UPDATE_POSITION:`positionUpdated.x += sin(${language===1?'uniforms.cropTime':'cropTime'}+${language===1?'vertexInputs.world3':'world3'}.x*47.0+${language===1?'vertexInputs.world3':'world3'}.z*31.0)*positionUpdated.y*positionUpdated.y*0.13;`};}
  }new Wind();if(center)enableBuildingWrap(B,material,scene);cache.set(key,material);
 }
 const mesh=new B.Mesh('crop-'+config.model,scene),geometry=cropGeometry(config.model,config.color),positions=geometry.positions;
 const data=new B.VertexData();Object.assign(data,geometry);data.applyToMesh(mesh);mesh.setVerticesData('modelAO',new Float32Array(positions.length/3).fill(1),false,1);mesh.parent=parent;mesh.material=material;mesh.receiveShadows=true;mesh.isPickable=false;mesh.metadata={cropGrass:true,animated:true};
 if(center)mesh.setVerticesData('buildingCenter',Float32Array.from({length:positions.length},(_,i)=>center[i%3]),false,3);
 const points=cropPoints(config,seed,layout),matrices=new Float32Array(points.length*16);
 points.forEach((p,i)=>B.Matrix.Compose(new B.Vector3(unit,unit*p.height,unit),B.Quaternion.FromEulerAngles(0,p.yaw,0),new B.Vector3(p.x*unit,(p.y+.065)*unit,p.z*unit)).copyToArray(matrices,i*16));
 mesh.thinInstanceSetBuffer('matrix',matrices,16,true);mesh.thinInstanceRefreshBoundingInfo(true);mesh.alwaysSelectAsActiveMesh=Boolean(center);
 let last=0;const observer=scene.onBeforeRenderObservable.add(()=>{if(!center||performance.now()-last<180)return;last=performance.now();const eye=scene.activeCamera.position,c=B.Vector3.FromArray(center),distance=B.Vector3.Distance(eye,c),visible=B.Vector3.Dot(c,eye)>c.lengthSquared();mesh.setEnabled(visible);mesh.thinInstanceCount=visible?Math.min(points.length,Math.max(60,Math.floor(points.length*Math.max(.25,Math.min(1,1.8/Math.max(.4,distance)))))):0;});
 mesh.onDisposeObservable.add(()=>scene.onBeforeRenderObservable.remove(observer));return mesh;
}

export function createFieldSoil(B,scene,parent,layout,{unit=1,center=null,material:override=null}={}){
 const geometry=fieldSoilGeometry(layout);geometry.positions=geometry.positions.map(v=>v*unit);
 const mesh=new B.Mesh('cultivated-plots',scene),data=new B.VertexData();Object.assign(data,geometry);data.applyToMesh(mesh);
 mesh.setVerticesData('modelAO',new Float32Array(geometry.positions.length/3).fill(1),false,1);
 const material=override||groundMaterial(B,scene,'cultivated-soil');material.backFaceCulling=false;if(center){if(!override)enableBuildingWrap(B,material,scene);mesh.setVerticesData('buildingCenter',Float32Array.from({length:geometry.positions.length},(_,i)=>center[i%3]),false,3);}
 mesh.material=material;mesh.parent=parent;mesh.receiveShadows=true;mesh.isPickable=false;mesh.metadata={animated:true,cropGrass:true};mesh.alwaysSelectAsActiveMesh=Boolean(center);if(!override)mesh.onDisposeObservable.add(()=>material.dispose());return mesh;
}
