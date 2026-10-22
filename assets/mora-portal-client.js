import {detectHazard,safetyNotice} from './mora-safety.js';
import {portalNavigation} from './mora-portal-map.js';
/** No provider credentials, model calls or portal business rules in this UI. */
export function createPortalClient(document,window,bridge,{fetcher=window.fetch?.bind(window)}={}) {
  const greeting='Guten Tag! Ich bin MORA, Ihre digitale Assistenz bei MORADA. Wie kann ich Ihnen heute helfen?';
  const names=Object.fromEntries(Object.entries(portalNavigation).map(([id,v])=>[id,v.label]));
  const panel=document.createElement('section');panel.id='moraPortalChat';panel.className='mora-portal-chat';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','moraPortalTitle');
  panel.innerHTML='<header><div><h2 id="moraPortalTitle">MORA</h2><small>Ihre digitale Assistenz bei MORADA</small></div><button type="button" data-mp="clear" aria-label="Neues Gespräch">↻</button><button type="button" data-mp="close" aria-label="MORA schliessen">×</button></header><div class="mora-portal-log" role="log" aria-live="polite" aria-relevant="additions text"></div><div class="mora-portal-status" role="status"></div><div class="mora-portal-actions"></div><form class="mora-portal-compose"><label class="sr-only" for="moraPortalInput">Nachricht an MORA</label><textarea id="moraPortalInput" rows="2" maxlength="2000" placeholder="Schreiben Sie MORA …" required></textarea><button class="btn primary" type="submit" aria-label="Nachricht senden">Senden</button></form><p class="mora-portal-note">Anliegen bleiben auf diesem Gerät. Kein Versand an MORADA. Ihre Chatnachrichten werden zur KI-Verarbeitung an das geschützte Backend übergeben.</p>';
  document.getElementById('portalPreview').append(panel);
  const log=panel.querySelector('[role="log"]'),status=panel.querySelector('[role="status"]'),actions=panel.querySelector('.mora-portal-actions'),form=panel.querySelector('form'),input=panel.querySelector('textarea');
  let thread,activeRole,busy=false,lastFocus,storageWarning='';
  const blank=()=>({session:null,messages:[{role:'assistant',content:greeting}],data:null,saved:{},pendingReceipt:null});
  const key=()=> 'morada.portal.mora.v1.'+activeRole;
  function persist(){try{window.sessionStorage.setItem(key(),JSON.stringify(thread));}catch{storageWarning='Der Chatverlauf kann in diesem Browser nicht behalten werden. Gespeicherte Portaleinträge bleiben davon unabhängig.';}}
  function load(){activeRole=bridge.role();thread=blank();try{const t=JSON.parse(window.sessionStorage.getItem(key())||'null');if(t&&Array.isArray(t.messages)&&t.messages.every(m=>['user','assistant','error','receipt'].includes(m.role)&&typeof m.content==='string')&&t.saved&&typeof t.saved==='object'){thread={...blank(),...t};}}catch{storageWarning='Der frühere Chat konnte nicht geladen werden.';}}
  function bubble(role,content){const p=document.createElement('p');p.className='mora-portal-message '+role;p.textContent=content;log.append(p);}
  function message(role,content){thread.messages.push({role,content});thread.messages=thread.messages.slice(-80);bubble(role,content);log.scrollTop=log.scrollHeight;persist();}
  function button(label,run){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.disabled=busy;b.addEventListener('click',()=>{if(!busy)run();});actions.append(b);}
  function showControls(){
    actions.replaceChildren();
    if(thread.pendingReceipt){button('Speicherbestätigung erneut abgleichen',()=>syncReceipt());return;}
    const data=thread.data;if(!data)return;
    if(data.controls?.save&&bridge.available().includes('cases'))button(data.controls.save.operation==='update'?'Gespeichertes Anliegen aktualisieren':'Anliegen lokal speichern',()=>saveIssue());
    if(data.controls?.stored)button('Gespeichertes Anliegen öffnen',()=>navigate(()=>bridge.view(data.controls.stored.id)));
    for(const target of data.controls?.navigation || [])if(bridge.available().includes(target)&&names[target])button(names[target],()=>navigate(()=>bridge.navigate(target)));
  }
  function setBusy(value,label=''){busy=value;form.querySelector('button').disabled=value;input.disabled=value;panel.querySelector('[data-mp="clear"]').disabled=value;panel.setAttribute('aria-busy',String(value));status.textContent=label||storageWarning;showControls();}
  function close(){panel.hidden=true;document.getElementById('moraFab')?.setAttribute('aria-expanded','false');lastFocus?.focus?.();}
  function navigate(fn){try{const ok=fn();if(ok!==false)close();}catch(e){status.textContent=e.message;}}
  async function request(payload){
    if(window.location.protocol==='file:')throw Error('Bitte öffnen Sie die bereitgestellte HTTPS-Testversion. Die lokale HTML-Datei enthält absichtlich keinen KI-Schlüssel.');
    if(!fetcher)throw Error('Die Backend-Verbindung ist in diesem Browser nicht verfügbar.');
    const start=window.performance.now(),startedRole=activeRole;
    const response=await fetcher('/api/portal-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(thread.session?{session:thread.session}:{}),...payload,navigation:bridge.available()}),signal:window.AbortSignal.timeout(55000)});
    const headers=window.performance.now();let data;
    try{data=await response.json();}catch{throw Error('Das geschützte Backend konnte nicht erreicht werden. Bitte laden Sie die Testversion neu.');}
    const parsed=window.performance.now();
    if(startedRole!==bridge.role()||!bridge.open())throw Error('Die Portalansicht wurde gewechselt. Öffnen Sie MORA erneut.');
    if(data.session)thread.session=data.session;
    if(!response.ok){thread.data=null;persist();throw Error(data.error||'Die Backend-Verbindung ist gerade nicht verfügbar.');}
    if(data.architecture!=='portal_v1')throw Error('Unerwartete Backend-Antwort.');
    thread.data=data;persist();
    // Timings contain no customer text, tokens or credentials. DOM insertion is
    // measured separately from request duration; it is not a provider TTFT.
    window.console.info('MORA portal timing',{httpMs:parsed-start,responseHeadersMs:headers-start,jsonMs:parsed-headers,backend:data.timingMs});
    return data;
  }
  async function send(text){
    if(busy||!text.trim())return;
    if(thread.pendingReceipt){status.textContent='Bitte zuerst die noch offene Speicherbestätigung abgleichen.';return;}
    // A failed attempt must never leave an old action enabled.
    thread.data=null;message('user',text.trim());
    const hazard=detectHazard(text.trim());if(hazard.hazard!=='none')message('error','Sicherheitshinweis: '+safetyNotice(hazard.hazard));
    input.value='';setBusy(true,'MORA antwortet …');
    const start=window.performance.now();
    try{const data=await request({message:text.trim(),messageId:window.crypto.randomUUID()});if(data.reply)message('assistant',data.reply);window.console.info('MORA portal visible response',{answerDomMs:window.performance.now()-start});}
    catch(e){message('error',e.message);}
    finally{setBusy(false);if(!panel.hidden)input.focus();}
  }
  async function acknowledge(){
    const pending=thread.pendingReceipt;if(!pending)return;
    const data=await request({receipt:pending.receipt});
    if(!data.receiptAccepted)throw Error('Der Portalstand ist gespeichert, die Gesprächsbestätigung ist noch offen.');
    thread.saved[pending.receipt.issueId]=pending.fields;thread.pendingReceipt=null;persist();
  }
  async function syncReceipt(){if(busy)return;setBusy(true,'Speicherbestätigung wird abgeglichen …');try{await acknowledge();status.textContent='Der lokale Speicherstand ist bestätigt.';}catch(e){message('error',e.message);}finally{setBusy(false);}}
  async function saveIssue(){
    if(busy)return;setBusy(true,'Anliegen wird im Portal gespeichert …');
    let ticket,written=false;
    try{
      ticket=await request({action:'save-issue'});
      const proof=await bridge.save(ticket.operation,ticket.fields,thread.saved[ticket.operation.issueId],ticket.sourceEvidence);written=true;
      thread.pendingReceipt={receipt:{...Object.fromEntries(['operationId','issueId','draftId','revision','contentHash'].map(k=>[k,ticket.operation[k]])),status:'portal_received'},fields:proof.fields};persist();
      message('receipt',proof.unchanged?'Das Anliegen ist bereits in diesem Portal auf diesem Gerät gespeichert.':proof.updated?'Das Anliegen wurde in diesem Portal auf diesem Gerät aktualisiert.':'Das Anliegen wurde in diesem Portal auf diesem Gerät gespeichert.');
      await acknowledge();
    }catch(e){
      if(ticket&&!written){try{await request({receipt:{...Object.fromEntries(['operationId','issueId','draftId','revision','contentHash'].map(k=>[k,ticket.operation[k]])),status:'error'}});}catch{thread.data=null;}}
      message('error',written?'Das Anliegen ist lokal gespeichert. Der Abgleich mit dem Chat ist noch offen. Nutzen Sie «Speicherbestätigung erneut abgleichen».':e.message);
    }finally{setBusy(false);}
  }
  function open(){
    if(!bridge.open())return;
    if(activeRole!==bridge.role()){load();log.replaceChildren();thread.messages.forEach(m=>bubble(m.role,m.content));}
    lastFocus=document.activeElement;panel.hidden=false;document.getElementById('moraFab')?.setAttribute('aria-expanded','true');showControls();input.focus();log.scrollTop=log.scrollHeight;
  }
  form.addEventListener('submit',e=>{e.preventDefault();send(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(input.value);}});
  panel.querySelector('[data-mp="close"]').addEventListener('click',close);
  panel.querySelector('[data-mp="clear"]').addEventListener('click',()=>{if(busy)return;thread=blank();persist();log.replaceChildren();bubble('assistant',greeting);setBusy(false);input.focus();});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  new window.MutationObserver(()=>{if(!bridge.open())panel.hidden=true;}).observe(document.getElementById('portalPreview'),{attributes:true,attributeFilter:['hidden']});
  return {open,close,send,getState:()=>structuredClone(thread),element:panel};
}
