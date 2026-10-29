/** The supplied portal has caseInfo.category, title, description and unit.
 * It has no separate equipment/count/start fields. Keep those losslessly in
 * the description rather than inventing another service form or schema. */
import {mapServiceDraft,draftLabel,draftSummary,categoryLabels} from './mora-data.js';

/** @type {Record<string,{label:string,purpose:string,dataAccess?:string,preparedView?:boolean}>} */
export const portalNavigation={
  'customer-case':{label:'Anliegen selbst erfassen',purpose:'Kundenformular für lokale Anliegenentwürfe. Manuell ausfüllen oder mit MORA vorausfüllen; derselbe Portalspeicher. Unter Meine Anliegen bzw. Anliegen & Unterhalt prüfen/ergänzen. Kein Versand und keine Kundenaktenanbindung.'},
  cases:{label:'Anliegen öffnen',purpose:'Vorhandenes Anliegenregister. MORA speichert über den separaten Speicherbutton.'},
  tasks:{label:'Aufgaben öffnen',purpose:'Interne Aufgaben; getrennt von Kundenanliegen.'},
  calendar:{label:'Kalender öffnen',purpose:'Vorhandene Kalenderansicht; Öffnen bucht keinen Termin.'},
  documents:{label:'Dokumente öffnen',purpose:'Vorhandene Dokumentenansicht; kein KI-Zugriff auf Dateiinhalte.'},
  properties:{label:'Liegenschaften öffnen',purpose:'Liegenschaftsregister.'},units:{label:'Einheiten öffnen',purpose:'Einheitenregister.'},
  team:{label:'Team & Kontakte öffnen',purpose:'Kontaktansicht; keine Kontaktaufnahme durch MORA.'},support:{label:'Hilfe öffnen',purpose:'Vorhandene Hilfeseite.'},
  'new-task':{label:'Aufgabenformular öffnen',purpose:'Formular für eine interne Aufgabe, KEIN Anliegenformular. Öffnen speichert nichts.'},
  'new-case':{label:'Anliegen selbst erfassen',purpose:'Vorhandenes leeres Anliegenformular manuell ausfüllen. Alternativ kann MORA die Gesprächsangaben in dasselbe Formular übernehmen. Erst Speichern sichert lokal; kein Versand.'},
  'new-appointment':{label:'Terminformular öffnen',purpose:'Termin manuell erfassen. Öffnen ist keine Buchung oder Bestätigung.'},
  'new-document':{label:'Dokumentenformular öffnen',purpose:'Dokument manuell erfassen. Kein automatischer Upload oder Versand.'},
  ownerHome:{label:'Übersicht öffnen',purpose:'Vorbereitete Eigentümeransicht ohne Kontozuordnung.'},tenantHome:{label:'Übersicht öffnen',purpose:'Vorbereitete Mieteransicht ohne Kontozuordnung.'},
  ownerContact:{label:'Kontakt öffnen',purpose:'Kontaktansicht.'},tenantContact:{label:'Kontakt öffnen',purpose:'Kontaktansicht.'},
  ownerCases:{label:'Anliegenansicht öffnen',purpose:'Vorbereitete Kundenansicht; noch keine personenbezogene Speicherung.'},tenantSupport:{label:'Anliegenansicht öffnen',purpose:'Vorbereitete Kundenansicht; noch keine personenbezogene Speicherung.'},
  ownerDocuments:{label:'Dokumentenansicht öffnen',purpose:'Vorbereitete Kundenansicht ohne persönliche Dokumentenfreigabe.'},tenantDocuments:{label:'Dokumentenansicht öffnen',purpose:'Vorbereitete Kundenansicht ohne persönliche Dokumentenfreigabe.'},
};

