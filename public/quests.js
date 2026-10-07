export function questDetails(p){
  const row=(label,value,target,kind)=>({label,value:Math.min(value,target),target,kind});
  const phases=[
    {phase:1,art:"story-art/arrival.png",story:"From orbit, a quiet stretch of coastline looks like the perfect place to begin. Our first homes will turn a landing site into a place to stay.",title:'Welcome the colonists',hint:'Build two housing units for your first settlers.',rows:[row('Build housing',p.homes,2,2)],reward:1},
    {phase:2,art:"story-art/housing.png",story:"The settlers are unpacking, and the food crates are getting lighter. Those coastal waters could keep us fed.",title:'Feed the colony',hint:'Place fishing docks beside water to help your colony grow.',rows:[row('Fulfill fish in two houses',p.fed,2,3),row('Reach 10 residents',p.population,10,2)],reward:2},
    {phase:3,art:"story-art/fish.png",story:"Local stone will give us something to build with. A quarry and a concrete factory will supply the foundations of our growing colony.",title:'Establish concrete production',hint:'Build a quarry on a stone deposit and a concrete factory.',rows:[row('Build a quarry',p.quarries,1,0),row('Build a concrete factory',p.factories,1,1)],reward:2},
    {phase:4,art:"story-art/concrete.png",story:"We can feed ourselves and make our own building materials. It’s time to welcome more settlers.",title:'Expand the settlement',hint:'Use your concrete to build more housing. Feed the new residents to unlock Commons.',rows:[row('Reach 20 residents',p.population,20,2)],reward:3},
    {phase:5,art:"story-art/expansion.png",story:"The settlement is growing, but everyone still heads straight home after work. A Commons would give our neighbours somewhere to meet.",title:'Bring people together',hint:'Build a Commons serving your homes. Its need adds room for five more residents per house.',rows:[row('Fulfill Commons in four houses',p.covered,4,4)]},
    {phase:6,art:'story-art/commons.png',story:'Our first settlement has taken root. More neighbours will bring the skills we need to grow crops and make everyday comforts here.',title:'A growing community',hint:'Expand to 60 residents to unlock farms, clothing and beer.',rows:[row('Reach 60 residents',p.population,60,2)],reward:12},
    {phase:7,art:'story-art/growing-colony.png',story:'Fields supply the harvest; the farm brings it together. Plant rough fibers for clothing and tubers for the brewery.',title:'Cultivate the land',hint:'Place a Fiber Farm and a Tuber Farm, then add three adjacent fields to each.',rows:[row('Fiber fields',p.fiberFields,3,5),row('Tuber fields',p.tuberFields,3,7)],reward:10},
    {phase:8,art:'story-art/harvest.png',story:'A fresh set of work clothes and a drink after a long shift will make this outpost feel more like home.',title:'Everyday comforts',hint:'Build a Weaving Mill and a Brewery. Supply enough clothes and beer for your residents.',rows:[row('Worker clothes fulfilled',p.clothes,1,6),row('Beer fulfilled',p.beer,1,8)]},
    {phase:9,art:'story-art/everyday-comforts.png',story:'Our colony is ready for its next leap. A larger community can support electricity and a local radio service.',title:'Room to grow',hint:'Welcome 100 residents to unlock biomass, power and radio.',rows:[row('Reach 100 residents',p.population,100,2)],reward:20},
    {phase:10,art:'story-art/everyday-comforts.png',story:'Biomass can keep our generators turning. Electricity will speed up industry and carry the colony’s first radio broadcast.',title:'Power the settlement',hint:'Grow biomass in three fields, feed a generator, and power a Radio Station serving housing.',rows:[row('Biomass fields',p.biomassFields,3,9),row('Build a generator',p.generators,1,10),row('Radio fulfilled',p.radio,1,11)]},
    {phase:11,art:'story-art/powered-colony.png',story:'The essentials are in place. Keep every need supplied and let a home fill with residents, ready for the next chapter.',title:'Ready for the next step',hint:'Fully inhabit a housing unit and fulfill all its needs.',rows:[row('Housing ready to upgrade',p.ready,1,2)]},
    {phase:11,art:'story-art/powered-colony.png',story:'Your colony is ready to grow into something more. Your residents have everything they need for the next stage of settlement.',title:'Ready to upgrade',hint:'All tier-one needs are met. Tier two is not available yet.',rows:[]},
  ];
  return phases[Math.min(p.stage,11)];
}
export function createQuestTracker(place,unlocked,acknowledgeStory){
  const panel=document.createElement('section');panel.id='quest-tracker';panel.setAttribute('aria-label','Colony quests');document.body.append(panel);
  const dialog=document.createElement('dialog');dialog.id='quest-story-dialog';dialog.setAttribute('aria-labelledby','quest-story-title');
  dialog.innerHTML='<img class="quest-story-art" alt=""><small class="quest-phase"></small><h2 id="quest-story-title"></h2><p></p><form method="dialog"><button autofocus>Continue</button></form>';
  document.body.append(dialog);
  let activeStory=null;
  dialog.addEventListener('close',()=>{if(activeStory){const story=activeStory;activeStory=null;acknowledgeStory(story.key,story.stage);}});
  let key='',stage=-1;
  return {update(progress){
    const q=questDetails(progress);
    if(!document.querySelector('#colony-loading:not([hidden])') && progress.storyKey && q.story && progress.stage>(progress.storySeen??-1) && !dialog.open){
      activeStory={key:progress.storyKey,stage:progress.stage};
      dialog.querySelector('img').src=q.art;
      dialog.querySelector('small').textContent=progress.stage===11?'COMPLETE':`PHASE ${q.phase} / 11`;
      dialog.querySelector('h2').textContent=q.title;
      dialog.querySelector('p').textContent=q.story;
      dialog.showModal();
    }
    const next=JSON.stringify([q,progress.stage]);if(key===next)return;key=next;
    panel.innerHTML=`<small class="quest-phase">${progress.stage===11?'COMPLETE':`PHASE ${q.phase} / 11`}</small><h2>${q.title}</h2><p class="quest-hint">${q.hint}</p><div class="quest-objectives">${q.rows.map(r=>`<button data-kind="${r.kind}" ${unlocked(r.kind)?'':'disabled'}><span class="quest-check">${r.value>=r.target?'✓':'○'}</span><span>${r.label}</span><b>${r.value} / ${r.target}</b></button>`).join('')}</div>${q.reward?`<div class="quest-reward"><span>Reward</span><img src="icons/concrete.png" alt="Concrete"><b>+${q.reward}</b></div>`:''}`;
    for(const button of panel.querySelectorAll('[data-kind]'))button.addEventListener('click',()=>place(Number(button.dataset.kind)));
    if(stage!==progress.stage){panel.animate([{opacity:.3,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],{duration:300});stage=progress.stage;}
  }};
}
