# MORA: getrennte Agent-Testversion und Walkthrough-Grundlage

Stand: 27. Oktober 2026. Ausschliesslich `codex/mora-ai-2.0`; keine Änderung an `main`, `alex-portal`, Produktionsdeployment oder Abrechnungseinstellungen.

## Ergebnis und Grenzen

Die neue Gesprächsarchitektur ist implementiert und als getrennte Preview verfügbar. Sie ersetzt die bisherige MORA nicht. Ihre Gesprächsqualität ist **noch nicht für Kunden freigegeben**. Der echte Gemini-Pilot zeigte weiterhin technische Fragen und Erfassungsberichte. Auch der anschliessende Sonnet-Pilot belegt keine ausreichende allgemeine Verbesserung. Der Vergleich wurde wegen Qualitätsproblemen beziehungsweise der vorhandenen Testbudgetgrenze vorzeitig beendet. Es wurden in dieser Runde nicht 20 vollständige Gespräche je Modell abgeschlossen.

Die Walkthrough-Datenverknüpfung ist implementiert und automatisiert getestet. In der bereitgestellten Portal-HTML gibt es noch keinen Walkthrough mit anklickbaren Heizkörpern. Deshalb zeigt MORA keinen funktionslosen Auswahlbutton. Bildanalyse, Raumnavigation und ein serverseitiger Auswahlresolver sind nicht angeschlossen.

Preview mit Sonnet: https://morada-mora-1wefcaidn-dianaporschke-1255s-projects.vercel.app/portal.html?mora=agent

Preview des Gemini-Vergleichs: https://morada-mora-4cqka2ic4-dianaporschke-1255s-projects.vercel.app/portal.html?mora=agent

Die bestehende Oberfläche ohne `?mora=agent` verwendet weiterhin `portal_v1`. Getestete Code-Commits: Gemini `c2326a2e291405e8a59e8775d0be07845e2db579`, Sonnet `29ee6bbce7c082834914f60af19be777d595b975`. Spätere Dokumentations-/Teständerungen ändern diese Laufzeit nicht.

## Was tatsächlich geändert wurde

- `lib/mora/portal/agent.js`: freie Textantworten und vier begrenzte Werkzeuge statt eines Antwort-/Fakten-JSON mit obligatorischem KI-Prüfer. `record_issues` behält neue oder korrigierte Angaben, `use_issue` wählt ein vorhandenes Anliegen, `open_form` fordert das bestehende Formular an, `show_view` bietet eine erlaubte Portalansicht an. Ein normaler Informationsdialog kann einen Modellaufruf benötigen; eine Faktenänderung benötigte in den Live-Piloten meist zwei. Höchstens drei Modellschritte und acht Werkzeugausführungen pro Nachricht. Datenfehler werden als Werkzeugergebnis zurückgegeben, ohne bereits bestätigte Daten neu erzeugen zu lassen.
- `api/portal-agent.js`: eigener Preview-Endpunkt mit isolierter signierter Sitzung `portal_agent_v1`. Kein beliebiger Modellparameter vom Frontend. Produktion bleibt HTTP 404.
- `api/portal-chat.js`: gemeinsame vorhandene Aktions-/Speicherbeleglogik parametrisiert; bisheriger Standard unverändert. Bei einem späteren Modell-/Budgetfehler bleiben erfolgreich erfasste Agent-Fakten in der signierten Sitzung erhalten; es wird keine Portalaktion ausgeführt.
- `assets/mora-portal-client.js`: ausdrücklich auswählbare Testvariante über `?mora=agent`, eigener Sitzungsspeicher und sichtbarer Titel „MORA · Agent-Test“. Es gibt weiterhin nur das native Anliegenregister.
- `lib/mora/issue-state.js`: ein bestätigter Wert hebt jetzt eine vorherige Unsicherheitsmarkierung auch dann auf, wenn der Zahlenwert gleich bleibt. Dieser Datenfehler wurde durch den neuen Regressionstest nachgewiesen.
- `lib/mora/portal/budget.js`: zusätzliche feste Sonnet-Modellwahl nur für den Agent-Vergleich; Preise werden weiterhin live gelesen. Die bestehende Ausgabegrenze wurde nicht erhöht. Der alte Portal-Endpunkt bleibt bei Gemini.
- `portal.html`: nur der vorhandene MORA-Integrationsblock wurde aus den Modulen neu erzeugt. Der bestehende Regressionstest bestätigt den unveränderten nativen Portalcode und das Design ausserhalb der schon früher genehmigten vier optionalen MORA-Speicherargumente.

