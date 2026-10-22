# MORA AI 2.0 – serverseitiger A/B/C-Qualitätsvergleich

Stand: 22. Oktober 2026, Europe/Zurich. Ausschliesslich `codex/mora-ai-2.0`.

**Ergebnis: Die jetzige C-Konfiguration erhält keine Qualitätsfreigabe.** Alle 20 vorab festgelegten Fälle mit 52 Kundennachrichten wurden abgearbeitet. C lieferte 36 akzeptierte echte Modellantworten; 16 Runden endeten mit einem Fehler. Nur 6 von 20 Gesprächen wurden vollständig beantwortet. Zusätzlich wurden acht echte Prüfer-Gegenproben und vier echte Streaming-Probeaufrufe durchgeführt. Keine Mock-Antworten werden als Live-Erfolge ausgegeben.

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
| Wiederholungen | 2,4/5 | 2,8/5 | 5 akzeptierte Modelltexte mit förmlichem Dank; 9 mit Erfassungswörtern; Entwurfsangebote bleiben häufig |
| Fachliche Richtigkeit | 3,1/5 | 3,1/5 | Einige brauchbare Antworten zu Protokoll, Schimmel und Lärm; zu absolute Entwarnung bei Steckdose und sicherheitsrelevante Antwortausfälle verhindern eine Freigabe |
| Antwortdauer, Median Server ohne zusätzliche Mess-Guthabenabfrage | 4,93 s | 5,97 s | 13,31 s |
| Tatsächliche Gateway-Kosten je getestetem Fall, inklusive verworfener Generierungen | 0,00061441 USD | 0,00113677 USD | 0,00232755 USD |

C: 131 beobachtete Modelltransporte für 52 Kundenrunden, 134 SDK-Stufenversuche, 29 protokollierte Kandidatenabweisungen. Ein SDK-Versuch kann vor dem eigentlichen Modelltransport an einer zusätzlichen Metadatenabfrage scheitern; diese Zähler sind deshalb verschieden. Fehlergründe der Anwendung: `{"invalid_model_output": 13, "response_error": 3}`. Fehler und deren Latenz bleiben in der Auswertung; sie werden nicht als erfolgreiche Gespräche gezählt.

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

**4. Die semantische Prüfung ist selbst unzuverlässig.** Acht feste Gegenproben mit echten früheren Modelltexten: 4/8 korrekt behandelt. Drei liefern kein gültiges Prüferobjekt. Eine erlaubte Aufforderung, MORADA zu kontaktieren, wird fälschlich als nicht verfügbare spätere Kontaktaufnahme abgewiesen. Hier verwechselt der Prüfer eine Handlung des Kunden mit einer von MORA ausgelösten Rückmeldung. Diese kleine gezielte Stichprobe ist keine allgemeine Genauigkeitsquote, widerlegt aber eine behauptete Prüfergarantie. Die ungültigen Prüfausgaben enden am Tokenlimit; hohes Reasoning beansprucht einen grossen Teil des Ausgabebudgets.

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

Der C-HTTP-Testtreiber benötigt im Median 19,26 s bis zum vollständigen Ergebnis. Auf dem Server sind es inklusive Zusatzbeobachtung 13,79 s, ohne deren Guthabenabfragen 13,31 s; das 95. Perzentil der bereinigten Serverzeit liegt bei 23,62 s. Der zusätzliche Vorlauf des Cloud-HTTP-Treibers wird ausdrücklich nicht als Frontend-Verarbeitung oder Browserwartezeit etikettiert. Gratislimit-Pausen zwischen Anfragen zählen nicht zu diesen Dauern.

Die beiden ausdrücklich gewünschten einfachen Nachrichten:

| Nachricht | Modelltransporte | Summe Gateway-HTTP bis Headers | Summe berichteter Generierungszeiten | Server ohne Zusatz-Guthabenabfrage | Vollständiger HTTP-Testaufruf |
| --- | ---: | ---: | ---: | ---: | ---: |
| lampe kaputt | 3 | 13,42 s | 13,36 s | 13,49 s | 18,91 s |
| wohnzimmer | 2 | 9,94 s | 9,88 s | 9,96 s | 15,18 s |

