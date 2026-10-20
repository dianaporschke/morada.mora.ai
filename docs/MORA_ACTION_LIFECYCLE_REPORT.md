# MORA: verlässliche Entwurfsaktionen und Gesprächszustand

Stand: 20. Oktober 2026. Codecommit: `6ef24cda89f2d4d0cab0fdf9ba28234a387bc336`. Ausschliesslich `codex/mora-ai-2.0`; kein Merge, kein Produktionsdeployment. Alexanders Portalbereiche, Navigation, Benutzerverwaltung und allgemeine Formulare wurden nicht geändert. Modell und Zugang bleiben `inception/mercury-2.5` über das vorhandene Vercel AI Gateway. Keine neuen Schlüssel, Tarifänderungen oder geänderten kostenpflichtigen Einstellungen.

Preview: https://morada-mora-hwg0nkuia-dianaporschke-1255s-projects.vercel.app/
Vercel: `dpl_7rh6XJY1DW8LUXC2eKboKtAtmLf4`, `READY`, `target=null`, Projekt `morada-mora-ai`.

## Tatsächliche Ursachen

| Befund | Auswirkung |
| --- | --- |
| Alte Chataktionen wurden deaktiviert, aber nicht entfernt. Beim Reload wurden alle historischen Aktionsgruppen rekonstruiert. | Mehrfach sichtbare Vorbereitungsbuttons, auch nach Ausführung. |
| Die permanente Frontend-Aktion erschien unabhängig von der Modellentscheidung bei fast jedem vorhandenen Anliegen. | Selbst eine reine Raumfrage konnte bereits einen Vorbereitungsbutton erhalten. |
| `draftOfferShown` war lediglich ein Hinweis für das Modell. | Ein weiteres `prepare_draft` wurde trotz vorherigem Angebot akzeptiert. Einige alte Tests verlangten sogar wiederholte Angebote. |
| Entwürfe wurden beim Reload nach den Chataktionen geladen; die lokale Phase blieb `not_prepared`. Eine fehlgeschlagene Statusbestätigung wurde vor der nächsten Modellanfrage ignoriert. | Oberfläche und Modell konnten mit unterschiedlichen Entwurfsständen arbeiten. |
| Ausgabevalidierung und Speicherung verwendeten teilweise unterschiedliche Standardwerte. | Eine Aktion konnte gegen einen anderen Zustand geprüft werden als den tatsächlich gespeicherten. |
| Die Inhaltskennung enthielt Auditquellen. | Eine neue Quellenformulierung konnte einen unveränderten Entwurf als geändert markieren. |
| Andere Geräte konnten mit `ref=active` das bisherige Anliegen ersetzen. | Ein echter Test ordnete eine neue Heizung der vorbereiteten Lampe zu. |
| Datenplanung und Kundenformulierung erfolgten gleichzeitig gegen den eingehenden Zustand. | Auch bei korrekten getrennten Daten konnte der Satz noch auf den falschen bestehenden Entwurf verweisen. |
| Die Prüfung verbaler Angebote erfasste unter anderem „Sie können … vorbereiten“ nicht. | Ein erneutes Angebot im Text konnte ohne neuen Button durchgehen. |

Der Vorher-Test reproduzierte eine Raumfrage mit Vorbereitung, förmlichen Dank, sichtbare Altaktionen nach dem Speichern und den falschen lokalen Phasenwert nach Reload (`evidence/action-lifecycle-before.json`). Die administrativen Sätze waren echte Modellantworten, keine lokal eingefügten Dialogvorlagen. Der alte lokale Rückfragekatalog läuft im normalen strukturierten Mercury-Pfad nicht; seine Sicherheits- und Kompatibilitätspfade bleiben erhalten. Technische Speicherbestätigungen standen allerdings als Assistententurns in der Modellhistorie und vermischten operative Meldungen mit dem Gespräch.

## Geänderte Komponenten

