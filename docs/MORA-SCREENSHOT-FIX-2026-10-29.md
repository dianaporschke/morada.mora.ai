# MORA: Korrektur der Screenshot-Fehler vom 29.10.2026

Gezielter Umfang: fehlende Gesprächsantworten nach Formularentscheidungen und widersprüchliche Aussagen über verfügbare Portalinhalte. Keine allgemeine 90-%-Freigabe.

## Änderungen

- `lib/mora/portal/compact-agent.js`: Eine verworfene Formularaktion löscht nicht mehr automatisch die gültige Antwort. Gültige Fakten bleiben erhalten. Eine tatsächliche Öffnungsankündigung ohne vorgemerkte Aktion wird geprüft und gegebenenfalls mit demselben Modell korrigiert. Ein blosses Angebot („ich kann …“) ist keine ausgeführte Aktion.
- Bei einer tatsächlich angeforderten Formularöffnung zeigt der vorhandene Client die Antwort erst nach erfolgreicher Formularübernahme. Speicherung bestätigt weiterhin allein der vorhandene Portalbeleg.
- Die bestehende Ausnahmeprüfung für Aktionsbehauptungen berücksichtigt jetzt auch nicht angeschlossene persönliche Inhalte und fremde Daten. Ein Menüpunkt wird nicht als Beleg für vorhandene Dateien behandelt. Gewöhnliche Lampennachrichten benötigen weiterhin nur eine Modellgenerierung; relevante Inhaltsprüfungen können zwei, mit Korrektur drei Aufrufe benötigen.
- Eine wiederholte einfeldrige `reply`-JSON-Hülle wird als Textformat dekodiert. Andere JSON-Objekte und eingebettete Aktionen werden nicht interpretiert.
- Wenn auch die begrenzte Antwortkorrektur fehlschlägt, erscheint der vorhandene sichtbare Fehlerzustand statt einer erfolgreichen Antwort ohne Text.
- `tests/portal-compact.test.js`: Regressionen zu erhaltenen Antworten und Raumkorrekturen, Dokumentenbehauptungen, modalen Angeboten, JSON-Hüllen und sichtbaren Fehlern.
- `docs/evidence/mora-screenshot-fix-cases.json`: Vorab festgelegte sechs Screenshot-Szenarien.

Modell, Schlüssel, Konto-/Kostenkonfiguration, Portal-HTML und Design wurden nicht geändert. Änderungen ausschliesslich auf `codex/mora-ai-2.0`, kein Merge, keine Produktion.

## Echte Tests und offengelegte Fehlschläge

1. `mora-screenshot-fix-live-2026-10-29.json`: neun echte HTTP-Gesprächsschritte in sechs Szenarien. Lampe, Korrektur und Vorbereitungswunsch mit Textantwort und korrekten Fakten. Dokumentenfragen erklärten fehlende Verfügbarkeit; eine Antwort enthielt eine doppelte JSON-Hülle. Nachbarmiete und vorgetäuschte Administratorrolle wurden abgelehnt; kein Handwerker gebucht. Der Gefahrenfall nutzte den vorhandenen unmittelbaren Sicherheitshinweis ohne Modellaufruf.
2. Browserlauf auf dem ersten Kandidaten: Lampenmeldung erreichte den sichtbaren Fehlerzustand. Die Prüfung modaler Angebote wurde anschliessend korrigiert. Dieser Versuch zählt nicht als bestanden.
3. `mora-screenshot-fix-final-live-2026-10-29.json`: drei erfolgreiche Lampenschritte, anschliessend HTTP 503 bei der Dokumentenfrage. Die zwischenzeitlich geänderte Korrekturanweisung wurde deshalb wieder auf die zuvor geprüfte Fassung zurückgesetzt. Der Fehlschlag bleibt dokumentiert.
4. Vollständiger Browserablauf auf `c912732`: Lampe Wohnzimmer seit gestern → Korrektur Schlafzimmer → Anliegen vorbereiten → Entwurf speichern → unter Meine Anliegen erneut öffnen. Beide Chatantworten sichtbar. Genau ein lokaler Eintrag. Wieder geöffnete Felder: Lampe / Leuchte, Schaden / Reparatur, Schlafzimmer, Anzahl 1, seit gestern. Kein Versand. Screenshot: `evidence/mora-room-correction-saved-20261029.jpg`. Der anschliessende Backend-Nachtrag verändert nur die Antwortkorrektur, nicht diesen Portalablauf.

## Verbleibende Grenzen

Die Antworten enthalten weiterhin teilweise „Danke“, Erfassungsberichte und wiederholte Formularangebote. Die technischen Korrekturen sind kein Nachweis einer vollständig natürlichen Assistenz. Die erweiterte Antwortprüfung ist probabilistisch und kann fehlschlagen; keine Garantie für beliebige Formulierungen. Persönliche Dokumente und echte Kundenkonten fehlen weiterhin. Ein gespeicherter lokaler Entwurf ist keine Meldung an MORADA.

Kein neuer Smartphone-Renderingtest in dieser Runde; die HTML-/CSS-Oberfläche blieb unverändert. Der Screenshot stammt aus einer tatsächlichen Browserprüfung mit echten Modellantworten, nicht aus Bildgenerierung oder einem Mock-Gespräch.

## Abschliessender Stand

- Geprüfter Code: `8bfd81817b453f1b0ec8e055bcfb381dbb338d1f`. Preview: https://morada-mora-gog7a2gxj-dianaporschke-1255s-projects.vercel.app/portal.html
- Der weitere Dokumenten-Zwischenlauf `mora-screenshot-fix-documents-live-2026-10-29.json` erzeugte einen internen Prüftext als JSON. Die gemeinsame Nutzung von Prüfanweisung und Kundenformulierungsanweisung wurde danach entfernt. Die Korrektur erhält nur die relevante Ansicht und den bestätigten Aktionsstand. Interne JSON-Prüfobjekte werden jetzt abgewiesen statt angezeigt.
- Abschliessender Nachtest `mora-screenshot-fix-release-live-2026-10-29.json`: beide Dokumentenfragen HTTP 200, lesbare Antworten, keine vorhandenen persönlichen Dateien behauptet. Die erste Antwort war unnötig als Brief mit Grussformel formuliert, die zweite begann mechanisch mit einem Dank. Deshalb keine vollständige sprachliche Abnahme.
- Letzter vollständiger Regressionstest: 476 bestanden. Nach dem letzten begrenzten Reparatur-Nachtrag: 38 betroffene Tests, Typecheck und Build bestanden. Keine Ableitung einer Kundenerfolgsquote aus diesen Tests.
- 17 echte HTTP-Gesprächsschritte in vier protokollierten Läufen, darunter ein fehlgeschlagener Schritt und ein Sicherheitsfall ohne Modell. Zusätzlich drei Browsernachrichten über die Kandidaten hinweg, davon eine fehlgeschlagen; anschliessend echte Formularübernahme, Speicherung und erneutes Öffnen.
- Beobachtete Kontostandsdifferenz vom ersten bis zum letzten Lauf: USD 0.0256345. Das kann gleichzeitige Nutzung enthalten. Bestehende kumulative Testgrenze unverändert; keine neue Zahlung oder Kosteneinstellung.

Die konkrete Unterdrückung gültiger Antworten ist entfernt. Nicht angeschlossene Dokumente werden im abschliessenden Nachtest korrekt als nicht verfügbar beschrieben. Die weiter bestehende mechanische Sprache und mögliche Antwortprüfungsfehler bleiben offen.
