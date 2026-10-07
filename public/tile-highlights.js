import {coverageSurface,coverageBoundary} from './utility-coverage.js';
export function createTileHighlights(B,scene){
  let centers=[],corners=[],waterRadius=1,resolution=8;
  const layers=new Map();
  function clear(name){
    const layer=layers.get(name);if(!layer)return;
    for(const mesh of layer.meshes)mesh.dispose();
    for(const material of layer.materials)material.dispose();
    layers.delete(name);
  }
  function configure(c,k,water,n){
    for(const name of [...layers.keys()])clear(name);
    centers=c;corners=k;waterRadius=water;resolution=n;
  }
  function show(name,tiles,style){
    const ids=[...tiles].sort((a,b)=>a-b),key=JSON.stringify([ids,style]);
    if(layers.get(name)?.key===key)return;
    clear(name);if(!ids.length||!corners.length)return;
    const layer={key,meshes:[],materials:[]};layers.set(name,layer);
    const material=(label,alpha)=>{
      const m=new B.StandardMaterial(name+'-'+label,scene);
      m.disableLighting=true;m.emissiveColor=new B.Color3(...style.color);m.diffuseColor=B.Color3.Black();
      m.alpha=alpha;m.backFaceCulling=false;m.disableDepthWrite=true;m.zOffset=-1;
      layer.materials.push(m);return m;
    };
    const mesh=(label,positions,indices,m,colors)=>{
      if(!positions.length)return;
      const result=new B.Mesh(name+'-'+label,scene),data=new B.VertexData();
      data.positions=positions;data.indices=indices;
      if(colors){data.colors=colors;result.hasVertexAlpha=true;}
      data.applyToMesh(result);result.material=m;result.isPickable=false;
      result.refreshBoundingInfo();result.computeWorldMatrix(true);layer.meshes.push(result);
    };
    const set=new Set(ids),surface=coverageSurface(set,centers,corners,waterRadius);
    mesh('fill',surface.positions,surface.indices,material('fill',style.alpha));
    const lines=[],positions=[],indices=[],colors=[];
    for(const {a,b,tile} of coverageBoundary(set,corners)){
      const radius=Math.max(Math.hypot(...centers.slice(tile*3,tile*3+3)),waterRadius)+.0025;
      const points=[];
      for(let i=0;i<=6;i++)points.push(B.Vector3.FromArray(a.map((v,k)=>v+(b[k]-v)*i/6)).normalize().scale(radius));
      lines.push(points);
      if(!style.wall)continue;
      for(let i=0;i<6;i++){
        const p=points[i],q=points[i+1],topP=p.normalizeToNew().scale(radius+.30/resolution),topQ=q.normalizeToNew().scale(radius+.30/resolution),offset=positions.length/3;
        positions.push(...p.asArray(),...q.asArray(),...topP.asArray(),...topQ.asArray());
        indices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2);
        colors.push(1,1,1,.6,1,1,1,.6,1,1,1,0,1,1,1,0);
      }
    }
    if(style.wall)mesh('wall',positions,indices,material('wall',1),colors);
    if(lines.length){
      const outline=B.MeshBuilder.CreateLineSystem(name+'-outline',{lines},scene);
      outline.color=new B.Color3(...style.color);outline.isPickable=false;
      outline.refreshBoundingInfo();outline.computeWorldMatrix(true);layer.meshes.push(outline);
    }
  }
  return {configure,show,clear};
}
