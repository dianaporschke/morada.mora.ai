// Synthetic documents and rows only; no network requests or real portal records.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
async function setup(){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!['css-parsing','not-implemented'].includes(e.type))errors.push(e.message);});
 const dom=new JSDOM(readFileSync('portal.html','utf8'),{url:'https://security.example/portal.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.structuredClone=structuredClone;w.indexedDB=indexedDB;w.scrollTo=()=>{};
  w.fetch=()=>{throw Error('Network disabled in security tests');};w.URL.createObjectURL=()=> 'blob:https://security.example/synthetic-pdf';w.URL.revokeObjectURL=()=>{};
  Object.defineProperty(w.navigator,'locks',{value:{request:async(_n,_o,fn)=>typeof _o==='function'?_o({}):fn({})}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 }});
 const w=dom.window;for(let n=0;n<100&&w.eval('portalLoading');n++)await new Promise(r=>setTimeout(r,10));assert.equal(w.eval('portalLoading'),false);assert.deepEqual(errors,[]);
 w.document.querySelector('[data-entry-role=admin]').click();return w;
}

test('lease PDF previews are sandboxed, escape file names and retain the download fallback without modifying records',async()=>{
 const w=await setup();try{
  w.eval(`state.leases=[{id:'synthetic-lease',tenantIds:[],rentHistory:[],attachments:[{id:'synthetic-file',name:'<img src=x onerror=alert(1)>.pdf',type:'application/pdf',size:9,dataUrl:'data:application/pdf;base64,JVBERi0xLjQK'}]}]`);
  const before=w.eval('JSON.stringify(state)');w.eval("leasePreviewFile('synthetic-lease','synthetic-file')");
  const dialog=w.document.getElementById('dialog'),frame=dialog.querySelector('iframe');assert.equal(dialog.open,true);assert.ok(frame);assert.equal(frame.getAttribute('sandbox'),'allow-same-origin');assert.equal(frame.title,'<img src=x onerror=alert(1)>.pdf');assert.equal(dialog.querySelector('img'),null);
  assert.ok(dialog.querySelector('[data-crm-action=download-file][data-file-id=synthetic-file]'));assert.match(dialog.textContent,/herunterladen und lokal öffnen/);assert.equal(w.eval('JSON.stringify(state)'),before);
 }finally{w.close();}
});

test('actual generic CSV exports neutralize spreadsheet formulas after whitespace or BOM and preserve original rows',async()=>{
 const w=await setup();try{
  w.eval(`exportRows=[['Feld','Wert'],['\\t=1+1','\\uFEFF@SUM(1)'],['normal','Text;mit "Zitat"']];main.innerHTML='<div data-record></div><div data-record></div>';window.capturedCSV=null;download=(name,text,mime)=>{window.capturedCSV={name,text,mime};}`);
  const before=w.eval('JSON.stringify(exportRows)');w.eval('exportCSV()');const csv=w.capturedCSV;
  assert.equal(csv.mime,'text/csv;charset=utf-8');assert.ok(csv.text.startsWith('\uFEFF'));assert.match(csv.text,/'\t=1\+1/);assert.match(csv.text,/'\uFEFF@SUM\(1\)/);assert.match(csv.text,/"Text;mit ""Zitat"""/);assert.equal(w.eval('JSON.stringify(exportRows)'),before);
 }finally{w.close();}
});