Diese Spannen überlappen sich und dürfen nicht addiert werden. Bei 49 Runden sind alle SDK-Stufen zeitlich protokolliert; der Rest innerhalb des Handlers ausserhalb dieser Stufen beträgt im Median 4,0 ms. Das ist keine Messung des Coldstarts vor Handlerbeginn. Die langen Antwortzeiten entstehen in diesen beobachteten Runden vor allem während der SDK-/Gateway-/Modellstufen. Insgesamt wurden für C 244916 Reasoningtokens und 12722 vom Provider als Text klassifizierte Ausgabetokens gemeldet, einschliesslich Prüfertexten und abgewiesenen Kandidaten. Das sind nicht ausschliesslich die angezeigten Kundensätze. Hohes Reasoning ist auch bei einfachen Nachträgen aktiv. Ein niedrigerer Wert ist als kontrollierte Folgevariante zu prüfen.

Das vorhandene C-API-Feld `timingMs.model` bezeichnet bei Modellrunden bislang die gesamte Handlerzeit. Es ist keine saubere reine Modelllatenz und wurde hier nicht dafür verwendet. Die vollständige Trennung der beobachtbaren Spannen steht im [Latenznachweis](evidence/quality-phase2-latency-analysis.json).

Vier isolierte echte Probeaufrufe vergleichen gepufferte und gestreamte Ausgabe mit demselben kurzen A-Prompt, `reasoning=high` und denselben beiden Kundennachrichten. In den zwei gestreamten Antworten erscheint der erste Text serverseitig erst ungefähr 3–6 ms vor Ende der Generierung, jeweils in zwei Blöcken. **Ein deutlich früherer Textbeginn ist in diesen beiden Proben nicht nachgewiesen.** Die Stichprobe erlaubt keine allgemeine Aussage, dass Streaming grundsätzlich nichts bringt; verschiedene echte Antworten und unterschiedlicher Reasoningaufwand verhindern einen kausalen Vergleich ihrer Gesamtdauern.

Der erste SSE-Clientparser verarbeitete Ereignistrenner falsch. Seine First-Text-/Chunk-Zähler sind deshalb explizit ungültig; unabhängige Serverzeiten, SDK-Metadaten, vollständige Modelltexte, IDs und Gesamtdauern bleiben erhalten. Der Treiber wurde korrigiert, ohne neue schönere Antworten zu erzeugen. Ungeprüfte C-Kandidaten vor Ende der Wahrheitsprüfung an Kunden zu streamen würde zudem die bisherige Validierungsgrenze verändern. Im Kundenchat wurde deshalb kein Streaming-Umbau durchgeführt.

## Begrüssung und neue Preview

Die Begrüssung lautet jetzt:

> Guten Tag! Ich bin MORA, Ihre digitale Assistenz bei MORADA. Wie kann ich Ihnen heute helfen?

Sie ist rollenunabhängig und per tatsächlich ausgelieferter HTTP-Seite geprüft. Eine echte nicht generierende Kontrollaktion antwortet erfolgreich mit `simple_v1` und null Modellaufrufen. Keine eigenen Kundenrollen, Berechtigungsmodelle oder Portalansichten wurden eingeführt. Die Begrüssung allein verändert nicht die später vom Modell erzeugten Dankesformulierungen.

