# MORA AI 2.0 – Premium Intelligence System

20. Oktober 2026. Entwicklungsbranch `codex/mora-ai-2.0`, Repository `dianaporschke/morada.mora.ai`. Ausgangsstand `a045fa9`. Die technische Überarbeitung ist umgesetzt und überprüfbar. **Die Premium-Abnahme ist nicht bestanden.**

## Architektur und Zuständigkeiten

MORA führt die Unterhaltung über den vorhandenen Vercel AI Gateway mit `inception/mercury-2.5`. Das Modell entscheidet weiterhin über Formulierung, Frage, Antwortlänge, Themenwechsel und optionale Aktionen. Der Server prüft Datenform, signierte Referenzen, reale Fähigkeiten und Gefahren. Er führt keine vom Modell frei erfundenen Werkzeuge aus. Es wurden weder ein zweites Portal noch Anmeldung, Rollenoberflächen, Datenbanken oder allgemeine Portalbereiche entwickelt.

Schon vor diesem Auftrag waren der alte Fragenkatalog und vorgefertigte normale Antworten im strikten KI-Pfad nicht mehr aktiv. Die aktuelle Analyse hat deshalb die verbleibenden tatsächlichen Engpässe bearbeitet, statt diese frühere Änderung erneut als neu auszugeben.

| Tatsächlicher Engpass | Umsetzung | Erhaltene Grenze |
|---|---|---|
| Umfangreicher gemischter Gesprächs- und Speichervertrag | Kleiner Modellvertrag mit `reply`, `intent` sowie optionalen `updates`, `ask`, `actions`; kanonische Speicherstruktur bleibt serverseitig | Strikte Schemas, Quellen und signierte Anliegenreferenzen |
| Wiederholte Schemaerklärungen; wechselnder Kontext vor dem Schema | Redundante Beschreibungen entfernt; statischer Persönlichkeits-/Schemapräfix steht vor dem Kontext | Cache-Nutzung wird gemessen, nicht garantiert |
| Häufige Entwurfsorientierung im Modellauftrag | Kürzerer Auftrag für die beste nächste Kundenantwort; Notizen als Nebenprodukt; keine Antwortvorlagen | Keine erfundenen Erledigungen, keine kostenpflichtige Beauftragung |
| Fehlender optionaler Fragenindex beendet ein Mehrfachanliegen | Wortlaut und belegte Fakten bleiben; mehrdeutige Auswahlmetadaten entfallen | Falsche Referenzen, doppelte Ziele und überlappende Quellen werden weiterhin abgewiesen |
| Wörtlicher Raumvergleich lehnt sinngleiche Bezeichnungen ab | Nur belegbare Übernahme eines wörtlich anderen Problemorts wird als Konflikt abgewiesen | Getrennte Quellen und Anliegenzuordnung |
| Feste Objektliste bildet Fenster, Rollläden, Kühlschränke etc. nicht ab | Begrenzter freier Objektname neben bekannten Codes; Darstellung und Übergabe erhalten ihn | Textdarstellung, keine ausführbaren Inhalte |
| Korrektur hinterlässt alte Beschreibung | Aktuelle Beschreibung wird aus den gültigen Fakten erneuert, Kundenoriginal bleibt im Verlauf/Audit | Vorhandene manuelle Formularänderungen und Konfliktbehandlung bleiben erhalten |
| Rollen-/Objektkontext nicht vorbereitet | Server-only Loader mit validierter Version 1; Standard ist `unavailable` | Keine Berechtigungen aus Chat, Request oder Modellnotizen; Daten-APIs bleiben ausgeschaltet |
| Fehlgeschlagene Generationen fehlen in Nutzungsdaten | Bekannte Token und Versuchszahl auch bei Fehlern zurückgeben | Unbekannte Nutzung bleibt unbekannt; keine Kundeninhalte in Logs |
| Erneuter Versuch nach Neuladen verliert die fehlgeschlagene Eingabe | Ausstehende Eingabe lokal erhalten und ohne doppelten Kundenbeitrag erneut senden | Keine automatische doppelte Einreichung |

