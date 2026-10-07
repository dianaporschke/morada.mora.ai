import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import { createMora, renderActions } from '../assets/mora-client.js';
import { createChatHandler } from '../api/chat.js';
import { guidedUnderstanding } from '../lib/mora/understanding.js';

const html = readFileSync('index.html','utf8');
const css = readFileSync('assets/mora.css','utf8');
const handler = createChatHandler(async (message,state) => ({data:guidedUnderstanding(message,state),mode:'guided'}));
function fixture(width = 1280, options = {}) {
  const dom = new JSDOM(html, {url:'https://morada-portal.vercel.app/',pretendToBeVisual:true});
  const { window } = dom; window.indexedDB = options.indexedDB || new IDBFactory(); window.scrollTo = () => {};
  if (options.thread) window.sessionStorage.setItem('morada.mora.v2.thread', options.thread);
  Object.defineProperty(window,'innerWidth',{value:width,writable:true});
  const style = window.document.createElement('style'); style.textContent = css; window.document.head.appendChild(style);
  const requests = [];
  const fetcher = async (url,options) => {
    requests.push({url,body:JSON.parse(options.body)});
    if (url === '/api/requests' && simulatedReceipt) return { ok:true, status:200, json:async () => simulatedReceipt };
    const res = {statusCode:200,setHeader() {},status(code) {this.statusCode=code;return this;},json(body) {this.body=body;return this;}};
    await handler({method:options.method,body:JSON.parse(options.body)},res);
    if (simulatedReceipt && res.body.capabilities) res.body.capabilities = { ...res.body.capabilities, submitRequest:true };
    return {ok:res.statusCode<400,status:res.statusCode,json:async () => res.body};
  };
  const simulatedReceipt = options.simulatedReceipt;
  const ui = createMora(window.document,window,fetcher);
  return {dom,window,document:window.document,requests,ui};
}

async function waitForIdle(f) {
  for (let i = 0; i < 100; i++) {
    await new Promise(resolve => setImmediate(resolve));
    if (!f.document.getElementById('moraSend').disabled) return;
  }
  assert.fail('Chat did not finish processing the form submission');
}
async function sendForm(f, message) {
  f.document.getElementById('moraText').value = message;
  f.document.getElementById('moraForm').dispatchEvent(new f.window.Event('submit', { bubbles:true, cancelable:true }));
  await waitForIdle(f);
}

for (const width of [1280,390]) test(`DOM flow at ${width}px: chat → API → actions → prefilled service draft`, async () => {
  const f = fixture(width); await f.ui.ready;
  await sendForm(f, 'lampe geht nicht');
  const choice = f.document.querySelector('[data-action-id="answer-location-common"]'); assert.ok(choice); assert.equal(choice.disabled,false);
  choice.click(); await waitForIdle(f);
  assert.equal(choice.disabled,true);
  await sendForm(f, 'seit gestern');
  await sendForm(f, 'nur diese lampe');
  assert.equal(f.ui.getState().issue.category,'electricity');
  const handover = f.document.querySelector('.mora-actions:last-child [data-action-id="prepare-request"]');
  assert.ok(handover.classList.contains('primary'));
  await f.ui.onAction({type:'handover'});
  assert.equal(f.document.getElementById('service').checked,true); assert.equal(f.document.getElementById('mora').checked,false);
  assert.equal(f.document.getElementById('moraDraftDescription').value,'lampe geht nicht');
  assert.equal(f.document.getElementById('moraDraftLocation').value,'Treppenhaus / Allgemeinbereich');
  assert.match(f.document.getElementById('moraDraftSince').value,/gestern/);
  assert.match(f.document.getElementById('moraDraftStatus').textContent,/Noch nicht übermittelt/);
  assert.equal(f.requests.some(req => req.url==='/api/requests'),false);
  assert.equal(f.ui.getDrafts().length,1); f.window.close();
});

test('Typing follow-up answers through the real form retains both context and attached photos', async () => {
  const f = fixture(390); await f.ui.ready;
  await sendForm(f, 'heizung funktioniert nicht');
  await f.ui.addFiles([new f.window.File(['photo'], 'Heizung.png', { type:'image/png' })]);
  const issueId = f.ui.getState().issue.id;
  await sendForm(f, 'seit gestern');
  await sendForm(f, 'alle heizkörper');
  await sendForm(f, 'in meiner Wohnung');
  const issue = f.ui.getState().issue;
  assert.equal(issue.id, issueId);
  assert.equal(issue.since, 'seit gestern');
  assert.equal(issue.extent, 'Alle Heizkörper');
  assert.equal(issue.attachments[0].name, 'Heizung.png');
  assert.ok(f.requests.slice(-3).every(request => request.body.attachments.length === 1));
  await f.ui.onAction({ type:'handover' });
  assert.match(f.document.getElementById('moraDraftSummary').textContent, /seit gestern/);
  assert.match(f.document.getElementById('moraDraftPhotos').textContent, /Heizung.png/);
  f.window.close();
});

