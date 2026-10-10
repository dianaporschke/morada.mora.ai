# MORA AI 2.0: Gratiszugang, Umsetzung und Kosten

Prüfdatum: 10. Oktober 2026. Repository `dianaporschke/morada.mora.ai`, ausschliesslich Branch `codex/mora-ai-2.0`. Ausgangsstand `fd184003864e165235750d26914756103b10c19d`, lokal und auf GitHub sauber gespeichert. Kein Merge, Produktionsdeployment oder Schreibzugriff auf `main` / `alex-portal`.

## Tatsächliche Konfiguration und Zugang

Vercel-Projekt `morada-mora-ai`, ID `prj_vI6F07O5rdsXOdFlinN4kHAR1Nvd`, Team `team_IwiBPLqyss3IE9qMeGsLRppV`. Preview-URLs sind durch Vercel Authentication geschützt. Der vorhandene sensitive `OPENAI_API_KEY` gilt für Preview und Production; sein Wert wurde nicht gelesen oder offengelegt. Gateway-OIDC kommt aus der Vercel-Laufzeit. Ein neuer API-Key fehlt daher nicht grundsätzlich. Bestehende Credentials beweisen aber weder Guthaben noch Modellberechtigung.

Die Vercel-Verbindung erlaubt Projekt-/Deployment-/Env-/Log-Abfragen, bietet jedoch keine direkte Guthaben-/Auto-Top-up-Kontoabfrage. Die Gateway-Kontoansicht verlangt eine Anmeldung. Bei der sicheren Anmeldung hat die automatische Freigabeprüfung die Weiterleitung zu OpenAI abgelehnt, weil sie keine ausreichende ausdrückliche Autorisierung dieses zusätzlichen Anmeldeziels erkennen konnte. Dieser Weg wurde weder fortgesetzt noch umgangen.

Die **rein lesende** Preview-Diagnose hat Credits über die bestehende serverseitige Gateway-Authentifizierung erfolgreich abgefragt: **5,00 USD verfügbar, bisheriger Gateway-Verbrauch 0,00 USD**, geprüft am 10. Oktober 2026 um 01:36:41 UTC. HTTP 200 und die privaten Runtime-Logs bestätigen diesen Kontobefund. Es wurde keine Modellgenerierung ausgeführt. Finanzwerte erscheinen nicht in der HTTP-Antwort. Der positive Kontostand beweist weder Gratisherkunft noch ausgeschaltete Aufladung.

Ungeprüft bleiben Gratis-/Kaufguthaben-Zuordnung, Auto-Top-up, Zahlungsmethode/Verifizierung, kontospezifische kostenlose Modellberechtigung, Budgets und Team-Provider-Richtlinien. Modellanfragen bleiben deshalb abgeschaltet. Kein Guthaben wurde gekauft, kein Tarif geändert, keine automatische Aufladung eingerichtet.