Die Übersicht für Alexander steht in [MORA_PORTAL_INTERFACE_CONTRACT.md](MORA_PORTAL_INTERFACE_CONTRACT.md). Es gibt einen vorbereiteten Vertragsrand, keine aktivierte Portal-Authentifizierung. Dokumente, Termine, Status, Eigentümerdaten, serverseitiger Fotoupload und bestätigter Versand bleiben fehlende Schnittstellen. Die bestehende Übergabe öffnet einen lokalen, unversendeten Serviceentwurf.

## Ausgabeformat, Sicherheit und Streaming

Das bewährte Mercury-JSON-Transportformat bleibt erhalten; native Schema- und Klartextkontrollen waren im vorangegangenen Auftrag fehlgeschlagen und wurden hier nicht erneut als angeblich neue Lösung eingeführt. Der neue Modellvertrag umfasst rund 3'540 statt 8'550 Zeichen. Das Zod-Speicherschema wird nicht zum Fragebogen. Ein normaler Turn benötigt eine Generation; nur ein verletzter Daten-/Funktionsvertrag erlaubt einen begrenzten echten Korrekturversuch. Es gibt keine Netzwerk-Retry-Schleife und keinen nachgeschalteten Textfilter, der schlechte Modellformulierungen durch Standardantworten ersetzt.

Akute Gefahren haben einen lokalen sofortigen Sicherheitspfad. Diese Antworten sind keine KI-Sprachbelege. Zusätzlich kann das Modell Gefahr erkennen; eine falsche Gefahrenklassifikation muss deshalb in der Qualitätsbewertung als Fehler auftauchen. Wortmuster zum Erkennen offensichtlicher falscher Funktionsbehauptungen sind begrenzte Prüfungen, keine vollständige semantische Wahrheitsgarantie. Unabhängig vom Wortlaut bleiben tatsächliche Aktionen auf die Allowlist beschränkt.

SDK 7 unterstützt `streamText` und partielle strukturierte Ausgaben. Der bestehende Kunde bekommt derzeit erst eine vollständig geprüfte Antwort. Ein ungeprüfter Teilstream könnte eine erfundene Übermittlung oder Datenverfügbarkeit anzeigen, bevor die Vertragsprüfung abgeschlossen ist. Streaming ist deshalb in dieser Fassung nicht aktiviert. Das nachträgliche Abspielen einer fertigen Antwort wäre kein gemessener Geschwindigkeitsgewinn. Diese Einschränkung bleibt offen; es wird kein Streaming-Erfolg behauptet.

## Prüfverfahren

`scripts/premium-cases.json` legt 30 normale KI-Szenarien und vier zusätzliche Gefahrenszenarien fest. Vorher und nachher verwenden dieselben Kundennachrichten. Ein Fall enthält ein bis drei Turns; kurze Referenzen, Korrekturen, Nichtwissen, mehrere Schäden, Mieter-, Eigentümer- und Mischrollenfragen sind enthalten. Echte Modellantworten, Aktionen, strukturierte Fakten, HTTP-Status, Laufzeiten und bekannte Nutzung werden aufgezeichnet. Signierte Sitzungen und Zugangslinks werden nicht gespeichert.

Ein 429-Nutzungslimit stoppte den überlappenden Vorher-/Pilotlauf. Nach Pause folgte der restliche Vorher-Satz mit grösserem Abstand. Die abgebrochenen Originaldaten bleiben erhalten. Nur der wegen 429 nicht bearbeitete Einzelfall wird durch seinen dokumentierten Wiederholungslauf ersetzt; echte Qualitätsfehler werden nicht aus der Auswertung entfernt. Der erfolglose Zwischenpilot wird separat ausgewiesen.

Der Hauptvergleich testet die neue Architektur mit dem dokumentierten hohen Reasoning-Aufwand gegen den bisherigen mittleren Aufwand. Damit ist die Wirkung des Gesamtstands gemessen, keine isolierte Kausalwirkung einer einzelnen Prompt- oder Schemaänderung.

Automatisierte Vertrags-, Sicherheits- und DOM-Tests verwenden ausdrücklich Mocks. Sie belegen technische Grenzen und die Übergabe, nicht natürliche Modellqualität. Die tatsächlichen Preview-API-Gespräche sind separat. Der Cloud-Browser erreichte die Vercel-Anmeldeseite; eine vollständige visuelle Browserprüfung ist damit nicht bestätigt. Die Deployment Protection wurde nicht abgeschaltet.

