export function subdivideBuildingGeometry(source,radius,scale) {
  const positions=[],normals=[],uvs=[],uvs2=[],ao=[],indices=[],p=source.positions,n=source.normals,uv=source.uvs;
  let longest=0;
  for(let i=0;i<source.indices.length;i+=3)for(let j=0;j<3;j++){
    const a=source.indices[i+j]*3,b=source.indices[i+(j+1)%3]*3;
    longest=Math.max(longest,Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]));
  }
  // Long flat spans need intermediate vertices for vertex-shader curvature.
  const divisions=Math.max(1,Math.min(24,Math.ceil(longest*scale/Math.sqrt(8*radius*scale*.002))));
  for(let t=0;t<source.indices.length;t+=3){
    const ids=source.indices.slice(t,t+3),grid=[];
    for(let i=0;i<=divisions;i++){
      grid[i]=[];
      for(let j=0;j<=divisions-i;j++){
        const weights=[1-(i+j)/divisions,i/divisions,j/divisions],point=[0,0,0],normal=[0,0,0],tex=[0,0],tex2=[0,0];
        for(let k=0;k<3;k++){
          for(let axis=0;axis<3;axis++){point[axis]+=p[ids[k]*3+axis]*weights[k];normal[axis]+=n[ids[k]*3+axis]*weights[k];}
          for(let axis=0;axis<2;axis++){tex[axis]+=(uv?.[ids[k]*2+axis]??0)*weights[k];tex2[axis]+=(source.uvs2?.[ids[k]*2+axis]??0)*weights[k];}
        }
        if(source.ao)ao.push(ids.reduce((sum,id,k)=>sum+source.ao[id]*weights[k],0));
        grid[i][j]=positions.length/3;positions.push(...point);normals.push(...normal);uvs.push(...tex);if(source.uvs2)uvs2.push(...tex2);
      }
    }
    for(let i=0;i<divisions;i++)for(let j=0;j<divisions-i;j++){
      indices.push(grid[i][j],grid[i+1][j],grid[i][j+1]);
      if(j<divisions-i-1)indices.push(grid[i+1][j],grid[i+1][j+1],grid[i][j+1]);
    }
  }
  return {positions,normals,uvs,indices,...(source.uvs2?{uvs2}:{}),...(source.ao?{ao}:{})};
}

export function enableBuildingWrap(B,material,scene) {
  class BuildingWrap extends B.MaterialPluginBase {
    constructor(){super(material,'BuildingWrap',200,{},true,true);}
    isCompatible(){return true;}
    getAttributes(attributes){attributes.push('buildingCenter');}
    getCustomCode(stage,language){
      if(stage!=='vertex')return null;
      const wgsl=language===1,v=wgsl?'vec3f':'vec3',f=wgsl?'vec4f':'vec4',scalar=wgsl?'let':'float',vector=wgsl?'let':'vec3',center=wgsl?'vertexInputs.buildingCenter':'buildingCenter',normal=wgsl?'vertexOutputs.vNormalW':'vNormalW';
      const definition=wgsl?`fn buildingColumn(e:vec3f,u:vec3f,d:vec3f,a:f32)->vec3f {let t=e-u*dot(u,e);return a*(t-d*dot(d,t))+d*dot(u,e);}`:`vec3 buildingColumn(vec3 e,vec3 u,vec3 d,float a){vec3 t=e-u*dot(u,e);return a*(t-d*dot(d,t))+d*dot(u,e);}`;
      return {CUSTOM_VERTEX_DEFINITIONS:(wgsl?'attribute buildingCenter: vec3f;\n':'attribute vec3 buildingCenter;\n')+definition,CUSTOM_VERTEX_UPDATE_WORLDPOS:`
        ${scalar} br=length(${center});
        ${vector} bu=${center}/br;
        ${scalar} bh=dot(worldPos.xyz-${center},bu);
        ${vector} ground=worldPos.xyz-bu*bh;
        ${vector} bd=normalize(ground);
        #ifdef NORMAL
        ${scalar} ba=(br+bh)/length(ground);
        ${vector} bx=buildingColumn(${v}(1.0,0.0,0.0),bu,bd,ba);
        ${vector} by=buildingColumn(${v}(0.0,1.0,0.0),bu,bd,ba);
        ${vector} bz=buildingColumn(${v}(0.0,0.0,1.0),bu,bd,ba);
        ${normal}=normalize(cross(by,bz)*${normal}.x+cross(bz,bx)*${normal}.y+cross(bx,by)*${normal}.z);
        #endif
        worldPos=${f}(bd*(br+bh),1.0);
      `};
    }
  }
  new BuildingWrap();
  material.shadowDepthWrapper=new B.ShadowDepthWrapper(material,scene,scene.getEngine().isWebGPU?{remappedVariables:['vNormalW','vertexOutputs.vNormalW']}:{});
}

export function updateBuildingBounds(B,mesh,center) {
  const world=mesh.computeWorldMatrix(true),inverse=B.Matrix.Invert(world),up=center.normalizeToNew(),radius=center.length();
  const positions=mesh.getVerticesData(B.VertexBuffer.PositionKind),minimum=new B.Vector3(Infinity,Infinity,Infinity),maximum=new B.Vector3(-Infinity,-Infinity,-Infinity);
  for(let i=0;i<positions.length;i+=3){
    const p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i),world),height=B.Vector3.Dot(p.subtract(center),up);
    const curved=p.subtract(up.scale(height)).normalize().scale(radius+height);
    const local=B.Vector3.TransformCoordinates(curved,inverse);minimum.minimizeInPlace(local);maximum.maximizeInPlace(local);
  }
  const margin=B.Vector3.One().scale(.002);minimum.subtractInPlace(margin);maximum.addInPlace(margin);
  mesh.setBoundingInfo(new B.BoundingInfo(minimum,maximum));mesh.getBoundingInfo().update(world);
  for(const subMesh of mesh.subMeshes){subMesh.setBoundingInfo(new B.BoundingInfo(minimum,maximum));subMesh.getBoundingInfo().update(world);}
}