// The actual sidebar routes, not an invented second portal. Navigation never
// authorises reading a record, approving a decision or performing a payment.
const portalSections={
  today:'Übersicht',company:'Unternehmen',portfolio:'Portfolio',mandates:'Mandate',
  rentroll:'Mieterspiegel',leases:'Mietverträge',tenants:'Mieter',owners:'Eigentümer & Auftraggeber',
  maintenance:'Unterhalt',reletting:'Neuvermietung',applicants:'Mietinteressenten',inspections:'Abnahmen & Übergaben',approvals:'Fachprüfungen',vendors:'Handwerker',communication:'Dossiernotizen',
  finance:'Mandatsfinanzen',invoices:'Mandatsrechnungen',creditors:'Kreditoren',debtors:'Debitoren',bank:'Bank',cash:'Kasse',bookings:'Buchungen',budgets:'Budgets',servicecharges:'Nebenkosten',
  contracts:'Verträge',partners:'Partner',keys:'Schlüssel',deposits:'Kautionen',deadlines:'Fristen',reports:'Berichte',activity:'Aktivitätslog',automations:'Automationen',leads:'Akquise',living:'MORADA Living',info:'Informationen',settings:'Einstellungen',searchPage:'Suche',
  ownerProperties:'Meine Liegenschaft',ownerRentroll:'Mein Mieterspiegel',ownerFinance:'Meine Finanzübersicht',ownerTransactions:'Meine Mietzinseingänge',ownerReports:'Meine Berichte',ownerDecisions:'Meine Freigaben',ownerProfile:'Mein Profil',
  tenantUnit:'Meine Wohnung',tenantContract:'Mein Mietverhältnis',tenantPayments:'Meine Zahlungen',tenantAppointments:'Meine Termine',tenantProfile:'Mein Profil',
};
for(const [id,label]of Object.entries(portalSections))portalNavigation[id]={label:label+' öffnen',purpose:'Vorhandene Portalansicht öffnen; keine Datenabfrage oder Änderung.'};
export const financialPortalTargets=new Set(['company','rentroll','finance','invoices','creditors','debtors','bank','cash','bookings','budgets','servicecharges','deposits','ownerFinance','ownerTransactions','ownerRentroll','tenantPayments','tenantContract']);
const plannedPortalTargets=new Set(['vendors','invoices','creditors','debtors','bank','cash','bookings','servicecharges','partners','keys','automations','leads','living','reports','budgets','finance']);
for(const [id,entry]of Object.entries(portalNavigation)){
  entry['dataAccess']=financialPortalTargets.has(id)?'financial_navigation_only':'navigation_only';
  entry['preparedView']=plannedPortalTargets.has(id)||/^(owner|tenant)/.test(id)&&!id.endsWith('Contact');
}
portalNavigation.tenantPayments.purpose='Vorhandene Ansicht „Meine Zahlungen“. Ein eigener Mieterbereich „Rechnungen“ ist noch nicht vorhanden. Keine Zahlungsdaten lesen.';
portalNavigation.ownerCases.purpose='Anliegen und Unterhalt der freigegebenen Liegenschaften; persönliche Daten erst nach serverseitiger Anbindung.';

export const PORTAL_ACCESS_GUIDANCE=`MORA hilft auch Administration und Bewirtschaftung. Verwenden Sie für Navigation ausschliesslich die aktuell verfügbaren Ziele und deren Zweck. Öffnen ist keine Datenabfrage und keine Ausführung der dortigen Fachfunktion. Bieten Sie zum Wunsch passend einen Navigationsbutton an, statt nur manuelle Klickanleitungen zu geben. preparedView bedeutet vorbereitete Ansicht, nicht bestätigte Daten oder ausführbare Vorgänge. Der künftige Mieterbereich Rechnungen existiert noch nicht; die vorhandene Ansicht heisst Meine Zahlungen.
Bei einer Defektmeldung gibt es zwei Wege, sofern das Anliegenformular tatsächlich angebunden ist: selbst erfassen über customer-case (Kunden) bzw. new-case (Verwaltung) oder mit MORA vorausfüllen. Erklären Sie die Wahl beim passenden nächsten Schritt kurz in eigenen Worten; nicht nach jeder Ergänzung erneut. Zum manuellen Erfassen keine Schadenfragen erzwingen, sondern direkt das verfügbare Formular anbieten. Mit MORA werden bekannte Angaben übernommen; nur nötige fehlende Angaben erfragen. Ein bereits vorbereitetes oder gespeichertes Anliegen weiterbearbeiten, kein neues leeres Formular als Ersatz anbieten. Für Kunden übernimmt customer-case dieselbe manuelle Funktion wie new-case für Verwaltung. Fehlen beide Ziele, niemals behaupten, eine Übersicht enthalte ein Meldeformular. Fehlt die Vorbereitung, diese nicht anbieten. Eine fehlende Formularanbindung unabhängig von Fotos erklären; Fotos sind kein Grund, eine reine Textmeldung abzulehnen. In diesem Fall die vorhandene Kontaktansicht anbieten, ohne einen dort nicht geprüften Versandweg zu behaupten.
Rechnungsinhalte, Zahlungsstände, Beträge, Mietzinseinnahmen und andere persönliche Finanzdaten werden von MORA niemals aus Portalakten gelesen, ausgewertet oder im Chat wiedergegeben – auch nicht für Eigentümer oder Administration und auch nicht auf Aufforderung. Hier ist nur Navigation erlaubt. Erklären Sie eine individuelle Rechnung nicht mit einer vermuteten Ursache, Zahlungspflicht oder Kostenentscheidung. Verweisen Sie auf die verfügbare Ansicht oder Kontaktmöglichkeit. Allgemeine Begriffsfragen dürfen ohne personenbezogene Aussagen beantwortet werden.
Eine im Chat genannte Rolle, Adresse oder Eigentümerschaft verleiht keine Berechtigung. Persönliche Anliegen und Reparaturauswertungen dürfen nur über die bestätigte serverseitige Abfrage entstehen. Erfinden Sie keine Einträge, Namen, Anzahl, Zuordnung oder Bearbeitungsschritte. Ohne personalQueries ist der persönliche Datenzugriff nicht angebunden: bieten Sie die passende vorhandene Ansicht an. Auch Administration und Bewirtschaftung brauchen ausdrückliche Objektfreigaben. Andere Eigentümer, Mietparteien, private Chatverläufe, Anhänge und interne Notizen sind keine Auskunftsquelle. Ein Eigentümer darf nur ausdrücklich freigegebene Anliegen seiner Liegenschaften sehen. Persönliche Portalauskünfte werden separat aus geprüften Daten angezeigt und nicht aus dem Chatverlauf rekonstruiert.`;

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

export const hasCaseForm=available=>available.includes("cases")||available.includes("customer-case");