## Daten und Aktionen

Die vorhandenen Anliegen-IDs, Feldzustände, Korrekturhistorie und das zentrale Mapping `portalCaseFields` bleiben erhalten. Nicht genannte Felder werden nicht mit Null überschrieben. Fehlerhafte Zitate oder unbekannte Referenzen verändern die Daten nicht. Ein erfolgreicher Erfassungsaufruf erzeugt nur Gesprächsdaten, keinen gespeicherten Portaleintrag.

`portalActionState` bleibt die gemeinsame Zustandsquelle für Modell und UI. Vorbereiten und Prüfen verwenden vorhandene native Funktionen wie `caseOpenForm`, `opsSaveRecord`, `portalReadStored` und `caseDetail`. Lokale Speicherung wird erst durch Rücklesen und den passenden Speicherbeleg bestätigt. Formularöffnung, gespeicherter Eintrag und Versand bleiben getrennt; Versand existiert weiterhin nicht. Mehrere Klicks und Wiederholungen behalten dieselbe ID. Fotos werden weiterhin lokal am richtigen Anliegen abgelegt.

Der Agent enthält keinen zusätzlichen KI-Prüfer. Deshalb sind die Grenzen der technischen Prüfung ausdrücklich zu beachten: Schemata, Zitatvorkommen, Zugriffsbedingungen, Zustand und Speicherbelege werden geprüft; das beweist nicht jede semantische Deutung oder die Vollständigkeit jeder Extraktion. Die lokale Prüfung unbelegter Erfolgsbehauptungen ist ebenfalls keine vollständige Sprachprüfung. Beide Piloten zeigen, dass ein kurzer Auftrag und Werkzeugaufrufe allein die gewünschte Gesprächsqualität nicht garantieren.

## Walkthrough-Vertrag für die spätere Portal-Anbindung

`attachWalkthroughSelection(previous, {issueId, selectionToken}, principal, resolveSelection)` verlangt einen authentifizierten Kundenkontext und einen Resolver. Der Resolver muss das Auswahl-Token serverseitig prüfen und ausschliesslich berechtigte Daten zurückgeben:

```json
{
  "propertyId": "property-1",
  "unitId": "unit-1",
  "walkthroughId": "tour-1",
  "roomId": "room-1",
  "objectId": "heater-1",
  "hotspotId": "spot-1",
  "roomLabel": "Schlafzimmer",
  "objectLabel": "Heizkörper"
}
```

Das sind Beispieldaten für den Vertrag, keine vorhandenen Immobilien oder Markierungen. Alle IDs müssen aus dem Portal stammen. Das Modell darf sie nicht erfinden. Im aktuellen HTTP-Endpunkt werden rohe Walkthrough-Daten abgewiesen.

Nach einer autorisierten Auswahl werden Einrichtung und Raum am bestehenden Anliegen ergänzt. Die Referenz fliesst in den Inhaltshash und in den vorhandenen Gesprächsbeleg des Portaleintrags ein. Die Beschreibung nennt die ausgewählte Einrichtung und den Raum. Dieselbe Auswahl ist inhaltlich idempotent. Eine spätere Raum-/Einrichtungskorrektur setzt die Markierung auf `needs_reselection`; alte IDs werden nicht auf eine andere Heizung umgedeutet. Auch die Rücknahme/Unsicherheit einer Raumangabe invalidiert die Auswahl.

Alexander beziehungsweise der spätere Walkthrough-Entwickler muss bereitstellen:

