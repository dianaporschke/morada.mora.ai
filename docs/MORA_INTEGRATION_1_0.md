# MORA Integration 1.0 · Prüfbericht vom 22. Oktober 2026

Die Integration arbeitet direkt auf der bereitgestellten eigenständigen HTML-Datei. Der Kernablauf mit echten Mercury-Antworten und tatsächlicher lokaler Portalspeicherung ist nachgewiesen. Die Gesprächsqualität hat weiterhin deutliche Schwächen. Eine abgeschlossene Qualitätsfreigabe oder eine erfolgreiche Prüfung auf echten Desktop- und Mobilbrowsern wird nicht behauptet.

## Ausgangslage und Grenzen

Arbeitsgrundlage: `22.10.26_MORADA_Portal_Alexander(1).html`, ursprünglich 4.491.282 Bytes. Die Datei enthält 1.073 benannte Funktionen, 34 Style-Blöcke und einen klassischen Anwendungsscriptblock. Sie verwendet keine externen Scripts und hatte keine `fetch`-Anbindung. Bilder und Schriften sind eingebettet. Die vorhandenen Funktionsgruppen umfassen Portfolio, Liegenschaften, Einheiten, Kontakte, Mandate, Mietverträge, Mieterspiegel, Anliegen, Unterhalt, Aufgaben, Kalender, Neuvermietung, Interessenten, Übergaben, Dossiernotizen und Fachprüfungen. Weitere Bereiche kennzeichnet die Anwendung selbst als geplant.

Die Speicherung läuft über den bestehenden revisionsgeschützten `save`-Pfad: Web Locks, lokaler Versionsvergleich und `localStorage`; grössere Datenstände liegen in IndexedDB. Es gibt keine gemeinsame serverseitige Portal-Datenbank. Die vorhandene Bereichsauswahl ist keine persönliche Anmeldung oder bestätigte Kundenberechtigung.

Der frühere `showMora()` öffnete lediglich einen Dialog mit Links. Er enthielt weder KI-Chat noch Gesprächszustand. Die Integration ergänzt einen Chat und ersetzt diesen Einstieg zur Laufzeit. Die ursprünglichen Style-Blöcke und Geschäftsfunktionen bleiben erhalten. Der Vergleich der ursprünglichen Textquelle mit der Quelle ohne Integrationsblock unterscheidet sich nur durch Leerzeilen. `portal.html` ist die identische, reproduzierbare Bereitstellungsquelle der bearbeiteten Datei, kein separat weiterentwickeltes Portal.

