# MORA: günstige Ein-Aufruf-Variante — Prüfung vom 27. Oktober 2026

**Ergebnis: Kosten deutlich gesenkt, Qualitätsabnahme nicht bestanden. Diese Preview ist keine freigegebene Kundenversion.** Die Fehler werden nicht durch erfolgreich laufende Regressionstests oder ausgewählte gute Antworten verdeckt.

Getestete Preview: https://morada-mora-aus87vnt8-dianaporschke-1255s-projects.vercel.app/portal.html

Laufzeit: `a4b83d848bd5620f492811b5094c4b5d4e515b9e`, Branch `codex/mora-ai-2.0`. Modell: `anthropic/claude-haiku-5.5` über das vorhandene geschützte Vercel AI Gateway. Kein Schlüssel im Frontend. Keine neuen Schlüssel, Aufladung oder Änderung kostenpflichtiger Einstellungen.

## Was umgesetzt wurde

- `api/portal-agent.js` verwendet den neuen `lib/mora/portal/compact-agent.js`. Eine normale Kundennachricht erhält in einem Modellaufruf Antwort, strukturierte Änderungen und einen Aktionsvorschlag. Keine Modell-Werkzeugschleife, keine automatische Reparaturgeneration, kein teures Ausweichmodell.
- Die vorhandenen validierten Zustandsänderungen aus `agent.js` bleiben zuständig für Fakten, Korrekturen, getrennte Anliegen und erlaubte Aktionen. Das Modell schreibt keine Portaldaten selbst. Das Öffnen eines Formulars ist kein Speicherbeleg.
- Bei Aussagen über mögliche nicht verfügbare Aktionen kann genau eine zusätzliche semantische Prüfung mit demselben Haiku-Modell erfolgen. Auch diese Prüfung erwies sich im Live-Test als fehleranfällig; siehe unten.
- Das Ausgabeformat ist flach und wiederverwendbar. Gefahr wird getrennt von bekannten, unbekannten, unsicheren oder zurückgenommenen Kundenangaben übertragen. Bei `next.type=none` können unbenutzte Zusatzfelder keine Aktion auslösen und verwerfen auch keine sonst gültigen Fakten.
- `budget.js` verwendet den genauen Modellpreis inklusive längenabhängiger Preisstufen. Vor jedem Aufruf wird eine konservative Höchstkostenreserve gegen die unveränderte ursprüngliche 2-USD-Freigabe geprüft. `maxRetries=0`; kein versteckter bezahlter Wiederholungsversuch.
- Die native HTML-Datei, Portaloberflächen und Speicherfunktionen wurden in diesem Auftrag nicht geändert. Die bisherigen Integrationen und der alte Code bleiben erhalten; die Standard-Preview verwendet die neue kompakte Variante.

Veränderte Dateien: `api/portal-agent.js`, `lib/mora/portal/compact-agent.js`, `lib/mora/portal/agent.js`, `lib/mora/portal/budget.js`, `scripts/portal-integration/live.py`, `tests/portal-compact.test.js`, `tests/portal-budget.test.js`.

## Tatsächlich gemessene Kosten

Die Werte sind Differenzen der Gateway-Verbrauchsanzeige vor und nach den sequenziellen Läufen; keine frei geschätzten Preise und keine Rechnung über Hosting. Jeder Lauf enthält echte Modellantworten.

| Lauf | Kundennachrichten | Verbrauch |
|---|---:|---:|
| Erster Pilot, abgebrochen | 28 | 0.0167722 USD* |
| Prüfung des festen Schemas, gestoppt | 3 | 0.0015013 USD |
| Prüfung der Validierungsdiagnose, gestoppt | 5 | 0.0026284 USD |
| Vollständige Serie, 20 Gespräche | 52 | **0.0309831 USD** |
| Native Portalabläufe, fünf Szenarien | 10 | 0.0054284 USD |
| Alle Haiku-Versuche dieses Auftrags | **98** | **0.0573134 USD** |

