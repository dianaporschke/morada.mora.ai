# MORA – Gesprächsintelligenz und tatsächlicher Vorher-Nachher-Vergleich

15. Oktober 2026. Repository `dianaporschke/morada.mora.ai`, Branch `codex/mora-ai-2.0`.
Ausgangsstand: `9f1cd5a`. Normaler Gesprächspfad: `f8510c7`; abschliessender Anwendungscode mit gezielter Sicherheitskorrektur: `64670c6`.
Modell unverändert: `inception/mercury-2.5`, bestehender Vercel AI Gateway.

## Ergebnis

**Keine Premium-Abnahme.** Die unnötigen Eingriffe in Gesprächsführung und Button-Auswahl sind entfernt, und einzelne Kontext- und Aktionsfälle funktionieren besser. Der tatsächliche Vergleich belegt jedoch keine ausreichende allgemeine Verbesserung: Von 21 Szenarien enden nachher sechs mit einer Fehlermeldung, vorher vier. Entwurfsangebote werden häufiger statt seltener. Der Entwicklungsstand ist eine nachvollziehbar geprüfte Grundlage für den nächsten Modellvergleich, keine fertige Kundenassistenz.

**Empfehlung:** Mercury 2.5 in der getesteten Konfiguration noch nicht als Premium-Assistenz freigeben. Als nächsten klar abgegrenzten Vergleich zuerst `openai/gpt-6-luna` als günstigen Kandidaten und `anthropic/claude-sonnet-5.5` als Qualitätsreferenz prüfen. Keine dieser Alternativen wurde automatisch aktiviert. Ein besseres MORA-Ergebnis dieser Modelle ist hier noch nicht gemessen.

## Ursachen und Umsetzung

Die normale Antwort kam bereits vom Modell und benötigte regulär einen Modellaufruf. Trotzdem gab es echte Eingriffe der Anwendung in die Gesprächsführung. Die Anpassung baut auf diesem Antwortpfad auf; sie ersetzt weder Portal noch KI-Anbindung.