1. Authentifizierten, nach Wohnung und Kundenrechten gefilterten Zugriff auf Räume, Gegenstände und Markierungen.
2. Eine sichtbare Auswahloberfläche und einen kurzlebigen Auswahlbeleg, den der Server auflösen kann. Der Resolver darf keine vom Client frei behaupteten Raum-/Objektbezeichnungen als Berechtigung akzeptieren.
3. Eine Navigation, die eine gespeicherte `walkthroughId`/`hotspotId` wieder öffnen kann und gelöschte oder veraltete Referenzen erkennt.
4. Später getrennte, berechtigte Schnittstellen für Fotos, Bildzeitpunkte und Übergabeprotokolle. Bildbeobachtung ist keine bestätigte Schadensursache. Abmessungen dürfen nicht aus Bildern als verlässliche Messung erfunden werden.

Es wurde keine Portal-Datenbank, Rollenverwaltung oder zweite Anliegenverwaltung geschaffen.

## Echte Modelltests und Kosten

Die Modellaufrufe liefen ausschliesslich über das vorhandene geschützte Gateway. Keine Mock-Antworten in den nachfolgenden Live-Dateien. Kontrollierte Regressionstests und die Offline-Speicherwiederholung sind getrennt ausgewiesen.

| Lauf | Umfang | Ergebnis | Beobachtete USD-Kontodifferenz |
| --- | --- | --- | ---: |
| Agent mit Gemini, Lampenpilot | 1 vollständiges Gespräch, 3 Nachrichten, 6 Modellaufrufe | 3 Antworten; Lampe/Raum/Anzahl/negative Zusatzangabe behalten; unnötige weitere Fragen | 0,009435 |
| Agent mit Gemini, anschliessender Lauf | 3 vollständig gesicherte Gespräche mit 9 Nachrichten, zusätzlich abgebrochener Themenwechsel | Technische Fragen, „Leuchtmittel“, wiederholte Nachfragen und unbelegte Entwarnung; bewusst vorzeitig verworfen | 0,03925875 einschliesslich unvollständigem Fall |
| Agent mit Sonnet 5.5 | 1 vollständiges und 1 begonnenes Gespräch, 6 Nachrichten, 11 Modellaufrufe | 5 Antworten; bei Nachricht 6 stoppt der Budgetschutz vor dem zweiten Aufruf. Raumkorrektur und Fakten bleiben auch beim Abbruch erhalten | 0,119570 |

Gesamte beobachtete Differenz dieser Runde: **0,16826375 USD**. Vorheriger Gesamtverbrauch 1,161682382 USD, danach 1,329946132 USD. Guthaben laut letzter Abfrage **23,670053868 USD**. Die vorhandene Testgrenze liegt unverändert bei 1,374154632 USD Gesamtverbrauch. Die verbleibenden rund 0,0442 USD reichen nicht für die konservative Reserve des nächsten Sonnet-Aufrufs; deshalb blockiert der Testschutz, obwohl Guthaben vorhanden ist. Keine zusätzliche Zahlung, automatische Aufladung oder Erhöhung der Testfreigabe.

Die Sonnet-Reihe entspricht rechnerisch rund **0,01993 USD je Kundennachricht einschliesslich des abgebrochenen Versuchs**. Das ist ein kleiner Pilot und eine Kontodifferenz, keine garantierte Einzelabrechnung oder Produktionsprognose. Andere Nutzung und verzögerte Verbuchung lassen sich durch diese Kontozähler nicht vollständig ausschliessen. Das Modell wird deshalb nicht als kostengünstiger oder nachweislich besser bezeichnet.

Median Backend bei erfolgreichen Sonnet-Antworten: 2,967 Sekunden; HTTP-Median im Testtransport: 8,651 Sekunden. Kein Streaming. Gateway- und reine Modelllatenz sind nicht getrennt messbar; kein gemessener Browserwert bis zum ersten sichtbaren Token. Die kleine Stichprobe rechtfertigt keine allgemeine Geschwindigkeitszusage.

Konkrete unveränderte Modellbeispiele:

