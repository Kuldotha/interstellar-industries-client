export function buildingStatus(building,workers) {
  if(building[1]===2)return null;
  if(building[2]||building[3]===2)return 'paused';
  if(building[1]===4)return null;
  if(building[3]===6)return 'idle';
  if(building[3]===5)return 'power';
  if(building[3]===1)return 'inputs';
  if(building[3]===4)return 'storage';
  if(building[3]===3)return 'workers';
  return null;
}
export const statusLabels={idle:'No power demand',power:'No power',paused:'Paused',workers:'Waiting for workers',inputs:'Waiting for inputs',storage:'Storage full'};
export function createBuildingStatuses(B,scene) {
  const icons=new Map(),materials={};
  for(const kind of Object.keys(statusLabels)) {
    const texture=new B.DynamicTexture('status-'+kind,{width:128,height:128},scene,false);
    texture.hasAlpha=true;
    const ctx=texture.getContext();ctx.clearRect(0,0,128,128);
    ctx.fillStyle='#12232ded';ctx.beginPath();ctx.arc(64,64,54,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=kind==='paused'?'#f5d785':'#f3ac64';ctx.lineWidth=6;ctx.stroke();
    ctx.fillStyle=ctx.strokeStyle;ctx.lineCap='round';ctx.lineJoin='round';
    if(kind==='idle'){ctx.beginPath();ctx.arc(64,64,25,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(64,43);ctx.lineTo(64,65);ctx.lineTo(77,73);ctx.stroke();}
    if(kind==='paused'){ctx.fillRect(43,39,15,50);ctx.fillRect(70,39,15,50);}
    if(kind==='power'){ctx.beginPath();ctx.moveTo(72,27);ctx.lineTo(42,70);ctx.lineTo(62,70);ctx.lineTo(53,101);ctx.lineTo(88,54);ctx.lineTo(66,54);ctx.closePath();ctx.fill();}
    if(kind==='workers'){
      ctx.beginPath();ctx.arc(57,43,12,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(57,78,23,Math.PI,0);ctx.lineTo(80,88);ctx.lineTo(34,88);ctx.closePath();ctx.fill();
      ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(92,45);ctx.lineTo(92,69);ctx.stroke();ctx.beginPath();ctx.arc(92,82,4,0,Math.PI*2);ctx.fill();
    }
    if(kind==='inputs'||kind==='storage'){
      ctx.lineWidth=5;ctx.strokeRect(35,50,49,39);ctx.beginPath();ctx.moveTo(35,50);ctx.lineTo(46,37);ctx.lineTo(75,37);ctx.lineTo(84,50);ctx.moveTo(59,39);ctx.lineTo(59,61);ctx.stroke();
      ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(96,38);ctx.lineTo(96,65);ctx.stroke();ctx.beginPath();ctx.arc(96,78,4,0,Math.PI*2);ctx.fill();
    }
    texture.update();
    const material=new B.StandardMaterial('status-'+kind,scene);material.diffuseTexture=texture;material.emissiveTexture=texture;material.emissiveColor=B.Color3.White();material.disableLighting=true;material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;material.disableDepthWrite=true;materials[kind]=material;
  }
  function sync(buildings,centers,resolution,workersFor) {
    const live=new Set();
    for(const building of buildings) {
      const id=building[0],status=buildingStatus(building,workersFor(id));
      if(!status)continue;live.add(id);
      let icon=icons.get(id);
      if(!icon){icon=B.MeshBuilder.CreatePlane('building-status-'+id,{size:1},scene);icon.billboardMode=B.Mesh.BILLBOARDMODE_ALL;icon.isPickable=false;icons.set(id,icon);}
      const center=B.Vector3.FromArray(centers.slice(id*3,id*3+3)),up=center.normalizeToNew();
      icon.position.copyFrom(center.add(up.scale(.82/resolution)));icon.material=materials[status];icon.metadata={center,status};
    }
    for(const [id,icon] of icons)if(!live.has(id)){icon.dispose();icons.delete(id);}
    update();
  }
  function update(){
    const camera=scene.activeCamera;if(!camera)return;
    const height=scene.getEngine().getRenderingCanvas().clientHeight;
    for(const icon of icons.values()) {
      const center=icon.metadata.center;
      icon.setEnabled(B.Vector3.Dot(center,camera.position)>center.lengthSquared());
      const distance=B.Vector3.Distance(camera.position,icon.position);
      icon.scaling.setAll(26/height*2*Math.tan(camera.fov/2)*distance);
    }
  }
  return {sync,update};
}