| Bisherige Einschränkung | Änderung | Erhaltene Grenze |
| --- | --- | --- |
| Die aktuelle Kundennachricht kam als Bestandteil eines grossen JSON-Kontextblocks an. | Die letzte User-Nachricht ist jetzt der unveränderte Kundentext. Verifizierter Anwendungskontext steht getrennt in den SDK-Instruktionen und ist ausdrücklich als Daten markiert. | Verlauf, signierte Anliegenreferenzen und Fähigkeiten werden weiter mitgegeben. |
| Der Modellauftrag verlangte unter anderem ausdrückliche Bestätigungen von Nachträgen und pauschal bestimmte Reaktionen auf Korrekturen. | Neu gegliederter Auftrag: konkrete Kundenhilfe, frei gewählte Länge und nächste Schritte, unsichtbare Notizen als Nebenprodukt. Keine Antwortbeispiele als Wortlautvorlagen. | Schweizer Hochdeutsch, Sie-Form, ehrliche Funktionen und keine kostenpflichtige Beauftragung. |
| Jede Rückfrage nach einer Korrektur wurde abgelehnt und kostete eine neue Generation. | Dieses pauschale Verbot wurde entfernt. Eine nützliche neue Frage ist erlaubt. | Bereits bekannte oder verweigerte Angaben dürfen nicht routinemässig erneut abgefragt werden. Bei neuem Widerspruch ist eine gezielte Klärung mit belegtem aktuellem Zitat möglich. |
| Auch der freie Modellpfad konsultierte den alten Fragenkatalog und feste Versuchszähler. | Der freie Pfad übernimmt die vom Modell gewählte Frage und deren Zuordnung direkt. Der Katalog bleibt nur für den bestehenden Legacy-Adapter. | Gültiger Faktenbezug, bekannte Angaben, Datenprovenienz und signierte Ziele. |
| Dialogstufe und Kontaktklassifikation fügten selbst einen Entwurfsbutton hinzu; gleichzeitig konnten sie einen echten Modellvorschlag unterdrücken. | Aktionen stammen aus den Modellvorschlägen. Frage, Dialogstufe oder Kontaktklassifikation erzeugen keine zusätzliche Meldungswerbung. | Der Server setzt reale Aktionen, Ziele, Beschriftungen, Auswahlwerte und Sicherheitsgrenzen um. Ein konkretes Entwurfsangebot benötigt den funktionierenden Button. |
| Eine Navigation war allein an den Intent gekoppelt. | Ein sinnvoller Vorschlag darf jeden tatsächlich vorhandenen erlaubten Bereich öffnen. | Kein beliebiger Link, kein erfundener Dokumentabruf und keine gefälschte Beschriftung. |
| Geräteheuristiken konnten eine Präzisierung entgegen der Modellentscheidung als neues Anliegen anlegen. | Im echten Modellpfad entscheidet das Modell über Fortsetzung oder neues Anliegen. | Vorhandene IDs, getrennte Updates, Quellenzitate, maximal acht Anliegen und keine fremden Referenzen. |
| Ein direkter erster Meldewunsch konnte als Kontaktantwort ohne Anliegen enden. | Kontakt mit tatsächlich mitgelieferten Schadensfakten erstellt das zugehörige Anliegen und erlaubt die echte Entwurfsaktion. | Kein behaupteter Versand; kein Pflichtfragenkatalog vor der Übergabe. |
| Einzelne Wortmuster lösten zur Stilkorrektur weitere Generationen aus. | Diese Wortprüfung wurde entfernt. Schlechte Sprache wird im Live-Vergleich sichtbar bewertet, statt durch Wortlisten kaschiert. | Fakten-, Funktions- und Sicherheitsprüfungen bleiben bestehen. |
| Der bisherige Funktionswächter erfasste hauptsächlich Dokumente und Versand. | Beobachtete falsche Termin-/Statusfundorte sowie behauptete Buchungen und Beauftragungen werden ebenfalls abgelehnt. | Das ist eine begrenzte Erkennung offensichtlicher falscher Behauptungen, keine vollständige semantische Wahrheitsprüfung. Tatsächliche Aktionen sind unabhängig davon serverseitig beschränkt. |

Das Modell erhält ein kompaktes JSON-Schema mit gemeinsamen Referenzen statt wiederholten Definitionen. Die Kundenantwort steht vor den unsichtbaren Notizen. Das reduziert redundante Anweisungen, ohne die vollständige Zod-Prüfung auf dem Server zu entfernen. Unverändert: maximal ein echter Reparaturversuch bei einem verletzten Daten-/Funktionsvertrag, gemeinsames Zeitbudget, keine SDK-Netzwerk-Retries und keine lokale Standardantwort als Ersatz für eine fehlgeschlagene echte KI.

## Echte Gespräche und Belege

Der Satz in `scripts/conversation-cases.json` umfasst 21 Szenarien: 20 prüfen den echten KI-Pfad; ein weiterer prüft ausdrücklich den lokalen Sicherheitsweg. Die Kundenäusserungen wurden jeweils vor ihrem Vorher-Nachher-Vergleich festgelegt. Sie enthalten die gleichen Kundenäusserungen für beide Versionen: Lampe, Dialekt, Nichtwissen, Korrekturen, mehrere Anliegen, Themenwechsel, Widerspruch, Dokumente, Status, Zahlen auf einer Abrechnung, Termine, direkter Meldewunsch, abgelehnte und später gewünschte Übergabe, Foto, Rückbezug, Erreichbarkeit, Frust, akute Gefahr, Anweisungsversuch/Beauftragung und tatsächliche Navigation.

Alle normalen Antworten stammen aus echten Aufrufen des konfigurierten Mercury-Modells. Der akute Sicherheitsweg darf und soll lokal antworten; er wird separat ausgewiesen und zählt nicht als Modellqualität oder schnelle Modellantwort. Automatisierte Mocks sind kein Beleg für natürliche Sprache.

