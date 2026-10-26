# MORA: Gesprächsdaten und Aktionen zusammenhalten

## Ausgangspunkt

Die letzte Korrektur der technischen Rückfragen beseitigte kein grundsätzliches Qualitätsproblem. Im vorherigen Live-Test blieben mechanische Angebote, einzelne abgelehnte Antworten und ein verlorener Zusatz («sonst ist alles normal»). Diese Runde prüft deshalb die Verarbeitung und die vollständigen Gespräche erneut. Kein Anspruch auf eine einwandfreie oder generell «intelligentere» Assistenz allein aufgrund bestandener Softwaretests.

## Nachgewiesene technische Ursachen und Änderungen

1. Die Portaloberfläche berechnete ihre Aktionen in `api/portal-chat.js`, während das Modell den Aktionsstatus der älteren App aus `draftActionState` erhielt. Sicherheitsstatus, Formularöffnung, Themenwechsel und Verfügbarkeit wurden zusätzlich an anderen Stellen geprüft. `lib/mora/portal/action-state.js` ist jetzt die gemeinsame Entscheidung für UI, Modellkontext und Aktionsvalidierung. Sie trennt fehlende Kerndaten, verfügbares/angebotenes Formular, offenes Formular, Speicherbeleg, ausstehende Änderung, Fehler und Sicherheitsblockade. Ein sichtbares Angebot bleibt anklickbar, wird aber nicht als neues Angebot ausgewiesen. Tatsächliche Übermittlung bleibt ausgeschlossen.
2. Ein `draft-error` wurde zuvor genau wie ein erfolgreich geöffnetes Formular behandelt. Dadurch konnte `controls.save` nach einem Fehler verschwinden. Der Fehlerstatus gibt jetzt den erneuten Versuch frei; er gilt nicht als vorbereitet.
3. Sprachfehler lösten bisher eine komplette Neuerzeugung von Antwort, Daten und Aktionen aus. Die neue Reparatur hat einen eigenen strikten Vertrag mit ausschliesslich `reply` und optional `ask`. Erkennt die Prüfung ausschliesslich einen Antwortfehler, bleiben Anliegenänderungen, Referenzen und angeforderte Aktionen eingefroren. Der überarbeitete Text wird nochmals semantisch und technisch geprüft. Ein Fakten-/Aktionsfehler benötigt weiterhin eine vollständige Korrektur. Es gibt höchstens einen Reparaturversuch, keine simulierte Ersatzantwort.
4. Wiederholte Angebote waren im Prüfprompt als `unsupported_effect` einsortiert, genauso wie unwahre Speicher-/Versandbehauptungen. `repeated_offer` bezeichnet jetzt den Gesprächsfehler, und `target` unterscheidet Antwort, Daten und Aktion. Der Prüfschritt erhält dieselbe native Aktionsentscheidung wie die Oberfläche.
5. Zusätze gingen schon beim Extrahieren verloren: Das Modell konnte nur einen Teil einer Nachricht zitieren und die restliche Beobachtung übergehen. Die Portal-Datenbeschreibung und semantische Prüfung verlangen jetzt alle ausdrücklichen Zusatzbeobachtungen, auch negative, und vergleichen die ganze Nachricht mit den projizierten Fakten. Das ist eine modellgestützte Vollständigkeitsprüfung, keine deterministische Garantie. Die aktuelle Beschreibung und echte gespeicherte Daten werden zusätzlich im Live-Test geprüft.

Keine festen Dialoge, keine lokale Umformulierung einer KI-Antwort, kein Modellwechsel. Weiterhin `google/gemini-3.8-flash` über das vorhandene geschützte Gateway. Keine neuen Schlüssel, keine Änderung von Abrechnung oder Guthabenlimit.

## Automatisierte Prüfung

