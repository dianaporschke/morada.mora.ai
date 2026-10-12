# MORA: echte Gateway-Anbindung und Live-Verifikation

> Historischer Arbeitsstand vom 10. Oktober. Am 12. Oktober wurden der branchgebundene API-Key und eine echte „Hey“-Antwort in einer neuen Preview bestätigt. Der aktuelle Premium-Umbau und sein separat dokumentierter Prüfstand stehen in `MORA_PREMIUM_QUALITY_REPORT.md`. Die folgende Zweistufen-Architektur ist der vorherige Stand.

Prüftag: 10. Oktober 2026. Repository `dianaporschke/morada.mora.ai`, Branch `codex/mora-ai-2.0`. Der Abschluss des Live-Dialogs ist noch in Prüfung; dieser Arbeitsstand ist keine Erfolgsmeldung.

## Nachgewiesene Ursachen und Korrekturen

1. Die branchgebundene Preview hatte `MORA_AI_ENABLED=false`: normale Texte wurden vor jeder Inferenz abgewiesen.
2. `openai/gpt-6-luna` ist katalogisiert, laut tatsächlicher Kontoansicht aber nicht für kostenloses Gateway-Guthaben berechtigt. Historische `403 no_providers_available` waren daher kein Nachweis für einen fehlenden API-Key.
3. Die Konto-Screenshots zeigen 5 USD **Free AI Credit**, **Auto-reload Disabled**, ausgeschaltete ZDR-/Provider-Allowlist-Masterregler und kostenlose Berechtigung für `inception/mercury-2.5`. Diana erhielt im echten Playground bereits Modellantworten. Kein Guthabenkauf, keine neue Karte, keine Auto-Aufladung und keine kostenpflichtige Freischaltung wurden vorgenommen.
4. Gateway-OIDC funktioniert in der Vercel-Laufzeit. Projekt, Preview-Branch und Modellkatalog wurden tatsächlich abgefragt. Bestehende Secrets wurden nicht gelesen oder geändert.
5. Mercury über den Gateway-Adapter unterstützt den hier verwendeten JSON-Schema-Transport nicht vollständig: Runtime-Warnung `JSON response format schema is only supported with structuredOutputs`, danach `invalid_model_output`. Ein erzwungener Antwort-Tool-Aufruf endete sowohl nach 22 als auch nach 40 Sekunden im Timeout. Die darunterliegende Gateway-/Provider-Ursache dieses Tool-Timeouts ist nicht bekannt. Längere Zeitlimits allein lösten ihn nicht.
6. Die funktionierende Transportkorrektur verwendet für Mercury `Output.json()`, übermittelt das vollständige JSON-Schema samt Felderklärungen im Systemauftrag und validiert weiterhin mit dem originalen strengen Zod-Schema. Andere Modelle behalten `Output.object()`. Keine reparierten, simulierten oder geführten Antworten werden als Modellantworten ausgegeben.
7. In einer schnellen Testfolge wurden fünf Modellstufen angenommen und die folgende Stufe mit `429 rate_limit_exceeded` abgelehnt. Das ist eine beobachtete Aufrufbegrenzung, keine leere Guthabenbilanz. Tests werden mit Abstand ausgeführt. Das genaue dauerhaft gültige Kontolimit wurde nicht über eine Rate-Limit-Einstellung ausgelesen.
8. Die Live-Tests fanden fälschlich als unbekannt markierte ungenannte Angaben und eine als Zeit gespeicherte Nichtwissen-Antwort. Beschreibungen im Modell-Schema unterscheiden beides ausdrücklich. Keine sprachlichen Regex-Antwortvorlagen wurden hinzugefügt.
9. Die vorhandene Anwendung ergänzte auch im Modellmodus eigene Checklistenfragen. Im echten Modellmodus entscheidet nun das Modell über die Rückfrage; `question=null` erzeugt keine weitere Checklistenfrage. Beantwortete/ausdrücklich unbekannte Felder werden nicht wieder als Frage angenommen. Die vorhandenen sicheren Auswahlbuttons bleiben für passende Modellfragen verfügbar. Der alte geführte Pfad wird nicht als echte KI verwendet.
10. Die Formulierungsstufe erhält die konkrete offene Frage und die tatsächlich vorhandenen Portalberechtigungen. Sie darf keinen Versand behaupten oder fehlende Angaben als einzige Versandhürde darstellen, wenn `submitRequest=false` ist.

## Effektive Preview-Konfiguration

Projekt `morada-mora-ai` (`prj_vI6F07O5rdsXOdFlinN4kHAR1Nvd`), Team `team_IwiBPLqyss3IE9qMeGsLRppV`.

- `MORA_AI_PROVIDER=gateway`
- `AI_GATEWAY_MODEL=inception/mercury-2.5`
- `MORA_AI_ENABLED=true`
- `MORA_AI_REQUIRED=true`
- `MORA_AI_NATURAL_REPLIES=true`
- `MORA_AI_CREDIT_CHECK=true`

Die Änderungen gelten für Preview / `codex/mora-ai-2.0`. Kein OpenAI-Direktfallback und kein automatischer Wechsel auf einen anderen Abrechnungsweg. Vercel Authentication bleibt eingeschaltet. Die Diagnose-Booleans zur Gratis-/Aufladungsprüfung sind keine Kontoabfrage; die entsprechenden Belege stammen aus den tatsächlichen Konto-Screenshots.

## Architektur, Grenzen und Portalaktionen

