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
function fixture(width = 1280) {
  const dom = new JSDOM(html, {url:'https://morada-portal.vercel.app/',pretendToBeVisual:true});
  const { window } = dom; window.indexedDB = new IDBFactory(); window.scrollTo = () => {};
  Object.defineProperty(window,'innerWidth',{value:width,writable:true});
  const style = window.document.createElement('style'); style.textContent = css; window.document.head.appendChild(style);
  const requests = [];
  const fetcher = async (url,options) => {
    requests.push({url,body:JSON.parse(options.body)});
    const res = {statusCode:200,setHeader() {},status(code) {this.statusCode=code;return this;},json(body) {this.body=body;return this;}};
    await handler({method:options.method,body:JSON.parse(options.body)},res);
    return {ok:res.statusCode<400,status:res.statusCode,json:async () => res.body};
  };
  const ui = createMora(window.document,window,fetcher);
  return {dom,window,document:window.document,requests,ui};
}

for (const width of [1280,390]) test(`DOM flow at ${width}px: chat → API → actions → prefilled service draft`, async () => {
  const f = fixture(width); await f.ui.ready;
  await f.ui.submit({message:'lampe geht nicht'},'lampe geht nicht');
  const choice = f.document.querySelector('[data-action-id="answer-location-common"]'); assert.ok(choice); assert.equal(choice.disabled,false);
  await f.ui.onAction({type:'select',id:'answer-location-common',label:'Treppenhaus / Allgemeinbereich'});
  assert.equal(choice.disabled,true);
  await f.ui.submit({message:'seit gestern'},'seit gestern');
  await f.ui.submit({message:'nur diese lampe'},'nur diese lampe');
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