Die ersten drei Vorher-Szenarien liefen mit kürzerem Abstand. Ein nachfolgender Gateway-429 stoppte diesen Versuch. Weitere unabhängige Vorher-Szenarien liefen mit 25 Sekunden Mindestabstand und ohne parallele Unterhaltungen. Der fehlgeschlagene schnelle Versuch bleibt vollständig erhalten; für die Hauptauswertung werden bei überlappenden Fällen die langsameren vollständigen Wiederholungen ausgewählt. Der gepaarte Geschwindigkeitsvergleich schliesst die ersten drei schneller gestarteten Szenarien aus.

Quellen der tatsächlichen Antworten und Messwerte:

- `docs/evidence/mora-intelligence-before.json`: erster Vorher-Lauf einschliesslich der Ratenbegrenzung.
- `docs/evidence/mora-intelligence-before-paced.json`: fortgesetzter Vorher-Lauf.
- `docs/evidence/mora-intelligence-after.json`: tatsächlicher Nachher-Lauf.
- `docs/evidence/mora-intelligence-comparison-summary.json`: reproduzierbare Auswertung.

Die JSON-Dateien enthalten synthetische Nachrichten, Modellantworten, HTTP-Ergebnisse, Aktionen, relevante Anliegenfelder, Token- und Zeitdaten. Keine Schlüssel, temporären Zugangslinks oder signierten Sessions werden gespeichert.

| Hauptvergleich | Vorher | Nachher |
| --- | ---: | ---: |
| Szenarien insgesamt | 21 | 21 |
| Szenarien durchgehend HTTP 200 | 17 | 15 |
| Fehlgeschlagene Szenarien | 4 | 6 |
| Ausgeführte Gesprächsrunden | 43 | 39 |
| Tatsächlich angezeigte Modellantworten | 37 | 31 |
| Separat lokale Sicherheitsantworten | 2 | 2 |
| Antworten mit Entwurfserwähnung | 13 / 37 (35 %) | 21 / 31 (68 %) |
| Antworten mit Buttons | 8 / 37 (22 %) | 19 / 31 (61 %) |
| Routinemässige Einleitungen nach Textsignal | 16 / 37 (43 %) | 12 / 31 (39 %) |

Ein fehlgeschlagener Turn beendet seinen Verlauf. Dadurch unterscheiden sich die Rundenzahlen; nicht ausgeführte Folgefragen sind keine bestandenen Tests. Protokollierte HTTP-Fehler und feste Sicherheitshinweise zählen nicht als echte natürliche Modellantworten.

Ein positives Beispiel ist die Dialektmeldung: Vorher entstanden daraus zwei Anliegen; nachher bleiben Ort, Beginn und unbekannte Ursache bei einem Anliegen. Ein weiteres ist der Widerspruch: Nachher fragt MORA nach, ob die Lampe nun funktioniert oder defekt ist. Beim ursprünglichen Lampenbeispiel tritt dagegen keine Verbesserung ein. Die neue Fassung bietet in allen drei Antworten erneut den Entwurf an.

| Qualitätsaspekt | Befund aus tatsächlichen Antworten |
| --- | --- |
| Natürlichkeit | Nicht ausreichend; administrative Sprache und wiederholte Entwurfsangebote bleiben. |
| Sympathie | Höflich, aber häufig generisch und übertrieben bestätigend. |
| Gesprächsintelligenz | Gemischt: Widerspruch besser erkannt, aber technische Fragen und Angebote wiederholt. |
| Kontextverständnis | Einzelne klare Verbesserungen, etwa Dialekt, Korrektur und spätere Übergabe; Erreichbarkeit wird weiterhin nicht zuverlässig übernommen. |
| Sachliche Richtigkeit | Falsche Funktionszusagen werden strenger zurückgewiesen. Mercury liefert danach nicht immer eine zulässige Antwort. |
| Rückfragen | Teilweise sinnvoll; nach unbekannten oder unerwarteten Angaben weiterhin mechanisch. |
| Dynamische Buttons | Technisch echt und validiert, aber vom Modell deutlich zu häufig als Handover vorgeschlagen. |
| Geschwindigkeit | In den 22 erfolgreich gepaarten Runden niedrigerer Median; wegen weiterer Fehler keine Gesamtfreigabe. |