Alle Repository-Änderungen betreffen `codex/mora-ai-2.0`. Ausgangsstand: `8cc7d98662309200742608616a06f2b17e282e1b`. Vor dem Schreiben geprüft: `main` = `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` = `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Kein Merge, keine Produktion und keine Änderungen an Alexanders Entwicklung.

## Tatsächlich angebundene Funktionen

| Funktion | Tatsächliches Verhalten |
|---|---|
| MORA öffnen | Bestehender schwebender Button und Hilfe-Einstieg öffnen den Chat im vorhandenen Design. |
| KI-Gespräch | Same-Origin-POST an `/api/portal-chat`, bestehender geschützter Vercel-Backendpfad, AI Gateway und unverändert `inception/mercury-2.5`. Kein Schlüssel im HTML. |
| Anliegen speichern | Kundenklick → signiertes Schreibticket → bestehende Portalvalidierung und `companyCommit`/`save` → Lesen des tatsächlich gespeicherten Datenstands → Feldvergleich → Gesprächsbestätigung. |
| Anliegen ergänzen | Dieselbe Anliegen-ID wird aktualisiert. Zuständigkeit, Zuordnung, Bearbeitungsstand, Dateien und andere manuelle Prozessangaben bleiben erhalten. Manuelle Änderungen an von MORA verwalteten Textfeldern werden nicht überschrieben. |
| Anliegen ansehen | Öffnet das tatsächliche Anliegen über `caseDetail`. |
| Navigation | Öffnet vorhandene und in der aktuellen Ansicht erlaubte Register. Ziel, Beschriftung und fachliche Bedeutung stehen zentral in `mora-portal-map.js`. |
| Formulare öffnen | Vorhandene Aufgaben-, Termin- und Dokumentenformulare. Das Öffnen erstellt, bucht oder versendet nichts. Diese weiteren Datensätze werden nicht automatisch von MORA ausgefüllt oder gespeichert. |
| Vorbereitete Kundenansichten | Navigation entsprechend der schon vorhandenen Bereichsauswahl. Keine neue Rolle, Kontozuordnung oder Berechtigung wird erfunden. Direkte MORA-Speicherung ist auf die vorhandenen schreibbaren Teamansichten begrenzt. |
| Sicherheitshinweis | Vorhandener begrenzter Gefahrendetektor gibt im Chat einen getrennt gekennzeichneten Sicherheitshinweis, auch wenn das Modell nicht verfügbar ist. Keine vollständige Gefahrenerkennung wird behauptet. |

## Datenmapping

Die zentrale Grenze ist `assets/mora-portal-map.js`. Das bestehende Portal besitzt andere Felder als die alte MORA-Test-App. Insbesondere gibt es keine separaten Geräte-, Anzahl- und Beginnfelder und keinen Anliegenstatus «Entwurf».

| Gesprächsdaten | Vorhandenes Portalfeld |
|---|---|
| Einrichtung und Raum | `title`, z. B. «Lampe / Leuchte · Wohnzimmer» |
| Raum | `unit` als bestehende Freitext-Zusatzangabe; kein erfundenes `unitId` |
| Fachliche Kategorie | Vorhandene grobe `caseInfo.category`, z. B. «Schaden / Reparatur». Der genaue Fachbereich «Elektrik / Beleuchtung» steht zusätzlich in `description`. Unklare Zuordnungen bleiben «Noch nicht zugeordnet». |
| Defekt, Anzahl, Beginn, Umfang, Symptome, Ursache | Lesbar und ohne Erfindungen in `description`; Unsicherheit und ausdrücklich unbekannter Beginn werden entsprechend gekennzeichnet. |
| Kundenaussagen | Exakte Belege im vorhandenen Änderungsverlauf. Frühere Belege sind ausdrücklich als möglicherweise korrigiert gekennzeichnet und überschreiben keine aktuellen Werte. |
| Speicherstand | Bestehender Anliegenstatus «Neu», bestehende Referenznummer und Änderungsverlauf. Das ist ein lokal gespeicherter Portaleintrag, keine serverseitige Einreichung. |

Die bestehenden MORA-Reducer führen getrennte Anliegen zusammen und erhalten `known`, `unknown`, `not_provided`, `corrected` und `uncertain` im Gesprächszustand. Der neue Rohtextverlauf behält auch Kundennachrichten aus fehlgeschlagenen KI-Runden. Diese bleiben unbestätigte Belege und werden nicht automatisch zu gültigen Fakten. Eine spätere Runde erhält die noch unbeantworteten Texte erneut als Kontext.

## Aktionen und Wahrheitsgehalt

Der Chat besitzt eine einzige aktuelle Aktionsfläche ausserhalb der Nachrichtenblasen. Neue Nachrichten entfernen vorherige Aktionen sofort. Während eines laufenden Vorgangs sind Eingabe und Aktionen gesperrt. Bei einer konkreten Rückfrage, bei Gefahr oder bei möglicher Speicherung werden keine zusätzlichen Navigationsvorschläge daneben angeboten.

Ein Speicherangebot benötigt mindestens eindeutig bekannte Einrichtung, Defekt und Ort. Eine passende bestätigte Inhaltsversion zeigt nur noch den vorhandenen Eintrag. Nach einer inhaltlichen Änderung ist eine Aktualisierung derselben ID möglich. Die stabilen Ticketdaten enthalten Anliegen-ID, Revision und Inhalts-Hash. Mehrfachklicks, wiederholte Tickets und verlorene Empfangsbestätigungen erzeugen keine weiteren Einträge. Ein fehlgeschlagener Abgleich kann ohne erneuten Portal-Schreibvorgang wiederholt werden.

Die Erfolgsmeldung entsteht im Frontend ausschliesslich nach erfolgreichem Schreiben und erneutem Lesen des Portalspeichers. Das Backend bestätigt danach den vom Client gemeldeten lokalen Beleg. Das ist ausdrücklich **keine unabhängige serverseitige Speicher- oder Zustellbestätigung**. MORA meldet keinen Versand an MORADA.

## Nachgewiesene Tests

Automatisiert: **312 Tests bestanden**, davon 14 neue Integrationstests. Zusätzlich TypeScript-Prüfung und Build bestanden. Die neuen Tests führen die vollständige HTML-Anwendung in JSDOM aus und prüfen den tatsächlichen Portal-Speichercode. Web Locks und Dialog-APIs werden dort wegen fehlender Browserunterstützung durch Testadapter bereitgestellt; das ist keine Messung eines realen Browsers.

Abgedeckt sind unter anderem Lampe mit vollständigen Angaben, kurze Antworten und Umgangssprache, unbekannter Beginn, Raumkorrektur, mehrere Einrichtungen und getrennte Anliegen, unsichere Angaben, Themenwechsel, unbekannte Kategorie, Gefahrensperre, nicht verfügbare Aktionen, ungültige Sitzungen und Belege, Doppelklick, Aktualisierung, Speicherfehler, manuelle Änderungen und verlorene Empfangsbestätigungen.

**Echter kompletter KI-/Speicherablauf bestanden:**

1. «lampe kaputt»
2. «wohnzimmer»
3. «Nur eine Lampe ist betroffen, sonst ist alles normal.»
4. Speichern mit wiederholtem Klick.
5. «Nein, ich meinte Schlafzimmer.»
6. Aktualisieren und erneutes Lesen des Portaleintrags.

Vier echte Mercury-Gesprächsrunden und vier echte nicht-generative Ticket-/Belegrunden lieferten HTTP 200. Ergebnis: genau ein Eintrag, Kategorie «Schaden / Reparatur», Einrichtung «Lampe / Leuchte», Anzahl 1, zuerst Wohnzimmer, danach Schlafzimmer unter unveränderter ID. Quelle: `docs/evidence/portal-integration-live-dom.json`. Das ist ein lokaler DOM-Test gegen das reale geschützte HTTPS-Backend, kein aufgezeichneter Antwort-Mock und keine simulierte erfolgreiche Speicherung.

Der zusätzlich gestartete Serienlauf auf Basis des bestehenden 20-Gespräche-Katalogs wurde nach sechs Fällen mit 18 versuchten Nachrichten beendet: sieben akzeptierte Antworten, elf Fehler; das Gateway meldete nachweislich `rate_limit_exceeded`. Der Test wurde nicht als 20 vollständig bestandene Gespräche gewertet. Der erste technische Pilot hatte drei zurückgewiesene Runden. Alle Misserfolge bleiben in den Rohdaten erhalten.

Eine getrennte kleine Variante mit freier Textantwort und anschliessender reiner Extraktion wurde geprüft und **nicht übernommen**: Nach der ersten realen Textgenerierung stoppte die Guthabenprüfung vor der Extraktion. Die freie Rohantwort begann ausserdem erneut mit einer Entschuldigung und einem Formularverweis. Daraus folgt kein belegter Qualitätsgewinn. Kandidatenquelle und echte Ausgabe sind im Experimentbeleg enthalten; der Kandidat gehört nicht zur ausgelieferten Anwendung.

## Antwortzeiten, Kosten und verbleibende Qualität

Im bestandenen echten Kernablauf lag die gemessene Backendzeit der vier Modellrunden zwischen **1,84 und 5,43 Sekunden**. Die beobachtete SDK-/Gatewayzeit lag zwischen **1,58 und 5,24 Sekunden**. HTTP-Zeiten des Testtreibers lagen zwischen **6,88 und 10,44 Sekunden**. Auch nicht-generative Kontrollen mit 1 ms Backendzeit benötigten im HTTP-Treiber rund 4,87–6,01 Sekunden. Dieser Abstand darf deshalb nicht als Modelllatenz oder Frontendverarbeitung bezeichnet werden.

Die neue Oberfläche protokolliert getrennte HTTP-, JSON- und DOM-Einfügezeiten ohne Kundentexte oder Schlüssel. Echte Browser-Zeiten bis zur sichtbaren Darstellung fehlen. Es gibt kein vorgetäuschtes Token-Streaming. Eine JSON-Entscheidung wird erst nach vollständiger Validierung gezeigt; aus den bisherigen Messungen wird kein Streaming-Vorteil abgeleitet.

Es wurde nur vorhandenes kostenloses Guthaben verwendet. Ausgang: 4,640074064 USD bei 0,359925936 USD bisheriger Nutzung. Jede Generierung prüft das Guthaben samt konservativer Reserve. Die Anwendung stoppt bei nicht bestätigter Herkunft, zu kleiner Reserve oder spätestens 0,659925936 USD gesamter gemeldeter Nutzung. Das ist eine konservative Anwendungssperre, keine Änderung einer Vercel-Zahlungseinstellung und keine neue kostenpflichtige Buchung. Ein vorübergehend widersprüchlicher Guthabenstand wird nur durch erneutes Lesen geprüft; keine abgelehnte Generierung wird dadurch automatisch neu ausgeführt.

**Nicht gelöst:** Das Modell formuliert weiterhin «erfasst/notiert», stellt teilweise mehrere oder optionale Rückfragen und kann ungültige Ausgaben liefern. Im Serienlauf wurde eine unbelegte Entwarnung beobachtet; die neue Validierung verwirft diese konkrete Klasse absoluter Sicherheitsbehauptungen. Dieser begrenzte Schutz ist keine vollständige semantische Sicherheitsprüfung. Sprachliche und fachliche Zuverlässigkeit sind damit noch nicht freigegeben. Der sichere Portaladapter macht aus einem unzuverlässigen Modell keine nachgewiesen fehlerfreie Assistenz.

## Noch offene Browserprüfung

Die automatische Sicherheitsprüfung hat den Cloud-Browserzugriff blockiert, weil die geschützte Preview zur privaten Anmeldeseite `https://vercel.com` weiterleitet. Dieser getrennte Account-Ursprung war nicht ausdrücklich autorisiert. Die Sperre wurde nicht über andere Browserflächen oder Umwege umgangen. Damit sind die Sichtprüfung und Bedienung auf Desktop- und Mobil-Viewports weiterhin offen. Die mobile Gestaltung ist im ergänzten CSS vorgesehen, aber nicht als auf einem Gerät erfolgreich getestet ausgewiesen.