351 Tests bestanden, einschliesslich 49 Portaltests. Neun neue Regressionen prüfen gemeinsamen Aktionsstatus, erneuten Versuch nach Formularfehler, Korrektur mit erhaltenen Zusatzangaben, Sicherheit/Themenwechsel/fehlenden Zugriff, unveränderliche Fakten bei Textreparatur, abgewiesene Dateninjektion in den Textvertrag, notwendige vollständige Faktenreparatur, richtige negative Versandantworten, unabhängige Detailfragen und genau einmal übergebene ausstehende Nachrichten. Mehrere Aspekte sind in einem Test zusammengefasst. Kontrollierte Testantworten sind ausdrücklich keine echten KI-Gespräche.

Typprüfung, Build (116 Quelldateien) und Diff-Prüfung bestanden. Die bereitgestellte Portal-HTML und ihr Design sind unverändert. Keine neue visuelle Desktop-/Mobilprüfung; die vorhandenen nativen Speicherabläufe werden mit JSDOM und echten Backendantworten geprüft.

## Erneut dieselben 20 vollständigen Gespräche

Unveränderte Kundenfälle aus `scripts/quality-phase1/cases.json`, 52 Nachrichten, echtes `google/gemini-3.8-flash`. Der Lauf prüfte den Zwischenstand `e55a407`; spätere Korrekturen werden getrennt nachgetestet. Nachweis: `evidence/portal-turn-contract-quality-2026-10-26.json`.

| Messung | Frühere Gemini-Reihe | Neuer Zwischenstand |
| --- | ---: | ---: |
| HTTP 200 | 52/52 | 48/52 |
| Modellaufrufe | 97 | 118 |
| Antworten mit «vorbereit…» | 26 | 11 |
| Antworten mit «Dank…» | 5 | 0 |
| Antworten mit «notiert/vermerkt/aufgenommen/erfasst/ergänzt» | 11 | 18 |
| Median Backend | 4.782 s | 4.528 s |
| Maximum Backend | 32.192 s | 10.794 s |
| Beobachtete Kontodifferenz USD | 0.18972825 | 0.28174275 |

Das sind Wortzählungen und Messwerte eines Durchlaufs, keine automatischen Intelligenznoten. Die neue Reihe zeigt weniger ausdrückliche Vorbereitungsangebote, aber mehr Erfassungsberichte und vier technische Antwortausfälle. Sie belegt daher **keine durchgehend bessere Gesprächsqualität oder Zuverlässigkeit**. Die Medianänderung beweist keine allgemeine Beschleunigung. Gateway und Modell werden zusammen gemessen; HTTP-Messungen enthalten zusätzlich den Test-Netzwerkpfad. Kein Streaming und kein neues gerendertes Browser-Timing.

Die strukturierten Ergebnisse der erfolgreichen Fälle: Lampe/Wohnzimmer/Anzahl 1 sowie «sonst ist alles normal» erhalten; Steckdose/Küche/heute einschliesslich negativer Beobachtungen und funktionierender weiterer Steckdosen erhalten; unbekannter Heizungsbeginn bleibt unbekannt; Raumkorrektur ergibt Schlafzimmer mit Anzahl 1 und weiter funktionierenden Geräten. Nach Themenwechsel bleiben Bad und Beginn gestern beim Wasserhahn. Lampe/Flur/heute und zwei Heizkörper/Bad/gestern bleiben zwei getrennte Anliegen. Allgemeine Übergabe-/Eigentümerfragen erzeugen keine Anliegen. Rollladen/Kinderzimmer/heute Morgen wird erkannt, jedoch ist die erste Raumfrage weiterhin unpassend priorisiert. Bei späteren Funken sind Formularaktionen gesperrt, auch nach Ausschalten. Dunkle Flecken bleiben dieses Mal eine bekannte Beobachtung, ohne bestätigte Schimmeldiagnose. Umgangssprache, Beginn gestern, Erreichbarkeit und negative Beobachtungen werden zusammen behalten. Unsichere Anzahl wird am Ende korrekt auf genau eine Lampe korrigiert.

Weiterhin offen: Erfassungsberichte, unnötige Rückfragen, pauschale fachliche Antworten und unbestätigte Hinweise auf persönliche Dokumente. Einzelne Sicherheitssätze sind zu absolut formuliert. Das ist keine fachliche/juristische Zertifizierung und keine Kundenfreigabe.

