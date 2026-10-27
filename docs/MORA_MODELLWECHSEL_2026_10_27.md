# MORA: Modellwechsel und überprüfte Grenzen, 27.10.2026

Aktives Modell der gelieferten Preview: `anthropic/claude-opus-5.5-fast`, weiterhin ausschliesslich über das geschützte Vercel AI Gateway. Kein Schlüssel im Frontend. Produktivsystem, `main`, `alex-portal` und der native Portalbereich wurden nicht verändert.

Preview: https://morada-mora-2zqixfldm-dianaporschke-1255s-projects.vercel.app/portal.html

Getesteter Laufzeit-Commit: `3239160268177fcdbb6e2a87e8389bb6a7f490d1`.

## Was tatsächlich geändert wurde

- GPT-6.1 Sol wurde ersetzt. Ein erster Sonnet-5.5-Versuch wurde nach den tatsächlichen Antworten nicht als ausreichende sprachliche Verbesserung akzeptiert. Die Ausgaben bleiben vollständig erhalten.
- Opus wird mit niedrigem Denkaufwand und einer nach Antwortbeginn sortierten Gateway-Anbieterauswahl angefragt. Der Gateway kann bei fehlender Fast-Kapazität auf die normale Opus-Ausführung zurückfallen. Die schnellere Ausführung jeder einzelnen Antwort ist damit nicht garantiert.
- Die Gesprächsvorgabe verlangt situationsgerechtes, kurzes Bedauern bei neuen Problemen, wechselnde natürliche Formulierungen und keine erneute Entschuldigung nach jeder Ergänzung. Es gibt keine lokal ausgewählte Liste fertiger Mitgefühlsantworten.
- Nachdem die Angaben erfolgreich erfasst wurden, sieht der antwortende Schritt das tatsächliche Kundengespräch und den bestätigten Datenstand. Das interne Werkzeugprotokoll wird diesem Schritt nicht erneut als Gespräch vorgelegt. Die bereits ausgeführte grosse Erfassungsbeschreibung wird ebenfalls weggelassen. Öffnen und Prüfen des Formulars bleiben möglich; ein kombinierter Erfassungs- und Vorbereitungswunsch wird automatisch getestet.
- Ein vorhandener gespeicherter Entwurf (`hasStoredDraft`) ist jetzt ausdrücklich von noch nicht gespeicherten Änderungen (`savedFactsMatch=false`) unterschieden. Das behebt eine konkrete Kontextlücke: Das Modell hatte nach einer Raumkorrektur eine frühere korrekte Speicherbestätigung fälschlich zurückgenommen. Die erste betroffene echte Antwort bleibt in den Belegen sichtbar.
- Der Preisabgleich verwendet den exakten Eintrag im öffentlichen Gateway-Modellkatalog. Der SDK-Konfigurationskatalog lieferte nur den normalen Opus-Eintrag; deswegen blockierte die erste Fast-Preview bereits vor der Inferenz. Der Fast-Aufruf wird niemals zum billigeren Basismodellpreis reserviert.

Veränderte Laufzeitdateien: `lib/mora/portal/agent.js`, `lib/mora/portal/budget.js`, `lib/mora/portal/action-state.js`, `api/portal-chat.js`. Ergänzt wurden Regressionen und ein kompakter Modus des vorhandenen echten Portal-Testablaufs. Die HTML-Datei, das Design, die Portalnavigation und die nativen Speicherfunktionen blieben unverändert.

## Was die bisherigen Antworten nachweisen

Die störenden Formulierungen stammen in den aufgezeichneten Läufen aus echten Modellantworten. Der Client zeigt diese Texte unverändert als Text an. Er erzeugt technische Speicherbestätigungen separat und erst nach der tatsächlichen Aktion. Die Formulierungen sind hier kein lokaler starrer Schadensdialog.

Der erste Sonnet-Versuch antwortete auf „wohnzimmer“ unter anderem: „Danke, die Lampe im Wohnzimmer, die sich nicht einschalten lässt, habe ich notiert.“ Das wurde ausdrücklich als sprachlich unzureichend beurteilt.

Opus mit getrenntem Antwortkontext, Laufzeit `5f8c3c9`, antwortete tatsächlich:

