# MORA – Alltagssprache und passende Rückfragen

## Anlass und nachgewiesene Ursache

Die Kundin meldet «meine lampe geht nicht», ergänzt «wohnzimmer» und erhält eine Frage nach Deckenleuchte und geprüftem Leuchtmittel. Die Antwort stammt vom Modell, nicht aus einer lokalen Lampenvorlage. Die bisherige technische Prüfung kontrollierte vor allem Fakten, Fähigkeiten und Speicherung. Sie prüfte nicht ausdrücklich, ob eine Defektmeldung in eine ungewünschte technische Fehlersuche umgedeutet wurde. Fragen im Antworttext konnten ausserdem am optionalen strukturierten `ask`-Feld vorbeigehen.

## Änderung

`lib/mora/portal/conversation-policy.js` definiert ein gemeinsames Gesprächsziel für Erzeugung und Prüfung: Kundinnen und Kunden können melden, was nicht funktioniert und wo, ohne Fachwissen oder eigene technische Prüfungen. Bei ausreichenden Kerndaten werden keine unnötigen Bauteil-/Typenfragen verlangt. Tatsächlich mehrdeutige Angaben dürfen weiterhin gezielt geklärt werden. Ausdrücklich gewünschte sichere Selbsthilfe und Begriffserklärungen bleiben erlaubt. Sicherheitshinweise haben Vorrang.

Die bestehende semantische Prüfung in `lib/mora/portal/service.js` erkennt nun zusätzlich unaufgeforderte technische Fehlersuche, unnötige Mehrfachfragen und unverständliche Fachsprache. Sie erhält dafür die aktuelle Formularbereitschaft und den Sicherheitsstatus. Beanstandete Modellantworten werden vor Anzeige verworfen und höchstens einmal neu erzeugt; bei erneutem Fehlschlag erscheint keine erfundene Ersatzantwort. Es gibt keine fest programmierten Kundensätze und keine Wort-Verbotsliste.

Keine zusätzlichen regulären Modellaufrufe: Die neue Prüfung wird im bereits vorhandenen Prüfschritt ausgeführt. Reparaturen können weiterhin zusätzliche Zeit und Kosten verursachen. Eine semantische Modellprüfung ist keine Garantie, jede unpassende Formulierung zu erkennen.

## Regressionen

40 MORA-Portaltests bestanden, darunter drei neue Prüfungen: technische Frage ohne `ask` wird nach einer Beanstandung vor Anzeige repariert, wiederholte Beanstandung bricht ohne Übernahme der abgelehnten Fakten ab, und eine gewünschte Erklärung des Wortes «Leuchtmittel» bleibt möglich. Typprüfung, Build und Diff-Prüfung bestanden. Die kontrollierten Antworten dieser Regressionstests sind Testdaten; echte Modellgespräche werden separat dokumentiert.

## Umfang

Nur `codex/mora-ai-2.0`, keine Änderungen an `main` oder `alex-portal`. Keine Änderungen an Portal-HTML, Design, vorhandener Speicherung, API-Schlüsseln oder Abrechnungseinstellungen. Das bereits begrenzte Testbudget bleibt bestehen. Modell weiterhin `google/gemini-3.8-flash` über das geschützte Backend.

## Echte Modellgespräche am 26. Oktober 2026

Die Dateien unter `docs/evidence/portal-plain-language-*2026-10-26.json` enthalten echte Backendantworten, Statuscodes, Aufrufzahlen, Messzeiten und lesende Guthabenabfragen. Sitzungstokens und geschützte Zugangslinks wurden entfernt. Die Regressionen mit kontrollierten Testantworten werden nicht als Modelltests gezählt.

| Lauf | Ergebnis | Beobachtete Kontodifferenz USD |
| --- | --- | ---: |
| Fünf Gespräche: Lampe, Heizung, Begriffserklärung, unklarer Rollladen, Funken | 11 von 13 Nachrichten HTTP 200; 33 Modellaufrufe | 0.06836850 |
| Separates Lampengespräch, gleiche Verhaltensänderung mit genauerer Fehlerdiagnose | 3 von 3 Nachrichten HTTP 200; 8 Modellaufrufe | 0.01662375 |
| Separater vollständiger Lampenablauf mit nativer Portal-HTML | Bestanden, einschliesslich Speichern und Raumkorrektur | 0.02020350 |

Die Kontodifferenz ist die vom Gateway gemeldete Veränderung während des jeweiligen Laufs, keine exakt einem Gespräch zugeordnete Rechnung; externe Nutzung und verzögerte Verbuchung sind damit nicht ausgeschlossen. Abrechnungseinstellungen und das bestehende begrenzte Preview-Testbudget wurden nicht geändert.

Die Summe dieser drei beobachteten Laufdifferenzen beträgt 0.10519575 USD. Der abschliessende native Test führte echte Modellgespräche und die unveränderten HTML-Portalfunktionen in JSDOM aus. Nach Vorbereitung war noch nichts gespeichert; erst der native Speichervorgang legte genau einen Eintrag an. Lampe / Leuchte und Wohnzimmer wurden geprüft. Die anschliessende Korrektur zu Schlafzimmer aktualisierte denselben Eintrag unter derselben ID. Doppeltes Klicken/Speichern erzeugte keinen zweiten Eintrag. Ein lokales Testfoto blieb diesem Anliegen zugeordnet. Bei einem gezielt ausgelösten Speicherfehler blieben die zuvor gespeicherten Daten unverändert und es erschien kein zusätzlicher Erfolgsbeleg. Die Speicherfehler-Simulation prüft die Fehlerbehandlung; sie ist kein behaupteter echter Gatewayfehler. JSDOM ersetzt hier einzelne Browser-APIs und ist keine visuelle Geräteprüfung.

