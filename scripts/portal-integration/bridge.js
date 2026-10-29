/** MORA boundary to the supplied portal. No parallel case/file storage. */
export function createPortalBridge(mapping) {
  const {managedCaseFields,sameCaseFields}=mapping;
  let review=null;
  const ensure=()=>{
    if(!crmWritable())throw Error('Anliegen sind in dieser Ansicht noch nicht zum Speichern angebunden.');
    if(portalLoading||portalSaving||portalReadBlocked)throw Error('Bitte zuerst den Portalstand laden oder die laufende Speicherung abwarten.');
  };
  const api={
    available(){
      if(!previewOpen)return [];
      const pages=[...roleGroups().flatMap(([,items])=>items.map(([id])=>id)),'searchPage'];
      if(crmWritable())pages.push('communication','new-case','new-task','new-appointment','new-document');
      return [...new Set(pages)].filter(t=>Object.hasOwn(portalNavigation,t)&&allowed(t.startsWith('new-')?({case:'cases',task:'tasks',appointment:'calendar',document:'documents'})[t.slice(4)]:t));
    },
    role(){return role;},open(){return previewOpen;},
    navigate(target){
      if(!this.available().includes(target))throw Error('Diese Funktion ist in dieser Ansicht nicht verfügbar.');
      if(target==='new-case'){ensure();if(!portalCloseDialog())return false;return Boolean(caseOpenForm());}
      if(target.startsWith('new-')){if(!portalCloseDialog())return false;newEntry(target.slice(4));return true;}
      go(target);return current===target;
    },
    view(id){ensure();if(!state.cases.some(c=>c.id===id))throw Error('Das Anliegen ist in diesem Portalstand nicht vorhanden.');caseDetail(id);},
    currentDraft(){return review&&dialog.open&&review.form.isConnected?{issueId:review.ticket.operation.issueId}:null;},
    prepare(ticket,previousFields,callbacks={},photo=false){
      ensure();
      if(review&&dialog.open&&review.form.isConnected){
        if(review.ticket.operation.operationId!==ticket.operation.operationId)throw Error('Bitte das offene Anliegen zuerst speichern oder schliessen.');
        if(photo)api.photo();return {alreadyOpen:true};
      }
      if(!portalCloseDialog())throw Error('Bitte zuerst die offenen Formulareingaben sichern.');
      const {operation,fields}=ticket,id=operation.issueId,old=state.cases.find(c=>c.id===id);
      if(old&&(opsClosed(old)||old.archivedAt))throw Error('Dieses Anliegen ist abgeschlossen. Bitte im Anliegenregister prüfen.');
      const same=old&&sameCaseFields(managedCaseFields(old),fields);
      // A photo/review of the current chat revision preserves customer edits.
      const current=old&&callbacks.current;
      if(old&&!same&&!current&&(!previousFields||!sameCaseFields(managedCaseFields(old),previousFields)))throw Error('Das Anliegen enthält eigene Formularänderungen. Bitte im Anliegenregister prüfen; MORA überschreibt sie nicht.');
      if(!old&&previousFields)throw Error('Das zuvor gespeicherte Anliegen fehlt. Bitte den aktuellen Portalstand laden.');
      if(!caseOpenForm(old?id:'','','',{...fields,caseInfo:{category:fields.category,channel:'Portal'}}))throw Error('Das Anliegenformular konnte nicht geöffnet werden.');
      const form=document.getElementById('opsEntryForm');
      if(!current)for(const [key,value]of Object.entries(fields))form.elements.namedItem(key).value=value;
      if(!current&&!sameCaseFields(Object.fromEntries(Object.keys(fields).map(k=>[k,form.elements.namedItem(k).value])),fields))throw Error('Die Formularübernahme konnte nicht bestätigt werden.');
      const ctx={ticket,form,callbacks,role,source:state,saving:false,complete:false,old:Boolean(old)};review=ctx;
      form.dataset.moraIssue=id;
      const notice=document.createElement('p');notice.className='crm-form-note';notice.textContent='Von MORA vorausgefüllt. Bitte prüfen und speichern. Dateien und Anliegen werden auf diesem Gerät gespeichert; kein Versand an MORADA.';form.prepend(notice);
      form.addEventListener('submit',async event=>{
        event.preventDefault();event.stopImmediatePropagation();
        if(ctx.saving||!form.reportValidity())return;
        const draft=opsDraft;
        if(review!==ctx||role!==ctx.role||!previewOpen||!draft||draft.source!==ctx.source||draft.reading){opsFormError('Bitte den aktuellen Portalstand prüfen und warten, bis die Dateien eingelesen sind.');return;}
        ctx.saving=true;form.querySelector('[type="submit"]').disabled=true;callbacks.onSaving?.();
        try{
          ensure();
          const data=Object.fromEntries(new FormData(form));
          const result=await opsSaveRecord('case',data,form.dataset.id,draft.items,draft.source,{id,note:'MORA · Gesprächsbelege (spätere Korrekturen gelten):\n'+String(ticket.sourceEvidence||'').slice(-2800)});
          if(result.error||!result.persisted)throw Error(result.error||'Die Speicherung wurde nicht bestätigt.');
          form.dataset.id=id;opsDraft.id=id;opsDraft.source=state;ctx.source=state;
          const persisted=await portalReadStored(),saved=persisted.next.cases.find(c=>c.id===id);
          if(!saved||!sameCaseFields(managedCaseFields(saved),managedCaseFields(result.record))||JSON.stringify(saved.attachments)!==JSON.stringify(result.record.attachments))throw Error('Der gespeicherte Portalstand konnte nicht vollständig bestätigt werden. Bitte erneut speichern oder im Anliegenregister prüfen.');
          ctx.complete=true;review=null;
          opsAfterSave('case',saved,form.dataset.returnTo,!ctx.old);caseDetail(id);
          await callbacks.onSaved?.({id,fields:managedCaseFields(saved),mappedFields:fields,attachmentCount:saved.attachments.length,conflictFields:Object.keys(fields).filter(k=>fields[k]!==managedCaseFields(saved)[k]),updated:ctx.old,unchanged:Boolean(result.unchanged)});
        }catch(error){opsFormError(error.message);await callbacks.onError?.(error);}
        finally{ctx.saving=false;if(form.isConnected)form.querySelector('[type="submit"]').disabled=false;}
      });
      dialog.addEventListener('close',()=>{if(review===ctx){review=null;if(!ctx.complete)callbacks.onClosed?.();}},{once:true});
      portalMarkDialogClean();
      if(photo)api.photo();
      return {alreadyOpen:false};
    },
    photo(){
      if(!api.currentDraft()||opsDraft?.reading)throw Error('Bitte zuerst das Anliegenformular öffnen.');
      const input=document.getElementById('opsFileInput');if(!input)throw Error('Der Fotoanhang ist nicht verfügbar.');
      input.closest('details').open=true;input.click();
    },
  };
  return api;
}
