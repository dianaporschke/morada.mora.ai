# MORA: Korrekturen und Portalzustand, 27. Oktober 2026

## Ergebnis und Geltungsbereich

Gezielte Reparatur nach dem Screenshot „lampe nicht gehen“ → „wohnzimmer“ → Fehlermeldung. Die Reparatur betrifft nachgewiesene Vertrags- und Zustandsfehler zwischen Modell, Backend und Oberfläche. Sie ist **keine Freigabe als fertige Kundenversion** und kein erneuter vollständiger Modellvergleich.

Getestete Laufzeit: `ba3b60d2cf54d5e374d6daa0d9e13877029ca3d4` auf `codex/mora-ai-2.0`.

Preview: https://morada-mora-e12recya2-dianaporschke-1255s-projects.vercel.app/portal.html

Vercel-Deployment `dpl_2xPJew6FzXuaRWyVzAyTprRT2pDC`, Status READY, Preview (`target=null`). Weiterhin `anthropic/claude-haiku-5.5` über das geschützte Gateway; keine Frontend-Schlüssel oder kostenpflichtigen Einstellungen geändert.

## Nachgewiesene Ursachen und Änderungen

1. **Fokus und Fakten waren gekoppelt.** Eine vom Modell falsch gewählte Fokusreferenz konnte eine ansonsten korrekte Raumänderung verwerfen. `lib/mora/portal/compact-agent.js` verarbeitet geprüfte Fakten zuerst und übernimmt danach ausschliesslich einen tatsächlich vorhandenen Fokus. Ein ungültiger Fokus ordnet Daten nicht eigenmächtig einem anderen Anliegen zu.
2. **Der Aktionsvertrag erlaubte widersprüchliche Parameter.** Der Modellausgang unterscheidet jetzt ausdrücklich `none`, `prepare`, `review`, `photo` und `view`. Erst die Anwendung übersetzt dies in die vorhandenen, weiterhin validierten Portaloperationen.
3. **Quellenzitate konnten unnötig eng oder veraltet sein.** Echte Teilzitate derselben Nachricht dürfen den belegten Quellbereich erweitern. Eine unveränderte, bereits bestätigte Angabe wird als unverändert behandelt; neue oder korrigierte Werte benötigen weiterhin einen aktuellen Beleg. Mehrere Anliegen bleiben getrennt.
4. **Das Backend akzeptierte eine Korrektur, während das Frontend sie praktisch versteckte.** Im aufgezeichneten Lauf `portal-contract-final-native-2026-10-27.json` war die Lampe bereits korrekt gespeichert. „Nein, ich meinte Schlafzimmer.“ änderte dasselbe Anliegen im Backend richtig. Das Modell lieferte zusätzlich einen nicht angeforderten Formularauftrag mit altem Quellenzitat. Dieser Auftrag wurde abgewiesen. Obwohl die Fehlerantwort die gültige Korrektur und `save.operation=update` enthielt, setzte die Oberfläche bei jedem HTTP-Fehler sämtliche Aktionsdaten auf `null`.
5. **Gezielte Fehlerbehandlung statt vorgetäuschtem Erfolg.** `api/portal-chat.js` kennzeichnet nur separat akzeptierte Fakten als `factsAccepted`. `assets/mora-portal-client.js` darf dann die frisch berechneten Prüf-/Aktualisierungsbuttons behalten. Verworfene Modelltexte, Navigation und automatische Aktionen bleiben gesperrt. Ohne diese Bestätigung werden keine alten Buttons wiederbelebt. Die Architekturkennung wird vor der Sessionübernahme geprüft. Der technische Fehlertext bestätigt ausschliesslich die Übernahme im Gespräch, keine Speicherung.

Die Original-Screenshot-Anfrage hatte noch keine ausreichend genaue Validierungsdiagnose im Laufzeitlog. Ihre exakte einzelne Ablehnungsursache lässt sich rückwirkend **nicht** beweisen. Die genannten Fehler wurden im Code und in neuen, gespeicherten echten Tests nachgewiesen. Neue Logs enthalten nur Fehlercodes und Feldnamen, keine Kundentexte oder Schlüssel.

## Portal und Speicherbelege

Das vorhandene zentrale Mapping `assets/mora-portal-map.js` bleibt zuständig: Titel „Lampe / Leuchte · Wohnzimmer“, `unit=Wohnzimmer`, native Kategorie `caseInfo.category=Schaden / Reparatur`. Fachbereich, Defekt, Anzahl, Beginn und Zusatzbeobachtungen stehen in der vorhandenen Beschreibung. Unbekannte Werte bleiben entsprechend gekennzeichnet.

Formular öffnen, lokale Speicherung und Übermittlung sind unterschiedliche Zustände. Eine Speicherbestätigung entsteht erst nach tatsächlichem Schreiben und Auslesen des nativen Portalbestands. Echte serverseitige Übermittlung ist weiterhin nicht vorhanden.

