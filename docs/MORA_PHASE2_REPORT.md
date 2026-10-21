# MORA C – vereinfachte Testversion und belegter Abschlussstand

Stand: 22. Oktober 2026, Europe/Zurich. Repository `dianaporschke/morada.mora.ai`, ausschliesslich `codex/mora-ai-2.0`. Produktquelle und neue Preview: `393db0ba0fc4963a719a42dc171538ddf2784104`. Die spätere Abschlussdokumentation ändert diesen Produktcode nicht.

**Die vereinfachte Testversion ist implementiert und als Preview gebaut. 298 automatisierte Tests, Typprüfung und Build bestehen. Der vollständige echte Vergleich ist nicht abgeschlossen.** Im letzten technischen Pilot gibt es eine akzeptierte echte Modellantwort und einen anschliessenden Modell-Timeout. Daraus folgt weder eine Freigabe der Gesprächsqualität noch der Nachweis, dass Mercury für den späteren Portaleinsatz genügt.

[Neue isolierte MORA-C-Preview](https://morada-mora-ejxjtgk6z-dianaporschke-1255s-projects.vercel.app/?mora=c). Vercel meldet `READY`, Deployment `dpl_FjcjyGZoRP8YYKsG8MZFLvyWsHmV`, `target=null`, keine Aliase. Der bestehende Vercel-Zugangsschutz bleibt aktiv; ohne autorisierte Sitzung erscheint die Vercel-Anmeldung. Es gibt kein Produktionsdeployment.

Die App ist Dianas bisherige, separate Test-App. Alexanders tatsächliches responsives Portal mit seinen Integrationen und seiner HTML-Datei ist nicht verbunden und wurde nicht bearbeitet. Der alte Kundenvorschaulink bleibt unverändert.

## Nachgewiesene Ursachen und gezielte Änderungen

Die Ausgangsbelege stehen im [Phase-1-Bericht](MORA_PHASE1_COMPARISON.md), einschliesslich der unveränderten echten A/B-Gespräche. Dort widersprechen sich die erste Gesprächsentscheidung und die nachgelagerte Formulierung: Eine hilfreiche Raumfrage wird wegen des vorher festgelegten Fragenvertrags abgewiesen, danach erscheint wieder das Formularangebot. Ein Angebot wird teilweise schon vor der endgültigen Formulierung im Zustand gespeichert. Semantisch falsche Aussagen wie ein bereits bereitliegender Entwurf passieren trotz vorhandener Statusinformationen die begrenzte Wortmusterprüfung. Ein kurzer Prompt allein verhindert diese Fehler ebenfalls nicht.

C entfernt diese zweite Entscheidungsinstanz. Antwort, Faktenänderungen, tatsächliche Rückfrage und optionale Aktionsvorschläge kommen aus einer gemeinsamen strukturierten Entscheidung. Erst die vollständig akzeptierte Entscheidung wird übernommen. Die Anwendung schreibt den Modelltext danach nicht um. Es gibt im C-Pfad keinen lokalen Schadensdialog und keinen Rückfall auf eine frühere Formularantwort.

Ein separater semantischer Prüfer darf ausschliesslich Verstösse melden. Er darf weder den nächsten Gesprächsschritt wählen noch einen Ersatztext formulieren. Regulär entstehen deshalb **zwei Modellaufrufe**, bei einer einzigen zulässigen Vertragsreparatur höchstens vier. „Eine Gesprächsentscheidung“ bedeutet ausdrücklich nicht einen einzigen Modellaufruf insgesamt. Dieses Verfahren bringt zusätzliche Latenz und Modellabhängigkeit mit sich; sein Nutzen ist noch vollständig live zu prüfen.

Im technischen Vorpilot wurden ausserdem zwei konkrete Implementierungsfehler gefunden und vor dem Hauptlauf korrigiert:

- SDK 7 akzeptiert keine zusätzlichen Systemnachrichten in `messages`. Der Kontext und die Reparaturhinweise stehen nun im dokumentierten `instructions`-Feld. Drei vorherige Anfragen scheiterten ohne Modelltransport; diese sind erhalten.
- Das mehrdeutige Feld `focus` wurde vom Modell als Thema `defect` interpretiert. `activeIssueRef` ist jetzt eine ausdrücklich typisierte, anfragebezogene Anliegenreferenz. Genaue Schemafehler und erlaubte Werte werden für die begrenzte Reparatur übergeben. Auch verworfene echte Vorschläge bleiben im Nachweis erhalten.

## Komponenten und Datenfluss

| Komponente | Aufgabe |
| --- | --- |
| `api/chat-simple.js` | Isolierte C-API, signierte Sitzung, operative Aktionen und eindeutige Fehlerantworten |
| `lib/mora/simple/model.js` | Gemeinsame Entscheidung, anfragebezogene Referenzschemas und ausschliesslich prüfende semantische Kontrolle |
| `lib/mora/simple/service.js` | Prüfung auf einer Zustandskopie, maximal eine Vertragsreparatur, keine simulierte Antwort bei Modellfehlern |
| `lib/mora/simple/state.js` | Getrennte Anliegen, belegte Faktenänderungen, Angebotshistorie, Schreibaufträge und passende Speicherbelege |
| `assets/mora-client.js` | Eigene C-Sitzung/Ablage, aktuelle Aktionen, Klicksperre, Speicherung und vollständiges Zurücklesen |
| `assets/mora-data.js` | Bestehendes zentrales Mapping; Unsicherheit wird jetzt auch in der Zusammenfassung sichtbar |
| `assets/mora-safety.js`, `lib/mora/safety.js` | Geteilte bisherige Gefahrenerkennung; sofortiger Anwendungshinweis und anschliessende kontextbezogene Modellantwort |
| `tests/simple-conversation.test.js`, `tests/simple-sdk.test.js` | Neue Zustands-, Speicher-, Oberflächenmodul- und echte SDK-Vertragstests mit gekennzeichneten Fixtures |

Der vorhandene Faktenreducer und `mapServiceDraft` bleiben zentral. Einrichtung und zugehörige Kategorie werden normalisiert; ein Lampenwert führt zu `light`, `electricity` und der Anzeige „Lampe / Leuchte“. Defekt, Anzahl, Bereich, Beginn, Umfang und weitere Angaben werden aus demselben Anliegendatensatz gemappt. Fakten tragen ihre Quelle und den Status bekannt, unbekannt, nicht angegeben, korrigiert oder unsicher. Neue belegte Werte werden feldweise zusammengeführt; fehlende Angaben löschen keine vorhandenen Werte. Unterschiedliche Anliegen haben getrennte Referenzen und IDs. Unbekannte Kategorien werden nicht durch eine willkürlich gewählte Kategorie ersetzt.

## Aktionen und tatsächlicher Speichererfolg

Ein Angebot ist kein Entwurf. Die aktuelle Chatansicht entfernt frühere Aktionsgruppen; beim Wiederherstellen erhält nur die letzte passende Nachricht ihre Aktionen. Bereits gespeicherter unveränderter Inhalt wird nicht als neue Erstellung angeboten. Zusätzliche Informationen erlauben eine gezielte Aktualisierung derselben Entwurfs-ID.

Beim Klick vergibt der Server einen Schreibauftrag mit `operationId`, Anliegen-/Entwurfs-ID, Revision und Inhaltshash. Gleiche Inhalte erhalten eine stabile Operation. Die Oberfläche sperrt parallele Klicks, schreibt mit IndexedDB `put` und liest den Datensatz erneut. Schlüssel, Quellrevision, Quellinhalt und sämtliche gemappten Formularfelder müssen übereinstimmen. Erst danach darf sie eine lokale Speicherbestätigung anzeigen und den passenden Beleg in den Gesprächszustand übernehmen.

Fehlgeschlagenes Schreiben oder Zurücklesen erzeugt keine Erfolgsmeldung. Bei verlorener Statusbestätigung bleibt ein tatsächlich gespeicherter lokaler Datensatz erhalten; die Antwort benennt den fehlenden Abgleich. Eine fehlgeschlagene Aktualisierung löscht keinen früher bestätigten Speicherstatus. Operative Bestätigungstexte sind feste Anwendungstexte mit realem Speicherbeleg, keine behaupteten Modellantworten.

**Vertrauensgrenze:** IndexedDB und ihr Schreib-/Lesebeleg belegen nur den Speicher auf diesem Gerät. Historische interne Werte wie `portal_received` beziehen sich hier ausschliesslich auf die lokale Serviceansicht der Test-App. Im Modellkontext heisst dies ausdrücklich `local_saved`. Das ist weder Alexanders Portal noch eine serverseitige Übermittlung an MORADA. Eine solche Übermittlung existiert in dieser Testversion nicht.

## Tatsächlich durchgeführte Live-Prüfungen

Alle erhaltenen Texte stammen vom vorhandenen Gateway-Modell `inception/mercury-2.5`. Rohdaten enthalten Herkunft, Generierungs-IDs, Modellrequests, verworfene Kandidaten und Prüferantworten. Schlüssel, signierte Sitzungen und Authentifizierungslinks sind ausgeschlossen. Testfixtures werden nicht als Live-Erfolge gezählt.

Im letzten Pilot, Quelle `393db0b`:

> Kunde: Eine Lampe im Arbeitszimmer funktioniert nicht.
>
> Echte Modellantwort: Grüezi. Das ist ärgerlich. Wir können einen Reparaturantrag für die Lampe im Arbeitszimmer vorbereiten. Wollen Sie das tun?

Die gemeinsame Entscheidung wurde nach der semantischen Prüfung akzeptiert. Im resultierenden Zustand stehen `equipment=light`, `category=electricity`, `location=Arbeitszimmer`, `count=1`, unbekannter/nicht genannter Beginn und `preparation.status=not_prepared`. Der Modellkandidat selbst hatte noch `category=appliances` und `equipment=Lampe` vorgeschlagen; die vorhandene zentrale Normalisierung führte zur korrekten kanonischen Zuordnung. Die sichtbare Antwort blieb unverändert der Modelltext. Es wurde kein Entwurf gespeichert und kein Portalvorgang behauptet.

Die Antwort benötigte 19,102 Sekunden Testtreiber-Gesamtzeit für Entscheidung und Prüfung. Tatsächliche Kosten beider Generierungen: 0,00074017 USD. Der Prüfer lieferte gültiges `{"violations":[]}`; der Gateway-Abschlussgrund war allerdings `length`. Auch deshalb ist seine Zuverlässigkeit mit diesem einzelnen Fall nicht nachgewiesen.

> Kunde: Nur eine, seit gestern.
>
> Ergebnis: Modell-Timeout, HTTP 503 / `MODEL_UNAVAILABLE`, keine empfangene Modellantwort, 55,983 Sekunden Testtreiber-Gesamtzeit.

Der vorherige Zustand wurde nicht durch erfundene Angaben ersetzt. Die geplante dritte Raumkorrektur wurde nicht ausgeführt. Es liegt somit **kein vollständiges erfolgreiches mehrteiliges C-Gespräch** vor.

Zusätzlich dokumentiert: der SDK-Vorpilot ohne Modelltransport; ein vorheriger Transport-Timeout; echte, aber wegen ungültiger Referenz abgewiesene Modellkandidaten vor der Schemaänderung; zwei einzelne diagnostische A/B-Aufrufe gegen die unveränderte Phase-1-Architektur. A antwortete dort; Bs zusätzliche Formulierungsstufe lief ebenfalls ins Zeitlimit. Das belegt beobachtete Ausreisser auch im unveränderten Basispfad, aber keinen allgemeinen Providerausfall und keinen kontrollierten neuen A/B-Vergleich.

## Offener Vergleich und Qualitätsbewertung

Der unveränderte Korpus mit 20 Gesprächen und 52 Kundennachrichten sowie acht feste semantische Gegenproben ist vorbereitet. **Der Hauptlauf wurde nicht begonnen.** Die frühere vollständige Phase-1-Auswertung bleibt eine historische A/B-Basis, kein neuer C-Nachweis.

| Kriterium | Belegter C-Stand |
| --- | --- |
| Natürlichkeit | Nur ein akzeptierter Text; keine belastbare Gesprächsnote |
| Gesprächsverständnis | Lampe und Raum im ersten Pilot korrekt im normalisierten Zustand |
| Kontexttreue | Automatisiert geprüft; vollständige Live-Folge fehlt |
| Sinnvolle Rückfragen | Kein vollständiger Live-Vergleich |
| Wiederholungen | Aktionslogik automatisiert geprüft; Gesprächsverhalten nicht vollständig live geprüft |
| Fachliche Richtigkeit | Keine Freigabe anhand eines Lampenfalls |
| Reaktionsgeschwindigkeit | Ein akzeptierter Aufruf: 19,102 s; ein Timeout: 55,983 s; keine repräsentative Verteilung |
| Kosten pro Gespräch | Nicht bestimmbar, weil kein C-Gespräch vollständig ist |

Nach dem Nutzerauftrag „beende“ blockierte die automatische Freigabeprüfung die Fortsetzung des Live-Piloten wegen möglicher Kosten und externer Datenübertragung. Es folgten keine weiteren Modelltests. Eine Wiederaufnahme erfordert eine neue Freigabe. Diese Grenze wurde nicht umgangen.

## Regressionen, Kosten und Isolation

Der abschliessende lokale Lauf umfasst **298 bestandene Tests, null Fehler, null übersprungene Tests**. `npm run typecheck` und `npm run build` bestehen; der Build prüft 88 Dateien. Nachweis: [Regressionszusammenfassung](evidence/quality-phase2-regression.txt). Die neuen Tests decken Korrekturen, unbekannte/unsichere Angaben, mehrere Anliegen, idempotente Schreibaufträge, wiederholte Klicks, falsche/veraltete Belege, Aktualisierung derselben ID, Speicherfehler, beschädigte Rücklesewerte, verlorene Bestätigungen und unmittelbare Sicherheitshinweise ab. SDK-Tests prüfen den tatsächlichen installierten SDK-Aufrufvertrag einschliesslich begrenzter Reparatur; ihre Transportantworten sind Fixtures.

Die neue Preview ist gebaut. Ein Browseraufruf erreichte den bestehenden Vercel-Anmeldeschutz. **Eine vollständige echte Browserkette Modellgespräch → Speicherklick → Reload → Aktualisierung wurde nicht ausgeführt.** Die automatisierte IndexedDB-/Oberflächenmodulprüfung ist ausdrücklich kein Ersatz für diesen Live-Nachweis.

Sechs empfangene Generierungs-IDs aus allen technischen Piloten und diagnostischen A/B-Aufrufen wurden rein lesend abgerechnet: **0,00201942 USD**. Die gelesene Kontobilanz stieg von 0,30594161 auf 0,30796103 USD Verbrauch; verbleibendes vorhandenes Gratisguthaben: **4,69203897 USD**. Das entspricht derselben Differenz. Vier weitere Transportversuche haben keine empfangene Generierungs-ID; ihr Ausgang bleibt unbekannt. Zuletzt war keine zusätzliche Belastung für diese Versuche erkennbar, spätere Buchungen werden damit nicht ausgeschlossen. Es wurden keine Schlüssel ergänzt und keine Zahlungs-, Auflade- oder Tarifeinstellungen geändert. Der definierte Rahmen von 0,50 USD wurde nicht ausgeschöpft.

`main` bleibt `0b86dfc3344df62d3de02d8297959a495cc822d3`; `alex-portal` bleibt `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Die bisherige Kunden-Preview `dpl_7rh6XJY1DW8LUXC2eKboKtAtmLf4` ist weiter `READY` mit derselben Quelle `6ef24cd`. Kein Merge, keine Änderung an Alexanders Portal, keine Produktionsveröffentlichung.

## Empfehlung und spätere HTML-Schnittstelle

C ist eine reviewbare Testversion, keine freigegebene Produktionslösung. Als nächster fachlicher Entscheidungsnachweis fehlen die unveränderten 20 Gespräche, die acht Gegenproben und die echte Browser-Speicherkette. Die bisherigen Ergebnisse reichen weder für „Mercury genügt“ noch für „ein anderes Modell ist zwingend besser“. Der Timeout und der zusätzliche Prüfer bleiben konkrete Zuverlässigkeits-/Latenzrisiken. Keine weiteren Promptvarianten oder Modellwechsel ohne diesen klar abgegrenzten Nachweis.

Für Alexanders HTML-Portal sind später ein authentifizierter Chatadapter und eine echte Speicher-/Aktualisierungsschnittstelle nötig: stabile Anliegen-ID, Idempotenzschlüssel, Quellrevision/-hash, gespeicherte Version, Zurücklesen der tatsächlichen Felder und vertrauenswürdiger serverseitiger Speicherbeleg. Wirkliches Einreichen braucht einen getrennten bestätigten Vorgang mit `requestId` und Zustellbeleg. Die genaue technische Spezifikation steht in [MORA_SIMPLE_INTEGRATION.md](MORA_SIMPLE_INTEGRATION.md).

## Nachweise und Reproduktion

- [Vorab festgelegter Prüfplan](../scripts/quality-phase2/PROTOCOL.md).
- [Letzter echter Pilot](evidence/quality-phase2-pilot.json); frühere technische Fehlläufe stehen separat unter `quality-phase2-pilot-*.json`.
- [Teilstand und vollständige Kennzeichnung des fehlenden Hauptlaufs](evidence/quality-phase2-partial-measurements.json), offline reproduzierbar mit `python scripts/quality-phase2/analyze.py --partial`.
- Reine Kostenabfragen: `quality-phase2-pilot-cost-audit.json`, `quality-phase2-reference-cost-audit.json`, `quality-phase2-connectivity-cost-audit.json` im Nachweisordner.
- [Isolations-/Deploymentnachweis](evidence/quality-phase2-isolation.json).

Der letzte Commit enthält Abschlussdokumentation und Nachweise zusätzlich zur unveränderten Produktquelle. Keine nicht durchgeführten Tests werden als bestanden ausgewiesen.