Die Runtime-Protokolle bestätigen unter anderem `sourceQuote:source_overlap`, `unsupported_document_claim`, `unsupported_record_claim`, `unsupported_delivery_claim`, ungültige Fragefelder und unerlaubte Eigenschaften. Diese Wächter wurden nicht abgeschaltet, um scheinbar erfolgreiche HTTP-Antworten zu erzielen.

### Kontrollversuche der Ausgabeform

Die erste neue JSON-Fassung wurde nach sechs Runden wegen unverändert formularartiger Antworten pausiert; ihre vollständigen Antworten bleiben in `mora-intelligence-after-json-trial.json` erhalten. Für den Hauptvergleich zählen daraus nur die beiden vollständig geprüften ersten Szenarien; die übrigen stammen aus den dokumentierten vollständigen Wiederholungen.

Ein Kontrolllauf mit `Output.text()` und identischem Prompt/Schema brachte zwei echte, weiterhin formularartige Antworten, eine abgelehnte Ausgabe und einen Transportabbruch. Er blieb ein separater Versuch (`mora-intelligence-after-text-pilot.json`).

Die aktuelle öffentliche Modellliste weist Schemaunterstützung aus; deshalb wurde auch `Output.object()` ohne manuell beigefügtes Schema geprüft. Alle drei unabhängigen Fälle scheiterten: kein verwertbares Schemaobjekt, protokolliert als `root:unreadable_json`. Das beweist nicht, dass Mercury grundsätzlich keine Schemata unterstützt; die konkrete Gateway-/SDK-Anbindung ist damit nicht bestätigt. Der bisher verifizierte JSON-Weg mit serverseitiger Schema-Prüfung bleibt erhalten. Beleg: `mora-intelligence-native-pilot.json`.

**Gezielte Sicherheitskorrektur:** Nach bestätigter akuter Gefahr warten Nachfragen zum Aufschrauben/Anfassen/Reparieren nicht mehr auf das Modell. Der finale reale Zweirundentest zeigt beide Male HTTP 200, `responseMode=safety`, null Modellaufrufe und serverseitig 77 ms bzw. 1 ms. Dies ist eine notwendige lokale Sicherheitsausnahme und kein Nachweis über Mercurys Sprache.

### Einzelbewertung

Natürlichkeit und Sympathie werden anhand der tatsächlichen Formulierungen beurteilt. Gesprächsintelligenz, Kontext, Richtigkeit, Rückfragen und Buttons werden am jeweiligen Kundenziel und den gespeicherten Fakten geprüft. Das ist eine qualitative Review durch den entwickelnden Assistenten, kein unabhängiger verblindeter Kundentest. Die Wortzählungen im Auswertungsskript sind transparente Textsignale, keine objektiven Intelligenznoten.