## Durch den vollständigen Lauf aufgedeckte lokale Fehlprüfungen

Vier Antworten scheiterten: die drei Nachrichten zum Wasser unter dem Lavabo und die Rückfrage «Ist es jetzt schon gesendet?». Die echten Ausfälle bleiben in der Evidenz erhalten.

- Beim Versandfall zeigen die Logs zweimal `Operational success belongs to receipt UI`. Der bisherige reguläre Ausdruck erfasste auch reine Verneinungen. Die neue lokale Prüfung akzeptiert klar begrenzte vollständige Negativsätze. Positive Erfolge, gemischte Aussagen und «nicht nur» bleiben blockiert. Die semantische Prüfung bleibt zusätzlich bestehen.
- Ein weiterer Logeintrag blockierte eine Rückfrage allein deshalb, weil `details` schon irgendeinen Wert enthielt. Details und Umfang sind Sammelfelder mit mehreren unabhängigen Beobachtungen. Neue Fragen dazu werden jetzt semantisch auf tatsächliche Wiederholung geprüft; Raum, Anzahl und andere einzelne Fakten behalten ihre lokale Wiederholungssperre.
- Ausstehende, noch nicht beantwortete Kundennachrichten wurden sowohl als Geschichte als auch erneut im aktuellen Nachrichtenblock übergeben. Sie werden jetzt nur einmal als aktueller Beleg gesendet. Inhalte werden nicht entfernt.
- Die Regel «bei Defekt ohne Raum zuerst nach dem Raum fragen» wurde entfernt. Sie konnte die sinnvolle Klärung eines noch unverständlichen Problems verdrängen. Kein neuer fester Dialogbaum ersetzt sie.
- Die Antwortreparatur erhält eine eigene kurze Aufgabenbeschreibung und den projizierten Aktionszustand. Sie erhält keine widersprüchliche Aufforderung mehr, erneut Extraktionsfelder oder Aktionen auszugeben.

Die genaue Ursache jeder ersten Wasser-Beanstandung war mit den damaligen datensparsamen Logs nicht vollständig rekonstruierbar. Es wäre falsch, sämtliche Wasserausfälle allein der Nachrichtenduplizierung zuzuschreiben. Statische Vertragsfehler werden künftig genauer benannt, ohne Kundentexte oder Modellantworten zu protokollieren.

## Teststand

Zwischenstand der vollständigen 20er-Reihe: `e55a407d31b81ef5754d43654cfce74be3e4b96b`. Die anschliessenden lokalen Validierungsfehler wurden in `b65bbb91e8a3df852ea1add7fb6fcef59dd20f6c` korrigiert. Ausschliesslich `codex/mora-ai-2.0`.

Der Nachtest dieses zweiten Stands enthält 3 vollständige Gespräche / 8 Nachrichten. Sieben Antworten wurden erfolgreich geliefert. Das unklare Fensterproblem wird zuerst durch eine Frage nach dem Gegenstand geklärt. Die Versandfrage erhält wörtlich: «Nein, es wurde nichts gesendet. Ein automatischer Versand oder eine Weiterleitung an MORADA ist über dieses System nicht möglich.» Beim Wasserfall klappten die ersten beiden Antworten, die dritte wurde zweimal wegen `unsupported_fact` abgewiesen. Zudem enthielt die zweite Antwort eine unbestätigte Annahme über einen bereits aufgestellten Behälter. Dieses Problem wird nicht als gelöst gewertet. Kosten dieses Laufs: 0.04339650 USD. Nachweis: `evidence/portal-turn-contract-retest-2026-10-26.json`.

Eine anschliessende begrenzte Hypothese wurde geprüft und verworfen: `62ada37e48c4909131aadf3db6044d0a79461433` verwendete nur in der einmaligen vollständigen Faktenreparatur `reasoning: high`. Der Wasserfall lieferte erneut nur 2 von 3 Antworten, die dritte brauchte 33.021 Sekunden im Testtransport und scheiterte weiterhin. Kosten: 0.03457725 USD; Nachweis `evidence/portal-turn-contract-water-final-2026-10-26.json`. Dieser Versuch belegt keinen Vorteil und wurde mit `48288b190a1d275ed55eb091c6b4059b4bfbbf28` vollständig zurückgenommen. Der endgültige Codebaum entspricht wieder exakt `b65bbb91e8a3df852ea1add7fb6fcef59dd20f6c`, für den die 351 Tests bestanden. Die kurzzeitig getestete Einstellung wird nicht als Verbesserung ausgeliefert.

