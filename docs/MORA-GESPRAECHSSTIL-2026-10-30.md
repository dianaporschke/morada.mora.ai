# MORA – Gesprächsstil, 30.10.2026

Auftrag: freundlich, verständlich und passend antworten; ausreichend erklären, ohne Füllsätze oder Wiederholungen. Keine pauschale Begrenzung auf ein bis zwei Sätze.

**Status: Qualitätsziel nicht erreicht. Keine Freigabe als verbesserte Kundenfassung.** Die neue Preview ist ein nachvollziehbarer Teststand; zehn technische Erfolge sind hier kein Nachweis für zehn gute Antworten.

## Untersuchter Teststand

Entwicklungsbranch `codex/mora-ai-2.0`. Laufzeitstand `8018ae1aee01a4eb77fcb4052fd76aad18d043ed`, Vercel Preview `dpl_Dhu6o4koVHTXQU3HNQ5fr1tUCuSK`. Kein Merge, keine Produktion. Modell, Budgetgrenze, Speicherung, Portal-HTML und UI bleiben unverändert.

- `lib/mora/portal/reply-style.js`: gemeinsame sprachliche Vorgaben für die erste Antwort und die bereits vorhandene begrenzte Korrektur. Direkter Bezug zur Frage, angemessene Empathie, jeder Satz mit neuem Inhalt, keine feste Satzanzahl, keine Briefanrede oder Erfassungsberichte.
- `lib/mora/portal/compact-agent.js`: die bestehende Korrektur erhält den Verlauf als Chatnachrichten, den bestätigten Zustand getrennt als Systemkontext und dieselben Stilvorgaben. Die verworfene Antwort wird ihr nicht als Formulierungsvorlage gegeben. Keine neue reguläre KI-Stufe, kein nachträgliches Umschreiben von Fakten oder Aktionen.
- `lib/mora/portal/view-knowledge.js`: am gelieferten HTML überprüfte Menüwege: Eigentümer `Verwaltung → Dokumente`, Mieter `Service → Meine Dokumente`. Eine erreichbare Ansicht bedeutet weiterhin nicht, dass persönliche Dateien angeschlossen sind.
- `tests/portal-compact.test.js`, `tests/portal-view-knowledge.test.js`: prüfen Kontextübergabe, gemeinsame Stilvorgaben, unveränderte Fakten/Aktionen und die echten Menübezeichnungen.

## Ursachen und Grenzen der Diagnose

Die ältere Korrekturstufe hatte weniger Gesprächskontext und eigene Formulierungsvorgaben. In den ersten Versuchen bekamen Dokumentenfragen drei Modellaufrufe; dadurch konnte eine nachträgliche Antwort die ursprünglichen Stilvorgaben wieder verlieren. Ein gemeinsamer Stiltext allein beseitigte die Wiederholungen im echten Test nicht.

Die Navigation enthielt den Buttontext, aber keinen verifizierten Menüweg. Das Modell deutete den Buttontext teilweise als Menüpunkt. Interne Begriffe wie vorbereitete Tabelle wurden zudem zu oft in Kundenantworten übernommen.

Ein in diesem Arbeitsgang erprobtes gegliedertes Antwortformat brachte keine verlässliche Qualitätsverbesserung und löste zwei echte Fehler aus. Es wurde vollständig aus der aktuellen Testlaufzeit zurückgenommen. Die Ausgabe bleibt der bestehende freie Antworttext. Die fehlgeschlagenen Versuche bleiben als Belege erhalten.

## Prüfungen

`npm test`: 478 bestanden, 0 fehlgeschlagen. `npm run typecheck` und `npm run build`: bestanden. Diese Regressionstests prüfen technische Verträge; sie belegen keine Prozentzahl für Gesprächsqualität.

Echte Tests verwenden das unveränderte konfigurierte Modell `anthropic/claude-haiku-5.5` über das geschützte Preview-Backend. Fünf vorab definierte Gespräche mit insgesamt zehn Kundennachrichten: Dokumente Baden, Unterlagen Wohnungsübergabe, Lampe mit Raumkorrektur, manuelle/MORA-Erfassung samt Foto und Prüfung, frustriertes Kundenfeedback. Jede Unterhaltung nutzt die vom Backend ausgegebene Sitzung. Keine Mock-Antworten in diesen Belegen.

In diesem Arbeitsgang wurden keine neuen Desktop-/Mobil-Screenshots oder nativen Speichervorgänge als getestet ausgegeben. Die Portaloberfläche wurde nicht geändert. Die API-Tests prüfen Antworten und zurückgegebene Anliegenfelder; ein HTTP 200 allein zählt nicht als gute Antwort.

## Echte Testläufe – auch Fehlversuche

