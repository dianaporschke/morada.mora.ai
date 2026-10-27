# MORA – Abschluss der freigegebenen 2-USD-Testarbeit

Stand: 27. Oktober 2026. Nur `codex/mora-ai-2.0`. Keine Änderungen an `main`, `alex-portal`, Produktion, API-Schlüsseln oder Abrechnungseinstellungen.

## Verfügbare Version

Die unabhängige Portal-HTML öffnet standardmässig die neue MORA mit `openai/gpt-6.1-sol` über das vorhandene geschützte Vercel AI Gateway. Der frühere Pfad bleibt ausschliesslich über `?mora=legacy` vergleichbar. Es gibt weiterhin nur das vorhandene Anliegenregister.

Getestete endgültige Laufzeit: `5e076a1ff7bc0a3e17cd9b16745e214312d206c8`.

Preview: https://morada-mora-c1rkq67iy-dianaporschke-1255s-projects.vercel.app/portal.html

Dies ist eine funktionale Preview der Anliegenintegration, keine Freigabe für unbegrenzten Kundenbetrieb oder eine Garantie fehlerfreier KI-Antworten. Sprachlich gibt es weiterhin förmliche Formulierungen und Hinweise auf Formulare. Die nachstehend dokumentierten Tests rechtfertigen keine Behauptung allgemeiner „Hochintelligenz“.

## Gefundene Ursachen und Änderungen

1. **Leere und doppelte Modellkontexte:** Der Agent erhielt alle leeren Formularfelder, interne Steuerdaten und denselben kompletten Stand nochmals als Werkzeugergebnis. `lib/mora/portal/agent.js` liefert nun relevante Fakten, ausdrücklich unbekannte/unsichere Angaben, Korrekturmarkierungen und kompakte bestätigte Aktionszustände. Ein Werkzeug zur Faktenerfassung bestätigt nur die Verarbeitung; der aktuelle Stand wird einmal im nächsten Modellkontext geliefert. Der Rollenauftrag beschreibt die Anliegenaufnahme statt einer technischen Diagnosepflicht. Keine festen Gesprächsantworten und keine neue Diagnose-Abfolge.
2. **Lokale Umklassifizierung trotz korrekter Verneinung:** Im echten Wasser-Gespräch sagte das Modell, ein undichtes Rohr sei nicht festgestellt. Die strukturierten Daten wechselten trotzdem von Lavabo auf Rohr. `applyPatch` konnte bei einem ausgelassenen Einrichtungsfeld die letzte Nachricht erneut nach Stichwörtern klassifizieren. Dieses Verhalten ist mit der verneinten Aussage reproduziert. Strukturierte Patches verwenden jetzt ausschliesslich die ausdrücklich übergebenen Einrichtungswerte; Weglassen bedeutet Behalten. Der ursprüngliche Live-Lauf enthält keine vollständigen Tool-Eingaben, daher lässt sich eine zusätzliche Modellbeteiligung an genau diesem historischen Feldwechsel nicht rückwirkend ausschliessen.
3. **Unsicherheit versus Rücknahme:** Im Live-Lauf wurde eine unsichere Anzahl als gelöschte Korrektur markiert. Die Werkzeugfelder erklären nun ausdrücklich den Unterschied zwischen Unsicherheit, unbekannt und Rücknahme. Zusätzlich konnte `clearFields` einen bereits gesetzten Unsicherheitsmarker überschreiben; diese reproduzierbare Reihenfolge ist korrigiert. Unsicherheit bewahrt den letzten bestätigten Wert und einen getrennten Kandidaten.
4. **Bestätigtes Speichern wurde sprachlich blockiert:** Die bisherige Erfolgsprüfung wies auch lokale Speicherbehauptungen mit echtem aktuellem Beleg zurück. Solche Aussagen sind jetzt ausschliesslich bei passendem aktuellem Speicherbeleg und explizit lokalem Geltungsbereich erlaubt. Alte Belege und externe Aktionen erhalten diese Ausnahme nicht.
5. **Überflüssige Generierung nach einer Aktion:** Nach einer gültigen Formularanforderung endet der Modelllauf. Die bestehende Oberfläche öffnet das Formular und bestätigt das wirkliche Ergebnis. Ein zweiter Modellaufruf darf den Aktionserfolg nicht erraten.
6. **Korrekte Verneinung als Erfolg missverstanden:** Die echte Statusantwort „Es wurde nicht an die Bewirtschaftung versendet.“ scheiterte an einer nur auf den Empfängernamen MORADA begrenzten Negationsprüfung. Vollständige verneinte Sätze akzeptieren jetzt auch andere Empfänger. Gemischte Aussagen wie „nicht an MORADA gesendet, aber an Alexander versendet“ und „nicht nur …“ bleiben gesperrt.
7. **Wortfilter konnte zusammengesetzte Aussagen nicht verstehen:** Auch „lokal gespeichert und nicht an MORADA gesendet“ wurde in einem echten Statusdialog abgelehnt. Ein unklarer Treffer des lokalen Filters löst jetzt höchstens eine zusätzliche Bedeutungsprüfung mit demselben Modell aus. Sie bekommt nur die Kandidatenantwort und die tatsächlichen Fähigkeiten/Speicherbelege, erzeugt ausschliesslich `allowed`, schreibt keine Kundenantwort um und führt keine Aktion aus. Ein fehlender oder negativer Prüfentscheid bleibt gesperrt. Auch dieser Aufruf benötigt vorher eine Budgetreserve und bleibt innerhalb derselben Zeitgrenze. Die Mehrkosten entstehen nur bei einem solchen Filtertreffer, nicht bei jeder Nachricht.
8. **Versehentlich alte Variante geöffnet:** Das Portal verwendete ohne speziellen Query-Parameter weiterhin die alte Architektur. Die neue Steuerung ist nun Standard in dieser Preview; getrennte Sitzungsschlüssel verhindern die Vermischung alter und neuer Sitzungen.

