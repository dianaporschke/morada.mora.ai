// Mobile viewport and overlay lifecycle, using the existing portal handlers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
const settle=async()=>{for(let n=0;n<6;n++)await new Promise(r=>setTimeout(r,0));};
async function setup(withViewport=true){
 const errors=[],scrolls=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>{if(!['css-parsing','not-implemented'].includes(e.type))errors.push(e.message);});
 const dom=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://mobile.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  Object.defineProperty(w,'innerWidth',{value:390,writable:true});Object.defineProperty(w,'innerHeight',{value:844,writable:true});
  w.matchMedia=q=>({get matches(){const max=q.match(/max-width:\s*(\d+)px/);return max?w.innerWidth<=Number(max[1]):false;},addEventListener(){},removeEventListener(){}});
  w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.fetch=()=>{throw Error('No AI calls in mobile tests');};w.confirm=()=>true;
  w.scrollTo=(x,y)=>{const pos=typeof x==='object'?x:{left:x,top:y};w.scrollX=pos.left||0;w.scrollY=pos.top||0;scrolls.push({left:w.scrollX,top:w.scrollY});};
  w.requestAnimationFrame=fn=>w.setTimeout(fn,0);w.cancelAnimationFrame=id=>w.clearTimeout(id);
  if(withViewport){const viewport=new w.EventTarget();Object.assign(viewport,{height:844,width:390,offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(w,'visualViewport',{value:viewport});}
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 const w=dom.window;for(let n=0;n<100&&w.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(w.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 return {w,d:w.document,errors,scrolls,locked:()=>w.document.documentElement.classList.contains('portal-mobile-locked'),close:()=>w.close()};
}

test('a nested discard decision keeps the page locked and restores its position only after closing the editor',async()=>{
 const s=await setup();try{
  const {w,d,locked,scrolls}=s;w.scrollTo(0,580);w.eval('calendarOpenForm()');await settle();assert.equal(locked(),true);
  assert.equal(d.body.style.getPropertyValue('--portal-page-top'),'-580px');
  const form=d.getElementById('opsEntryForm'),field=form.elements.title;field.value='Entwurf bleibt erhalten';
  d.querySelector('#dialog .close').click();await settle();assert.equal(d.getElementById('portalDiscardDialog').open,true);assert.equal(locked(),true);
  d.querySelector('[data-discard-keep]').click();await settle();assert.equal(locked(),true);assert.equal(form.elements.title,field);assert.equal(field.value,'Entwurf bleibt erhalten');
  form.querySelector('[data-action=close]').click();await settle();d.querySelector('[data-discard-confirm]').click();await settle();
  assert.equal(d.getElementById('dialog').open,false);assert.equal(locked(),false);assert.equal(d.body.style.getPropertyValue('--portal-page-top'),'');assert.deepEqual(scrolls.at(-1),{left:0,top:580});
 }finally{s.close();}
});

test('drawer and settings share the same scroll lock and desktop rotation releases it without changing data',async()=>{
 const s=await setup();try{
  const {w,d,locked}=s,before=w.eval('JSON.stringify(state)');w.scrollTo(0,370);d.getElementById('menuToggle').click();await settle();assert.equal(locked(),true);
  d.getElementById('profileMenuButton').click();d.getElementById('personalSettingsButton').click();await settle();assert.equal(locked(),true);
  d.querySelector('[data-ps-tab=security]').click();d.querySelector('#dialog .close').click();await settle();assert.equal(locked(),true,'drawer is still open');
  w.eval('closeMenu()');await settle();assert.equal(locked(),false);assert.equal(w.scrollY,370);
  w.eval('calendarOpenForm()');await settle();const field=d.querySelector('#dialog [name=title]');field.value='Drehen ohne Datenverlust';
  w.innerWidth=1440;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(locked(),false);assert.equal(d.getElementById('dialog').open,true);
  w.innerWidth=390;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(locked(),true);assert.equal(field.value,'Drehen ohne Datenverlust');assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{s.close();}
});

test('visual viewport resize scrolls the focused field inside its form without replacing inputs or moving page focus',async()=>{
 const s=await setup();try{
  const {w,d}=s;w.eval('calendarOpenForm()');await settle();const root=d.getElementById('portalPreview'),field=d.querySelector('#dialog [name=title]'),region=d.querySelector('.ux-form-scroll');
  field.value='Tastaturprüfung';region.getBoundingClientRect=()=>({top:100,bottom:300,height:200});field.getBoundingClientRect=()=>({top:400,bottom:444,height:44});
  field.focus();await settle();assert.ok(region.scrollTop>0);assert.equal(d.activeElement,field);
  Object.assign(w.visualViewport,{height:360,offsetTop:120});w.visualViewport.dispatchEvent(new w.Event('resize'));await settle();
  assert.equal(root.style.getPropertyValue('--portal-viewport-height'),'360px');assert.equal(root.style.getPropertyValue('--portal-viewport-top'),'120px');assert.equal(field.value,'Tastaturprüfung');assert.equal(d.activeElement,field);
  const previous=root.style.getPropertyValue('--portal-viewport-height');Object.assign(w.visualViewport,{height:180,scale:2});w.visualViewport.dispatchEvent(new w.Event('resize'));await settle();assert.equal(root.style.getPropertyValue('--portal-viewport-height'),previous,'browser zoom is not overridden');
 }finally{s.close();}
});

test('browsers without VisualViewport retain usable resize handling and preserve the existing input types',async()=>{
 const s=await setup(false);try{
  const {w,d}=s;w.eval("crmOpenContactForm('','owner')");await settle();
  assert.equal(d.querySelector('#dialog [name=email]').type,'email');assert.equal(d.querySelector('#dialog [name=phone]').type,'tel');
  w.innerHeight=400;w.dispatchEvent(new w.Event('resize'));await settle();assert.equal(d.getElementById('portalPreview').style.getPropertyValue('--portal-viewport-height'),'400px');assert.equal(d.getElementById('dialog').open,true);
 }finally{s.close();}
});
