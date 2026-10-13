# MORA Work 2.0 – Weiterentwicklung und tatsächliche Prüfung

13. Oktober 2026. Repository `dianaporschke/morada.mora.ai`, ausschliesslich Branch `codex/mora-ai-2.0`. Übernahme ab dem erneut überprüften Commit `ee6df39`. Modell unverändert: `inception/mercury-2.5` über den bestehenden Vercel AI Gateway.

Die dokumentierten Dokumentenfehler, die Zuordnung mehrerer bestehender Anliegen und die Verarbeitung von Korrekturen wurden gezielt verbessert. Die echte KI bleibt für normale Antworten verantwortlich. **Die vollständige Premium-Abnahme bleibt offen:** Die letzten echten Antworten enthalten weiterhin sprachliche Schwächen und unnötige Floskeln. Das Projekt ist deshalb noch keine aussergewöhnlich hochwertige, fertig abgenommene Kundenassistenz.

## Implementierte Verbesserungen

- **Gesprächsführung:** Der überladene Modellauftrag wurde neu gegliedert. Der Kontext enthält die genaue offene Rückfrage und bereits erfragte Felder. Korrekturen sollen knapp bestätigt werden; eine neue Qualifikationsfrage nach einer einfachen Raumkorrektur wird zurückgewiesen und vom Modell neu formuliert.
- **Echte Korrektur statt Formularantwort:** Ein Korrekturversuch erhält dieselbe originale Kundennachricht. Reparaturhinweise stehen im Systemauftrag, nicht als künstliche neue Kundennachricht. Es gibt keine lokal erzeugte Ersatzantwort. Regulär bleibt es bei einer Generation; höchstens ein echter Korrekturversuch ist erlaubt.
- **Dokumente und Portalbereiche:** Die tatsächlichen Bereiche werden mit ihren Namen und Fähigkeiten übergeben. Falsche Fundorte, der erfundene Bereich „Service unter Dokumente“ und Zusagen nach dem Muster „Ich kann nicht, aber Sie können dort …“ werden geprüft. Navigation ist kein Beleg für vorhandene Kundenunterlagen.
- **Mehrere Anliegen:** Eine Kundennachricht kann mehrere bereits bestehende Anliegen gezielt aktualisieren. Zusätzliche Updates adressieren ausschliesslich Referenzen aus der signierten Sitzung. Eine dabei entdeckte Referenzverwechslung wurde behoben: Auch weitere Updates werden vor der Prüfung in ihre tatsächlich signierten IDs aufgelöst. Dadurch sind bekannte Angaben korrekt verfügbar und doppelte Ziele werden erkannt. Fremde oder doppelte Referenzen werden abgelehnt. Beide Anliegen behalten ihre IDs und getrennte Räume, Zeiten und Details.
- **Nichtwissen:** Eine ausdrücklich unbekannte Ursache wird separat als `cause` geführt. „Weiss nöd warum“ löscht keine bekannte Orts-/Symptombeschreibung. Eine später ausdrücklich genannte Ursache kann den Marker ablösen. MORA stellt keine eigene Diagnose.
- **Physische Fakten:** „Unter dem Lavabo“ beweist keinen Rohrdefekt. Eine unbelegte optionale `pipe`-Zuordnung wird ohne aktuelle Kundenangabe oder bereits bekannten Rohrbezug verworfen, wenn der Modelltext selbst keinen solchen Defekt behauptet. Alle übrigen Fakten und der echte Wortlaut bleiben erhalten; dafür ist keine zusätzliche Generation nötig. Eine entsprechende falsche Behauptung im Text löst weiterhin eine echte Korrektur aus.
- **Buttons:** Ein konkretes Entwurfsangebot braucht eine passende, serverseitig geprüfte Aktion. Reine Bestätigungen bleiben ohne Buttons. Freie Texteingabe, Fotos, Anliegenauswahl und der bestehende Serviceentwurf bleiben erhalten.
- **Sprache:** Konkret beobachtete beschädigte Formulierungen wie „Ich habe den Stand not“ lösen eine echte Neugenerierung aus. Diese begrenzte Prüfung ist keine allgemeine Grammatik- oder Bedeutungsprüfung; andere sprachliche Fehler können weiterhin auftreten.
- **Messung:** Der Browser protokolliert zusätzlich die tatsächliche Zeit vom Absenden bis zur verarbeiteten Antwort, getrennt von Server-/Modellzeit und ohne Kundentexte, Sessions oder Fotos. Der neutrale Ladestatus lautet „MORA antwortet …“. Design, CSS und Portalstruktur wurden nicht umgestaltet.

