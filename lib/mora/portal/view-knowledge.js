import {portalNavigation} from '../../../assets/mora-portal-map.js';

// Verified against the supplied HTML's customerTables, tenantContract and
// render() functions. This describes implementation, never a customer's data.
const customerTables=new Set(['ownerRentroll','ownerTransactions','ownerDecisions','ownerCases','ownerDocuments','tenantPayments','tenantSupport','tenantAppointments','tenantDocuments']);
const details={
  tenantContract:'Übersicht für Vertragsdaten, Miete und Akonto. Derzeit ohne Vertragsdatenanbindung; kein Mietvertrags-PDF und kein Download vorhanden.',
  tenantPayments:'Vorbereitete Tabelle für Zahlungsverlauf. Keine Nebenkostenabrechnungen, Rechnungsdateien oder Downloads angebunden. Nicht behaupten, eine Abrechnung sei hier zu finden.',
  tenantDocuments:'Vorbereitete Dokumententabelle ohne angebundene persönliche Dateien oder Downloads. Eine leere Ansicht beweist weder fehlende Unterlagen bei MORADA noch eine falsche Kundenzuordnung.',
  ownerDocuments:'Vorbereitete Dokumententabelle ohne angebundene persönliche Dateien oder Downloads.',
  tenantSupport:'Vorbereitete Anliegentabelle ohne persönliche Meldungen oder Statusanbindung. Keine Erstellung, Bearbeitung oder nachträgliche Fotoanhänge in dieser Ansicht implementiert.',
  ownerCases:'Vorbereitete Anliegentabelle ohne persönliche Meldungen oder Statusanbindung. Keine Erstellung, Bearbeitung oder nachträgliche Fotoanhänge in dieser Ansicht implementiert.',
};

export function navigationKnowledge(available){
  return [...new Set(available)].filter(id=>Object.hasOwn(portalNavigation,id)).map(id=>({id,...portalNavigation[id],
    ...(customerTables.has(id)?{implementation:'empty_preview_table',recordConnection:false,viewActions:['open'],recordContents:'unknown'}:{}),
    ...(id==='tenantContract'?{implementation:'unconnected_contract_overview',recordConnection:false,viewActions:['open'],recordContents:'unknown'}:{}),
    ...(details[id]?{purpose:details[id]}:{}),
    ...(['tenantSupport','ownerCases'].includes(id)&&available.includes('customer-case')?{implementation:'local_customer_cases',recordConnection:false,viewActions:['open','create_local_draft','review_local_draft','attach_local_file'],purpose:'Lokale Entwürfe dieser Browsersitzung im bestehenden Portal erstellen, prüfen und ergänzen. Manuell über customer-case oder mit MORA. Keine übermittelten Meldungen oder persönlichen Akten angeschlossen.'}:{}),
  }));
}

export const VIEW_KNOWLEDGE_GUIDANCE=`Portalwissen: Die Navigationsziele beschreiben geprüfte Funktionen dieser HTML-Version, keine persönlichen Datensätze. Bei implementation=empty_preview_table oder unconnected_contract_overview ist die Ansicht vorbereitet, aber ohne persönliche Datenanbindung. Behaupten Sie dort weder auffindbare Verträge/Abrechnungen noch vorhandene Meldungen oder Bearbeitungsstände. Ein Seitenname ist kein Beleg dafür. Fehlender MORA-Lesezugriff, eine nicht implementierte Portalfunktion und unbekannter persönlicher Inhalt sind unterschiedliche Dinge. Bei einer nicht implementierten Fotofunktion sagen Sie das eindeutig; nicht anschliessend empfehlen, dort nach dieser Funktion zu suchen. Bei einer leeren vorbereiteten Ansicht erklären Sie die fehlende Anbindung, ohne daraus fehlende Unterlagen bei MORADA abzuleiten. Bei Bedarf die verfügbare Kontaktansicht anbieten. Unbekannte Funktionen anderer Ansichten bleiben unbekannt. Navigation wird als Button angeboten und erst durch den Kunden ausgeführt. Vor dessen Klick nicht behaupten, die Ansicht werde oder sei bereits geöffnet; auf den angebotenen Button verweisen. Bei einer einfachen Navigationsfrage direkt zum passenden verfügbaren Ziel führen; technische Zugriffsbeschränkungen nur erläutern, wenn sie die Antwort tatsächlich einschränken. Auskünfte aus separat autorisierten Serverabfragen bleiben ausschliesslich deren geprüften Ergebnissen vorbehalten.`;
