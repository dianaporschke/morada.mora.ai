# MORA – bezahlter Modelltest vom 26. Oktober 2026

## Freigabe und Umfang

Die Nutzerin hat den einmaligen Kauf von 20 USD Gateway-Guthaben per Screenshot bestätigt. Der erste Live-Preflight bestätigte danach 24,625845368 USD verfügbares Guthaben bei 0,374154632 USD bisherigem Gesamtverbrauch. Die Testfreigabe umfasst höchstens 1 USD zusätzlichen beobachteten Kontoverbrauch, nicht die automatische Aufladung oder den produktiven Kundenbetrieb.

Arbeitsbranch: `codex/mora-ai-2.0`. Getesteter Code: `3a6f1abdedaf9338d3e35bb54752d4730fe90018`. Nur Preview, keine Änderungen an main, alex-portal, Portaldesign, Rollen, Schlüsseln oder Produktion.

Preview: https://morada-mora-3rza4z77y-dianaporschke-1255s-projects.vercel.app/portal.html

## Nachgewiesene Zugangsstörung und Korrektur

Der bisherige Gateway-Fehler war HTTP 403 `no_providers_available`. Die private Fehlerdiagnose meldete ausdrücklich, dass das Modell im kostenlosen Tarif nicht verfügbar ist. Nach dem Guthabenkauf hätte zusätzlich die eigene MORA-Prüfung weiter blockiert: Sie verlangte `balance + totalUsed == 5` und lehnte damit jede Aufladung ab.

`lib/mora/portal/budget.js` akzeptiert jetzt ausschliesslich den bestätigten Gesamtbetrag von 25 USD und begrenzt den beobachteten Gesamtverbrauch auf 1,374154632 USD. Vor jedem Modellaufruf werden Guthaben und eine konservative Reserve für diesen Aufruf geprüft. Unbekannte Preise, unlesbare Werte, andere Guthabenstände und Nicht-Preview-Umgebungen blockieren. Der neue Fehlercode und die Kundenmeldung nennen korrekt das Testbudget. Es wurden keine Vercel-Abrechnungseinstellungen verändert.

Diese Prüfung ist eine Anwendungssperre für sequentielle Tests. Sie ist wegen verzögerter Kontobuchung und fehlender atomarer, gemeinsam genutzter Reservierung kein harter Schutz für parallelen Produktivverkehr. Für den Kundenbetrieb werden eine eigene serverseitige Verbrauchskontrolle und ein separat freigegebenes Betriebsbudget benötigt.

## Was tatsächlich vom Modell stammt

Alle `reply`-Felder der neuen Live-Nachweise stammen von `google/gemini-3.8-flash` über die bestehende geschützte HTTPS-API. Der Modellname und die Preise wurden im vollständigen aktuellen Gateway-Katalog geprüft. Es gibt keine Ersatz- oder Mock-Antworten in diesen Gesprächsnachweisen.

Die Begrüssung, Statushinweise, Buttons, Sicherheitshinweise und Speicherbestätigungen stammen aus der Anwendung. Der Chattext wird durch Systemprompt, JSON-Schema, strukturierte Gesprächsdaten und meist einen zweiten semantischen KI-Prüfaufruf beeinflusst. Abgelehnte Ausgaben können einen erneuten Entscheidungs- und Prüfdurchlauf auslösen. Im nativen Speichertest wird das vollständige gelieferte HTML ausgeführt; JSDOM ersetzt nur fehlende Browser-APIs. Das ist kein gerenderter Mobilgerätetest.

## Erster End-to-End-Nachweis

Echter Verlauf: `lampe kaputt` → `wohnzimmer` → `Bitte bereiten Sie das Anliegen jetzt vor.` → natives Formular speichern → `Nein, ich meinte Schlafzimmer.` → vorhandenes Anliegen aktualisieren.

Ergebnis: Einrichtung Lampe / Leuchte, Fachbereich Elektrik / Beleuchtung, native Kategorie Schaden / Reparatur. Raum zuerst Wohnzimmer, danach Schlafzimmer; dieselbe Anliegen-ID bleibt erhalten. Beginn bleibt Nicht angegeben. Wiederholte Klicks und doppelte Formular-Submits erzeugen keinen zweiten Datensatz. Erst nach Rücklesen des nativen Speichers wird Speicherung bestätigt. Kein Versand an MORADA.

