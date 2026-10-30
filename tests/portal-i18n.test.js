// Native DOM integration tests, with no model responses or paid AI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(narrow=false,language=null){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing'&&e.type!=='not-implemented')errors.push(e);});
 const d=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://ui.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
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
test('all source messages have EN/FR resources with identical interpolation slots',()=>{
 for(const [source,values] of Object.entries(messages))for(const lang of ['en','fr']){assert.ok(values[lang],source+' '+lang);assert.deepEqual(placeholders(values[lang]),placeholders(source),source+' '+lang);}
 const L=createPortalTranslator(messages,'en');
 assert.equal(L.t('Unknown future label'),'Unknown future label');
 assert.match(L.html`<p>Details zu ${'Meine Wohnung'} öffnen</p>`,/Meine Wohnung/);
 const form=L.html`<label>Bezeichnung<input value="${'Meine Wohnung'}"></label><option value="Reparatur">Reparatur</option>`;
 assert.match(form,/value="Meine Wohnung"/);assert.match(form,/value="Reparatur"/);
 assert.equal(L.number(1234.5),new Intl.NumberFormat('en-GB').format(1234.5));
 L.setLanguage('fr');assert.equal(L.date('2026-10-30'),new Intl.DateTimeFormat('fr-CH').format(new Date('2026-10-30')));
 L.setLanguage('invalid');assert.equal(L.language,'de');
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
  const fresh=await setup(false,'fr');try{assert.equal(fresh.MoradaI18n.language,'fr');assert.equal(fresh.document.documentElement.lang,'fr-CH');}finally{fresh.close();}
  L.setLanguage('de');assert.equal(d.documentElement.lang,'de-CH');
 }finally{w.close();}
});
test('all role routes and create dialogs render in EN/FR without missing known UI labels',async()=>{
 const w=await setup();try{
  const d=w.document,before=w.eval('JSON.stringify(state)'),misses=[];
  let routes=0,forms=0;
  for(const lang of ['en','fr']){
   const translated=new Set(Object.values(messages).map(m=>m[lang]));w.MoradaI18n.setLanguage(lang);
   const inspect=(root,where)=>{const walker=d.createTreeWalker(root,w.NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){if(node.parentElement.closest('script,style,textarea,[data-user-content],[translate="no"]'))continue;
     const value=node.nodeValue.trim().replace(/\s+/g,' ');if(messages[value]&&messages[value][lang]!==value&&!translated.has(value))misses.push(where+': '+value);}
   };
   for(const role of ['admin','manager','owner','tenant']){w.MoradaRoles.select(role);
    for(const id of w.eval('roleGroups().flatMap(g=>g[1].map(i=>i[0]))')){w.eval('go('+JSON.stringify(id)+')');routes++;
     for(const root of d.querySelectorAll('#main,#nav,header,.account'))inspect(root,lang+'/'+role+'/'+id);
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
 const w=await setup();try{
  const d=w.document;w.MoradaI18n.setLanguage('en');
  w.eval("openModal('Prüfung', '<form><input name=note value=\"Meine Wohnung\"><textarea name=body>Keine Einträge</textarea></form>')");
  const input=d.querySelector('[name=note]');input.value='Offene Anliegen';w.MoradaI18n.setLanguage('fr');
  assert.equal(input.value,'Offene Anliegen');
  const files=w.eval(`opsDraft={items:[{id:'file',name:'Meine Wohnung',size:100}],savedIds:[]};docDraftFiles()`);
  assert.match(files,/Meine Wohnung/);assert.doesNotMatch(files,/Mon logement/);w.eval('opsDraft=null');assert.equal(d.querySelector('[name=body]').value,'Keine Einträge');
  w.eval('portalMarkDialogClean();portalCloseDialog()');w.MORAPortal.open();
  const textarea=d.getElementById('moraPortalInput');textarea.value='Meine Wohnung';w.MoradaI18n.setLanguage('en');assert.equal(textarea.value,'Meine Wohnung');
  assert.equal(d.querySelector('#moraPortalChat [data-mp=clear]').getAttribute('aria-label'),messages['Neues Gespräch'].en);
 }finally{w.close();}
});