| Bereich | Änderung |
| --- | --- |
| `assets/mora-data.js` | Eine gemeinsame Aktionsrichtlinie `draftActionState`, explizite Entwurfsexistenz und Inhaltssynchronisierung, fachlicher Inhaltsvergleich ohne Auditquellen sowie Migration alter Inhaltskennungen. Das bestehende zentrale Portal-Feldmapping bleibt erhalten. |
| `lib/mora/issue-state.js`, `engine.js` | Gemeinsamer Faktenreducer, signierter Angebotszustand pro Anliegen, genaue Bestätigung einer Revision. Operative Speicherbestätigungen werden nicht mehr als Gesprächsantwort in die Modellhistorie geschrieben. Erledigte Rückfragen werden geschlossen. |
| `understanding.js`, `dialogue.js` | Gemeinsame Normalisierung vor Validierung und Übernahme; Identitätsprüfung für verschiedene Einrichtungen; keine gleichzeitige Rückfrage und Vorbereitung; kein erneutes Angebot bei unpassendem Zustand. Verbale und sichtbare Angebote werden zusammen geprüft. |
| `context.js`, `instructions.js` | Modell erhält den verbindlichen Zustand. Vorbereitung ist optional. Kurze Antworten, keine Erfassungsrituale und keine Pflichtfragen zu Beginn oder Anzahl. Keine neuen festen Dialogvorlagen. |
| `reply.js`, `api/chat.js` | Bei neuer oder geänderter Entwurfssituation entsteht die abschliessende Antwort aus dem bereits validierten Zustand. Fakten bleiben unverändert. Eine ausschliesslich typisierte Vorbereitungsanfrage kann einen serverseitig erlaubten Button ergänzen; sie kann keine Übergabe ausführen. Ein gemeinsamer Serverhelfer prüft Erstangebot, Wiederverwendung und bereits erledigte Aktionen. Nur die angezeigte Endantwort wird signiert. Reale Aufrufe und Tokenverbrauch werden zusammengezählt. |
| `assets/mora-client.js` | Nur aktuelle Chataktionen bleiben sichtbar; alte Gruppen werden entfernt. Permanente Vorbereitung erst nach einem Angebot oder bei echten ausstehenden Änderungen. Entwürfe werden vor Aktionsrekonstruktion geladen. Fehlende Statusbestätigungen werden vor weiterer KI-Inferenz nachgeholt. |
| Tests und Testtreiber | Regressionen für den vollständigen Ablauf, echte Modellkorrekturen, Fehler und Reload. Der Live-Treiber stoppt bei Transportfehlern sofort; er setzt den Ablauf nicht mit veralteten Daten fort. |

## Daten und Aktionen

Das zentrale Mapping `mapServiceDraft` ordnet Kategorie, Einrichtung, Defekt, Anzahl, Bereich, Beginn, Umfang, Zusatzangaben, Beschreibung, Dringlichkeit und lokale Fotos den vorhandenen MORA-Feldern zu. Bekannte Werte, ausdrücklich unbekannte Werte, fehlende Angaben, Korrekturen und Unsicherheit bleiben unterscheidbar. Nur fachliche Änderungen verändern den Inhaltsstand; Auditquellen bleiben erhalten. Lokale Kundenänderungen im Formular werden weiter geschützt und bei Konflikten angezeigt. Es gibt keine neue Portal-Datenbankstruktur.

| Zustand | Verhalten |
| --- | --- |
| Noch kein Angebot | Das Modell entscheidet über den nächsten sinnvollen Beitrag. Eine Rückfrage erzeugt keinen zusätzlichen Vorbereitungsbutton. |
| `offered` | Angebot im signierten Anliegen gespeichert. Ein einzelner vorhandener Einstieg bleibt zugänglich; Nachträge erzeugen kein neues Angebot. |
| Vorbereitung läuft | Browser sperrt gleichzeitige Klicks und wartet auf die dauerhafte IndexedDB-Transaktion. |
| `portal_received` | Lokaler Serviceentwurf vorhanden und aktuell. Kein Vorbereitungs- oder Aktualisierungsbutton. |
| `changes_pending` | Neue fachliche Angaben seit der Übernahme. Derselbe Entwurf kann unter derselben ID aktualisiert werden. |
| Fehler | Kein vorgetäuschter Erfolg. Speicherung ist wiederholbar. Bereits gespeicherte Daten mit fehlender Statusbestätigung werden vor der nächsten KI-Anfrage synchronisiert. |
| Tatsächlich gesendet | Nur mit echter Backend-Bestätigung und Vorgangs-ID; weiterhin nicht angebunden. |

`draftExists` beschreibt, ob für das aktuelle Anliegen ein Serviceentwurf existiert. `chatFactsInDraft` beschreibt, ob die aktuellen Chatangaben darin gespeichert sind. Andere Anliegen bleiben getrennt. Dank und Themenwechsel ändern diese Zustände nicht.