Die Bereitstellung `dpl_9ZtU7nJUbTpERBimq4pCa5wtfTs9` ist READY, Preview, Commit `47040f1716138940477dd710ac74c611d581f085`. [Geschützte geprüfte Preview](https://morada-mora-6ykhbc2ah-dianaporschke-1255s-projects.vercel.app/). Sie ist eine technische Preview mit abgeschalteter Modellinferenz, noch kein natürlicher KI-Dialog zum Qualitätstest. Die Produktionsbereitstellung bleibt unverändert `dpl_GRaJ77V8QaKEZCe8Rx5UJsyQX7Fe` auf `main` / `0b86dfc3344df62d3de02d8297959a495cc822d3`. Die Remote-Branchprüfung bestätigt `alex-portal` weiterhin auf `15bfa257ddbe312f7f4658b342ec4703b869b90e`.

Vercel dokumentiert 5 USD monatlich im Free Tier, nur eine Teilmenge der Modelle und niedrigere Limits. Dies bestätigt keinen konkreten Kontostand. Beim Kauf von Credits endet laut Dokumentation die monatliche Gratiszuteilung. Die Gateway-Fachanleitung nennt eine gültige Zahlungsmethode als Voraussetzung zur Freischaltung; ob sie in diesem Konto noch fehlt, ist offen. Eine pauschale Pflicht, 20 USD einzuzahlen, ist nicht belegt.

Quellen: [Gateway-Preise](https://vercel.com/docs/ai-gateway/pricing), [Credit-/Generation-API](https://vercel.com/docs/ai-gateway/observability-and-spend/usage).

## Bisherige Sperren

### Diagnose der gemeldeten Preview ohne Antwort

Die gemeldete Preview `morada-mora-glrcetzb7-dianaporschke-1255s-projects.vercel.app` ist Deployment `dpl_EuzzAFNfzX8SUaTEEoi54hqHVDaX`, Commit `8879c030a6b0e10d61f4493c4cb7cfc32e872365`. Die tatsächliche branchgebundene Preview-Konfiguration enthält `MORA_AI_ENABLED=false`. Damit scheitert eine normale Nachricht bereits vor dem Gateway-Aufruf mit `inference_disabled`. Der bisherige Text über eine vorübergehende Störung und der Wiederholungsbutton waren dafür unpassend. Die abgefragten Logs enthielten Credit-Audits, aber keinen Modellaufruf für „hallo“. Das ist kein neuer Nachweis für leeres Guthaben, ein falsches Modell oder einen Gateway-Ausfall.

Die Korrektur unterscheidet Abschaltung, Konfigurationsfehler, Authentifizierung, Kontoverifizierung, Guthaben, Modellzugang, Rate Limits und technische Fehler. Die API protokolliert nur bereinigte Diagnosefelder; der Client bietet bei nicht wiederholbaren Fehlern keinen erneuten Versuch an und erhält vorhandene Anliegenentwürfe. Die Preview-Diagnose zeigt die effektive Anbieter-/Modellkonfiguration und liest den authentifizierten Modellkatalog. Ein Katalogeintrag wird ausdrücklich nicht als erfolgreiche Modellinferenz ausgegeben. `AI_GATEWAY_MODEL=openai/gpt-6-luna` ist zusätzlich explizit nur für Preview / `codex/mora-ai-2.0` gesetzt. Diese ID ist im aktuellen öffentlichen Katalog vorhanden.

**155 Tests, Typecheck und Build bestanden.** Die Tests prüfen auch die echte API-Handler-Reaktion auf „hallo“ bei abgeschalteter Inferenz sowie den Erhalt bestehender Entwürfe ohne sinnlosen Wiederholungsbutton. Die Veröffentlichung und HTTP-Prüfung dieser Korrektur bleiben getrennt von einem echten Modell-Gesprächstest.

Es wurde weiterhin keine Modellinferenz aktiviert: Der zuvor gelesene Kontostand von 5 USD beweist weder Gratisherkunft noch ausgeschaltetes Auto-Top-up oder Gratisberechtigung des Modells. Die Projektverbindung bietet diese Kontoeinstellungen nicht an. Manuelle Prüfung: [AI Gateway des Teams](https://vercel.com/dianaporschke-1255s-projects/~/ai-gateway) öffnen, Guthaben oben rechts anklicken, Herkunft als Gratisguthaben und **Auto top-up: Disabled** prüfen; unter Models zusätzlich den kostenlosen Zugang für Luna kontrollieren. Keine Credits kaufen, keine Karte hinzufügen und keine Aufladung aktivieren. Falls Vercel eine Zahlung/Verifizierung verlangt, ist dies vor einer Änderung mitzuteilen. Erst danach branchgebunden `MORA_AI_ENABLED=true`, neue Preview und echte „hallo“-/Steckdosen-Dialoge mit Verbrauchsprüfung. Die verlangte funktionierende LLM-Preview ist daher noch nicht nachgewiesen.

Die vorherige Prüfung zeigte Gateway `403 no_providers_available`; HTTP 200 am Chat kam vom geführten Ersatzpfad, nicht vom Modell. Am 7. Oktober waren zudem Gateway `customer_verification_required` und direkt OpenAI `429` dokumentiert. Historische Befunde werden nicht als neue Modelltests ausgegeben.

Der Code setzt keine explizite Gateway-Provider-Allowlist. Vorhandenes OIDC liess die automatische Auswahl das Gateway bevorzugen; der vorhandene OpenAI-Key kam dann nicht zum Einsatz. Anbieterwahl und sichere maschinenlesbare Fehlerdiagnose sind vorbereitet. Es gibt keinen automatischen Wechsel auf einen zweiten Abrechnungsweg. Die genaue Kontosperre benötigt weiterhin die Gateway-Konto-/Requestdetails.

## Verifizierte Modelle und Empfehlung

Der vollständige öffentliche Gateway-Katalog und die Provider-Endpunkte wurden erneut geladen. Beide gewünschten Modelle sind tatsächlich katalogisiert. Ihre Erreichbarkeit mit den Credits dieses Teams ist nicht bestätigt.

| Merkmal | GPT-6 Luna | GPT-6.1 Sol |
| --- | --- | --- |
| Gateway-ID | `openai/gpt-6-luna` | `openai/gpt-6.1-sol` |
| Standard Input / Output pro Million Tokens | 0,10 / 0,50 USD | 2 / 10 USD |
| Kontext / maximaler Modelloutput | 1'050'000 / 128'000 Tokens | 1'050'000 / 128'000 Tokens |
| Strukturierte Ausgabe und Tools | Unterstützt | Unterstützt |
| Beschriebener Schwerpunkt | Effiziente, häufige, fokussierte Aufgaben | Komplexe professionelle Aufgaben |
| Öffentliche OpenAI-Route, aktuelle Momentaufnahme | Median erster Token ca. 1,53 s; 207 Tokens/s | Median erster Token ca. 1,93 s; 47 Tokens/s |
| Sprachqualität / Zuverlässigkeit in MORA | Noch nicht live bewertet | Noch nicht live bewertet |

Die Geschwindigkeit ist keine Zusicherung für MORA; zwei Modellstufen, Reasoning und strukturierte Ausgabe benötigen weitere Zeit. Dialekt, Tippfehler, Natürlichkeit und Korrekturen müssen mit identischen vollständigen Dialogen verglichen werden. Kontextgrösse ersetzt keine zuverlässige Datenverwaltung. Schweizer Hochdeutsch ist im Systemauftrag vorgesehen; persönliche Immobilien-/Rechts-/Dokumentenaussagen benötigen berechtigte Quellen.

**Empfehlung:** Luna als wirtschaftlichen Standard testen, Sol mit denselben schwierigen Gesprächen vergleichen. Das bestehende Gateway-Standardmodell bleibt Luna; kein Modell wurde kostenpflichtig aktiviert. Eine verfügbare Vergleichsalternative ist Claude Sonnet 5.5 (`anthropic/claude-sonnet-5.5`, 2 / 10 USD, Kontext 1 Million, strukturierte Ausgabe/Tools), ebenfalls ohne bestätigte Gratisberechtigung.

Quellen: [Luna](https://vercel.com/ai-gateway/models/gpt-6-luna), [Sol](https://vercel.com/ai-gateway/models/gpt-6.1-sol), [OpenAI Standardpreise](https://developers.openai.com/api/docs/pricing), [Sonnet](https://vercel.com/ai-gateway/models/claude-sonnet-5.5), [Katalog](https://ai-gateway.vercel.sh/v1/models).

## Umgesetzte Änderungen und Grenzen

- `MORA_AI_ENABLED=false` verhindert Modellgenerierung trotz vorhandener Credentials. Preview-Provider ausdrücklich Gateway, kein direkter OpenAI-Fallback. `MORA_AI_REQUIRED=true` meldet KI-Nichtverfügbarkeit ehrlich. Die vorbereitete zweite Modellstufe für natürliche Formulierung ist ebenfalls durch die Abschaltung gesperrt.
- Das Modell kann `unknownFields` für ausdrücklich unbekannte/verweigerte Angaben liefern. Diese Markierungen bleiben im signierten Kontext, verhindern erneute Rückfragen und werden durch spätere konkrete Angaben ersetzt. Keine zusätzliche Textbaustein-Erkennung wurde in den geführten Ersatzpfad eingebaut.
- Beide Modellstufen protokollieren sichere Tokenzahlen, Dauer, bereinigte Gateway-Generation-ID und ausdrücklich geschätzte Standard-Tokenkosten. Keine Nachrichten, Keys, Sessions oder beliebigen Provider-Metadaten werden geloggt.
- `npm run ai:audit` liest Credits ohne Inferenz; `--generation gen_ID` liest die tatsächlichen Kosten einer vorhandenen Generation. `npm run ai:costs` reproduziert die folgende Planung.
- `GET /api/ai-readiness` ist nur nach Opt-in auf diesem Preview-Branch verfügbar, in Production/anderen Branches 404. Finanzwerte sind nur in privaten Logs. 8-Sekunden-Timeout, keine freien API-/Modellparameter, instanzlokale Zwischenspeicherung. Vercel-Preview-Schutz bleibt erforderlich.
- `ai:check --live --dialogs` enthält die gewünschten Steckdosen-, Raumkorrektur-, unbekannte-Dauer-, Mehrfachschaden-, Melde-, Nebenkosten-, Schlüssel- und unklare-Problem-Fälle. Die Funken-Sicherheitsprüfung benötigt kein Modell. Live-Inferenz verlangt ausdrücklich `MORA_AI_ENABLED=true` nach der Kontoprüfung.

Vorhandene Grenzen: 3'000 Ausgabetokens pro Modellstufe, keine SDK-Retries, bis 22 Sekunden je Stufe im gemeinsamen 25-Sekunden-API-Fenster, 2'000 Zeichen Eingabe, begrenzte Historie, acht getrennte Anliegen. Dies ist kein globales Geldlimit. Timeouts garantieren keine Nullkosten für bereits begonnene Anbieterarbeit.

## Verifikation und echte Gesprächsqualität

152 automatisierte Tests bestanden, ausserdem Typecheck, Syntax-/Assetprüfung und Build. Enthalten sind mobile/Desktop-DOM-Flows, Manipulationsschutz, Kontext, Korrekturen, getrennte Anliegen, lokale Fotos/Entwürfe, Fehlerfälle, unbekannte Angaben und die lesende Diagnose. Modellverträge werden mit simulierten Modellausgaben geprüft.

Zusätzliche echte HTTP-Prüfung der geschützten Preview: normale Steckdosenanfrage liefert `503 MODEL_UNAVAILABLE` mit `reason: inference_disabled`, ohne modellgenerierte Antwort. Der Funkenfall liefert `200`, `responseMode: safety` und die erlaubte Aktion für 112. Die Portalstartseite und Credit-Diagnose liefern 200, GET auf den POST-only Chat erwartungsgemäss 405. Diese Ergebnisse belegen die Bereitstellung und Abschaltung, nicht die Gesprächsqualität eines Modells.

**In diesem Auftrag wurde keine echte Modellgenerierung gestartet: 0 Inferenztokens, 0 USD Modell-Testverbrauch.** Es gibt noch keine belastbare Live-Bewertung der Natürlichkeit oder Zuverlässigkeit. Bestehende Kontokosten sowie Hosting-/Build-Verbrauch sind davon getrennt; die gesamte Vercel-Rechnung wurde nicht geprüft.

## Portal und Kundendaten

Bereits vorhanden: geprüfte Navigation, Anliegenwechsel, lokale vorausgefüllte Serviceentwürfe, Ergänzungen, lokale Fotos und erlaubte Notrufaktion. Actions kommen ausschliesslich aus der validierten Registry. Das Modell erhält keine beliebigen SQL-/Datenbank-, Versand- oder Portaloperationen.

Nicht angebunden: echte Kundenanmeldung, Kunden-/Einheitrechte, Mietverträge/Nebenkostenbelege, echte Termine und Status, tatsächliche Anliegenübermittlung, Uploads und Bearbeitungssystem. `POST /api/requests` bleibt ohne Integration bei `integration_required`. Das Modell kann allgemeine Begriffe erklären, aber keine persönliche Abrechnung ohne Beleg prüfen.

Signierte Sessions schützen Integrität, verschlüsseln Kundendaten aber nicht. Echte Kundendaten erfordern geeignete Authentifizierungs-, Speicher- und Löschregeln. Bilder/Dateiinhalte gehen derzeit nicht ans Modell. `store:false` garantiert kein vollständiges Zero Data Retention. Region, Aufbewahrung, Verträge und Providerroute sind vor Kundeneinsatz zu prüfen. Keine kostenpflichtigen teamweiten Policies wurden eingeschaltet.

## Monatliche Tokenkosten: Annahmen, keine Messung

Planung mit verifizierten Standardpreisen, **zwei Modellstufen je Kundennachricht**, wiederholtem Kontext und ohne Cache-Rabatt:

| Profil | Kundennachrichten | Gesamte Input-/Output-Tokens | Luna je Gespräch | Sol je Gespräch |
| --- | ---: | ---: | ---: | ---: |
| Einfach | 3 | 12'000 / 1'500 | 0,00195 USD | 0,039 USD |
| Durchschnitt | 8 | 64'000 / 8'000 | 0,0104 USD | 0,208 USD |
| Komplex | 15 | 150'000 / 18'000 | 0,024 USD | 0,48 USD |

Luna pro Monat, USD:

| Gespräche | Einfach | Durchschnitt | Komplex |
| ---: | ---: | ---: | ---: |
| 100 | 0,20 | 1,04 | 2,40 |
| 500 | 0,98 | 5,20 | 12,00 |
| 1'000 | 1,95 | 10,40 | 24,00 |
| 5'000 | 9,75 | 52,00 | 120,00 |
| 10'000 | 19,50 | 104,00 | 240,00 |

Sol pro Monat, USD:

| Gespräche | Einfach | Durchschnitt | Komplex |
| ---: | ---: | ---: | ---: |
| 100 | 3,90 | 20,80 | 48,00 |
| 500 | 19,50 | 104,00 | 240,00 |
| 1'000 | 39,00 | 208,00 | 480,00 |
| 5'000 | 195,00 | 1'040,00 | 2'400,00 |
| 10'000 | 390,00 | 2'080,00 | 4'800,00 |

Zehn Kundennachrichten plus zehn MORA-Antworten, angenommen 80'000 Input-/10'000 Output-Tokens über beide Stufen: ca. **0,013 USD Luna oder 0,26 USD Sol**. Zehn angezeigte Nachrichten insgesamt wären ungefähr halb so viele Runden. Reasoning ist bereits im Output enthalten und wird nicht doppelt addiert.

Diese Profile sind Planungsannahmen. Dokumente, längeres Reasoning, Fehler und zusätzliche Tools können mehr kosten. Caching und eine spätere gemeinsame Modellstufe können sparen. Nicht enthalten: Wechselkurs/Steuern, regionale Verarbeitung (gegebenenfalls +10 %), Fast-/Priority-, Cache-Schreib-, Websuch-, Hosting-, Datenbank- und Dateikosten. Guthaben wurde nicht abgezogen.

Beispielrouting: 80 % durchschnittliche Luna- und 20 % Sol-Gespräche ergäben 0,04992 USD je Gespräch bzw. 49,92 USD pro 1'000, vor Router-/Eskalationsaufwand. Gegenüber reinem Sol günstiger, gegenüber reinem Luna teurer. Erst Qualität messen, dann bedarfsgerecht eskalieren; noch kein automatischer Router oder starrer Themenwortfilter.

## Weitere Kosten und Produktionsreife

Vercel kann je nach bestehendem Tarif/Freikontingent Plan, Builds, Function-Ausführung und Traffic berechnen. Echte Persistenz braucht Datenbank-/Speicher-/Backupkosten; Dokumentensuche gegebenenfalls Embeddings/Index, Fotos Objektspeicher/Traffic. Kein neuer solcher Dienst wurde eingerichtet. Gateway-Custom-Reporting, Trace Drains und bestimmte teamweite Policies kosten gesondert; keine wurden eingeschaltet.

Vor kostenloser Aktivierung: Gratisherkunft und berechtigte Modelle prüfen, Auto-Top-up und kostenpflichtige BYOK/Fallbacks ausschliessen, Budget/Zugriffsschutz kontrollieren. Gateway-Budgets sind weiche Grenzen: eine überschreitende Anfrage kann noch fertiglaufen. Strikte öffentliche Monatslimits benötigen dauerhafte atomare Kostenreservierung und verteilte Anfragelimits; Instanzzähler reichen nicht.

Dann synthetische vollständige Dialoge starten, tatsächliche Generation-Kosten und Latenz erfassen, Natürlichkeit/Schleifen/Korrekturen menschlich bewerten und Modelle vergleichen. Danach Kundenrechte, berechtigte Dokumentensuche mit Quellen, dauerhafte Sessions, echte Vorgangsquittungen, Monitoring und Last-/Fehlerprüfungen. Produktion weiterhin nur mit ausdrücklicher Freigabe.