Kontoverbrauch für diesen Durchlauf: 0,01959525 USD. Nachweis: `evidence/portal-paid-gemini-pilot-2026-10-26.json`.

## Automatisierte Regression

336 Tests bestanden, keine übersprungenen Tests; zusätzlich Typprüfung, Build und Diff-Prüfung bestanden. Darunter native Speicherung/Rücklesen, Raumkorrektur, getrennte Anliegen, Anhänge, Doppelklicks, Speicherfehler, ausgebliebene Empfangsbestätigung, Schutz manueller Änderungen und unveränderte HTML-Quelle. Diese Regressionen verwenden kontrollierte Modell-Testdaten und sind von den echten Modellgesprächen getrennt zu bewerten.

## Bereits im Code nachgewiesene Ursachen

- Wiederholte Formularangebote: `portal/service.js` übergibt an `projectDecision` und `commitDecision` absichtlich `actions: []`, weil Portalaktionen separat berechnet werden. `commitDecision` merkt sich ein Angebot jedoch nur bei einer `handover`-Aktion. Der übernommene Angebotsmerker wird damit auf diesem Pfad nicht gesetzt. Ein vorhandener Speicherbeleg wird korrekt übergeben; ein schon sichtbares, noch nicht ausgeführtes Angebot ist dagegen nicht gleichwertig erfasst.
- Mechanische Sätze: Die Live-Ausgaben enthalten trotz gegenteiliger Promptvorgabe Dankesformeln und Erfassungsberichte. Der Portal-Client übernimmt diese echten Modellantworten. Die semantische Prüfung ist ausdrücklich keine Stilprüfung. Weitere Verbotsformulierungen allein sind daher kein nachgewiesener Lösungsweg.
- Unnötige Rückfragen: Die technische Prüfung bewertet das optionale strukturierte `ask`-Feld. Freie Fragen im Antworttext sind nicht automatisch daran gebunden. Ein grammatisch einzelner Satz kann mehrere Rückfragen enthalten.
- Latenz: Bei Anliegen werden Entscheidung und semantische Prüfung nacheinander ausgeführt. Reparaturen können weitere Aufrufe auslösen. Die Oberfläche zeigt erst die abschliessend geprüfte JSON-Antwort; derzeit kein Textstreaming.

## Verbleibende Portalgrenzen

Die bestehende lokale Anliegenfunktion ist nur in den vorgesehenen Verwaltungsansichten verfügbar. Für authentifizierte Mieter/Eigentümer, gemeinsame serverseitige Ablage, echte Übermittlung und Uploads fehlen weiterhin Backend-Schnittstellen. Die Tests umgehen diese Grenzen nicht. Eine erfolgreiche lokale Speicherung ist weder ein Auftrag an einen Handwerker noch ein Versand an MORADA.

## Kontrollierte Gesprächsreihe: 20 Fälle / 52 Nachrichten

Die unveränderte Architektur mit Gemini wurde auf der oben genannten Ausgangs-Preview getestet. Alle 52 Nachrichten erhielten HTTP 200 mit echten Modellantworten. Das bedeutet technische Erreichbarkeit, **nicht 52 fehlerfreie Antworten**. Es gab 97 Modellaufrufe, darunter zwei Reparaturdurchläufe. Kontoverbrauch 0,18972825 USD; durchschnittlich 0,0094864125 USD je Testgespräch mit zwei bis drei Kundennachrichten. Dies ist keine Prognose für längere Kundengespräche oder den produktiven Betrieb.