### Wörtliche Antworten aus dem Wiederholungstest

Kunde: «meine lampe geht nicht»

MORA: «In welchem Raum befindet sich die Lampe?»

Kunde: «wohnzimmer»

MORA: «Möchten Sie, dass ich die Meldung für die Lampe im Wohnzimmer vorbereite?»

Kunde: «Es ist nur eine Lampe, sonst ist alles normal.»

MORA: «Die Angaben sind vollständig vorhanden. Geben Sie mir einfach Bescheid, wie Sie weiter vorgehen möchten.»

Diese Antworten stammen vom Modell. Es gibt keine lokale Ersetzung durch diese Sätze. Die letzte Antwort benötigte eine Reparatur nach einer Beanstandung der Kategorie `unsupported_effect`. Die Frage nach eigener Prüfung oder technischen Bauteilen trat in diesen Lampenantworten nicht auf. Die letzte Formulierung ist trotzdem weiterhin förmlich; dies ist keine belegte allgemeine Perfektion der Gesprächsqualität.

### Fehler und Grenzen

- Im ersten Lauf scheiterte die dritte Lampennachricht nach zwei abgelehnten Kandidaten mit HTTP 503 (`invalid_model_output`, vier Modellaufrufe). Die damaligen Logs enthalten nicht die einzelnen Beanstandungskategorien; die genaue sprachliche Ursache dieses Fehlschlags ist daher nicht nachgewiesen. Der erfolgreiche Wiederholungstest beweist keine Beseitigung dieser zufallsabhängigen Ausfälle.
- Eine Folgefrage zur Begriffserklärung scheiterte vor dem ersten Modellaufruf mit HTTP 503 nach 5.007 Sekunden. Zusammen mit dem Gateway-Fehler im Laufzeitlog weist dies auf die vorgeschaltete Guthabenabfrage hin. Die Modellantwort kann für diese Nachricht nicht bewertet werden.
- Der erste Start der zusätzlichen nativen Portalprüfung wurde ebenfalls schon bei der lesenden Vorabprüfung mit HTTP 503 abgebrochen; keine Modellkonversation dieses Starts wurde begonnen. Die konkrete Antwortursache wurde vom bestehenden Testskript nicht gespeichert. Ein separater neuer Lauf wurde begonnen; kein automatischer Replay einer fehlgeschlagenen Modellnachricht.
- Mechanische Formulierungen wie «Ich habe ... notiert» sowie wiederholte Vorbereitungsangebote kommen weiterhin vor. Sie wurden nicht nachträglich aus den Evidenzdateien entfernt.
- Im nativen Lampentest blieben Einrichtung, Anzahl und korrigierter Raum erhalten. Der Zusatz «sonst ist alles normal» erschien jedoch nicht in der gespeicherten Beschreibung. Die bestandenen Speichertests sind deshalb kein Nachweis einer vollständigen Übernahme jeder Nebenangabe; dieser schon zuvor beobachtete Extraktionsmangel ist durch die Gesprächsänderung nicht behoben.
- Die erste unklare Fensterbeschreibung führte zunächst zu einer Raumfrage statt zur Klärung des Gegenstands. Nach der Kundenpräzisierung erkannte MORA den Rollladen. Nicht jede Rückfrage ist damit bereits optimal.
- Bei «gefunkt» riet das Modell vom Einschalten und Berühren ab. Dies ist ein einzelner Sicherheitsfall, keine vollständige Sicherheitszertifizierung.

## Antwortzeiten

Im erfolgreichen Lampen-Wiederholungstest betrug die Backendzeit 3.647, 3.893 und 8.212 Sekunden. Davon entfielen 3.285, 3.593 und 7.282 Sekunden zusammen auf Gateway und Modell; 0.322, 0.287 und 0.917 Sekunden auf die Guthabenprüfung. Gateway und Modell werden hier nicht getrennt gemessen. Die Reparatur verlängerte die dritte Antwort.

Die Testtransportzeiten lagen bei 8.056, 8.009 und 12.588 Sekunden und enthalten den geschützten Testzugang sowie die Testumgebung. Das sind keine gemessenen Browser-Antwortzeiten für Kunden. Es gab in diesem Auftrag keine neue visuelle Desktop-/Mobilprüfung und keine Streamingänderung. Die lokale Erzeugung und Anzeige darf nicht als sofortige Speicherung oder Übermittlung an MORADA ausgegeben werden.

## Testversion

Getesteter Backendstand: `f0efd058f46fc50cdd7dd7052316604136e02eb8`.

Preview: https://morada-mora-ftwe9paod-dianaporschke-1255s-projects.vercel.app/portal.html

Die Gesprächsänderung liegt in `2cc6dac07e9a4df52e748b0f69934470a337d2e9`. Der anschliessende Commit ergänzt nur Fehlerkategorien in privaten Laufzeitlogs, ohne Kundentexte, Modelltexte, Prüferbegründungen oder Zugangsdaten zu protokollieren. Er behebt den beobachteten Antwortausfall nicht durch eine weitere Verhaltensänderung.

Portal-HTML unverändert, SHA-256: `09a2a977582e7ca68369453bbe54770b8a937df0bedb66630ad16b71e6de37bb`.
