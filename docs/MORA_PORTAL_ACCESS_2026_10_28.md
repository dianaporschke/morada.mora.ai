# MORA: Portalnavigation und begrenzte persönliche Auskünfte

Stand: 28. Oktober 2026. Branch: `codex/mora-ai-2.0`.

## Umgesetzt

- MORA kennt alle vorhandenen Sidebar-Ziele von Administration, Bewirtschaftung, Eigentümern und Mietern sowie Suche, interne Dossiernotizen und die bereits angebundenen drei Erfassungsformulare.
- Die Bridge ermittelt verfügbare Ziele aus den bestehenden `roleGroups()` und `allowed()`. Navigation benutzt weiterhin `go()` beziehungsweise `newEntry()`. Ein Klick gewährt keine Leseberechtigung und führt keine Buchung, Zahlung oder Freigabe aus.
- Rechnungen, Mietzinseingänge und weitere Finanzansichten sind reine Navigationsziele. Es gibt keine Finanz-, Rechnungs- oder Dokumenten-Lesefunktion für MORA. Im Mieterteil existiert derzeit `tenantPayments` („Meine Zahlungen“), kein `tenantInvoices`.
- Vorbereitete/leere Ansichten sind im Modellkontext gekennzeichnet. MORA darf dort keine Datensätze oder ausführbaren Vorgänge unterstellen.
- Die kompakte Modellentscheidung kann einen typisierten Abruf `case-status` oder `repair-counts` auswählen. Dieser läuft danach über die serverseitige Zugriffsschicht. Ergebnisse gehen direkt an eine kurzlebige Anzeige, niemals an ein weiteres Sprachmodell.
- Anliegenvorbereitung, Zuordnung, Fotos, lokale Speicherung und Erfolgsbelege bleiben erhalten. Das native Portal ausserhalb des bestehenden MORA-Blocks bleibt unverändert; der Quellen-Hash-Test bestätigt dies.

## Noch nicht live angeschlossen

Die HTML-Datei besitzt weiterhin keine echte Kundenanmeldung, Objektfreigaben oder mandantenfähige Backend-Datenquelle. Die Rollenwahl ist eine **Preview-Ansicht, keine Authentifizierung**. `portalServerAdapter` ist deshalb absichtlich `undefined`. Persönliche Auskünfte sind in der Preview gesperrt; MORA kann die passende vorhandene Ansicht anbieten.

Dies ist kein vollständig abgesichertes produktives Mehrbenutzerportal. Eine lokale Rolle, Browsernavigation oder signierte Chat-Historie ersetzt keine Portalidentität. Keine Benutzerverwaltung, Portal-Datenbank oder allgemeinen Formulare wurden neu entwickelt. Die API bleibt in Produktion deaktiviert.

## Anschlussvertrag für Alexander

Implementierungsort: `lib/mora/portal/access.js`, Export `portalServerAdapter`. Alternativ erhält `createPortalChatHandler({portalAdapter})` denselben Adapter serverseitig. Keine URL oder Zugangsdaten im HTML hinterlegen.

### `loadAccess(request, {signal})`

Authentifiziert den echten HTTP-Request mit der vorhandenen Portal-Sitzung. Origin/CSRF entsprechend dem Portal-Authentifizierungsverfahren prüfen. Rollen, Benutzer-IDs, Freigaben und Mandate niemals aus Request-Body, localStorage oder Chat übernehmen. Rückgabe:

```ts
{
  version: 1,
  subjectId: string,
  organisationId: string,
  authorizationVersion: string,
  role: 'tenant' | 'owner' | 'manager' | 'admin',
  expiresAt: number, // Unix-Millisekunden
  navigation: string[], // erlaubte IDs aus mora-portal-map.js
  scopes: Array<{
    propertyId: string,
    propertyLabel: string, // freigegebene Adresse/Bezeichnung
    caseIds: string[] | null,
    queries: Array<'case-status' | 'repair-counts'>,
    reporterNames: boolean
  }>
}
```