| Fall | Befund der echten Antworten und strukturierten Daten |
| --- | --- |
| 01 Lampe, kurze Antworten | Lampe, Wohnzimmer und Anzahl 1 erhalten; wiederholtes Formularangebot und Erfassungsbericht. |
| 02 Steckdose | Küche, Beginn heute und verneinte Gefahr erhalten; dreimal Vorbereitung angesprochen. |
| 03 Unbekannter Beginn | Beginn korrekt als unbekannt erhalten; unnötige wiederholte Frage nach weiteren Räumen. |
| 04 Raumkorrektur | Schlafzimmer ersetzt Wohnzimmer, Lampe bleibt erhalten; weiterhin Formularsprache. |
| 05 Themenwechsel | Nebenkostenfrage beantwortet, Rückkehr zum Wasserhahn mit Bad und Beginn gestern. |
| 06 Zwei Anliegen | Lampe im Flur und zwei Heizkörper im Bad getrennt; jeweiliger Beginn heute/gestern korrekt. |
| 07 Wohnungsübergabe | Allgemeine Frage und Folgefrage beantwortet; kein erfundener Auftrag. Rechtliche Aussagen nicht extern fachlich zertifiziert. |
| 08 Eigentümerin/Leerstand | Eigentümerperspektive und Informationswunsch verstanden; pauschale Temperaturangabe ist keine objektspezifische Beratung. |
| 09 Unklares Objekt | Rollladen nach Klärung, Kinderzimmer und heute Morgen korrekt. Erste Antwort stellt mehrere Fragen. |
| 10 Akute Funken/Brandgeruch | Abstand, kein erneuter Test, Schutz des Kindes; Formularaktionen gesperrt. |
| 11 Später gemeldete Gefahr | Modell erkennt elektrische Gefahr, aber alter globaler Sicherheitsstatus bleibt leer; Speichern war fälschlich verfügbar. Dieser Zustandsfehler wird gezielt korrigiert. |
| 12 Wasser/unklare Ursache | Pfütze und langsames Tropfen getrennt von unbekannter Ursache; keine bestätigte Rohrdiagnose erfunden. |
| 13 Schimmelverdacht | Keine sichere Ferndiagnose/Schuldzuweisung. Beobachtete dunkle Flecken und unsichere Diagnose werden strukturell zu stark zusammengefasst: Defekt wird insgesamt unsicher. |
| 14 Lärm | Wunsch nach ruhigem Gespräch respektiert; zunächst unnötiges Anliegenangebot. |
| 15 Schlüssel/Bestellung | Keine Bestellung behauptet; Formularangebot trotz fehlendem Bereich. Schreibfehler «Notlüsseldienst». |
| 16 Tippfehler/Nachtrag | Wohnzimmer, Lampe, Anzahl 1, Beginn gestern und Erreichbarkeit erhalten. «Sonst keine Auffälligkeiten» fehlt jedoch in der gemappten aktuellen Beschreibung; im Gesprächsbeleg vorhanden. |
| 17 Nicht verfügbarer Versand | Klar erklärt, dass nichts gesendet wurde und kein Versand möglich ist. |
| 18 Persönliche Unterlagen | Keine eigenen Zahlen erfunden. Aussage, die entsprechenden Abrechnungen seien in der Dokumentenansicht einsehbar, geht über den bestätigten persönlichen Zugriff hinaus. |
| 19 Widerspruch/Anzahl | Erst 2, dann ausdrücklich unsicher mit bisherigem Wert, zuletzt korrigiert auf 1. Raum und Montag bleiben erhalten. Mapping zeigt die Unsicherheit an. |
| 20 Mietzahlung/Rechtsgrenze | Kein eigenmächtiger Zahlungsstopp empfohlen. Rechtsaussagen sind zu pauschal und erfordern fachliche Prüfung; keine automatische rechtliche Freigabe. |

Nachweis: `evidence/portal-paid-gemini-quality-2026-10-26.json` enthält sämtliche Kundennachrichten, echten Antworten, validierten Daten, Aktionszustände, Aufrufzahlen und Zeiten. Signierte Sitzungstoken und Zugangsdaten wurden entfernt.

### Bewertung nach den vereinbarten Kriterien

| Kriterium | Belegte Einschätzung |
| --- | --- |
| Natürlichkeit | Nicht ausreichend: wiederkehrende Dankesformeln und Erfassungsberichte; kein Nachweis einer durchgehend natürlichen Assistenz. |
| Gesprächsverständnis | Kernangaben in den geprüften Lampen-/Steckdosenfällen gut erkannt; Beobachtung versus vermutete Diagnose noch nicht immer sauber getrennt. |
| Kontexttreue | Räume, getrennte Anliegen, Themenwechsel und bestätigte Anzahlkorrektur erhalten; Verlust eines negativen Symptoms und alte widersprüchliche Detailtexte bleiben offen. |
| Sinnvolle Rückfragen | Mehrfachfragen und optionale Rückfragen trotz ausreichender Kerndaten bleiben bestehen. |
| Wiederholungen | 26 von 52 Antworten enthalten «vorbereit…», fünf «Dank…». Das sind transparente Wortzählungen, keine automatische Qualitätsnote. |
| Fachliche Richtigkeit | Grundlegende Sicherheits- und Funktionsgrenzen überwiegend beachtet, aber keine vollständige juristische/technische Fachprüfung. Keine Produktionsfreigabe. |
| Geschwindigkeit | Median Backend 4,78 s; langsamster Turn 32,19 s. Siehe Messgrenzen unten. |
| Kosten | 0,18972825 USD für 20 synthetische Testgespräche; echte Gateway-Abrechnung, keine pauschale Monatskostenzusage. |

