# MORADA MORA 2.0 · Phase 1

Bestehendes Portal: https://morada-portal.vercel.app/
Repository: `dianaporschke/morada.mora.ai` · Vercel-Projekt: `morada-mora-ai`.

MORA versteht Anliegen, stellt jeweils eine Rückfrage, sammelt strukturierte Angaben und bietet passende Aktionen an. Die bestehende Portalnavigation, dunkle Chatoberfläche und die aktuellen v3-App-Icons bleiben erhalten.

**Verifizierter Betriebsstand, 7. Oktober 2026:** Die geführte Erfassung und die Actions laufen auf Vercel. Die echte semantische KI-Auswertung ist noch extern gesperrt: AI Gateway antwortet mit `403 customer_verification_required`; der vorhandene direkte OpenAI-Zugang lieferte `429`. Der Team-Inhaber muss die Kundenverifizierung bzw. Zahlungsmethode im AI-Gateway-Bereich des Vercel-Kontos abschliessen. Es wurden keine Credits gekauft oder Zahlungsdaten verändert. Ein erfolgreicher echter Modellaufruf und die anschliessenden semantischen Live-Tests stehen deshalb noch aus. Account-Hinweise: https://vercel.com/docs/ai-gateway/pricing

## Laufzeit und Konfiguration

Node.js 24, JavaScript ES Modules, AI SDK 7, Zod. Keine Frameworkmigration.

- Auf Vercel nutzt MORA AI Gateway mit dem deploymentgebundenen OIDC-Token; OIDC ist für dieses Projekt aktiviert. Der Token wird über den offiziellen SDK-Helper aus dem Request-Kontext oder der Laufzeitumgebung gelesen. Kein API-Key gelangt in den Client.
- `AI_GATEWAY_MODEL`: optional; Standard `openai/gpt-6-luna`, im vollständigen aktuellen Gateway-Katalog auf strukturierte Ausgabe und V4-Unterstützung geprüft. Katalog: https://ai-gateway.vercel.sh/v1/models
- `AI_GATEWAY_API_KEY`: optional für lokale Development-/Testumgebungen ohne Vercel OIDC.
- `OPENAI_API_KEY` und optional `OPENAI_MODEL`: bestehender alternativer direkter Zugang für Umgebungen ohne Gateway-Authentifizierung; Standard `gpt-5.4-mini`. Referenz: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- `MORA_SESSION_SECRET`: optionaler separater Signaturschlüssel. Ohne ihn wird der vorhandene serverseitige API-Key verwendet. Rotation macht bestehende Chats ungültig, lokal gespeicherte Entwürfe bleiben erhalten.

Die produktiven Secrets bleiben in Vercel. Für lokale Entwicklung nur eigene Development-Secrets verwenden. Ohne Provider-Konfiguration oder bei Modellfehlern funktioniert eine begrenzte, kontextfähige geführte Erfassung. Ein Modellfehler wird nur mit Anbieter, Statuscode und bereinigtem Fehlercode protokolliert, ohne Kundentexte oder Secrets. Bei 401/403/429 setzt dieselbe Funktionsinstanz weitere Modellaufrufe für 60 Sekunden aus und versucht es danach automatisch erneut. Bestätigte unmittelbare Gefahren und Auswahlaktionen benötigen keinen Modellaufruf.

## Architektur

| Datei | Aufgabe |
| --- | --- |
| `api/chat.js` | Validierter POST-Endpunkt; antwortet mit `version`, `reply`, `actions`, `issue`, `session`, `capabilities`, `understanding` |
| `lib/mora/understanding.js` | Semantische Extraktion über AI SDK `generateText` / `Output.object`, Historie und offener Frage; geführte Ausfalllogik |
| `lib/mora/engine.js` | Gesprächszustand, genau eine nächste Frage, Zusammenfassung und Action-Registry |
| `lib/mora/safety.js` | Zusätzliche unmittelbare Gefahrenprüfung und kurze Sicherheitshinweise |
| `lib/mora/schema.js` | Verträge für Nutzereingaben, Modellantworten und Foto-Metadaten |
| `lib/mora/session.js` | HMAC-signierter Zustand mit 12 Stunden Gültigkeit; keine serverseitige In-Memory-Kundensitzung |
| `assets/mora-client.js` | Wiederverwendbare Actions, Kontextversand, Wiederholungs-/Offlinebehandlung, Fotos und Serviceentwürfe |
| `assets/mora.css` | Ausschliesslich ergänzte MORA- und Entwurf-Styles, responsive Touch-Ziele und Tastaturhöhe |
| `lib/portal/adapter.js` | Explizite Fähigkeiten und austauschbare Schnittstelle für echte Portal-Daten |
| `api/requests.js` | Vorbereiteter Übermittlungsvertrag; liefert derzeit ehrlich `503 integration_required` statt einer Empfangsbestätigung |

