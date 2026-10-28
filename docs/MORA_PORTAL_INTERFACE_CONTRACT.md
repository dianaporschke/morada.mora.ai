# MORA ↔ MORADA Portal: Zuständigkeit und Schnittstellen

**Aktualisierung 28. Oktober 2026:** Für die integrierte HTML-Version gilt der präzisierte [Navigations- und Zugriffsvertrag](MORA_PORTAL_ACCESS_2026_10_28.md). Rechnungen und persönliche Finanzdaten bleiben ausschliesslich Navigationsziele. Der ältere Vorschlag `getFinancialSummary` weiter unten ist damit aufgehoben und darf nicht an MORA angeschlossen werden.

Stand: 20. Oktober 2026. Dieser Vertrag beschreibt die MORA-Seite und die noch benötigten Portal-Schnittstellen. Er implementiert weder ein zweites Portal noch Anmeldung, Rollenverwaltung, Datenbank oder Service-Backend.

## Aktuell überprüfbarer Funktionsumfang

| Bereich | MORA heute | Benötigte Portal-Leistung von Alexander |
|---|---|---|
| Kundenkontext | Server-only Loader mit validiertem Vertrag vorbereitet; standardmässig `unavailable` | Authentifizierten Benutzer ermitteln, Mitgliedschaften und Objekt-/Einheitsrechte prüfen |
| Rollen | Eine Persönlichkeit; vertrauenswürdige Objektzuordnung kann `tenant`, `owner` oder beide enthalten | Rollen und Rechte aus eigener Quelle liefern; keine Chatbehauptungen übernehmen |
| Schäden | Mehrere lokale Entwürfe, strukturierte Fakten, Korrekturen, unbekannte Angaben | Autorisierte Speicherung und Vorgangsverwaltung |
| Übergabe | Bestehendes Serviceformular lokal vorbefüllen; noch nicht übermittelt | Idempotente Einreichung, Bestätigung mit Vorgangs-ID, Zeit und Status |
| Fotos | Metadaten im Chat; Bilddatei lokal im Browser, keine KI-Bildanalyse | Autorisierter Upload, Dateiprüfung, Zuordnung, serverseitige Speicherbestätigung |
| Dokumente | Vorhandene Ansicht öffnen; keine bestätigten Kundendokumente abrufen | Berechtigte Suche/Liste, Metadaten und sicherer Dokumentzugriff |
| Termine | Allgemeine Fragen beantworten; keine persönlichen Termine abrufen/buchen | Berechtigte Terminliste und Termindetails; Änderungen separat bestätigen |
| Vorgangsstatus | Keine bestätigten Bearbeitungsstände | Autorisierte Vorgänge nach ID, Statushistorie und Aktualisierungszeit |
| Eigentümer | Fragen beantworten, keine persönlichen Finanz-/Mieter-/Objektdaten | Getrennte objektbezogene APIs für Unterhalt, Mietverhältnisse, Liegenschaften, Finanzen |

## Vertrauenswürdiger Kontext, Version 1

`lib/mora/portal-context.js` validiert das Ergebnis eines ausschliesslich serverseitig eingebundenen `loadPortalContext(request)` Loaders. Der Chat-Request akzeptiert Nachricht, signierte Unterhaltung, Aktions-ID, Foto-Metadaten und die unten beschriebene lokale Entwurfsbestätigung. Rollen, Kundendaten und Berechtigungen im Request werden abgewiesen. Der signierte Chatkontext ist kein Ersatz für Portal-Authentifizierung.

```json
{
  "version": 1,
  "status": "verified",
  "properties": [
    {"id": "portal-property-id", "label": "Wohnung A", "unitId": "portal-unit-id", "roles": ["tenant", "owner"]}
  ],
  "selectedPropertyId": null
}
```