*Beim abgebrochenen ersten Pilot fehlt eine eigene abschliessende Guthabenmessung. Der Wert ist die Differenz zwischen seinem Anfang und der frischen Vorprüfung des nächsten Haiku-Laufs. Er ist entsprechend kein separat abgeschlossener Abrechnungsbeleg dieses Piloten.

Die vollständigen 20 Gespräche kosteten zusammen ungefähr **3.1 US-Cent**. Durchschnitt pro Gespräch mit zwei bis drei Kundennachrichten: 0.001549155 USD; pro Kundennachricht: 0.000595829 USD. Eine Kundennachricht bedeutet hier genau einen gesendeten Kundentext, nicht ein ganzes Gespräch.

Der frühere Opus-Fast-Test lag im Mittel bei ungefähr 0.0664 USD pro Kundennachricht. Die Stichproben und Architekturen unterscheiden sich; der Vergleich beweist keine gleiche Qualität bei einem garantierten Preisfaktor. Der konkrete Haiku-Test zeigt aber: Sie müssen für diesen Anwendungsfall nicht grundsätzlich mehrere Rappen pro Kundennachricht ausgeben.

Letzte Guthabenanzeige: **21.737367568 USD**. Gesamter angezeigter Verbrauch: 3.262632432 USD. Von der ursprünglichen 2-USD-Testfreigabe bleiben **0.0762237 USD** bis zur Grenze 3.338856132 USD. Das übrige Guthaben ist keine zusätzliche Ausgabefreigabe. Alle Live-Läufe dieses Auftrags sind beendet.

## Vollständige Qualitätsserie

Es wurden dieselben 20 Szenarien aus `scripts/quality-phase1/cases.json` mit allen 52 Kundennachrichten ausgeführt. Keine Mock-Antworten. Diese Serie lief unverändert auf der oben genannten Laufzeit. Sie ist ein Test der Kombination Haiku plus kompakte Steuerung, kein isolierter A/B-Beweis über die Intelligenz des Modells.

- 43 von 52 Antworten wurden technisch angenommen; **9 wurden abgewiesen**.
- 13 von 20 Gesprächen enthielten keinen HTTP-Fehler. Auch ein HTTP-Erfolg bedeutet keine sprachlich oder fachlich richtige Antwort.
- **7 von 14 Daten-Abnahmekriterien bestanden**, 7 nicht. Die vollständigen Einzelprüfungen stehen in `portal-haiku-quality-2026-10-27-assessment.json`.
- 43 Nachrichten nutzten einen Modellaufruf, 9 nutzten zwei. Insgesamt 61 Modellaufrufe für 52 Kundennachrichten.

| Bereich | Befund |
|---|---|
| Natürlichkeit | Nicht ausreichend. 13 der 43 angenommenen Antworten enthalten „Danke“. Häufig interne Erfassungsberichte und wiederholte Formularangebote. |
| Gesprächsverständnis | Lampe, Steckdose, Rollladen, mehrere Anliegen und Umgangssprache werden teilweise richtig verstanden; Daten werden dennoch ausgelassen oder falsch zugeordnet. |
| Kontexttreue | Raumkorrektur im vollständigen Lauf scheitert an einer ungültigen Fokusreferenz. Unsicherheit bei der Anzahl scheitert an einem doppelt ausgegebenen Feld. |
| Rückfragen | Wiederholte bzw. unnötige Fragen, teilweise mehrere in einer Antwort. |
| Wiederholungen | Das bereits sichtbare Formularangebot wird erneut erklärt, obwohl der Kontext seinen Status enthält. |
| Fachliche Verlässlichkeit | Kleine Pfütze wird als akute Wassergefahr klassifiziert. Bei späterer elektrischer Gefahr nennt der Text einen gesperrten Vorbereitungsbutton. Allgemeine Auskünfte sind keine juristische oder fachliche Freigabe. |
| Geschwindigkeit | Deutlich unter einer Minute in dieser finalen Serie, aber weiterhin spürbare Wartezeiten und Ausreisser. |
| Kosten | Niedrig belegt; niedriger Preis ist kein Qualitätsnachweis. |