### Latenz – gemessen und nicht messbar

- Backend-Gesamtzeit: Median 4.781,5 ms, Maximum 32.192 ms.
- Modell/Gateway-Aufrufe zusammen: Median 4.426,5 ms. Das ist die Summe der SDK-Aufrufe inklusive Gateway-/Provider-Transport, keine isolierte Rechenzeit des Modells.
- Guthabenprüfung: Median 264 ms. Übrige gemessene Backend-Verarbeitung pro Turn: Median 5 ms.
- Vollständige HTTP-Antwort am Testrechner: Median 10.348,89 ms, Maximum 37.517,21 ms. Enthält den Test-Netzwerkpfad; nicht als reale Kunden-Browserlatenz ausgeben.
- Gateway-Overhead und reine Provider-Latenz sind ohne zusätzliche Timing-Spans nicht separat belegt.
- Die erste sichtbare Antwort im gerenderten Kundenbrowser und tatsächliches Paint/TTFT wurden in dieser Reihe nicht gemessen. Die Anwendung liefert derzeit eine vollständige JSON-Antwort, keinen Textstream.

Streaming kann den Beginn sichtbarer Textausgabe vorziehen; die genaue Verbesserung muss gemessen werden. Schreibaktionen dürfen dabei weiterhin erst nach vollständig validiertem Ergebnis freigeschaltet werden. Das zweite Modellurteil zu entfernen würde zwar Arbeit einsparen, ist aber ohne Ersatzprüfung kein belegter Zuverlässigkeitsgewinn.

## Gezielte Korrekturen nach der unveränderten Messreihe

1. `api/portal-chat.js` merkt sich jetzt das tatsächlich zur Anzeige zurückgegebene Vorbereitungsangebot, sofern die native Anliegenfunktion verfügbar ist. Das nächste Modell erhält den existierenden Angebotsstatus. Ein Angebot wird nicht als geöffneter oder gespeicherter Entwurf bezeichnet. Zwei neue Regressionstests prüfen den signierten Kontext und die weiterhin ausführbare Aktion sowie den Fall ohne native Funktion.
2. `lib/mora/portal/service.js` übernimmt ein validiertes positives Modellrisiko in den globalen Sicherheitsstatus. Zuvor erreichte es nur `issue.hazard`, während die Aktionen `state.safety` auswerteten. Modellangaben können den Sicherheitsstatus dadurch erhöhen, aber nicht einfach mit `risk: none` zurücksetzen. Ein Regressionstest bildet die echte Formulierung «hat kurz gefunkt» und den anschliessenden ausgeschalteten Zustand nach.

Die 37 MORA-Portaltests nach beiden Korrekturen sowie Typprüfung und Build bestehen. Kein neuer fester Dialog und keine nachträgliche Ersetzung echter Modellantworten.

## Technische Empfehlung

Vor einem Kundeneinsatz braucht MORA eine einzige verbindliche Aktionsfreigabe, die sowohl Oberfläche als auch Modellkontext und Antwortprüfung verwenden. Sichtbare Angebote, offene Formulare, bestätigte lokale Speicherung und serverseitiger Versand müssen darin getrennt bleiben. Die hier korrigierten Übergabestellen sind konkrete Schritte dahin.

Die nächste gezielte Qualitätsarbeit sollte (a) bestätigte Beobachtungen von möglichen Ursachen trennen, (b) negative Beobachtungen bei Ergänzungen bewahren, (c) neue Korrekturen als Ersatz statt als widersprüchlichen Zusatz ablegen und (d) sprachliche Aktionsangebote an die aktuelle technische Freigabe binden. Natürlichkeit anschliessend mit den gleichen Gesprächen erneut prüfen, ohne weitere starre Antwortvorlagen.

Dieser Test vergleicht Gemini mit der bisherigen Fehlerlage der Anwendung, nicht zwei Modelle unter identischen Bedingungen. Eine Rangfolge «Gemini ist intelligenter als Mercury/Claude» ist daraus nicht belegt. Ein weiterer Modellvergleich sollte dieselbe korrigierte Architektur, gleiche Daten und ein separates begrenztes Budget verwenden.

