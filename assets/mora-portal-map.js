/** The supplied portal has caseInfo.category, title, description and unit.
 * It has no separate equipment/count/start fields. Keep those losslessly in
 * the description rather than inventing another service form or schema. */
import {mapServiceDraft,draftLabel,draftSummary,categoryLabels} from './mora-data.js';

export const portalNavigation={
  cases:{label:'Anliegen öffnen',purpose:'Vorhandenes Anliegenregister. MORA speichert über den separaten Speicherbutton.'},
  tasks:{label:'Aufgaben öffnen',purpose:'Interne Aufgaben; getrennt von Kundenanliegen.'},
  calendar:{label:'Kalender öffnen',purpose:'Vorhandene Kalenderansicht; Öffnen bucht keinen Termin.'},
  documents:{label:'Dokumente öffnen',purpose:'Vorhandene Dokumentenansicht; kein KI-Zugriff auf Dateiinhalte.'},
  properties:{label:'Liegenschaften öffnen',purpose:'Liegenschaftsregister.'},units:{label:'Einheiten öffnen',purpose:'Einheitenregister.'},
  team:{label:'Team & Kontakte öffnen',purpose:'Kontaktansicht; keine Kontaktaufnahme durch MORA.'},support:{label:'Hilfe öffnen',purpose:'Vorhandene Hilfeseite.'},
  'new-task':{label:'Aufgabenformular öffnen',purpose:'Formular für eine interne Aufgabe, KEIN Anliegenformular. Öffnen speichert nichts.'},
  'new-appointment':{label:'Terminformular öffnen',purpose:'Termin manuell erfassen. Öffnen ist keine Buchung oder Bestätigung.'},
  'new-document':{label:'Dokumentenformular öffnen',purpose:'Dokument manuell erfassen. Kein automatischer Upload oder Versand.'},
  ownerHome:{label:'Übersicht öffnen',purpose:'Vorbereitete Eigentümeransicht ohne Kontozuordnung.'},tenantHome:{label:'Übersicht öffnen',purpose:'Vorbereitete Mieteransicht ohne Kontozuordnung.'},
  ownerContact:{label:'Kontakt öffnen',purpose:'Kontaktansicht.'},tenantContact:{label:'Kontakt öffnen',purpose:'Kontaktansicht.'},
  ownerCases:{label:'Anliegenansicht öffnen',purpose:'Vorbereitete Kundenansicht; noch keine personenbezogene Speicherung.'},tenantSupport:{label:'Anliegenansicht öffnen',purpose:'Vorbereitete Kundenansicht; noch keine personenbezogene Speicherung.'},
  ownerDocuments:{label:'Dokumentenansicht öffnen',purpose:'Vorbereitete Kundenansicht ohne persönliche Dokumentenfreigabe.'},tenantDocuments:{label:'Dokumentenansicht öffnen',purpose:'Vorbereitete Kundenansicht ohne persönliche Dokumentenfreigabe.'},
};

export function portalCaseFields(issue) {
  const draft=mapServiceDraft(issue);
  const category=['water','electricity','heating','appliances'].includes(draft.category)
    ? 'Schaden / Reparatur':draft.category==='access'?'Schlüssel / Zutritt'
    :draft.category==='neighbours'?'Beschwerde':'Allgemein';
  const spatial=draft.walkthrough?(draft.walkthrough.status==='selected'?'\nIm Walkthrough ausgewählt: '+draft.walkthrough.objectLabel+' · '+draft.walkthrough.roomLabel:'\nWalkthrough-Zuordnung: nach Korrektur erneut auswählen.') : '';
  const description='Fachbereich: '+(draft.category==='general'?'Noch nicht zugeordnet':categoryLabels[draft.category])+'\n'+draftSummary(draft)+(!draft.since&&!draft.unknownFields?.includes('since')&&draft.fieldFacts?.since?.status!=='uncertain'?'\nBeginn: Nicht angegeben':'')+spatial;
  if(description.length>3000)throw Error('Die Beschreibung ist zu lang für das Anliegenformular. Bitte im Chat kürzen.');
  return {title:[draftLabel(draft),draft.location].filter(Boolean).join(' · ').slice(0,180),
    category,unit:draft.location || '',description};
}
export const managedCaseFields=record=>({title:record.title,description:record.description,unit:record.unit || '',category:record.caseInfo?.category || 'Allgemein'});
export const sameCaseFields=(a,b)=>['title','description','unit','category'].every(k=>a?.[k]===b?.[k]);
/** Native form requirements, not the legacy app's equipment wizard. An unknown
 * fixture/category is valid; optional start/count questions never block review. */
export function portalIssueReadiness(issue){
  const missing=[];
  if(!issue?.defect||['unknown','uncertain'].includes(issue.fieldFacts?.defect?.status))missing.push('defect');
  if(!issue?.location&&issue?.fieldFacts?.location?.status!=='unknown'||issue?.fieldFacts?.location?.status==='uncertain')missing.push('location');
  return {ready:Boolean(issue&&missing.length===0),missing};
}
/** Keep exact customer evidence in the existing case history. It is an audit
 * record, not a second diagnosis or an obsolete value in the current fields. */
export const portalCaseEvidence=issue=>{
  const reference=issue.walkthrough?'\nMORA Walkthrough reference: '+JSON.stringify(issue.walkthrough):'';
  return (issue.answers || []).slice(-6).map(a=>a.answer).join('\n').slice(-(2800-reference.length))+reference;
};
