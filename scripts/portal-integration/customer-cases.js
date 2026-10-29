/** Customer preview adapter to the existing cases collection, validators and
 * durable portal writer. Browser-session scope is NOT authenticated identity.
 * Never expose administrative assignment choices or internal case histories. */
export function createCustomerCases(){
  const enabled=()=>previewOpen&&['tenant','owner'].includes(role);
  const route=()=>role==='tenant'?'tenantSupport':'ownerCases';
  const scopes=new Map();
  const scope=()=>{
    if(scopes.has(role))return scopes.get(role);
    const key='morada.mora.local-case-scope.'+role;let value;
    try{value=sessionStorage.getItem(key);}catch{}
    if(!value){value=crypto.randomUUID();try{sessionStorage.setItem(key,value);}catch{}}
    scopes.set(role,value);return value;
  };
  const owns=r=>enabled()&&r?.moraLocalScope===scope()&&r?.moraLocalRole===role;
  const requireReady=()=>{if(!enabled()||portalLoading||portalSaving||portalReadBlocked)throw Error('Der Portalstand ist gerade nicht zum Speichern bereit.');};
  function find(id){const record=state.cases.find(r=>r.id===id);if(!owns(record))throw Error('Dieser lokale Entwurf gehört nicht zu dieser Sitzung.');return record;}
  async function saveCase(data,id,items,source,identity={}){
    requireReady();if(source!==state)throw Error('Der Portalstand hat sich geändert. Bitte das Formular erneut öffnen.');
    const old=id?find(id):null,recordId=old?.id||identity.id||crypto.randomUUID();
    if(!old&&state.cases.some(r=>r.id===recordId))throw Error('Diese Anliegenkennung wird bereits verwendet.');
    // Only these public fields may change. Assignment/status/internal fields
    // in DOM tampering, model output or old records are never accepted.
    const fields=Object.fromEntries(['title','description','unit','category'].map(k=>[k,String(data[k]||'').trim()]));
    if(!fields.title||fields.title.length>180||!fields.description||fields.description.length>3000||fields.unit.length>500||!caseCategories().includes(fields.category))throw Error('Bitte Titel, Beschreibung, Bereich und Anliegenart prüfen.');
    if(old&&(opsClosed(old)||old.archivedAt))throw Error('Dieses Anliegen ist abgeschlossen und kann hier nicht geändert werden.');
    let record=casePrepare({...old,id:recordId,title:fields.title,description:fields.description,unit:fields.unit,
      propertyId:old?.propertyId||'',unitId:old?.unitId||'',property:old?.property||'',person:old?.person||'',
      date:old?.date||crmToday(),owner:old?.owner||'MORADA',status:old?.status||'Neu',priority:old?.priority||'Normal',
      attachments:[...items],moraLocalScope:scope(),moraLocalRole:role,
      createdAt:old?.createdAt||new Date().toISOString(),createdBy:old?.createdBy||'Lokaler Entwurf'},
      {category:fields.category,channel:'Portal'},old);
    record=opsWithEvent(record,old?'edited':'created',String(identity.note||'').slice(0,3000),old?opsChanges(old,record):[]);
    const rows=old?state.cases.map(r=>r.id===recordId?record:r):[record,...state.cases];
    opsValidateState({...state,cases:rows});
    const result=await companyCommit({cases:rows},'Lokaler Anliegenentwurf gespeichert');
    if(result.error||!result.persisted)throw Error(result.error||'Die Speicherung wurde nicht bestätigt.');
    const stored=await portalReadStored(),saved=stored.next.cases.find(r=>r.id===recordId);
    if(!saved||!sameCaseFields(managedCaseFields(saved),managedCaseFields(record))||saved.moraLocalScope!==record.moraLocalScope||saved.moraLocalRole!==record.moraLocalRole||JSON.stringify(saved.attachments)!==JSON.stringify(record.attachments))throw Error('Der gespeicherte Entwurf konnte nicht überprüft werden.');
    return {...result,record:saved};
  }
  function open(id='',preset={},managed=false){
    requireReady();if(!portalCloseDialog())return false;
    const old=id?find(id):null,values=old?managedCaseFields(old):{title:'',description:'',unit:'',category:'Schaden / Reparatur',...preset};
    const fields=portfolioInput('Worum geht es? *','title',values.title,'required maxlength="180"',true)+select('Art des Anliegens','category',caseCategories(),values.category)+crmTextarea('Beschreibung *','description',values.description,3000).replace('textarea name="description"','textarea name="description" required')+portfolioInput('Raum / Bereich','unit',values.unit,'maxlength="500"',true);
    const ok=openModal(old?'Anliegen prüfen.':'Anliegen vorbereiten.',`<form id="opsEntryForm" data-kind="case" data-id="${esc(id)}" class="case-form" data-customer-case="true"><p class="crm-form-note">Lokaler Entwurf auf diesem Gerät. Noch nicht an MORADA übermittelt.</p><div class="form-grid">${fields}</div><details><summary>Fotos & Dateien (optional)</summary>${opsFileForm(old?.attachments||[])}</details><p id="opsFormError" class="company-form-error" role="alert" hidden></p><div class="dialog-actions">${btn('Abbrechen','type="button" data-action="close"',false,'arrow')}${btn('Entwurf speichern','type="submit"',true,'check')}</div></form>`,'MORADA · ANLIEGEN');
    if(!ok)return false;
    opsDraft={kind:'case',id,items:[...(old?.attachments||[])],source:state,reading:false};
    const form=document.getElementById('opsEntryForm'),startedRole=role,startedScope=scope();let saving=false;
    form.addEventListener('change',e=>{if(e.target.id==='opsFileInput')opsAddFiles(e.target);});
    form.addEventListener('click',e=>{const b=e.target.closest('[data-ops-action="remove-file"]');if(b&&opsDraft&&!opsDraft.reading){opsDraft.items=opsDraft.items.filter(a=>a.id!==b.dataset.fileId);document.getElementById('opsFileList').innerHTML=opsFileList(opsDraft.items,true);}});
    if(!managed)form.addEventListener('submit',async e=>{
      e.preventDefault();e.stopImmediatePropagation();if(saving||!form.reportValidity()||opsDraft?.reading)return;
      if(role!==startedRole||scope()!==startedScope||!opsDraft){opsFormError('Der Portalzugang wurde gewechselt.');return;}
      saving=true;form.querySelector('[type="submit"]').disabled=true;
      try{const r=await saveCase(Object.fromEntries(new FormData(form)),form.dataset.id,opsDraft.items,opsDraft.source);portalMarkDialogClean();dialog.close();go(route());notify('Entwurf auf diesem Gerät gespeichert. Nicht übermittelt.');}
      catch(error){opsFormError(error.message);}finally{saving=false;if(form.isConnected)form.querySelector('[type="submit"]').disabled=false;}
    });
    portalMarkDialogClean();return true;
  }
  function mount(){
    if(!enabled()||current!==route())return;
    const main=document.getElementById('main');if(main.querySelector('[data-mora-customer-cases]'))return;
    const section=document.createElement('section');section.dataset.moraCustomerCases='true';section.className='crm-form-note';
    const note=document.createElement('p');note.textContent='Lokale Entwürfe dieser Sitzung. Kein Versand an MORADA und keine angebundenen Kundenakten.';section.append(note);
    const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;b.onclick=()=>{try{fn();}catch(error){notify(error.message);}};section.append(b);};
    button('Anliegen selbst erfassen',()=>open());button('Mit MORA vorbereiten',()=>{window.MORAPortal.open();window.MORAPortal.send('Ich möchte ein Anliegen mit Ihnen vorbereiten.');});
    main.prepend(section);
    const body=main.querySelector('tbody');if(body){body.replaceChildren();
      for(const r of state.cases.filter(owns)){const row=document.createElement('tr');
        for(const text of [r.title,r.date,'—','Lokal gespeichert · nicht übermittelt']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}
        const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Prüfen / ergänzen';b.onclick=()=>{try{open(r.id);}catch(error){notify(error.message);}};row.firstChild.append(b);body.append(row);}
    }
  }
  const originalRender=render;render=function(...args){const result=originalRender.apply(this,args);mount();return result;};
  window.addEventListener('mora:access-changed',()=>{scopes.clear();for(const r of ['tenant','owner'])try{sessionStorage.removeItem('morada.mora.local-case-scope.'+r);}catch{}});
  return {enabled,open,save:saveCase,find,show:()=>{portalMarkDialogClean();dialog.close();go(route());},mount};
}
