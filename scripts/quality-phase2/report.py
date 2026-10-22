"""Render the final report from completed, audited evidence and explicit qualitative notes."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];e=root/'docs/evidence'
read=lambda n:json.loads((e/n).read_text())
m=read('quality-phase2-measurements.json');live=read('quality-phase2-live.json');lat=read('quality-phase2-latency-analysis.json');review=read('quality-phase2-qualitative-review.json')
assert m['complete'] and m['rows']==52 and review['reviewComplete'] and all(c['observation'] for c in review['cases'])
c=m['C'];a=m['baselineA'];b=m['baselineB'];v=m['verification'];preview=read('quality-phase2-preview-check.json')
cost_records=live.get('costs',[])+read('quality-phase2-verification.json').get('costs',[])
for n in ['quality-phase2-main-cost-audit.json','quality-phase2-verification-cost-audit.json']:
 p=e/n
 if p.exists():cost_records+=json.loads(p.read_text()).get('costs',[])
probe=read('quality-phase2-streaming-probe.json')
for audit in probe.get('audits',[]):cost_records+=audit.get('costs',[])
known={r['id']:r['info'] for r in cost_records if 'info' in r}
owned={t['generationId'] for d in [live,read('quality-phase2-verification.json')] for r in d['rows'] for t in r['trace'] if t.get('generationId')}|{r['generationId'] for r in probe['rows'] if r.get('generationId')}
assert owned<=known.keys(),'Cost audit incomplete'
assert all(known[i]['model']=='inception/mercury-2.5' for i in owned)
total=sum(known[i]['totalCost'] for i in owned)
num=lambda n,d=3:f'{n:.{d}f}'.replace('.',',') if n is not None else 'nicht vollständig bestimmt'
sec=lambda n:num(n/1000,2)
usd=lambda n:num(n,8)
main_cost=c['totalGatewayCostUsd'];case_cost=main_cost/20 if main_cost is not None else None
notes={r['id']:r['observation'] for r in review['cases']}
case_table='\n'.join(f"| {r['id']} {r['topic']} | {r['C']['acceptedModelReplies']}/{r['C']['turns']} | {sec(r['C']['latencyServerExcludingCreditGuardMs']['median'])} s | {usd(r['C']['totalGatewayCostUsd'])} |" for r in m['cases'])
details='\n\n'.join(f"**{r['id']} · {r['topic']}:** {notes[r['id']]}" for r in m['cases'])
credits=live.get('finalCredits',{})
sample_rows=[r for r in lat['rows'] if r['caseId']=='01' and r['turn'] in [1,2]]
sample_table='\n'.join(f"| {r['message']} | {r['observedGenerations']} | {sec(r['observedGatewayHttpToHeadersMs'])} s | {sec(sum(r['reportedGatewayGenerationTimesMs']))} s | {sec(r['serverExcludingCreditObservationMs'])} s | {sec(r['testDriverCompleteMs'])} s |" for r in sample_rows)
residual=lat['aggregateMs']['backendOutsideRecordedSdkMs']
out=f'''# MORA AI 2.0 – serverseitiger A/B/C-Qualitätsvergleich

Stand: 22. Oktober 2026, Europe/Zurich. Ausschliesslich `codex/mora-ai-2.0`.

**Ergebnis: Die jetzige C-Konfiguration erhält keine Qualitätsfreigabe.** Alle 20 vorab festgelegten Fälle mit 52 Kundennachrichten wurden abgearbeitet. C lieferte {c['acceptedModelReplies']} akzeptierte echte Modellantworten; {c['applicationErrors']} Runden endeten mit einem Fehler. Nur {m['fullyAnsweredConversations']} von 20 Gesprächen wurden vollständig beantwortet. Zusätzlich wurden acht echte Prüfer-Gegenproben und vier echte Streaming-Probeaufrufe durchgeführt. Keine Mock-Antworten werden als Live-Erfolge ausgegeben.

Die ursprünglichen A/B-Läufe sind bereits abgeschlossen: 20 identische Gesprächspaare, 104 Kundenrunden. C verwendet jetzt denselben unveränderten Korpus. A/B und C wurden zu unterschiedlichen Zeitpunkten gemessen; dies ist keine zeitgleich randomisierte Dreiwege-Studie. Die beobachteten Unterschiede gelten für diese konkreten Konfigurationen und Zeitpunkte.

## Was A, B und „MORA C“ bedeuten

**Alle drei Varianten verwenden dasselbe Modell `inception/mercury-2.5` über denselben vorhandenen Vercel AI Gateway. C ist eine Architekturvariante, kein anderes Modell.**

| Variante | Gesprächssteuerung | Aktionen und Daten |
| --- | --- | --- |
| A | Kurzer professioneller Systemprompt; eine freie Modellantwort | Keine Schadensdialoge, Entwürfe oder Aktionsbuttons |
| B | Vollständige vorherige MORA; Gesprächsplan, Validierung und bedingt zusätzliche Formulierung/Reparatur | Vorhandener Faktenreducer und Aktionslogik |
| C | Eine gemeinsame Entscheidung für Antwort, neue Fakten, Frage und Vorschläge; danach ein ausschliesslich prüfender Modellaufruf; maximal eine Vertragsreparatur | Bestehender Faktenreducer, getrennte Anliegen und geprüfte lokale Speicherbelege |

C benötigt regulär zwei, mit Reparatur bis zu vier Aufrufe. **Eine Gesprächsentscheidung bedeutet nicht einen einzelnen Modellaufruf.** Bei C sind sowohl Entscheidung als auch Prüfung mit `reasoning=high` konfiguriert; Bs optionale Nachformulierung verwendet eine andere Konfiguration. Der Vergleich isoliert Architektur, Prompt und Reasoning nicht als einzelne Faktoren.

Quellen: A/B `bcd730adc9b5cd8ae52086c8f9db64be82e2a660`; C `393db0ba0fc4963a719a42dc171538ddf2784104`. Die neue Begrüssungs-/Messpreview `58f569d4f57127efe220ce866965c06d63dec9e2` hat dieselben nachweislich unveränderten C-KI- und Mappingmodule. Während des Hauptlaufs wurden keine Modellprompts, Kundenwörter oder produktiven Entscheidungsregeln optimiert. Fortsetzungen gingen stets zur nächsten festen Nachricht; fehlerhafte Runden wurden nicht für schönere Antworten wiederholt.

## Vergleich nach den acht Kriterien

Die ersten sechs A/B-Noten stammen aus der ursprünglichen begründeten KI-Bewertung auf 1–5, nicht aus einer unabhängigen Menschenstudie. Für C wird angesichts der fehlgeschlagenen Gesprächsrunden kein scheinbar gleichwertiger Mittelwert aus 20 vollständig beantworteten Gesprächen erfunden. Alle 20 Einzelfallbeobachtungen stehen unten.

| Kriterium | A | B | Belegter C-Befund |
| --- | --- | --- | --- |
| Natürlichkeit | 2,1/5 | 2,5/5 | Wiederholt förmliche Erfassungsberichte; kein belegter Gesamtgewinn |
| Gesprächsverständnis | 4,7/5 | 4,5/5 | Unter anderem Raumkorrektur, getrennte Anliegen und Kind-Hinweis tatsächlich verstanden; Antworten können danach verworfen werden |
| Kontexttreue | 4,2/5 | 4,0/5 | Erfolgreich bestätigte Fakten bleiben erhalten; neue Kundennachrichten aus Fehlrunden fehlen beim Fortsetzen im Serverkontext |
| Sinnvolle Rückfragen | 3,1/5 | 4,5/5 | Wiederholte Geräte-/Raumfragen nach solchen Ausfällen; einzelne sinnvolle Klärungsfragen |
| Wiederholungen | 2,4/5 | 2,8/5 | {c['formalThanksTurns']} akzeptierte Modelltexte mit förmlichem Dank; {c['administrativeConfirmationTurns']} mit Erfassungswörtern; Entwurfsangebote bleiben häufig |
| Fachliche Richtigkeit | 3,1/5 | 3,1/5 | Einige brauchbare Antworten zu Protokoll, Schimmel und Lärm; zu absolute Entwarnung bei Steckdose und sicherheitsrelevante Antwortausfälle verhindern eine Freigabe |
| Antwortdauer, Median Server ohne zusätzliche Mess-Guthabenabfrage | {sec(a['latencyServerExcludingCreditGuardMs']['median'])} s | {sec(b['latencyServerExcludingCreditGuardMs']['median'])} s | {sec(c['latencyServerExcludingCreditGuardMs']['median'])} s |
| Tatsächliche Gateway-Kosten je getestetem Fall, inklusive verworfener Generierungen | {usd(a['totalGatewayCostUsd']/20)} USD | {usd(b['totalGatewayCostUsd']/20)} USD | {usd(case_cost)} USD |

C: {c['generations']} beobachtete Modelltransporte für 52 Kundenrunden, {c['sdkStageAttempts']} SDK-Stufenversuche, {c['loggedCandidateRejections']} protokollierte Kandidatenabweisungen. Ein SDK-Versuch kann vor dem eigentlichen Modelltransport an einer zusätzlichen Metadatenabfrage scheitern; diese Zähler sind deshalb verschieden. Fehlergründe der Anwendung: `{json.dumps(c['errorReasons'],ensure_ascii=False)}`. Fehler und deren Latenz bleiben in der Auswertung; sie werden nicht als erfolgreiche Gespräche gezählt.

## Woher die mechanischen Formulierungen kommen

In C lautet die echte akzeptierte Antwort auf „wohnzimmer“ unter anderem:

> Vielen Dank. Ich habe es vermerkt, dass die Lampe im Wohnzimmer kaputt ist. Möchten Sie, dass ich einen Entwurf für die Meldung vorbereite?

Dieser Text stammt unverändert aus dem Modellfeld `reply`. Die Oberfläche setzt ihn mit `textContent` ein; sie fügt diesen Dank oder Erfassungsbericht nicht hinzu. C enthält für normale Kundenbeiträge keinen lokalen Schadensdialog und keinen zweiten Formulierungsauftrag. Der C-Prompt verlangt bereits kurze natürliche Antworten und untersagt routinemässigen Dank beziehungsweise Formularfokus. Auch A erzeugt mit kurzem Prompt und ohne MORA-Dialoglogik solche Muster. Damit ist „nur ein lokaler Standardsatz“ als Erklärung widerlegt.

In B sind hingegen die mehrstufige Gesprächsentscheidung und lokale Sicherheits-/Steuertexte beteiligt. Der Phase-1-Beleg zeigt, dass eine tatsächlich generierte Raumfrage durch den zuvor eingefrorenen Fragenvertrag verworfen wird. Quelle und Wirkung sind im [ursprünglichen Vergleich](MORA_PHASE1_COMPARISON.md) getrennt dokumentiert.

Plausibler, aber nicht einzeln isolierter Einfluss: C enthält trotz natürlicher Sprachvorgaben viel Entwurfs-, Schema- und Zustandskontext. Das kann den Modellfokus beeinflussen. Diese Hypothese ist kein Nachweis, dass eine weitere Promptumformulierung das Problem löst.

Feste Anwendungstexte bleiben bewusst bei Begrüssung, Ladehinweis, technischen Fehlern, Sicherheitshinweisen und tatsächlich belegten Speicherbestätigungen. Das sind keine simulierten Modellantworten.

## Nachgewiesene Fehlerursachen

**1. Gute Gesprächsinhalte werden mit unzulässigen Aktionen verworfen.** Im Kind-Fall erzeugt das Modell tatsächlich „Holen Sie das Kind bitte sofort aus dem Zimmer“. Es hängt jedoch eine in diesem Gefahrenzustand verbotene Entwurfsaktion an. Die Anwendung verwirft deshalb den gesamten Kandidaten. Nach dem konkreten Reparaturhinweis wiederholt das Modell die Entwurfsaktion; die API endet mit 503. Ein allgemeiner Anwendungshinweis bleibt vorhanden, die kontextbezogene Kind-Antwort erreicht den Kunden nicht. Das ist ein beobachtetes Zusammenspiel von Modellvertrag und Anwendungslogik, kein Beweis fehlenden Kind-Verständnisses.

**2. Fehlgeschlagene Eingaben fehlen beim Fortsetzen im Serververlauf.** Der Browser behält die Nachricht sichtbar beziehungsweise als ausstehenden Versuch. Der Server übernimmt aber ausschliesslich erfolgreich akzeptierte Runden in seine signierte Historie. Wenn der Kunde nach einer Fehlrunde mit der nächsten Nachricht fortfährt, erhält das Modell den ursprünglichen Text nicht erneut. Belegt unter anderem bei Heizung, Leerstand, Rollladen und Pfütze: anschliessende Fragen wiederholen bereits genannte Angaben. Zuvor bestätigte Fakten werden dabei nicht pauschal gelöscht; es fehlen die neuen, fehlgeschlagenen Eingaben.

**3. Der Ausgabe- und Fragenvertrag ist fehleranfällig.** Das Modell liefert nach Reparaturen unter anderem ein Schemaobjekt statt eines Datenobjekts, `activeIssueRef:null` statt des erlaubten Weglassens oder ein falsches Prüferformat. Auch erneute Vorbereitungsangebote nach einem früheren Angebot lösen die Abweisung einer ganzen Runde aus. Unbekannte Werte dürfen weiterhin nicht erfunden werden; harmlose optionale Leerwerte und tatsächlich unzulässige Aktionen brauchen jedoch eine präzise getrennte Behandlung.

**4. Die semantische Prüfung ist selbst unzuverlässig.** Acht feste Gegenproben mit echten früheren Modelltexten: {v['correct']}/8 korrekt behandelt. Drei liefern kein gültiges Prüferobjekt. Eine erlaubte Aufforderung, MORADA zu kontaktieren, wird fälschlich als nicht verfügbare spätere Kontaktaufnahme abgewiesen. Hier verwechselt der Prüfer eine Handlung des Kunden mit einer von MORA ausgelösten Rückmeldung. Diese kleine gezielte Stichprobe ist keine allgemeine Genauigkeitsquote, widerlegt aber eine behauptete Prüfergarantie. Die ungültigen Prüfausgaben enden am Tokenlimit; hohes Reasoning beansprucht einen grossen Teil des Ausgabebudgets.

Auch eine nicht ausreichend belegte Aussage passiert den Prüfer: In 02/2 sagt C „Gut zu wissen, dass keine akute Gefahr besteht.“ Der Kunde hatte nur Rauch, Funken und Brandgeruch verneint. Das ist eine zu weitgehende Entwarnung. Der Prüfer liefert dort eine leere Verstossliste. Korrekte Ablehnungen einzelner falscher Versand-/Kontaktzusagen belegen deshalb keine durchgehende semantische Sicherheit.

**5. Einzelne technische Fehler sind nicht eindeutig dem Modell zuzuordnen.** Zusätzliche beobachtende Guthaben-/Metadatenabfragen können vor einem weiteren Modelltransport scheitern. Solche HTTP-500-Fälle und ein zusätzlicher Guard-Stopp bleiben erhalten. Vor der Fortsetzung nach diesem Stopp wurde das vorhandene Gratisguthaben erneut erfolgreich gelesen; weder Grenze noch Einstellungen wurden gelockert. Die genaue fehlschlagende Teilanfrage ist nicht in jedem Fall beobachtet. Diese Fälle werden als Einschränkung der Messinfrastruktur gekennzeichnet.

Weitere Quellbefunde: Der Frontend-Fehlerpfad kann selbst einen Vorbereitungsbutton erzeugen, obwohl die gemeinsame Backend-Policy ihn im aktuellen Zustand ablehnt. Das ist ein prüfbarer Quellpfad, keine behauptete ausgeführte Portalübergabe dieses Tests. Ausserdem kann die Normalisierung von `Lampe` zu `light` intern als `corrected` erscheinen, obwohl der Kunde nichts korrigiert hat; semantische Kundenkorrektur und Kanonisierung sollten dort getrennt werden.

## Antwortgeschwindigkeit und Streaming

| Ebene | Was tatsächlich gemessen wurde | Grenze |
| --- | --- | --- |
| Gateway | Beobachteter HTTP-Aufruf bis zu den Antwortheaders je Modelltransport | Enthält Gateway, Provider/Modell und Netzwerk; reine Gateway-Innenzeit nicht getrennt messbar |
| Modell-/Generierungszeit | Tatsächlich gelieferte Generation-Lookup-Felder `generationTime` und `latency` je Generierungs-ID | Berichtete Servicezeiten, kein direktes GPU-Profil |
| Backend | Gesamte Handlerzeit; zusätzliche Guthabenabfragen separat; Restzeit ausserhalb vollständig protokollierter SDK-Stufen | Start vor dem Handler, Coldstarts, Netzwerk und Auth-Vorlauf bleiben im unaufgelösten Anteil |
| Frontend | Neue lokale Messpunkte für Requeststart, Headers, JSON-Bereitschaft, Antwort-DOM und Abschluss der lokalen UI | Keine reale Browsermessung freigegeben; keine erfundenen Renderzeiten |
| Erste sichtbare Antwort | Bestehender Chat rendert den Antworttext erst nach vollständigem JSON und Validierung | Ladehinweis ist keine inhaltliche Antwort; tatsächliche Bildschirmzeit offen |
| Vollständige sichtbare Antwort | Kein Textstreaming im Kundenchat; vollständiger Text wird gemeinsam eingesetzt | DOM-/Frame-Messpunkte sind eine Näherung, keine Pixel-Paint-Garantie |

Der C-HTTP-Testtreiber benötigt im Median {sec(c['latencyWallMs']['median'])} s bis zum vollständigen Ergebnis. Auf dem Server sind es inklusive Zusatzbeobachtung {sec(c['latencyServerMs']['median'])} s, ohne deren Guthabenabfragen {sec(c['latencyServerExcludingCreditGuardMs']['median'])} s; das 95. Perzentil der bereinigten Serverzeit liegt bei {sec(c['latencyServerExcludingCreditGuardMs']['p95'])} s. Der zusätzliche Vorlauf des Cloud-HTTP-Treibers wird ausdrücklich nicht als Frontend-Verarbeitung oder Browserwartezeit etikettiert. Gratislimit-Pausen zwischen Anfragen zählen nicht zu diesen Dauern.

Die beiden ausdrücklich gewünschten einfachen Nachrichten:

| Nachricht | Modelltransporte | Summe Gateway-HTTP bis Headers | Summe berichteter Generierungszeiten | Server ohne Zusatz-Guthabenabfrage | Vollständiger HTTP-Testaufruf |
| --- | ---: | ---: | ---: | ---: | ---: |
{sample_table}

Diese Spannen überlappen sich und dürfen nicht addiert werden. Bei {residual['n']} Runden sind alle SDK-Stufen zeitlich protokolliert; der Rest innerhalb des Handlers ausserhalb dieser Stufen beträgt im Median {num(residual['median'],1)} ms. Das ist keine Messung des Coldstarts vor Handlerbeginn. Die langen Antwortzeiten entstehen in diesen beobachteten Runden vor allem während der SDK-/Gateway-/Modellstufen. Insgesamt wurden für C {c['reasoningTokens']} Reasoningtokens und {c['visibleOutputTokens']} vom Provider als Text klassifizierte Ausgabetokens gemeldet, einschliesslich Prüfertexten und abgewiesenen Kandidaten. Das sind nicht ausschliesslich die angezeigten Kundensätze. Hohes Reasoning ist auch bei einfachen Nachträgen aktiv. Ein niedrigerer Wert ist als kontrollierte Folgevariante zu prüfen.

Das vorhandene C-API-Feld `timingMs.model` bezeichnet bei Modellrunden bislang die gesamte Handlerzeit. Es ist keine saubere reine Modelllatenz und wurde hier nicht dafür verwendet. Die vollständige Trennung der beobachtbaren Spannen steht im [Latenznachweis](evidence/quality-phase2-latency-analysis.json).

Vier isolierte echte Probeaufrufe vergleichen gepufferte und gestreamte Ausgabe mit demselben kurzen A-Prompt, `reasoning=high` und denselben beiden Kundennachrichten. In den zwei gestreamten Antworten erscheint der erste Text serverseitig erst ungefähr 3–6 ms vor Ende der Generierung, jeweils in zwei Blöcken. **Ein deutlich früherer Textbeginn ist in diesen beiden Proben nicht nachgewiesen.** Die Stichprobe erlaubt keine allgemeine Aussage, dass Streaming grundsätzlich nichts bringt; verschiedene echte Antworten und unterschiedlicher Reasoningaufwand verhindern einen kausalen Vergleich ihrer Gesamtdauern.

Der erste SSE-Clientparser verarbeitete Ereignistrenner falsch. Seine First-Text-/Chunk-Zähler sind deshalb explizit ungültig; unabhängige Serverzeiten, SDK-Metadaten, vollständige Modelltexte, IDs und Gesamtdauern bleiben erhalten. Der Treiber wurde korrigiert, ohne neue schönere Antworten zu erzeugen. Ungeprüfte C-Kandidaten vor Ende der Wahrheitsprüfung an Kunden zu streamen würde zudem die bisherige Validierungsgrenze verändern. Im Kundenchat wurde deshalb kein Streaming-Umbau durchgeführt.

## Begrüssung und neue Preview

Die Begrüssung lautet jetzt:

> Guten Tag! Ich bin MORA, Ihre digitale Assistenz bei MORADA. Wie kann ich Ihnen heute helfen?

Sie ist rollenunabhängig und per tatsächlich ausgelieferter HTTP-Seite geprüft. Eine echte nicht generierende Kontrollaktion antwortet erfolgreich mit `simple_v1` und null Modellaufrufen. Keine eigenen Kundenrollen, Berechtigungsmodelle oder Portalansichten wurden eingeführt. Die Begrüssung allein verändert nicht die später vom Modell erzeugten Dankesformulierungen.

[Neue MORA-C-Preview mit neutraler Begrüssung und lokalen Messpunkten]({preview['url']}) — Vercel `READY`, reine Preview, keine Aliase, Produktquelle `58f569d`.

Die automatische Freigabeprüfung blockierte den Browserzugriff, weil die geschützte Preview zur privaten Vercel-Kontooberfläche weiterleitet. Diese Grenze wurde nicht umgangen. Die sicherere HTTP-Quell-/Kontrollprüfung ist kein Browser-Paint- oder Speicher-Ende-zu-Ende-Nachweis. Für diese noch offenen Browsermessungen ist eine gesonderte Freigabe des betreffenden Vercel-Zugriffs nötig.

## Alle 20 C-Fälle

Kosten in USD einschliesslich abgewiesener Generierungen. Dauer: Median der Serverrunden ohne zusätzliche Mess-Guthabenabfrage. Eine vollständig abgearbeitete Testfolge bedeutet nicht vollständig erfolgreiche Antworten.

| Fall | Akzeptierte echte Modellantworten | Median | Tatsächliche Fallkosten |
| --- | ---: | ---: | ---: |
{case_table}

{details}

## Mapping, Speicherumfang und technische Empfehlung

Die rein lesende Projektion der tatsächlich akzeptierten C-Fakten durch `mapServiceDraft` stimmt für Einrichtung, Kategorie, Defekt, Anzahl, Bereich, Beginn, Umfang und weitere Felder überein. Sie bewahrt getrennte Anliegen-IDs und Unsicherheitsmetadaten. Das behebt keine vorgelagert verworfenen Kundeneingaben. Der Nachweis behauptet weder einen geschriebenen Entwurf noch eine Portalübernahme.

Die App bleibt Dianas bisherige separate Test-App. Alexanders echtes responsives HTML-Portal und seine Integrationen wurden nicht bearbeitet und sind nicht angebunden. Eine lokale IndexedDB-Bestätigung bedeutet ausschliesslich Speicherung auf diesem Gerät und dieser Test-App-Origin. Sie ist weder eine Übernahme in Alexanders Portal noch eine Übermittlung an MORADA. Die spätere authentifizierte Speicher-/Übermittlungsschnittstelle ist in [MORA_SIMPLE_INTEGRATION.md](MORA_SIMPLE_INTEGRATION.md) spezifiziert.

**Empfehlung zur Freigabe: zuerst eine begrenzte Korrektur der Eingabe- und Validierungsgrenzen, danach ein gezielter Konfigurations-/Modellvergleich.**

1. Jede eingegangene Kundenäusserung in einem getrennten, signierten Rohtextjournal behalten, auch wenn Fakten/Antwort scheitern. Abgelehnte Fakten bleiben unbestätigt; das Modell erhält beim Fortsetzen trotzdem die ursprünglichen Kundenwörter. API und Frontend müssen diesen Fehlerstatus gemeinsam übernehmen, ohne Erfolg zu behaupten.
2. Verfügbare Aktionen aus einer gemeinsamen Policy beziehen, einschliesslich Frontend-Fehlerpfad. Eine nicht ausgeführte unzulässige Aktion soll unabhängig behandelt werden können, wenn Antwort und Fakten sonst nachweislich gültig sind. Aussagen über Speicherung/Versand bleiben strikt an echte Belege gebunden. Das darf keine ungeprüfte Ausgabe oder zusätzliche starre Dialogvorlage einführen.
3. Den Ausgabeauftrag vereinfachen, optionale Leerwerte semantisch eindeutig normalisieren und native Schemaunterstützung über den vorhandenen Gateway ausdrücklich verifizieren. Für den Prüfer Akteur und Richtung einer Aktion eindeutig benennen. Ein Kundenkontakt ist keine von MORA versprochene Rückmeldung. Ein ungültiges Prüferformat darf weiterhin nicht als bestandene Prüfung gelten.
4. Im nächsten isolierten Test `reasoning=low` gegen die jetzige hohe Einstellung prüfen und ein verifiziert verfügbares weiteres Modell unter demselben Vertrag vergleichen. Der aktuelle Lauf belegt keinen Vorteil eines noch nicht getesteten Modells. Weniger Reasoning oder andere Modelle sind zu prüfende Hypothesen, keine versprochenen Qualitätsgewinne. Die belegte Rohtextlücke muss unabhängig von der Modellwahl geschlossen werden.
5. Streaming erst nach einer validen Trennung zwischen freigabefähigem Text und bestätigten Effekten beurteilen. Vorher die noch fehlende reale Browsermessung mit den bereitgestellten Zeitmarken abschliessen. Die beobachteten 2–4 seriellen Aufrufe und Reparaturen sind der deutlichere aktuelle Ansatzpunkt.

Dieser Folgeumbau ist in diesem Auftrag **nicht implementiert**. Geändert wurden die ausdrücklich gewünschte MORA-Begrüssung, lokale beobachtende Zeitmarken und isolierte Test-/Auswertungsskripte.

## Kosten, Prüfungen und Grenzen

Der C-Hauptlauf kostet für die beobachteten Generierungen {usd(main_cost)} USD. Alle neuen eigenen empfangenen IDs aus Hauptlauf, acht Gegenproben und vier Streaming-Proben zusammen: **{usd(total)} USD**. Die letzte gelesene Bilanz des Hauptlaufs weist {usd(credits.get('balanceUsd'))} USD vorhandenes Restguthaben aus. Spätere oder fremde Kontonutzung ist mit der Summe eigener IDs nicht gleichzusetzen. Der unveränderte Höchstrahmen beträgt 0,50 USD seit dem dokumentierten früheren Startverbrauch; keine neue Zahlung, kein neuer Schlüssel und keine Tarif-/Aufladeänderung.

298 automatisierte Tests bestehen, ebenso Typprüfung und Build. SDK-/IndexedDB-/Oberflächenmodultests verwenden gekennzeichnete Fixtures; sie sind keine echten Mercury-Gespräche. Der Liveplan ist komplett abgearbeitet, sein Qualitätsziel mit 52 akzeptierten Antworten jedoch verfehlt. Echte Browser-Paint-Zeiten und eine vollständige Browserkette bis zum gespeicherten/aktualisierten Entwurf bleiben offen. Ein serverseitiger Versand und Alexanders Portal sind nicht Bestandteil der Testversion.

`main` bleibt `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` bleibt `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Kein Merge und kein Produktionsdeployment. Die frühere Kunden-Preview bleibt unverändert.

Quellen/Nachweise: [Rohdaten](evidence/quality-phase2-live.json), [vollständige tatsächliche C-Protokolle](MORA_PHASE2_TRANSCRIPTS.md), [Messwerte](evidence/quality-phase2-measurements.json), [Prüfergegenproben](evidence/quality-phase2-verification.json), [Streaming-Proben mit expliziter Messgrenze](evidence/quality-phase2-streaming-probe.json), [Mappingkontrolle](evidence/quality-phase2-mapping-inspection.json), [Qualitative Fallnotizen](evidence/quality-phase2-qualitative-review.json), [HTTP-Previewprüfung](evidence/quality-phase2-preview-check.json), [Prüfplan](../scripts/quality-phase2/PROTOCOL.md).

Primärdokumentation: [AI SDK Text/Streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-text), [Vercel Generation Lookup](https://vercel.com/docs/ai-gateway/observability-and-spend/usage), [Inception Reasoning-Einstellungen](https://docs.inceptionlabs.ai/capabilities/reasoning-efforts). Die aktuelle [Inception-Modellübersicht](https://www.inceptionlabs.ai/models) kündigt für bestimmte bestehende Mercury-2.5-Zugänge Zugang bis 15. November 2026 an, mit gesonderten Enterprise-Regeln. Ein konkretes Ende für diesen Gateway-Zugang wurde nicht separat bestätigt; im Test war 2.5 weiterhin verfügbar. Langfristige Modellwahl braucht deshalb auch eine Verfügbarkeitsprüfung. Es wurde kein automatischer Modellwechsel vorgenommen.

Die fachlichen Fallnotizen berücksichtigen unter anderem die offiziellen Informationen des [BAG zu Feuchtigkeit und Schimmel](https://www.bag.admin.ch/de/feuchtigkeitsprobleme-und-schimmel) und der [Zürcher Gerichte zur Mietzinshinterlegung](https://www.gerichte-zh.ch/de/themen/miete/rechte-und-pflichten/maengel-der-mietsache/hinterlegung). Dies sind Prüfmassstäbe für die synthetischen Fälle, keine individuelle Rechts- oder Finanzberatung.
'''
(root/'docs/MORA_PHASE2_REPORT.md').write_text(out)
print(json.dumps({'reportWritten':True,'mainRows':m['rows'],'acceptedReplies':c['acceptedModelReplies'],'allNewKnownGenerationCostUsd':total,'comparisonQualityApproved':False}))