Bei neuen Anliegen, einem anderen aktuell besprochenen Entwurf oder Änderungen an einem bereits vorbereiteten Entwurf erhält die abschliessende Formulierung den validierten Zustand in einem zusätzlichen echten Mercury-Aufruf. Bei erfolgreicher Formulierung wird ausschliesslich diese Endantwort angezeigt und gespeichert; die Planerformulierung wird verworfen. Die weiter unten beschriebene unabhängig geprüfte Fehlerreserve bleibt ausdrücklich als herabgestufte Antwort erkennbar. Dank, unveränderte Themen und Nachträge an unvorbereiteten Anliegen brauchen normalerweise nur einen Modellaufruf. Jede Generierung hat höchstens eine begrenzte Vertragsreparatur; das gemeinsame Zeitbudget bleibt begrenzt. Sicherheitsfälle und Speicherbestätigungen brauchen weiterhin keine Inferenz. Es gibt keine simulierten KI-Antworten.

## Automatisierte Prüfung

279 Tests bestanden; Typecheck, Syntax-/Assetprüfung (62 Dateien), Build und `git diff --check` ebenfalls bestanden. Die Suite enthält die bisherigen 15 geforderten Szenarien sowie neue Regressionen für Rückfrage versus Vorbereitung, ein einziges aktuelles Angebot, gleichzeitige Klicks, dauerhafte Speicherung, Reload, Ergänzungen desselben Entwurfs, ausgefallene Bestätigungen, veraltete und verbale Modellvorschläge, unbekannte Angaben, alte Inhaltskennungen und getrennte Einrichtungen. Eigene Tests prüfen die Formulierung aus validiertem Zustand, signierte Endantworten, echte begrenzte Regenerierung falscher Entwurfsbehauptungen sowie Aufruf- und Tokenzählung. Mocktests werden nicht als sprachlicher KI-Erfolg gewertet.

## Echte KI-Prüfung

Die Tests verwenden synthetische Kundendaten und echtes Mercury 2.5. Rohbelege enthalten Originalantworten, Aktionen, Fakten, Formularwerte, Modellmodus, Aufrufzahlen und Zeitmessungen; keine Zugangsschlüssel, Freigabetokens oder signierten Sessions.

Erfolgreicher API-/DOM-Zwischentest auf `60deb9f`: „lampe kaputt“ → Raumfrage ohne Vorbereitungsaktion → „wohnzimmer“ → genau ein Angebot → dauerhafte lokale Übernahme → „danke“ ohne neues Angebot → Reload. Drei echte Modellrunden, vier Generierungen und eine lokale Bestätigung mit null Modellaufrufen; alle HTTP 200, keine Recovery-Antwort und keine Transportfehler. Genau ein gespeicherter Entwurf mit `light` / Lampe / Leuchte und `wohnzimmer`. Nach Vorbereitung, Dank und Reload keine Vorbereitungs- oder Aktualisierungsaktion; Dank verändert die Revision nicht. Belege: `evidence/action-lifecycle-verbal-guard-live.json`, `evidence/action-lifecycle-verbal-guard-review.json`.

Der folgende Browser-Zwischentest bestätigte vollständige Lampendaten und die Aktualisierung desselben Entwurfs, fand aber noch ein verbales Vorbereitungsangebot ohne passende Aktion für das neue Heizungsanliegen (`evidence/action-lifecycle-browser-binding-pilot.json`). Dies führte zur typisierten Vorbereitungsanfrage im Formulierungsschritt und zur wortstellungsunabhängigen Angebotsprüfung. Auch ein erfolgreich erkannter vollständiger Lampentext konnte noch an der optionalen Formulierung scheitern (`evidence/action-lifecycle-wording-failure-pilot.json`). Dies führte zur geprüften Weiterverwendung echter Modellantworten beziehungsweise klar gekennzeichneter Faktenwiederherstellung.

Die abschliessenden Nachweise sind vollständig:

