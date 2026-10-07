import {showLoading,hideLoading,failLoading,paintLoading} from './loading-screen.js';
import {loadVisualLayout} from './visual-layout.js';
import {createTileCompositions} from './composition-runtime.js';
import {connectPlanet} from './wallet.js';
import {createWaterCutout} from './deposit-cutout.js?v=2';
import {createLighting} from './lighting.js';
import {loadPalette} from './palette-material.js';
import {createDeposits,loadDepositModel} from './deposits.js';
import { createIndustry } from './industry.js?quest-art=1';
import { createTileSelection } from './tile-selection.js?highlights=2';
import { createGrass } from './grass.js?voronoi=3';
import { coastlineBuffers } from './coast.js';
import { terrainMaterial } from './terrain-material.js?voronoi=3';
import { createOrbitCamera } from './orbit-camera.js?keyboard=3';
import { createObjectCoast } from './object-coast.js?bedrock=1';
import { waterGeometry } from './water-geometry.js';
import { normalMaterial } from './normal-material.js?caustics=1';
const B = window.BABYLON;
const $ = (id) => document.getElementById(id);
const canvas = $('planet');
$('toggle-panel').addEventListener('click', () => {
  const minimized = !$('planet-data').hidden;
  $('planet-data').hidden = minimized;
  document.body.classList.toggle('panel-minimized', minimized);
  $('toggle-panel').setAttribute('aria-expanded', String(!minimized));
  $('toggle-panel').setAttribute('aria-label', minimized ? 'Expand planet data' : 'Minimize planet data');
  $('toggle-panel').textContent = minimized ? '+' : '−';
});
const errors = [];
window.addEventListener('error', (e) => errors.push(e.error?.stack||e.message));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