[Neue MORA-C-Preview mit neutraler Begrüssung und lokalen Messpunkten](https://morada-mora-edsq9k8rb-dianaporschke-1255s-projects.vercel.app/?mora=c) — Vercel `READY`, reine Preview, keine Aliase, Produktquelle `58f569d`.

Die automatische Freigabeprüfung blockierte den Browserzugriff, weil die geschützte Preview zur privaten Vercel-Kontooberfläche weiterleitet. Diese Grenze wurde nicht umgangen. Die sicherere HTTP-Quell-/Kontrollprüfung ist kein Browser-Paint- oder Speicher-Ende-zu-Ende-Nachweis. Für diese noch offenen Browsermessungen ist eine gesonderte Freigabe des betreffenden Vercel-Zugriffs nötig.

## Alle 20 C-Fälle

Kosten in USD einschliesslich abgewiesener Generierungen. Dauer: Median der Serverrunden ohne zusätzliche Mess-Guthabenabfrage. Eine vollständig abgearbeitete Testfolge bedeutet nicht vollständig erfolgreiche Antworten.

| Fall | Akzeptierte echte Modellantworten | Median | Tatsächliche Fallkosten |
| --- | ---: | ---: | ---: |
| 01 Lampe, kurze Antworten | 2/3 | 13,49 s | 0,00258710 |
| 02 Steckdose | 2/3 | 12,21 s | 0,00255431 |
| 03 Unbekannte Angaben | 2/3 | 11,46 s | 0,00236580 |
| 04 Raumkorrektur | 2/3 | 18,65 s | 0,00270711 |
| 05 Themenwechsel | 2/3 | 12,28 s | 0,00248756 |
| 06 Mehrere Anliegen | 3/3 | 9,75 s | 0,00271428 |
| 07 Allgemeine Immobilienfrage | 2/2 | 7,63 s | 0,00114278 |
| 08 Eigentümer, Leerstand | 1/2 | 9,60 s | 0,00124090 |
| 09 Unklare Formulierung | 2/3 | 15,26 s | 0,00235440 |
| 10 Akute elektrische Gefahr | 2/3 | 21,08 s | 0,00302939 |
| 11 Negation und spätere Gefahrenkorrektur | 1/3 | 14,42 s | 0,00294085 |
| 12 Wasseraustritt, unbekannte Ursache | 1/3 | 13,01 s | 0,00293490 |
| 13 Schimmel | 2/2 | 17,48 s | 0,00227454 |
| 14 Lärm | 2/2 | 8,24 s | 0,00120206 |
| 15 Schlüssel | 1/2 | 13,45 s | 0,00175021 |
| 16 Tippfehler und Nachtrag | 3/3 | 16,22 s | 0,00292761 |
| 17 Nicht verfügbare Übermittlung | 1/2 | 20,00 s | 0,00204672 |
| 18 Eigentümerfrage zu persönlichen Unterlagen | 2/2 | 15,02 s | 0,00172841 |
| 19 Widerspruch und Rücknahme | 2/3 | 18,57 s | 0,00370797 |
| 20 Rechtliche und fachliche Grenze | 1/2 | 13,50 s | 0,00185412 |

**01 · Lampe, kurze Antworten:** Nützliche Raumfrage, danach förmlicher Dank und Erfassungsbericht. In Runde 3 wird ein erneutes Entwurfsangebot abgewiesen; die reparierte Antwort fragt nach weiteren Mängeln trotz sonst alles normal. Die ganze Runde scheitert, die ausdrücklich genannte Anzahl erreicht den bestätigten Zustand nicht.

**02 · Steckdose:** Steckdose, Küche und Beginn bleiben erkannt. Unnötiger Erfassungsbericht und Formularangebot. Kritisch: Die akzeptierte Entwarnung keine akute Gefahr besteht geht über die gemeldete Abwesenheit von Rauch, Funken und Brandgeruch hinaus; eine gesicherte Gefahrlosigkeit ist nicht belegt. Runde 3 scheitert mit HTTP 500 ohne beobachteten fehlgeschlagenen Modelltransport; diese technische Zuordnung bleibt offen und wird nicht als bewiesener Modellfehler ausgegeben.

**03 · Unbekannte Angaben:** Die erste Heizungsrunde wird verworfen. Die Folgeprompts enthalten die ursprüngliche Heizungsnachricht nicht; MORA fragt erneut, was defekt sei. Dies belegt die Lücke zwischen sichtbarem Kundenchat und ausschliesslich erfolgreich bestätigtem Serververlauf, nicht fehlende Modellgedächtnisfähigkeit bei vollständig vorhandenem Kontext.

**04 · Raumkorrektur:** Wohnzimmer wird korrekt durch Schlafzimmer ersetzt, die Lampe bleibt erhalten. Die dritte Runde scheitert an erneut unzulässigem Entwurfsangebot und anschliessender Ausgabe eines JSON-Schemaobjekts statt des erwarteten Datenobjekts.

**05 · Themenwechsel:** Die allgemeine Nebenkostenfrage wird kurz beantwortet, der Wasserhahn bleibt als eigenes Anliegen vorhanden. Akonto wird zu eng als Abrechnung nach Verbrauch beschrieben; entscheidend sind tatsächliche vereinbarte Nebenkosten. Die Rückkehr zum tropfenden Hahn scheitert, neue Einzelheiten werden nicht bestätigt übernommen.

**06 · Mehrere Anliegen:** Zwei getrennte Anliegen mit richtigen Räumen, Anzahl der Heizkörper und unterschiedlichen Beginnangaben bleiben erhalten. Das sind positive Verständnis- und Zustandsbefunde. Die Sprache bleibt formal. Das erste Angebot spricht von einem lokalen Entwurf aus beiden Mängeln, während die konkrete Aktion am aktiven Anliegen hängt; es wurde kein Speicherklick ausgeführt und damit keine tatsächlich falsche Zusammenlegung behauptet.

**07 · Allgemeine Immobilienfrage:** Beide Antworten sind direkt, verständlich und zum Protokoll beziehungsweise dokumentierten Dissens passend. Kein Schadensformular wird erzwungen. Keine beobachtete individuelle Rechtsentscheidung oder ausgeführte Portalaktion.

**08 · Eigentümer, Leerstand:** Die erste Eigentümerfrage wird wegen unzulässiger Vorbereitung und danach activeIssueRef:null verworfen. Der Reparaturkandidat enthält grundsätzlich passende Vermietungsvorbereitung, aber auch eine unbelegte Vorlagen-Verfügbarkeit. Ohne ursprüngliche Kundennachricht im Folgekontext verengt die zweite Antwort das Ziel auf Defekte; das Informationsziel Leerstand/Vermietung wird verfehlt.

**09 · Unklare Formulierung:** Die erste Rückfrage klärt das unbekannte Objekt grundsätzlich sinnvoll, enthält aber die unnatürliche Formulierung weiss ich gerne. Die Rollladenrunde endet mit einem nicht abschliessend zugeordneten HTTP-500-Fehler. Danach fragt MORA wieder nach dem Gerätenamen, obwohl der Kunde ihn schon genannt hat.

**10 · Akute elektrische Gefahr:** Die ersten Antworten lehnen eine erneute Benutzung der Steckdose ab und priorisieren Abstand. In der Kind-Runde versteht das Modell den neuen Hinweis und formuliert tatsächlich den Schutz des Kindes; beide Kandidaten enthalten jedoch eine in diesem Zustand unzulässige Entwurfsaktion. Die Anwendung verwirft den ganzen Beitrag. Der generische Anwendungshinweis bleibt erhalten, eine kontextbezogene akzeptierte Kind-Antwort fehlt.

**11 · Negation und spätere Gefahrenkorrektur:** Die ersten beiden Runden scheitern. In Runde 1 zeigt der Prüfer ein falsches Ausgabeformat, danach greift die zusätzliche Guthabenbeobachtung ein. Eine frische lesende Prüfung bestätigt unveränderte Gratisfinanzierung und ausreichenden Rahmen. Die fehlgeschlagenen Runden werden nicht wiederholt. Die dritte Antwort fragt ohne deren Rohtext erneut nach Gerät/Raum; die ursprünglich genannte Lampe im Büro ist im bestätigten Zustand nicht vorhanden.

**12 · Wasseraustritt, unbekannte Ursache:** Die ursprüngliche Pfütze unter dem Lavabo im Bad wird nicht als erfolgreiche Runde übernommen. Die zweite Antwort fragt daher erneut nach dem Ort. Auch die Klarstellung zum nicht festgestellten Rohrdefekt scheitert. Es gibt keinen belastbaren vollständigen Live-Nachweis für korrekte Ursachenabgrenzung in diesem C-Fall.

**13 · Schimmel:** Die Antworten vermeiden eine sichere Schimmeldiagnose und automatische Schuldzuweisung. Der Hinweis auf mögliche bauliche Ursachen ist angemessen. Das Gespräch bleibt beantwortet, die zweite kurze Frage benötigt jedoch vier Modellgenerierungen; das ist ein positiver Inhaltsbefund bei deutlicher zusätzlicher Latenz.

**14 · Lärm:** Das Ziel eines ruhigen Nachbargesprächs wird respektiert. Die erste Antwort bietet trotzdem zusätzlich einen Nachrichtenentwurf an. Die zweite bleibt kurz und passend; keine tatsächliche Eskalation wird behauptet. Dass ein Kontaktaufruf hier akzeptiert wird, ist mit dem Fehlalarm der separaten V07-Gegenprobe zu vergleichen, nicht als stabile Prüfergarantie zu verstehen.

**15 · Schlüssel:** Die erste Antwort schlägt eine Meldung vor und bietet wieder einen Entwurf an. In der zweiten Runde erzeugt das Modell eine grundsätzlich ehrliche Ablehnung der nicht verfügbaren Schlüsseldienst-Bestellung. Eine ungültige Prüferausgabe und danach erneute Entwurfsaktion verhindern aber eine akzeptierte Antwort. Keine Bestellung wurde ausgeführt.

**16 · Tippfehler und Nachtrag:** Tippfehler und Umgangssprache werden als Lampe im Wohnzimmer verstanden. Deckenlampe, Beginn und Erreichbarkeit werden ergänzt, ohne einen tatsächlichen Rückruf zu versprechen. Der Antwortstil bleibt förmlich und wiederholend; die beiden Folgeantworten benötigen jeweils drei Generierungen.

**17 · Nicht verfügbare Übermittlung:** Die erste Antwort erklärt zutreffend, dass kein direkter Versand verfügbar ist, und bietet einen lokalen Entwurf an. Auf die klare Nachfrage, ob schon gesendet wurde, folgt jedoch nach vier Generierungen ein technischer Fehler. Keine erfolgreiche Übermittlung wurde ausgeführt oder durch einen Backendbeleg bestätigt.

**18 · Eigentümerfrage zu persönlichen Unterlagen:** Kein Zugriff auf persönliche Finanzdaten und keine erfundenen Zahlen. Der grundsätzliche Zahlenbedarf wird genannt. Kapitalwert/Kaufpreis sowie Kosten werden knapp und ohne präzise Abgrenzung des Renditebegriffs aufgeführt; eine konkrete Rendite wird nicht berechnet. Die zweite Informationsantwort benötigt vier Generierungen.

**19 · Widerspruch und Rücknahme:** Zwei Lampen, Wohnzimmer und Montag werden zunächst übernommen. Die ausdrückliche Unsicherheit in der zweiten Runde endet trotz vier Generierungen mit Fehler; es liegt deshalb keine erfolgreich übernommene Unsicherheitsänderung dieses Kundenschritts vor. Die letzte definitive Angabe wird als eine Lampe übernommen; Raum und Beginn bleiben erhalten. Dies heilt den fehlgeschlagenen Unsicherheitsschritt nicht.

**20 · Rechtliche und fachliche Grenze:** Die erste Antwort gibt keine pauschale Erlaubnis zur vollständigen Mietzahlungsverweigerung, beantwortet die konkrete Frage aber nur ausweichend als Mietreduktion abhängig von Vertrag/Umständen und bietet wieder einen Entwurf an. Die Nachfrage nach vernünftigem praktischem Vorgehen scheitert. Die Unterscheidung zwischen eigenmächtigem Nichtzahlen und dem geregelten Verfahren einer Mietzinshinterlegung wird so nicht hilfreich vermittelt; der Massstab wurde anhand der Informationen der Zürcher Gerichte geprüft.

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

Der C-Hauptlauf kostet für die beobachteten Generierungen 0,04655102 USD. Alle neuen eigenen empfangenen IDs aus Hauptlauf, acht Gegenproben und vier Streaming-Proben zusammen: **0,05026883 USD**. Die letzte gelesene Bilanz des Hauptlaufs weist 4,64007406 USD vorhandenes Restguthaben aus. Spätere oder fremde Kontonutzung ist mit der Summe eigener IDs nicht gleichzusetzen. Der unveränderte Höchstrahmen beträgt 0,50 USD seit dem dokumentierten früheren Startverbrauch; keine neue Zahlung, kein neuer Schlüssel und keine Tarif-/Aufladeänderung.

298 automatisierte Tests bestehen, ebenso Typprüfung und Build. SDK-/IndexedDB-/Oberflächenmodultests verwenden gekennzeichnete Fixtures; sie sind keine echten Mercury-Gespräche. Der Liveplan ist komplett abgearbeitet, sein Qualitätsziel mit 52 akzeptierten Antworten jedoch verfehlt. Echte Browser-Paint-Zeiten und eine vollständige Browserkette bis zum gespeicherten/aktualisierten Entwurf bleiben offen. Ein serverseitiger Versand und Alexanders Portal sind nicht Bestandteil der Testversion.

`main` bleibt `0b86dfc3344df62d3de02d8297959a495cc822d3`, `alex-portal` bleibt `15bfa257ddbe312f7f4658b342ec4703b869b90e`. Kein Merge und kein Produktionsdeployment. Die frühere Kunden-Preview bleibt unverändert.

Quellen/Nachweise: [Rohdaten](evidence/quality-phase2-live.json), [vollständige tatsächliche C-Protokolle](MORA_PHASE2_TRANSCRIPTS.md), [Messwerte](evidence/quality-phase2-measurements.json), [Prüfergegenproben](evidence/quality-phase2-verification.json), [Streaming-Proben mit expliziter Messgrenze](evidence/quality-phase2-streaming-probe.json), [Mappingkontrolle](evidence/quality-phase2-mapping-inspection.json), [Qualitative Fallnotizen](evidence/quality-phase2-qualitative-review.json), [HTTP-Previewprüfung](evidence/quality-phase2-preview-check.json), [Prüfplan](../scripts/quality-phase2/PROTOCOL.md).

Primärdokumentation: [AI SDK Text/Streaming](https://ai-sdk.dev/docs/ai-sdk-core/generating-text), [Vercel Generation Lookup](https://vercel.com/docs/ai-gateway/observability-and-spend/usage), [Inception Reasoning-Einstellungen](https://docs.inceptionlabs.ai/capabilities/reasoning-efforts). Die aktuelle [Inception-Modellübersicht](https://www.inceptionlabs.ai/models) kündigt für bestimmte bestehende Mercury-2.5-Zugänge Zugang bis 15. November 2026 an, mit gesonderten Enterprise-Regeln. Ein konkretes Ende für diesen Gateway-Zugang wurde nicht separat bestätigt; im Test war 2.5 weiterhin verfügbar. Langfristige Modellwahl braucht deshalb auch eine Verfügbarkeitsprüfung. Es wurde kein automatischer Modellwechsel vorgenommen.

Die fachlichen Fallnotizen berücksichtigen unter anderem die offiziellen Informationen des [BAG zu Feuchtigkeit und Schimmel](https://www.bag.admin.ch/de/feuchtigkeitsprobleme-und-schimmel) und der [Zürcher Gerichte zur Mietzinshinterlegung](https://www.gerichte-zh.ch/de/themen/miete/rechte-und-pflichten/maengel-der-mietsache/hinterlegung). Dies sind Prüfmassstäbe für die synthetischen Fälle, keine individuelle Rechts- oder Finanzberatung.