`caseIds: null` bedeutet eine ausdrückliche Freigabe aller öffentlichen Anliegenstände dieser Liegenschaft, nicht aller Akten. Mieter benötigen explizite Anliegen-IDs und erhalten keinen Liegenschaftsvergleich. Auch Eigentümer, Administration und Bewirtschaftung benötigen ausdrückliche Objektfreigaben. Meldernamen benötigen zusätzlich `reporterNames: true`.

`authorizationVersion` muss bei Rechtewechseln wechseln. MORA bindet Sitzungen zusätzlich an Benutzer, Organisation, Rolle, Navigation und Objektfreigaben. Ein anderer Benutzer derselben Rolle oder eine entzogene Freigabe bekommt keine alte Sitzung zurück. Ablauf, fehlerhafte Daten und Backend-Ausfälle sperren den Zugriff. Bei einem konfigurierten Adapter gibt es bei Ausfällen keinen Rückfall auf Preview-Berechtigungen.

### `readCases(request, options)`

`options` enthält `subjectId`, `organisationId`, `authorizationVersion`, die für diese Anfrage zugelassenen `scopes`, `query` und `signal`.

Der Portalserver muss Benutzer-/Organisations-/Liegenschafts-/Anliegenfilter bereits in der Datenbankabfrage anwenden. Zusätzlich je Anliegen prüfen, welche Statusinformationen an Eigentümer oder Mieter freigegeben sind. Nur diese projizierten Felder liefern, keine vollständigen Akten:

```ts
{
  complete: true,
  asOf: string, // tatsächlicher ISO-8601-Datenstand
  records: Array<{
    id: string,
    propertyId: string,
    publicStatus: true,
    kind: 'repair' | 'other',
    equipment: 'light' | 'socket' | 'heater' | 'water' |
               'door' | 'window' | 'appliance' | 'other',
    status: 'received' | 'in_progress' | 'contractor_contacted' |
            'appointment_agreed' | 'completed' | 'cancelled',
    updatedAt: string, // ISO-8601
    appointmentAt?: string | null, // nur tatsächlich vereinbarte Termine
    reporterLabel?: string // nur bei zusätzlicher ausdrücklicher Freigabe
  }>
}
```

Statuswerte müssen aus tatsächlichen Portalereignissen stammen: „Handwerker kontaktiert“ ist nicht „Termin vereinbart“. Ein lokaler Entwurf ist keine empfangene Kundenanfrage.

MORA prüft Freigaben nach dem Datenabruf erneut, verwirft fremde oder doppelte Datensätze vollständig und zeigt keine Teilantwort bei Ausfällen. `complete: false`, fehlende Seiten oder mehr als 2'000 Datensätze werden abgewiesen. Maximal 100 Objektfreigaben und 2'000 explizite Anliegen-IDs je Freigabe. Jeder Adapteraufruf ist auf fünf Sekunden begrenzt.

`repair-counts` zählt ausschliesslich freigegebene Reparaturanliegen mit Status `received`, `in_progress`, `contractor_contacted` oder `appointment_agreed`. Geschlossene/stornierte und andere Anliegen zählen nicht. Ausgabe einschliesslich Nullwerten, absteigend nach offenen Fällen; Gleichstände bleiben sichtbar. Dies ist keine Bewertung des Immobilienzustands. Keine finanziellen Auswertungen.

### Zugriffswechsel im Portal-Frontend

Beim Login, Logout, Kontowechsel oder Wechsel relevanter Objektfreigaben muss der echte Portalclient auslösen:

```js
window.dispatchEvent(new Event('mora:access-changed'));
```

MORA entfernt alle MORA-Chat-Caches dieses Tabs, verwirft laufende Antworten für den früheren Zugang und schliesst die Ansicht. Die serverseitige Sitzungsbindung bleibt unabhängig davon aktiv. Die Preview-Rollenumschaltung schliesst ebenfalls die vorige Ansicht.