## End-to-End-Nachprüfung der korrigierten Preview

Codecommit `dda8a1edc2b7c3502393b65cd14ddc6d8657e32c`, Deployment `dpl_37aSrPskzG937CSNQwEFf5tpQ4co`, Status READY, Ziel Preview:

https://morada-mora-rdn5f9hjo-dianaporschke-1255s-projects.vercel.app/portal.html

Alle fünf echten Portalabläufe bestanden: Lampe mit kurzen Folgeantworten und Raumkorrektur, Steckdose, trockener Wasserfleck, unbekanntes Spezialteil/unbekannter Beginn sowie zwei getrennte Anliegen. Zwölf echte Kundennachrichten, 26 Modellaufrufe, 0,04907025 USD Kontoverbrauch. Jeder Ablauf wurde bis in den tatsächlich rückgelesenen nativen Portalspeicher geprüft. Zusätzliche Prüfungen im Lampenablauf: Doppelklick, Aktualisierung derselben ID, Foto dem richtigen Anliegen zugeordnet, absichtlicher Speicherfehler ohne neue Erfolgsmeldung und ohne Änderung des alten Datensatzes.

Die aktuelle gespeicherte Lampe enthält: Lampe / Leuchte, Schaden / Reparatur, Fachbereich Elektrik / Beleuchtung, Anzahl 1, Schlafzimmer, Beginn Nicht angegeben, «sonst ist alles normal», genau einen lokalen Fotoanhang. Das Spezialteil bleibt Allgemein/Noch nicht zugeordnet, sein Beginn unbekannt. Die zwei Anliegen haben getrennte IDs und die Räume Flur beziehungsweise Wohnzimmer.

Die Korrekturen ändern weder die Portal-HTML noch das Design: SHA-256 bleibt `09a2a977582e7ca68369453bbe54770b8a937df0bedb66630ad16b71e6de37bb`.

Nachweis: `evidence/portal-paid-gemini-release-2026-10-26.json`. Enthalten sind auch die vom echten Client erzeugten Timing-Ereignisse unter JSDOM; diese messen DOM-Aufrufzeit, keinen gerenderten Bildaufbau auf Desktop oder Mobilgerät. Ein neuer Mobilgerätetest ist nicht durchgeführt worden.

Der gezielte Nachtest beweist den behobenen Angebotsstatus im signierten Zustand und die beschriebenen Speicherabläufe. Er beweist **keine durchgehend verbesserte Sprache**: Auch die neue Preview fragt im Lampenfall zusätzlich nach Deckenbeleuchtung/Leuchtmittel und verwendet eine Dankesformel. Die 20 vollständigen Qualitätsgespräche wurden auf der Ausgangsversion gemessen und nach den zwei kleinen Korrekturen nicht pauschal nochmals wiederholt.


Die nachträgliche Gefahrenkorrektur wurde zusätzlich mit drei echten Nachrichten wiederholt. «Hat kurz gefunkt» setzt jetzt `state.safety.hazard = electric`; Vorbereiten und Foto/Formularprüfung sind gesperrt und bleiben nach «Ich lasse sie ausgeschaltet» gesperrt. Der Text bietet dennoch erneut Vorbereitung an: **Die technische Sperre ist korrigiert, die sprachliche Behauptung bleibt ein offener Qualitätsfehler.** Nachweis: `evidence/portal-paid-gemini-safety-2026-10-26.json`, Kosten 0,011307 USD.

## Abschliessender Kosten- und Freigabestand

Gesamter beobachteter Kontoverbrauch dieser Runde: **0,26970075 USD**. Verbleibendes Guthaben: **24,356144618 USD**. Davon ist für weitere Nutzung dieser Testfreigabe noch höchstens rund 0,73 USD beobachteter Verbrauch vorgesehen. Es wurde kein weiteres Guthaben gekauft und keine automatische Aufladung aktiviert. Das ist eine begrenzte Testfreigabe, kein fertiges Finanzierungskonzept für alle Kunden.

**Ergebnis:** Die bezahlte KI-Anbindung funktioniert, zwei konkrete Zustandsfehler sind korrigiert und die beschriebenen nativen Speicherabläufe sind belegt. Natürlichkeit, vollständige Detailtreue und die Übereinstimmung sprachlicher Angebote mit technisch erlaubten Aktionen reichen noch nicht für das Versprechen einer einwandfreien Kundenassistenz. Kein Produktionsdeployment, keine Produktionsfreigabe.
