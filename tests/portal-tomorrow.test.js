// Native DOM integration tests, with no model responses or paid AI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(narrow=false,clock={now:Date.parse('2026-10-31T12:00:00Z')}){
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
const select=(w,value)=>w.document.querySelector(`[data-today-schedule="${value}"]`).click();
const agenda=w=>w.document.getElementById('todayScheduleResults');
const seed=w=>w.eval(`state={...state,appointments:[
 {id:'today-only',title:'Nur heute',date:crmToday(),time:'09:00',owner:'Alexander',type:'Besprechung',status:'Geplant'},
 ...Array.from({length:5},(_,i)=>({id:'tomorrow-'+i,title:'Morgen '+i,date:unitAddDays(crmToday(),1),time:'1'+i+':00',owner:i%2?'Alexander':'Diana',type:'Besprechung',status:'Geplant'})),
 {id:'span',title:'Mehrtägiger Termin',date:crmToday(),time:'',owner:'Diana',type:'Abwesenheit',status:'Geplant',calendarInfo:{allDay:true,endDate:unitAddDays(crmToday(),1),endTime:''}},
 {id:'cancelled',title:'Abgesagt',date:unitAddDays(crmToday(),1),time:'09:00',owner:'Alexander',type:'Besprechung',status:'Abgesagt'},
 {id:'done',title:'Durchgeführt',date:unitAddDays(crmToday(),1),time:'09:00',owner:'Alexander',type:'Besprechung',status:'Durchgeführt'}
]};go('today')`);

test('today/tomorrow shows the correct appointments without changing data, today metrics or pending filters',async()=>{
 const w=await setup();try{
  seed(w);const d=w.document,before=w.eval('JSON.stringify(state)'),metrics=d.querySelector('.today-stats').textContent;
  d.querySelector('[data-today-scope="mine"]').click();const pending=d.getElementById('todayAttentionResults');
  assert.equal(d.querySelector('[data-today-schedule="today"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual([...agenda(w).querySelectorAll('[data-id]')].map(b=>b.dataset.id),['span','today-only']);
  d.querySelector('[data-today-schedule="tomorrow"]').focus();select(w,'tomorrow');
  assert.equal(d.getElementById('todayScheduleTitle').textContent,'Morgen');
  assert.equal(d.getElementById('todayScheduleCard').dataset.day,'2026-11-01');
  assert.equal(d.activeElement.dataset.todaySchedule,'tomorrow');
  assert.deepEqual([...agenda(w).querySelectorAll('[data-id]')].map(b=>b.dataset.id),['span','tomorrow-0','tomorrow-1','tomorrow-2']);
  assert.match(d.querySelector('.today-list-note').textContent,/4 von 6/);
  assert.equal(d.getElementById('todayAttentionResults'),pending);assert.equal(d.querySelector('.today-stats').textContent,metrics);
  assert.equal(w.eval('JSON.stringify(state)'),before);
  select(w,'today');assert.match(agenda(w).textContent,/Nur heute/);assert.doesNotMatch(agenda(w).textContent,/Morgen 0/);
  select(w,'tomorrow');d.querySelector('[data-today-schedule-action="calendar"]').click();
  assert.equal(w.eval('current'),'calendar');assert.equal(w.eval('calendarUI.selected'),'2026-11-01');
 }finally{w.close();}
});

test('empty-state creation preselects the selected day, and controls use DE/EN translations',async()=>{
 const w=await setup(true);try{
  const d=w.document;w.eval("go('today')");
  for(const [lang,tomorrow,empty] of [['de','Morgen','Keine Termine morgen'],['en','Tomorrow','No appointments tomorrow']]){
   w.MoradaI18n.setLanguage(lang);select(w,'tomorrow');
   assert.equal(d.getElementById('todayScheduleTitle').textContent,tomorrow);
   assert.equal(d.querySelector('[data-today-schedule="tomorrow"]').textContent,tomorrow);
   assert.match(agenda(w).textContent,new RegExp(empty));
   assert.equal(d.querySelectorAll('#todayScheduleCard [aria-pressed="true"]').length,1);
   d.querySelector('[data-today-schedule-action="new"]').click();
   assert.equal(d.querySelector('#opsEntryForm [name="date"]').value,'2026-11-01');
   assert.equal(d.querySelector('#opsEntryForm [name="endDate"]').value,'2026-11-01');w.eval('portalCloseDialog()');
  }
  select(w,'today');d.querySelector('[data-today-schedule-action="new"]').click();assert.equal(d.querySelector('#opsEntryForm [name="date"]').value,'2026-10-31');
 }finally{w.close();}
});

test('relative days follow Zurich midnight across month/year changes and the DST weekend',async()=>{
 for(const [instant,oldTomorrow,newTomorrow] of [['2026-10-31T22:59:00Z','2026-11-01','2026-11-02'],['2026-12-31T22:59:00Z','2027-01-01','2027-01-02'],['2026-03-28T22:59:00Z','2026-03-29','2026-03-30']]){
  const clock={now:Date.parse(instant)},w=await setup(false,clock);try{
   w.eval("go('today')");select(w,'tomorrow');const d=w.document;
   assert.equal(d.getElementById('todayScheduleCard').dataset.day,oldTomorrow);
   clock.now+=60000;clock.tick();
   assert.equal(d.getElementById('todayScheduleCard').dataset.day,newTomorrow);
   assert.equal(d.querySelector('.today-date time').dateTime,oldTomorrow);
   assert.equal(d.querySelector('[data-today-schedule="tomorrow"]').getAttribute('aria-pressed'),'true');
   clock.now+=2*86400000;w.dispatchEvent(new w.Event('focus'));
   assert.equal(d.getElementById('todayScheduleCard').dataset.day,w.eval('unitAddDays(crmToday(),1)'));
  }finally{w.close();}
 }
});