Getestete Preview des beibehaltenen Codebaums: https://morada-mora-dds4srk1w-dianaporschke-1255s-projects.vercel.app/portal.html

Der abschliessende native Speichertest dieses Codebaums bestand für beide vollständigen Abläufe: Lampe mit kurzen Antworten, ausdrücklicher Vorbereitung, Speichern, Raumkorrektur, Foto und kontrolliertem Speicherfehler; ausserdem zwei gleichzeitig genannte Anliegen mit getrennten Einträgen. Die Lampe bleibt derselbe Datensatz mit Anzahl 1, korrigiertem Schlafzimmer und erhaltener negativer Zusatzbeobachtung. Doppelklicks erzeugen keine Duplikate, ein fehlgeschlagener lokaler Schreibvorgang erzeugt keinen Erfolgsbeleg. Die zwei Anliegen sind die Lampe im Wohnzimmer und der lose Türgriff im Flur. Dies sind echte Modellantworten und echte native HTML-Speicherfunktionen unter JSDOM, keine simulierten KI-Erfolge und keine neue gerenderte Geräteprüfung. Nachweis: `evidence/portal-turn-contract-native-2026-10-26.json`; 0.02797650 USD Kontodifferenz.

Gesamte beobachtete Kontodifferenz dieser Runde: **0.38769300 USD**. Abschliessend gemeldetes Guthaben: 23.846789618 USD; innerhalb der bestehenden 1-USD-Testfreigabe verbleiben rund 0.22 USD beobachteter Verbrauch. Das sind Kontoabfragen, keine exakt isolierte Abrechnung je Gespräch; fremde Nutzung/verzögerte Verbuchung sind grundsätzlich nicht ausgeschlossen. Keine weitere Zahlung oder automatische Aufladung, keine Änderung des Testlimits. Es wurden keine neuen API-Schlüssel angelegt.

`main` und `alex-portal` bleiben unverändert. Kein Merge, kein Produktionsdeployment.

## Technische Empfehlung und ehrliche Einordnung

Das angestrebte Kundenerlebnis ist nicht erreicht. Weitere Wortverbote oder pauschal mehr Rechenaufwand sind durch diese Ergebnisse nicht gerechtfertigt. Bewährte Teile sind der native Portaladapter, die unveränderlichen Vorgangs-IDs, die gespeicherten Belege und jetzt die gemeinsame Aktionsentscheidung. Diese Teile sollen erhalten bleiben.

Für den nächsten kontrollierten Architekturvergleich empfehle ich einen kurzen Gesprächsauftrag mit wenigen typisierten Werkzeugen für Anliegenangaben und Formularvorbereitung. Das Modell soll nicht in jeder Antwort gleichzeitig alle Datenfelder, einen Gesprächssatz und die anschliessende Prüferreaktion steuern müssen. Daten-/Aktionsfehler brauchen eine gezielte Rückmeldung zum betroffenen Werkzeug; eine harmlose Stilabweichung darf keine vollständige Kundennachricht verwerfen. Erfolgsaussagen bleiben an echte Belege gebunden. Das ist eine technische Empfehlung, kein bereits implementierter oder nachgewiesen besserer Gesamtumbau.

Eine solche Variante muss vor Übernahme dieselben 20 Dialoge und die nativen Speicherabläufe bestehen: keine verlorenen bestätigten Angaben, kein falscher Versand-/Speichererfolg, keine doppelten Datensätze, richtige Korrekturen und klare Behandlung unsicherer Beobachtungen. Natürlichkeit ist zusätzlich anhand vollständiger Antworten zu bewerten. Die aktuelle Runde ersetzt diesen Nachweis nicht und rechtfertigt keinen Kundeneinsatz.