Der zusätzliche `/api/ai-evaluation` Prüfpfad funktioniert ausschliesslich in dieser Entwicklungs-Preview bei vorhandener Diagnosefreigabe. Er lässt nur eine feste Modell-Allowlist und neun festgelegte synthetische Szenarien zu. Normale Kundensitzungen, freie Prompts, fremde Modelle und Produktionszugriffe werden abgewiesen. Modell und Fall sind in einer getrennt markierten, signierten Testsitzung gebunden. Die MORA-Modellkonfiguration und Projekteinstellungen werden dadurch nicht geändert.

## Ergebnis der 30 KI-Szenarien

| Hauptvergleich | Vorher | Nachher |
|---|---:|---:|
| Normale KI-Szenarien | 30 | 30 |
| Ausgeführte normale Turns | 40 | 40 |
| Echte Kundenantworten mit frei formuliertem Modellwortlaut | 38 | 35 |
| Normale Fälle mit API-Abbruch | 2 | 3 |
| Zusätzliche Fälle mit irrtümlichem Sicherheitsweg | 0 | 1 (zwei Antworten) |
| Antworten mit typischen Einleitungsfloskeln, Wortsignal | 22/38 | 20/35 |
| Entwurfs-/Berichts-/Formularerwähnungen, Wortsignal | 19/38 | 19/35 |
| Antworten mit mehr als einem Fragezeichen | 1/38 | 10/35 |
| Modellantworten mit Aktionen | 24/38 | 21/35 |

API-Erfolg ist keine bestandene Qualitätsprüfung. Auch erfolgreiche Antworten enthalten unbegründete Zugriffsbehauptungen und unpassende Gesprächsschritte. Die Wortsignale sind beschreibende Zählungen, keine Intelligenzwerte. Die isolierte Zählung von «Entwurf/Bericht» sinkt zwar von 19 auf 2; mit dem nun häufigen Wort «Formular» sind es weiterhin 19. Ein bloss anderer Begriff ist kein Qualitätsgewinn.

Nachher scheitern Abfluss (13) und persönlicher Termin (21) nach dem begrenzten Vertrags-Reparaturversuch. Der Rückbezug auf den Beginn (27) endet vorher wie nachher mit Provider-HTTP-400. Ausserdem klassifiziert Mercury eine gewöhnlich funktionslose Steckdose (07) als akute elektrische Gefahr. Das ist ein Qualitätsfehler, kein erfolgreiches Sicherheitsbeispiel.

**Tatsächlich verbessert:** Die Mehrfachanliegen-Zuordnung funktioniert im zweiten Turn (05); Korrekturen hinterlassen eine aktuelle Übergabebeschreibung (02); ein Foto wird mit echter lokaler Aktion angeboten (11); Kühlschrank und Rollladen bleiben als konkrete Objekte erhalten (17/28); der Eigentümerdaten-Zugriff wird im Fall 24 korrekt verneint. Diese Verbesserungen reichen nicht für eine aussergewöhnlich kompetente Assistenz. Unter anderem geht die unbekannte Ursache im Dialektfall verloren, die Erreichbarkeit morgen 14–16 wird weiterhin nicht strukturiert übernommen, und ungesicherte Portalverweise bleiben sichtbar.

Die vollständige Einzelfallbewertung steht in [premium-case-review.json](evidence/premium-case-review.json). Sie wurde aus den tatsächlichen Antworten, Fakten und Aktionen erstellt; sie ist keine unabhängige, verblindete menschliche Produktabnahme.

## Einordnung der Qualitätskriterien