| Ablauf | Stand und Ergebnis | Beleg |
| --- | --- | --- |
| „lampe kaputt“ → „wohnzimmer“ → Vorbereitung → „danke“ → Reload | `43c89d0`, unmittelbar vor der ausschliesslichen Detailpräfix-Korrektur. Drei echte Modellrunden, fünf reale Generierungen, alle HTTP 200, keine herabgestufte oder Recovery-Antwort. Genau ein Lampenentwurf, Raum korrekt, keine erfundene Anzahl. Keine neue Vorbereitung nach Speicherung, Dank oder Reload; Dank verändert die Revision nicht. Sichtbarer Einstieg vor der Übergabe geprüft. | `evidence/action-lifecycle-final-live.json`, `evidence/action-lifecycle-final-review.json` |
| Vollständige Lampe → lokaler Entwurf → spontane Erreichbarkeit → Aktualisierung → zwei Heizkörper im Bad → separater Entwurf → Versandfrage | Finaler Code `6ef24cd` auf der oben verlinkten Preview im echten Browser. Vier echte Kundenturns und drei lokale Übergaben. Lampe: Anzahl 1, Wohnzimmer, gestern, Defekt korrekt. Nachtrag aktualisiert dieselbe ID; negative Symptome und Erreichbarkeit je einmal. Heizung: eigene ID, Anzahl 2, Bad, gestern; keine übernommenen Lampennotizen. Nach jeder Übergabe keine ausführbare alte Vorbereitung. | `evidence/action-lifecycle-final-browser.json`, `evidence/action-lifecycle-final-browser-review.json`, `evidence/mora-action-final.jpg` |

Die echte Abschlussantwort auf „Wurde das jetzt an MORADA gesendet?“ lautet: „Nein, über den Chat wurde nichts an MORADA gesendet.“ Das Formular des ursprünglichen Lampenentwurfs wurde danach erneut ausgewählt und mit den Chatangaben verglichen. Beide Entwürfe bleiben getrennt erhalten. Auch im finalen Ablauf erscheinen noch administrative Bestätigungen; die technische Verifikation ist keine vollständige Freigabe der freien Sprachqualität.

Die verworfenen Kandidaten bleiben nachvollziehbar:

- `action-lifecycle-candidate.json`: unbestätigte Aussage über einen aktuellen Entwurf vor dem ersten Speichern.
- `action-lifecycle-live-pre-identity.json`: falsche Zuordnung der Heizung zum Lampenanliegen und spätere Transportabbrüche.
- `action-lifecycle-live-release-lamp.json`: abgeschlossener Lampenablauf auf einem Zwischenstand, inklusive Ergänzung und Aktualisierung desselben Entwurfs.
- `action-lifecycle-live-release-topics.json`: vier echte Modellrunden mit getrennten Geräten und richtigen Räumen; anschliessende Statusbestätigung durch Testtransport abgebrochen. Kein bestandener Gesamtabschluss.
- `action-lifecycle-browser-pilot.json`: getrennte Daten, aber falscher verbaler Bezug auf einen bestehenden Entwurf. Anlass für die Formulierung nach Zustandsvalidierung.
- `action-lifecycle-verified-rate-pilot.json`: universeller zweiter Aufruf stiess bei schnellen Folgeantworten auf HTTP 429. Anlass für den gezielten zusätzlichen Aufruf nur bei geänderter Entwurfssituation.
- `action-lifecycle-pre-verbal-guard.json`: Aktionszustände korrekt, aber wiederholtes Angebot in der Sie-Form. Anlass für die verbale Aktionsprüfung.

Diese fehlerhaften beziehungsweise unterbrochenen Teile werden nicht als vollständig bestandene Tests ausgegeben.

## Grenzen und Schnittstellen

Die freie deutsche Sprache von Mercury bleibt schwankend. In den Zwischenständen erschienen trotz Anweisungen förmliche Bestätigungen, eine Entschuldigung und eine grammatisch fehlerhafte Formulierung. Es wurden keine lokalen Ersatzsätze eingeführt, um dies zu kaschieren. Die Tests rechtfertigen keine Garantie durchgehend natürlicher Sprache. Aktions- und Datenprüfung ersetzen keine vollständige semantische Kontrolle beliebiger Formulierungen.

Gateway-Limits bleiben unverändert. Ein echter 429 wurde dokumentiert. Die gezielte zweite Formulierung reduziert unnötige Inferenz, kann bei relevanten Zustandsänderungen aber weiterhin zusätzliche Zeit und Tokens benötigen. Tests werden sequenziell mit Abstand durchgeführt; Limits werden nicht erhöht. Providerfehler erzeugen keine erfundenen Erfolge. Scheitert nur die optionale Formulierung, wird eine unabhängig gegen den aktuellen Zustand geprüfte echte Planerantwort verwendet (`wordingFallback=validated_model`, `degraded=true`). Ist auch diese unzuverlässig, bleiben die Fakten mit einer ausdrücklich technischen Meldung erhalten (`responseMode=recovery`, `wordingFallback=facts_recovery`, `recoveredFacts=true`). Ein fehlgeschlagener erster Verständnisaufruf liefert weiterhin keinen erfundenen Gesprächserfolg. Die ursprünglichen Anbieter- und Validierungsdiagnosen bleiben sichtbar in den technischen Antwortdaten; Fehlversuche werden nicht als erfolgreiche Generierungen verschwiegen. Dieser Fehlerpfad ist mit eigenen Regressionen geprüft.