| Stand | Beleg | Ergebnis | Beobachtete Kontodifferenz USD |
|---|---|---|---:|
| `9751056` | [mora-tone-live-2026-10-30.json](evidence/mora-tone-live-2026-10-30.json) | 10 HTTP 200; weiterhin Wiederholungen und Erfassungsberichte | 0.0124931 |
| `371b5f9` | [mora-tone-parts-live-2026-10-30.json](evidence/mora-tone-parts-live-2026-10-30.json) | Abbruch nach HTTP 503 / invalid_model_output | 0.0009191 |
| `6a32fd4` | [mora-tone-final-live-2026-10-30.json](evidence/mora-tone-final-live-2026-10-30.json) | Abbruch nach HTTP 503 / invalid_reply_format | 0.0017501 |
| `aa63917` | [mora-tone-envelope-live-2026-10-30.json](evidence/mora-tone-envelope-live-2026-10-30.json) | 10 HTTP 200; keine verlässliche sprachliche Verbesserung | 0.0135560 |
| `8018ae1` | [mora-tone-dialogue-live-2026-10-30.json](evidence/mora-tone-dialogue-live-2026-10-30.json) | 10 HTTP 200; Qualitätsziel nicht erreicht | 0.0123670 |

Gesamt: 32 echte Kundenanfragen über alle Entwicklungsversuche, beobachtete Kontodifferenzen zusammen **0.0410853 USD**. Keine neue Zahlung oder Budgetanhebung. Kontodifferenzen sind beobachtete Werte, keine Rechnung und bei paralleler Kontonutzung nicht vollständig einem Test zuordenbar.

Letzter Teststand: HTTP-Ende-zu-Ende 7.53–12.34 s, Median 9.19 s. Das sind API-Zeiten des Testclients, keine gemessene Zeit bis zum ersten sichtbaren Text im Browser. Keine Geschwindigkeitsverbesserung behauptet.

## Inhaltliche Bewertung des letzten Stands

| Gespräch | Beobachtung | Bewertung |
|---|---|---|
| Eigentümer, Dokumente Baden | Antwort empfiehlt Nachsehen in einer nicht angebundenen Dokumentenansicht; Folgeantwort wiederholt das Angebot. | Nicht bestanden: unbelegte Verfügbarkeit und Wiederholung. |
| Mieter, Wohnungsübergabe | Fehlende persönliche Dateien werden benannt, aber technisch erklärt; Folgeantwort verortet den MORA-Button fälschlich innerhalb der Dokumentenseite. | Nicht bestanden: Menüweg korrekt, genaue Bedienanweisung fehlerhaft. |
| Lampe, Wohnzimmer, Korrektur Schlafzimmer | Dasselbe Anliegen behält Lampe/Leuchte und Defekt; Raum wird korrekt auf Schlafzimmer geändert. Antwort entschuldigt sich unnötig und bietet erneut Vorbereitung an. | Datenerhalt bestanden; Sprache nicht bestanden. |
| Manuell oder mit MORA; Foto und Kontrolle | Beide Wege und lokale Speicherung werden erklärt. Die Folgeantwort erklärt zweimal die fehlende Bildanalyse. | Inhalt teilweise passend; Wiederholungsziel nicht bestanden. |
| Frustriertes Feedback | Reagiert freundlich, verspricht danach aber generisch Kürze und hängt eine unnötige Frage an. | Nicht als ausreichende Verbesserung gewertet. |

### Ungekürzte echte Antworten des letzten Teststands

**owner-documents-baden**

Kunde: Wo liegen die Dokumente zur Liegenschaft in Baden?

MORA: Die Dokumente zur Liegenschaft in Baden kann ich Ihnen leider nicht direkt zeigen, und ich kann Ihnen auch nicht sagen, wo genau sie abgelegt sind. Die Ansicht, die ich Ihnen anbieten kann, ist die Dokumentenansicht unter Verwaltung und dann Dokumente. Dort können Sie selbst nachsehen, ob die Unterlagen vorhanden sind. Soll ich Ihnen die Ansicht öffnen?

Kunde: Sind die Unterlagen hier also noch nicht verfügbar?

MORA: Das kann ich von hier aus nicht beurteilen. Es heißt nur, dass ich Ihnen die Unterlagen in diesem Chat nicht anzeigen kann. Ob die Dokumente zur Liegenschaft in Baden vorhanden sind, ist damit nicht gesagt. Am schnellsten finden Sie es unter Verwaltung und dann Dokumente. Soll ich die Ansicht für Sie öffnen?

**tenant-handover-documents**

Kunde: Ich suche die Unterlagen zur letzten Wohnungsübergabe.

