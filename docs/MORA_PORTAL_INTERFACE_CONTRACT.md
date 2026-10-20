# MORA ↔ MORADA Portal: Zuständigkeit und Schnittstellen

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

`lib/mora/portal-context.js` validiert das Ergebnis eines ausschliesslich serverseitig eingebundenen `loadPortalContext(request)` Loaders. Der Chat-Request akzeptiert weiterhin nur Nachricht, signierte Unterhaltung, Aktions-ID und Foto-Metadaten. Rollen, Kundendaten und Berechtigungen im Request werden abgewiesen. Der signierte Chatkontext ist kein Ersatz für Portal-Authentifizierung.

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
