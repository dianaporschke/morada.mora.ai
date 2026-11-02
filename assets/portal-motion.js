// Presentation only. Never delay or wrap navigation, form submission or persistence.
export function installPortalMotion(document, window) {
 const root=document.getElementById('portalPreview'),main=document.getElementById('main');
 if(!root||!main||root.dataset.motionReady)return;
 root.dataset.motionReady='true';
 const media=window.matchMedia('(prefers-reduced-motion: reduce)'),active=new Set(),running=new WeakMap();
 function reveal(element,distance=3){
  if(!element||media.matches||root.hidden||!element.animate)return;
  running.get(element)?.cancel();
  const animation=element.animate([{opacity:.45,translate:`0 ${distance}px`},{opacity:1,translate:'0 0'}],{duration:200,easing:'cubic-bezier(.2,.6,.3,1)'});
  active.add(animation);running.set(element,animation);
  const done=()=>{active.delete(animation);if(running.get(element)===animation)running.delete(element);};
  animation.onfinish=done;animation.oncancel=done;
 }
 function snapshot(){return {route:window.location.hash,period:main.querySelector('#calPeriod')?.textContent,day:main.querySelector('#calJump')?.value,view:main.querySelector('.cal-workspace')?.dataset.view};}
 let previous=snapshot();
 const pageObserver=new window.MutationObserver(()=>{
  const next=snapshot();
  if(next.route!==previous.route)reveal(main);
  else if(next.period!==previous.period||next.view!==previous.view){reveal(main.querySelector('#calContent'));reveal(main.querySelector('#calSelectedDay'));}
  else if(next.day!==previous.day){reveal(main.querySelector('#calSelectedDay'));reveal(main.querySelector('.cal-cell.is-selected'),0);}
  previous=next;
 });
 pageObserver.observe(main,{childList:true});
 const dialog=document.getElementById('dialog');
 const dialogObserver=new window.MutationObserver(()=>{if(dialog?.open)reveal(dialog.querySelector('.dialog-body'),2);});
 if(dialog)dialogObserver.observe(dialog,{childList:true});
 function toggle(event){
  const details=event.target;
  if(!details.matches?.('details[open]')||!root.contains(details))return;
  for(const child of details.children)if(child.tagName!=='SUMMARY')reveal(child,2);
 }
 root.addEventListener('toggle',toggle,true);
 function reduce(){if(media.matches)for(const animation of [...active]){animation.cancel();active.delete(animation);}}
 media.addEventListener?.('change',reduce);
 return ()=>{pageObserver.disconnect();dialogObserver.disconnect();root.removeEventListener('toggle',toggle,true);media.removeEventListener?.('change',reduce);for(const animation of [...active])animation.cancel();delete root.dataset.motionReady;};
}
