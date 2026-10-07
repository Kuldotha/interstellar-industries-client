export function orbitPose(longitude, latitude, zoom, radius = 1) {
  const up = [Math.cos(latitude)*Math.cos(longitude), Math.sin(latitude), Math.cos(latitude)*Math.sin(longitude)];
  const north = [-Math.sin(latitude)*Math.cos(longitude), Math.cos(latitude), -Math.sin(latitude)*Math.sin(longitude)];
  const angle = zoom**2 * 80 * Math.PI / 180;
  const distance = .5 + 4.5 * (1-zoom)**2;
  const offset = up.map((x,i) => x*Math.cos(angle) - north[i]*Math.sin(angle));
  return {
    target: up.map(x=>x*radius),
    position: up.map((x,i)=>(x+distance*offset[i])*radius),
    up: up.map((x,i)=>x*Math.sin(angle)+north[i]*Math.cos(angle)),
  };
}

export function orbitInertia(velocity,dt,target=0) {
  const decay=Math.exp(-9*dt);
  return {distance:target*dt+(velocity-target)*(1-decay)/9,velocity:target+(velocity-target)*decay};
}

export function createOrbitCamera(B, scene, canvas) {
  const camera = new B.FreeCamera('surface-orbit', B.Vector3.Zero(), scene);
  camera.minZ=.005; camera.maxZ=30;
  let longitude=-1.05, latitude=Math.PI/2-1.14, zoom=0, targetZoom=0;
  let pointer=null,velocityX=0,velocityY=0;
  const keys=new Set(),movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
  const keyCode=event=>movementKeys.has(event.code)?event.code:({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',arrowup:'ArrowUp',arrowleft:'ArrowLeft',arrowdown:'ArrowDown',arrowright:'ArrowRight'}[event.key?.toLowerCase()]);
  canvas.tabIndex=0;
  const editing=element=>element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName);
  const stop=()=>{keys.clear();velocityX=0;velocityY=0;};
  window.addEventListener('keydown',event=>{
    const code=keyCode(event);
    if(!code||editing(event.target)||event.ctrlKey||event.metaKey||event.altKey)return;
    event.preventDefault();
    if(!keys.has(code)&&!pointer){
      const nudge=.16*(1-.8*zoom);
      if(code==='KeyD'||code==='ArrowRight')velocityX-=nudge;
      if(code==='KeyA'||code==='ArrowLeft')velocityX+=nudge;
      if(code==='KeyW'||code==='ArrowUp')velocityY+=nudge;
      if(code==='KeyS'||code==='ArrowDown')velocityY-=nudge;
    }
    keys.add(code);
  });
  window.addEventListener('keyup',event=>keys.delete(keyCode(event)));
  window.addEventListener('blur',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  document.addEventListener('focusin',event=>{if(editing(event.target))stop();});
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    targetZoom=Math.max(0,Math.min(1,targetZoom-pixels*.001));
  },{passive:false});
  canvas.addEventListener('pointerdown', event => {
    if(event.button!==0) return;
    canvas.focus({preventScroll:true});
    velocityX=0;velocityY=0;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if(!pointer || pointer.id!==event.pointerId) return;
    const sensitivity=.004*(1-.8*zoom);
    const dx=(event.clientX-pointer.x)*sensitivity,dy=(event.clientY-pointer.y)*sensitivity;
    const dt=Math.max(.008,(event.timeStamp-pointer.time)/1000),weight=1-Math.exp(-dt*35);
    velocityX+=(Math.max(-4,Math.min(4,dx/dt))-velocityX)*weight;
    velocityY+=(Math.max(-4,Math.min(4,dy/dt))-velocityY)*weight;
    longitude+=dx;
    latitude=Math.max(-1.553,Math.min(1.553,latitude+dy));
    pointer.x=event.clientX; pointer.y=event.clientY;pointer.time=event.timeStamp;
  });
  canvas.addEventListener('pointerup',event=>{
    if(!pointer || pointer.id!==event.pointerId)return;
    const decay=Math.exp(-Math.max(0,event.timeStamp-pointer.time)/1000*20);
    velocityX*=decay;velocityY*=decay;pointer=null;
  });
  for(const name of ['pointercancel','lostpointercapture']) canvas.addEventListener(name,event=>{
    if(!pointer || pointer.id!==event.pointerId)return;
    pointer=null;velocityX=0;velocityY=0;
  });
  const update=(dt,rotate,radius=1)=>{
    zoom+=(targetZoom-zoom)*(1-Math.exp(-dt*12));
    if(!pointer){
      const horizontal=Number(keys.has('KeyA')||keys.has('ArrowLeft'))-Number(keys.has('KeyD')||keys.has('ArrowRight'));
      const vertical=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const speed=.65*(1-.8*zoom)/Math.max(1,Math.hypot(horizontal,vertical));
      const x=orbitInertia(velocityX,dt,horizontal*speed),y=orbitInertia(velocityY,dt,vertical*speed);
      longitude+=x.distance;
      latitude=Math.max(-1.553,Math.min(1.553,latitude+y.distance));
      velocityX=Math.abs(x.velocity)<.0001?0:x.velocity;
      velocityY=Math.abs(latitude)>=1.553 || Math.abs(y.velocity)<.0001?0:y.velocity;
    }
    if(rotate && !pointer && !keys.size) longitude+=dt*.035*(1-zoom);
    const pose=orbitPose(longitude,latitude,zoom,radius);
    camera.position.copyFromFloats(...pose.position);
    camera.upVector.copyFromFloats(...pose.up);
    camera.setTarget(B.Vector3.FromArray(pose.target));
  };
  update(0,false);
  return {camera,update,reset:()=>{stop();pointer=null;longitude=-1.05;latitude=Math.PI/2-1.14;targetZoom=0;}};
}
