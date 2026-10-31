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

const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));};
async function entry(w,kind,title=kind){
 const result=await w.eval(`opsSaveRecord(${JSON.stringify(kind)},${JSON.stringify({title,date:'2026-10-31',time:'09:00',endDate:'2026-10-31',endTime:'10:00',description:'Testeintrag',nextStep:'Prüfen',owner:'Alexander',type:'Besprechung',allowOverlap:'yes'})})`);
 assert.ok(result.persisted,JSON.stringify(result));return result.record.id;
}
const open=(w,kind,id)=>w.eval(`opsDetail(${JSON.stringify(kind)},${JSON.stringify(id)})`);
test('calendar, tasks and cases delete only after confirmation, persist and leave other records intact',async()=>{
 const w=await setup();try{
  for(const [kind,key] of [['appointment','appointments'],['task','tasks'],['case','cases']]){
   const keep=await entry(w,kind,'Behalten'),id=await entry(w,kind,'Löschen');w.eval("go('calendar')");open(w,kind,id);
   const d=w.document;d.querySelector('[data-record-delete]').click();
   assert.equal(w.eval(`state.${key}.length`),2);d.querySelector('[data-delete-cancel]').click();
   assert.equal(d.querySelector('.record-delete-confirm'),null);assert.equal(w.eval(`state.${key}.length`),2);
   d.querySelector('[data-record-delete]').click();d.querySelector('[data-delete-confirm]').click();d.querySelector('[data-delete-confirm]').click();await settle();
   assert.equal(w.eval(`state.${key}.length`),1);assert.equal(w.eval(`state.${key}[0].id`),keep);
   const stored=JSON.parse(w.localStorage.getItem(w.eval('storageKey')));assert.equal(stored[key].length,1);assert.equal(stored[key][0].id,keep);
   assert.equal(d.getElementById('dialog').open,false);assert.ok(!w.eval('calendarRows()').some(r=>r.id===id));
  }
 }finally{w.close();}
});