test('Photos are attached, persisted in IndexedDB and survive a draft reload', async () => {
  const f = fixture(390); await f.ui.ready; await f.ui.submit({message:'lampe geht nicht'},'lampe geht nicht');
  await f.ui.addFiles([new f.window.File(['photo'], 'Lampe.png', {type:'image/png'})]);
  assert.equal(f.ui.getState().issue.attachments.length,1);
  assert.match(f.document.getElementById('moraAttachments').textContent,/Lampe.png/);
  await f.ui.onAction({type:'handover'});
  assert.equal(f.ui.getDrafts()[0].attachments[0].name,'Lampe.png');
  const other = fixture(); other.window.indexedDB = f.window.indexedDB;
  const reloaded = createMora(other.document,other.window,async () => {throw new Error('No network expected');});
  await reloaded.ready;
  assert.match(other.document.getElementById('moraDraftPhotos').textContent,/Lampe.png/);
  f.window.close(); other.window.close();
});

test('Repeated taps do not create concurrent chat requests', async () => {
  const f = fixture(); await f.ui.ready;
  let calls=0; let resolve;
  const ui = createMora(f.document,f.window,() => {calls++;return new Promise(done => {resolve=done;});}); await ui.ready;
  const first = ui.submit({message:'lampe geht nicht'},'lampe geht nicht');
  await ui.submit({message:'second'},'second'); assert.equal(calls,1);
  resolve({ok:false,json:async () => ({error:'Temporary'})}); await first;
  assert.equal(f.document.getElementById('moraSend').disabled,false); f.window.close();
});

test('Actions and customer texts render as text, arbitrary navigation / phone targets are rejected', async () => {
  const f=fixture(); await f.ui.ready;
  const group = renderActions(f.document,[{id:'x',type:'select',label:'<img src=x onerror=alert(1)>'}],() => {});
  assert.equal(group.querySelector('img'),null); assert.match(group.textContent,/<img/);
  await f.ui.onAction({type:'navigate',target:'https://attacker.invalid'});
  assert.equal(f.document.getElementById('home').checked,true);
  await f.ui.onAction({type:'call',number:'0900999999'}); assert.equal(f.window.location.protocol,'https:'); f.window.close();
});

test('Offline and expired session errors preserve the issue and offer recovery', async () => {
  const f=fixture(); await f.ui.ready; await f.ui.submit({message:'heizung funktioniert nicht'},'heizung funktioniert nicht');
  const token = f.ui.getState().session;
  const restored = createMora(f.document,f.window,async () => {throw new Error('offline');}); await restored.ready;
  await restored.submit({message:'seit gestern'},'seit gestern');
  assert.equal(restored.getState().session,token); assert.equal(restored.getState().issue.category,'heating');
  assert.ok(f.document.querySelector('[data-action-id="retry"]'));
  assert.ok(f.document.querySelector('[data-action-id="prepare-request"]')); f.window.close();
});

