// Native DOM integration tests, with no model responses or paid AI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(narrow=false,clock=null){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://ui.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=query=>({matches:query.includes('any-hover')?!narrow:narrow,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.fetch=()=>{throw Error('No inference in a UI test');};w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=indexedDB;
  if(clock){
   const NativeDate=w.Date,nativeTimeout=w.setTimeout.bind(w);
   w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}};
   w.setTimeout=(fn,delay,...args)=>{if(fn.name==='refreshCurrentDate'){clock.tick=fn;clock.delay=delay;return 0;}return nativeTimeout(fn,delay,...args);};
  }
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
   assert.match(dialog.querySelector('.ps-context').textContent,/Vorschaumodus/);assert.equal(dialog.querySelectorAll('.ps-context').length,1);assert.doesNotMatch(dialog.querySelector('.ps-panel').textContent,/Kein persönliches Profil zugeordnet/);
   const tabs=[...dialog.querySelectorAll('[data-ps-tab]')];assert.equal(tabs.length,6);
   for(const tab of tabs){tab.click();assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(dialog.querySelector('#ps-panel').getAttribute('aria-labelledby'),tab.id);assert.equal(dialog.querySelectorAll('[aria-selected="true"]').length,1);}
   dialog.querySelector('[data-ps-tab="appearance"]').click();assert.match(dialog.querySelector('#ps-panel').textContent,/Deutsch \(Schweiz\)/);assert.match(dialog.textContent,/English/);assert.match(dialog.textContent,/Français/);
   dialog.querySelector('[data-ps-tab="access"]').click();assert.match(dialog.querySelector('#ps-panel').textContent,/Noch keine Immobilien zugeordnet/);assert.doesNotMatch(dialog.querySelector('#ps-panel').textContent,/Alexander|Diana/);
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

test('mouse hover reveals profile actions without stealing focus; click pins and outside click dismisses',async()=>{
 const w=await setup();try{
  const d=w.document,gear=d.getElementById('profileMenuButton'),menu=d.getElementById('profileMenu'),search=d.getElementById('searchInput');
  const pointer=type=>{const e=new w.Event('pointerenter');Object.defineProperty(e,'pointerType',{value:type});gear.dispatchEvent(e);};
  search.focus();search.value='Unsent search';const before=w.eval('JSON.stringify(state)');
  pointer('touch');assert.equal(menu.hidden,true,'touch must not trigger hover');
  pointer('mouse');assert.equal(menu.hidden,false);assert.equal(gear.getAttribute('aria-expanded'),'true');assert.equal(d.activeElement,search);
  gear.click();assert.equal(menu.hidden,false,'click must not close a menu just opened by hover');assert.equal(d.activeElement,d.getElementById('personalSettingsButton'));
  gear.click();assert.equal(menu.hidden,true);
  pointer('mouse');d.querySelector('.account .avatar').click();assert.equal(menu.hidden,true,'clicking elsewhere in the account row dismisses');
  pointer('mouse');d.getElementById('main').click();assert.equal(menu.hidden,true);
  pointer('mouse');gear.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(menu.hidden,true);assert.equal(d.activeElement,gear);
  assert.equal(search.value,'Unsent search');assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{w.close();}
});

test('overview date rolls over at Swiss midnight and catches up after sleep without resetting inputs',async()=>{
 const clock={now:Date.parse('2026-10-30T22:59:59.900Z')},w=await setup(false,clock);try{
  const d=w.document,time=d.querySelector('.today-date time'),search=d.getElementById('searchInput');
  assert.equal(time.dateTime,'2026-10-30');assert.equal(clock.delay,100);
  search.value='Unsaved text';search.focus();const before=w.eval('JSON.stringify(state)');
  clock.now+=100;clock.tick();
  assert.equal(time.dateTime,'2026-10-31');assert.match(time.textContent,/Samstag, 31\. Oktober 2026/);assert.equal(clock.delay,60000);
  assert.equal(d.querySelector('.today-date time'),time);assert.equal(search.value,'Unsaved text');assert.equal(d.activeElement,search);
  // Summer time and the nights on which the UTC offset changes.
  for(const [instant,day] of [['2026-03-28T23:00:00Z','2026-03-29'],['2026-03-29T22:00:00Z','2026-03-30'],['2026-10-24T22:00:00Z','2026-10-25'],['2026-10-25T23:00:00Z','2026-10-26'],['2026-12-31T23:00:00Z','2027-01-01']]){
   clock.now=Date.parse(instant);w.dispatchEvent(new w.Event('focus'));assert.equal(time.dateTime,day);
  }
  for(const lang of ['en','fr','de']){
   w.MoradaI18n.setLanguage(lang);assert.equal(d.querySelector('.today-date time').textContent,new Intl.DateTimeFormat(w.MoradaI18n.locale,{timeZone:'Europe/Zurich',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(clock.now));
  }
  assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{w.close();}
});

test('all roles share the translated My MORADA sidebar title without changing page headings',async()=>{
 const w=await setup();try{
  const d=w.document;
  for(const [lang,title] of [['de','Mein MORADA'],['en','My MORADA'],['fr','Mon MORADA']]){
   w.MoradaI18n.setLanguage(lang);
   for(const role of ['admin','manager','owner','tenant']){
    w.MoradaRoles.select(role);
    assert.equal(d.querySelector('#nav details summary').textContent,title);
    assert.notEqual(d.querySelector('#main h1').textContent,title);
   }
  }
 }finally{w.close();}
});
