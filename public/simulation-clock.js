export function createSimulationClock(advance,now) {
  let last=now,remainder=0,rate=1;
  function update(time) {
    const elapsed=Math.max(0,time-last)/1000;last=time;
    if(rate===0)return;
    remainder+=elapsed*rate;
    const ticks=Math.min(3600,Math.floor(remainder));
    if(ticks>0){remainder-=ticks;advance(ticks);}
  }
  return {
    update,
    setRate(value,time){if(![0,1,5,20,60].includes(value))return;update(time);rate=value;},
    step(seconds,time){if(!Number.isInteger(seconds)||seconds<1||seconds>3600)return;update(time);advance(seconds);},
    reset(time){last=time;remainder=0;},
    getRemainder:()=>Math.min(1,remainder),
    getRate:()=>rate
  };
}