test('cancel preserves an edited form and unsaved text; new forms have no delete action',async()=>{
 const w=await setup();try{
  w.eval("newEntry('appointment')");assert.equal(w.document.querySelector('[data-record-delete]'),null);
  const id=await entry(w,'appointment');w.eval(`calendarOpenForm('${id}')`);
  const title=w.document.querySelector('[name="title"]');title.value='Noch nicht gespeichert';
  w.document.querySelector('[data-record-delete]').click();w.document.querySelector('[data-delete-cancel]').click();
  assert.equal(title.value,'Noch nicht gespeichert');assert.equal(w.eval('state.appointments[0].title'),'appointment');
  assert.equal(w.eval('opsDraft.id'),id);assert.equal(w.document.activeElement.dataset.recordDelete,'appointments');
 }finally{w.close();}
});
test('failed storage keeps the record and allows a retry; a stale tab cannot delete newer data',async()=>{
 const w=await setup();try{
  const id=await entry(w,'task');open(w,'task',id);w.document.querySelector('[data-record-delete]').click();
  const proto=w.localStorage.__proto__,original=proto.setItem;
  proto.setItem=()=>{throw Error('quota');};w.document.querySelector('[data-delete-confirm]').click();await settle();
  assert.equal(w.eval('state.tasks.length'),1);assert.equal(w.document.querySelector('[data-delete-confirm]').disabled,false);
  assert.equal(w.document.querySelector('[data-delete-error]').hidden,false);
  proto.setItem=original;w.document.querySelector('[data-delete-confirm]').click();await settle();assert.equal(w.eval('state.tasks.length'),0);
  const second=await entry(w,'task');open(w,'task',second);w.document.querySelector('[data-record-delete]').click();
  const newer=w.eval('JSON.stringify({...state,activity:[]})');w.localStorage.setItem(w.eval('storageKey'),newer);
  w.document.querySelector('[data-delete-confirm]').click();await settle();
  assert.equal(w.eval('state.tasks.length'),1);assert.equal(w.localStorage.getItem(w.eval('storageKey')),newer);
  assert.match(w.document.querySelector('[data-delete-error]').textContent,/anderer Tab/);
 }finally{w.close();}
});
test('changed state, missing records and customer roles cannot delete records',async()=>{
 const w=await setup();try{
  const id=await entry(w,'case');open(w,'case',id);await entry(w,'task');w.document.querySelector('[data-record-delete]').click();
  assert.equal(w.document.querySelector('[data-delete-confirm]').disabled,true);assert.equal(w.eval('state.cases.length'),1);
  assert.ok((await w.eval("portalDeleteRecord('cases','missing','',state)")).error);
  w.eval('portalCloseDialog()');w.MoradaRoles.select('tenant');
  assert.ok((await w.eval(`portalDeleteRecord('cases','${id}','',state)`)).error);assert.equal(w.eval('state.cases.length'),1);
  assert.equal(w.eval(`portalDeleteButton('cases','${id}')`),'');
 }finally{w.close();}
});
test('linked records block deletion until their association is explicitly removed',async()=>{
 const w=await setup();try{
  const id=await entry(w,'case','Anliegen mit Aufgabe');
  const result=await w.eval(`opsSaveRecord('task',{title:'Verknüpfte Aufgabe',date:'2026-10-31',sourceRef:'case|${id}'})`);assert.ok(result.persisted,JSON.stringify(result));
  open(w,'case',id);w.document.querySelector('[data-record-delete]').click();
  assert.equal(w.document.querySelector('[data-delete-confirm]').disabled,true);
  assert.match(w.document.querySelector('[data-delete-error]').textContent,/Verknüpfte Aufgabe/);
  const before=w.eval('JSON.stringify(state)');assert.ok((await w.eval(`portalDeleteRecord('cases','${id}','',state)`)).error);assert.equal(w.eval('JSON.stringify(state)'),before);
  assert.ok((await w.eval(`portalDeleteRecord('tasks','${result.record.id}','',state)`)).persisted);
  assert.ok((await w.eval(`portalDeleteRecord('cases','${id}','',state)`)).persisted);
 }finally{w.close();}
});
test('property, unit and contact edit forms expose deletion and protect their references',async()=>{
 const w=await setup();try{
  w.eval('portfolioOpenPropertyForm()');const d=w.document,f=d.getElementById('portfolioPropertyForm');
  for(const [k,v] of Object.entries({street:'Teststrasse 12',postalCode:'8000',city:'Zürich'}))f.elements[k].value=v;
  const prop=await w.eval("portfolioSaveForm(document.getElementById('portfolioPropertyForm'))");assert.ok(prop.persisted,JSON.stringify(prop));w.eval('portalMarkDialogClean();portalCloseDialog()');
  w.eval(`portfolioOpenPropertyForm('${prop.record.id}')`);assert.equal(d.querySelector('[data-record-delete]').dataset.recordDelete,'properties');w.eval('portalCloseDialog()');
  w.eval(`portfolioOpenUnitForm('','${prop.record.id}')`);d.getElementById('portfolioUnitForm').elements.name.value='Testwohnung';
  const unit=await w.eval("portfolioSaveForm(document.getElementById('portfolioUnitForm'))");assert.ok(unit.persisted,JSON.stringify(unit));w.eval('portalMarkDialogClean();portalCloseDialog()');
  assert.ok((await w.eval(`portalDeleteRecord('properties','${prop.record.id}','',state)`)).error);
  w.eval(`portfolioOpenUnitForm('${unit.record.id}')`);d.querySelector('[data-record-delete]').click();d.querySelector('[data-delete-confirm]').click();await settle();assert.equal(w.eval('state.units.length'),0);
  const contact=await w.eval("crmStoreContact({name:'Löschtest Kontakt',kind:'person',role_owner:'on'})");assert.ok(contact.persisted,JSON.stringify(contact));
  w.eval(`crmOpenContactForm('${contact.record.id}')`);assert.equal(d.querySelector('[data-record-delete]').dataset.recordDelete,'contacts');
  d.querySelector('[data-record-delete]').click();d.querySelector('[data-delete-confirm]').click();await settle();assert.equal(w.eval('state.contacts.length'),0);
  assert.ok((await w.eval(`portalDeleteRecord('properties','${prop.record.id}','',state)`)).persisted);assert.equal(w.eval('state.properties.length'),0);
 }finally{w.close();}
});
test('financial and finalised records retain their existing cancellation/archive workflow',async()=>{
 const w=await setup();try{
  const cases=[['mandates',{stage:'confirmed'}],['leases',{stage:'confirmed'}],['serviceContracts',{stage:'confirmed'}],['inspections',{status:'finalized'}],['mandateInvoices',{processing:'approved'}],['mandateInvoices',{processing:'captured',payments:[{id:'payment'}]}],['costBudgets',{activeVersionId:'live',versions:[{status:'draft'}]}],['costBudgets',{versions:[{status:'external'}]}]];
  for(const [key,record] of cases){w.eval(`state={...cleanState(),${key}:[${JSON.stringify({id:'protected',...record})}]}`);assert.ok(w.eval(`portalDeletePlan('${key}','protected','').error`),key);}
  for(const [key,record] of [['mandateInvoices',{processing:'captured',payments:[]}],['costBudgets',{versions:[{status:'draft'}]}]]){w.eval(`state={...cleanState(),${key}:[${JSON.stringify({id:'draft',...record})}]}`);assert.equal(w.eval(`portalDeletePlan('${key}','draft','').error`),undefined);}
 }finally{w.close();}
});
test('DE and EN delete controls have translated confirmation and safely render record titles',async()=>{
 const w=await setup();try{
  const id=await entry(w,'appointment','<img src=x onerror=alert(1)>');
  for(const lang of ['de','en']){
   w.MoradaI18n.setLanguage(lang);open(w,'appointment',id);
   const b=w.document.querySelector('[data-record-delete]');assert.equal(b.textContent.trim(),lang==='de'?'Löschen':'Delete');b.click();
   const panel=w.document.querySelector('.record-delete-confirm');assert.equal(panel.querySelector('img'),null);
   assert.equal(panel.querySelector('h3').textContent,lang==='de'?'Eintrag löschen?':'Delete entry?');
   assert.equal(panel.querySelector('[data-delete-cancel]').textContent,lang==='de'?'Abbrechen':'Cancel');w.eval('portalCloseDialog()');
  }
 }finally{w.close();}
});