- Kunde: „lampe nicht gehen“ — Modell: „Schade, dass Ihre Lampe nicht angeht. In welchem Raum ist die Lampe?“
- Kunde: „wohnzimmer“ — Modell: „Danke, die Lampe im Wohnzimmer. Mehr brauchen wir nicht. Wenn Sie möchten, kann ich die Angaben jetzt vorbereiten, damit Sie sie prüfen oder ein Foto hinzufügen können. Diese Angaben bleiben nur hier auf Ihrem Gerät.“
- Kunde: „nein schlafzimmer“ — Modell: „Alles klar, dann ist es die Lampe im Schlafzimmer. Den Button zum Vorbereiten der Angaben sehen Sie bereits.“

Ehrliche Bewertung: Das Objekt und die Korrektur stimmen, die Antworten waren in dieser Stichprobe deutlich unter einer Minute verfügbar. Die Sprache ist weiterhin teilweise formularorientiert; insbesondere die zweite Antwort ist noch zu ausführlich und enthält weiterhin eine Dankesformel. Diese Stichprobe beweist keine durchgehend natürliche oder „hochintelligente“ Assistenz. Die Änderungen an Modell, Kontext und Routing wurden gemeinsam erprobt; es handelt sich nicht um einen isolierten kausalen Modellbenchmark.

## Messverfahren und offene Grenzen

`timingMs.model` misst den Modell-/Gateway-Aufruf gemeinsam; der Gateway liefert hier keine getrennte reine Modell- und Vermittlungslatenz. `creditGuard` wird separat gemessen. `total` ist die gesamte Verarbeitung innerhalb des API-Handlers. Die HTTP-Zeit stammt vom externen Testzugang einschliesslich dessen Proxy-/Netzwerkweg und ist nicht mit der Messung auf Dianas Handy identisch.

Die Oberfläche wartet weiterhin auf die vollständige, geprüfte Antwort. Streaming wurde nicht als erledigt behauptet oder eingebaut. Erste und vollständige sichtbare Antwort liegen daher nahe beieinander, ausser wenn zuerst eine tatsächliche Formularaktion ausgeführt wird. Eine gemeldete 60-Sekunden-Antwort aus Dianas früherer Sitzung konnte keinem konkreten Serverrequest zugeordnet werden; ihre genaue Ursache ist deshalb nicht nachgewiesen.

Die nativen Tests führen die tatsächliche gelieferte HTML- und JavaScript-Logik mit echten HTTPS-Modellantworten und Speicher-/Ausleseprüfungen in JSDOM aus. Dateiauswahl und Browser-APIs werden kontrolliert bereitgestellt. Das sind keine gerenderten Desktop-/Mobilgeräte-Tests. Eine erneute visuelle Browserprüfung wurde nicht behauptet.

Ein Versand an MORADA, Beauftragung, persönliche Dokumentensuche, Bildanalyse und eine echte Walkthrough-Auswahl sind weiterhin nicht angeschlossen. Fotos können lokal dem richtigen gespeicherten Anliegen zugeordnet werden. Die vorliegende Integration bleibt eine Preview.

## Kosten und Betriebsgrenze

Die ursprüngliche Freigabe bleibt unverändert: Ausgangsverbrauch 1.338856132 USD, zusätzlich maximal 2 USD, absolute Grenze 3.338856132 USD. Kein neues Guthaben, keine automatische Aufladung, keine Änderung von Zahlungseinstellungen. Die Prüfung reserviert vor jedem Modellaufruf konservativ dessen Höchstkosten und kann deshalb bereits vor vollständigem Aufbrauchen des rechnerischen Restbetrags stoppen.

Opus Fast ist teurer als Sonnet. Die tatsächlichen durchschnittlichen Kosten werden unten ausgewiesen; sie sind keine garantierte Pauschale pro Antwort. Lange Gespräche und zusätzliche Werkzeugschritte erhöhen die Kosten. Diese begrenzte Preview-Freigabe ist ausdrücklich keine dauerhafte Kosten- oder Verfügbarkeitslösung für sämtliche späteren Portalkunden.

## Belege

- `docs/evidence/portal-claude-switch-2026-10-27.json`: 4 Sonnet-Gespräche, 12 echte Kundennachrichten; verworfene sprachliche Ergebnisse bleiben erhalten.
- `docs/evidence/portal-opus-preflight-failure-2026-10-27.json`: die fehlgeschlagene reine Vorprüfung ohne Modellverbrauch und die Katalogdiagnose.
- `docs/evidence/portal-opus-native-2026-10-27.json`: 7 echte Opus-Kundennachrichten plus tatsächliche Speicherprüfungen; native Datentests bestanden, aber die oben beschriebene sprachlich falsche Rücknahme der früheren Speicherung wurde danach behoben.
- `docs/evidence/portal-opus-reply-2026-10-27.json`: das exakte kurze Kundenbeispiel mit späterer Raumkorrektur; 3 echte Antworten.
- `docs/evidence/portal-opus-final-native-2026-10-27.json`: abschliessender kompakter nativer Test der gelieferten Laufzeit.