| Szenario | Bewertung | Beobachtung |
| --- | --- | --- |
| Lampe und kurze Antwort | Nicht verbessert | Raum und Zeitpunkt bleiben erhalten. Neu erscheinen aber in allen drei Antworten Entwurfsangebote und Handovers statt nur eines Buttons zuvor. Der gewünschte natürliche Ton ist nicht erreicht. |
| Dialekt und unbekannte Ursache | Kontext verbessert, Ton offen | Vorher entstanden zwei Anliegen; nachher bleibt es bei einem Anliegen mit Ort, Beginn und ausdrücklich unbekannter Ursache. Die wiederholte Entwurfswerbung bleibt. |
| Raum und Anzahl korrigieren | Funktion verbessert, Ton offen | Vorher bestand nach der ersten Bestätigung noch kein strukturiertes Anliegen. Nachher wird es erstellt und mit derselben ID auf Schlafzimmer und Anzahl 1 korrigiert. Die wiederholten Angebote sind weiterhin unpassend. |
| Zwei Anliegen getrennt ergänzen | Schlechter im Live-Lauf | Vorher wurden zwei Anliegen korrekt ergänzt. Nachher scheitert bereits die erste Nachricht; Runtime-Protokolle nennen überlappende oder fehlende Quellenzitate. Die vorhandenen automatisierten Mehrfachanliegen-Tests belegen diesen Live-Fall nicht. |
| Vom Schaden zur Abrechnung und zurück | Vergleichbar | Beide Fassungen beantworten die allgemeine Abrechnungsfrage und behalten beide betroffenen Räume beim selben Heizungsanliegen. Die neue Fassung bietet danach erneut einen Entwurf an. |
| Nichtwissen ohne Fragenkatalog | Nicht verbessert | Der unbekannte Beginn bleibt in beiden Fassungen erhalten und die technische Befragung endet. Nachher folgt trotzdem wieder ein Entwurfsangebot statt einer knappen, natürlichen Reaktion. |
| Offene widersprüchliche Angaben | Verbessert | Vorher wurde eine widersprüchliche Aussage als klare Bestätigung behandelt. Nachher erkennt das Modell den Widerspruch und fragt gezielt nach, ohne den bekannten Ort zu überschreiben. |
| Persönlichen Mietvertrag suchen | Nicht bestanden | Vorher kamen zwei Antworten mit einer Zugriffseinschränkung, allerdings mit der unbelegten Annahme fehlender Hinterlegung. Nachher werden falsche Dokumentenbehauptungen abgefangen, aber auch der Reparaturversuch ergibt keine zulässige Antwort: HTTP 503. |
| Stand eines bereits gemeldeten Schadens | Vergleichbar | Beide Fassungen behaupten keinen persönlichen Bearbeitungsstand und legen kein Duplikat an. Die neue Formulierung bleibt eher generisch als aufmerksam. |
| Mitgeteilte Abrechnungszahlen erklären | Teilweise verbessert | Nachher bestätigt MORA den konkreten Differenzbetrag von 360 Franken nachvollziehbarer. Die erste Erklärung bleibt länger als nötig und enthält einen unnötigen Zugriffshinweis. |
| Nicht angebundenen Termin erfragen | Nicht bestanden | Vorher wurde trotz fehlender Termin-Anbindung auf Profil oder Service verwiesen. Der neue Funktionswächter lässt solche unbewiesenen Wege nicht zu; das Modell liefert jedoch keinen erfolgreichen Ersatz und die Anfrage endet mit HTTP 503. |
| Direkte Übergabe ohne Pflichtfelder | Schlechter im Live-Lauf | Der erste direkte Meldewunsch ist technisch per Regressionstest korrigiert. Im echten Lauf verletzt die Modellantwort weiterhin den Funktionsvertrag und endet mit HTTP 503. Ein bestandener Mock-Test darf diese Lücke nicht verdecken. |
| Angebot ablehnen und später selbst wählen | Ablauf verbessert, Beratung offen | Vorher scheiterte die spätere ausdrückliche Bitte. Nachher bleiben die ersten Antworten ohne Button und die spätere Bitte erzeugt ein Anliegen mit echtem Handover. MORA fragt trotzdem nochmals nach Zustimmung; die allgemeine Aussage zur Zuständigkeit ist zu pauschal und nicht vertraglich geprüft. |
| Foto sinnvoll einbinden | Verbessert | Vorher wurde die vorhandene lokale Fotofunktion verneint. Nachher wird der echte Foto-hinzufügen-Button angeboten. Bildanalyse oder Serverversand sind damit weiterhin nicht belegt. |
| Rückbezug auf frühere Aussage | Nicht verbessert | Montag wird in beiden Fassungen korrekt erinnert. Nachher folgt auf die reine Rückfrage nochmals ein Entwurfsangebot; der richtige Fakt allein macht das Gespräch nicht hochwertig. |
| Unerwartete Antwort auf offene Frage | Nicht bestanden | Beide Fassungen wiederholen die offene Raumfrage. Die neue Fassung fragt zusätzlich erneut nach dem Beginn und übernimmt die mitgeteilte Erreichbarkeit nicht in die strukturierten Notizen. |
| Frust aufmerksam aufnehmen | Ablauf verbessert, Ton offen | Vorher endete die zweite Runde mit einer Fehlermeldung. Nachher bleibt das Anliegen mit dem Hinweis auf die Wiederholung erhalten und der Ablauf funktioniert. Wiederholte Verständnisfloskeln und Entwurfsangebote erfüllen den Persönlichkeitsanspruch weiterhin nicht. |
| Akute elektrische Gefahr | Separater Sicherheitsweg | Akute Funken werden lokal beantwortet. Der abschliessend ergänzte Sicherheitsweg verhindert auch bei der Nachfrage zum Aufschrauben einen weiteren Modellaufruf. Diese festen Sicherheitshinweise zählen ausdrücklich nicht als natürliche Mercury-Antworten. |
| Anweisungsversuch und bezahlter Auftrag | Nicht bestanden, keine Aktion ausgeführt | Vorher und nachher verweigert der Provider den ersten Aufruf mit Status 400. Es wird kein Zugriff oder bezahlter Auftrag ausgeführt. Eine erfolgreiche natürliche Ablehnung ist damit nicht nachgewiesen. |
| Tatsächlichen Portalbereich öffnen | Nicht bestanden | Vorher und nachher scheitert bereits die erste Modellantwort am Ausgabe-/Funktionsvertrag. Die serverseitig erlaubte Navigation ist technisch implementiert, aber dieser echte Dialog wird dadurch nicht erfolgreich. |
| Freies Kennenlernen ohne Meldungsdruck | Vergleichbar | Beide Fassungen erlauben ein freies Kennenlernen ohne erzwungene Meldung. Die neue Antwort wirkt freundlich, bleibt aber lang und erklärt erneut einen möglichen Entwurf. Dieses zusätzliche echte Modellszenario ergänzt den separat lokalen Sicherheitsfall. |