Der Client sendet nur Nachricht oder `actionId`, Foto-Metadaten und den signierten Sitzungszustand. Freie Systemnachrichten oder vom Client gefälschte Vorgangsdaten werden nicht akzeptiert. Actions stammen aus der kontrollierten Engine, niemals aus frei generierten Modell-URLs. Navigation ist auf bestehende Portalbereiche begrenzt. Telefon-Actions erlauben ausschliesslich 112. Alle Texte werden mit `textContent` dargestellt.

Actions besitzen `{ id, type, label, variant, ...payload }`. Typen: `select`, `handover`, `attachment`, `add_details`, `continue`, `navigate`, `call`. Eine neue Action wird in der Engine bereitgestellt und einem wiederverwendbaren Handler zugeordnet; einzelne Antwortsätze benötigen keine eigene UI.

Vorgänge enthalten Kategorie, Unterkategorie, ursprüngliche Beschreibung, Bereich, Zeitpunkt, Umfang, Zusatzangaben, Dringlichkeit, Gefahrenart, Fotos, Kundenantworten und Zusammenfassung. Für Modellein- und -ausgaben gelten feste Grenzen: 2'000 Zeichen pro Nachricht, 24 letzte Historieneinträge, 30 letzte qualifizierende Antworten. Die vollständige angezeigte Unterhaltung bleibt im aktuellen Browser-Tab erhalten. Relative Zeiten werden wörtlich übernommen, keine erfundenen Uhrzeiten oder Adressen.

## Anliegenübergabe und ehrliche Grenzen

Dieses Portal besitzt weiterhin nur den bisherigen Demo-Zugang, keine echte Kundenanmeldung, Datenbank, Bearbeitungsoberfläche oder Versandverbindung. MORA liest daher keine Demo-Kennzahlen als echte Kundendaten und erfindet keine Dokumente, Termine oder Bearbeitungsstände.

„An MORADA melden“ übernimmt alle gesammelten Angaben in einen vorausgefüllten **lokalen Anliegenentwurf im Servicebereich**. Dort sind Beschreibung, Bereich, Zeitpunkt und Zusatzangaben editierbar. Status: **Noch nicht übermittelt**. Entwürfe werden im Browser gespeichert und können als JSON einschließlich Fotos heruntergeladen werden. Bei deaktiviertem Browserspeicher weist die Oberfläche auf den nötigen Download hin.

Fotos: maximal 6 Bilder, jeweils bis 10 MB; JPG, PNG, WebP, HEIC/HEIF. Dateiinhalte verbleiben im Browser (IndexedDB); an MORA gehen nur Metadaten. Es findet noch kein Foto-Upload und keine Bilddiagnose statt. HEIC-Dateien können ohne Vorschau aufbewahrt und exportiert werden. Entwürfe sind geräte-/browsergebunden und werden nicht zwischen Geräten synchronisiert.

Bei akuten Gefahren steht die Sicherheit vor der Vorgangserfassung. Der Chat ist kein Notrufkanal. Verifizierte Notrufnummern: https://www.ag.ch/de/themen/sicherheit/bevoelkerungsschutz/verhaltensempfehlungen

## Vorbereitete Phase-2-Schnittstellen

`portalCapabilities` unterscheidet Kundenkontext, Dokumente, Termine, Vorgänge, Übermittlung und Datei-Uploads. Diese Fähigkeiten sind erst zu aktivieren, wenn sie wirklich angebunden sind.

`submitRequest({ draft, idempotencyKey, customerContext })` ist die Grenze zur internen MORADA-Bearbeitung. Die spätere Implementation muss den angemeldeten Kunden und dessen Einheiten prüfen, Entwürfe dauerhaft speichern, lokale Änderungen mit dem signierten Vorgang abgleichen, Fotos hochladen und Idempotenz garantieren. Nur ein bestätigter Rückgabewert `{ accepted: true, requestId }` darf eine Empfangsbestätigung auslösen. Fehler/Timeouts behalten den Entwurf, ohne einen angeblich gesendeten Vorgang zu erzeugen.

Weitere Adapter können danach tenant-geprüfte Kunden-/Einheitenkontexte, Dokumente/Mietverträge, Termine, Vorgangsstatus, Nachrichten und Benachrichtigungen bereitstellen. Aktuell werden diese zukünftigen Funktionen bewusst nicht als echte Daten simuliert.

## Prüfen und Bereitstellen

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Der Build kopiert ausschliesslich öffentliche Portaldateien nach `dist/`; die Vercel-Funktionen bleiben in `api/`. Serverquellen, Tests, Secrets und Abhängigkeiten werden nicht als statische Portaldateien veröffentlicht.

Automatische Prüfungen decken alle beauftragten Beispieltexte, Tippfehler, Kontext, Auswahlaktionen, Gefahrenerkennung, unbekannte Eingaben, manipulierte Zustände, Fotoablage, Offlinefehler und vollständige Übergabe in vorausgefüllte Entwürfe ab. Die KI-Schemaanbindung wird mit dem versionsgleichen SDK-Testprovider geprüft. DOM-Flows werden für Desktop- und Mobil-Konfigurationen geprüft; das ersetzt keine echte visuelle Prüfung in Safari/PWA.