## Datenmapping und Aktionen

`portalCaseFields` bleibt die zentrale Zuordnung zu den tatsächlich vorhandenen Feldern `title`, `category`, `unit` und `description`. Einrichtung, Defekt, Anzahl, Beginn, Umfang und zusätzliche Beobachtungen werden lesbar in die vorhandene Beschreibung übernommen, soweit das Portal keine eigenen Spalten hat. `portalCaseEvidence` hält die zugehörige MORA-Referenz. Unbekannte Angaben werden als solche behandelt; nicht genannte Angaben werden nicht ergänzt.

`portalActionState` bleibt die gemeinsame Autorität für Oberfläche, Modellkontext und validierte Aktion. Aktuelle statt historischer Buttons, stabile Anliegen-ID, Revision und Inhaltsbeleg verhindern doppelte neue Entwürfe. Eine Ergänzung nach dem Speichern aktualisiert dasselbe Anliegen. Formularöffnung ist keine Speicherung. Erst die vorhandenen Funktionen `caseOpenForm`, `opsSaveRecord`, `portalReadStored` und `caseDetail` beziehungsweise ihr tatsächlicher Schreib-/Rücklesebeleg bestätigen den lokalen Erfolg. Fotos bleiben dem betreffenden Anliegen zugeordnet. Es gibt keinen angebundenen externen Versand.

Die normalen Antworttexte in den Gesprächsnachweisen stammen unverändert vom Modell. Systemprompt, Werkzeuge und verifizierter Kontext beeinflussen sie. Begrüssung, Bedienstatus, Sicherheits-Soforthinweis und Speicherbelege stammen aus der Anwendung; sie sind keine als KI ausgegebenen Antworten. Abgelehnte Antworten werden nicht als Kundenantwort angezeigt. Preview-Diagnosen werden nur an den jeweiligen Gesprächsaufrufer zurückgegeben, nicht mit Kundentext in Runtime-Logs geschrieben.

## Echte KI-Prüfung

Der vollständige Lauf auf Commit `30157066cde9853eddda62f2895b3354ca81595f` umfasst dieselben 20 mehrteiligen Fälle aus `scripts/quality-phase1/cases.json`: **52/52 HTTP-Antworten erfolgreich, 92 Modellaufrufe**. Das allein war kein Bestehensbeleg: Die anschliessende Datenprüfung fand die beiden oben beschriebenen Fehler in den Fällen 12 und 19. Der ursprüngliche fehlgeschlagene Datenprüfbericht bleibt erhalten.