## Benötigte spätere Backend-Schnittstellen

Für den lokalen Test werden keine neuen Portal-APIs vorausgesetzt. Für eine gemeinsame, persönliche und serverseitig bestätigte Integration benötigt das Portal:

| Schnittstelle | Technischer Mindestvertrag |
|---|---|
| Authentifizierter Kontext | Serverseitig geprüfte Benutzer-ID, Mandate/Einheiten und Berechtigungen. Die HTML-Bereichsauswahl darf kein Berechtigungsbeleg sein. |
| Anliegen schreiben/lesen | Authentifiziertes Upsert mit stabiler Anliegen-ID, Idempotenzschlüssel, erwarteter Revision, Feldvalidierung, Zugriffskontrolle und anschliessendem Readback. Antwort enthält gespeicherte Werte und Serverversion. Konflikt: HTTP 409, keine stillen Überschreibungen. |
| Tatsächliche Übermittlung | Getrennte explizite Submit-Operation. Erst eine Serverantwort mit Request-/Zustell-ID, Status und Zeitstempel erlaubt die Aussage «übermittelt». Ein lokaler Speicherbeleg genügt nicht. |
| Dateien | Autorisierte Upload-/Download-Referenzen, Typ-/Grössenprüfung und Zuordnung zum Anliegen. Bild- oder Dokumentenanalyse ist separat zu integrieren. |
| Termine und Beauftragungen | Getrennte autorisierte Buchungs-/Auftragsoperationen mit Konfliktprüfung, bestätigter ID und Status. Das Öffnen eines vorhandenen Formulars ist keine solche Operation. |

Der ausführlichere bestehende Schnittstellenvertrag in `MORA_SIMPLE_INTEGRATION.md` bleibt ergänzend relevant. Alexanders eigene Portalversion muss für diesen lokalen Test nicht verändert werden.

## Empfehlung

Diese Version eignet sich zur Prüfung der konkreten Portalübergabe und der Aktionszustände. Vor einer fachlichen Freigabe zuerst die offene Browserprüfung abschliessen und dann die 20 Gespräche unter dem verfügbaren kostenlosen Anfragelimit vollständig wiederholen. Die verbliebenen Sprach- und Sicherheitsprobleme anhand der unveränderten Rohantworten bewerten; keine weitere pauschale Promptverbesserung oder einen Modellwechsel als bereits erfolgreich ausgeben.