`POST /api/chat` liest den signierten Kontext, lässt das Modell Angaben verstehen, prüft Zustandsänderungen und erlaubte Aktionen serverseitig und lässt die Antwort natürlich formulieren. Zwei echte Modellstufen je normaler Nachricht. Mercury erhält reduzierten Reasoning-Aufwand. Je Stufe maximal 3'000 Ausgabetokens, keine SDK-Retries, maximal 40 Sekunden; beide Stufen teilen 55 Sekunden innerhalb einer 60-Sekunden-Function. Der Browser bricht nach 65 Sekunden ab. Nicht erfolgreiche Modellversuche können trotzdem Guthaben verbrauchen.

Begrenzte Historie plus strukturierte Angaben und Unbekannt-Markierungen erhalten den Kontext. Modelltext, Kundentexte, signed Sessions, Fotos und Keys werden nicht in Modellnutzungslogs ausgegeben. Tokenzahlen, Dauer, bereinigte Generation-IDs und geschätzte Kosten werden geloggt; auch verworfene strukturierte Antworten behalten verfügbare Nutzung für die Kostenberechnung.

Vorhanden: lokale Anliegenentwürfe, vorausgefüllte Übergabe an den Servicebereich, Korrekturen, getrennte Anliegen, lokale Fotos, geprüfte Portalnavigation und erlaubte Notrufaktionen. Nicht angebunden: echte Kundenrechte, persönliche Dokumente, reale Termine/Bearbeitungsstände, tatsächlicher Anliegenversand und serverseitige Foto-Uploads. `POST /api/requests` bleibt bei `integration_required`. Keine beliebigen SQL-, Datenbank- oder Portaloperationen durch das Modell.

Unmittelbare Gefahren werden unabhängig von Modellverfügbarkeit behandelt. Ein Funken-Test im Safety-Pfad ist keine Modellantwort. Signierte Sessions sind kein verschlüsselter serverseitiger Kundendatenspeicher. Mercury ist laut überprüfter Modelldarstellung für No Training geeignet, aber ohne zugesichertes ZDR. Verarbeitung, Verträge, Aufbewahrung und Kundenberechtigungen sind vor echten Kundendaten gesondert zu klären.

## Reproduzierbare Kostenplanung

Verifizierte Gateway-Promotionspreise am Prüftag: Mercury 2.5 **0,04 USD Input / 0,15 USD Output je Million Tokens**, als 80-%-Promotion ausgewiesen. Vor einer Betriebsplanung erneut prüfen. Die Rechnung gilt bei diesen Preisen; sie ist keine Zusicherung zukünftiger Preise oder gemessener Dialogkosten.

Zwei Modellstufen, wiederholter Kontext, keine Cache-Rabatte:

| Gespräche pro Monat | Einfach: 12'000 / 1'500 Tokens | Durchschnitt: 64'000 / 8'000 | Komplex: 150'000 / 18'000 |
| ---: | ---: | ---: | ---: |
| 100 | 0,0705 USD | 0,376 USD | 0,87 USD |
| 500 | 0,3525 USD | 1,88 USD | 4,35 USD |
| 1'000 | 0,705 USD | 3,76 USD | 8,70 USD |
| 5'000 | 3,525 USD | 18,80 USD | 43,50 USD |
| 10'000 | 7,05 USD | 37,60 USD | 87,00 USD |

Einfach = drei Kundenrunden, durchschnittlich = acht, komplex = fünfzehn. Zehn Kundenrunden bei angenommenen 80'000 Input-/10'000 Output-Tokens kosten etwa **0,0047 USD**. Reasoning ist im Output enthalten, nicht doppelt berechnet. `npm run ai:costs` reproduziert Mercury-, Luna- und Sol-Vergleichsrechnungen. Die vorhandenen Luna-/Sol-Preise sind keine kostenlose Berechtigung dieses Kontos.

Nicht enthalten: Steuern/Wechselkurs, Vercel-Tarif und Function-/Build-/Traffic-Verbrauch, künftige Datenbanken/Dateispeicher/Dokumentensuche, besondere Provider-/Regional-/Service-Tier-Kosten. Keine neuen kostenpflichtigen Dienste wurden eingerichtet. Das Freiguthaben wird separat verbraucht; daraus lässt sich kein belastbarer Produktionsdurchsatz ableiten.

Bei diesen niedrigen Modellpreisen ist automatisches Mehrmodell-Routing zunächst nicht sinnvoll nachgewiesen. Erst gleichartige echte Dialoge und Dokumentenfälle qualitativ vergleichen; keine kostenpflichtige Sol-Eskalation ohne Freigabe. Zwei Aufrufe pro Nachricht erhöhen die Rate-Limit-Belastung. Eine spätere gemeinsame Modellstufe ist ein möglicher Optimierungsschritt, benötigt aber dieselben Fakten-, Rechte- und Aktionsprüfungen.

## Quellen

- [Mercury 2.5: Gateway-Modell und Preise](https://vercel.com/ai-gateway/models/mercury-2.5)
- [Gateway-Free-Tier und Preise](https://vercel.com/docs/ai-gateway/pricing)
- [Gateway-Credits und Generation-Verbrauch](https://vercel.com/docs/ai-gateway/observability-and-spend/usage)
- [AI SDK JSON-Ausgaben](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Inception Chat-Completions-API](https://docs.inceptionlabs.ai/api-reference/chat/create-a-chat-completion)

Kontobelege sind manuelle Screenshots und authentifizierte Runtime-Abfragen, nicht diese allgemeinen Dokumentationen.
