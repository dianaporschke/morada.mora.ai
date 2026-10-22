# MORA: Modellwechsel vorbereitet, tatsächlicher Zugang blockiert

23. Oktober 2026, Europe/Zurich. Auftrag: Mercury durch eine andere KI ersetzen.

## Umsetzung

Die neue Portal-Preview fordert `google/gemini-3.8-flash` über die vorhandene geschützte Gateway-Anbindung an. Die echten Anfragen werden jedoch vor einer Modellantwort abgewiesen. Dies ist ausdrücklich kein erfolgreicher oder funktionierender Modellwechsel. Der Modellwechsel betrifft `portal_v1`; alte Vergleichsvarianten bleiben als historische Referenz bestehen. Ein veralteter Mercury-Standard in den Deployment-Umgebungsvariablen kann die neue Modellauswahl nicht überschreiben. Die vorhandenen Schlüssel werden unverändert serverseitig genutzt.

Die Formularbrücke, Datenabbildung, Speicherung, Faktenprüfung und Gesprächsvorgaben bleiben für diesen Modellvergleich unverändert. Es gibt weiterhin zwei Modellaufrufe für eine gewöhnliche Anliegenantwort (Entscheidung und Prüfung); dieser Auftrag behauptet keine Architekturvereinfachung.

Zuerst geprüft: Claude Sonnet 5.5. Der öffentliche Katalog führt es auf; der tatsächliche bestehende Zugang antwortete jedoch mit HTTP 403 `no_providers_available`. Zwei Versuche erzeugten keine Modellantwort und keine beobachteten Modellkosten. Das ist kein Qualitätstest von Claude. Die vollständige Ursache der Anbieterbeschränkung wurde nicht festgestellt. Keine kostenpflichtige Freischaltung durchgeführt.

Gemini 3.8 Flash wird zusätzlich im aktuellen offiziellen Katalog der für kostenloses Guthaben zugelassenen Modelle geführt. Der Live-Katalog meldet 0,75 USD pro Million Eingabetokens und 3,75 USD pro Million Ausgabetokens zum Prüfzeitpunkt. Das sind Tokenpreise, keine pauschalen Gesprächskosten. Die Anwendung liest aktuelle Preise selbst und prüft vor jeder Anfrage das vorhandene Guthaben. Bestehende Reserve und Ausgabenobergrenze bleiben unverändert.

Quellen: https://ai-gateway.vercel.sh/v1/models, https://vercel.com/ai-gateway/models?freeTier=true, https://vercel.com/ai-gateway/models/gemini-3.8-flash. Metadaten: `docs/evidence/portal-model-switch-catalog.json`.

## Nachweise

Automatisiert: 329 Tests bestanden, Typprüfung und Build bestanden. Zusätzlich ist geprüft, dass der neue Portalpfad trotz altem Mercury-Umgebungsstandard tatsächlich das genehmigte alternative Modell auswählt und die bestehenden Gateway-Zugangsdaten weiterverwendet.

**Live-Ergebnis: blockiert.** Claude Sonnet 5.5 und Gemini 3.8 Flash wurden mit dem vorhandenen Konto tatsächlich angefragt. Beide lieferten für die Lampe und die Steckdose jeweils HTTP 403 `no_providers_available`, vom Anwendungsbackend als HTTP 503 weitergegeben. Insgesamt vier erfolglose Gesprächsstarts, null Modellantworten, null gespeicherte Testanliegen, beobachtete Guthabendifferenz 0 USD. Keine Aussage über bessere Gesprächsqualität möglich. Kein weiterer Qualitätsvergleich, da bereits der Zugang scheitert.

Die öffentliche Liste für kostenloses Guthaben ist kein Nachweis der tatsächlichen Freischaltung dieses Kontos. Die detaillierte Ursache (Kontofreigabe, freie Modellbeschränkung oder Anbieterroute) ist noch nicht bestätigt. Das Projekt setzt keine Anbieter-Allowlist. Vor einem weiteren Versuch muss die tatsächliche Gateway-Berechtigung geklärt werden; ein kostenpflichtiger Kauf wurde weder durchgeführt noch als garantiert ausreichende Lösung ausgegeben. Eine zusätzliche lokale Diagnose wurde vor einer Anfrage abgebrochen, weil das vorhandene sensible Secret nicht als Klartext verfügbar war. Keine neuen Schlüssel erstellt.

Nachweise: `portal-claude-sonnet-5-5-live.json`, `portal-gemini-3-8-flash-live.json`, jeweilige `-preview.json` und `portal-model-switch-catalog.json` unter `docs/evidence`.

Code auf `codex/mora-ai-2.0`: `2bc149e48e2e8472881164e8b11f75da0a6c07bc`. Technisches Preview-Deployment READY, target null, keine Produktionsaliase: `dpl_6zgNvsD6XmdPf2CFUa56ZirrK8cJ`. Diagnose-URL: https://morada-mora-fgsqb4yje-dianaporschke-1255s-projects.vercel.app/portal.html . Diese Adresse wird ausdrücklich nicht als funktionierende Kundentestversion empfohlen. Die vorherige Mercury-Preview wurde nicht überschrieben.

Die ausgelieferte HTML-Datei ist bytegleich mit dem letzten Integrationsstand. Keine Änderungen an Portaldesign, Kundendaten oder Dateispeicher. Der Modellwechsel ist ausschliesslich serverseitig.

Guthaben nach den Versuchen: 4,625845368 USD; insgesamt verwendetes Kontoguthaben 0,374154632 USD. Keine Zahlung oder Budgeterhöhung.

## Grenzen

Die realen Tests führen die unveränderte HTML-Datei in JSDOM mit echten HTTPS-Modellantworten und nativen Formular-/Speicherfunktionen aus. Die gespeicherten Felder und IDs werden zurückgelesen. Das ist kein gerenderter Desktop-/Mobiltest. Die bereits dokumentierte Browser-Freigabesperre wurde nicht umgangen.

Native Speicherung bleibt lokal auf diesem Gerät und ist nur in den bestehenden Verwaltungsansichten verfügbar. Keine serverseitige Einreichung, keine neuen Kundenrollen, keine Änderung an Alexanders eigenständiger Entwicklung. `main` und `alex-portal` bleiben unverändert; kein Merge und kein Produktionsdeployment.