async function start() {
  const chain=await connectPlanet();
  showLoading('Preparing your world…');await paintLoading();
  const { instance } = await WebAssembly.instantiateStreaming(fetch('planet_geometry.wasm',{cache:'no-store'}), {});
  const core = instance.exports;
  core.set_planet_seed(chain?.initial.seed??1701);
  const applyVisualLayout=await loadVisualLayout(8);
  $('resolution').value=8;$('resolution').disabled=true;
  $('time-controls').hidden=true;$('reset-colony').hidden=true;
  const definition = await (await fetch("blue-home.json",{cache:"no-store"})).json();
  let engine;
  let backend;
  if (new URLSearchParams(location.search).get('backend')!=='webgl' && await B.WebGPUEngine.IsSupportedAsync) {
    try {
      engine = new B.WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await engine.initAsync();
      backend = 'WebGPU';
    } catch (error) {
      engine?.dispose();
      console.warn('WebGPU initialization failed; using WebGL2.', error);
    }
  }
  if (!backend) {
    engine = new B.Engine(canvas, true, { disableWebGL2Support: false }, true);
    backend = engine.webGLVersion === 2 ? 'WebGL2 fallback' : 'WebGL1 fallback';
  }
  $('backend').textContent = `${backend} · Rust/WASM`;
  const scene = new B.Scene(engine);
  await loadPalette(B,scene);
  scene.useRightHandedSystem = true;
  scene.skipPointerMovePicking=true;scene.skipPointerDownPicking=true;scene.skipPointerUpPicking=true;
  scene.clearColor = new B.Color4(0.031, 0.059, 0.09, 1);
  const orbit = createOrbitCamera(B, scene, canvas);
  const {sun,bindWater}=createLighting(B,scene);
  sun.shadowMinZ=.1;sun.shadowMaxZ=9;
  sun.autoCalcShadowZBounds=false;
  const shadows=new B.ShadowGenerator(2048,sun);
  shadows.usePercentageCloserFiltering=true;
  shadows.filteringQuality=B.ShadowGenerator.QUALITY_LOW;
  shadows.bias=.0003;shadows.normalBias=.002;
  const mesh = new B.Mesh('shared-equilateral-triangle', scene);
  const geometry = new B.VertexData();
  geometry.positions = [-1, 0, 0, 0, 0, 0, -0.5, -Math.sqrt(3) / 2, 0];
  geometry.indices = [0, 1, 2];
  geometry.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1];
  geometry.colors=Array(12).fill(1);
  geometry.applyToMesh(mesh);
  const sourceVertices=new Float32Array(30);
  for(let i=0;i<3;i++){sourceVertices.set(geometry.positions.slice(i*3,i*3+3),i*10);sourceVertices.set([0,0,-1,1,1,1,1],i*10+3);}
  const sourceBuffer=new B.Buffer(engine,sourceVertices,false,10);
  for(const [name,offset,size] of [['position',0,3],['normal',3,3],['color',6,4]])mesh.setVerticesBuffer(new B.VertexBuffer(engine,sourceBuffer,name,false,false,10,false,offset,size));
  const material = normalMaterial(B, scene, backend === 'WebGPU');
  const litTerrain=terrainMaterial(B,scene);
  const oceanState={radius:1,density:42,enabled:true};
  mesh.material=litTerrain;mesh.receiveShadows=true;
  shadows.addShadowCaster(mesh);
  const waterMesh=new B.Mesh("water-sections",scene);
  waterGeometry(B).applyToMesh(waterMesh);
  const waterMaterial=normalMaterial(B,scene,backend==='WebGPU',true);
  waterMesh.material=waterMaterial;
  waterMaterial.onBindObservable.add(()=>{
    const effect=waterMaterial.getEffect();
    bindWater(effect);
    effect.setMatrix('shadowMatrix',shadows.getTransformMatrix());
    effect.setFloat('shadowsEnabled',scene.shadowsEnabled?1:0);
    effect.setDepthStencilTexture('coastShadow',shadows.getShadowMapForRendering());
  });
  waterMaterial.setColor4('waterColor',new B.Color3(...definition.water.color.slice(0,3)),1);
  const compositions=await createTileCompositions(B,scene,shadows);
  const grass=createGrass(B,scene,orbit.camera);
  const depositModel=await loadDepositModel(scene.metadata.palette);
  const deposits=createDeposits(B,scene,mask=>grass.setDepositCover(mask),depositModel,litTerrain,shadows);
  const waterCutouts=createWaterCutout(B,scene,waterMaterial);
  const underwater=new B.RenderTargetTexture('submerged-scene',{width:engine.getRenderWidth(),height:engine.getRenderHeight()},scene,false);
  underwater.renderList=scene.meshes.filter(item=>item!==waterMesh && !grass.meshes.includes(item));
  underwater.createDepthStencilTexture(0,false);compositions.setUnderwater(underwater);
  scene.customRenderTargets.push(underwater);
  waterMaterial.setTexture('underwaterColor',underwater);
  const inverseWater=B.Matrix.Identity();
  waterMaterial.onBindObservable.add(()=>{
    const effect=waterMaterial.getEffect();
    const projection=scene.getTransformMatrix();
    projection.invertToRef(inverseWater);
    effect.setMatrix('waterProjection',projection);
    effect.setMatrix('waterInverse',inverseWater);
    effect.setFloat('seaRadius',oceanState.radius);
    effect.setFloat('waterDensity',oceanState.density);
    effect.setDepthStencilTexture('underwaterDepth',underwater);
  });
  engine.onResizeObservable.add(()=>{
    underwater.resize({width:engine.getRenderWidth(),height:engine.getRenderHeight()});
    underwater.createDepthStencilTexture(0,false);
  });
  const selection=createTileSelection(B,scene,orbit.camera,canvas,definition);
  let objectCoastDirty=true;
  const objectCoast=createObjectCoast(B,scene,waterMaterial,waterMesh);
  const industry=await createIndustry(B,scene,shadows,core,selection,underwater,occupied=>{compositions.setOccupied(occupied);grass.setOccupied(occupied);deposits.setOccupied(occupied);},areas=>grass.setGroundCover(areas),()=>{objectCoastDirty=true;},chain,compositions);
  let coastTexture;
  let generationMs = 0;
  let instanceCount = 0;
  let matrices;
  let tileIds;
  let kinds;
  let frames = 0;
  function regenerate() {
    const resolution = Number($('resolution').value);
    $('resolution-value').value = resolution;
    const t = performance.now();
    const flags = 64 | ($('sections').checked ? 1 : 0) | ($('edges').checked ? 2 : 0) | ($('corners').checked ? 4 : 0) | ($('water').checked ? 16 : 0);
    const height = Number($('height').value) / 1000;
    $('height-value').value = height.toFixed(3);
    oceanState.radius=1+definition.water.heightInLevels*height;
    oceanState.enabled=$('water').checked;
    underwater.refreshRate=oceanState.enabled?1:0;
    applyVisualLayout(core);
    instanceCount = core.generate_blue(resolution, height, flags);
    matrices = new Float32Array(core.memory.buffer, core.matrices_ptr(), instanceCount * 16).slice();
    const colors = new Float32Array(core.memory.buffer, core.vertex_colors_ptr(), instanceCount * 12).slice();
    tileIds = new Uint32Array(core.memory.buffer, core.tile_ids_ptr(), instanceCount).slice();
    const normals = new Float32Array(core.memory.buffer, core.normals_ptr(), instanceCount * 9).slice();
    const tints = Array.from({length:3}, () => new Float32Array(instanceCount * 4));
    const normalA = new Float32Array(instanceCount * 3);
    const normalB = new Float32Array(instanceCount * 3);
    const normalC = new Float32Array(instanceCount * 3);
    for (let i=0;i<instanceCount;i++) {
      for(let j=0;j<3;j++) tints[j].set(colors.subarray(i*12+j*4,i*12+j*4+4),i*4);
      normalA.set(normals.subarray(i*9,i*9+3),i*3);
      normalB.set(normals.subarray(i*9+3,i*9+6),i*3);
      normalC.set(normals.subarray(i*9+6,i*9+9),i*3);
    }
    kinds = new Uint32Array(core.memory.buffer, core.kinds_ptr(), instanceCount).slice();
    const waterCount=core.water_section_count();
    const terrainCount=instanceCount-waterCount;
    const coast=coastlineBuffers(matrices,terrainCount,waterCount,1+definition.water.heightInLevels*height,resolution);
    coastTexture?.dispose();
    coastTexture=B.RawTexture.CreateRGBATexture(coast.textureData,4,coast.textureHeight,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
    waterMaterial.setTexture('shoreSegments',coastTexture);
    waterMaterial.setFloat('coastWidth',.18/resolution);
    for(const [target,start,count] of [[mesh,0,terrainCount],[waterMesh,terrainCount,waterCount]]) {
      target.setEnabled(count>0);
      if(!count)continue;
      target.thinInstanceSetBuffer('matrix',matrices.slice(start*16,(start+count)*16),16,true);
      for(let j=0;j<3;j++)target.thinInstanceSetBuffer(['tintA','tintB','tintC'][j],tints[j].slice(start*4,(start+count)*4),4,true);
      for(const [name,buffer] of [['normalA',normalA],['normalB',normalB],['normalC',normalC]])target.thinInstanceSetBuffer(name,buffer.slice(start*3,(start+count)*3),3,true);
      if(target===waterMesh) {
        waterMesh.metadata={coastBuffers:coast.buffers};
        for(let j=0;j<6;j++)target.thinInstanceSetBuffer(['normalA','normalB','normalC','tintA','tintB','tintC'][j],coast.buffers[j],3,true);
      }
      target.thinInstanceRefreshBoundingInfo(true);
    }
    objectCoastDirty=true;
    compositions.update(core,resolution,chain?.initial?.seed??definition.seed,matrices,tileIds,kinds);
    compositions.show($('trees').checked,$('stones').checked);
    deposits.update(core,matrices,tileIds,kinds,resolution,compositions.depositTiles);
    const propCounts=compositions.stats();
    const customCollision=compositions.collision();
    grass.generate(core,matrices,tints,terrainCount,resolution,oceanState.radius,{blockers:(m,p)=>customCollision.blockers(m,p)});
    grass.update(performance.now(),true);
    selection.rebuild(core,matrices,tileIds,kinds,height);
    $('prop-status').textContent=`${propCounts.forestTiles} forest tiles · ${propCounts.trees.toLocaleString()} trees · ${propCounts.stones} stones (${propCounts.submerged} underwater)`;
    $('tiles').textContent = core.tile_count().toLocaleString();
    $('instances').textContent = instanceCount.toLocaleString();
    generationMs = performance.now() - t;
    $('generation').textContent = generationMs.toFixed(1);
    const surfaceIds = new Uint32Array(core.memory.buffer, core.surfaces_ptr(), core.tile_count());
    $('surfaces').replaceChildren(...definition.surfaces.map((biome, id) => {
      const row = document.createElement('div');
      const swatch = document.createElement('i');
      const rgb = biome.water ? definition.water.color : biome.color;
      swatch.style.background = `rgb(${rgb.slice(0,3).map(x=>Math.round(x*255)).join(',')})`;
      const label = document.createElement('span'); label.textContent = biome.name;
      const count = document.createElement('small'); count.textContent = `${Math.round(100*surfaceIds.filter(x=>x===id).length/surfaceIds.length)}%`;
      row.append(swatch,label,count); return row;
    }));
    $('status').textContent = `${core.water_section_count().toLocaleString()} full-size water sections · terrain retained below. Land color variation ±${Math.round(definition.landVariation*100)}%.`;
    industry.rebuild(resolution,height);

  }
  let benchmark=null;
  $('grass').addEventListener('change',()=>grass.show($('grass').checked));
  $('grass-density').addEventListener('input',()=>{
    $('grass-density-value').value=$('grass-density').value+'%';
    grass.setDensity(Number($('grass-density').value)/100);
  });
  $('grass-benchmark').addEventListener('click',()=>{
    if(benchmark)return;
    benchmark={phase:0,tick:0,off:[],on:[],restore:$('grass').checked};
    grass.show(false);$('grass-benchmark').disabled=true;
    $('grass-benchmark-result').textContent='Comparing off/on at a fixed camera…';
  });
  $('resolution').addEventListener('input', regenerate);
  for (const id of ['sections', 'edges', 'corners', 'water']) $(id).addEventListener('change', regenerate);
  $('stones').addEventListener('change',()=>deposits.show($('stones').checked));
  for(const id of ['trees','stones']) $(id).addEventListener('change',()=>(compositions.show($('trees').checked,$('stones').checked),objectCoastDirty=true));
  $('normals').addEventListener('change', () => {mesh.material=Number($('normals').value)===0?litTerrain:material;for(const m of [material,waterMaterial]) m.setFloat('normalMode', Number($('normals').value));});
  $('water-density').addEventListener('input',()=>{oceanState.density=Number($('water-density').value);$('water-density-value').value=oceanState.density;});
  $('shadows').addEventListener('change',()=>{scene.shadowsEnabled=$('shadows').checked;});
  $('height').addEventListener('input', regenerate);
  $('wireframe').addEventListener('change', () => { litTerrain.wireframe = material.wireframe = waterMaterial.wireframe = $('wireframe').checked; });
  $('reset').addEventListener('click', orbit.reset);
  window.addEventListener('resize', () => engine.resize());
  showLoading('Building your planet…');await paintLoading();
  regenerate();
  scene.onAfterRenderObservable.addOnce(()=>requestAnimationFrame(hideLoading));
  engine.runRenderLoop(() => {
    if(!benchmark)orbit.update(Math.min(engine.getDeltaTime(),50)/1000,$('rotate').checked,1+3*Number($('height').value)/1000);
    grass.update(performance.now());
    waterMaterial.setFloat('waterTime',performance.now()/1000);
    waterMaterial.setVector3('eye',orbit.camera.position);
    industry.update(performance.now());
    if(objectCoastDirty && core.water_section_count()){
      objectCoast.update(underwater.renderList,matrices.subarray((instanceCount-core.water_section_count())*16),oceanState.radius,Number($('resolution').value));objectCoastDirty=false;
    }
    selection.update(performance.now());
    scene.render();
    frames++;
    if(benchmark) {
      benchmark.tick++;
      if(benchmark.tick>25)benchmark[[false,true,true,false][benchmark.phase]?'on':'off'].push(engine.getDeltaTime());
      if(benchmark.tick===85) {
        benchmark.tick=0;benchmark.phase++;
        if(benchmark.phase===4) {
          const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
          const off=mean(benchmark.off),on=mean(benchmark.on);
          $('grass-benchmark-result').textContent=`Frame time: off ${off.toFixed(2)} ms · on ${on.toFixed(2)} ms · Δ ${(on-off).toFixed(2)} ms. Includes VSync and all rendering.`;
          grass.show(benchmark.restore);benchmark=null;$('grass-benchmark').disabled=false;
        } else grass.show([false,true,true,false][benchmark.phase]);
      }
    }
    if(frames%15===0){const g=grass.stats();$('grass-status').textContent=`${g.visible.toLocaleString()} visible tufts · ${g.triangles.toLocaleString()} grass triangles`; }
    if (frames % 30 === 0) $('fps').textContent = Math.round(engine.getFps());
  });
  window.rendererTest = {
    waterCutouts,
    diagnostics: () => ({ selection:selection.stats(), backend, resolution: Number($('resolution').value), tiles: core.tile_count(), pentagons: core.pentagon_count(), instanceCount, vertexCount: mesh.getTotalVertices(), meshes: scene.meshes.length, generationMs, frames, errors: [...errors], matrixFloats: matrices.length, lastTile: tileIds[tileIds.length - 1], sections: core.section_count(), edges: core.edge_count(), corners: core.corner_count(), waterSections: core.water_section_count() }),
  };
}
start().catch((error) => {
  errors.push(String(error));
  failLoading(error);
  $('backend').textContent = 'Initialization failed';
  $('status').textContent = String(error);
  console.error(error);
});
