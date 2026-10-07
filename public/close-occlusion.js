export function enableCloseOcclusion(B,scene,camera){
  if(!B.SSAO2RenderingPipeline.IsSupported)return;
  // Keep the prepass and camera targets stable while a frame is being rendered.
  const pipeline=new B.SSAO2RenderingPipeline('close-occlusion',scene,{ssaoRatio:.5,blurRatio:1},[camera]);
  pipeline.samples=12;pipeline.radius=.025;pipeline.base=.08;pipeline.epsilon=.0003;pipeline.maxZ=4;pipeline.expensiveBlur=false;
  pipeline.totalStrength=0;
  scene.onBeforeRenderObservable.add(()=>{
    const distance=B.Vector3.Distance(camera.position,camera.getTarget());
    pipeline.totalStrength=.65*Math.max(0,Math.min(1,(1.6-distance)/.7));
  });
  scene.onDisposeObservable.add(()=>pipeline.dispose());
  return pipeline;
}
