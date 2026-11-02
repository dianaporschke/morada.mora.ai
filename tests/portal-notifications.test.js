import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup(reduce=false){
 const dom=new JSDOM('<section id="portalPreview"><input id="field" value="Entwurf"><dialog id="dialog"><div class="dialog-body"><form><input name="title" value="Noch nicht gespeichert"><button type="submit">Speichern</button></form></div></dialog><div id="toast" hidden></div></section>',{runScripts:'dangerously',pretendToBeVisual:true});
 const w=dom.window,d=w.document,timers=new Map(),clock={now:Date.UTC(2026,10,2,12)};let next=0;
 const NativeDate=w.Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock.now]));}static now(){return clock.now;}};
 w.matchMedia=()=>({matches:reduce});
 w.setTimeout=(fn,ms=0)=>{const id=++next;timers.set(id,{fn,at:clock.now+ms});return id;};w.clearTimeout=id=>timers.delete(id);
 clock.advance=ms=>{const end=clock.now+ms;let guard=0;for(;;){const found=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!found)break;if(++guard>1000)throw Error('Timer loop');const [id,t]=found;timers.delete(id);clock.now=t.at;t.fn();}clock.now=end;};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(readFileSync('assets/portal-feedback.js','utf8'));
 const ui=w.createPortalFeedback({document:d,window:w,translate:s=>s,busy:()=>false});
 const active=()=>[...d.querySelectorAll('#toast>.portal-feedback[data-notice-state=visible]')];
 return {w,d,ui,clock,active,close:()=>w.close()};
}

test('deduplication, the three-message limit and queue preserve text, focus and typing',()=>{
 const s=setup();try{
  const {ui,d,clock,active}=s,field=d.getElementById('field');field.focus();
  ui.notify('Hinweis A');ui.notify('Hinweis A');ui.notify('Hinweis A');assert.equal(active().length,1);
  ui.notify('Hinweis B');ui.notify('Hinweis C');ui.notice('Gespeichert D','',3000,'success');
  assert.equal(active().length,3);assert.ok(!active().some(n=>n.textContent.includes('Gespeichert D')));
  field.value+=' – weitergeschrieben';clock.advance(4200);
  assert.equal(active().length,1);assert.match(active()[0].textContent,/Gespeichert D/);
  assert.equal(d.activeElement,field);assert.equal(field.value,'Entwurf – weitergeschrieben');
  assert.ok(d.querySelectorAll('#toast>.portal-feedback').length<=3);
  active()[0].querySelector('[data-notice-close]').click();clock.advance(200);assert.equal(active().length,0);
 }finally{s.close();}
});

test('an error takes priority without dropping the displaced passive notice',()=>{
 const s=setup();try{
  const {ui,clock,active,d}=s;
  for(const title of ['Info A','Info B','Info C'])ui.notice(title,'',4000);
  ui.notice('Speichern fehlgeschlagen','Eingaben bleiben erhalten.',3000,'error');
  assert.equal(d.querySelectorAll('#toast>.portal-feedback').length,3);
  clock.advance(200);assert.equal(active().length,3);assert.equal(active()[0].dataset.kind,'error');
  assert.equal(active()[0].getAttribute('role'),'alert');
  active()[0].querySelector('[data-notice-close]').click();clock.advance(200);
  assert.ok(active().some(n=>n.textContent.includes('Info C')));assert.equal(active().length,3);
 }finally{s.close();}
});

test('errors are persistent, dismissible and use SVG icons rather than text symbols',()=>{
 const s=setup();try{
  const {ui,clock,active}=s;
  ui.notice('Speichern fehlgeschlagen','Erneut versuchen.',3000,'error');ui.notice('Speichern fehlgeschlagen','Erneut versuchen.',3000,'error');
  clock.advance(60000);assert.equal(active().length,1);
  assert.equal(active()[0].querySelector('.portal-feedback-symbol').textContent,'');
  assert.ok(active()[0].querySelector('svg path'));assert.equal(active()[0].getAttribute('aria-atomic'),'true');
  active()[0].querySelector('[data-notice-close]').click();clock.advance(200);assert.equal(active().length,0);
 }finally{s.close();}
});