### Konkrete echte Antworten und Daten

1. Nach „lampe kaputt“ und „wohnzimmer“: „Danke, die Lampe ist also im Wohnzimmer. Ich habe das bei Ihrem Anliegen vermerkt. Sobald Sie möchten, können Sie das Anliegen mit einem Vorbereitungsformular weiterverfolgen.“ Diese Antwort stammt vom Modell, nicht von einem lokalen Dankes-Dialog.
2. Nach „Nur eine Lampe ist betroffen, sonst ist alles normal.“ erklärt das Modell, es habe alles vermerkt. In den strukturierten Daten stehen `equipment=light`, `location=Wohnzimmer`, `count=1`, aber `details=null`. Die zusätzliche Beobachtung fehlt im aktuellen Beschreibungsfeld. Der ursprüngliche Kundentext bleibt im Audit, ersetzt dort jedoch keine korrekte Feldübernahme.
3. „Nein, ich meinte das Schlafzimmer.“ führt zu `invalid_record_issues` / `Unknown active issue reference; available: active`. Der gültige Raum bleibt deshalb Wohnzimmer. Die Validierung verhindert falsche Zuordnung, erfüllt aber die gewünschte Korrektur nicht.
4. Bei der Steckdose verwendet das Modell `extent` zunächst für „Kein Rauch, keine Funken und kein Brandgeruch“, danach für „Die anderen Steckdosen funktionieren.“ Der zweite Umfang ersetzt den ersten. Dieses Feld ist kein additiver Zusatznotizenspeicher. Das Modell hätte die Angaben in `details` einordnen müssen.
5. Beim tropfenden Hahn enthält `equipment` den ganzen Ausdruck „Wasserhahn im Bad“, während `location` leer bleibt. Das ist mehr als eine abweichende interne Bezeichnung: Der bekannte Raum fehlt als eigenes Feld.
6. Beim Wunsch nach Versand verneint die erste verworfene Modellantwort ausdrücklich Versand und Weiterleitung, bietet lediglich Vorbereitung an. Der zusätzliche Haiku-Prüfer verwirft sie dennoch. Hier liegt ein Fehlalarm des Prüfers vor, kein tatsächlich ausgeführter Versand.

Die strukturierten Fakten und `reply` kommen gemeinsam vom Modell. Die Anwendung validiert Quellen, Zustände, Referenzen und Aktionen, leitet daraus reale Buttons ab und kann eine unzuverlässige Antwort zurückhalten. Technische Speicherbestätigungen sind separate Anwendungstexte nach erfolgreichem Schreiben und Auslesen. Sie werden nicht als natürlich erzeugte Modellantworten bewertet.

## Native Portalprüfung

Getestet wurde die tatsächliche gelieferte HTML-/JavaScript-Logik mit echten HTTPS-Modellantworten in JSDOM. Speicherwerte wurden ausgelesen und verglichen; kein zweiter Servicebereich. Es handelt sich nicht um einen gerenderten Desktop-/Mobilgeräte-Test.

| Ablauf | Ergebnis |
|---|---|
| Lampe, mehrere kurze Antworten, Vorbereitung | Gescheitert: `incomplete_form_action` beim ausdrücklichen Vorbereitungswunsch. Keine Speicherung behauptet. |
| Steckdose im Büro | Bestanden: genau ein nativer Eintrag „Steckdose · Büro“, Defekt, Bereich, Beobachtungen und Beginn „Nicht angegeben“ im gespeicherten Inhalt. Doppelte Klicks/Submit erzeugten keine Duplikate. |
| Trockener Wasserfleck | Gescheitert: unvollständiger Formularauftrag. |
| Unbekanntes Spezialteil, unbekannter Beginn | Gescheitert: Quellenzitat zum Beginn passt nicht zum zugehörigen Anliegenzitat. |
| Lampe im Wohnzimmer plus loser Türgriff im Flur | Bestanden: zwei getrennte gespeicherte Einträge mit richtigen Räumen. Lampentitel „Lampe / Leuchte · Wohnzimmer“. Die unbekannte fachliche Zuordnung des Türgriffs bleibt kontrolliert unklassifiziert. |