## Automatisierte Prüfung

**205 Tests bestanden**, Typecheck, Lint, Build und `git diff --check` bestanden. Dreizehn neue Regressionen ergänzen den Ausgangsstand mit 192 Tests. Sie prüfen unter anderem falsche Dokumentenversprechen, gleichzeitige Änderungen bestehender Anliegen, erfundene Referenzen, Korrekturen ohne neue Pflichtfragen, unbekannte Ursachen, unbelegte Rohrzuordnung und die Konsistenz von Entwurfsangebot und Button.

Die vorhandenen DOM-Flows bei 1280 und 390 Pixeln prüfen freie Eingabe, Buttons, Fotos, Speicherung, Fehlerbehandlung und den vorausgefüllten Serviceentwurf. Simulierte SDK-Ausgaben dieser Tests sind ausdrücklich kein Nachweis echter KI-Qualität.

## Echte KI-Gespräche

Alle Live-Tests verwendeten synthetische Angaben und geschützte, unveränderliche Preview-URLs. Die Dateien unter `docs/evidence/mora-work2-*.json` enthalten tatsächliche Modellantworten, HTTP-Ergebnisse, Aktionen, Anliegen-IDs und Nutzungs-/Zeitdaten. Keine Schlüssel, Zugangslinks oder signierten Sessions wurden gespeichert.

| Lauf | Ergebnis und Einordnung |
| --- | --- |
| Ausgangsstand `ee6df39`, 4 Runden | Mietvertragsfrage scheiterte; drei Modellantworten. |
| Erster Kandidat `a478b28`, 4 Runden | HTTP erfolgreich, aber falsche Vertrags-/Abrechnungsfundorte. Ausdrücklich keine Abnahme. |
| Struktureller Lauf `0489462`, 16 Runden | Dokumentenfrage verbessert; ein gleichzeitiges Update scheiterte. Beschädigte Sprache und unnötige Rückfragen blieben sichtbar. Separater lokaler Sicherheitsfall, keine KI-Antwort. |
| Gesamtlauf `b90812b`, 10 Runden | Alle HTTP-Runden erfolgreich, 13 echte Generationen. Korrektur und gleichzeitige Updates bestanden. Unbekannte Ursache gespeichert. Eine unbelegte Rohrzuordnung und sprachliche Schwächen wurden zusätzlich erkannt. |
| Bauteilprüfung `bdde142`, 5 Runden | Ursache und generischer Wasseraustritt korrekt, aber erster Mehrfachanliegen-Turn scheiterte. Der folgende Nachtrag hatte deshalb keinen erfolgreichen Erstkontext; er ist kein bestandener Mehrfachanliegen-Test. Der separate Sicherheitsweg funktionierte mit 0 Modellaufrufen. |
| Optionale Metadaten `deca15b`, 4 Runden | Drei erfolgreiche Modellantworten, weiterer Mehrfach-Updatefehler. Die Laufzeitprotokolle und ein neuer Regressionstest zeigten die noch nicht aufgelösten Zusatzreferenzen in der Validierung. |
| Letzte gezielte Prüfung `ef2e86c`, 2 Runden | Beide Runden HTTP 200 mit echten Modellantworten. Zwei Anliegen behalten ihre IDs. Wohnzimmer wird bei der Heizung ergänzt; Badezimmer bleibt beim Wasser. Der ausdrücklich genannte Rohrbezug und „heute Morgen“ aktualisieren das bestehende Wasseranliegen. Keine doppelten Anliegen und keine Buttons nach der Ergänzung. Erste Runde eine Generation, zweite Runde zwei Generationen. |

Nachgewiesen im Gesamtlauf: Wohnzimmer → Schlafzimmer bleibt dasselbe Steckdosenanliegen, ohne neue Rückfrage oder erneuten Button. Heizung und Wasser behalten zwei IDs; das Badezimmer bleibt beim Wasser, Wohnzimmer wird nur bei der Heizung ergänzt, `pipe` und „heute Morgen“ aktualisieren den bestehenden Wasserentwurf, die Position unter dem Lavabo bleibt erhalten. Der direkte Meldewunsch öffnet einen Entwurf und behauptet keinen Versand.

**Sprachliche Grenze:** Auch erfolgreiche, fachlich geprüfte Antworten sind nicht automatisch Premium. Im Gesamtlauf stand beispielsweise „einen Entwurf für das Meldung“. Unnötiger Dank, technische Einschränkungshinweise und vorschnelle Entwurfsangebote treten weiterhin auf. Bekannte beschädigte Wörter abzufangen garantiert keine durchgehend natürliche Sprache. Kein anderes Modell wurde ohne neue Modellfreigabe oder über einen zusätzlichen Abrechnungsweg eingesetzt.

