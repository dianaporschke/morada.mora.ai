/** Executed inside the supplied HTML, after its existing classic script.
 * Only this boundary touches its lexical state and existing portal functions. */
export function createPortalBridge(mapping) {
  const {managedCaseFields,sameCaseFields}=mapping;
  return {
    available(){return (crmWritable()?['cases','calendar','documents','properties','units','tasks','team','support','new-task','new-appointment','new-document']:[role+'Home',role+'Contact',role==='owner'?'ownerCases':'tenantSupport',role+'Documents']).filter(t=>allowed(t.startsWith('new-')?({task:'tasks',appointment:'calendar',document:'documents'})[t.slice(4)]:t));},
    role(){return role;},
    open(){return previewOpen;},
    navigate(target){
      if(!this.available().includes(target))throw Error('Diese Funktion ist in dieser Ansicht nicht verfügbar.');
      if(target.startsWith('new-')){if(!portalCloseDialog())return false;newEntry(target.slice(4));return true;}
      go(target);return current===target;
    },
    view(id){if(!crmWritable()||!state.cases.some(c=>c.id===id))throw Error('Das gespeicherte Anliegen ist in diesem Portalstand nicht vorhanden.');caseDetail(id);},
    async save(operation,fields,previousFields,sourceEvidence=''){
      if(!crmWritable())throw Error('Speichern ist in dieser Ansicht nicht angebunden.');
      if(portalLoading||portalSaving||portalReadBlocked)throw Error('Bitte zuerst den Portalstand laden oder die laufende Speicherung abwarten.');
      if(!portalCanLeaveDialog())throw Error('Bitte zuerst die offenen Formulareingaben sichern.');
      const id=operation.issueId,source=state,old=state.cases.find(c=>c.id===id);
      const updated=Boolean(old);
      if(old){
        if(opsClosed(old)||old.archivedAt)throw Error('Dieses Anliegen ist abgeschlossen. Bitte im Anliegenregister prüfen.');
        if(sameCaseFields(managedCaseFields(old),fields)){
          const read=await portalReadStored(),saved=read.next.cases.find(c=>c.id===id);
          if(!saved||!sameCaseFields(managedCaseFields(saved),fields))throw Error('Der aktuelle Speicherstand weicht ab. Bitte den Portalstand neu laden.');
          return {id,fields,updated,unchanged:true};
        }
        if(!previousFields||!sameCaseFields(managedCaseFields(old),previousFields))throw Error('Das Anliegen wurde im Portal bearbeitet. Bitte diese Änderungen im Anliegenregister prüfen; MORA überschreibt sie nicht.');
      }else if(previousFields)throw Error('Das zuvor gespeicherte Anliegen fehlt. Bitte den aktuellen Portalstand laden.');
      const today=crmToday();
      let record=old?{...old,title:fields.title,description:fields.description,unit:fields.unit}
        :{id,title:fields.title,description:fields.description,unit:fields.unit,propertyId:'',unitId:'',assetId:'',property:'',owner:profiles[role].name,priority:'Normal',status:'Neu',person:'',date:today,attachments:[],createdAt:new Date().toISOString(),createdBy:profiles[role].name};
      record=casePrepare(record,{category:fields.category,...(!old?{channel:'Portal',receivedDate:today}:{})},old);
      record=opsWithEvent(record,old?'edited':'created','Über MORA lokal gespeichert. Gesprächsbelege (frühere Angaben können korrigiert sein):\n'+String(sourceEvidence).slice(-2800),old?opsChanges(old,record):[]);
      const rows=old?state.cases.map(c=>c.id===id?record:c):[record,...state.cases];
      applicantValidateState(opsValidateState({...state,cases:rows}));
      if(source!==state)throw Error('Der Portalstand hat sich geändert. Bitte erneut prüfen.');
      const result=await companyCommit({cases:rows},'MORA · Anliegen '+(old?'aktualisiert: ':'erfasst: ')+record.title);
      if(result.error||!result.persisted)throw Error(result.error||'Die Speicherung wurde nicht bestätigt.');
      // Read the actual durable portal snapshot, including its IndexedDB path.
      const persisted=await portalReadStored(),saved=persisted.next.cases.find(c=>c.id===id);
      if(!saved||!sameCaseFields(managedCaseFields(saved),fields))throw Error('Der gespeicherte Portalstand stimmt nicht mit den Chatangaben überein. Bitte das Anliegen im Register prüfen.');
      if(previewOpen)render();
      return {id,fields:managedCaseFields(saved),updated,unchanged:false};
    },
  };
}