**2 von 5 nativen Szenarien bestanden.** Im Lampenszenario wurden die nachgelagerte Raumaktualisierung, Fotozuordnung, Speicherstatusfragen und der kontrollierte Speicherfehler wegen des vorherigen Fehlers nicht erreicht. Sie sind für diese reale Haiku-Version ausdrücklich nicht als bestanden ausgewiesen. Die vorhandenen automatisierten Tests dieser Speicherfunktionen bleiben davon getrennt.

### Mapping und Aktionszustand

Das unveränderte zentrale `assets/mora-portal-map.js::portalCaseFields` überträgt Titel, `unit`, Beschreibung und die bestehende Portal-Kategorie. Native Kategorie liegt in `caseInfo.category`. Einrichtung, Anzahl, Beginn, Fachbereich und Zusatzangaben werden in die vorhandene Beschreibung übernommen, weil die HTML-Version dafür keine separaten Formularfelder hat. Unbekannte Zuordnungen werden nicht willkürlich als Elektrik oder Heizung gespeichert.

Der unveränderte gemeinsame Aktionszustand unterscheidet erfasste Fakten, verfügbares Vorbereiten, offenes Formular, gespeicherte Fassung, noch nicht gespeicherte Änderungen und Fehler. Revision und Inhaltsvergleich verhindern veraltete Erfolgsbehauptungen; eine neue Modellantwort ist kein Speicherbeleg. Diese Mechanismen können vom Modell ausgelassene Fakten nicht wiederherstellen. Eine echte Übermittlung an MORADA existiert weiterhin nicht.

## Latenz und Grenzen der Messung

In der vollständigen 52-Nachrichten-Serie: Backend-Median erfolgreicher Antworten **2.53 s**, Modell und Gateway zusammen **2.322 s**, Guthabenprüfung **0.157 s**, externer HTTP-Median **6.666 s**. Der höchste Backend-Wert aller 52 Nachrichten lag bei **9.121 s**, die höchste HTTP-Zeit bei **13.007 s**.

Das SDK liefert hier keine getrennte reine Gateway- und Modelllatenz. Der HTTP-Testweg enthält einen externen Proxy; daraus lässt sich Dianas Handy-Latenz nicht exakt ableiten. Die instrumentierte JSDOM-Oberfläche zeigt nur Verarbeitungs-/DOM-Zeiten. Beim Öffnen eines Formulars können zusätzliche verifizierte Aktionsaufrufe die sichtbare Reaktion verlängern; ein solcher Ablauf brauchte etwa 15.5 s bis zur DOM-Bestätigung.

Die Oberfläche streamt noch nicht. Sichtbare Antwort und vollständige Antwort liegen daher nahe beieinander. Streaming könnte das Warten auf Text vermindern, beseitigt aber weder falsche Fakten noch fehlerhafte Aktionsaufträge. Ungeprüfte Erfolgsversprechen sollten nicht vorzeitig sichtbar werden.

Der erste verworfene Pilot enthielt ausserdem eine 45-Sekunden-Zeitüberschreitung. Ein dynamisches Schema mit vielen optionalen Feldern kann laut Anbieter Schema-Kompilierung verursachen; dass genau dies diesen Timeout verursacht hat, ist **nicht nachgewiesen**. Das feste Format wurde deshalb nicht als bewiesene Heilung aller Latenzprobleme dargestellt.

## Regressionen und Projektgrenzen

**394 automatisierte Tests bestanden**, Typecheck, Build und Diff-Prüfung bestanden. Sie prüfen unter anderem Korrekturen, Mehrfachanliegen, Unbekannt/Unsicher, Quellenvalidierung, gemeinsame Zustände, Speicherbelege, doppelte Aktionen, Budgetgrenzen und den neuen SDK-Ausgabevertrag. Die deterministischen Test-Transporte sind ausdrücklich kein Nachweis echter Modellqualität.

