import {buildingDefinitions} from './building-definitions.js';
import {createPlacementFacing} from './placement-facing.js';
import { createQuestTracker } from './quests.js?quest-art=1';
const products=buildingDefinitions.map((b,kind)=>({kind,name:({0:'Granules',1:'Concrete',3:'Fish',5:'Rough fibers',7:'Tubers',9:'Biomass',6:'Worker clothes',8:'Beer',10:'Power'})[kind]||b.name,icon:b.farm!==undefined?b.buildingIcon:b.icon,detail:b.name}));
const chains={1:[0,1],6:[5,6],8:[7,8],10:[9,10]};
export function createBuildMenu({selection,showToolTarget,cost,refund,buildingAt,demolish,upgradeInfo,upgrade,tutorial,acknowledgeStory,unlocked,unlockPopulation,showCoverage,validate,sides,build,showGhost,errors}){
  const facingChoice=createPlacementFacing();
  const root=document.getElementById('build-menu');let fieldParent=null,active=null,tool=null,hover=null,side=0,chain=null,pointerInside=false;
  root.innerHTML=`<section id="chain-picker" hidden aria-label="Industry chain"><div class="chain-heading">CONCRETE INDUSTRY <button id="close-chain" aria-label="Close industry chain">×</button></div><div class="chain-resources"></div><small>Choose a resource to place its producer</small></section><div id="placement-status" hidden><b></b><div id="placement-cost"><img src="icons/concrete.svg" alt=""><strong>1</strong> concrete</div><span></span><small id="placement-coverage"></small><div><button id="rotate-placement">Rotate · R</button><button id="cancel-placement">Cancel · Esc</button></div></div><div class="construction-dock"><div class="tool-bar" aria-label="Building tools"></div><div class="product-bar"></div></div>`;
  const quests=createQuestTracker(kind=>start(kind),unlocked,acknowledgeStory);
  const status=root.querySelector('#placement-status'),picker=root.querySelector('#chain-picker');
  root.insertBefore(status,picker);
  function iconButton(product,action,label){const button=document.createElement('button');button.className='product-button';button.setAttribute('aria-label',label);button.title=product.detail;button.innerHTML=`<img src="icons/${product.icon}" alt=""><span>${product.name}</span>`;button.addEventListener('click',action);return button;}
  const buttons=new Map();
  for(const kind of [2,3,1,4,6,8,10,11]){const product=products.find(p=>p.kind===kind),button=iconButton(product,()=>chains[kind]?openChain(kind):start(kind),chains[kind]?'Open '+product.name+' industry chain':`Place ${product.name}`);root.querySelector('.product-bar').append(button);buttons.set(kind,button);}
  function fillChain(){const list=picker.querySelector('.chain-resources');list.replaceChildren();if(chain===null)return;picker.querySelector('.chain-heading').firstChild.textContent=products[chain].name.toUpperCase()+' INDUSTRY ';for(const [index,kind] of chains[chain].entries()){if(index){const arrow=document.createElement('span');arrow.className='chain-arrow';arrow.textContent='→';list.append(arrow);}const b=iconButton(products[kind],()=>start(kind),'Place '+buildingDefinitions[kind].name);b.dataset.kind=kind;list.append(b);}}
  const toolButtons=new Map();
  const tools=[
    ['pipette','Pipette','<path d="m14 3 7 7-3 3-7-7zM13 8l-9 9v4h4l9-9M3 22l2-2"/>'],
    ['demolish','Demolish','<path fill="currentColor" stroke="none" d="M3 6h8l2 7h3v3H2v-5h1zm2 2v4h5L9 8zM5 17h9a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6zm0 2a1 1 0 0 0 0 2h9a1 1 0 0 0 0-2zM20 10h2v13h-4v-3h-2v-3h3z"/>'],
    ['upgrade','Upgrade housing','<path d="m4 11 8-8 8 8M8 9v12h8V9"/>']
  ];
  for(const [mode,label,path] of tools){
    const button=document.createElement('button');button.className='tool-button';button.setAttribute('aria-label',label);button.title=label;
    button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    button.addEventListener('click',()=>{if(tool===mode){cancel();return;}cancel();selection.select(null);tool=mode;hover=selection.getHovered();render();});
    root.querySelector('.tool-bar').append(button);toolButtons.set(mode,button);
  }
  function toolFeedback(){
    const b=hover===null?null:buildingAt(hover);
    if(tool==='pipette')return {allowed:Boolean(b),reason:b?`Click to copy ${products.find(p=>p.kind===b[1])?.name||'building'}`:'Choose a placed building'};
    if(tool==='demolish')return {allowed:Boolean(b),reason:b?`Refund ${refund(hover)} concrete`:'Choose a placed building'};
    return upgradeInfo(hover);
  }
  function openChain(kind){const previous=chain;cancel(false);chain=previous===kind?null:kind;fillChain();render();}
  function start(kind,facing,parent=null){fieldParent=parent;if(!unlocked(kind))return;showToolTarget(null);tool=null;active=kind;chain=Object.keys(chains).map(Number).find(k=>chains[k].includes(kind))??null;fillChain();selection.select(null);hover=selection.getHovered();facingChoice.reset(facing);side=facingChoice.choose(hover,sides(hover,kind));render();}
  function cancel(close=true){fieldParent=null;showToolTarget(null);active=null;tool=null;if(close)chain=null;showGhost(null);showCoverage(null);selection.setHoverColor([.65,1,.89]);render();}
  const placementSides=()=>sides(hover,active).filter(s=>fieldParent===null||sides(hover,active,fieldParent).includes(s));
  const placementError=()=>hover===null?0:validate(hover,active)||(fieldParent!==null&&!placementSides().length?10:0);
  function render(){
    const progress=tutorial();
    quests.update(progress);
    for(const [kind,button] of buttons){
      const locked=!unlocked(kind);
      button.disabled=locked;button.title=locked?`Unlocks at ${unlockPopulation(kind)} residents`:products.find(p=>p.kind===kind).detail;
    }
    for(const button of picker.querySelectorAll('[data-kind]'))button.disabled=!unlocked(Number(button.dataset.kind));
    document.body.classList.toggle('placing-building',active!==null||tool!==null);
    picker.hidden=chain===null;status.hidden=active===null&&tool===null;
    for(const [mode,button] of toolButtons)button.setAttribute('aria-pressed',String(tool===mode));
    root.querySelector('#rotate-placement').hidden=tool!==null||buildingDefinitions[active]?.farm!==undefined;
    root.querySelector('#placement-cost').hidden=active===null;
    for(const [kind,button] of buttons)button.setAttribute('aria-pressed',String(chains[kind]?chain===kind:active===kind));
    for(const b of picker.querySelectorAll('[data-kind]'))b.setAttribute('aria-pressed',String(Number(b.dataset.kind)===active));
    root.querySelector('#placement-coverage').textContent='';
    if(tool){
      const feedback=toolFeedback();
      status.querySelector('b').textContent=tools.find(t=>t[0]===tool)[1];
      status.querySelector('span').textContent=feedback.reason;
      status.classList.toggle('invalid',!feedback.allowed&&!feedback.ready);
      selection.setHoverColor(tool==='demolish'?[1,.35,.3]:(feedback.allowed||feedback.ready)?[.45,1,.65]:[1,.65,.3]);
      showGhost(null);showCoverage(null);showToolTarget(pointerInside?hover:null,tool);return;
    }
    if(active===null)return;
    const options=placementSides();side=facingChoice.choose(hover,options);
    const error=placementError();
    status.querySelector('b').textContent=buildingDefinitions[active].name;
    status.querySelector('span').textContent=error?errors[error]:'';
    root.querySelector('#placement-cost strong').textContent=cost(active);
    status.classList.toggle('invalid',Boolean(error));selection.setHoverColor(error?[1,.35,.3]:[.45,1,.65]);
    root.querySelector('#rotate-placement').disabled=options.length<2;
    showGhost(pointerInside?hover:null,active,side,Boolean(error));root.querySelector('#placement-coverage').textContent=showCoverage((buildingDefinitions[active].utility||active===2||fieldParent!==null)?(hover??fieldParent):null,active,true,fieldParent);
  }
  function rotate(){if(active===null)return;const options=sides(hover,active);if(options.length){side=facingChoice.rotate(hover,options);render();}}
  selection.onHover(value=>{pointerInside=true;hover=value;if(active!==null||tool)render();});
  selection.onActivate(value=>{
    if(tool){
      hover=value;const feedback=toolFeedback();
      if(value!==null&&feedback.allowed){
        if(tool==='pipette'){const b=buildingAt(value);start(b[1]);}
        else if(tool==='demolish')demolish(value);
        else upgrade(value);
      }
      render();return true;
    }
    if(active===null)return false;hover=value;render();if(value!==null&&!placementError()){const kind=active,error=build(value,kind,side);if(!error){facingChoice.reset();const field=buildingDefinitions[kind].field;if(field!==undefined)start(field,undefined,value);}render();}return true;});
  document.getElementById('planet').addEventListener('pointerleave',()=>{pointerInside=false;showGhost(null);showToolTarget(null);});
  document.getElementById('planet').addEventListener('contextmenu',e=>{if(active!==null||tool||chain){e.preventDefault();cancel();}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape')cancel();if(e.key.toLowerCase()==='r'&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();rotate();}});
  root.querySelector('#rotate-placement').addEventListener('click',rotate);root.querySelector('#cancel-placement').addEventListener('click',()=>cancel());root.querySelector('#close-chain').addEventListener('click',()=>cancel());
  return {place:start,refresh:()=>render(),reset:()=>cancel(),isPlacing:()=>active!==null||tool!==null};
}