test('undo pauses while hovered or focused, restores once and does not expose exception details',async()=>{
 const s=setup();try{
  const {ui,w,d,clock,active}=s;let restores=0;
  ui.undo({title:'Termin gelöscht',restore:async()=>++restores===1?{error:'secret=private TypeError: internal https://private.example'}:{persisted:true}});
  const host=active()[0];clock.advance(5000);host.dispatchEvent(new w.Event('pointerenter'));clock.advance(30000);assert.ok(d.querySelector('[data-portal-undo]'));
  host.dispatchEvent(new w.Event('pointerleave'));d.querySelector('[data-portal-undo]').focus();clock.advance(30000);assert.ok(d.querySelector('[data-portal-undo]'));
  const undo=d.querySelector('[data-portal-undo]');undo.click();undo.click();await tick();
  assert.equal(restores,1);assert.equal(active()[0].dataset.kind,'error');assert.doesNotMatch(d.getElementById('toast').textContent,/secret=|private\.example|TypeError/);
  clock.advance(60000);assert.ok(d.querySelector('[data-portal-undo]'));
  d.querySelector('[data-portal-undo]').click();await tick();clock.advance(200);assert.equal(restores,2);assert.equal(d.querySelector('[data-portal-undo]'),null);
  assert.ok(active().some(n=>n.textContent.includes('Termin wiederhergestellt')));
 }finally{s.close();}
});

test('queued undo gets six visible seconds, not six seconds from deletion',()=>{
 const s=setup();try{
  const {ui,clock,active,d}=s;
  for(const title of ['Fehler A','Fehler B','Fehler C'])ui.notice(title,'',0,'error');
  ui.undo({title:'Termin gelöscht',restore:async()=>({persisted:true})});clock.advance(60000);
  assert.equal(active().length,3);assert.equal(d.querySelector('[data-portal-undo]'),null);
  active()[0].querySelector('[data-notice-close]').click();clock.advance(200);
  assert.ok(d.querySelector('[data-portal-undo]'));clock.advance(5900);assert.ok(d.querySelector('[data-portal-undo]'));
  clock.advance(100);assert.equal(d.querySelector('[data-portal-undo]'),null);clock.advance(200);assert.equal(active().length,2);
 }finally{s.close();}
});

test('form notices stay inside the dialog without replacing fields; retry is a real submit',async()=>{
 const s=setup();try{
  const {ui,d,clock}=s,dialog=d.getElementById('dialog'),form=dialog.querySelector('form'),input=form.elements.title;let submits=0;
  form.requestSubmit=()=>{submits++;};dialog.showModal();await tick();ui.failed('quota');
  assert.equal(d.getElementById('toast').parentElement,dialog.querySelector('.dialog-body'));assert.equal(form.elements.title,input);assert.equal(input.value,'Noch nicht gespeichert');
  d.querySelector('.portal-feedback-action').click();await tick();assert.equal(submits,1);
  ui.beginSave();clock.advance(200);ui.saved();clock.advance(0);dialog.close();await tick();
  assert.equal(d.getElementById('toast').parentElement,d.getElementById('portalPreview'));assert.equal(input.value,'Noch nicht gespeichert');
 }finally{s.close();}
});

test('network failures are sanitized and ordinary clicks, focus and hash changes are silent',()=>{
 const s=setup();try{
  const {ui,d,w,clock,active}=s;
  d.getElementById('field').focus();d.getElementById('field').click();w.location.hash='calendar';assert.equal(active().length,0);
  ui.notify('Failed to fetch https://internal.example?api_key=private');clock.advance(60000);
  assert.equal(active().length,1);assert.match(active()[0].textContent,/Verbindung unterbrochen/);assert.doesNotMatch(active()[0].textContent,/internal|api_key/);
 }finally{s.close();}
});

test('inline conflict warnings preserve the existing decision checkbox and reduced motion removes immediately',()=>{
 const s=setup(true);try{
  const {ui,d,clock,active}=s,warning=d.createElement('div');warning.innerHTML='<strong>Terminüberschneidung</strong><label><input type="checkbox" checked> Trotzdem speichern</label>';
  const checkbox=warning.querySelector('input');ui.decorateWarning(warning);ui.decorateWarning(warning);assert.equal(warning.querySelectorAll('svg').length,1);assert.equal(warning.querySelector('input'),checkbox);assert.equal(checkbox.checked,true);
  ui.notice('Erfolg','',3000,'success');clock.advance(3000);assert.equal(active().length,0);assert.equal(d.querySelectorAll('#toast>.portal-feedback').length,0);
 }finally{s.close();}
});

test('reset removes queued private notices and old exit timers cannot remove a new-session notice',()=>{
 const s=setup();try{
  const {ui,clock,active,d}=s;
  for(const title of ['Alt A','Alt B','Alt C','Alt D'])ui.notice(title,'',0,'error');
  active()[0].querySelector('[data-notice-close]').click();ui.reset();
  assert.equal(d.getElementById('toast').textContent,'');assert.equal(d.getElementById('toast').hidden,true);
  ui.notice('Neue Sitzung','',3000,'success');clock.advance(200);
  assert.equal(active().length,1);assert.match(active()[0].textContent,/Neue Sitzung/);clock.advance(3000);assert.equal(active().length,0);
 }finally{s.close();}
});
