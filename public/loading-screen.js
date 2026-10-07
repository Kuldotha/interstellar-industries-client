let screen;
function element(){
 if(screen)return screen;
 screen=document.createElement('section');screen.id='colony-loading';screen.hidden=true;screen.setAttribute('aria-label','Loading colony');screen.setAttribute('aria-busy','true');
 screen.innerHTML='<div class="loading-copy"><p class="eyebrow">INTERSTELLAR INDUSTRIES</p><h1>A world of your own</h1><p role="status" aria-live="polite"></p><div class="loading-track" aria-hidden="true"><i></i></div><button hidden>Try again</button></div>';
 screen.querySelector('button').onclick=()=>location.reload();document.body.append(screen);return screen;
}
export function showLoading(message='Opening your colony…'){
 const node=element();node.hidden=false;node.setAttribute('aria-busy','true');node.querySelector('[role=status]').textContent=message;node.querySelector('button').hidden=true;node.querySelector('.loading-track').hidden=false;
}
export function hideLoading(){if(screen){screen.hidden=true;screen.setAttribute('aria-busy','false');}}
export function failLoading(error){showLoading('Unable to open your colony. '+(error.message||String(error)));screen.setAttribute('aria-busy','false');screen.querySelector('button').hidden=false;screen.querySelector('.loading-track').hidden=true;}
export const paintLoading=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
