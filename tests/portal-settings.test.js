// Existing device preferences only; no new account or backend is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
const languageKey='morada.portal.language.v1',prefsKey='morada-interface-preferences-v3';
const settle=async()=>{for(let n=0;n<8;n++)await new Promise(r=>setTimeout(r,0));};
async function setup(stored={},session={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!['css-parsing','not-implemented'].includes(e.type))errors.push(e.message);});
 const dom=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://settings.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  for(const [k,v]of Object.entries(stored))w.localStorage.setItem(k,v);
  for(const [k,v]of Object.entries(session))w.sessionStorage.setItem(k,v);
  w.matchMedia=q=>({matches:q.includes('max-width'),addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;
  w.fetch=()=>{throw Error('Network disconnected; settings must not require inference');};w.scrollTo=()=>{};w.confirm=()=>true;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 const w=dom.window;for(let n=0;n<100&&w.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));assert.equal(w.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 w.document.querySelector('[data-entry-role=admin]').click();await settle();return {w,d:w.document,errors,close:()=>w.close()};
}
function favorites(s,values){s.d.querySelector('[data-ux-action=favorites]').click();const form=s.d.getElementById('uxFavorites');if(values)for(const field of form.querySelectorAll('[name=favorite]'))field.checked=values.includes(field.value);return form;}
const submit=(s,form)=>form.dispatchEvent(new s.w.Event('submit',{bubbles:true,cancelable:true}));
const visible=(s,kind)=>s.d.querySelectorAll('#toast>.portal-feedback[data-notice-state=visible][data-kind='+kind+']');

test('blocked or unretained language writes can retry the selected language and survive a fresh page and re-entry',async()=>{
 for(const failure of ['throw','silent']){
  const s=await setup({[languageKey]:'de'});try{
   const {w,d}=s,proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem;
   proto.setItem=function(key,value){if(this===w.localStorage&&key===languageKey){if(failure==='throw')throw Error('blocked');return;}return original.call(this,key,value);};
   w.MoradaI18n.setLanguage('en');await settle();assert.equal(w.MoradaI18n.language,'en');assert.equal(w.MoradaI18n.storageAvailable,false);assert.equal(w.localStorage.getItem(languageKey),'de');assert.equal(visible(s,'success').length,0);assert.equal(visible(s,'error').length,1);
   proto.setItem=original;w.MoradaI18n.setLanguage('en');await settle();assert.equal(w.MoradaI18n.storageAvailable,true);assert.equal(w.localStorage.getItem(languageKey),'en');assert.equal(visible(s,'error').length,0);assert.equal(visible(s,'success').length,1);
   d.getElementById('portalSignout').click();assert.equal(w.MoradaI18n.language,'en');d.querySelector('[data-entry-role=owner]').click();assert.equal(w.MoradaI18n.language,'en');
   const fresh=await setup({[languageKey]:w.localStorage.getItem(languageKey)});try{assert.equal(fresh.w.MoradaI18n.language,'en');assert.equal(fresh.d.documentElement.lang,'en-GB');assert.equal(fresh.d.querySelector('#entry-heading').textContent,'Welcome.');}finally{fresh.close();}
  }finally{s.close();}
 }
});

test('another tab applies only the latest valid saved language, without writing back, success notices or lost fields',async()=>{
 const s=await setup({[languageKey]:'de'});try{
  const {w,d}=s;w.eval('calendarOpenForm()');const field=d.querySelector('#dialog [name=title]');field.value='Originaler Entwurf';field.focus();
  const event=value=>w.dispatchEvent(new w.StorageEvent('storage',{key:languageKey,newValue:value,storageArea:w.localStorage}));
  w.localStorage.setItem(languageKey,'en');event('de');await settle();assert.equal(w.MoradaI18n.language,'en','read current data rather than stale event');assert.equal(d.documentElement.lang,'en-GB');assert.equal(d.querySelector('#dialog [name=title]'),field);assert.equal(field.value,'Originaler Entwurf');assert.equal(d.activeElement,field);assert.equal(visible(s,'success').length,0);
  const proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem;let writes=0;
  original.call(w.localStorage,languageKey,'de');proto.setItem=function(...args){writes++;return original.apply(this,args);};event('de');await settle();proto.setItem=original;assert.equal(w.MoradaI18n.language,'de');assert.equal(writes,0);
  w.localStorage.setItem(languageKey,'unsupported');event('unsupported');await settle();assert.equal(w.MoradaI18n.language,'de');assert.equal(field.value,'Originaler Entwurf');assert.equal(visible(s,'success').length,0);
  w.localStorage.removeItem(languageKey);event(null);await settle();w.MoradaI18n.setLanguage('de');assert.equal(w.localStorage.getItem(languageKey),'de','same choice recreates a missing preference');
 }finally{s.close();}
});

test('a failed local language choice is not overwritten by another tab before the user retries it',async()=>{
 const s=await setup({[languageKey]:'de'});try{
  const {w}=s,proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem;
  proto.setItem=function(key,value){if(this===w.localStorage&&key===languageKey)throw Error('blocked');return original.call(this,key,value);};w.MoradaI18n.setLanguage('en');proto.setItem=original;
  w.dispatchEvent(new w.StorageEvent('storage',{key:languageKey,newValue:'de'}));assert.equal(w.MoradaI18n.language,'en');assert.equal(w.MoradaI18n.storageAvailable,false);
  w.MoradaI18n.setLanguage('en');assert.equal(w.localStorage.getItem(languageKey),'en');assert.equal(w.MoradaI18n.storageAvailable,true);
 }finally{s.close();}
});

test('favorite write failures preserve the exact selection; retry commits once, retains other workspaces and reloads correctly',async()=>{
 const stored={admin:['today'],manager:['properties']},s=await setup({[prefsKey]:JSON.stringify(stored)});try{
  const {w,d}=s,form=favorites(s,['calendar','properties']),proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem,selection=[...form.querySelectorAll('[name=favorite]:checked')].map(x=>x.value);
  proto.setItem=function(key,value){if(this===w.localStorage&&key===prefsKey)throw Error('blocked');return original.call(this,key,value);};submit(s,form);await settle();
  assert.equal(d.getElementById('dialog').open,true);assert.equal(d.getElementById('uxFavorites'),form);assert.deepEqual([...form.querySelectorAll('[name=favorite]:checked')].map(x=>x.value),selection);assert.equal(visible(s,'success').length,0);assert.equal(visible(s,'error').length,1);assert.deepEqual(JSON.parse(w.localStorage.getItem(prefsKey)),stored);
  const latest={...stored,manager:['tasks','calendar']};original.call(w.localStorage,prefsKey,JSON.stringify(latest));let writes=0;
  proto.setItem=function(key,value){if(this===w.localStorage&&key===prefsKey)writes++;return original.call(this,key,value);};
  d.querySelector('.portal-feedback-action').click();submit(s,form);await settle();proto.setItem=original;assert.equal(writes,1);assert.equal(d.getElementById('dialog').open,false);assert.deepEqual(JSON.parse(w.localStorage.getItem(prefsKey)),{admin:selection,manager:['tasks','calendar']});assert.equal(visible(s,'error').length,0);
  const fresh=await setup({[prefsKey]:w.localStorage.getItem(prefsKey)});try{assert.deepEqual([...fresh.d.querySelectorAll('.ux-pinned a')].map(x=>x.getAttribute('href')),selection.map(id=>'#'+id));fresh.w.MoradaRoles.select('manager');assert.deepEqual([...fresh.d.querySelectorAll('.ux-pinned a')].map(x=>x.getAttribute('href')),['#tasks','#calendar']);}finally{fresh.close();}
 }finally{s.close();}
});

test('cancelling favorites keeps the saved version, and damaged preferences are never silently overwritten',async()=>{
 const initial=JSON.stringify({admin:['today']}),s=await setup({[prefsKey]:initial});try{
  const {w,d}=s;favorites(s,['calendar']);d.querySelector('#uxFavorites [data-action=close]').click();assert.equal(d.getElementById('portalDiscardDialog').open,true);d.querySelector('[data-discard-keep]').click();assert.equal(d.querySelector('#uxFavorites [value=calendar]').checked,true);
  d.querySelector('#uxFavorites [data-action=close]').click();d.querySelector('[data-discard-confirm]').click();assert.equal(w.localStorage.getItem(prefsKey),initial);
  const form=favorites(s);assert.equal(form.querySelector('[value=today]').checked,true);assert.equal(form.querySelector('[value=calendar]').checked,false);
  w.localStorage.setItem(prefsKey,'{damaged');form.querySelector('[value=calendar]').checked=true;submit(s,form);await settle();assert.equal(w.localStorage.getItem(prefsKey),'{damaged');assert.equal(d.getElementById('dialog').open,true);assert.equal(form.querySelector('[value=calendar]').checked,true);assert.equal(visible(s,'success').length,0);assert.equal(visible(s,'error').length,1);
 }finally{s.close();}
});

test('logout clears previous messages and MORA session data while retaining device preferences and portal records',async()=>{
 const thread={session:null,saved:{},pendingReceipt:null,data:null,messages:[{role:'user',content:'Vertraulicher Testinhalt'}]},chatKey='morada.portal.mora.agent.v1.admin';
 const s=await setup({[languageKey]:'en',[prefsKey]:JSON.stringify({admin:['calendar']})},{[chatKey]:JSON.stringify(thread)});try{
  const {w,d}=s,before=w.eval('JSON.stringify(state)');w.MORAPortal.open();assert.match(d.querySelector('.mora-portal-log').textContent,/Vertraulicher Testinhalt/);w.MORAPortal.close();
  w.eval("portalFeedback.notice('Testhinweis','Vorheriger Testinhalt',0,'error')");assert.equal(visible(s,'error').length,1);d.getElementById('portalSignout').click();await settle();
  assert.equal(w.sessionStorage.getItem(chatKey),null);assert.equal(d.getElementById('toast').hidden,true);assert.equal(d.querySelector('.mora-portal-log').textContent.includes('Vertraulicher Testinhalt'),false);assert.equal(w.localStorage.getItem(languageKey),'en');assert.equal(w.eval('JSON.stringify(state)'),before);
  d.querySelector('[data-entry-role=tenant]').click();w.MORAPortal.open();assert.equal(d.querySelector('.mora-portal-log').textContent.includes('Vertraulicher Testinhalt'),false);assert.equal(d.getElementById('toast').textContent,'');assert.equal(w.MoradaI18n.language,'en');
 }finally{s.close();}
});

test('favorite labels use the shared language catalogue while their saved route IDs remain unchanged',async()=>{
 const s=await setup({[languageKey]:'en',[prefsKey]:JSON.stringify({admin:['calendar','properties']})});try{
  const {w,d}=s,before=w.localStorage.getItem(prefsKey),form=favorites(s);
  const label=id=>form.querySelector('[name=favorite][value='+id+']').closest('label').querySelector('span').textContent;
  assert.equal(label('calendar'),'Calendar');assert.equal(label('properties'),'Properties');assert.equal(label('tasks'),'Tasks');assert.equal(label('today'),'Overview');
  d.querySelector('#uxFavorites [data-action=close]').click();w.MoradaI18n.setLanguage('de');const german=favorites(s);assert.equal(german.querySelector('[value=calendar]').closest('label').querySelector('span').textContent,'Kalender');assert.equal(w.localStorage.getItem(prefsKey),before);
 }finally{s.close();}
});