| Kriterium | Befund |
|---|---|
| Sprachqualität und Natürlichkeit | Weiter schwach: Bestätigungsrituale, Verwaltungsstil, einzelne Grammatikfehler und regelmässiger Formularfokus |
| Sympathie | Höflich, aber oft künstliches Bedauern oder routinemässiges Danken statt konkreter Hilfe |
| Kontextverständnis | Einzelne echte Verbesserungen; Nichtwissen, Widersprüche und vollständige Zusatzangaben nicht zuverlässig |
| Sachliche Richtigkeit | Rechnung korrekt; persönliche Datenzugriffe und einzelne Zuständigkeits-/Ablaufaussagen nicht zuverlässig wahr |
| Rückfragen | Kein fester Fragenkatalog im normalen Pfad; das Modell stellt dennoch zu viele oder wenig hilfreiche Fragen |
| Buttons | Reale erlaubte Aktionen, frei eingegebene Antworten bleiben möglich; die Auswahl ist nicht durchgängig gut getaktet |
| Strukturierte Daten | Mehrfachzuordnung und freie Objekte verbessert; fehlende, falsch kategorisierte oder nicht übernommene Fakten bleiben |
| Sicherheit | Geprüfte reale Gefahrenszenarien werden lokal priorisiert; falsche modellseitige Gefahrenalarme bleiben ein offener Mangel |
| Geschwindigkeit | Gemessen; in der gepaarten Stichprobe kein schnellerer Servermedian |

## Performance und Kosten

Für den faireren Geschwindigkeitsvergleich werden nur die **34 identischen Kundenturns mit erfolgreichem Modellwortlaut in beiden Versionen** verwendet. Fehlermeldungen, lokale Warnungen und die falschen Gefahrenturns zählen nicht als schnelle KI-Antworten.

| Gepaarte Messung | Vorher | Nachher |
|---|---:|---:|
| Serverzeit, Median | 4,9585 s | 5,0645 s |
| API-Testclient inklusive Transport/Proxy, Median | 10,9805 s | 10,5415 s |
| Geschätzte Standard-Tokenkosten dieser 34 Turns | 0,01757231 USD | 0,01463264 USD |
| Rechnerisch mit ausgewiesenen Cache-Tokens | 0,01567903 USD | 0,01384784 USD |

Der Servermedian liegt rund 2 % höher, die gemessene Testclient-Rundreise rund 4 % niedriger. Es gibt damit **keinen belastbaren allgemeinen Geschwindigkeitsgewinn**. Die geschätzten Standard-Tokenkosten der gepaarten erfolgreichen Teilmenge sinken um rund 17 %, mit ausgewiesenen Cache-Tokens um rund 12 %. Das ist kein Preisversprechen und keine vollständige Rechnung. Der Median der Eingabetokens über die erfolgreichen Modellantworten sinkt von 3'602 auf 1'964, rund 45 %; diese Mengen haben wegen der unterschiedlichen Fehler-/Sicherheitsfälle unterschiedliche Nenner.

Ein normaler Turn benötigt einen Modellaufruf; sieben erfolgreiche Vorher- und sechs erfolgreiche Nachher-Antworten benötigten den zweiten Vertragsversuch. Anwendungscode und Sitzungsverarbeitung kosten typischerweise nur wenige Millisekunden. Die gemessene Modellzeit umfasst den Gateway-/Provider-Rundlauf. Gateway und eigentliche Modellinferenz sind ohne zusätzliche Providerdaten nicht getrennt kausal messbar. Reine Testtransportzeit ist nicht Browser-Anzeigezeit. Der neue hohe Reasoning-Aufwand und die Architektur wurden gemeinsam getestet, daher keine isolierte Wirkungsbehauptung.

Kostenbasis: öffentlich verifizierte Mercury-2.5-Promotionspreise am 20. Oktober: 0,04 USD/M Eingabe, 0,15 USD/M Ausgabe, 0,004 USD/M Cache-Lesen. SDK-Ausgabetokens enthalten Reasoning bereits. Gateway-Generation-Audits weisen Text und Reasoning dagegen separat aus; diese Konventionen dürfen nicht doppelt gezählt werden. [premium-gateway-audit.json](evidence/premium-gateway-audit.json) enthält reale Einzelgenerationskosten und Providerzeiten als zusätzliche Stichprobe. Bei reparierten Turns ist ein einzelner erfolgreicher Generation-Audit nicht die Summe beider Aufrufe.

