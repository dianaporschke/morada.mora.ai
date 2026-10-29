import {detectHazard,safetyNotice} from './mora-safety.js';
import {draftLabel} from './mora-data.js';
import {portalNavigation} from './mora-portal-map.js';
import {enablePortalWindow} from './mora-portal-window.js';
/** No provider credentials, model calls or portal business rules in this UI. */
export function createPortalClient(document,window,bridge,{fetcher=window.fetch?.bind(window)}={}) {
  const agent=new URL(window.location.href).searchParams.get('mora')!=='legacy';
  const architecture=agent?'portal_agent_v1':'portal_v1',endpoint=agent?'/api/portal-agent':'/api/portal-chat';
  const greeting='Guten Tag! Ich bin MORA, Ihre digitale Assistenz bei MORADA. Wie kann ich Ihnen heute helfen?';
  const names=Object.fromEntries(Object.entries(portalNavigation).map(([id,v])=>[id,v.label]));
  // The four-point mark follows the existing MORA star in index.html.
  const star='<span class="mora-portal-star" aria-hidden="true"></span>';
  const icons={restart:'M20 7v5h-5 M19.2 12a7.2 7.2 0 1 1-2.1-5.1L20 10',close:'m6 6 12 12M18 6 6 18',send:'M12 19V5m-7 7 7-7 7 7',prepare:'m14 6 4-3 3 3-3 4-4-4ZM14 6 4 16v4h4l10-10',photo:'M4 7h4l2-3h4l2 3h4v13H4ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',review:'M5 4h14v16H5ZM9 9h6M9 13h6M9 17h3',arrow:'M5 12h14m-6-6 6 6-6 6'};
  const uiIcon=name=>'<svg class="mora-portal-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+icons[name]+'"/></svg>';
  const panel=document.createElement('section');panel.id='moraPortalChat';panel.className='mora-portal-chat';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','moraPortalTitle');
  panel.innerHTML='<header><span class="mora-portal-emblem">'+star+'</span><div class="mora-portal-heading"><h2 id="moraPortalTitle">MORA</h2><small>Ihre digitale Assistenz bei MORADA</small></div><button type="button" data-mp="clear" aria-label="Neues Gespräch" title="Neues Gespräch">'+uiIcon('restart')+'</button><button type="button" data-mp="close" aria-label="MORA schliessen" title="MORA schliessen">'+uiIcon('close')+'</button></header><div class="mora-portal-scroll" tabindex="0" aria-label="Gesprächsverlauf"><div class="mora-portal-log" role="log" aria-live="polite" aria-relevant="additions text"></div><div class="mora-portal-status" role="status"></div><div class="mora-portal-actions"></div></div><form class="mora-portal-compose"><label class="mora-portal-sr" for="moraPortalInput">Nachricht an MORA</label><textarea id="moraPortalInput" rows="1" maxlength="2000" placeholder="Schreiben Sie MORA …" required></textarea><button class="btn primary" type="submit" aria-label="Nachricht senden" title="Nachricht senden">'+uiIcon('send')+'</button></form><p class="mora-portal-note">Anliegen bleiben auf diesem Gerät. Kein Versand an MORADA. Ihre Chatnachrichten werden zur KI-Verarbeitung an das geschützte Backend übergeben.</p>';
  document.getElementById('portalPreview').append(panel);
  const log=panel.querySelector('[role="log"]'),scroller=panel.querySelector('.mora-portal-scroll'),status=panel.querySelector('[role="status"]'),actions=panel.querySelector('.mora-portal-actions'),form=panel.querySelector('form'),input=panel.querySelector('textarea');
  const launcher=document.getElementById('moraFab');
  if(launcher){launcher.innerHTML=star+'<span>MORA Assistenz</span>';launcher.setAttribute('aria-label','MORA öffnen');}
  let thread,activeRole,busy=false,lastFocus,storageWarning='',followEnd=true,readingOffset=0,accessEpoch=0;
  const scrollEnd=()=>{if(!panel.hidden&&followEnd)scroller.scrollTop=scroller.scrollHeight;};
  scroller.addEventListener('scroll',()=>{if(panel.hidden)return;readingOffset=scroller.scrollTop;followEnd=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<48;});
  function sizeInput(){
    input.style.height='auto';const css=window.getComputedStyle(input);
    const limit=parseFloat(css.maxHeight)||128,border=(parseFloat(css.borderTopWidth)||0)+(parseFloat(css.borderBottomWidth)||0),needed=input.scrollHeight+border;
    const height=Math.max(parseFloat(css.minHeight)||48,Math.min(needed,limit));
    input.style.height=height+'px';input.style.overflowY=needed>limit?'auto':'hidden';scrollEnd();
  }
  function fitViewport(){const viewport=window.visualViewport;panel.style.setProperty('--mp-viewport-height',(viewport?.height||window.innerHeight)+'px');panel.style.setProperty('--mp-viewport-top',(viewport?.offsetTop||0)+'px');scrollEnd();}
  window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);
  input.addEventListener('input',sizeInput);fitViewport();
  const windowLayout=enablePortalWindow(panel,window,sizeInput);
  const blank=()=>({session:null,messages:[{role:'assistant',content:greeting}],data:null,saved:{},pendingReceipt:null});
  const key=()=> (agent?'morada.portal.mora.agent.v1.':'morada.portal.mora.v1.')+activeRole;
  function persist(){try{window.sessionStorage.setItem(key(),JSON.stringify(thread));}catch{storageWarning='Der Chatverlauf kann in diesem Browser nicht behalten werden. Gespeicherte Portaleinträge bleiben davon unabhängig.';}}
  function load(){activeRole=bridge.role();thread=blank();try{const t=JSON.parse(window.sessionStorage.getItem(key())||'null');if(t&&Array.isArray(t.messages)&&t.messages.every(m=>['user','assistant','error','receipt'].includes(m.role)&&typeof m.content==='string')&&t.saved&&typeof t.saved==='object'){thread={...blank(),...t};}}catch{storageWarning='Der frühere Chat konnte nicht geladen werden.';}}
  function bubble(role,content){const p=document.createElement('p');p.className='mora-portal-message '+role;p.textContent=content;log.append(p);}
  function clearPrivateResult(){log.querySelectorAll('[data-mora-private]').forEach(node=>node.remove());}
  function showPortalResult(result){
    clearPrivateResult();
    const card=document.createElement('section');card.className='mora-portal-message assistant';card.dataset.moraPrivate='true';card.setAttribute('aria-label','Geprüfte Portalauskunft');
    const add=text=>{const p=document.createElement('p');p.textContent=text;card.append(p);};
    if(result.status!=='verified')add(result.message);
    else{
      const statusLabels={received:'Anfrage eingegangen',in_progress:'In Bearbeitung',contractor_contacted:'Handwerker kontaktiert',appointment_agreed:'Termin vereinbart',completed:'Abgeschlossen',cancelled:'Storniert'};
      const equipmentLabels={light:'Lampe / Leuchte',socket:'Steckdose',heater:'Heizung',water:'Wasser',door:'Tür',window:'Fenster',appliance:'Gerät',other:'Anliegen'};
      const date=value=>new Date(value).toLocaleString('de-CH');
      add(result.title);
      for(const row of result.rows.slice(0,50))add(result.kind==='repair-counts'?row.property+' · '+row.count+' offene Reparaturanliegen':
        [row.property,equipmentLabels[row.equipment],statusLabels[row.status],row.reporter,...(row.appointmentAt?['Termin: '+date(row.appointmentAt)]:[])].filter(Boolean).join(' · '));
      if(!result.rows.length)add('Im freigegebenen Umfang sind keine entsprechenden Anliegen vorhanden.');
      if(result.rows.length>50)add('50 von '+result.rows.length+' Einträgen. Weitere Angaben finden Sie im freigegebenen Portalbereich.');
      add('Datenstand: '+date(result.asOf)+'. Nur für diesen Abruf geprüft.');
    }
    log.append(card);scrollEnd();
  }
  function message(role,content){if(role==='user')followEnd=true;thread.messages.push({role,content});thread.messages=thread.messages.slice(-80);bubble(role,content);scrollEnd();persist();}
  function button(label,run,primary=false,iconName='arrow'){const b=document.createElement('button');b.type='button';b.className='btn mora-portal-action'+(primary?' mora-portal-primary':'');b.innerHTML=uiIcon(iconName);const caption=document.createElement('span');caption.textContent=label;b.append(caption);b.disabled=busy;b.addEventListener('click',()=>{if(!busy)run();});actions.append(b);}
  function showControls(){
    actions.replaceChildren();
    if(thread.pendingReceipt){button('Speicherbestätigung erneut abgleichen',()=>syncReceipt(),true,'restart');scrollEnd();return;}
    const data=thread.data;if(!data){scrollEnd();return;}
    if(data.issues?.length>1){
      const select=document.createElement('select');select.setAttribute('aria-label','Anliegen auswählen');select.disabled=busy||Boolean(bridge.currentDraft());
      for(const issue of data.issues){const o=document.createElement('option');o.value=issue.id;o.textContent=[draftLabel(issue),issue.location].filter(Boolean).join(' · ');o.selected=issue.id===data.issue?.id;select.append(o);}
      select.addEventListener('change',async()=>{if(busy)return;setBusy(true,'Anliegen wird gewechselt …');try{await request({action:'switch-issue',issueId:select.value});}catch(e){message('error',e.message);}finally{setBusy(false);}});actions.append(select);
    }
    const connected=bridge.available().includes('cases');
    if(data.controls?.save&&connected)button(data.controls.save.operation==='update'?'Anliegen aktualisieren':'Anliegen vorbereiten',()=>prepareIssue(),true,'prepare');
    else if(data.controls?.prepared&&connected)button('Angaben überprüfen',()=>prepareIssue(),true,'review');
    else if(data.controls?.stored)button('Gespeichertes Anliegen öffnen',()=>navigate(()=>bridge.view(data.controls.stored.id)),true,'review');
    if(data.controls?.review&&connected)button('Foto hinzufügen',()=>prepareIssue(true),false,'photo');
    const manual=Boolean(data.controls?.save?.operation==='create'&&bridge.available().includes('new-case'));
    if(manual)button(names['new-case'],()=>navigate(()=>bridge.navigate('new-case')));
    for(const target of data.controls?.navigation || [])if(!(manual&&target==='new-case')&&bridge.available().includes(target)&&names[target])button(names[target],()=>navigate(()=>bridge.navigate(target)));

    scrollEnd();
  }
  function setBusy(value,label=''){busy=value;form.querySelector('button').disabled=value;input.disabled=value;panel.querySelector('[data-mp="clear"]').disabled=value;panel.setAttribute('aria-busy',String(value));status.textContent=label||storageWarning;showControls();}
  function close(){clearPrivateResult();readingOffset=scroller.scrollTop;panel.hidden=true;document.getElementById('moraFab')?.setAttribute('aria-expanded','false');lastFocus?.focus?.();}
  function navigate(fn){try{const ok=fn();if(ok!==false)close();}catch(e){status.textContent=e.message;}}
  async function request(payload){
    if(window.location.protocol==='file:')throw Error('Bitte öffnen Sie die bereitgestellte HTTPS-Testversion. Die lokale HTML-Datei enthält absichtlich keinen KI-Schlüssel.');
    if(!fetcher)throw Error('Die Backend-Verbindung ist in diesem Browser nicht verfügbar.');
    const start=window.performance.now(),startedRole=activeRole,startedEpoch=accessEpoch;
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(thread.session?{session:thread.session}:{}),...payload,navigation:bridge.available(),viewRole:startedRole}),signal:window.AbortSignal.timeout(55000)});
    const headers=window.performance.now();let data;
    try{data=await response.json();}catch{throw Error('Das geschützte Backend konnte nicht erreicht werden. Bitte laden Sie die Testversion neu.');}
    const parsed=window.performance.now();
    if(startedEpoch!==accessEpoch||startedRole!==bridge.role()||!bridge.open())throw Error('Die Portalansicht wurde gewechselt. Öffnen Sie MORA erneut.');
    if(data.architecture!==architecture){thread.data=null;persist();throw Error('Unerwartete Backend-Antwort.');}
    if(data.resetConversation){thread=blank();log.replaceChildren();bubble('assistant',greeting);persist();}
    if(data.session)thread.session=data.session;
    if(!response.ok){
      // Only a fresh server-confirmed fact update may retain controls on an
      // error. Never reuse old buttons or execute the rejected model action.
      thread.data=data.factsAccepted===true&&data.session&&data.controls?{...data,reply:'',requestedAction:null,navigation:[]}:null;
      persist();throw Error(data.error||'Die Backend-Verbindung ist gerade nicht verfügbar.');
    }
    // Personal query results are transient DOM output, never chat persistence,
    // never reused on reopen and never sent back to the model on later turns.
    const {portalResult,...conversationData}=data;void portalResult;
    thread.data=conversationData;persist();
    // Timings contain no customer text, tokens or credentials. DOM insertion is
    // measured separately from request duration; it is not a provider TTFT.
    window.console.info('MORA portal timing',{httpMs:parsed-start,responseHeadersMs:headers-start,jsonMs:parsed-headers,backend:data.timingMs});
    return data;
  }
  async function send(text){
    if(busy||!text.trim())return;
    if(thread.pendingReceipt){status.textContent='Bitte zuerst die noch offene Speicherbestätigung abgleichen.';return;}
    // A failed attempt must never leave an old action enabled.
    clearPrivateResult();thread.data=null;message('user',text.trim());
    const hazard=detectHazard(text.trim());if(hazard.hazard!=='none')message('error','Sicherheitshinweis: '+safetyNotice(hazard.hazard));
    input.value='';sizeInput();setBusy(true,'MORA antwortet …');
    const start=window.performance.now(),startedEpoch=accessEpoch;
    try{if(thread.pendingClose){await request({action:'draft-closed',issueId:thread.pendingClose});thread.pendingClose=null;persist();}const data=await request({message:text.trim(),messageId:window.crypto.randomUUID()});const performed=data.requestedAction?await prepareIssue(data.requestedAction==='photo',true):true;if(performed&&data.reply)message('assistant',data.reply);if(data.portalResult&&!panel.hidden)showPortalResult(data.portalResult);window.console.info('MORA portal visible response',{answerDomMs:window.performance.now()-start});}
    catch(e){if(startedEpoch===accessEpoch)message('error',e.message);}
    finally{if(startedEpoch===accessEpoch){setBusy(false);if(!panel.hidden)input.focus();}}
  }
  async function acknowledge(){
    const pending=thread.pendingReceipt;if(!pending)return;
    const data=await request({receipt:pending.receipt});
    if(!data.receiptAccepted)throw Error('Der Portalstand ist gespeichert, die Gesprächsbestätigung ist noch offen.');
    thread.saved[pending.receipt.issueId]=pending.fields;thread.pendingReceipt=null;persist();
  }
  async function syncReceipt(){if(busy)return;setBusy(true,'Speicherbestätigung wird abgeglichen …');try{await acknowledge();status.textContent='Der lokale Speicherstand ist bestätigt.';}catch(e){message('error',e.message);}finally{setBusy(false);}}
  const receiptFor=(ticket,extra)=>({...Object.fromEntries(['operationId','issueId','draftId','revision','contentHash'].map(k=>[k,ticket.operation[k]])),...extra});
  async function prepareIssue(photo=false,insideSend=false){
    if(busy&&!insideSend)return;
    const startedEpoch=accessEpoch,currentAccess=()=>startedEpoch===accessEpoch;
    setBusy(true,'Angaben werden ins Anliegenformular übernommen …');
    try{
      const wasCurrent=Boolean(thread.data?.controls?.stored);
      const ticket=await request({action:thread.data?.controls?.save?'save-issue':'review-issue'});
      const issueId=ticket.operation.issueId;
      bridge.prepare(ticket,thread.saved[issueId],{
        current:wasCurrent,
        onSaving(){if(currentAccess())setBusy(true,'Anliegen wird lokal gespeichert …');},
        async onSaved(proof){
          if(!currentAccess())return;
          // Keep the generated mapping separately from form edits, so a later
          // chat update can detect and preserve manual portal changes.
          thread.pendingReceipt={receipt:receiptFor(ticket,{status:'portal_received',attachmentCount:proof.attachmentCount,conflictFields:proof.conflictFields}),fields:proof.mappedFields};persist();
          message('receipt',proof.unchanged?'Der lokale Speicherstand ist bestätigt.':proof.updated?'Das Anliegen wurde auf diesem Gerät aktualisiert.':'Das Anliegen wurde auf diesem Gerät gespeichert.');
          try{await acknowledge();}catch{if(currentAccess())message('error','Das Anliegen ist lokal gespeichert. Der Abgleich mit dem Chat ist noch offen. Nutzen Sie «Speicherbestätigung erneut abgleichen».');}
          finally{if(currentAccess())setBusy(false);}
        },
        async onError(error){if(!currentAccess())return;message('error',error.message);try{await request({action:'draft-error',issueId});}catch{if(currentAccess())thread.data=null;}finally{if(currentAccess())setBusy(false);}},
        async onClosed(){
          if(!currentAccess())return;
          if(thread.pendingReceipt)return;
          thread.pendingClose=issueId;persist();
          setBusy(true,'Formularstatus wird abgeglichen …');
          try{await request({action:'draft-closed',issueId});thread.pendingClose=null;persist();}catch(e){if(currentAccess()){thread.data=null;message('error',e.message);}}finally{if(currentAccess())setBusy(false);}
        },
      },photo);
      close();
      await request({action:'draft-opened',issueId});
      status.textContent='Die Angaben stehen im Anliegenformular zur Kontrolle bereit. Noch nicht gespeichert.';
      return true;
    }catch(e){if(currentAccess())message('error',e.message);return false;}
    finally{if(!insideSend&&currentAccess())setBusy(false);}
  }

  function open(){
    if(!bridge.open())return;
    if(activeRole!==bridge.role()){load();log.replaceChildren();thread.messages.forEach(m=>bubble(m.role,m.content));followEnd=true;readingOffset=0;}
    if(panel.hidden)lastFocus=document.activeElement;panel.hidden=false;windowLayout.fit();document.getElementById('moraFab')?.setAttribute('aria-expanded','true');showControls();input.focus({preventScroll:true});sizeInput();if(followEnd)scrollEnd();else scroller.scrollTop=readingOffset;
    if(thread.data?.controls?.prepared&&!bridge.currentDraft()&&!busy){setBusy(true);request({action:'draft-closed',issueId:thread.data.controls.prepared.issueId}).catch(e=>message('error',e.message)).finally(()=>setBusy(false));}
  }
  form.addEventListener('submit',e=>{e.preventDefault();send(input.value);});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(input.value);}});
  panel.querySelector('[data-mp="close"]').addEventListener('click',close);
  panel.querySelector('[data-mp="clear"]').addEventListener('click',()=>{if(busy||thread.pendingReceipt||bridge.currentDraft())return;thread=blank();persist();log.replaceChildren();bubble('assistant',greeting);followEnd=true;setBusy(false);input.focus();});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  // The real portal must emit this on login/logout/account or mandate changes.
  // Frontend cleanup complements, never replaces, server authorization.
  window.addEventListener('mora:access-changed',()=>{
    accessEpoch++;close();
    try{for(let i=window.sessionStorage.length-1;i>=0;i--){const k=window.sessionStorage.key(i);if(k?.startsWith('morada.portal.mora.'))window.sessionStorage.removeItem(k);}}catch{}
    activeRole=bridge.role();thread=blank();log.replaceChildren();bubble('assistant',greeting);input.value='';setBusy(false);
  });
  new window.MutationObserver(()=>{
    if(!bridge.open()){clearPrivateResult();if(!panel.hidden)panel.hidden=true;}
    if(activeRole&&activeRole!==bridge.role()){accessEpoch++;close();load();log.replaceChildren();thread.messages.forEach(m=>bubble(m.role,m.content));setBusy(false);}
  }).observe(document.getElementById('portalPreview'),{attributes:true,childList:true,subtree:true});
  return {open,close,send,getState:()=>structuredClone(thread),element:panel};
}
