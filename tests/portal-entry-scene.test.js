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
 let decoded;root.querySelector('img').decode=()=>new Promise(resolve=>{decoded=resolve;});
 const dispose=installEntryScene(root,w);
 return {w,root,media,dispose,decoded,intersect:value=>intersection([{isIntersecting:value}]),toggle:()=>w.document.querySelector('.entry-motion-toggle')};
}
test('decode, pause/resume and background visibility preserve the workspace form',async()=>{
 const s=setup();try{
  const form=s.w.document.querySelector('form'),before=form.outerHTML;
  assert.ok(s.root.classList.contains('is-preparing'));assert.equal(s.toggle().hidden,true);
  s.decoded();await tick();assert.ok(s.root.classList.contains('is-ready'));assert.equal(s.root.dataset.paused,'false');
  assert.equal(s.toggle().getAttribute('aria-label'),'Animation pausieren');
  s.toggle().click();assert.equal(s.root.dataset.paused,'true');assert.equal(s.toggle().getAttribute('aria-label'),'Animation fortsetzen');
  s.intersect(false);s.intersect(true);assert.equal(s.root.dataset.paused,'true','intersection must not override the user pause');
  s.toggle().click();assert.equal(s.root.dataset.paused,'false');
  Object.defineProperty(s.w.document,'hidden',{configurable:true,value:true});
  s.w.document.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.root.dataset.paused,'true');
  Object.defineProperty(s.w.document,'hidden',{configurable:true,value:false});
  s.w.document.dispatchEvent(new s.w.Event('visibilitychange'));assert.equal(s.root.dataset.paused,'false');
  s.intersect(false);assert.equal(s.root.dataset.paused,'true');s.intersect(true);assert.equal(s.root.dataset.paused,'false');
  s.w.MoradaI18n={t:key=>key==='Animation pausieren'?'Pause animation':'Resume animation'};
  s.w.dispatchEvent(new s.w.Event('morada:languagechange'));assert.equal(s.toggle().getAttribute('aria-label'),'Pause animation');
  s.toggle().click();assert.equal(s.toggle().getAttribute('aria-label'),'Resume animation');
  assert.equal(form.outerHTML,before);assert.equal(s.toggle().closest('[aria-hidden="true"]'),null);
  installEntryScene(s.root,s.w);assert.equal(s.w.document.querySelectorAll('.entry-motion-toggle').length,1);
 }finally{s.dispose();s.w.close();}
});
test('reduced motion and returning from a workspace show the completed illustration without replay',async()=>{
 const s=setup(true);try{
  s.decoded();await tick();assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.toggle().hidden,true);assert.equal(s.root.dataset.paused,'true');
  s.media.matches=false;s.media.listener();assert.equal(s.toggle().hidden,true);
  const entry=s.w.document.querySelector('#moradaEntry');entry.hidden=true;await tick();assert.equal(s.root.dataset.paused,'true');
  entry.hidden=false;await tick();assert.ok(s.root.classList.contains('is-complete'));assert.equal(s.root.dataset.paused,'true');

 }finally{s.dispose();s.w.close();}
});
test('late image decoding after disposal cannot restart a removed animation',async()=>{
 const s=setup();s.dispose();s.decoded();await tick();
 assert.equal(s.root.querySelector('svg'),null);assert.equal(s.toggle(),null);assert.equal(s.root.className,'entry-scene');s.w.close();
});

test('the original artwork is revealed through a mask and becomes still at completion',async()=>{
 const s=setup();try{
  s.decoded();await tick();
  const svg=s.root.querySelector('.entry-city-reveal');
  assert.equal(svg.querySelector('image').getAttribute('href'),'/city.png');
  assert.ok(svg.querySelectorAll('mask path').length>0);
  assert.equal(svg.querySelectorAll(':scope > path').length,0);
  const ended=new s.w.Event('animationend',{bubbles:true});
  Object.defineProperty(ended,'animationName',{value:'morada-pencil-finish'});
  svg.querySelector('.entry-pencil-finish').dispatchEvent(ended);
  assert.ok(s.root.classList.contains('is-complete'));
  assert.equal(s.root.dataset.paused,'true');assert.equal(s.toggle().hidden,true);
  s.intersect(false);s.intersect(true);assert.equal(s.root.dataset.paused,'true');
 }finally{s.dispose();s.w.close();}
});