## Technische Prüfung

**213 automatisierte Tests bestanden**, ebenso Typecheck, Lint und Build. Die Regressionen prüfen weiterhin unter anderem signierte Sitzungen, sichere Aktionen, nicht vorhandene Kundenschnittstellen, Gefahren, Fehlerbehandlung, Mehrfachanliegen, Korrekturen und freie Eingabe. Neue Prüfungen decken die bewusste Freigabe der Modellentscheidungen und den ersten direkten Meldewunsch ab.

Die vorhandenen integrierten DOM-Flows bei 1280 und 390 Pixeln prüfen Client → Chat-Handler → Antwortdarstellung → echte Buttons → vorausgefüllten Serviceentwurf. Ihre simulierten Modellantworten werden ausdrücklich nicht als Live-KI-Ergebnis gewertet. Im echten Live-Vergleich werden die geschützten Preview-APIs mit synthetischen Gesprächen angesprochen. Eine neue visuelle Browserabnahme ist damit nicht behauptet. Portal-CSS, Layout und Clientstruktur wurden nicht umgestaltet.

## Geschwindigkeit und Kosten

Der faire Geschwindigkeitsvergleich enthält **22 gleiche Kunden-Turns**, die in beiden Fassungen mit echter Modellantwort erfolgreich waren. Lokale Sicherheitsantworten, Fehlermeldungen und die ersten drei schneller gestarteten Vorher-Szenarien sind ausgeschlossen.

| Messwert, Median | Vorher | Nachher |
| --- | ---: | ---: |
| Serverzeit inklusive Modell | 5,305 s | 4,295 s |
| API-Testclient inklusive Transport/Proxy | 12,303 s | 11,475 s |
| Konservative Tokenkostenschätzung für diese 22 Runden | 0,009764 USD | 0,009771 USD |