Dies ist ein synthetisches Vertragsbeispiel. Der Loader muss vor Rückgabe Identität und Objekt-/Einheitszugriff prüfen. IDs sind opaque Referenzen, kein durch das Modell wählbarer Datenbankpfad. Ein ausgewähltes Objekt muss zur geprüften Liste gehören. Mehrere Wohnungen und kombinierte Rollen dürfen eine Rückfrage auslösen; sie erzeugen keine andere KI-Persönlichkeit. Ein gültiger Kontext schaltet ausdrücklich keine Daten- oder Schreibfunktion frei. Bei fehlender Integration, falschem Vertrag oder Ausfall erhält das Modell `unavailable`; keine fremden Daten und keine Rechte werden ersatzweise aus dem Chat abgeleitet. Die Warnung enthält nur einen Fehlercode.

## Weitere API-Verträge: Anforderungen, noch nicht implementiert

| Vertrag | Erforderliche Eingabe | Erforderliche Ausgabe / Garantie |
|---|---|---|
| `getCapabilities` | Authentifizierter Portal-Request | Versionierte reale Fähigkeiten im aktuellen Objektkontext; standardmässig verweigern |
| `listDocuments`, `getDocument` | Geprüfter Kontext, Objekt/Einheit, Filter bzw. Dokument-ID | Nur berechtigte Metadaten und kurzlebiger Zugriff; `not_found` und `forbidden` ohne Datenleck |
| `listAppointments`, `getAppointment` | Geprüfter Kontext, Objekt, Zeitraum bzw. Termin-ID | Termin, Zeitzone, Status, Aktualisierungszeit; kein Buchungsauftrag |
| `listRequests`, `getRequestStatus` | Geprüfter Kontext, Objekt bzw. Vorgangs-ID | Bestätigte Vorgänge, Status und Zeitpunkt der letzten Aktualisierung |
| `submitRequest` | Geprüfter Kontext, Objekt, überprüfter Entwurf, Idempotenzschlüssel, ausdrückliche Einreichungsbestätigung | Wiederholungen erzeugen denselben Vorgang; echte ID und Eingangsbestätigung erst nach Speicherung |
| `uploadAttachment` | Geprüfter Kontext, erlaubte Datei und Entwurfs-/Vorgangsreferenz | Geprüfte Datei-ID und Speicherbestätigung; Limits und Inhaltsprüfung serverseitig |
| `getMaintenance`, `getProperty`, `getTenancies`, `getFinancialSummary` | Geprüfter Eigentümerzugriff pro Objekt, ggf. Zeitraum | Nur berechtigte Daten mit Währung, Zeitraum und Datenstand |

Die Bezeichnungen sind Adapterverträge, keine bereits verfügbaren HTTP-Endpunkte. Einheitliche maschinenlesbare Fehler: `unauthenticated`, `forbidden`, `not_found`, `ambiguous_property`, `integration_required`, `temporarily_unavailable`. Keine internen Fehlermeldungen oder Kundendaten in Logs. Ein fachlich bestätigtes Ergebnis muss eine Quelle, Objektzuordnung und Aktualisierungszeit tragen.

## Sichere Aktionen

MORA schlägt Aktionen als Daten vor. Server und Client behalten ihre bestehende Allowlist. Navigation öffnet ausschliesslich vorhandene Ansichten. Übergabe und Fotoaktionen bleiben lokal, bis ein geprüfter Adapter ausdrücklich integriert ist. Eine Meldung ist keine kostenpflichtige Beauftragung. Für eine solche Beauftragung braucht es später einen eigenen überprüften Vertrags- und Bestätigungsschritt; weder Modelltext noch ein allgemeiner Meldewunsch reichen aus.

Die bisherigen Portaldateien, Navigation, Anmeldung, Rollenoberflächen, Datenbanken und der Servicebereich werden für diesen Auftrag nicht umgebaut.

## Reliability Upgrade: versionierte Entwurfsgrenze

Die bestehenden Servicefelder werden von `assets/mora-data.js::mapServiceDraft` befüllt. Das ist MORA-spezifisches Mapping in die vorhandene Ansicht; kein neues allgemeines Serviceformular und kein Service-Backend. Gemeinsame Einrichtungscodes und Kategorien gelten auf Server und Client. Freie, kundengenannte Objekte bleiben erhalten; unbekannte Objekte bleiben unklassifiziert.

### Heutige lokale Bestätigung