[premium-comparison.json](evidence/premium-comparison.json) dokumentiert Quellen, Paarbildung und Summen. Fehlende Nutzung bleibt unbekannt, insbesondere bei verweigerten Provider-Anfragen und den vor der Telemetrie-Korrektur modellseitig ausgelösten Sicherheitsantworten. Die Kosten sind deshalb als bekannte Anteile bzw. Schätzungen zu lesen. Guthaben, Budgets, Tarife, Auto-Aufladen und kostenpflichtige Einstellungen wurden nicht verändert.

## Gefahrenszenarien und abschliessende Korrektur

Rauch/Brandgeruch, Funken samt gefährlicher Folgefrage und Gasgeruch laufen in den geprüften Fällen ohne Modellaufruf. Der starke Wasseraustritt S3 benötigte im alten Build noch zwei Generationen und 11'799 ms Serverzeit, im Haupt-Nachherlauf eine Generation und 4'655 ms. Die konkret beobachtete Formulierung wird jetzt zusätzlich im lokalen, negationsbewussten Sicherheitspfad erkannt. Der tatsächliche abschliessende Preview-Retest liefert HTTP 200, `understanding=safety`, **0 Modellaufrufe und 22 ms Serverzeit**. Original-Hauptlauf und gezielter Retest bleiben getrennt erhalten. Das ist ein echter Sicherheits-/Reaktionsgewinn und ausdrücklich kein Beleg für intelligentere Modellsprache.

## Modellvergleich und Empfehlung

Mercury 2.5 ist **in der hier getesteten Konfiguration nicht ausreichend für den Premium-Anspruch**. Daraus folgt keine Aussage über jede denkbare Prompt-/Sampling-Konfiguration, keine vollständige Grenze des Modells und kein automatisch genehmigter Modellwechsel.

GPT-6 Luna und Claude Sonnet 5.5 wurden über den vorhandenen Gateway-Zugang tatsächlich angefragt. Beide Versuche endeten mit `403 no_providers_available`; es gab keine Modellantwort. Ihre Gesprächsqualität, echte Geschwindigkeit und tatsächlichen MORA-Kosten sind daher in dieser Umgebung nicht vergleichbar. Es wurde weder eine Freigabe erkauft noch ein neuer Schlüssel erzeugt.

Mercury 3 ist im aktuellen Gateway-Katalog verfügbar und war über den bestehenden Zugang nutzbar. Sein nativer Schema-Pilot scheiterte am Ausgabeformat. Anschliessend wurde derselbe explizite JSON-Transport wie für Mercury 2.5 verwendet: **neun Szenarien, zwölf ausgeführte Turns, elf echte Modellantworten, ein gescheiterter Fall**. Der normale MORA-Modellwert blieb jederzeit Mercury 2.5.

| Vergleichbare elf erfolgreiche Turns | Mercury 2.5 | Mercury 3 |
|---|---:|---:|
| Servermedian | 4,341 s | 4,486 s |
| API-Testclient-Median | 9,756 s | 10,756 s |
| Geschätzte Standard-Tokenkosten | 0,00421022 USD | 0,01523970 USD |

Mercury 3 war in dieser kleinen Stichprobe nicht schneller und kostete bei den tatsächlichen Tokenmengen rechnerisch etwa 3,6-mal so viel. Es bleiben wiederholte Formularangebote sowie falsche Aussagen über spätere Übermittlung und persönliche Eigentümerdaten. Der Waschmaschinenfall bricht schon im ersten Turn ab. Daher **keine Empfehlung für einen Wechsel auf Mercury 3** auf Grundlage dieses Tests. Verfügbarkeit und Anbieter-TTFT sind kein Nachweis besserer MORA-Gespräche.

Als nächsten belastbaren Qualitätsvergleich empfehle ich weiterhin eine leistungsfähigere Sprachreferenz wie Sonnet 5.5 und Luna als günstigeren Vergleichskandidaten, sobald der vorhandene Gateway-Zugang diese Modelle tatsächlich freigibt. Das ist eine begründete Testempfehlung, keine gemessene Überlegenheit dieser beiden Modelle. Ohne echte Antworten wird kein Sieger erfunden. Alle Zugriffssperren und Rohdaten sind archiviert.


## Kontrolltest ohne Datenvertrag