`portal.html` wurde nur innerhalb des bestehenden MORA-Integrationsblocks neu eingebettet. Der Inhalt ausserhalb dieses Blocks ist bytegleich zur vorherigen Fassung. Keine zweite Anliegenverwaltung, kein Portalumbau und keine Änderung an Alexanders eigener Entwicklung.

## Prüfungen vor dem abschliessenden Lauf

**403 automatisierte Tests bestanden**, Typecheck, Build und Diff-Prüfung bestanden. Die neuen Regressionen prüfen gültige Raumkorrektur trotz abgelehnter automatischer Aktion, fehlende automatische Ausführung, Unterdrückung verworfener Texte, kein Wiederbeleben alter Buttons und keine Sessionübernahme aus einer anderen Architektur. Automatisierte Testantworten sind kein Beweis für Modellqualität.

Zusätzliche echte Läufe bleiben vollständig dokumentiert, auch wenn sie fehlschlugen:

| Beleg | Kundennachrichten | Ergebnis | Gateway-Verbrauch |
|---|---:|---|---:|
| `portal-contract-screenshot-2026-10-27.json` | 3 | Lampe, Wohnzimmer und Korrektur technisch angenommen; dieselbe Anliegen-ID | 0.0017347 USD |
| `portal-contract-native-2026-10-27.json` | 10 | Steckdose, unbekannte Einrichtung und zwei getrennte Anliegen bestanden; Wasserfleck abgewiesen; Lampenprüfung zu eng | 0.0066405 USD |
| `portal-contract-lamp-recheck-2026-10-27.json` | 4 | Die ausdrücklich genannte Beobachtung „sonst alles normal“ fehlte tatsächlich | 0.0022925 USD |
| `portal-contract-lamp-operations-2026-10-27.json` | 2 | Vorbereitung wegen erneut ausgegebener unveränderter Fakten mit altem Beleg gescheitert | 0.0013115 USD |
| `portal-contract-final-native-2026-10-27.json` | 5 | Korrekte vollständige Erstspeicherung; danach Backend-Korrektur richtig, Aktualisieren-Button verschwunden | 0.0030101 USD |

Bei der ersten Lampenprüfung stand „sonst alles normal“ vollständig im Feld `extent` und in der tatsächlich gespeicherten Beschreibung. Der Test verlangte fälschlich ausschliesslich `details`. Die Prüfung kontrolliert jetzt den tatsächlichen Informationserhalt im Portal über beide zulässigen Felder. Der nachfolgende echte Datenverlust wurde trotzdem als Fehler ausgewiesen. Ein Erfolg nach technischer Wiederherstellung wird im Test getrennt von einem vollständig angenommenen Modellgespräch gezählt.

Alle nativen Prüfungen verwenden echte HTTPS-Modellantworten und die tatsächliche HTML-/JavaScript-Speicherlogik in JSDOM. Dialog-, Datei- und Browser-APIs sind dabei Testhilfen. Dies ist **kein gerenderter Desktop- oder Mobilgerätetest**.

## Abschliessender echter Test der veröffentlichten Fassung

Beleg: `evidence/portal-ui-recovery-native-2026-10-27.json`. Fünf Kundennachrichten, acht echte Modellaufrufe inklusive dreier zusätzlicher semantischer Prüfungen. Vier Nachrichten technisch angenommen, eine Modellantwort abgewiesen. Kein wiederholter Modellversuch zur Rettung dieses Ergebnisses.

| Prüfung | Tatsächlicher Befund |
|---|---|
| „lampe nicht gehen“ → „wohnzimmer“ | Einrichtung `light`, Raum Wohnzimmer, Defekt „Lampe lässt sich nicht einschalten.“; keine erfundene Anzahl |
| „Nur eine Lampe ist betroffen, sonst ist alles normal.“ | Anzahl 1 und vollständige Zusatzbeobachtung erfasst |
| Ausdrückliche Vorbereitung, anschliessend natives Speichern | Ein Eintrag „Lampe / Leuchte · Wohnzimmer“, Beginn „Nicht angegeben“, Beschreibung vollständig |
| „Nein, ich meinte Schlafzimmer.“ | Korrektur im Gespräch angenommen; Modelltext vom semantischen Prüfer als `unconfirmed_success` abgewiesen |
| Aktualisieren nach dieser Fehlerantwort | Button bleibt nutzbar; derselbe gespeicherte Eintrag erhält Schlafzimmer in Titel, Bereich und Beschreibung; Anzahl und Beobachtung bleiben erhalten |
| Wiederholte Klicks und doppelte Formularabgabe | Weiterhin genau ein Eintrag mit derselben ID |
| Foto | Testdatei `lampe-test.png` beim selben nativen Eintrag gespeichert und ausgelesen |
| Erzwungener Speicherfehler | Vorheriger Datensatz unverändert; keine neue Erfolgsbestätigung |