`portal_received` bestätigt nur die vorhandene lokale Serviceansicht auf diesem Gerät. Es ist keine serverseitige Einreichung bei MORADA. Direkter Versand, geräteübergreifende Speicherung, Vorgangsnummern und Bearbeitungsstände sind weiterhin nicht angebunden. Für diese Korrektur benötigt Alexander keine neue Schnittstelle. Die spätere technische Spezifikation bleibt in `MORA_PORTAL_INTERFACE_CONTRACT.md` dokumentiert.


## Ergänzender Zwischentest der Datenhaltung

Auf `5a40570` wurde das gemeldete kurze Gespräch vollständig mit echtem Mercury durchgeführt: „lampe kaputt“ → „wohnzimmer“ → Vorbereitungsbutton → dauerhafter Serviceentwurf → „danke“ → Reload. Drei echte Modellantworten und fünf reale Generierungen einschliesslich begrenzter Korrektur; alle HTTP 200, keine technische Recovery und keine herabgestufte Antwort. Genau ein Entwurf, Einrichtung Lampe / Leuchte und Bereich wohnzimmer korrekt, keine erfundene Anzahl. Höchstens eine aktuelle Vorbereitungsaktion; nach Speicherung, Dank und Reload keine neue Vorbereitungs- oder Aktualisierungsaktion. Dank verändert die Revision nicht. Originalantworten und Prüfungen: `evidence/action-lifecycle-retention-live.json`, `evidence/action-lifecycle-retention-review.json`.

Die sprachliche Beurteilung bleibt getrennt: In diesem echten Durchlauf erschien eine grammatisch misslungene Formulierung. Der technische kurze Ablauf bestand, eine durchgehend natürliche Sprache wird deshalb ausdrücklich nicht als vollständig erreicht ausgegeben.


## Absicherung spontaner Zusatzangaben

Ein weiterer echter Browserbefund bestätigte Erreichbarkeit sprachlich, übernahm sie aber nicht in `updates` (`evidence/action-lifecycle-extraction-pilot.json`). Deshalb priorisiert der Verständnisauftrag jetzt Fakten vor Prosa, auch in der Reihenfolge des strukturierten Ausgabevertrags. Erreichbarkeit und Kontaktpräferenzen sind ausdrücklich Anliegenangaben in `details`, auch ohne Speicheranweisung.

Zusätzlich bewahrt eine konservative Validierung eine ausdrückliche eigene Erreichbarkeitsaussage als exaktes Kundenzitat, falls das Modell die Notiz auslässt. Dies gilt nur bei einem vorhandenen eindeutigen aktuellen Anliegen, ohne neues oder mehrfaches Anliegen und ohne anderen Zielverweis. Es werden weder Zeiten interpretiert noch Kontaktaufnahmen gebucht oder versprochen. Fragen und Aussagen über Dritte lösen diese Absicherung nicht aus. Es ist Datenerhaltung, keine Dialogvorlage und kein simulierter Modellaufruf. Die Regression lässt die Notiz absichtlich im Modellresultat fehlen und prüft trotzdem die korrekte Aktualisierung desselben Entwurfs samt erhaltenen negativen Beobachtungen.


## Stabile Zusammenführung von Zusatzangaben

Im anschliessenden echten Browserlauf wurden die Erreichbarkeit und der Aktualisierungsbutton korrekt übernommen. Das Modell lieferte dabei jedoch die bisherigen Zusatzangaben als Präfix erneut mit. Der gemeinsame Faktenreducer erkennt deshalb jetzt exakte normalisierte Wiederholungen und ein vollständig wiederholtes altes Präfix. Er übernimmt die vervollständigte Notiz einmal, statt den alten Text doppelt anzuhängen. Reine Unterschiede in Grossschreibung, Leerraum oder Satzzeichen öffnen keinen bereits gespeicherten Entwurf erneut. Fachliche Änderungen und ausdrückliche Korrekturen bleiben erhalten. Diese konkrete Ausgabe ist als Regression geprüft.