`POST /api/chat` akzeptiert zusätzlich, exklusiv zu Nachricht/Aktion/Fotos:

```json
{
  "session": "aktuelle signierte Unterhaltung",
  "draftReceipt": {
    "issueId": "UUID aus dieser Unterhaltung",
    "revision": 3,
    "status": "portal_received"
  }
}
```

`status` erlaubt nur `portal_received` oder `error`; niemals `sent`. Der Server prüft Anliegen-ID und exakte Revision im signierten Zustand, ruft kein Modell auf und bestätigt keine Übermittlung. `issue.preparation` trägt `status`, `revision`, `source: client_local_storage` und `at`. Die Bestätigung ist ausschliesslich eine Clientmeldung über den lokal gespeicherten Entwurf im vorhandenen Servicebereich. Sie ist kein authentifizierter Backend-Beleg und keine neue Berechtigung. Ein manipuliertes Clientereignis kann keine echte Speicherung, Einreichung oder Rollenänderung bewirken. Server und Modell erhalten weiterhin `submitRequest: false`.

Anliegen besitzen eine Datenrevision. `null` in einem sparsamen Update bedeutet keine neue Angabe. Ausdrücklich unbekannte Werte haben `unknownFields` und `fieldFacts[field].status: unknown`. `fieldFacts` unterscheidet `known`, `unknown`, `not_provided`, `corrected`, `uncertain`; Unsicherheit enthält gegebenenfalls einen `candidate`, ohne den letzten bestätigten Wert zu ersetzen. Originalnachrichten bleiben im begrenzten Antwortaudit; Feldzustände und Revision gehören zum signierten Gespräch. Der Browser speichert eine `sourceRevision` und einen `sourceContent`-Vergleich. Dieselbe Version erzeugt keinen weiteren Entwurf; Korrekturen aktualisieren denselben Schlüssel `issue.id`. Lokale Formulareingaben bleiben erhalten und widersprechende Chatwerte erscheinen als Konflikt.

### Von Alexander später benötigter Adapter

Vorgeschlagener Vertrag, noch keine implementierte Portal-API:

```ts
createOrUpdateDraft({
  customerContext, // ausschliesslich serverseitig authentifiziert
  issueId,        // stabile MORA-Anliegen-ID
  revision,       // monotoner Datenstand
  expectedPortalVersion, // null beim Anlegen; verhindert verlorene Änderungen
  idempotencyKey, // customerScope + issueId + revision
  fields: {
    category, equipment, description, defect, count, location, since,
    extent, details, cause, urgency, hazard, unknownFields, fieldFacts
  },
  attachmentReferences // nur geprüfte Portal-Datei-IDs, keine lokalen Blob-URLs
}) => {
  accepted: true,
  draftId, issueId, sourceRevision, portalVersion,
  storedAt, status: 'draft'
}
```

Garantien: Der Server prüft Identität, Objekt-/Einheitsrechte, erlaubte Einrichtungscodes und Felder. Derselbe Idempotenzschlüssel liefert denselben Entwurf und dieselbe bestätigte Version. Derselbe `issueId` mit neuer Revision aktualisiert denselben Entwurf. Ältere oder konkurrierende Versionen ergeben `409 version_conflict` mit aktueller Portalversion, ohne stilles Überschreiben. Fehler liefern `{accepted:false, code, retryable}`; zulässige Codes sind `integration_required`, `unauthenticated`, `forbidden`, `validation_failed`, `version_conflict`, `temporarily_unavailable`.

Eine separate, ausdrücklich bestätigte Einreichung bleibt `submitRequest({customerContext, draftId, expectedPortalVersion, idempotencyKey, consent})`. Erst ein erfolgreicher, autorisierter Backend-Beleg `{accepted:true, requestId, receivedAt, status:'received'}` darf zu „an MORADA gesendet“ führen. Der bestehende, standardmässig deaktivierte `/api/requests`-Adapter bleibt erhalten. Der MORA-Vorbereitungsbutton führt niemals automatisch eine Einreichung aus. Persönliche Dokumente, Termine und Statusabfragen benötigen weiterhin die oben beschriebenen separaten Adapter.