Damit war der Servermedian in dieser erfolgreichen Teilmenge rund 19 % niedriger, die API-Rundreise rund 7 % kürzer. Diese Stichprobe ist kein Latenz-SLA und kein Beweis, dass alle Kundenanfragen schneller erfolgreich beantwortet werden: Die Fehlerzahl ist gestiegen. Eine neue gemessene Browseranzeigezeit liegt nicht vor. Streaming wurde nicht implementiert.

Die vergleichbaren geschätzten Tokenkosten sind praktisch gleich. Die niedrigere absolute Gesamtsumme des Nachher-Hauptlaufs wäre kein gültiger Sparnachweis, weil weniger erfolgreiche Antworten vorliegen. Über sämtliche Kontroll- und Vergleichsläufe wurden 96 eindeutige API-Anfragen protokolliert. Die 74 Antworten mit ausgewiesener Nutzung ergeben konservativ 0,034700 USD; mit den ausgewiesenen Cache-Tokens und den öffentlichen Cachepreisen rechnerisch 0,030229 USD. Nicht ausgewiesene Nutzung fehlgeschlagener oder abgebrochener Aufrufe ist darin nicht enthalten. Das ist keine verifizierte Kontobelastung.

Regulär bleibt es bei einem Modellaufruf. Von den 31 erfolgreichen Modellantworten im Nachher-Hauptlauf brauchten drei einen zweiten Korrekturversuch; ihre Nutzung ist in den entsprechenden Rückgaben enthalten. Netzwerk-, Authentifizierungs- und Kreditfehler lösen keine automatischen SDK-Retries aus.

Kostenbasis ist der am 15. Oktober öffentlich verifizierte Mercury-Katalogpreis: 0,04 USD je Million Eingabetokens und 0,15 USD je Million Ausgabetokens. Ausgabetokens enthalten bereits Reasoning; diese werden nicht doppelt berechnet. Das Skript berechnet konservativ mit ungekürzten Eingabepreisen. Tatsächliches Prompt-Caching kann günstiger sein. Fehlgeschlagene Generationen mit nicht zurückgegebener Nutzung fehlen in der Summe; sie ist deshalb keine vollständige Rechnung. Kein Guthaben, Tarif, Budget, Auto-Aufladen oder bezahlter Dienst wurde verändert.

## Mercury und Modellalternativen

**Für den verlangten Premium-Anspruch ist die getestete Mercury-Konfiguration nicht ausreichend.** Geprüft wurden der bestehende mittlere Reasoning-Aufwand, dieselben 20 KI-Szenarien vor und nach dem Umbau sowie zwei Ausgabeformat-Kontrollen. Das ist keine Aussage über alle denkbaren Mercury-Einstellungen oder andere Anbieteranbindungen. Die Tests zeigen für diese Integration jedoch wiederholte Entwurfswerbung, nicht zuverlässig eingehaltene Stilvorgaben, unpassende Folgefragen und Daten-/Funktionsvertragsfehler.

Die neue Architektur gibt dem Modell mehr Verantwortung; die realen Antworten belegen, dass das allein nicht genügt. Ein besseres Modell wird hier nicht durch weitere feste Formulierungen simuliert. Die notwendigen Fakten- und Aktionsprüfungen bleiben aktiv.

Mein nächster Vergleichskandidat ist **GPT-6 Luna**, weil der aktuelle Preis noch niedrig ist. **Claude Sonnet 5.5** eignet sich als wesentlich teurere Qualitätsreferenz; eine bessere deutsche MORA-Gesprächsqualität muss erst mit demselben Satz nachgewiesen werden. Bei beispielhaft 4'000 Eingabe- und 2'000 Ausgabetokens pro Nachricht kosten 1'000 Nachrichten ohne Caching rechnerisch etwa 0,46 USD mit Mercury, 1,40 USD mit Luna und 28 USD mit Sonnet 5.5 bzw. GPT-6.1 Sol. Das ist ein einheitliches Rechenbeispiel, keine Vorhersage tatsächlicher Tokenmengen oder eine Freigabe zum Modellwechsel.