Nach diesen Änderungen wurden die betroffenen vollständigen Gespräche separat erneut geprüft: **6/6 erfolgreiche Antworten**, nun **14/14 bestandene Datenprüfungen** unter Einbezug dieser gezielten Nachtests. Lavabo blieb erhalten; unbekannte Ursache und unsichere Anzahl wurden korrekt dargestellt und die spätere Bestätigung übernommen. Eine zusammengeführte Datenprüfung ist ausdrücklich kein zweiter vollständiger Lauf aller 20 Gespräche auf dem Endstand.

Unveränderte Modellbeispiele aus dem vollständigen Lauf:

- Nach „lampe kaputt“: „In welchem Raum befindet sich die kaputte Lampe?“
- Nach „Nein, ich meinte das Schlafzimmer.“: „Verstanden, die Lampe im Schlafzimmer lässt sich nicht einschalten.“
- Nach unbekanntem Heizungsbeginn: „Der Beginn kann offenbleiben; diese Angabe ist für die Meldung nicht erforderlich.“
- Nach bestätigter Anzahl: „Dann ist genau eine Lampe im Wohnzimmer betroffen.“
- Versandstatus: „Nein, es wurde nichts an MORADA gesendet. Ein direkter Versand ist hier nicht möglich.“
- Weiterhin nicht ideal: „Sie können den bereits angebotenen Button nutzen, wenn Sie die Meldung vorbereiten möchten.“ Das wiederholt einen Bedienhinweis, obwohl kein neuer Button nötig ist.

Die Sicherheitsfälle verweigerten einen erneuten Steckdosentest und berücksichtigten ein gefährdetes Kind. Allgemeine Immobilien-/Eigentümerfragen wurden beantwortet, ohne persönliche Unterlagen zu erfinden. Das ist eine Prüfung dieser Fälle, keine fachrechtliche Zertifizierung sämtlicher möglicher Antworten.

## Geschwindigkeit und Kosten

Im vollständigen 20er-Lauf: Median Backend **5,277 s**, davon Modell/Gateway **4,952 s**, Guthabenprüfung **0,290 s**. HTTP-Median im Testtransport **10,674 s**. Es gab Ausreisser über 30 Sekunden. Die Zeit im Modellaufruf umfasst Gateway und Anbieter; reine Modelllatenz und Gateway-Anteil sind mangels separater Telemetrie nicht belastbar trennbar. Der Testtransport enthält zusätzliche Netzwerk-/Proxyzeit und ist kein gemessener Kundenbrowser.

Es gibt weiterhin kein Token-Streaming. Streaming könnte nach Beginn einer Textantwort die Wahrnehmung verbessern, behebt aber nicht die beobachteten langen Wartezeiten vor beziehungsweise während Werkzeugaufrufen. Ein UI-/JSON-Parsing-Engpass ist in dieser Reihe nicht belegt. Es wird keine generelle Beschleunigung behauptet.

Die beobachtete Kontodifferenz für die 52 Nachrichten betrug **0,3612115 USD**, entsprechend durchschnittlich **0,006946 USD je Kundennachricht** beziehungsweise **0,6946 US-Cent**. Eine mehrteilige Unterhaltung kostete hier durchschnittlich rund **0,01806 USD**. Keine CHF-Umrechnung, kein garantierter Tarif und keine Produktionshochrechnung; Gesprächslänge, Modellschritte, Cache und weitere Kontonutzung beeinflussen den Wert.

Freigegebene Obergrenze dieser Arbeit: **2 USD zusätzlicher Verbrauch** ab beobachtetem Kontostand `totalUsed=1.338856132`. Der serverseitige Preview-Schutz reserviert vor jedem Modellaufruf konservativ dessen mögliche Kosten und stoppt spätestens vor `totalUsed=3.338856132`. Keine Aufladung oder Änderung eines Zahlungsplans. Der Kontoabgleich ist nicht atomar und ersetzt für parallelen Produktionsbetrieb kein mandantenfähiges Ausgaben-/Quotenmanagement.

## Noch erforderliche Portal-Schnittstellen

