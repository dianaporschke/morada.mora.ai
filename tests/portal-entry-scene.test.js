import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installEntryScene} from '../assets/portal-entry-scene.js';

const tick = () => new Promise(resolve => setTimeout(resolve,0));
function setup(reduce=false) {
 const dom = new JSDOM('<section id="moradaEntry"><div class="entry-art"><div class="entry-scene" aria-hidden="true"><div class="entry-city-camera"><img class="entry-city-image" alt="" src="/city.png"></div></div></div><form><input name="entryRole" value="owner"><button>Open</button></form></section>',{pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('.entry-scene');
 const media={matches:reduce,addEventListener(_t,fn){this.listener=fn;},removeEventListener(){}};
 w.matchMedia=()=>media;let intersection;
 w.IntersectionObserver=class{constructor(fn){intersection=fn;}observe(){}disconnect(){}};
 let decoded,failed,fallback;const nativeTimeout=w.setTimeout.bind(w);
 w.setTimeout=(fn,delay,...args)=>{if(delay===1500){fallback=fn;return 0;}return nativeTimeout(fn,delay,...args);};
 w.Image=function(){const image=w.document.createElement('img');image.decode=()=>new Promise((resolve,reject)=>{decoded=resolve;failed=reject;});return image;};
 const dispose=installEntryScene(root,w);
 return {w,root,media,dispose,decoded,failed,fallback:()=>fallback(),intersect:value=>intersection([{isIntersecting:value}]),toggle:()=>w.document.querySelector('.entry-motion-toggle')};
}
test('decode and background visibility preserve the workspace form without a visible animation control',async()=>{
 const s=setup();try{
  const form=s.w.document.querySelector('form'),before=form.outerHTML;
  assert.ok(s.root.classList.contains('is-preparing'));assert.equal(s.toggle(),null);
  s.decoded();await tick();assert.ok(s.root.classList.contains('is-ready'));assert.equal(s.root.dataset.paused,'false');
  Object.defineProperty(s.w.document,'hidden',{configurable:true,value:true});
  s.w.document.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.root.dataset.paused,'true');
  Object.defineProperty(s.w.document,'hidden',{configurable:true,value:false});
  s.w.document.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.root.dataset.paused,'false');
  s.intersect(false);assert.equal(s.root.dataset.paused,'true');s.intersect(true);assert.equal(s.root.dataset.paused,'false');
  assert.equal(form.outerHTML,before);assert.equal(s.toggle(),null);
  installEntryScene(s.root,s.w);assert.equal(s.root.querySelectorAll('.entry-city-reveal').length,1);
 }finally{s.dispose();s.w.close();}
});
test('reduced motion and returning from a workspace show the completed illustration without replay',async()=>{
 const s=setup(true);try{
  s.decoded();await tick();assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.toggle(),null);assert.equal(s.root.dataset.paused,'true');
  s.media.matches=false;s.media.listener();assert.equal(s.toggle(),null);
  const entry=s.w.document.querySelector('#moradaEntry');entry.hidden=true;await tick();assert.equal(s.root.dataset.paused,'true');
  entry.hidden=false;await tick();assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.root.dataset.paused,'true');

 }finally{s.dispose();s.w.close();}
});
test('late image decoding after disposal cannot restart a removed animation',async()=>{
 const s=setup();s.dispose();s.decoded();await tick();
 assert.equal(s.root.querySelector('svg'),null);assert.equal(s.toggle(),null);assert.equal(s.root.className,'entry-scene');s.w.close();
});

test('transparent pencil artwork is revealed through a mask and becomes still at completion',async()=>{
 const s=setup();try{
  s.decoded();await tick();
  const svg=s.root.querySelector('.entry-city-reveal');
  assert.equal(svg.querySelector('image').getAttribute('href'),'assets/entry-city-ink.png');
  assert.equal(s.root.querySelector('.entry-city-image').getAttribute('src'),'assets/entry-city-ink.png');
  assert.ok(svg.querySelectorAll('mask path').length>0);
  assert.equal(svg.querySelectorAll(':scope > path').length,0);
  const ended=new s.w.Event('animationend',{bubbles:true});
  Object.defineProperty(ended,'animationName',{value:'morada-pencil-finish'});
  svg.querySelector('.entry-pencil-finish').dispatchEvent(ended);
  assert.ok(s.root.classList.contains('is-complete'));
  assert.equal(s.root.dataset.paused,'true');assert.equal(s.toggle(),null);
  s.intersect(false);s.intersect(true);assert.equal(s.root.dataset.paused,'true');
 }finally{s.dispose();s.w.close();}
});

test('a stalled decorative image cannot hold the entry form and falls back without late replay',async()=>{
 const s=setup();try{
  const form=s.w.document.querySelector('form');let submits=0;
  form.addEventListener('submit',event=>{event.preventDefault();submits++;});
  form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(submits,1);
  assert.equal(form.hidden,false);assert.equal(form.querySelector('button').disabled,false);
  s.fallback();assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.root.classList.contains('is-preparing'),false);
  s.decoded();await tick();assert.ok(s.root.classList.contains('is-ready'));assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.root.dataset.paused,'true');
  form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(submits,2);
 }finally{s.dispose();s.w.close();}
});

test('a failed decorative image leaves an immediate still fallback and the form enabled',async()=>{
 const s=setup();try{
  s.failed(new Error('Network unavailable'));await tick();
  assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.root.classList.contains('is-preparing'),false);
  assert.equal(s.w.document.querySelector('form button').disabled,false);
 }finally{s.dispose();s.w.close();}
});
