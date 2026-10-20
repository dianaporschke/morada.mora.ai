"""Build the German Phase 1 report from completed measurements and review notes.

Offline only. Qualitative judgments are explicitly those of the reviewing AI.
Run analyze.py first; this file never changes product code or invokes a model.
"""
import json
import pathlib
import statistics

root = pathlib.Path(__file__).resolve().parents[2]
evidence = root / 'docs/evidence'
load = lambda name: json.loads((evidence / name).read_text())
m = load('quality-phase1-measurements.json')
q = load('quality-phase1-qualitative-review.json')
original = load('quality-phase1-live.json')
replacement = load('quality-phase1-retest-09.json')
manifest = load('quality-phase1-source-manifest.json')
assert m['complete'] and q['status'] == 'complete' and len(q['cases']) == 20
a, b = (m['variants'][v] for v in ['A', 'B'])
assert a['unpricedTurns'] == b['unpricedTurns'] == 0
number = lambda n, places=2: f'{n:.{places}f}'.replace('.', ',')
seconds = lambda n: number(n / 1000)
usd = lambda n: number(n, 8)
mean_score = lambda v, i: number(statistics.mean(c[v]['scores'][i] for c in q['cases']), 1)
qualitative = '\n'.join(
    f'| {criterion} | {mean_score("A", i)} | {mean_score("B", i)} |'
    for i, criterion in enumerate(q['criteria'])
)
per_case = '\n'.join(
    f'| {c["id"]} {c["topic"]} | {usd(c["variants"]["A"]["totalGatewayCostUsd"])} | '
    f'{usd(c["variants"]["B"]["totalGatewayCostUsd"])} | '
    f'{seconds(c["variants"]["A"]["latencyServerExcludingCreditGuardMs"]["median"])} / '
    f'{seconds(c["variants"]["B"]["latencyServerExcludingCreditGuardMs"]["median"])} |'
    for c in m['cases']
)
final_credits = replacement['finalCredits']
initial_used = manifest['costBoundary']['baselineTeamUsedUsd']
initial_balance = 5 - initial_used
credit_used = final_credits['totalUsedUsd'] - initial_used
known_cost = m['knownTaskGenerationCostUsd']
report = f'''# MORA AI 2.0 – kontrollierter Qualitätsvergleich, Phase 1

**Ergebnis:** Der Wechsel auf einen kurzen Prompt allein löst die Qualitätsprobleme nicht. Auch A erzeugt förmliche Wiederholungen, Sprachfehler und unbelegte Zusagen. B ist oft kürzer und führt mehrere strukturierte Fakten zuverlässig zusammen, verschlechtert aber einzelne Antworten durch widersprüchliche Entscheidungsstufen. Besonders kritisch: B behauptet wiederholt vorhandene Entwürfe oder spätere Kontaktaufnahme, obwohl der tatsächliche Zustand dies nicht bestätigt. Für den unveränderten Einsatz ist keine der beiden getesteten Konfigurationen ausreichend zuverlässig.

Es wurden **20 identische Gesprächspaare, 40 mehrteilige Gespräche und 104 auswertbare Kundenrunden** mit echten Mercury-Antworten durchgeführt. Produktcode und bestehende Kunden-Preview wurden nicht geändert. Dieser Bericht schlägt eine begrenzte nächste Umsetzung zur Freigabe vor; er implementiert sie nicht.

## Versuchsaufbau und Reichweite

Basis ist GitHub-Commit `{original['sourceCommit']}` auf `codex/mora-ai-2.0`. Vor dem ersten neuen Schreibzugriff wurde der GitHub-Stand gelesen. 35 Bestandsdateien des isolierten Bundles wurden gegen die Git-Blob-Hashes geprüft. `main` und `alex-portal` werden nicht bearbeitet; es gibt keinen Merge oder Produktionsdeploy.

| Merkmal | A: natürliche Assistenz | B: bestehende MORA |
| --- | --- | --- |
| Modell | `inception/mercury-2.5` | dasselbe Modell |
| System | kurzer Immobilien-/Sicherheitsprompt, unten vollständig | bestehende Prompts und vollständige Chat-/Aktionspipeline |
| Ausgabe | freier Text | strukturierter Gesprächsplan, Faktenreducer, Aktionsprüfung; bedingt weitere Formulierung und Vertragskorrektur |
| Lokale Schadensdialoge | keine | bestehende Logik unverändert |
| Entwurfslogik/Buttons | keine | vorhandene Logik; nur Angebote, keine ausgeführten Klicks |
| Erster Modellaufruf | max. 6400 Ausgabetokens, hohes Reasoning | unveränderte gleiche Grenzen |
| Weitere Aufrufe | keine | bestehende bedingte Formulierung mit niedrigem Reasoning und max. 2400 Tokens; begrenzte Korrektur |

A verwendete exakt diesen Systemprompt:

> {original['promptA']}

20 vorab festgelegte Fälle enthalten jeweils zwei oder drei Kundennachrichten. Beide Varianten erhalten dieselben Wörter in derselben Reihenfolge und behalten ihre eigene Gesprächssession. AB/BA wechselt je Fall; die Varianten werden je Kundenrunde verschachtelt. Modell, Prompts und Kundentexte wurden während der Auswertung nicht sprachlich optimiert. Es gibt keine Mock-Antworten und keine Auswahl besonders gelungener Antworten.

Die Tests liefen über getrennte, unaliasierte Vercel-Testdeployments. B ruft dort den originalen `createChatHandler` samt MORA-Modulen auf. Eine zusätzliche feste Testroute beobachtet Modelltransport und Guthaben lesend. Die bestehende Preview blieb unverändert:

[Bestehende, unveränderte MORA-Preview](https://morada-mora-hwg0nkuia-dianaporschke-1255s-projects.vercel.app/)

Die Kunden-Preview selbst stammt aus dem früheren Funktionscommit `6ef24cd`; die spätere Vergleichsbasis enthält denselben überprüften Produktcode. Testdeployments erhalten keinen Kundenalias. Details stehen im [Quell- und Isolationsnachweis](evidence/quality-phase1-source-manifest.json).

**Abgrenzung:** Dies ist ein Vergleich der tatsächlichen serverseitigen Gesprächs-/Aktionspipeline, ergänzt durch Quellprüfung des Frontends. Es wurden keine Buttons angeklickt, Browserabläufe oder Portalübernahmen ausgeführt. Daher beweist Phase 1 keine funktionierende Entwurfsspeicherung und keine vollständige Browser-Ende-zu-Ende-Kette. A hat diese Funktionen bewusst nicht. Historische Buttondarstellung und Verhalten nach einem echten Speicherklick sind keine gemessenen A/B-Ergebnisse dieses Laufs.

## Bewertung der acht Kriterien

Die ersten sechs Kriterien wurden je vollständigem Gespräch auf 1–5 bewertet: 1 = schlecht beziehungsweise schwerwiegend falsch, 3 = brauchbar mit deutlichen Mängeln, 5 = durchgehend passend. Die folgenden Mittelwerte sind beschreibende Urteile der durchführenden KI, **keine unabhängige verblindete Menschenstudie, statistische Signifikanz oder Produktfreigabe**. Schwere falsche Status-/Sicherheitsaussagen zählen unabhängig vom Mittelwert. Alle 20 Einzelbewertungen samt Begründungen sind [separat lesbar](evidence/quality-phase1-qualitative-review.json).

| Kriterium, höhere Note besser | A | B |
| --- | ---: | ---: |
{qualitative}

| Messgrösse | A | B |
| --- | ---: | ---: |
| 7. Antwortdauer, Median Server ohne zusätzlichen Guthabenschutz | {seconds(a['latencyServerExcludingCreditGuardMs']['median'])} s | {seconds(b['latencyServerExcludingCreditGuardMs']['median'])} s |
| 95. Perzentil derselben Dauer | {seconds(a['latencyServerExcludingCreditGuardMs']['p95'])} s | {seconds(b['latencyServerExcludingCreditGuardMs']['p95'])} s |
| Serverdauer inklusive Mess-Guthabenschutz, Median | {seconds(a['latencyServerMs']['median'])} s | {seconds(b['latencyServerMs']['median'])} s |
| Gesamte Testtreiber-Anfrage, Median | {seconds(a['latencyWallMs']['median'])} s | {seconds(b['latencyWallMs']['median'])} s |
| 8. Tatsächliche Gateway-Kosten für 20 Gespräche | {usd(a['totalGatewayCostUsd'])} USD | {usd(b['totalGatewayCostUsd'])} USD |
| Kosten je Gespräch, Mittel | {usd(a['totalGatewayCostUsd']/20)} USD | {usd(b['totalGatewayCostUsd']/20)} USD |
| Beobachtete Modellgenerierungen / Kundenrunden | {a['generations']} / {a['turns']} | {b['generations']} / {b['turns']} |
| Antwortlänge, Median in Zeichen | {number(a['replyCharacters']['median'], 1)} | {number(b['replyCharacters']['median'], 1)} |
| Runden mit förmlichem Dank / Entschuldigung | {a['formalThanksTurns']} / {a['apologyTurns']} | {b['formalThanksTurns']} / {b['apologyTurns']} |
| Runden mit Erfassungswörtern wie „notiert/erfasst“ | {a['administrativeConfirmationTurns']} | {b['administrativeConfirmationTurns']} |
| Anwendungsfehler / herabgestufte Antworten | {a['applicationErrors']} / {a['degradedTurns']} | {b['applicationErrors']} / {b['degradedTurns']} |

Dauer bedeutet Zeit bis zur vollständigen Antwort, kein Streaming und keine Zeit bis zum ersten Token. Gratislimit-Pausen zwischen Anfragen zählen nicht hinein. Die zusätzliche Guthabenprüfung wird separat gemessen und für die bereinigte Serverdauer abgezogen. Testtreiberzeiten enthalten Netz-/Toolaufwand und die umfangreichen Messdaten; sie sind keine behauptete Browser-UX-Latenz. B enthält seine echten lokalen Sicherheitsantworten; diese sparen Aufrufe, sind aber keine Mercury-Sprachleistung. Das 95. Perzentil bei 52 Runden ist ein deskriptiver Stichprobenwert. Kosten und Generierungszahl stammen aus beobachteten Requests und Generation-Lookups, nicht aus geschätzten Bestands-Logkosten.

## Konkrete Gesprächsbelege und Herkunft

Die Zitate sind echte gespeicherte Ausgaben. Vollständige A/B-Verläufe aller Fälle stehen in [MORA_PHASE1_TRANSCRIPTS.md](MORA_PHASE1_TRANSCRIPTS.md). Die Rohdaten enthalten zusätzlich die erzeugten Textfelder verworfener Kandidaten, Prompts, Parameter, Aktionen, validierten Fakten und Herkunftsmarkierungen; Reasoning-Inhalte und Zugangsdaten sind ausgeschlossen.

### 1. „lampe kaputt“: Die Architektur verwirft die hilfreiche Raumfrage

In Fall 01 entscheidet Bs erster Modellplan: Lampe erkannt, keine Sachfrage, Vorbereitung anbieten. Seine echte Antwort lautet: **„Gerne habe ich das notiert. Möchten Sie, dass ich ein Formular für die Meldung vorbereite?“**

Die anschliessende echte Modellformulierung fragt dagegen nach dem Raum; auch der Korrekturaufruf versucht dies. Beide werden abgewiesen, weil `questionKey=location` nicht zum bereits festgelegten `questionKey=null` passt. Die Anwendung verwendet danach wieder die ursprüngliche Modellantwort mit Formularangebot (`wordingFallback=validated_model`, herabgestuft). Die natürlichere Entscheidung war also vorhanden und wurde durch die Aufgabenteilung verhindert.

Belegbarer Ablauf: `lib/mora/dialogue.js:requiresVerifiedWording` → `lib/mora/reply.js:replyContext/generateNaturalReply` → strenger Fragenvertrag → `retainValidatedConversation`. `engine.finish` speichert bereits das vorläufige Aktionsangebot, bevor die endgültige Formulierung feststeht. Das ist ein konkreter Konflikt zwischen Entscheidungsstufen. Es ist kein Nachweis, dass das Modell „Wohnzimmer“ nicht versteht.

A fragt in demselben Fall wiederholt nach Mieter/Eigentümer und beginnt förmlich mit Dank/Bedauern. Auch das sind echte Modelltexte ohne lokale MORA-Dialoge. Die festen Folgeantworten nennen Raum und Anzahl, beantworten As Rollenfrage jedoch nicht: Nicht jede wiederholte Rollenfrage ist daher eine Frage nach schon bekannten Angaben. Die unnötige Rollenabhängigkeit und der Umfang bleiben qualitative Probleme dieser Konfiguration.

### 2. Korrekter Zustand, falsche Aussage über einen vorhandenen Entwurf

| Fall/Runde | Sichtbare echte B-Modellantwort | Tatsächlicher Zustand |
| --- | --- | --- |
| 02/2, Steckdose | „Der bereitgestellte Entwurf steht für Sie bereit …“ | `preparation.status=not_prepared` |
| 05/3, Themenrückkehr | „Der vorbereitete Entwurf bleibt für Sie verfügbar …“ | kein Erstellungs-/Speicherbeleg |
| 12/3, Wasser | „Ich habe den Stand im Entwurf notiert.“ | kein erstellter Entwurf |
| 16/2, Lampe | „Der Entwurf liegt im Serviceformular bereit.“ | weiterhin `not_prepared` |
| 17/2, Versandfrage | „Noch nicht. Direktversand ist nicht möglich. Der Entwurf liegt lokal vor und wartet auf Ihre Bestätigung.“ | kein Klick, kein Speicherbeleg, `not_prepared` |

Die JSON-/Faktenprüfung akzeptiert diese Sätze. Die Regex-Prüfung in `validatedDialogueReply` deckt nur bestimmte Wortstellungen ab, etwa „ich habe … Entwurf … erstellt“ oder „Entwurf ist … vorbereitet“. Attributive Formen („der vorbereitete Entwurf“), „liegt bereit“ und „im Entwurf notiert“ passieren. Ein syntaktisch gültiger Plan ist damit keine semantisch wahre Statusauskunft.

Der Modellkontext enthält bereits Fähigkeiten, Klickpflicht und den tatsächlichen Entwurfsstatus. Der Formulierungsprompt sagt ausdrücklich, dass `draftExists=false` keinen Entwurf bedeutet. Es fehlt hier also nicht einfach die gesamte Statusinformation. Die Annahme, Frontend und Backend hätten im Test tatsächlich unterschiedliche erfolgreich ausgeführte Entwürfe, ist ebenfalls nicht belegt: Es gab überhaupt keine Ausführung. Belegt ist der Widerspruch zwischen Text und Zustand.

### 3. Unbelegte Zusagen betreffen beide Varianten

A sagt in Fall 06: **„… werde ich die Meldung umgehend an das Wartungsteam weiterleiten.“** In Fall 05 verspricht A: **„Sobald Sie mir die Details nennen, veranlasse ich das Weitere.“** Der kurze Prompt untersagt externe Vorgänge; diese Antworten stammen trotzdem direkt vom Modell.

B sagt in Fall 16 nach der blossen Angabe einer Erreichbarkeit: **„Notiert. Ich melde mich morgen ab 16 Uhr bei Ihnen, falls jemand Rückfragen hat.“** Im Zustand wird die Erreichbarkeit als Detail gespeichert; es existiert kein Termin, Nachrichtenauftrag oder Rückrufdienst. Fall 11 enthält ebenfalls ein unbelegtes „wir … melden uns“. Eine Wahrheitsprüfung nur für Versand-/Buchungsverben reicht nicht aus.

Bei der ausdrücklich verlangten Bestellung eines Schlüsseldienstes (15) und dem Direktversand (17) benennen beide Varianten ihre Grenzen. Die Probleme entstehen auch beiläufig während normaler Fortsetzungen, nicht nur bei offensichtlichen Aktionswünschen.

### 4. Sprachfehler entstehen bereits in echten Modellantworten

Bs nachgelagerte Formulierung erzeugt unter anderem **„Ich habe not not not festgehalten.“** (03/1), **„Ich habe not not.“** (05/1) und **„Ich habe das not.“** (12/1). Die erzeugten JSON-Textfelder enthalten diese Wörter bereits; das Frontend setzt sie nicht zusammen. In 03/1 ist der erste Modellplan sprachlich korrekt, der zusätzliche Formulierungsschritt verschlechtert ihn.

Auch A produziert ohne diese Logik deutliche Sprachfehler, etwa **„stressfulige Situation“**, **„fürassen“** und **„Neueinschlüsselung“** in Fall 15. A ist häufig lang, förmlich und enthält erneut Grussformeln. Damit ist die Erklärung „nur lokale Standardtexte sind schuld“ widerlegt. Ob Ausgabeformat, Reasoning, Rollenprompt oder Modellgrundqualität jeweils welchen Anteil haben, isoliert dieser Bündelvergleich nicht.

### 5. Die Sicherheitsreaktion verdeckt vorhandenes Kontextverständnis

In Fall 10 nennt der Kunde Funken/Brandgeruch, fragt nach einem erneuten Test und ergänzt schliesslich, dass ein Kind im Zimmer ist. B zeigt dreimal denselben lokalen Sicherheitsblock. Die erste Runde benötigt keinen Modellaufruf. In der dritten Runde erzeugt Mercury tatsächlich den konkreten Hinweis, das Kind sofort aus dem Zimmer zu führen; die Anwendung ersetzt ihn durch den generischen Block.

Der Grundschutz ist sinnvoll und darf erhalten bleiben. Problematisch ist die vollständige Überlagerung, die neue sicherheitsrelevante Informationen aus der sichtbaren Antwort verdrängt. Es wäre sachlich falsch, diesen Fall als fehlendes Verständnis des Kindes durch Mercury zu bewerten. A passt die Antwort daran an, nimmt vorher jedoch ungeprüft an, die Sicherung sei bereits ausgeschaltet; der Kunde hatte nur Abstand bestätigt.

### 6. Fakten und fachliche Grenzen: positive Ergebnisse und verbleibende Fehler

B erhält in 03 den ausdrücklich unbekannten Beginn, korrigiert in 04 Wohnzimmer zu Schlafzimmer und bewahrt die übrigen Angaben. In 06 bleiben Lampe/Flur/heute und zwei Heizkörper/Bad/gestern getrennt. In 12 wird aus beobachtetem Wasser kein bestätigtes undichtes Rohr; die Ursache bleibt offen. In 16 versteht B die Tippfehler und speichert Anzahl, Beginn und Erreichbarkeit. In 19 erhält die zwischenzeitlich unsichere Anzahl einen `uncertain`-Faktstatus. Diese funktionierenden Bausteine sprechen dafür, Faktenreducer und zentrale Zuordnung beizubehalten.

Eine zusätzliche **reine Mappingkontrolle mit den tatsächlich empfangenen Daten**, ohne Speichern oder Portalzugriff, zeigt jedoch eine weitere Lücke: `mapServiceDraft` übernimmt in 19/2 die bisherige Anzahl 2 samt Unsicherheitsmetadaten. `draftSummary` zeigt daraus schlicht „Anzahl: 2“ und „2 betroffene Einrichtung(en)“. Die Unsicherheit ist in den Daten vorhanden und in der Zusammenfassung unsichtbar. Nach der Bestätigung in 19/3 wird korrekt 1 angezeigt. In 01/3 ergeben dieselben unveränderten Funktionen korrekt „Lampe / Leuchte“, Wohnzimmer und Anzahl 1. Das beweist das Ergebnis dieser Mappingfunktionen, keine ausgeführte Portalübernahme. [Nachweis](evidence/quality-phase1-mapping-inspection.json). Die sichtbaren Gesprächsnoten wurden durch diese ergänzende Kontrolle nicht nachträglich verändert.

Allgemeine Fragen beantwortet B teils deutlich knapper und brauchbarer, etwa Übergabeprotokoll (07), Akonto/Pauschale (05) und ruhiges Vorgehen bei Lärm (14). B verengt die Leerstandsberatung (08) allerdings auf Mängel und wiederholt eine förmliche Eigentümerinnenanrede. Bei Schimmelflecken (13) bleibt A vorsichtig; B bittet zur genauen Beurteilung um ein Foto, ohne die fehlende Bildanalyse klarzustellen. Das ist eine mehrdeutige Fähigkeitserwartung, kein Nachweis einer tatsächlich erfolgten Bildanalyse.

Ein fachlicher Gegenbeleg zu A ist die Behauptung in 08, für eine Vermietung in der Schweiz sei meist ein gültiger Energiebedarfsausweis erforderlich. Die offizielle [GEAK-FAQ](https://www.geak.ch/der-geak/faq-zum-geak/) nennt überwiegend Freiwilligkeit und einzelne kantonale beziehungsweise anlassbezogene Pflichten. Die Verallgemeinerung ist nicht belastbar. Für Schimmel und Nebenkosten wurden zudem [BAG](https://www.bag.admin.ch/de/feuchtigkeitsprobleme-und-schimmel) und [BWO](https://www.bwo.admin.ch/de/wohnen-und-energiemangel) herangezogen. Den rechtlichen Heizungsmangel-Fall stützt die Verfahrensabgrenzung der [Zürcher Gerichte zur Mietzinshinterlegung](https://www.gerichte-zh.ch/de/themen/miete/rechte-und-pflichten/maengel-der-mietsache/hinterlegung): fachkundig vorgehen, Mangel schriftlich anzeigen und nicht pauschal einfach Mietzahlungen einstellen. Die Bewertung ist keine individuelle Rechts- oder Finanzberatung.

A verknüpft eine Mietzinsminderung in 20 zusätzlich unzutreffend erst mit einer ausbleibenden Reparatur. Die [Zürcher Gerichte](https://www.gerichte-zh.ch/de/themen/miete/rechte-und-pflichten/maengel-der-mietsache/mietzinsminderung) nennen für den Minderungsanspruch bereits die Kenntnis des Vermieters vom relevanten Mangel; das ist vom eigenmächtigen Einstellen der Zahlung zu unterscheiden. B vermeidet die pauschale Nichtzahlung, sagt aber „Wir setzen uns sofort für die Instandsetzung ein“ und stellt einen startbaren Serviceauftrag in Aussicht. Diese nicht vorhandene operative Leistung ist ebenfalls ein kritischer Fehler.

## Alle 20 Fälle: tatsächliche Kosten und Dauer

Kosten umfassen je vollständigem Gespräch alle beobachteten Aufrufe einschliesslich verworfener Kandidaten und Korrekturen. Die Dauer ist der Median der jeweiligen Kundenrunden auf dem Server, abzüglich des zusätzlichen Mess-Guthabenschutzes. USD, ohne Umrechnung.

| Fall | Kosten A, USD | Kosten B, USD | Median A / B, Sekunden |
| --- | ---: | ---: | ---: |
{per_case}

## Guthaben, Vollständigkeit und Messstörungen

Start: {usd(initial_balance)} USD Guthaben, bisheriger Verbrauch {usd(initial_used)} USD; zusammen genau 5 USD. Vorherige dokumentierte Kontobelege nennen 5 USD Gratiszuteilung und deaktivierte Aufladung. Diese Phase liest die aktuelle Bilanz; sie verändert keine Zahlungseinstellung. Vor jedem Modellaufruf kontrolliert sie die Bilanz und reserviert eine konservative Maximalgebühr. Harte Grenze: 0,50 USD für den gesamten Vergleich seit dem ursprünglichen Start, zusätzlich mindestens 0,25 USD Restreserve. Es wurde kein zusätzlicher API-Schlüssel angelegt oder exportiert.

Zuordenbare tatsächliche Kosten aller {m['observedTaskGenerations']} beobachteten Haupt- und Wiederholungs-Generierungen: **{usd(known_cost)} USD**. Das enthält auch den ursprünglichen ausgeschlossenen Fall 09. Die Hauptvergleichskosten sind A+B aus der obigen Tabelle. Kontostand nach dem letzten Lookup: **{usd(final_credits['balanceUsd'])} USD**; Zunahme des kontoweiten Verbrauchs: **{usd(credit_used)} USD**. Die Differenz zum zuordenbaren Betrag umfasst insbesondere den Messpilot und eventuell den nicht empfangenen Request; der Kontowert kann auch Fremdverbrauch enthalten und wird nicht künstlich auf A/B verteilt. Kein Zukauf war erforderlich.

Aktuelle Modellpreise wurden vor Beginn aus dem Gateway-Katalog gelesen: Eingabe 0,04 USD/Mio., Ausgabe 0,15 USD/Mio., Cache-Lesen 0,004 USD/Mio. Die Auswertung verwendet danach tatsächliche reguläre Generation-Lookups, keine bezahlte Custom-Reporting-Funktion. Reasoning wird mit den sichtbaren Ausgabetokens getrennt protokolliert und in den abrechenbaren Ausgabeumfang einbezogen. Dokumentation: [Gateway-Preise](https://vercel.com/docs/ai-gateway/pricing), [Verbrauch](https://vercel.com/docs/ai-gateway/observability-and-spend/usage). Rechnung und Guthabenbetrag haben mehr Stellen als die im Bericht gerundeten Zahlen.

Offen dokumentierte Messereignisse:

1. Ein einzelner echter Pilotaufruf umging den Transportbeobachter. Er ist separat aufbewahrt, kein A/B-Erfolg; nur der Messhaken wurde korrigiert.
2. Nach 43 empfangenen Antworten brach die lokale Verbindung vor dem nächsten Empfang ab. Derselbe signierte Lauf wurde fortgesetzt. Eine nicht empfangene Anfrage wurde erneut gestellt; ihr ursprünglicher Modell-Ausgang ist unbekannt. Keine empfangene erfolgreiche Antwort wurde dafür neu gezogen.
3. In 09/B/3 scheiterte die zusätzliche Guthaben-Leseabfrage nach einer korrekt abgewiesenen echten Modellantwort. Das ist kein bewiesener nativer MORA-/Mercury-Ausfall. Ausschliesslich dieser lesende Messzugriff bekam einen begrenzten 5xx-Wiederholungsversuch. Danach wurde **vorab festgelegt**, den gesamten Fall 09 beider Varianten einmal vollständig erneut auszuführen und dessen ersten vollständig messbaren Durchlauf unabhängig von seiner Qualität auszuwerten. Originale und Wiederholung bleiben getrennt vollständig erhalten.
4. Geplante lokale Prüfpunkte pausierten den Treiber; Sessions, bereits erhaltene Antworten, Modellparameter und Reihenfolge blieben erhalten.

Deshalb existieren neben den 104 Primärantworten sechs ursprüngliche Antworten des ausgeschlossenen Falles sowie der einzelne Messpilot. Der Datensatz verschweigt diese Zusatzkosten und Abweichungen nicht. Es gibt keine Behauptung, der Versuch sei ohne Messstörung oder eine unveränderte Einzeldurchlauf-Latenzstudie gewesen. Das [eingefrorene Protokoll](../scripts/quality-phase1/PROTOCOL.md) erklärt die Regeln und Grenzen.

## Nachgewiesene Ursachen und offene Hypothesen

| Befund | Evidenz | Bewertung |
| --- | --- | --- |
| Konkurrierende Gesprächsentscheidungen | 01: Raumfrage erzeugt, wegen zuvor festgelegtem Fragenvertrag verworfen, frühes Formularangebot wiederhergestellt | Ursache im Ablauf belegt |
| Satzmuster sind keine verlässliche Erfolgsprüfung | 02/05/12/16/17: echte Statusbehauptungen passieren bei `not_prepared` | Ursache in Wahrheitsprüfung belegt |
| Nachformulierung kann Qualität verschlechtern | 03: korrekter Ersttext → „not not not“ im tatsächlichen Folgeaufruf | Entstehungsstufe belegt; Ursache innerhalb des Modells nicht isoliert |
| Statischer Gefahrentext verdrängt neue Information | 10: Modell erkennt Kind, sichtbarer Text bleibt gleich | Ursache im Sicherheitsablauf belegt |
| Unsicherheit verschwindet aus der Zusammenfassung | 19/2: tatsächlicher `uncertain`-Fakt wird durch unveränderte Mapping-/Summaryfunktionen zu uneingeschränkter „Anzahl: 2“ | durch zusätzliche reine Funktionsauswertung belegt; keine Portalübernahme getestet |
| Kurzer Prompt garantiert weder natürliche Sprache noch ehrliche Fähigkeiten | A: Formeln, Sprachfehler und Weiterleitungszusagen ohne lokale Dialoglogik | Ergebnis belegt; Modell-/Rollenpromptanteile offen |
| Komplett fehlender Modellstatus als alleinige Erklärung | B hat Fähigkeiten/Entwurfsstatus im Kontext, behauptet trotzdem Erledigung | als alleinige Erklärung widerlegt |
| Systemprompt priorisiert Entwürfe ausdrücklich über alles | Bestands-Prompt nennt Vorbereitung optional, erlaubt Antworten ohne Aktion und verbietet Kombination mit nötiger Rückfrage | durch Code nicht belegt; starke wiederholte Präsenz des Entwurfsthemas kann trotzdem beeinflussen |
| Aktuelle Frontendbuttons seien erneut mehrfach sichtbar oder Speicherklicks gingen verloren | in dieser Phase keine Browser-/Klickausführung | nicht durch diesen Vergleich nachgewiesen |

Normale Modellantworten werden im Frontend über `addBubble`/`textContent` angezeigt; es fügt ihnen keinen förmlichen Dank hinzu. Lokale Sicherheits-, Lade-, Fehler- und Speicherbestätigungstexte sind gesonderte Anwendungsbeiträge. Die vorhandenen lokalen Fallbackpfade existieren weiterhin, sind aber nicht pauschal als Herkunft sämtlicher beobachteter Höflichkeitsfloskeln zu behaupten.

## Konkrete technische Empfehlung zur Freigabe

Empfohlen wird eine begrenzte **Variante C mit einer verbindlichen Gesprächsentscheidung je Runde**, anschliessend derselbe kontrollierte Vergleich. Kein Portalumbau und kein weiterer Katalog fester Dialogantworten.

1. Das Modell trifft die nächste Gesprächsentscheidung einmal aus dem aktuellen Ziel, Verlauf, validierten Fakten und tatsächlichen Fähigkeiten. Seine natürliche Antwort bleibt zusammen mit typisierten Faktenänderungen und optionalen Aktionsvorschlägen prüfbar. Den Ablauf „vorläufige Antwort/Frage/Aktion → gesperrter Formulierungsauftrag → Rückfall auf vorläufigen Text“ ablösen. Eine hilfreiche offene Raumfrage darf nicht bloss wegen einer vorgelagerten Null-Metadatenentscheidung verworfen werden.
2. Bestehenden Faktenreducer, zentrale Portalzuordnung und serverseitige Aktionszulassung erhalten. Unsicherheitsstatus auch in Entwurfszusammenfassungen sichtbar machen; abgeleiteten Umfang nicht als gesicherte Anzahl ausgeben. Ausführung bleibt ausschliesslich Anwendungssache. Einen Angebotszustand erst nach der endgültig akzeptierten sichtbaren Antwort/Aktion festschreiben. Ein tatsächlich gespeicherter Entwurf braucht weiter einen Speicherbeleg mit Anliegen-ID und Revision; ein vorgeschlagener Button ist kein Ausführungsbeleg.
3. Erfolgs-/Zugriffs-/Rückmeldebehauptungen gegen explizite Fähigkeiten und tatsächliche Belege prüfen. Typisierte Aussagen über ausgeführte Vorgänge müssen ihre Beleg-ID nennen können; die Zuordnung muss auch den freien Text erfassen. Eine strukturierte Behauptung allein ist ebenso wenig Garantie wie ein Regex. Bei unbelegter Behauptung höchstens eine gezielte Reparatur ausführen; bei erneutem Fehler offen begrenzen, keinen erfundenen Erfolg anzeigen. Feste Belegtexte sind nur für wirklich bestätigte Speicher-/Übergabeereignisse sinnvoll, nicht als Gesprächsvorlagen.
4. Akute Sicherheitsregeln behalten, aber ihren sofortigen Schutzauftrag mit einer kontextbezogenen Fortsetzung verbinden. Neue Angaben wie ein Kind im Gefahrenbereich dürfen nicht durch einen erneut identischen Universalblock verschwinden. Keine Annahmen über schon erfolgte Abschaltung zulassen.
5. Die 20 Fälle und belegten Gegenbeispiele als Akzeptanzsatz übernehmen: keine falsche Speicherung/Weiterleitung/Rückmeldung, keine Ersetzung unsicherer Fakten, keine verlorene hilfreiche Frage; anschliessend getrennte echte Klick-/Speicher-/Aktualisierungstests für B/C. Schweizer Fachwissen für konkrete rechtliche/technische Aussagen auf freigegebene Quellen stützen. Falls Mercury in der vereinfachten C-Pipeline dieselben deutschen Sprachfehler behält, erst dann einen gesonderten, kostenbegrenzten Modellvergleich freigeben. Dieser Versuch belegt keine Überlegenheit eines ungetesteten Ersatzmodells.

Die Umsetzung soll auf `codex/mora-ai-2.0` bleiben und die bestehende Preview zunächst unangetastet lassen. Für diesen C-Prototyp sind keine Änderungen an Alexanders Portalbereichen erforderlich. Eine spätere echte Übermittlung benötigt separat eine serverseitige Schnittstelle mit idempotentem Anliegen-/Revisionsschlüssel, bestätigter Vorgangs-ID und eindeutigem Zustellstatus; sie gehört nicht zum hier geprüften Funktionsumfang.

**Freigabegegenstand:** begrenzten C-Prototyp der MORA-Gesprächssteuerung und Belegprüfung umsetzen, danach denselben eingefrorenen Satz plus echte Aktionsabläufe vergleichen. Noch keine Migration, kein Modellwechsel und keine Portaländerung sind umgesetzt.

## Reproduktion und Dateien

`scripts/quality-phase1/cases.json` enthält feste Kundennachrichten und Prüfziele. `server.js` und `prepare-bundle.py` erzeugen ausschliesslich den isolierten Testaufbau; die feste Testroute ist nicht in den normalen Produktbuild aufgenommen. `runner.py` führt echte Aufrufe aus und speichert sichere Prüfpunkte, `audit.py` liest echte Kosten nach. Eine neue Ausführung verbraucht Guthaben und braucht wieder eine vorherige Bilanzprüfung; das ist kein automatisch laufender Job.

Die reine Offlineauswertung lässt sich mit `python scripts/quality-phase1/analyze.py` und danach `python scripts/quality-phase1/report.py` wiederholen. Sie prüft Vollständigkeit, Reihenfolge, identische Kundentexte, Modell-/Quellstand und die dokumentierte Fall-09-Ersetzung. `node scripts/quality-phase1/inspect-mapping.mjs` reproduziert die zusätzliche reine Mappingkontrolle. Die Python-Dateien wurden kompiliert und die JavaScript-Dateien syntaktisch geprüft. Qualitative Noten bleiben ausdrücklich nachvollziehbare Bewertungsurteile.

- [Messwerte und Kosten je Fall](evidence/quality-phase1-measurements.json)
- [Vollständiger ursprünglicher Hauptlauf mit erzeugten Textfeldern/Prompts/Zuständen](evidence/quality-phase1-live.json)
- [Dokumentierte vollständige Messwiederholung von Fall 09](evidence/quality-phase1-retest-09.json)
- [Einzelbewertungen und kritische Befunde](evidence/quality-phase1-qualitative-review.json)
- [Quellhashes, Branchschutz und Isolation](evidence/quality-phase1-source-manifest.json)
- [Alle lesbaren Gespräche und ursprünglicher Fall-09-Anhang](MORA_PHASE1_TRANSCRIPTS.md)
'''
(root / 'docs/MORA_PHASE1_COMPARISON.md').write_text(report)
print(json.dumps({'report': 'docs/MORA_PHASE1_COMPARISON.md', 'characters': len(report),
                  'knownCostUsd': known_cost, 'accountUsedDeltaUsd': credit_used}))
