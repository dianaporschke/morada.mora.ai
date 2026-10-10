# MORA: technische Prüfung der echten KI-Anbindung

Prüfdatum: 10. Oktober 2026. Repository: [dianaporschke/morada.mora.ai](https://github.com/dianaporschke/morada.mora.ai). Arbeitsbranch: `codex/mora-ai-2.0`.

## 1. Gesicherter Ausgangsstand

Der Branch war vor den Änderungen sauber, lokal und auf GitHub bei `0b86dfc3344df62d3de02d8297959a495cc822d3`. Die bisherige MORA-Implementation ist darin enthalten, unter anderem Commit `236aba11d596176fe688622b087e16bf43b19bf8`. Es gab keine ungespeicherten früheren Änderungen im Arbeitsverzeichnis.

`main` wurde nur gelesen und zeigte beim Fetch denselben Ausgangscommit. Alexanders `alex-portal` zeigte `15bfa257ddbe312f7f4658b342ec4703b869b90e`; seine neueren Änderungen bleiben auf seinem Branch. Es wurde weder ein Merge noch ein Produktionsdeployment ausgeführt. Die Vorbereitungen dieses Berichts verändern keine Portaloberfläche und aktivieren keine kostenpflichtige Anbindung.

## 2. Welche Anbindung ist vorhanden?

Das Backend verwendet AI SDK 7, den OpenAI-Provider, Vercel OIDC und Zod. `lib/mora/understanding.js` ruft bereits tatsächlich `generateText` mit `Output.object` auf. Ein erfolgreiches Modell liefert strukturierte Anliegenfelder, Korrekturen, mehrere Defekte, Wissensantworten und Vorschläge für eine offene Rückfrage. Das ist keine Simulation des API-Aufrufs.

| Zugangsweg | Bisheriges Standardmodell | Authentifizierung | Befund |
| --- | --- | --- | --- |
| Vercel AI Gateway | `openai/gpt-6-luna` | Request-/Deployment-OIDC, alternativ Gateway-Key | Automatisch bevorzugt, sobald OIDC vorhanden ist |
| OpenAI direkt, Responses API | `gpt-5.4-mini` | `OPENAI_API_KEY` | Bisher nur genutzt, wenn keine Gateway-Authentifizierung erkannt wurde |

Der vollständige aktuelle Gateway-Katalog wurde geladen: 414 Modelle. GPT-6 Luna, GPT-6.1 Sol und GPT-5.4 Mini unterstützen dort strukturierte Ausgabe und die installierte V4-Provider-Spezifikation. Katalogfähigkeit beweist keine Zugangsberechtigung für das konkrete Vercel-Team.

Ein wichtiger Unterschied: Das bestehende Modell dient überwiegend dem **Verstehen**. Viele sichtbare Antworten, Rückfragen und Übergabetexte erstellt bisher `engine.js`. Ein freigeschalteter Schlüssel allein würde daher noch keinen vollständig natürlich formulierten Premiumdialog ergeben.

## 3. Weshalb ist die echte KI jetzt gesperrt?

**Aktuell nachgewiesen:** Eine synthetische Anfrage an den bestehenden Live-Chat lieferte HTTP 200, aber `understanding: guided` und `modelAvailability: { provider: gateway, status: 403, reason: no_providers_available }`. Die aktuellen Vercel-Logs bestätigen denselben Gateway-Fehler. HTTP 200 bedeutet hier lediglich, dass der geführte Ersatzpfad antwortet, nicht dass ein Sprachmodell funktioniert.

**Schlüssel vorhanden:** Die Vercel-Umgebungsmetadaten zeigen einen sensiblen `OPENAI_API_KEY` für Production und Preview. Der Wert wurde nicht offengelegt. Es wurden keine expliziten Anbieter-/Modellvariablen oder separaten Session-Secrets in dieser Metadatenliste gefunden. OIDC wird von Vercel zur Laufzeit bereitgestellt und ist kein gewöhnlicher API-Key-Eintrag.

**Technischer Auswahlfehler:** Das Vorhandensein des OIDC-Zugangs lässt den bisherigen Code den Gateway wählen, auch wenn dort kein Provider für die Anfrage verfügbar ist. Der bestehende OpenAI-Key hilft dann nicht. Der neue ausdrückliche Provider-Schalter behebt diese Auswahlmöglichkeit, ohne eigenständig auf einen zweiten kostenpflichtigen Zugang umzuschalten.

**Noch nicht bewiesen:** Welche konkrete Team-Einstellung die heutige Gateway-Sperre auslöst. Vercel dokumentiert `no_providers_available` unter anderem bei Anbieterbeschränkungen, die keine zulässige Route übrig lassen. Auch weitere Routing-/Kontobeschränkungen müssen im Gateway geprüft werden. Der Projektcode setzt bisher keine Anbieter-Allowlist, kein `only`-Routing und keine ZDR-Routingpflicht. Daher lässt sich eine lokale explizite Provider-Filterung als Ursache ausschliessen, eine Team-Richtlinie jedoch nicht.

Historischer Befund vom 7. Oktober: Gateway `403 customer_verification_required`, direkter OpenAI-Zugang `429`. Diese früheren Fehler sind kein Beweis, dass heute lediglich eine Kreditkarte fehlt. Der direkte Schlüssel wurde jetzt nicht mit einem neuen kostenpflichtigen Modellaufruf getestet; seine aktuelle Gültigkeit, Quote und Modellberechtigung sind deshalb offen.

Nächste Kontoprüfung: Gateway-Requestdetails mit den betrachteten Providern, Team-Provider-Allowlist, Modellzugang des Kontotarifs, Credits/Verifizierung und gegebenenfalls ZDR-/Training-Richtlinien. Änderungen daran brauchen die Freigabe des Kontoinhabers. Ein neuer Schlüssel allein löst eine fehlende Anbieterberechtigung nicht.

Quellen: [Provider-Allowlist und Fehlercode](https://vercel.com/changelog/team-wide-provider-allowlist-on-ai-gateway), [Gateway-Preise und Tarifzugang](https://vercel.com/docs/ai-gateway/pricing).

## 4. Vorhandene Backend-Schnittstellen und tatsächliche Grenzen

| Schnittstelle | Bereits vorhanden | Noch erforderlich |
| --- | --- | --- |
| `POST /api/chat` | Eingabevalidierung, signierter Gesprächszustand, Modellverständnis, geprüfte Actions, sichere Textdarstellung | Erfolgreicher Modellzugang, Live-Qualitätsprüfung; für öffentliche Nutzung echte Zugriffskontrolle und verteilte Anfragelimits |
| `POST /api/requests` | Vertrag, Idempotenzschlüssel, vorbereitete Berechtigungsprüfung, Bestätigung nur bei positiver Backend-Quittung | Echter angemeldeter Kunde, Einheitberechtigung, dauerhafte Vorgangsspeicherung, Versand-/Bearbeitungssystem |
| Portaladapter | Explizite Fähigkeiten und erlaubte Navigation; austauschbare Übermittlungsgrenze | Autorisierte Daten-APIs für Kunden, Einheiten, Dokumente, Termine und Status |
| Fotos | Lokale Browserablage; validierte Metadaten | Authentifizierter Upload, Zugriffskontrolle, spätere ausdrückliche Bildanalyse |

Alle echten Datenfähigkeiten bleiben deaktiviert. Die aktuelle Demo-Anmeldung ist keine belastbare Kundenautorisierung. Das Modell darf weder Demo-Kennzahlen als Kundendaten nutzen noch einen Versand behaupten. `/api/requests` bleibt ohne echte Integration ehrlich bei `503 integration_required`.

MORA benötigt für allgemeines Sprachverständnis keine neue Datenbank. Für zuverlässige Antworten zu einem persönlichen Mietvertrag benötigt es dagegen eine berechtigte Dokumentenabfrage mit nachvollziehbaren Quellen. Ein leistungsfähiges Modell ersetzt diese Datenanbindung nicht.

## 5. Jetzt implementierte Vorbereitungen

- `MORA_AI_PROVIDER=auto|gateway|openai` macht den Weg ausdrücklich wählbar. Standard und Standardmodelle bleiben unverändert. Der direkte OpenAI-Weg ignoriert OIDC. Kein automatischer Wechsel zwischen Abrechnungswegen.
- Bereinigte Diagnose unterscheidet unter anderem fehlende Zugangsdaten, falsche Konfiguration, Authentifizierung, konkrete Gateway-Fehler, Modellberechtigung, Quote/Rate-Limit, Timeout und ungültige Modellausgabe. Nur Status, Modell und maschinenlesbare Codes werden geloggt, keine Provider-Nachrichten oder Kundeninhalte.
- Die 60-Sekunden-Pause bei Zugang-/Quotenfehlern ist je Provider und Modell getrennt. Sie ist nur eine instanzlokale Entlastung, kein globales Rate-Limit oder Geldlimit.
- `MORA_AI_REQUIRED=true` lässt normale Freitexte bei einer ausgefallenen KI mit `503 MODEL_UNAVAILABLE` scheitern. Ein begrenzter geführter Ersatz zählt nicht als erfolgreicher Modellbetrieb. Bestehende Sicherheitshinweise und validierte Buttonaktionen bleiben ausführbar.
- Der Modellkontext enthält erlaubte strukturierte Fakten, die offene Frage, bis zu acht Anliegen und maximal 20 letzte Nachrichten mit insgesamt 12'000 Zeichen. Aktuelle strukturierte Felder bleiben auch bei kürzerer Historie erhalten. Keine Fotos, Dateinamen oder vollständigen Korrekturarchive werden gesendet. Lange Detailfelder werden nur für den Modellkontext begrenzt, im signierten Anliegen bleiben sie erhalten.
- Sichere Verbrauchslogs erfassen Input-, Output-, Cache- und Reasoning-Tokenzahlen sowie Laufzeit je Modellstufe, ohne Rohdaten. Reasoning ist Teil der Output-Abrechnung und wird nicht nochmals als zusätzlicher Output verrechnet.
- Die **deaktivierte** zweite Modellstufe `MORA_AI_NATURAL_REPLIES=true` formuliert anhand der Anwendungsergebnisse natürlich. Sie erhält geprüfte Fakten, Fähigkeiten, die offene Frage und Buttonlabels. Sie liefert nur Text und den zugehörigen Frage-Schlüssel. Sie verändert keine Daten, Actions, Links, Berechtigungen oder Versandzustände. Die tatsächlich angezeigte Formulierung wird in die signierte Historie übernommen.
- Beide Modellstufen teilen im Chat ein Zeitbudget von 25 Sekunden innerhalb der 30-Sekunden-Vercel-Funktion; einzelne Aufrufe sind auf 22 Sekunden, 3'000 Outputtokens und null automatische SDK-Retries begrenzt. Diese Grenzen kontrollieren einzelne Anfragen, nicht Monatskosten.
- `.env.example` und `npm run ai:check` liefern sichere Konfigurationsvorbereitung. Der Standardtest startet keinen Modellaufruf. Der ausdrücklich gewählte Live-Test verwendet den tatsächlichen Chat-Handler und signierte Folgesitzungen; er lehnt geführte Antworten als Test-Erfolg ab.

Die Formulierungsstufe ist eine echte LLM-Anbindung und fügt keine neuen fest programmierten Gesprächsantworten als KI-Ersatz hinzu. Sie ist noch keine freigegebene Premiumfunktion: Ein gültiges Schema und gleicher Frage-Schlüssel garantieren nicht, dass jeder natürlich formulierte Satz sachlich treu ist. Insbesondere Halluzinationen, Prompt-Injection, Verneinungen und falsche Erfolgsbehauptungen müssen mit echten Modellantworten geprüft werden. Gefahrentexte werden nicht umformuliert. Validierte Buttonwechsel bleiben im bisherigen Enginepfad; die optionale Formulierung betrifft erfolgreiche semantische Freitextturns.

`store:false` ist gesetzt. Das ist keine Zusage vollständiger Zero Data Retention. Datenregion, Providervertrag und Aufbewahrung müssen für den gewählten Zugangsweg geprüft werden. OpenAI dokumentiert separate Missbrauchslogs, die standardmässig bis zu 30 Tage aufbewahrt werden können: [Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data).

## 6. Modellvorschlag und Kosten

**Empfehlung zur Freigabe: GPT-6.1 Sol für den geschützten MORA-Pilot**, vorzugsweise über den bereits vorbereiteten Vercel AI Gateway nach Klärung der Sperre. Das ist eine technische Empfehlung für komplexe Anliegen, Korrekturen und professionelle Dialoge, noch kein nachgewiesenes Qualitätsergebnis speziell für MORA. Das Modell unterstützt strukturierte Ausgabe und Tool-Anbindungen. [Modellbeschreibung](https://vercel.com/ai-gateway/models/gpt-6.1-sol).

Ein direkter OpenAI-Pilot ist ebenfalls technisch vorbereitet und umgeht die Gateway-Sperre. Er benötigt eine aktuelle Prüfung des vorhandenen Keys, seiner Quoten und Modellfreigaben; er rechnet separat über das OpenAI-Konto ab. Es wird nicht eigenständig zwischen beiden Wegen gewechselt.

GPT-6 Luna ist die deutlich günstigere Alternative, wenn Kosten besonders wichtig sind. Vor einer Kostenoptimierung sollten beide Kandidaten dieselben MORA-Dialogtests durchlaufen. Die derzeitigen Standards wurden nicht auf Sol umgestellt.

Stand 10. Oktober 2026, USD je Million Tokens, Standardtarif mit kurzem Kontext:

| Modell | Input | Output |
| --- | ---: | ---: |
| GPT-6.1 Sol | $2.00 | $10.00 |
| GPT-6 Luna | $0.10 | $0.50 |

Quellen: [OpenAI-Preise](https://developers.openai.com/api/docs/pricing), [Gateway GPT-6.1 Sol](https://vercel.com/ai-gateway/models/gpt-6.1-sol), [Gateway GPT-6 Luna](https://vercel.com/ai-gateway/models/gpt-6-luna). Gateway-Tokenpreise haben laut Vercel keinen Aufschlag. Kosten für andere Plattformleistungen sind darin nicht enthalten.

**Transparente Nutzungsannahme:** Acht Freitextturns je Gespräch. Pro Modellstufe über das gesamte Gespräch 32'000 Inputtokens inklusive erneut gesendeter Historie und 4'000 Outputtokens inklusive Reasoning. Eine Verständnisstufe kostet mit Sol dann $0.104 pro Gespräch. Die vorbereitete zusätzliche Formulierungsstufe verdoppelt in dieser Planungsannahme die Tokens auf insgesamt 64'000 Input und 8'000 Output. Das sind Richtwerte, keine Messung echter MORA-Modellgespräche.

| Gespräche pro Monat | Sol: nur Verständnis | Sol: Verständnis + Formulierung | Luna: beide Stufen |
| ---: | ---: | ---: | ---: |
| 100 | $10.40 | $20.80 | $1.04 |
| 1'000 | $104.00 | $208.00 | $10.40 |
| 5'000 | $520.00 | $1'040.00 | $52.00 |

Tatsächliche Tokens, Gesprächslänge, Reasoning, Wiederholungen und längere Anliegen können deutlich abweichen. Cache-Rabatte sind konservativ nicht eingerechnet. Zusätzlich möglich: Vercel-Hosting/Funktionen, Datenbank, Speicher, Dokumentensuche, spätere Bildanalyse, Steuern und Wechselkurs. Regionale Verarbeitung kann zusätzliche Kosten verursachen. Ein ChatGPT-Abonnement ist keine automatische API-Kostenfreigabe.

**Vorgeschlagener Pilotrahmen: zunächst $20 Gesamtbudget ohne automatische Aufladung.** Bei Gateway empfiehlt sich ein eigener budgetierter MORA-Key statt unbeschränkter gemeinsamer Credentials. Das Budget soll nicht automatisch erneuert werden. Vercel prüft das Budget beim Start; eine bereits begonnene Anfrage kann das Limit etwas überschreiten. Auch BYOK-Abrechnung und Fallback müssen geprüft werden. Es handelt sich also nicht um eine mathematisch exakte Rechnungssperre. [Budgetverhalten](https://vercel.com/academy/ai-gateway/set-a-budget), [Budgetkonfiguration](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets).

Keine dieser Kontoeinstellungen wurde verändert, kein Budget gesetzt und keine Credits gekauft.

## 7. Konkrete Schritte nach der Freigabe

1. Anbieterweg, Modell und maximalen Pilotbetrag bestätigen. Vorschlag: Gateway, GPT-6.1 Sol, $20 ohne automatische Aufladung oder Erneuerung, zunächst geschützte Vorschau.
2. Als Team-Inhaber den heutigen Gateway-Fehler anhand der betrachteten Provider und Teamrichtlinien beheben. Bei gewünschtem direktem OpenAI-Weg stattdessen den vorhandenen Schlüssel und seine Abrechnung/Modellberechtigung prüfen. Kein automatischer kostenpflichtiger Ersatzweg.
3. Nur Preview-Konfiguration setzen: ausdrücklicher Provider, freigegebenes Modell, stabiler eigener `MORA_SESSION_SECRET`, `MORA_AI_REQUIRED=true`. Secrets ausschliesslich serverseitig hinterlegen. Die Formulierungsstufe erst im Test gezielt einschalten.
4. Mit Development-/Preview-Zugangsdaten zuerst einen echten synthetischen SDK-/Chat-Test durchführen, danach die komplette Dialogstrecke. Lokal lädt Node eine eigene `.env.local` mittels `node --env-file=.env.local scripts/ai-check.mjs --live --dialogs`. Ohne `--live` wird nichts generiert oder abgerechnet.
5. Die sichtbaren Antworten manuell auf Natürlichkeit, richtige Rückfragen, Schweizer Sprache, Tippfehler, Korrekturen, getrennte Anliegen, Nichtwissen, Verneinungen und Prompt-Injection prüfen. Automatisierte Felder-/Schema-Tests und Tokenlogs ergänzen diese Beurteilung, ersetzen sie nicht.
6. Vor öffentlicher Nutzung die Kundenautorisierung, verteilte Anfragelimits und belastbare Kostenlimits verbinden. Vertrags-/Dokumentenantworten erst mit berechtigter Suche und Quellen freigeben. Portalaktionen bleiben typisiert und werden serverseitig autorisiert. Kostenpflichtige oder schreibende Aktionen verlangen eine ausdrückliche Kundenbestätigung und eine echte Backend-Quittung.
7. Ergebnisse und gemessene Kosten vorlegen. Ein Merge, Veränderungen an `main` oder `alex-portal` und ein Produktionsdeployment brauchen einen neuen ausdrücklichen Auftrag und sind nicht Teil dieser Vorbereitung.

## Prüfstatus

146 automatisierte Tests bestehen; Typecheck, Syntax-/Assetprüfung und öffentlicher Build bestehen ebenfalls. Die automatischen Regressionen und Offline-SDK-Verträge prüfen die bestehende Erfassung, Portalnavigation, Buttons, lokale Fotos/Entwürfe, Sessions, Berechtigungsgrenzen und die neuen Provider-/Formulierungsverträge. Sie beweisen keinen erfolgreichen echten Modellaufruf.

Der lokale Konfigurationstest meldet erwartungsgemäss `missing_credentials`: Produktionsschlüssel wurden nicht in den Arbeitsbereich kopiert. Es wurde kein Live-Test mit einem neuen Modell oder direkten Zugang gestartet. Ein erfolgreicher echter MORA-Modellturn, gemessene Tokenkosten und die Qualitätsbewertung der Formulierungen stehen bis zur Freigabe offen.