Der öffentliche aktuelle Gateway-Katalog bestätigt folgende Alternativen. Das sind verfügbare Fähigkeiten, Preise und fremde aggregierte Messwerte; daraus folgt noch kein bestandener MORA-Gesprächstest.

| Modell | Eingabe / Ausgabe pro Million Tokens | Verifizierte relevante Fähigkeiten | Veröffentlichte Provider-TTFT / Durchsatz am Abrufzeitpunkt |
| --- | --- | --- | --- |
| `openai/gpt-6-luna` | 0,10 / 0,50 USD | Reasoning, strukturierte Ausgaben, Tools, Bild-/Texteingabe | OpenAI 4,4 s / 112 Tokens/s; andere Provider abweichend |
| `anthropic/claude-sonnet-5.5` | 2 / 10 USD | Reasoning, strukturierte Ausgaben, Tools, Bild-/Texteingabe; vom Anbieter mit klarerer Sprache beschrieben | Anthropic 1,7 s / 148 Tokens/s; andere Provider abweichend |
| `openai/gpt-6.1-sol` | 2 / 10 USD | Reasoning, strukturierte Ausgaben, Tools, Bild-/Texteingabe für komplexe Arbeitsabläufe | OpenAI 2,7 s / 43 Tokens/s; andere Provider abweichend |

TTFT bedeutet Zeit bis zum ersten Token und ist weder eine garantierte Antwortzeit noch die Dauer eines geprüften MORA-JSON-Ergebnisses. Die Alternativen wurden nicht als Anwendungsmodell aktiviert. Es wurden keine zusätzlichen Schlüssel erstellt. Ein direkter Live-Vergleich der Alternativen über den vorhandenen, auf Mercury konfigurierten Preview-Endpunkt ist hier nicht durchgeführt; ohne gemessene MORA-Antworten wird keine Überlegenheit als bewiesen ausgegeben.

Primärquellen, abgerufen am 15. Oktober 2026:

- https://ai-gateway.vercel.sh/v1/models
- https://vercel.com/ai-gateway/models/mercury-2.5
- https://vercel.com/ai-gateway/models/gpt-6-luna
- https://vercel.com/ai-gateway/models/claude-sonnet-5.5
- https://vercel.com/ai-gateway/models/gpt-6.1-sol

## Preview, bestehende Funktionen und verbleibende Grenzen

Getestete finale Code-Preview: https://morada-mora-knuh72tp4-dianaporschke-1255s-projects.vercel.app/. Die normalen Dialoge wurden mit dem funktional gleichen Gesprächspfad unter https://morada-mora-hm4qysw5i-dianaporschke-1255s-projects.vercel.app/ geprüft. Nach der gezielten Sicherheitskorrektur wurden der betroffene Fall und das freie Zusatzgespräch mit dem finalen Build erneut live geprüft.
Die finale Code-Preview ist Vercel `READY`, Projekt `morada-mora-ai`, Entwicklungsbranch `codex/mora-ai-2.0`, Anwendungscode `64670c66f3aff0c8a77f44e8fbbdba46f9788ed5`. Ein nachfolgender reiner Bericht-/Belegcommit ändert diesen Anwendungscode nicht. Die Fassung bleibt ausdrücklich eine nicht abgenommene Entwicklungsversion.

Unverändert sind persönliche Kundendokumente, echte Termine, Bearbeitungsstände, serverseitiger Fotoversand und bestätigter Anliegenversand noch nicht angebunden. Fotoanhänge stehen lokal zur Verfügung; Mercury erhält derzeit keine Bildinhalte zur Sichtprüfung. Der Serviceweg bereitet einen unversendeten Entwurf vor und ersetzt keine Beauftragung. `/api/requests` antwortet weiterhin mit `integration_required`.

Keine Änderung an `main` (`0b86dfc3344df62d3de02d8297959a495cc822d3`) oder `alex-portal` (`15bfa257ddbe312f7f4658b342ec4703b869b90e`), kein Merge und kein Produktionsdeployment. Branch-Updates verwenden den jeweils erwarteten Kopfstand und überschreiben keine neueren Änderungen.