- Gemini nach Raumkorrektur und Bestätigung: „Handelt es sich um eine fest montierte Decken- oder Wandleuchte, oder um eine eigene Tisch- beziehungsweise Stehlampe? Wurde das Leuchtmittel bereits ausgetauscht?“ Das verfehlt den gewünschten Stil.
- Sonnet zu „Nein, ich meinte das Schlafzimmer.“: „Verstanden, die Lampe ist im Schlafzimmer, nicht im Wohnzimmer. Das habe ich geändert.“ Die gespeicherten Gesprächsdaten enthalten tatsächlich Schlafzimmer und dieselbe Anliegen-ID.
- Sonnet davor: „Ich habe notiert: Im Wohnzimmer lässt sich eine Lampe nicht einschalten. Die Meldung ist bereit.“ Danach folgen mehrere Fragen. Die Formulierung bleibt mechanisch und „bereit“ kann den tatsächlichen Speicherstand missverständlich darstellen. Der Portalstatus meldet zu diesem Zeitpunkt keine Speicherung.

Die Prompts wurden zwischen den beiden Agent-Modellen nicht umformuliert. Die gezeigten Antworttexte stammen aus dem Modell und wurden nicht lokal umgeschrieben. Die Anwendung beeinflusst sie über den kurzen Auftrag, Werkzeugbeschreibungen und den zurückgegebenen Fakten-/Aktionsstand. In der aktuellen Umsetzung erhält das Modell diesen Stand sowohl als Werkzeugergebnis als auch im Kontext des nächsten Schritts; das verursacht zusätzliche Eingabetokens. Eine gezielte Reduktion dieses doppelten Kontextes ist ein möglicher nächster Kostenversuch, noch kein gemessener Vorteil.

## Speicher- und Regressionstests

Abschliessend **369 automatisierte Tests bestanden**, einschliesslich Produktionssperre, Gefahrenerhalt, Modellbegrenzung, SDK-Werkzeugabläufen und Walkthrough-Verknüpfung. Typprüfung, Build (121 Quelldateien) und Diff-Prüfung bestanden. Die SDK-Tests verwenden die tatsächlich installierte SDK-Version mit ausdrücklich gemocktem Transport; sie sind kein Beleg für KI-Gesprächsqualität.

`scripts/portal-integration/replay-agent.mjs` übernimmt die bereits tatsächlich erzeugten Sonnet-Daten in den lokalen Handler und die tatsächlichen nativen HTML-Speicherfunktionen. Ergebnis: Lampe im Wohnzimmer gespeichert; Korrektur auf Schlafzimmer unter derselben ID; Anzahl 1 erhalten; keine Doppelanlage bei Doppelklick; Foto am selben Anliegen; kontrollierter Speicherfehler ohne neue Erfolgsmeldung oder Datenüberschreibung. Diese Prüfung bestand. Es ist ausdrücklich **eine Offline-Wiederholung**, kein neues vollständiges Live-Gespräch und keine gerenderte Geräteprüfung.

Eine visuelle Cloud-Browserprüfung wurde von der automatischen Freigabeprüfung blockiert, als die geschützte Preview zur Vercel-Kontodomain weiterleitete. Ein zusätzlicher lokaler Browser war nicht verfügbar; der Browserdownload schlug fehl. Desktop- und Mobilansicht sind daher nicht neu visuell abgenommen.

Nachweise: `evidence/portal-agent-pilot-2026-10-27.json`, `evidence/portal-agent-quality-2026-10-27.json`, `evidence/portal-agent-sonnet-2026-10-27.json`, `evidence/portal-agent-native-replay-2026-10-27.json`.

## Nächste Entscheidung

Die implementierten Grenzen, getrennte Teststrecke und Walkthrough-Referenz sind überprüfbare Grundlagen. Der Pilot belegt noch keine allgemein intelligente oder zuverlässige Kundenassistenz. Vor einer Übernahme sind ein vollständiger Vergleich mit denselben 20 Dialogen, direkte Live-Speicherabläufe, Sicherheitsfälle, reale Bildaufgaben und visuelle Geräteprüfungen offen. Weitere bezahlte Modelltests erfordern eine ausdrückliche Erweiterung der bisherigen Testfreigabe aus dem vorhandenen Guthaben; die Grenze wird nicht selbständig angehoben.