`nativeOperationsVerified=true`, `photoVerified=true`, `storageFailureVerified=true`, keine Daten-Abnahmefehler. **Gesamtszenario trotzdem `success=false`**, weil die Korrektur keine angenommene natürliche Antwort erhielt. Die technische Fehlermeldung „Ihre Angaben wurden im Gespräch übernommen. Die Antwort konnte nicht bestätigt werden.“ stammt aus der Anwendung, nicht aus dem Modell.

Eine tatsächliche, sichtbare Modellantwort nach „wohnzimmer“ lautete:

> Danke, das Wohnzimmer habe ich notiert. Die Lampe im Wohnzimmer lässt sich nicht einschalten. Sie können das Anliegen nun über die Ansicht „Anliegen“ prüfen. Ich kann es von hier aus nicht an Ihre Verwaltung weiterleiten; dazu müssten Sie es im Formular speichern.

Das ist weiterhin zu lang und formularorientiert. Besonders die Verknüpfung von Weiterleitung mit Speichern ist irreführend: Die native Speicherung sendet nichts an MORADA. Der semantische Prüfer liess diesen Text durch, verwarf später aber eine Korrekturantwort. Damit ist seine Unzuverlässigkeit erneut belegt; dieser Lauf beweist keine gelöste Gesprächsqualität.

### Kosten und Geschwindigkeit dieses Abschlusslaufs

Gemessene Gateway-Verbrauchsdifferenz: **0.0034765 USD**, rund 0.35 US-Cent für den gesamten Ablauf. Alle sechs hier aufgeführten echten Läufe zusammen: **0.0184658 USD**, rund 1.85 US-Cent. Verbrauchsdifferenzen sind keine vollständige Hostingrechnung. Die ursprüngliche 2-USD-Testgrenze wurde nicht zurückgesetzt: Verbrauch vorher 3.281738532 USD, danach 3.285215032 USD, Grenze 3.338856132 USD. Rest innerhalb dieser Freigabe: **0.0536411 USD**. Keine weiteren bezahlten Tests nach diesem Abschlusslauf.

Backend-Gesamtdauer der fünf Nachrichten: **1.67–4.88 s**. Externer HTTP-Testweg: **5.85–8.96 s**. Bei den vier angenommenen Antworten: Modell und Gateway zusammen **1.54–4.53 s**, Guthabenprüfung **0.12–0.89 s**. Reine Gateway- und Modellzeit werden nicht getrennt ausgewiesen. Der externe Testweg enthält einen Proxy und ist keine Messung von Dianas Mobilgerät.

Ohne Formularöffnung lag die gemessene erste sichtbare DOM-Antwort bei **6.99–8.96 s**; bei Vorbereitung inklusive weiterer geprüfter Formularaktionen bei **13.92 s**. Verarbeitung zwischen bereits empfangener Antwort und DOM-Eintrag lag bei den drei gewöhnlichen Antworten unter 1 ms. Keine Streaming-Ausgabe: erste sichtbare und vollständige Chatantwort erscheinen gemeinsam. Streaming könnte diese Wahrnehmung verbessern, behebt aber keine Datenfehler oder falschen Erfolgsbehauptungen und wurde hier nicht implementiert.

## Verbleibende Grenzen und Empfehlung

Die echten Antworten sind weiterhin teilweise zu lang, mechanisch und formularorientiert. „Danke“, „ich habe notiert“ und wiederholte Erfassungsberichte stammen in den Belegen vom Modell; die lokale Anwendung setzt diese Dankesformulierungen nicht nachträglich ein. Der Modellauftrag umfasst weiterhin Antwort, strukturierte Änderungen und Aktionsauswahl zugleich. Aus diesen Tests allein lässt sich nicht quantifizieren, welcher Anteil der sprachlichen Schwäche vom Modell bzw. diesem Auftrag verursacht wird.

Der semantische Zusatzprüfer kann eine zulässige Antwort ablehnen. Ausgelassene Beobachtungen bleiben möglich. Eine erfolgreiche Einzelkorrektur ersetzt deshalb nicht die umfassende Qualitätsabnahme. Die früher dokumentierte Serie mit 20 Gesprächen bleibt eine nicht bestandene Ausgangsmessung; sie wurde auf der jetzigen Fassung nicht vollständig wiederholt.

Beibehalten werden günstige begrenzte Modellaufrufe, kontrollierte Faktenänderungen, ein gemeinsamer Aktionszustand und echte Speicherbelege. Vor Kundeneinsatz sind ein abgegrenzter Modellvergleich auf denselben schwierigen Fällen und eine bestandene vollständige Qualitätsserie erforderlich. Kein weiterer grosser Umbau oder stiller teurer Modell-Fallback wurde hier begonnen.

Für produktiven Betrieb fehlen weiterhin authentifizierte Speicher-, Upload- und Versandbestätigungen sowie echte Objekt-/Raum-IDs und Berechtigungen für den Walkthrough. Die Anforderungen stehen in `MORA_PORTAL_INTERFACE_CONTRACT.md`. Die globale Preview-Testgrenze ist keine Lösung für den späteren Kundenbetrieb.

`main` bleibt `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` bleibt `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Kein Merge und kein Produktionsdeployment.