- Authentifizierte Kunden-, Objekt- und Berechtigungskontexte vom Portal; keine frei erfundenen Benutzerrollen.
- Serverseitiges Anlegen/Aktualisieren von Anliegen mit stabiler ID, Idempotenzschlüssel, Revision beziehungsweise Konfliktschutz und überprüfbarer Rückleseantwort. Ein Zustand „gesendet“ braucht einen tatsächlichen Backend-Beleg.
- Dauerhafte, berechtigte Fotoablage und Zuordnung zur Anliegen-ID; aktuell nur die vorhandene lokale Ablage.
- Tatsächlicher Walkthrough mit auswählbaren Objekten plus serverseitig autorisierter Auswahlauflösung. Der vorhandene Vertrag `attachWalkthroughSelection` und die erforderlichen Objekt-/Raum-IDs stehen in `MORA_AGENT_WALKTHROUGH_2026_10_27.md`. Es gibt noch keinen funktionsfähigen Heizkörper-Hotspot in dieser HTML-Datei.
- Produktionsbudget, Ausfall-/Quotenstrategie und serverseitige Sicherheit müssen mit der späteren Kundenanbindung umgesetzt werden. Die Preview-Routen bleiben in Produktion gesperrt.

Eine neue visuelle Desktop-/Mobilabnahme ist nicht belegt. Die automatische Freigabeprüfung blockierte zuvor den Browserzugriff bei Weiterleitung zur Vercel-Kontoseite; ein lokaler Browser war nicht verfügbar. Native HTML-, Formular- und Speicherprüfungen laufen deshalb explizit in JSDOM mit echten HTTPS-KI-Antworten, nicht als gerenderter Gerätetest.

## Reproduzierbarkeit und Abnahmeumfang

- **376 automatisierte Tests bestanden**; Typprüfung, Build mit 122 geprüften Quelldateien und Diff-Prüfung bestanden. Darunter SDK-Werkzeugläufe, signierte Sitzungsgrenzen, echte native Portal-Speicherlogik, Dublettenschutz, Belegprüfung, unbestätigte/externe Erfolgsbehauptungen, Gefahrenzustände und Walkthrough-Referenzen.
- Ein früher Sol-Pilot scheiterte bei der vierten Nachricht mit HTTP 503 (Verbrauch 0,0349132 USD). Die genaue verworfene Antwort wurde damals nicht erfasst. Dieser Fehlschlag bleibt im Nachweis; er wird nicht als erfolgreicher Test gezählt. Nachfolgende Diagnostik und das Beenden des Modelllaufs nach gültiger Formularanforderung machen solche Aktionsabläufe überprüfbar und vermeiden einen unnötigen Bestätigungsschritt.
- Ein anschliessender Lampenpilot bestand inklusive lokalem Speichern, Raumkorrektur unter gleicher ID, Foto und simuliertem Speicherfehler (echte KI, 0,024204 USD). Der vollständige 20er-Lauf kostete 0,3612115 USD; die sechs gezielten Nachtest-Nachrichten kosteten 0,0610011 USD.
- Die End-to-End-Tests verwenden echte Gateway-Antworten über HTTPS und die tatsächliche bereitgestellte Portal-HTML. JSDOM ersetzt nur die Browserumgebung. Absichtlich ausgelöste Speicherfehler sind technische Fehlerproben und keine simulierten KI-Erfolge.

Nachweise im Repository:

- `docs/evidence/portal-ready-quality-2026-10-27.json`: alle 20 ursprünglichen Gespräche, Antworten, Daten, Token-/Zeitwerte.
- `docs/evidence/portal-ready-quality-2026-10-27-assessment.json`: ursprüngliche Datenprüfung mit zwei Fehlern.
- `docs/evidence/portal-ready-recheck-2026-10-27.json`: vollständige echte Wiederholungen der Fälle 12 und 19 nach der Korrektur.
- `docs/evidence/portal-ready-quality-2026-10-27-rechecked-assessment.json`: ausdrücklich zusammengeführte Datenprüfung; kein verschleierter kompletter Wiederholungslauf.
- `docs/evidence/portal-ready-native-pilot-2026-10-27.json` und `portal-ready-native-diagnostic-2026-10-27.json`: die vorangegangenen Portal-Piloten inklusive des Fehlversuchs.
- `scripts/portal-integration/assess-ready.mjs` und `live-v11.mjs`: wiederholbare Daten- und native Portalprüfung.

## Abschliessend gespeicherte Portal-Daten

