// Native DOM integration tests, with no model responses or paid AI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(narrow=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://ui.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:narrow,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.fetch=()=>{throw Error('No inference in a UI test');};w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=indexedDB;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 for(let n=0;n<100&&d.window.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(d.window.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 const w=d.window;w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));return w;
}
test('profile menu uses the native preview switcher in all four areas and never changes records',async()=>{
 const w=await setup();try{
  const doc=w.document,toggle=doc.getElementById('profileMenuButton'),menu=doc.getElementById('profileMenu');
  for(const role of ['tenant','owner','manager','admin']){
   w.MoradaRoles.select(role);const before=w.eval('JSON.stringify(state)');
   assert.equal(doc.querySelector('.topbar [data-action="mora"]'),null);
   assert.equal(doc.querySelector('.topbar #roleSwitch'),null);assert.equal(doc.querySelector('.topbar .crumb'),null);
   assert.equal(doc.querySelectorAll('#moraFab').length,1);assert.equal(toggle.hasAttribute('data-go'),false);
   toggle.click();assert.equal(menu.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
   assert.equal(doc.activeElement,doc.getElementById('personalSettingsButton'));
   doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(doc.activeElement,doc.getElementById('roleSwitch'));
   doc.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(menu.hidden,true);assert.equal(doc.activeElement,toggle);
   toggle.click();toggle.click();assert.equal(menu.hidden,true);
   toggle.click();doc.getElementById('main').click();assert.equal(menu.hidden,true);
   toggle.click();doc.getElementById('personalSettingsButton').click();assert.equal(menu.hidden,true);
   const dialog=doc.getElementById('dialog');assert.equal(dialog.open,true);assert.match(dialog.textContent,/Profil & Einstellungen/);
   assert.match(dialog.textContent,/Kein persönliches Profil zugeordnet/);
   const tabs=[...dialog.querySelectorAll('[data-ps-tab]')];assert.equal(tabs.length,6);
   for(const tab of tabs){tab.click();assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(dialog.querySelector('#ps-panel').getAttribute('aria-labelledby'),tab.id);assert.equal(dialog.querySelectorAll('[aria-selected="true"]').length,1);}
   dialog.querySelector('[data-ps-tab="appearance"]').click();assert.match(dialog.querySelector('#ps-panel').textContent,/Deutsch \(Schweiz\)/);assert.match(dialog.textContent,/English/);assert.match(dialog.textContent,/Français/);
   dialog.querySelector('[data-ps-tab="access"]').click();assert.match(dialog.querySelector('#ps-panel').textContent,/Keine Immobilien zugeordnet/);assert.doesNotMatch(dialog.querySelector('#ps-panel').textContent,/Alexander|Diana/);
   assert.equal(dialog.querySelectorAll('input,select,textarea').length,0,'no unconnected preference controls');
   assert.equal(w.eval('JSON.stringify(state)'),before);w.eval('portalCloseDialog()');
   toggle.click();doc.getElementById('roleSwitch').click();assert.equal(menu.hidden,true);
   assert.match(dialog.textContent,/Vorschauansicht/);assert.match(dialog.textContent,/keine Zugriffsrechte/);
   assert.equal(dialog.querySelectorAll('[data-role-select]').length,4);
   assert.equal(dialog.querySelector('[aria-pressed="true"]').dataset.roleSelect,role);w.eval('portalCloseDialog()');
  }
 }finally{w.close();}
});
test('search shortcut, notifications, floating MORA and native logout survive the header refinement',async()=>{
 const w=await setup();try{
  const d=w.document;w.MoradaRoles.select('tenant');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(d.activeElement,d.getElementById('searchInput'));
  d.getElementById('searchInput').value='Dokumente';d.getElementById('globalSearch').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(w.location.hash,'#searchPage');
  d.getElementById('bellIcon').click();assert.equal(w.location.hash,'#tenantSupport');
  d.getElementById('moraFab').click();assert.equal(w.MORAPortal.element.hidden,false);w.MORAPortal.close();assert.equal(w.MORAPortal.element.hidden,true);
  assert.equal(d.querySelector('#portalSignout path').getAttribute('d'),'M10 4H4v16h6M10 12h11m-4-4 4 4-4 4');
  d.getElementById('portalSignout').click();assert.equal(d.getElementById('portalPreview').hidden,true);assert.equal(d.getElementById('moradaEntry').hidden,false);
 }finally{w.close();}
});

test('Escape from the mobile profile menu keeps the navigation open and returns focus to its gear',async()=>{
 const w=await setup(true);try{
  const d=w.document,side=d.getElementById('sidebar'),toggle=d.getElementById('profileMenuButton');
  d.getElementById('menuToggle').click();assert.ok(side.classList.contains('open'));
  toggle.click();d.getElementById('personalSettingsButton').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.ok(side.classList.contains('open'));assert.equal(d.getElementById('profileMenu').hidden,true);assert.equal(d.activeElement,toggle);
  toggle.click();d.getElementById('roleSwitch').click();w.eval('portalCloseDialog()');assert.equal(w.eval('lastFocus'),toggle);
 }finally{w.close();}
});


test('personal settings keyboard navigation, mobile back and MORA handoff preserve portal records',async()=>{
 const w=await setup(true);try{
  const d=w.document;w.MoradaRoles.select('tenant');
  const before=w.eval('JSON.stringify(state)'),hash=w.location.hash;
  d.getElementById('menuToggle').click();d.getElementById('profileMenuButton').click();d.getElementById('personalSettingsButton').click();
  const dialog=d.getElementById('dialog'),root=dialog.querySelector('.portal-settings');
  assert.equal(root.dataset.mobileView,'menu');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
  assert.equal(d.activeElement.dataset.psTab,'support');
  d.activeElement.click();assert.equal(root.dataset.mobileView,'content');assert.equal(d.activeElement.id,'ps-section-title');
  assert.equal(dialog.querySelector('a.ps-contact-link').getAttribute('href'),'mailto:info@mymorada.ch');
  dialog.querySelector('[data-ps-action="back"]').click();assert.equal(root.dataset.mobileView,'menu');assert.equal(d.activeElement.dataset.psTab,'support');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));assert.equal(d.activeElement.dataset.psTab,'profile');
  d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));assert.equal(d.activeElement.dataset.psTab,'support');
  d.activeElement.click();dialog.querySelector('[data-ps-action="mora"]').click();
  assert.equal(dialog.open,false);assert.equal(w.MORAPortal.element.hidden,false);assert.equal(d.getElementById('sidebar').classList.contains('open'),false);
  assert.equal(w.eval('JSON.stringify(state)'),before);assert.equal(w.location.hash,hash);
  w.MORAPortal.close();
  d.getElementById('profileMenuButton').click();d.getElementById('personalSettingsButton').click();
  dialog.dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(dialog.open,false);assert.equal(d.activeElement,d.getElementById('profileMenuButton'));
 }finally{w.close();}
});