`main` bleibt auf `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` auf `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Kein Merge und kein Produktionsdeployment. Die Laufzeit-Preview hat `target=null` und gehört ausschliesslich zum beauftragten Entwicklungsbranch.

## Technische Empfehlung

**Diese Kombination aus Haiku und der jetzigen kompakten Steuerung nicht für Kunden freigeben.** Die günstige Kostenbasis ist belegt, die geforderte Verlässlichkeit nicht. Weitere Formulierungsregeln würden die nachgewiesenen Vertragsfehler nicht lösen.

Beibehalten: geschütztes Gateway, begrenzter Einzelaufruf, keine teuren automatischen Eskalationen, deterministisches Mapping und echte Speicherbelege.

Vor einer erneuten Abnahme sollten die Verantwortlichkeiten weiter reduziert werden: Die Anwendung vergibt stabile Anliegen-IDs und verwaltet Fokus sowie ausführbare Aktionsparameter. Das Modell liefert quellbelegte fachliche Änderungen und eine natürliche Antwort; es soll nicht zusätzlich unverbundene Navigations-/Fokusreferenzen erraten. Zusatzbeobachtungen brauchen eine eindeutig additive Datenstruktur; das Überschreiben eines allgemeinen Umfangsfelds darf sie nicht verlieren. Formularparameter müssen aus der geprüften Aktion abgeleitet werden. Ein probabilistischer Textprüfer darf weder den tatsächlichen Speicherstatus ersetzen noch als zuverlässige Instanz zur Rettung eines unzuverlässigen Gesprächsmodells gelten.

Danach ist ein eng begrenzter Vergleich geeigneter günstiger Modelle auf genau denselben Fällen sinnvoll. Erst bestandene Daten- und Gesprächsprüfungen rechtfertigen eine Auswahl. Aus diesem Lauf lässt sich weder ableiten, dass jedes Haiku-Gespräch grundsätzlich ungeeignet ist, noch dass ein teureres Modell die Fehler automatisch behebt. Ein weiterer grosser Umbau oder zusätzlicher kostenpflichtiger Test wurde nach diesem Befund nicht begonnen.

Für den späteren Kundenbetrieb fehlen weiterhin die in `MORA_PORTAL_INTERFACE_CONTRACT.md` dokumentierten authentifizierten Speicher-, Upload- und Versandadapter. Walkthrough benötigt echte Objekt-/Raum-IDs, Auswahlereignisse und Berechtigungen aus Alexanders Portal; hier wird keine Verbindung vorgetäuscht. Die globale Preview-Testgrenze ist keine dauerhafte Kunden-Budgetlösung. Für Produktion braucht es vereinbarte Betriebsgrenzen, Kostenbeobachtung und weiter nutzbare manuelle Servicefunktionen bei KI-Ausfall; keine stillschweigende automatische Aufladung.

## Vollständige Belege

- `evidence/portal-haiku-pilot-2026-10-27.json`: erster Pilot inklusive Timeout und Fehlern.
- `evidence/portal-haiku-schema-pilot-2026-10-27.json`: erster Schema-Nachtest, abgebrochen.
- `evidence/portal-haiku-risk-pilot-2026-10-27.json`: präziser Nachweis des fehlerhaften Gefahr-Feldvertrags.
- `evidence/portal-haiku-quality-2026-10-27.json`: alle 20 Gespräche, 52 Nachrichten und echte Antworten.
- `evidence/portal-haiku-quality-2026-10-27-assessment.json`: alle 14 Datenprüfungen, einschliesslich Fehlschlägen.
- `evidence/portal-haiku-native-2026-10-27.json`: reale HTTP-Antworten und tatsächliche gespeicherte Portalwerte.
- `evidence/portal-haiku-conclusion-2026-10-27.json`: maschinenlesbares Gesamtergebnis.