**Grenze der letzten gezielten Prüfung:** Die ursprüngliche Position „unter dem Lavabo“ stand in dieser Runde nicht im strukturierten `details`-Feld. Die getrennte Zuordnung von Raum, Bauteil und Zeitpunkt ist nachgewiesen; eine vollständige Übernahme sämtlicher Beschreibungsdetails ist damit nicht nachgewiesen. Die abschliessende Antwort enthielt weiterhin die unnötige allgemeine Rückfrage „Gibt es noch etwas, das Sie hinzufügen möchten?“. Das bleibt ein offenes Qualitätsproblem.

## Antwortgeschwindigkeit und Streaming

Im zehnrundigen Gesamtlauf lag die **Serverzeit im Median bei 5,854 Sekunden**, Spanne **3,309–14,413 Sekunden**. Drei Nachrichten benötigten eine zweite Generation. Die sonstige Anwendungsarbeit lag bei **0–5 Millisekunden**. Das Modell/Gateway bestimmt nahezu die gesamte Serverwartezeit.

Der API-Testclient mass im Median **14,514 Sekunden**, Spanne **10,598–25,036 Sekunden**. Diese Zeit enthält Transport-/Proxyaufwand der Testumgebung und ist keine gemessene Browseranzeigezeit. Die Instrumentierung für eine solche Browsermessung ist implementiert; die cloudbasierte Browserprüfung erreichte nur die Vercel-Anmeldung. Eine neue visuelle Browser-/Mobilabnahme wurde deshalb nicht behauptet.

**Ein verlässlicher Geschwindigkeitsgewinn gegenüber der Baseline ist nicht nachgewiesen.** Die Baseline hatte nur drei erfolgreiche Modellrunden und andere Fälle. Ein Vergleich dieser Mediane wäre keine belastbare Leistungsabnahme. Zusätzliche Qualitätskorrekturen können Antworten verlängern; es gibt keine künstlichen Wartezeiten im Produkt.

Streaming wurde mit den versionstreuen Unterlagen des installierten AI SDK 7.0.130 geprüft. Teilweise JSON-Ausgaben erfüllen den vollständigen Fakten-/Aktionsvertrag noch nicht und lassen sich nicht gegen das komplette Schema validieren. Deshalb wird kein ungeprüfter Modelltext vorzeitig gezeigt. Token-Streaming wurde nicht implementiert; auch kein künstliches Abspielen einer bereits fertigen Antwort. Der Server behält das gemeinsame Zeitbudget und die bestehenden Fehlergrenzen.

Die letzte gezielte Zweirundenprüfung brauchte serverseitig 9,439 und 14,617 Sekunden; im API-Testclient 17,605 und 22,064 Sekunden. Die zweite Nachricht erforderte einen Korrekturversuch. Das bestätigt die funktionale Referenzkorrektur, keinen Geschwindigkeitsgewinn.

## Preview und Schutz der bestehenden Arbeit

Letzter Anwendungscode: `ef2e86c926d17dd585ca4e5b1ccc926cd5e030b5`. Getestete Code-Preview: https://morada-mora-ktwflvxpa-dianaporschke-1255s-projects.vercel.app/. Vercel bestätigt `READY`, das Projekt `morada-mora-ai`, den Entwicklungsbranch und diesen Commit. Ein nachfolgender Bericht-/Belegcommit verändert diesen Anwendungscode nicht.

`main` bleibt bei `0b86dfc3344df62d3de02d8297959a495cc822d3`; `alex-portal` bei `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Alle Schreibzugriffe betrafen ausschliesslich den Entwicklungsbranch und prüften dessen erwarteten Kopfstand. Kein Merge und kein Produktionsdeployment. Keine zusätzlichen API-Schlüssel, Guthabenkäufe, Tarif-/Modellwechsel oder Auto-Aufladeänderungen.

Unverändert noch nicht angebunden: echte Kundenrechte, persönliche Dokumente, Termine, Bearbeitungsstände, bestätigter Versand und serverseitige Foto-Uploads. Die vorhandene Portalübergabe bereitet einen Entwurf vor. `/api/requests` bleibt bei `integration_required`.

Die nächste Premium-Abnahme benötigt ein unabhängiges Dialogset und belastbar bessere sprachliche Konsistenz. Die vorhandene Modellqualität und die fehlenden Kundenschnittstellen dürfen nicht durch weitere feste Antwortvorlagen oder erfundene Fähigkeiten überdeckt werden.
