// Exercise real portal handlers and storage failures; no model calls or paid APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
async function setup(narrow=false){
 const errors=[],vc=new VirtualConsole(),clock={now:Date.UTC(2026,10,2,10)},timers=new Map();let timerId=1000000;
 vc.on('jsdomError',e=>{if(!['css-parsing','not-implemented'].includes(e.type))errors.push(e.message);});
 const dom=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://ui.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=q=>({matches:q.includes('any-hover')?!narrow:narrow,addEventListener(){},removeEventListener(){}});
  w.structuredClone=structuredClone;w.fetch=()=>{throw Error('No inference in a UI test');};w.scrollTo=()=>{};w.indexedDB=indexedDB;
  w.confirm=()=>{throw Error('Use the portal discard dialog');};
  const NativeDate=w.Date,nativeSet=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
  w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}};
  w.setTimeout=(fn,delay,...args)=>{if([200,3000,4000,6000].includes(delay)){const id=++timerId;timers.set(id,{fn,at:clock.now+delay});return id;}return nativeSet(fn,delay,...args);};
  w.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else nativeClear(id);};
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 const w=dom.window;for(let n=0;n<100&&w.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(w.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 clock.advance=ms=>{const end=clock.now+ms;for(;;){const found=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!found)break;const[id,t]=found;timers.delete(id);clock.now=t.at;t.fn();}clock.now=end;};
 return {w,d:w.document,clock,errors,stored:()=>JSON.parse(w.localStorage.getItem(w.eval('storageKey')))};
}
const submit=(w,f)=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
async function entry(w,title='Termin'){
 const result=await w.eval(`opsSaveRecord('appointment',${JSON.stringify({title,date:'2026-11-02',time:'13:00',endDate:'2026-11-02',endTime:'14:00',owner:'Alexander',type:'Besprechung',calendarColor:'purple',allowOverlap:'yes'})})`);
 assert.ok(result.persisted,JSON.stringify(result));return result.record.id;
}
const open=(w,id)=>w.eval(`opsDetail('appointment','${id}')`);

test('create/edit confirmations follow persisted writes, last 3 seconds and block double submit',async()=>{
 const {w,d,clock,stored,errors}=await setup(true);try{
  w.eval("go('calendar');calendarOpenForm()");const f=d.getElementById('opsEntryForm');
  f.elements.title.value='Neuer Termin';submit(w,f);submit(w,f);await settle();
  assert.equal(stored().appointments.length,1);assert.equal(stored().appointments[0].title,'Neuer Termin');
  assert.equal(d.querySelector('#toast strong').textContent,'Termin erstellt');
  assert.equal(d.querySelector('#toast p').textContent,'Ihre Anpassungen wurden übernommen.');
  assert.equal(d.getElementById('toast').hidden,false);clock.advance(3000);assert.equal(d.getElementById('toast').hidden,true);
  w.eval(`calendarOpenForm('${stored().appointments[0].id}')`);const edit=d.getElementById('opsEntryForm');edit.elements.title.value='Bearbeiteter Termin';submit(w,edit);await settle();
  assert.equal(stored().appointments.length,1);assert.equal(stored().appointments[0].title,'Bearbeiteter Termin');assert.equal(d.querySelector('#toast strong').textContent,'Termin bearbeitet');assert.deepEqual(errors,[]);
 }finally{w.close();}
});

