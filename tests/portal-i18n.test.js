// Native DOM integration tests, with no model responses or paid AI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(narrow=false,language=null,thread=null){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://ui.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  if(thread)w.sessionStorage.setItem('morada.portal.mora.agent.v1.admin',JSON.stringify(thread));
  if(language)w.localStorage.setItem('morada.portal.language.v1',language);w.matchMedia=()=>({matches:narrow,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.fetch=()=>{throw Error('No inference in a UI test');};w.scrollTo=()=>{};w.confirm=()=>true;w.indexedDB=indexedDB;
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 for(let n=0;n<100&&d.window.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(d.window.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 const w=d.window;w.document.getElementById('entry-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));return w;
}

import {createPortalTranslator} from '../assets/portal-i18n-core.js';
const messages=JSON.parse(readFileSync('assets/i18n/messages.json','utf8'));
const placeholders=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
test('all DE/EN/FR messages preserve interpolation slots and Swiss spelling',()=>{
 for(const [source,values] of Object.entries(messages))for(const lang of ['de','en','fr']){const value=values[lang]??(lang==='de'?source:null);assert.ok(value,source+' '+lang);assert.deepEqual(placeholders(value),placeholders(source),source+' '+lang);if(lang==='de')assert.ok(!value.includes('ß'),source);}
 const L=createPortalTranslator(messages,'en');
 assert.equal(L.t('Unknown future label'),'Unknown future label');
 assert.match(L.html`<p>Details zu ${'Meine Wohnung'} öffnen</p>`,/Meine Wohnung/);
 const form=L.html`<label>Bezeichnung<input value="${'Meine Wohnung'}"></label><option value="Reparatur">Reparatur</option>`;
 assert.match(form,/value="Meine Wohnung"/);assert.match(form,/value="Reparatur"/);
 assert.equal(L.number(1234.5),new Intl.NumberFormat('en-GB').format(1234.5));
 L.setLanguage('fr');assert.equal(L.date('2026-10-30'),new Intl.DateTimeFormat('fr-CH').format(new Date('2026-10-30')));
 L.setLanguage('invalid');assert.equal(L.language,'de');
 assert.equal(L.t('Mein Mietverhältnis'),'Mein Mietvertrag');
 assert.equal(L.t('Speicherbestätigung erneut abgleichen'),'Speicherung erneut prüfen');
 assert.equal(L.html`<option>Mein Mietverhältnis</option>`, '<option value="Mein Mietverhältnis">Mein Mietvertrag</option>');
});
test('populated charts, count summaries and rent-roll filters localise without changing original values',async()=>{
 const w=await setup();try{
  w.eval(`state.companyEntries=[{id:'income',kind:'income',category:companyServices[0][0],date:companyPeriod().to,amountCents:125000,paidCents:125000,party:'Meine Wohnung',description:'Keine Einträge'},{id:'expense',kind:'expense',category:companyCosts[0][0],date:companyPeriod().to,amountCents:25000,paidCents:0,party:'',description:'Offene Anliegen'}];crmUI.rentrollQuery='Meine Wohnung';crmUI.rentrollRooms='3.5';crmUI.rentrollType='Wohnung';crmUI.rentrollFloor='Keine Einträge';crmUI.rentrollSource='manual'`);
  const original=w.eval('JSON.stringify(state)');
  for(const lang of ['en','fr','de']){
   w.MoradaI18n.setLanguage(lang);
   const labels=Array.from(w.eval('rentrollFilterLabels()'));
   assert.ok(labels.some(v=>v.includes('Meine Wohnung')));
   assert.ok(labels.some(v=>v.includes('Keine Einträge')));
   assert.ok(labels.includes(messages['Wohnung'][lang]??'Wohnung'));
   const result=w.eval('portfolioResultText([])');
   assert.ok(result.includes(lang==='en'?'Properties in portfolio':lang==='fr'?'Immeubles du parc':'Liegenschaften im Bestand'));
   const host=w.document.createElement('div');host.innerHTML=w.eval('companyCharts()+companyTimeline(companyPeriod(),companyRecords())');
   for(const key of ['Umsatz','Aufwand','Betriebsergebnis'])assert.ok(host.textContent.includes(messages[key][lang]??key),lang+' '+key);
   if(lang!=='de')assert.doesNotMatch(host.textContent,/Betriebsergebnis|Personalaufwand|Weitere Kunden|Noch keine Einträge/);
   const vacancy=w.eval("rentrollVacancyText({status:'vacant',rentroll:{vacancy:{since:'2026-10-01',days:1},vacancyRecord:{},period:false}})");
   assert.ok(vacancy.includes(lang==='en'?'Vacant':lang==='fr'?'Vacant':'Leerstand'));
   assert.equal(w.eval('JSON.stringify(state)'),original);
  }
 }finally{w.close();}
});
test('header and settings synchronize; preferences survive roles, reopening and a fresh page',async()=>{
 const w=await setup();try{
  const d=w.document,L=w.MoradaI18n,before=w.eval('JSON.stringify(state)');
  assert.equal(L.language,'de');
  d.getElementById('portalLanguageButton').click();assert.equal(d.getElementById('portalLanguageMenu').hidden,false);
  d.querySelector('[data-language="en"]').click();assert.equal(d.documentElement.lang,'en-GB');
  d.getElementById('profileMenuButton').click();d.getElementById('personalSettingsButton').click();
  d.querySelector('[data-ps-tab="appearance"]').click();d.querySelector('[data-ps-language="fr"]').click();
  assert.equal(d.querySelector('[data-language="fr"]').getAttribute('aria-checked'),'true');
  assert.equal(d.querySelector('[data-ps-language="fr"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('[data-ps-tab="profile"]').textContent,messages['Mein Profil'].fr);
  assert.equal(d.querySelectorAll('.ps-context').length,1);assert.doesNotMatch(d.querySelector('#ps-panel').textContent,/MORADA Design|Phase 2/);
  w.eval('portalCloseDialog()');d.getElementById('profileMenuButton').click();d.getElementById('personalSettingsButton').click();
  assert.equal(d.getElementById('dialogTitle').textContent,messages['Profil & Einstellungen'].fr);
  w.eval('portalCloseDialog()');for(const role of ['owner','tenant']){w.MoradaRoles.select(role);assert.equal(L.language,'fr');}
  assert.equal(w.localStorage.getItem('morada.portal.language.v1'),'fr');assert.equal(w.eval('JSON.stringify(state)'),before);
  for(const lang of ['en','fr']){
   L.setLanguage(lang);d.getElementById('profileMenuButton').click();d.getElementById('roleSwitch').click();
   const choices=d.getElementById('dialog').textContent;
   assert.doesNotMatch(choices,/Geschäftsleitung|Bewirtschaftung/);
   assert.ok(choices.includes('Alexander'));assert.ok(choices.includes('Diana'));
   assert.equal(d.querySelector('[data-role-select=tenant] strong').textContent,messages['Mieterrolle'][lang]);
   w.eval('portalCloseDialog()');
   const fresh=await setup(false,lang);try{
    assert.equal(fresh.MoradaI18n.language,lang);
    assert.equal(fresh.document.documentElement.lang,lang==='fr'?'fr-CH':'en-GB');
    assert.equal(fresh.document.querySelectorAll('.entry-role[data-entry-role]').length,4);
    assert.equal(fresh.document.querySelector('#entry-heading').textContent,messages['Willkommen.'][lang]);
    assert.equal(fresh.document.querySelector('.entry-intro').textContent,messages['Wählen Sie Ihren Bereich, um fortzufahren.'][lang]);
    assert.doesNotMatch(fresh.document.querySelector('#entry-note').textContent,/Ohne Anmeldung|Einträge werden|Eigentümer-/);
    assert.equal(fresh.document.querySelector('.entry-art').getAttribute('data-tagline'),messages['PERSÖNLICH NAH. ALLES VERBUNDEN.'][lang]);
   }finally{fresh.close();}
  }
  L.setLanguage('de');assert.equal(d.documentElement.lang,'de-CH');
 }finally{w.close();}
});
test('all role routes and create dialogs render in DE/EN/FR without missing known UI labels',async()=>{
 const w=await setup();try{
  const d=w.document,before=w.eval('JSON.stringify(state)'),misses=[];
  let routes=0,forms=0;
  for(const lang of ['de','en','fr']){
   const translated=new Set(Object.entries(messages).map(([k,m])=>m[lang]??k));w.MoradaI18n.setLanguage(lang);
   const inspect=(root,where)=>{const walker=d.createTreeWalker(root,w.NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){if(node.parentElement.closest('script,style,textarea,[data-user-content],[translate="no"]'))continue;
     const value=node.nodeValue.trim().replace(/\s+/g,' ');if(messages[value]&&messages[value][lang]!==value&&!translated.has(value))misses.push(where+': '+value);}
   };
   for(const role of ['admin','manager','owner','tenant']){w.MoradaRoles.select(role);
    for(const id of w.eval('roleGroups().flatMap(g=>g[1].map(i=>i[0]))')){w.eval('go('+JSON.stringify(id)+')');routes++;
     for(const root of d.querySelectorAll('#main,#nav,header,.account'))inspect(root,lang+'/'+role+'/'+id);
     if(lang!=='de')for(const node of d.querySelectorAll('.portal-history-bar [aria-label]'))assert.doesNotMatch(node.getAttribute('aria-label'),/Übersicht|Mein Portfolio|Meine Wohnung|Bewirtschaftung/);
     const actions=[...d.querySelectorAll('#main button')].filter(b=>b.hasAttribute('data-new')||[...b.attributes].some(a=>a.name.endsWith('-action')&&['new','create','new-account','new-box','new-entry','new-property','new-unit','new-contact','new-mandate','new-lease','upload','plan-new'].includes(a.value)));
     for(const b of actions){b.click();const dialog=d.getElementById('dialog');if(!dialog.open)continue;forms++;inspect(dialog,lang+'/'+role+'/'+id+' dialog');w.eval('portalCloseDialog()');}
    }
   }
  }
  console.log('Portal language coverage:',JSON.stringify({routes,forms}));assert.ok(routes>100);assert.ok(forms>50);assert.deepEqual([...new Set(misses)],[]);
  assert.equal(w.eval('JSON.stringify(state)'),before,'navigation and translation never mutate records');
 }finally{w.close();}
});
test('language changes preserve original user text, field values and MORA transcript',async()=>{
 const thread={session:null,saved:{},pendingReceipt:null,messages:[{role:'user',content:'Meine Wohnung'},{role:'assistant',content:'Keine Einträge'}],data:{issues:[{id:'known',equipment:'light',location:'Meine Wohnung'},{id:'custom',equipment:'Meine Wohnung',location:'Keine Einträge'}],controls:{navigation:[]}}};
 const w=await setup(false,null,thread);try{
  const d=w.document;w.MoradaI18n.setLanguage('en');
  w.eval("openModal('Prüfung', '<form><input name=note value=\"Meine Wohnung\"><textarea name=body>Keine Einträge</textarea></form>')");
  const input=d.querySelector('[name=note]');input.value='Offene Anliegen';w.MoradaI18n.setLanguage('fr');
  assert.equal(input.value,'Offene Anliegen');
  const files=w.eval(`opsDraft={items:[{id:'file',name:'Meine Wohnung',size:100}],savedIds:[]};docDraftFiles()`);
  assert.match(files,/Meine Wohnung/);assert.doesNotMatch(files,/Mon logement/);w.eval('opsDraft=null');assert.equal(d.querySelector('[name=body]').value,'Keine Einträge');
  w.eval('portalMarkDialogClean();portalCloseDialog()');w.MORAPortal.open();
  const textarea=d.getElementById('moraPortalInput');textarea.value='Meine Wohnung';w.MoradaI18n.setLanguage('en');assert.equal(textarea.value,'Meine Wohnung');
  assert.equal(d.querySelector('#moraPortalChat [data-mp=clear]').getAttribute('aria-label'),messages['Neues Gespräch'].en);
  const header=d.querySelector('#moraPortalChat header');
  for(const lang of ['en','fr','de']){
   w.MoradaI18n.setLanguage(lang);w.dispatchEvent(new w.Event('resize'));
   assert.deepEqual(Array.from(d.querySelectorAll('.mora-portal-log p'),p=>p.textContent),['Meine Wohnung','Keine Einträge']);
   const options=Array.from(d.querySelectorAll('.mora-portal-actions select option'),o=>o.textContent);
   assert.deepEqual(options,[(messages['Lampe / Leuchte'][lang]??'Lampe / Leuchte')+' · Meine Wohnung','Meine Wohnung · Keine Einträge']);
   assert.equal(w.sessionStorage.getItem('morada.portal.mora.agent.v1.admin'),JSON.stringify(thread));
   const source='MORA-Fenster verschieben. Pfeiltasten zum Verschieben, Pos1 für die Ausgangsgrösse.';
   assert.equal(header.getAttribute('aria-label'),messages[source][lang]??source);
  }
 }finally{w.close();}
});


test('entry cards open each existing workspace directly in every language without changing records',async()=>{
 const w=await setup();try{
  const d=w.document,before=w.eval('JSON.stringify(state)');
  for(const lang of ['de','en','fr']){
   w.MoradaI18n.setLanguage(lang);
   for(const role of ['admin','manager','owner','tenant']){
    d.getElementById('portalSignout').click();
    assert.equal(d.getElementById('moradaEntry').hidden,false);
    assert.equal(d.getElementById('entry-heading').textContent,messages['Willkommen.'][lang]);
    assert.ok(d.getElementById('entry-note').textContent.includes(messages['Lokale Arbeitsversion · Auf diesem Gerät gespeichert.'][lang]));
    const button=d.querySelector(`[data-entry-role="${role}"]`);
    assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'submit');
    button.click();
    assert.equal(d.getElementById('moradaEntry').hidden,true);
    assert.equal(d.getElementById('portalPreview').hidden,false);
    assert.equal(w.eval('role'),role);
    assert.equal(w.MoradaI18n.language,lang);
    assert.equal(w.eval('JSON.stringify(state)'),before);
   }
  }
 }finally{w.close();}
});