## Abgeschlossene Prüfung und gemessene Kosten

378 automatisierte Tests bestanden; Typecheck, Build und Diff-Prüfung bestanden. Nach der letzten Änderung wurden der bestehende gespeicherte Entwurf und seine späteren Änderungen zusätzlich mit echten Modellantworten geprüft.

Der abschliessende Lauf umfasste drei Kundennachrichten und die tatsächlichen Portalaktionen. Ergebnis: genau ein Eintrag `Lampe / Leuchte · Schlafzimmer`, Anzahl 1, Beginn nicht angegeben, Zusatzangabe „Sonst ist alles normal.“ erhalten, ein korrekt zugeordnetes Testfoto. Doppelklicks und ein kontrollierter Speicherfehler erzeugten keinen zusätzlichen Eintrag und keine falsche Speicherbestätigung.

Die echte letzte Korrekturantwort lautete: „Alles klar, dann geht es um die Lampe im Schlafzimmer. Der bisherige Entwurf ist noch mit Wohnzimmer gespeichert. Über **Vorbereiten** können Sie die Meldung mit dem Schlafzimmer aktualisieren und auf Wunsch ein Foto hinzufügen. Gespeichert wird nur auf Ihrem Gerät, nichts geht automatisch an die Verwaltung.“ Der alte Speicherstand wird jetzt korrekt erklärt. Die Benennung des Buttons und die Länge der Antwort sind weiterhin verbesserungswürdig.

Die letzte erste Antwort begann zwar mit „Das tut mir leid“, fügte jedoch unnötig eine Situation ohne Licht am Abend hinzu. Eine einzelne defekte Lampe beweist keine vollständige Dunkelheit. Auch deswegen wird die Sprache nicht als vollständig zufriedenstellend bewertet.

| Lauf | Echte Kundennachrichten | Backend-Median | Externer HTTP-Median | Kosten gesamt | Kosten je Kundennachricht |
|---|---:|---:|---:|---:|---:|
| Sonnet, sprachlich verworfen | 12 | 3.73 s | 9.69 s | 0.247804 USD | 0.0207 USD |
| Opus, erster nativer Lauf | 7 | 2.45 s | 8.11 s | 0.431216 USD | 0.0616 USD |
| Opus, kurzes Kundenbeispiel | 3 | 2.96 s | 8.84 s | 0.202040 USD | 0.0673 USD |
| Opus, finale native Korrektur | 3 | 3.42 s | 9.08 s | 0.229320 USD | 0.0764 USD |

Die drei Antworten des finalen Laufs brauchten extern 9,08 s, 7,43 s und 20,87 s. Die letzte Korrektur brauchte im Backend 15,13 s, davon 14,06 s für Modell/Gateway. Eine durchgehende schnelle Reaktion ist damit noch nicht nachgewiesen. Alle Opus-Testnachrichten zusammen kosteten im Mittel 0.0664 USD pro Kundennachricht, also etwa 6.6 US-Cent. Das ist ausdrücklich kein kostengünstiger Produktionsnachweis.

Dieser Auftrag verbrauchte 1.110380 USD. Seit der ursprünglichen 2-USD-Freigabe sind 1.729015 USD verbraucht; rechnerisch bleiben 0.270985 USD. Weitere umfangreiche KI-Tests wurden deshalb beendet. Der strengere Höchstkosten-Vorbehalt kann schon vorher greifen. Die übrige Gateway-Guthabenanzeige ist keine zusätzliche Ausgabefreigabe.

Die Messwerte und automatischen Datenprüfungen stehen in `docs/evidence/portal-model-switch-assessment-2026-10-27.json`. 25 echte Kundennachrichten wurden in diesem Auftrag beantwortet; das ist kein neuer vollständiger Vergleich von 20 Gesprächen pro Variante.

Empfehlung: Opus ist hier ein nachvollziehbar eingebauter Modellwechsel, aber noch keine wirtschaftlich und sprachlich freigegebene Produktionslösung. Vor einer solchen Freigabe müssen insbesondere die verbleibenden Standardformulierungen, lange Ausreisser und die Kosten je Gespräch mit repräsentativen Dialogen geprüft werden. Streaming allein würde die vorhandene Antwortqualität nicht ändern. Es wurde kein weiterer Umbau oder unfreigegebenes Testbudget begonnen.