Vier weitere synthetische Gesprächsszenarien mit sechs tatsächlichen Mercury-2.5-Antworten wurden ohne JSON-Ausgabeschema, strukturierte Erfassung oder Aktionsgenerierung geprüft. Persönlichkeit und reale Funktionsgrenzen blieben, Reasoning war wie im Haupt-Nachherlauf hoch. Die erste Eingabe benötigte nur 455 Eingabetokens statt rund 2'000 im kompakten Datenpfad. Trotzdem folgen wieder Bedauern, Bestätigungen und Formularangebote. Selbst die reine Nachzahlungsrechnung endet mit einem ungebetenen Serviceformularangebot; die Eigentümerfrage verweist erneut unbegründet auf Daten in der Portalansicht.

Damit ist die JSON-/Faktenaufgabe **nicht die alleinige Ursache** des beobachteten Gesprächsstils. Geprüft ist diese konkrete Modell-/Briefingkombination, keine universelle Sprachfähigkeitsgrenze. Der Kontrollmodus ist keine funktionsfähige Kundenassistenz: Er enthält ausdrücklich keine strukturierten Fakten, Buttons oder Portalaktionen und wurde nicht für MORA aktiviert. Die Originalantworten stehen in [premium-dialogue-only.json](evidence/premium-dialogue-only.json).

## Kosten des gesamten Prüfaufwands

117 aufgezeichnete Preview-API-Anfragen inklusive Sicherheits- und abgewiesener Zugriffsversuche; 97 davon liefern ausgewiesene Tokenmengen. Diese Daten ergeben zusammen konservativ rund **0,05934 USD** Standard-Tokenkosten bzw. rechnerisch **0,05475 USD** unter Berücksichtigung der ausgewiesenen Cache-Tokens. Nicht ausgewiesene Nutzung und Hosting fehlen; das ist eine Teilsumme der protokollierten Nutzung, keine verifizierte Kontorechnung. Der tatsächliche Gateway-Audit der einzelnen Navigationsgeneration (30) bestätigt 0,000292492 USD vorher und 0,000216042 USD nachher. Die Providerzeit dieser einen Stichprobe liegt bei 3'198 bzw. 2'917 ms, die gesamte Serverzeit bei 3'279 bzw. 3'004 ms. Der kleine Rest enthält SDK-/Transport-/Anwendungsaufwand und ist keine isolierte Gateway-Latenzmessung.

| Öffentlich gelisteter Standardpreis am 20. Oktober, USD pro Million Tokens | Eingabe | Ausgabe | Tatsächlicher Testzugang |
|---|---:|---:|---|
| Mercury 2.5 | 0,04 | 0,15 | Vorher/Nachher und Klartextkontrolle |
| Mercury 3 | 0,10 | 0,35 | Neun Szenarien im separaten Prüfpfad |
| GPT-6 Luna | 0,10 | 0,50 | 403, keine Modellantwort |
| Claude Sonnet 5.5 | ab 2 | ab 10 | 403, keine Modellantwort |

Preise können nach Anbieter, Tarif, Kontext und Promotion abweichen. Die verweigerten Modelle haben keine messbaren Gesprächskosten oder Antwortlatenzen in diesem Test; die Fehler-Rundreise ist keine Modellgeschwindigkeit. Der Vergleich ist in [premium-model-comparison.json](evidence/premium-model-comparison.json), die Gesamtkostengrundlage in [premium-cost-summary.json](evidence/premium-cost-summary.json) dokumentiert.

## Technische Prüfung und Grenzen

**231 automatisierte Tests bestanden**, Typecheck, Syntax-/Assetprüfung und Build bestanden. Die Tests umfassen bestehende Portalübergabe und lokale Fotos, normale Texteingabe, erlaubte und unerlaubte Aktionen, Sitzungen, Providerfehler, MORA-Kontextgrenzen, Doppelrollen-Vertrag, Korrekturen, unbekannte Werte, Mehrfachanliegen, freien Objektnamen im bestehenden Formular, Wiederholung nach Neuladen, Gefahrenerkennung und Isolation des Modellprüfpfads. Mock-basierte DOM-Tests bei 1280 und 390 Pixeln belegen die technischen Abläufe, keine visuelle Browserabnahme oder KI-Sprachqualität.