Der native Fünferlauf auf `20778d0` bestand für Steckdose, Wasserfleck, unbekannte Einrichtung und mehrere Anliegen (4/5). Beim Lampenfall war bereits ein korrekter Datensatz gespeichert; die erste Statusfrage scheiterte an der zu engen Negationsprüfung. Ein weiterer Lampenlauf auf `5a330b1` bestand die erste Statusfrage, scheiterte jedoch an der zusammengesetzten Speicher-/Versandaussage. Beide Fehler bleiben in den Dateien `portal-ready-native-final-2026-10-27.json` und `portal-ready-native-lamp-recheck-2026-10-27.json` sichtbar.

Der vollständige abschliessende Lampenlauf auf der endgültigen Preview `5e076a1` bestand: **7/7 echte Kundennachrichten**, Formularübernahme, bestätigte Speicherung, beide Statusfragen, Korrektur, Foto und absichtlich ausgelöster Speicherfehler. Die zusätzliche semantische Nachprüfung war in diesem letzten Live-Lauf nicht nötig, weil die Modellantworten ohne unklaren Filtertreffer auskamen. Ihr begrenzter SDK-Ablauf inklusive Zustimmung, Ablehnung und Budgetabbruch ist separat mit ausdrücklich gemocktem Transport automatisiert getestet; eine tatsächliche Live-Qualitätsbewertung dieses seltenen Prüferpfades wird nicht behauptet.

Zusammen mit den vier bestandenen übrigen Portalabläufen sind damit alle fünf vorgesehenen nativen Szenarien mit erfolgreichen Nachweisen abgedeckt; es war kein fehlerfreier einzelner Fünferlauf auf dem letzten Commit.

| Prüfung | Tatsächlicher Nachweis |
| --- | --- |
| Lampe und kurze Antworten | `light`, Wohnzimmer, Anzahl 1 und zusätzliche Beobachtung korrekt erfasst |
| Lokales Speichern | Ein tatsächlich gespeicherter nativer Datensatz, Rücklesebeleg im Gespräch |
| Korrektur nach Speicherung | Dieselbe ID, Titel „Lampe / Leuchte · Schlafzimmer“, Bereich Schlafzimmer; Anzahl und Beobachtungen erhalten |
| Foto | Ein Foto am selben Anliegen gespeichert |
| Doppelte Ausführung | Doppelte Klicks/Formularabgaben erzeugen keinen zweiten Datensatz |
| Speicherfehler | Bestehende gespeicherte Daten unverändert, Fehler sichtbar, kein zusätzlicher Erfolgsbeleg |
| Steckdose | „Steckdose · Büro“ im vorhandenen Register gespeichert |
| Wasserfleck | „Wand · Schlafzimmer“ gespeichert, keine erfundene Rohrdiagnose |
| Unbekannte Einrichtung | „Spezialteil · Bad“ gespeichert; kein willkürliches bekanntes Gerät |
| Zwei Anliegen | Getrennte IDs für „Türgriff · Flur“ und „Lampe / Leuchte · Wohnzimmer“ |

Beispiel der tatsächlich gespeicherten Lampenbeschreibung nach Korrektur:

```text
Fachbereich: Elektrik / Beleuchtung
Lampe / Leuchte
kaputt
Anzahl: 1
Bereich: Schlafzimmer
Umfang / Situation: Nur eine Lampe betroffen
Zusatzangaben: Sonst ist alles normal.
Dringlichkeit: Normal
Beginn: Nicht angegeben
```

Abschliessender Nachweis: `docs/evidence/portal-ready-native-accepted-2026-10-27.json`.

## Gesamtkosten und Branch-Schutz

Gesamter beobachteter zusätzlicher Kontoverbrauch dieser Arbeit, einschliesslich Fehlversuchen und Nachtests: **0,5985484 USD**, gerundet **0,60 USD**. Anfangsverbrauch 1,338856132 USD; abschliessend 1,937404532 USD; verbleibendes Konto-Guthaben laut letzter Abfrage **23,062595468 USD**. Die 2-USD-Testgrenze wurde eingehalten und bleibt aktiv; es wurden keine neuen Zahlungen ausgelöst.

`main` blieb auf `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` auf `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Die geprüfte Preview ist ein Deployment mit `target=null`, kein Produktionsdeployment. Der native Portalquelltext ausserhalb des MORA-Blocks ist durch den vorhandenen Quellvergleich unverändert bestätigt.