Persönliche Ergebnisfelder werden weder in `sessionStorage` noch im signierten, lesbaren Chat-Token oder im Modellverlauf abgelegt. Sie verschwinden beim Schliessen, vor der nächsten Nachricht und beim Zugriffswechsel. Ein erneuter Abruf prüft erneut. Kunden selbst geschriebene Texte bleiben wie bisher Gesprächsdaten; daraus entsteht keine Portal-Leseberechtigung.

### Künftige Mieter-Rechnungen

Sobald die Seite existiert, ihre Route im zentralen Katalog ergänzen, in der nativen Navigation und der serverseitigen Zielfreigabe bereitstellen. `dataAccess` muss `financial_navigation_only` bleiben. Keine `getFinancialSummary`- oder Rechnungs-Lesefunktion implementieren. Diese Vorgabe ersetzt den älteren Vorschlag in `MORA_PORTAL_INTERFACE_CONTRACT.md`.

## Verifikation und Grenzen

- 441 automatisierte Tests bestanden, einschliesslich 21 neuen Prüfungen für Navigation, Zugriffsgrenzen, vollständige Auswertungen, Kontowechsel, Widerruf während des Abrufs und Entfernung persönlicher Ergebnisse.
- Typecheck und Build bestanden. Bestehende Anliegen-, Foto-, Korrektur-, Speicher- und Fensterregressionen bleiben grün.
- Browserprüfung mit gekennzeichneten lokalen UI-Testdaten: Laptop 1180 × 720 und Smartphone 390 × 844; tatsächliche Navigation zu `ownerFinance` und `tenantPayments`, erreichbarer MORA-Startbutton, kein horizontaler Chat-Überlauf. Desktop 1440 × 900: Ergebnisdarstellung; Schliessen/Ergebnisbereinigung zusätzlich in vollständig sichtbarer Laptop-Ansicht geprüft.
- Testkarte zeigt getrennt „Handwerker kontaktiert“ und „Termin vereinbart“; Schliessen entfernt sie. Diese Testdaten beweisen keine produktive Kundenanbindung.
- Keine kostenpflichtige KI-Anfrage für diese Änderung. Modell, Schlüssel, Gateway und Budgetgrenzen unverändert. Erweiterte Navigationsinformationen vergrössern den Eingabekontext; reale Auswirkungen auf Kosten und Latenz wurden nicht gemessen. Keine zusätzliche KI-Formulierungsstufe.
- Tests mit vorgegebenen Modelltransporten prüfen Verarbeitung, nicht die natürliche Auswahlqualität des Live-Modells. Diese Prompt-/Navigationskombination wurde noch nicht mit bezahlten Modellgesprächen bewertet.
- Kein generischer Zugriff auf Rechnungen, Dokumente, private Chats, Anhänge oder interne Notizen; kein Versand, keine Beauftragung, Zahlung oder tatsächliche Terminbuchung durch MORA.

## Geänderte Bereiche

| Dateien | Änderung |
| --- | --- |
| `assets/mora-portal-map.js` | Zentrale Ziele und gemeinsame Zugriffsanleitung |
| `scripts/portal-integration/bridge.js` | Echte Navigation pro Ansicht |
| `lib/mora/portal/access.js` | Serveradapter und standardmässig gesperrte Datenabfragen |
| `api/portal-chat.js` | Autorisierung, Sitzungsbindung, getrennte persönliche Ergebnisse |
| `lib/mora/portal/{agent,compact-agent,service}.js` | Gemeinsame Fähigkeiten und strukturierte Abfrageentscheidung |
| `assets/mora-portal-client.js` | Kurzlebige Ergebnisanzeige und Zugriffswechsel |
| `portal.html` | Neu erzeugter MORA-Block; natives Portal unverändert |
| `tests/portal-{access,integration,ui}.test.js` | Sicherheits-/Navigations-/UI-Regressionen |
| `scripts/ui-redesign/{fixtures.js,preview.mjs}` | Gekennzeichnete lokale QA-Szenarien, nicht ausgeliefert |

Screenshots: `docs/evidence/mora-access-owner-desktop.jpg`, `docs/evidence/mora-access-tenant-mobile.jpg`. Beide zeigen ausschliesslich lokale UI-Testdaten.
