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
const seed=w=>w.eval(`
 state={...state,appointments:Array.from({length:12},(_,i)=>({id:'calendar-qa-'+i,title:'Kalenderprüfung '+(i+1)+' – '+ 'Langer Titel '.repeat(8),date:'2026-08-31',time:'09:00',owner:i%2?'Diana':'Alexander',status:'Geplant',type:'Besprechung',calendarInfo:{endDate:'2026-08-31',endTime:'10:00'}})),tasks:[{id:'calendar-task',title:'Offene Aufgabe',date:'2026-08-31',owner:'Diana',status:'Offen'}],cases:[{id:'calendar-case',title:'Offenes Anliegen',date:'2026-08-31',owner:'Alexander',status:'Offen'}]};
 calendarSetDate('2026-08-31');go('calendar');
`);

test('dense months retain all records through separate day sections and the full day dialog',async()=>{
 const w=await setup();try{
  seed(w);const d=w.document,before=w.eval('JSON.stringify(state)');
  assert.equal(d.querySelectorAll('.cal-cell').length,42);
  const cell=d.querySelector('.cal-day-number[data-date="2026-08-31"]').parentElement;
  assert.equal(cell.querySelectorAll('.cal-chip').length,2);
  assert.match(cell.querySelector('.cal-more-compact').textContent,/\+12 weitere/);
  assert.match(cell.querySelector('.cal-chip').getAttribute('aria-label'),/Termin/);
  assert.equal(d.querySelector('[data-cal-section="appointment"] h3').textContent.trim(),'Termine (12)');
  assert.equal(d.querySelector('[data-cal-section="task"] h3').textContent.trim(),'Aufgaben (1)');
  assert.equal(d.querySelector('[data-cal-section="due"] h3').textContent.trim(),'Fälligkeiten (1)');
  assert.equal(d.querySelectorAll('#calSelectedDay [data-cal-section="appointment"] .cal-item').length,2);
  d.querySelector('#calSelectedDay .cal-section-more').click();
  assert.equal(d.getElementById('dialog').open,true);
  assert.equal(d.querySelectorAll('#dialog .cal-item').length,14);
  w.eval('portalCloseDialog()');
  for(const [day,count] of [['2027-02-15',28],['2026-10-30',35],['2026-08-31',42]]){
   w.eval(`calendarSetDate('${day}');calendarRefresh()`);assert.equal(d.querySelectorAll('.cal-cell').length,count);
  }
  assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{w.close();}
});

test('date navigation, filters, week/list views and creation actions retain their existing behaviour',async()=>{
 const w=await setup();try{
  seed(w);const d=w.document,before=w.eval('JSON.stringify(state)');
  d.querySelector('.cal-day-nav [data-date="2026-09-01"]').click();
  assert.equal(w.eval('calendarUI.selected'),'2026-09-01');assert.match(d.getElementById('calPeriod').textContent,/September/);
  w.eval("calendarSetDate('2026-08-31');calendarRefresh()");
  const owner=d.getElementById('calOwner');owner.value='Diana';owner.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.eval('calendarDayRows(calendarUI.selected).length'),7);
  d.querySelector('[data-calendar-action="reset"]').click();
  d.querySelector('[data-calendar-action="tomorrow"]').click();
  assert.equal(w.eval('calendarUI.selected'),w.eval('unitAddDays(crmToday(),1)'));
  w.eval("calendarSetDate('2026-08-31');calendarRefresh()");
  for(const view of ['week','list','month']){
   d.querySelector(`[data-calendar-action="view"][data-value="${view}"]`).click();
   assert.equal(w.eval('calendarUI.view'),view);assert.ok(d.querySelector('.cal-day-panel'));
   assert.ok(d.querySelector(view==='week'?'.cal-week':view==='list'?'.cal-agenda':'.cal-month'));
  }
  d.querySelector('.page-head [data-calendar-action="new"]').click();
  assert.equal(d.querySelector('#opsEntryForm [name="date"]').value,'2026-08-31');w.eval('portalCloseDialog()');
  d.querySelector('.page-head [data-calendar-action="new-task"]').click();
  assert.equal(d.getElementById('opsEntryForm').dataset.returnTo,'calendar');w.eval('portalCloseDialog()');
  assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{w.close();}
});

test('day overview and its controls use the shared DE/EN catalogue',async()=>{
 const w=await setup();try{
  seed(w);const d=w.document;
  for(const [lang,title,prev] of [['en','Daily overview','Previous day'],['de','Tagesübersicht','Vorheriger Tag']]){
   w.MoradaI18n.setLanguage(lang);
   assert.equal(d.getElementById('calDayTitle').textContent,title);
   assert.equal(d.querySelector('.cal-day-nav button').getAttribute('aria-label'),prev);
   assert.equal(d.querySelectorAll('.cal-cell').length,42);
  }
 }finally{w.close();}
});

test('appointment colour follows create, edit, copy, views and validation',async()=>{
 const w=await setup(true);try{
  w.eval("state={...state,appointments:[]};calendarSetDate('2026-11-02');go('calendar');calendarOpenForm() ");
  const d=w.document,f=d.getElementById('opsEntryForm');
  assert.equal(d.querySelectorAll('[name=calendarColor]').length,6);
  assert.match(d.querySelector('.cal-color-menu summary').textContent,/Blau – Besprechungen & Kommunikation/);
  assert.match(d.querySelector('.cal-color-option:has([value=green])').textContent,/Vermietung & Besichtigungen/);
  assert.match(d.querySelector('.cal-color-option:has([value=gold])').textContent,/Kündigungsfristen/);
  f.elements.title.value='Wohnungsabnahme';f.elements.title.dispatchEvent(new w.Event('input',{bubbles:true}));
  d.querySelector('.cal-color-menu').open=true;
  d.querySelector('[name=calendarColor][value=purple]').click();
  assert.match(d.querySelector('.cal-color-menu summary').textContent,/Violett – Administration & Finanzen/);
  assert.equal(d.getElementById('calPreviewTitle').textContent,'Wohnungsabnahme');
  assert.equal(d.getElementById('calEventPreview').style.getPropertyValue('--cal-event-color'),'#6f667f');
  f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<100&&w.eval('state.appointments.length===0||portalSaving');i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(w.eval('state.appointments[0].calendarInfo.color'),'purple');
  assert.match(w.localStorage.getItem(w.eval('storageKey')),/"color":"purple"/);
  for(const view of ['month','week','list']){
   w.eval(`calendarUI.view='${view}';calendarRefresh()`);
   const items=d.querySelectorAll('.cal-appointment[style]');assert.ok(items.length);
   for(const item of items)assert.equal(item.style.getPropertyValue('--cal-event-color'),'#6f667f');
  }
  w.eval('calendarOpenForm(state.appointments[0].id)');
  assert.equal(d.querySelector('[name=calendarColor]:checked').value,'purple');
  w.eval('portalMarkDialogClean();portalCloseDialog();calendarOpenForm("","","2026-11-03",state.appointments[0])');
  assert.equal(d.querySelector('[name=calendarColor]:checked').value,'purple');
  assert.throws(()=>w.eval("calendarValidateRecord({...state.appointments[0],calendarInfo:{...state.appointments[0].calendarInfo,color:'red;display:none'}})"),/Terminfarbe/);
  w.eval('portalMarkDialogClean();portalCloseDialog();calendarOpenForm()');
  assert.equal(d.querySelector('[name=calendarColor]:checked').value,'blue');
 }finally{w.close();}
});
