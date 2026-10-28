/* Synthetic local UI tests only. Injected into an ignored generated QA page,
 * never into portal.html. No real model responses or success claims. */
(()=>{
 // The managed local HTTP preview lacks secure-context randomUUID. This is
 // fixture-only identity generation; the real HTTPS application is unchanged.
 let testSequence=0;
 if(!crypto.randomUUID)crypto.randomUUID=()=> '33333333-3333-4333-8333-'+String(++testSequence).padStart(12,'0');
 const scenario=new URL(location.href).searchParams.get('case')||'actions';
 const id='11111111-1111-4111-8111-111111111111';
 const issue={id,equipment:'light',defect:'Lampe funktioniert nicht.',location:'Wohnzimmer',count:1,since:null,details:'Nur diese Lampe ist betroffen.',revision:1};
 const controls={save:{operation:'create',issueId:id},review:{issueId:id},navigation:[]};
 if(scenario==='navigation-owner'||scenario==='navigation-tenant'){delete controls.save;delete controls.review;controls.navigation=[scenario==='navigation-owner'?'ownerFinance':'tenantPayments'];}
 const response={architecture:'portal_agent_v1',session:'LOCAL_UI_TEST_ONLY',issue,issues:[issue],controls,safety:null,modelCalls:0};
 const conversation=[{role:'user',content:'Die Lampe im Wohnzimmer funktioniert seit gestern nicht mehr.'},{role:'assistant',content:'Das ist ärgerlich. Für das Anliegen sind diese Angaben erfasst:\n\nLampe / Leuchte · Wohnzimmer\nEine Lampe · seit gestern\n\nSie können die Angaben im Anliegenformular prüfen und ergänzen.'}];
 let messages=conversation;
 if(scenario==='welcome')messages=null;
 if(scenario==='short')messages=[{role:'user',content:'Meine Lampe funktioniert nicht.'},{role:'assistant',content:'Das ist ärgerlich. Wo befindet sich die Lampe?'}];
 if(scenario==='long')messages=Array.from({length:8},(_,i)=>[{role:'user',content:'Lokale Testnachricht '+(i+1)+': Die Lampe im Wohnzimmer funktioniert nicht.\n\nEs geht um die Leuchte neben dem Fenster. Ich möchte die Angaben vor dem Speichern noch einmal ansehen.'},{role:'assistant',content:'Lokale UI-Testantwort mit mehreren Absätzen. Diese Inhalte prüfen ausschliesslich Umbrüche, Lesbarkeit und das Verhalten beim Scrollen.\n\nBereits vorhandene Angaben bleiben während des Lesens sichtbar. Ein neuer Abschnitt soll den Verlauf nicht an eine andere Stelle springen lassen.\n\nAuch längere Wörter bleiben innerhalb der Nachrichtenfläche: Beleuchtungseinrichtungsbeschreibung.'}]).flat();
 if(scenario==='error')messages=[...conversation,{role:'error',content:'Lokaler UI-Test: Der Speichervorgang wurde absichtlich unterbrochen. Ihre Angaben bleiben erhalten. Es wurde kein Erfolg bestätigt.'}];
 if(scenario==='saved')messages=[...conversation,{role:'receipt',content:'Lokaler UI-Test: Das Anliegen wurde auf diesem Gerät gespeichert. Kein Versand an MORADA.'}];
 const data=['short','long','error','loading'].includes(scenario)?null:structuredClone(response);
 if(scenario==='saved')data.controls={stored:{id,scope:'this_device',transmitted:false},review:{issueId:id},navigation:[]};
 const testRole=scenario==='navigation-owner'?'owner':scenario==='navigation-tenant'?'tenant':'admin';
 const sessionKey='morada.portal.mora.agent.v1.'+testRole;
 if(scenario.startsWith('navigation-'))messages=[{role:'user',content:'Lokaler UI-Test: Wo finde ich meine Zahlungen?'},{role:'assistant',content:'Lokale Testantwort: Über den Button gelangen Sie zur vorhandenen Finanzansicht. MORA liest keine Rechnungen oder Beträge aus.'}];
 if(messages)sessionStorage.setItem(sessionKey,JSON.stringify({session:'LOCAL_UI_TEST_ONLY',messages,data,saved:{},pendingReceipt:null}));else sessionStorage.removeItem(sessionKey);
 window.__moraUiRequests=[];
 window.fetch=async(url,options)=>{
  if(!String(url).startsWith('/api/portal-'))throw Error('UI-Test blockiert Netzwerkzugriff.');
  const input=JSON.parse(options.body);window.__moraUiRequests.push(input);
  let value=structuredClone(response),ok=true;
  if(input.message){
   if(scenario==='loading')await new Promise(resolve=>{window.__moraUiRelease=resolve;});
   if(scenario==='error'){ok=false;value.error='Lokaler UI-Test: Verbindung absichtlich unterbrochen.';value.controls={};}
   else value.reply='Lokale UI-Testantwort. Diese Nachricht stammt aus Testdaten; es wurde keine KI aufgerufen.';
   if(scenario==='authorized-cases'){
    value.reply='';value.controls={navigation:['cases']};
    value.portalResult={status:'verified',kind:'case-status',asOf:new Date().toISOString(),title:'LOKALE TESTDATEN · Anliegenstände',rows:[{property:'Testliegenschaft A',equipment:'light',status:'contractor_contacted'},{property:'Testliegenschaft A',equipment:'heater',status:'appointment_agreed'}]};
   }
  }
  if(['save-issue','review-issue'].includes(input.action)){
   value.operation={operationId:'22222222-2222-4222-8222-222222222222',issueId:id,draftId:id,revision:1,contentHash:'a'.repeat(64)};
   value.fields={title:'Lampe / Leuchte · Wohnzimmer',unit:'Wohnzimmer',category:'Schaden / Reparatur',description:'LOKALE UI-TESTDATEN\nLampe funktioniert nicht.\nAnzahl: 1\nBereich: Wohnzimmer\nBeginn: gestern'};value.sourceEvidence='Lokale UI-Testdaten, keine echte Kundenmeldung.';
  }
  if(input.action==='draft-opened')value.controls={prepared:{issueId:id},review:{issueId:id},navigation:[]};
  if(input.receipt){value.receiptAccepted=true;value.controls={stored:{id,scope:'this_device',transmitted:false},review:{issueId:id},navigation:[]};}
  return {ok,json:async()=>value};
 };
 document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('entry-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  if(testRole!=='admin')window.MoradaRoles.select(testRole);
  document.getElementById('moraFab').click();
  const badge=document.createElement('div');badge.textContent='Lokale UI-Testdaten · keine KI-Anfrage';badge.style.cssText='flex-shrink:0;padding:5px 22px;color:#d3c7ba;font:11px/1.3 system-ui;border-bottom:1px solid #cfab8625';
  document.querySelector('#moraPortalChat header').after(badge);
  if(scenario==='fallback'){
   const style=document.createElement('style');style.textContent='#portalPreview #moraPortalChat{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:linear-gradient(155deg,#514132,#2b241d 75%)!important}';document.head.append(style);
  }
  if(scenario==='loading')window.MORAPortal.send('Lokale Prüfung des Ladezustands.');
  if(scenario==='authorized-cases')window.MORAPortal.send('Lokaler UI-Test: Meine Anliegenstände anzeigen.');
 });
})();