MORA: Dafür kann ich Ihnen leider keine Dateien direkt hier anzeigen. Im Bereich Service unter „Meine Dokumente“ finden Sie die Dokumentenansicht; sie ist derzeit aber nur eine vorbereitete Tabelle ohne angebundene persönliche Dateien. Dort können Sie also nicht nach der Wohnungsübergabe suchen. Soll ich Ihnen die Ansicht öffnen?

Kunde: Wo muss ich dafür klicken?

MORA: Sie gehen auf Service und dann auf „Meine Dokumente“. Dort finden Sie den Button „Dokumentenansicht öffnen“. Die Ansicht ist aber nur eine vorbereitete Tabelle, in der momentan keine Ihrer persönlichen Unterlagen angezeigt wird.

**lamp-short-correction**

Kunde: Meine Lampe geht nicht.

MORA: Das tut mir leid, dass Ihre Lampe nicht funktioniert. Wo in der Wohnung befindet sich die Lampe? Dann kann ich das Anliegen für Sie festhalten.

Kunde: Wohnzimmer.

MORA: Danke, dann weiss ich jetzt, dass die Lampe im Wohnzimmer nicht geht. Ich kann das Anliegen für Sie vorbereiten, sobald Sie möchten.

Kunde: Nein, ich meinte Schlafzimmer.

MORA: Entschuldigung, dass ich das falsch notiert habe. Ich habe den Ort auf Schlafzimmer korrigiert, die Lampe ist also im Schlafzimmer defekt. Wenn Sie möchten, kann ich das Anliegen als Nächstes vorbereiten.

**manual-and-mora**

Kunde: Wie kann ich einen Defekt melden? Geht das selbst und auch mit dir?

MORA: Ja, Sie können einen Defekt sowohl selbst als auch mit mir melden. Selbst erfassen Sie ihn über „Anliegen selbst erfassen“ bzw. die Anliegenansicht im Portal, dort füllen Sie das Formular manuell aus. Mit mir geht es etwas einfacher: Sie beschreiben mir kurz, was kaputt ist und wo, und ich bereite den Eintrag für Sie vor, den Sie anschliessend prüfen und ergänzen können. Wichtig zu wissen: Die Meldung wird im Portal nur lokal als Entwurf in dieser Browsersitzung gespeichert. Ein Versand an die Verwaltung erfolgt daraus nicht automatisch, Sie müssen also gegebenenfalls selbst weiter Kontakt aufnehmen.

Kunde: Und kann ich ein Foto ergänzen und die Angaben vor dem Speichern prüfen?

MORA: Ja, beides ist möglich: Im Anliegen können Sie Angaben vor dem Speichern prüfen und ergänzen, und Fotos lassen sich als Datei anhängen. Ich kann Ihnen dabei aber keine Bildanalyse liefern, das Foto dient also nur als Anhang zur Dokumentation. Ein Foto wird bei Bedarf nicht von mir ausgewertet, sondern bleibt einfach beim Anliegen.

**feedback**

Kunde: Das nervt mich. Du wiederholst dich ständig, ich möchte einfach eine verständliche Antwort.

MORA: Das tut mir leid, dass meine Antworten sich wiederholt haben. Ich fasse mich ab jetzt kürzer und sage nur noch das Nötige. Was möchten Sie wissen? Dann antworte ich direkt und ohne Umwege.

## Technische Schlussfolgerung

Mehr Stilregeln oder ein gegliedertes Textformat allein haben in diesen Versuchen keine verlässliche Verbesserung bewiesen. Die normale Generierung und die bestehende Korrektur missachten einzelne Vorgaben trotz mitgegebenem Kontext. Die nachträgliche Prüfung der korrigierten Antwort deckt unbestätigte Aktionen ab, aber nicht vollständig die Behauptung, persönliche Dateien seien auffindbar. Deshalb können sachlich falsche Sätze als technisch erfolgreiche Antwort zurückkommen.

Der nächste begrenzte Entwicklungsschritt sollte die bereits vorhandene Inhaltsprüfung und deren Korrektur gemeinsam behandeln: Navigation zu einer Ansicht muss von einer Aussage über vorhandene Dateien unterschieden werden, und eine Korrektur muss denselben inhaltlichen Anforderungen wie die verworfene Antwort genügen. Danach müssen genau diese Gespräche erneut geprüft werden. Das ist eine Empfehlung, keine in diesem Test nachgewiesene Lösung. Eine weitere Prompt-Ergänzung allein wird nicht als erfolgreicher Abschluss ausgegeben.

Eine zuverlässigere Modellbefolgung kann damit noch nicht behauptet werden. In diesem Arbeitsgang wurde kein anderes Modell gewählt und keine zusätzliche reguläre Formulierungsstufe eingeführt. Die bisherigen Portal-/Datenschutzgrenzen bleiben bestehen; die Preview ist keine Produktionsfreigabe.