Offen bleiben die Premium-Gesprächsqualität, vollständige semantische Wahrheit der Modellformulierungen, falsche Gefahrenklassifikationen, einzelne verlorene Zusatzangaben, Modellvertrags-/Providerfehler und Streaming. Rollenvertrag und Navigation ersetzen keine Portal-Authentifizierung oder tatsächlichen Datenzugriff. Die realen Schnittstellen müssen durch Alexander bereitgestellt und separat integriert werden. Eine allgemeine Absicherung beliebiger individueller Rechts-, Kosten- oder Zuständigkeitsaussagen wird durch die aktuellen Wortmuster nicht garantiert.

## Versions- und Belegzuordnung

- Vorher: `a045fa9587b5b5735fbf45aa51f7733b164ad461`, `premium-before.json` und `premium-before-rest.json`.
- Kompakter Zwischenpilot: `7b8e2a9`, `premium-pilot.json`; nicht als finale Qualität ausgegeben.
- Haupt-Nachherlauf: `5b1bca406c872177e604f7943047e7b156454a12`, `premium-after.json`.
- Danach nur Prüfpfad/Telemetrie sowie die gezielte zusätzliche Gefahrenerkennung; der normale MORA-Dialogauftrag bleibt gleich. Abschliessender S3-Retest: `e39c160`, `premium-final-flood.json`.
- Luna-/Sonnet-Zugriffsversuche: `3d69270`, `premium-luna.json`, `premium-sonnet.json`.
- Mercury-3-Nativschema-Pilot: `2b8b372`, `premium-mercury3-pilot.json`; Schemafehler, kein qualitativer Sprachbeleg.
- Mercury-3-JSON-Vergleich: `241f60e`, `premium-mercury3-json-pilot.json`, `premium-mercury3-json-rest.json`.
- Kontrolltest ohne Schema: `0ff4862`, `premium-dialogue-only.json`.

Die späteren Bericht-/Belegdateien ändern keine Modellantworten. Die Hauptauswertung ersetzt ausschliesslich den unterbrochenen Vorher-429-Fall und den gezielt reparierten Wassersicherheitsfall durch die dokumentierten Wiederholungen. Weitere tatsächliche Qualitätsfehler bleiben sichtbar.

## Preview und Schutzvorgaben

MORA-Modell unverändert `inception/mercury-2.5`, vorhandener Gateway-Zugang. Keine neuen Schlüssel, keine kostenpflichtigen Einstellungen, kein Merge und kein Produktionsdeployment. `main` bleibt `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` bleibt `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Alle Branch-Updates verwenden den erwarteten Kopfstand ohne erzwungenes Überschreiben. Portal-HTML, Gestaltung/CSS, Portaladapter und bestehende Requests-Schnittstelle sind gegenüber dem Ausgangsstand unverändert; Anpassungen an der Übergabe liegen im MORA-Client.

Getestete MORA-Hauptpreview: https://morada-mora-jdc7em8qi-dianaporschke-1255s-projects.vercel.app/ . Abschliessende Code-Preview mit Wassersicherheitskorrektur und getrennten Prüfpfaden: https://morada-mora-eulbaozpt-dianaporschke-1255s-projects.vercel.app/ . Beide sind Vercel-Previews desselben Entwicklungsbranches, keine Produktion. Die abschliessende Bericht-Preview wird im Abschluss genannt. Diese Version ist überprüfbar, aber **nicht als Premium-Kundenassistenz abgenommen**.

## Primärquellen

Abgerufen am 20. Oktober 2026; eigene Modellmessungen sind davon getrennt:

- https://ai-gateway.vercel.sh/v1/models
- https://vercel.com/ai-gateway/models/mercury-2.5
- https://vercel.com/ai-gateway/models/mercury-3
- https://vercel.com/ai-gateway/models/gpt-6-luna
- https://vercel.com/ai-gateway/models/claude-sonnet-5.5
- https://vercel.com/docs/ai-gateway/models-and-providers/reasoning
- https://vercel.com/docs/ai-gateway/pricing
- Versionsgleiche SDK-Dokumentation: `node_modules/ai/docs/03-ai-sdk-core/10-generating-structured-data.mdx`, Gateway `00-ai-gateway.mdx` (Generation-Informationen).
