import { urbanConnectionOwner, urbanConnectionPlacements } from './urban-connections.js';
export function createUrbanCottages(B,box,id,links,centers,right,forward,scale,buildings,interior=false,model=null){
  const patches=[];
  const house=(x,z,yaw,variant)=>{
    const cs=Math.cos(yaw),sn=Math.sin(yaw),size=1;
    const part=(name,dimensions,p,material,roll=0)=>{
      const mesh=box(name,dimensions.map(v=>v*size),[x+(p[0]*cs+p[2]*sn)*size,p[1]*size,z+(-p[0]*sn+p[2]*cs)*size],material);
      mesh.rotationQuaternion=B.Quaternion.RotationYawPitchRoll(yaw,0,roll);return mesh;
    };
    patches.push({x,z,yaw,halfX:.215*size,halfZ:.21*size});
    if(model){model(x,z,yaw,size);return;}
    part('cottage-footing',[.31,.025,.30],[0,.0125,0],'base');
    part('cottage-walls',[.25,.19,.23],[0,.12,0],'wall');
    for(const sign of [-1,1])part('cottage-roof',[.17,.025,.29],[sign*.069,.235,0],'roof',-sign*.43);
    part('cottage-door',[.055,.105,.012],[0,.067,.121],'trim');
    part('cottage-chimney',[.045,.105,.045],[.075,.245,-.055],'base');
  };
  const phase=(id*2.399963)% (Math.PI*2);
  for(let i=0;interior&&i<5;i++){const angle=phase+i*Math.PI*2/5,r=.43+(i%2)*.05;house(Math.sin(angle)*r,Math.cos(angle)*r,angle+Math.PI,i%3);}
  const center=B.Vector3.FromArray(centers.slice(id*3,id*3+3)),radius=center.length(),up=center.normalizeToNew();
  for(const other of links){
    const next=B.Vector3.FromArray(centers.slice(other*3,other*3+3)).normalize();
    const middle=up.add(next).normalize(),plane=middle.scale(radius/B.Vector3.Dot(middle,up)).subtract(center);
    const x=B.Vector3.Dot(plane,right)/scale,z=B.Vector3.Dot(plane,forward)/scale,length=Math.hypot(x,z),yaw=Math.atan2(x,z);
    if(urbanConnectionOwner(id,other,buildings)===id){
      for(const p of urbanConnectionPlacements(x,z,.20))house(p.x,p.z,p.yaw,0);
    }
  }
  return patches;
}
export function mergeHousingParts(B,root,scene,shadows,underwater){
  const groups=new Map(),old=new Set(root.getChildMeshes().filter(mesh=>!mesh.metadata?.animated));
  for(const mesh of old){
    const key=mesh.material;let data=groups.get(key);if(!data){data={positions:[],normals:[],uvs:[],uvs2:[],ao:[],indices:[]};groups.set(key,data);}
    const transform=mesh.computeWorldMatrix(true).multiply(root.computeWorldMatrix(true).clone().invert()),base=data.positions.length/3,normalTransform=B.Matrix.Transpose(B.Matrix.Invert(transform));
    const p=mesh.getVerticesData(B.VertexBuffer.PositionKind),n=mesh.getVerticesData(B.VertexBuffer.NormalKind),uv=mesh.getVerticesData(B.VertexBuffer.UVKind);
    for(let i=0;i<p.length;i+=3){data.positions.push(...B.Vector3.TransformCoordinates(B.Vector3.FromArray(p,i),transform).asArray());data.normals.push(...B.Vector3.TransformNormal(B.Vector3.FromArray(n,i),normalTransform).normalize().asArray());}
    data.ao.push(...(mesh.getVerticesData('modelAO')||new Float32Array(p.length/3).fill(1)));data.uvs.push(...uv);data.uvs2.push(...(mesh.getVerticesData(B.VertexBuffer.UV2Kind)||Float32Array.from({length:uv.length},(_,i)=>i%2?.5:1)));data.indices.push(...mesh.getIndices().map(i=>i+base));shadows.removeShadowCaster(mesh);mesh.dispose();
  }
  underwater.renderList=underwater.renderList.filter(mesh=>!old.has(mesh));
  for(const [material,geometry] of groups){const mesh=new B.Mesh('housing-cluster-'+material.name,scene),data=new B.VertexData();Object.assign(data,geometry);data.applyToMesh(mesh);mesh.setVerticesData('modelAO',geometry.ao,false,1);mesh.parent=root;mesh.material=material;mesh.receiveShadows=true;mesh.isPickable=false;shadows.addShadowCaster(mesh);underwater.renderList.push(mesh);}
}