test('discard warning preserves the exact draft, ignores unchanged/reverted forms and resumes navigation',async()=>{
 const {w,d}=await setup();try{
  w.eval("calendarOpenForm()");d.querySelector('#dialog .close').click();assert.equal(d.getElementById('dialog').open,false);assert.equal(d.getElementById('portalDiscardDialog').open,false);
  w.eval("calendarOpenForm()");const f=d.getElementById('opsEntryForm'),field=f.elements.title,original=field.value;
  field.value='Ungespeicherter Entwurf';d.querySelector('#dialog .close').click();
  assert.equal(d.getElementById('portalDiscardDialog').open,true);assert.equal(d.querySelector('[data-discard-keep]').textContent,'Weiter bearbeiten');
  d.querySelector('[data-discard-keep]').click();assert.equal(d.getElementById('dialog').open,true);assert.equal(d.getElementById('opsEntryForm'),f);assert.equal(field.value,'Ungespeicherter Entwurf');
  d.getElementById('dialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(d.getElementById('portalDiscardDialog').open,true);
  d.getElementById('portalDiscardDialog').dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(d.getElementById('dialog').open,true);assert.equal(field.value,'Ungespeicherter Entwurf');
  const unload=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
  field.value=original;d.querySelector('#dialog .close').click();assert.equal(d.getElementById('dialog').open,false);assert.equal(d.getElementById('portalDiscardDialog').open,false);
  w.eval("calendarOpenForm()");d.querySelector('#dialog [name=title]').value='Navigation abbrechen';w.eval("go('tasks')");
  assert.notEqual(w.location.hash,'#tasks');d.querySelector('[data-discard-confirm]').click();assert.equal(w.location.hash,'#tasks');assert.equal(d.getElementById('dialog').open,false);assert.equal(w.eval('state.appointments.length'),0);
 }finally{w.close();}
});

test('browser back and direct hash navigation can be cancelled or resumed after the discard warning',async()=>{
 const {w,d}=await setup();try{
  w.eval("go('tasks');go('calendar');calendarOpenForm()");d.querySelector('#dialog [name=title]').value='Entwurf behalten';
  w.history.back();await settle();assert.equal(d.getElementById('portalDiscardDialog').open,true);assert.equal(w.location.hash,'#calendar');
  d.querySelector('[data-discard-keep]').click();assert.equal(d.querySelector('#dialog [name=title]').value,'Entwurf behalten');assert.equal(w.location.hash,'#calendar');
  w.history.back();await settle();d.querySelector('[data-discard-confirm]').click();await settle();assert.equal(w.location.hash,'#tasks');assert.equal(d.getElementById('dialog').open,false);
  w.eval("calendarOpenForm()");d.querySelector('#dialog [name=title]').value='Hash Entwurf';w.location.hash='calendar';await settle();assert.equal(d.getElementById('portalDiscardDialog').open,true);assert.equal(w.location.hash,'#tasks');
  d.querySelector('[data-discard-confirm]').click();await settle();assert.equal(w.location.hash,'#calendar');assert.equal(d.getElementById('dialog').open,false);
 }finally{w.close();}
});

test('failed storage keeps values and the form open, never confirms success and allows a retry',async()=>{
 const {w,d,stored}=await setup();try{
  const id=await entry(w);await settle();w.eval(`calendarOpenForm('${id}')`);const f=d.getElementById('opsEntryForm');f.elements.title.value='Nach Fehler erhalten';
  const proto=w.localStorage.__proto__,original=proto.setItem;proto.setItem=()=>{throw Error('quota');};
  submit(w,f);await settle();assert.equal(d.getElementById('dialog').open,true);assert.equal(f.elements.title.value,'Nach Fehler erhalten');assert.equal(f.querySelector('[type=submit]').disabled,false);
  assert.equal(stored().appointments[0].title,'Termin');assert.equal(d.querySelector('[data-portal-save-error] strong').textContent,'Speichern fehlgeschlagen');assert.equal(d.getElementById('toast').hidden,false);
  assert.equal(d.querySelectorAll('.portal-feedback[data-kind=success] strong').length,1,'only the earlier confirmed creation remains');
  proto.setItem=original;submit(w,f);await settle();assert.equal(stored().appointments[0].title,'Nach Fehler erhalten');assert.ok([...d.querySelectorAll('.portal-feedback[data-kind=success] strong')].some(n=>n.textContent==='Termin bearbeitet'));
 }finally{w.close();}
});

test('calendar undo restores the exact record and merges other-tab changes without overwriting them',async()=>{
 const {w,d,stored}=await setup();try{
  const id=await entry(w,'Wiederherstellen'),keep=await entry(w,'Behalten');const original=w.eval(`JSON.stringify(state.appointments.find(r=>r.id==='${id}'))`);
  w.eval("go('calendar')");open(w,id);const button=d.querySelector('[data-record-delete]');button.click();button.click();await settle();
  assert.equal(d.querySelector('.record-delete-confirm'),null);assert.equal(stored().appointments.length,1);assert.equal(d.querySelector('.portal-undo strong').textContent,'Termin gelöscht');
  await entry(w,'Zwischenzeitlich erstellt');const external=stored();external.appointments.find(r=>r.id===keep).title='In anderem Tab bearbeitet';w.localStorage.setItem(w.eval('storageKey'),JSON.stringify(external));
  const undo=d.querySelector('[data-portal-undo]');undo.click();undo.click();await settle();
  assert.equal(stored().appointments.length,3);assert.equal(JSON.stringify(stored().appointments.find(r=>r.id===id)),original);assert.equal(stored().appointments.find(r=>r.id===keep).title,'In anderem Tab bearbeitet');
  assert.equal(d.querySelector('[data-portal-undo]'),null);assert.equal(d.querySelector('#toast strong').textContent,'Termin wiederhergestellt');assert.equal(stored().activity.filter(r=>r.title.startsWith('Termin wiederhergestellt:')).length,1);
 }finally{w.close();}
});

test('undo write failures retain a retry, expiry removes the action and existing IDs are protected',async()=>{
 const {w,d,clock,stored}=await setup();try{
  const id=await entry(w);open(w,id);d.querySelector('[data-record-delete]').click();await settle();
  const proto=w.localStorage.__proto__,original=proto.setItem;proto.setItem=()=>{throw Error('quota');};d.querySelector('[data-portal-undo]').click();await settle();
  assert.equal(stored().appointments.length,0);assert.equal(d.querySelector('[data-portal-undo]').disabled,false);assert.equal(d.querySelector('.portal-undo strong').textContent,'Wiederherstellung fehlgeschlagen');
  proto.setItem=original;d.querySelector('[data-portal-undo]').click();await settle();assert.equal(stored().appointments.length,1);
  clock.advance(200);open(w,id);d.querySelector('[data-record-delete]').click();await settle();clock.advance(6200);assert.equal(d.querySelector('[data-portal-undo]'),null);assert.equal(stored().appointments.length,0);
  const second=await entry(w);const record=structuredClone(stored().appointments.find(r=>r.id===second));open(w,second);d.querySelector('[data-record-delete]').click();await settle();const external=stored();external.appointments.push({...record,title:'Neue Fassung mit gleicher Kennung'});w.localStorage.setItem(w.eval('storageKey'),JSON.stringify(external));
  d.querySelector('[data-portal-undo]').click();await settle();assert.equal(stored().appointments.find(r=>r.id===second).title,'Neue Fassung mit gleicher Kennung');assert.match(d.querySelector('.portal-undo p').textContent,/konnte nicht wiederhergestellt/);
 }finally{w.close();}
});

test('language settings confirm real persistence and show a failure for a blocked preference write',async()=>{
 const {w,d}=await setup();try{
  w.MoradaI18n.setLanguage('en');await settle();assert.equal(w.localStorage.getItem('morada.portal.language.v1'),'en');assert.equal(d.querySelector('#toast strong').textContent,'Settings updated');
  w.MoradaI18n.setPersistenceAdapter({load:()=>null,save:()=>{throw Error('blocked');}});w.MoradaI18n.setLanguage('de');await settle();assert.equal(w.localStorage.getItem('morada.portal.language.v1'),'en');assert.equal(d.querySelector('#toast strong').textContent,'Speichern fehlgeschlagen');
 }finally{w.close();}
});