test('Portal navigation and iPhone icon paths are preserved; chat has responsive touch targets', () => {
  const f=fixture(390);
  for (const tab of ['home','portfolio','service','docs','profile']) assert.ok(f.document.getElementById(tab));
  assert.equal(f.document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'),'/icons/morada-app-icon-v3-180.png');
  assert.ok(f.document.querySelector('meta[name="apple-mobile-web-app-capable"]'));
  assert.match(css,/@media \(max-width:600px\)/); assert.match(css,/min-height:46px/);
  assert.match(css,/flex:1; min-height:0/); f.window.close();
});

test('An answer without actions disables all previous choices and keeps them disabled after reload', async () => {
  const f = fixture(); await f.ui.ready;
  await sendForm(f, 'Steckdose geht nicht');
  const oldChoices = [...f.document.querySelectorAll('#moraMessages .mora-action')];
  assert.ok(oldChoices.length > 0);
  await sendForm(f, 'Was bedeutet Mietkaution?');
  assert.match(f.document.getElementById('moraMessages').textContent, /Sicherheit|Sicherheitsleistung/);
  assert.equal(f.document.querySelectorAll('#moraMessages .mora-action:not(:disabled)').length, 0);
  assert.ok(oldChoices.every(button => button.disabled));
  const restored = fixture(390, { thread:f.window.sessionStorage.getItem('morada.mora.v2.thread') }); await restored.ui.ready;
  assert.equal(restored.document.querySelectorAll('#moraMessages .mora-action:not(:disabled)').length, 0);
  assert.equal(restored.document.getElementById('moraPrepareIssue').disabled, false);
  f.window.close(); restored.window.close();
});

test('The issue picker switches through the server and keeps photos and draft data with their own issue', async () => {
  const f = fixture(390); await f.ui.ready;
  await sendForm(f, 'Heizung kaputt');
  await f.ui.addFiles([new f.window.File(['heater'], 'Heizung.png', { type:'image/png' })]);
  const heatingId = f.ui.getState().issue.id;
  await sendForm(f, 'Ausserdem geht die Waschmaschine im Keller nicht');
  const applianceId = f.ui.getState().issue.id;
  assert.notEqual(applianceId, heatingId);
  assert.equal(f.ui.getState().issues.length, 2);
  assert.equal(f.ui.getState().files.length, 0);
  await f.ui.addFiles([new f.window.File(['washer'], 'Waschmaschine.png', { type:'image/png' })]);
  assert.equal(f.document.getElementById('moraIssuePickerLabel').hidden, false);
  const picker = f.document.getElementById('moraIssuePicker'); picker.value = heatingId;
  picker.dispatchEvent(new f.window.Event('change')); await waitForIdle(f);
  assert.equal(f.requests.at(-1).body.actionId, `switch-${heatingId}`);
  assert.equal(f.ui.getState().issue.id, heatingId);
  assert.deepEqual(f.ui.getState().files.map(file => file.name), ['Heizung.png']);
  assert.equal(f.ui.getState().issues.find(issue => issue.id === applianceId).attachments[0].name, 'Waschmaschine.png');
  await f.ui.onAction({ type:'handover' });
  const drafts = f.ui.getDrafts();
  assert.equal(drafts.length, 2);
  assert.deepEqual(drafts.find(draft => draft.id === heatingId).attachments.map(file => file.name), ['Heizung.png']);
  assert.deepEqual(drafts.find(draft => draft.id === applianceId).attachments.map(file => file.name), ['Waschmaschine.png']);
  f.window.close();
});

test('Draft edits rebuild the summary and survive handover autosave, conflict and reload', async () => {
  const f = fixture(); await f.ui.ready;
  await sendForm(f, 'Seit gestern funktionieren drei Steckdosen im Wohnzimmer nicht');
  await f.ui.onAction({ type:'handover' });
  const edit = (id, value) => { const control = f.document.getElementById(id); control.value = value; control.dispatchEvent(new f.window.Event('input')); };
  edit('moraDraftCount', '2');
  assert.doesNotMatch(f.document.getElementById('moraDraftSummary').textContent, /3 Steckdosen|drei Steckdosen/);
  edit('moraDraftExtent', 'Zwei Steckdosen an der Fensterseite');
  edit('moraDraftLocation', 'Büro'); edit('moraDraftDescription', 'Steckdosen an der Fensterseite ohne Strom');
  const summary = f.document.getElementById('moraDraftSummary').textContent;
  assert.match(summary, /Anzahl: 2/); assert.match(summary, /Bereich: Büro/); assert.match(summary, /Fensterseite/);
  assert.doesNotMatch(summary, /Anzahl: 3|drei Steckdosen/);
  f.document.getElementById('moraSaveDraft').click();
  for (let i=0; i<20 && !/lokal gespeichert/.test(f.document.getElementById('moraDraftStatus').textContent); i++) await new Promise(resolve => setImmediate(resolve));
  await sendForm(f, 'Nein, vier Steckdosen');
  await f.ui.onAction({ type:'handover' });
  assert.equal(f.document.getElementById('moraDraftCount').value, '2');
  assert.equal(f.document.getElementById('moraDraftLocation').value, 'Büro');
  assert.equal(f.document.getElementById('moraDraftConflict').hidden, false);
  assert.match(f.document.getElementById('moraDraftConflict').textContent, /Anzahl/);
  const restored = fixture(390, { indexedDB:f.window.indexedDB }); await restored.ui.ready;
  assert.equal(restored.document.getElementById('moraDraftCount').value, '2');
  assert.match(restored.document.getElementById('moraDraftSummary').textContent, /Anzahl: 2/);
  assert.equal(restored.document.getElementById('moraDraftLocation').value, 'Büro');
  f.window.close(); restored.window.close();
});

test('Persistent preparation controls are hidden before any issue and available for free-text questions', async () => {
  const f = fixture(390); await f.ui.ready;
  assert.equal(f.document.getElementById('moraIssueControls').hidden, true);
  await sendForm(f, 'Heizung kaputt');
  assert.equal(f.document.getElementById('moraIssueControls').hidden, false);
  assert.equal(f.document.querySelectorAll('#moraMessages .mora-action:not(:disabled)').length, 0);
  assert.equal(f.document.getElementById('moraPrepareIssue').textContent, 'Für MORADA vorbereiten');
  f.document.getElementById('moraPrepareIssue').click(); await waitForIdle(f);
  assert.equal(f.document.getElementById('service').checked, true);
  assert.match(f.document.getElementById('moraDraftStatus').textContent, /Noch nicht übermittelt/);
  f.window.close();
});

test('Persistent tools avoid duplicate actions, return on plain replies and hide photos during emergencies', async () => {
  const f = fixture(390); await f.ui.ready;
  await sendForm(f, 'Seit gestern funktionieren drei Steckdosen im Wohnzimmer nicht');
  assert.ok(f.document.querySelector('#moraMessages [data-action-type="handover"]:not(:disabled)'));
  assert.equal(f.document.getElementById('moraPrepareIssue').hidden, true);
  assert.equal(f.document.getElementById('moraAttachPhoto').hidden, false);
  await sendForm(f, 'Was bedeutet Mietkaution?');
  assert.equal(f.document.getElementById('moraPrepareIssue').hidden, false);
  assert.equal(f.document.getElementById('moraAttachPhoto').hidden, false);
  await sendForm(f, 'Aus der Steckdose kommen Funken und es riecht verbrannt');
  assert.equal(f.ui.getState().issue.urgency, 'emergency');
  assert.equal(f.document.getElementById('moraAttachPhoto').hidden, true);
  assert.equal(f.document.getElementById('moraPrepareIssue').hidden, true);
  assert.equal(f.document.querySelector('#moraMessages [data-action-type="attachment"]:not(:disabled)'), null);
  f.window.close();
  const water = fixture(); await water.ui.ready;
  await sendForm(water, 'Ich habe einen Rohrbruch');
  assert.ok(water.document.querySelector('#moraMessages [data-action-type="attachment"]:not(:disabled)'));
  assert.equal(water.document.getElementById('moraAttachPhoto').hidden, true);
  assert.equal(water.document.getElementById('moraPrepareIssue').hidden, true);
  water.window.close();
});

test('A mocked future submission receipt is displayed consistently and restored with its confirmation', async () => {
  const f = fixture(1280, { simulatedReceipt:{ accepted:true, requestId:'TEST-RECEIPT-42' } }); await f.ui.ready;
  await sendForm(f, 'Heizung kaputt'); await f.ui.onAction({ type:'handover' });
  assert.equal(f.document.getElementById('moraDraftHeading').textContent, 'An MORADA übermittelt.');
  assert.match(f.document.getElementById('moraDraftStatus').textContent, /Übermittlung bestätigt.*TEST-RECEIPT-42/);
  assert.doesNotMatch(f.document.getElementById('moraDraftStatus').textContent, /Noch nicht übermittelt/);
  assert.match(f.document.getElementById('moraDraftNotice').textContent, /Fotos bleiben lokal/);
  const restored = fixture(390, { indexedDB:f.window.indexedDB }); await restored.ui.ready;
  assert.match(restored.document.getElementById('moraDraftStatus').textContent, /Übermittlung bestätigt.*TEST-RECEIPT-42/);
  const location = restored.document.getElementById('moraDraftLocation'); location.value = 'Küche'; location.dispatchEvent(new restored.window.Event('input'));
  restored.document.getElementById('moraSaveDraft').click();
  for (let i=0; i<20 && !/Lokal gespeichert/.test(restored.document.getElementById('moraDraftStatus').textContent); i++) await new Promise(resolve => setImmediate(resolve));
  assert.match(restored.document.getElementById('moraDraftStatus').textContent, /Nachträgliche lokale Änderungen wurden noch nicht übermittelt/);
  f.window.close(); restored.window.close();
});