test('nested deadlines and technical assets delete only the selected item; inspection removes its generated calendar event',async()=>{
 const w=await setup();try{
  w.eval(`state={...cleanState(),properties:[{id:'p',technicalAssets:[{id:'a',name:'Anlage'},{id:'b',name:'Behalten'}]}],mandates:[{id:'m',deadlines:[{id:'d',title:'Frist'},{id:'e',title:'Behalten'}]}]}`);
  assert.deepEqual(JSON.parse(w.eval("JSON.stringify(portalDeletePlan('technicalAssets','a','p').changes.properties[0].technicalAssets)")),[{id:'b',name:'Behalten'}]);
  assert.deepEqual(JSON.parse(w.eval("JSON.stringify(portalDeletePlan('deadlines','d','m').changes.mandates[0].deadlines)")),[{id:'e',title:'Behalten'}]);
  w.eval(`state={...cleanState(),inspections:[{id:'inspection',status:'draft',appointmentId:'generated'}],appointments:[{id:'generated',inspectionId:'inspection'},{id:'ordinary'}]}`);
  const plan=JSON.parse(w.eval("JSON.stringify(portalDeletePlan('inspections','inspection',''))"));assert.equal(plan.error,undefined);assert.equal(plan.changes.inspections.length,0);assert.deepEqual(plan.changes.appointments,[{id:'ordinary'}]);
  w.eval("state={...state,tasks:[{id:'task',title:'Folgeaufgabe',inspectionId:'inspection'}]}");assert.match(w.eval("portalDeletePlan('inspections','inspection','').error"),/Folgeaufgabe/);
 }finally{w.close();}
});
