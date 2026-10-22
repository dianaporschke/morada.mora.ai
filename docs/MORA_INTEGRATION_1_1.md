# MORA Integration 1.1

Stand: 23. Oktober 2026 (Europe/Zurich). Ausschliesslich `codex/mora-ai-2.0` im Repository `dianaporschke/morada.mora.ai`.

Die vorhandene, von der Auftraggeberin bereitgestellte HTML-Datei ist die Arbeitsgrundlage. Ihre Anliegenverwaltung bleibt die einzige Anliegenverwaltung. Das bestehende geschützte Backend verwendet weiterhin Vercel AI Gateway und `inception/mercury-2.5`.

## Testversion

**Abschlussstatus: technisch integrierte Testversion, noch keine Qualitätsfreigabe.** Die nativen Formular- und Speicherwege bestehen die Regressionstests. Echte Mercury-Gespräche bleiben unzuverlässig: Raumkorrekturen können scheitern, ausdrücklich genannte Räume können fehlen und ein Formular kann zu früh angeboten/geöffnet werden. Die semantische Modellprüfung verhindert diese Fehler nicht zuverlässig. Die vollständige gewünschte Gesprächsqualität ist deshalb noch nicht erreicht.

[Portal-Preview öffnen](https://morada-mora-nz9fyrxxf-dianaporschke-1255s-projects.vercel.app/portal.html)

Code-Commit: `b66bbfbfc7c40e95365dd6788ed5de54f32c433d`. Deployment `dpl_6LpHKyLQbnPfeAAQt9Voj8m7zTHH`, Status READY, `target: null` (Preview). Keine Produktionsaliase, kein Merge, keine Änderungen an `main` oder `alex-portal`.

Zum Prüfen den vorhandenen Verwaltungsbereich öffnen, MORA starten und z. B. „Meine Lampe geht nicht“, „Wohnzimmer“, „Bitte das Anliegen vorbereiten“ schreiben. Die Angaben werden direkt in das vorhandene Anliegenformular übernommen. Dort können sie geprüft und ergänzt werden; dessen bestehender Speichern-Button sichert den Eintrag auf diesem Gerät. Im Anliegenregister erscheint derselbe Datensatz. MORA bestätigt das Speichern erst nach Rücklesen.

**Funktionsgrenze der gelieferten HTML-Version:** Nur die bestehenden Verwaltungsansichten besitzen schreibbare Anliegenfunktionen. Die Mieter- und Eigentümerseiten sind noch Ansichten ohne Kundenkonten, Wohnungszuordnung und eigene Schreibschnittstelle. Diese Grenze wird nicht durch Rollenwechsel oder Zugriffstricks umgangen. MORA kann dort beraten, aber kein Kundenanliegen speichern. Eine vollständig persönliche Kundenintegration benötigt Alexanders Schnittstelle unten.

## Gefundene Ursachen

1. Die bisherige Integration erlaubte dem Modell nur Navigation. Es fehlte eine ausführbare Aktion zum Öffnen des vorausgefüllten Anliegenformulars. Ein sprachliches Angebot bewirkte deshalb keine Formularübernahme.
2. Der bisherige Adapter schrieb direkt einen lokalen Datensatz. Der bestehende Prüf- und Dateianhang im Originalformular wurde nicht genutzt.
3. Die übernommenen Freigaberegeln verlangten einen bekannten Einrichtungstyp und blockierten bei jeder Rückfrage. Das war strenger als das tatsächliche Portalformular. Wasserflecken ohne Gerät und optionale Fragen zum Beginn verhinderten unnötig die Vorbereitung.
4. Die Schema-Kürzung entfernte jedes `description`-Attribut, einschliesslich wichtiger Feldbedeutungen und der gleichnamigen Nutzdaten-Eigenschaft. Hinweise zur Trennung von Raum, Einrichtung und unbekannten Angaben gingen vor dem Modellaufruf verloren.
5. Ein unbenutztes oder paraphrasiertes Aktionszitat wurde wie ein ungültiger Pflichtbeleg behandelt. Der zusätzliche kopierte Aktionsbeleg wurde entfernt; für die Aktionsabsicht gilt der tatsächliche aktuelle Kundentext. Faktenänderungen benötigen weiterhin Quellen. Die aktuelle semantische Absichtsprüfung ist dennoch nicht zuverlässig genug: Im letzten realen Test löste bereits „wohnzimmer“ eine Vorbereitung aus.
6. Die lokale Sicherheitsprüfung erkannte „weder Funken noch Geruch oder Wärme“ fälschlich als Stromgefahr. Die begrenzte Negationskorrektur berücksichtigt koordinierte Beobachtungen; unabhängige neue Gefahr und Unsicherheit bleiben sicherheitsrelevant.
7. Es fehlten Anliegenauswahl, native Fotobindung und der Status eines geöffneten, noch ungespeicherten Formulars. Bei verlorenem Abbruchabgleich konnte der Chat einen veralteten Formularstatus behalten. Dieser wird nun vor der nächsten Modellnachricht abgeglichen.

Der erste reale Durchlauf mit fünf Gesprächen war **nicht erfolgreich**. Der zweite bestand vier von fünf Speicherabläufen; beim unbekannten Teil scheiterte die Antwortprüfung. Ausserdem blieb eine unzulässige Versand-/Vorbereitungsbehauptung sichtbar (`portal-integration-v11-second-run.json`). Deshalb wurde die bewährte semantische Prüfstufe wiederverwendet: Anliegenantworten werden mit denselben Modell-/Gateway-Zugangsdaten zusätzlich auf fehlende Fakten und unbestätigte Aktionen geprüft. Bei einem belegten Fehler wird die gemeinsame Entscheidung höchstens einmal regeneriert; allgemeine Nachrichten ohne Anliegen benötigen diese Prüfstufe nicht. Ohne akzeptiertes Prüfergebnis erfolgt keine Übernahme der Kandidatenfakten oder Ausgabe der Antwort. Ein falsches Prüfformat wird jetzt innerhalb der Prüfstufe einmal repariert, ohne eine bereits gültige Gesprächsentscheidung neu zu erzeugen. Transport-/Ratenfehler lösen keine inhaltliche Modellreparatur aus. Unbenutzte null-Listen werden als fehlende optionale Angaben normalisiert; leere Faktenbelege bleiben verboten. Die gezielte Reparatur benennt inzwischen auch das bereits beantwortete Feld. Für eine Aktion wird der tatsächliche aktuelle Kundentext geprüft; ein vom Modell paraphrasiertes Aktionszitat ist kein zusätzlicher Pflichtbeleg mehr. Belegte Faktenänderungen behalten ihre exakten Quellen. Die unveränderten Antworten, Fehler, gespeicherten Zwischenstände und Generation-IDs des ersten Durchlaufs bleiben in `docs/evidence/portal-integration-v11-first-run.json` erhalten. Die Korrekturen wurden anschliessend erneut mit denselben Nachrichten geprüft. Ein anfängliches Fehlschlagen wird nicht als bestandener Test gezählt.

## Übernommene MORA-Bestandteile

- Gemeinsames Einrichtungsverzeichnis und exakte Aliase, insbesondere `light` → „Lampe / Leuchte“ und `socket` → „Steckdose“.
- Validierte, belegte Faktenänderungen; bekannte, unbekannte, nicht angegebene, korrigierte und unsichere Angaben bleiben unterscheidbar.
- Getrennte Anliegen mit stabiler ID, Revision und Inhaltssignatur.
- Deterministische Vorbereitungstickets und bestätigte Speicherbelege.
- Schutz vor doppelter Ausführung, alten Aktionsgruppen und versehentlichem Überschreiben eigener Formularänderungen.
- Sicherheitsprüfung auf Client und Server; keine fest programmierten Schadensdialoge oder Ersatzantworten.

## Tatsächlich verwendete Portal-Schnittstellen

| Funktion / Daten | Verwendung |
|---|---|
| `caseOpenForm` | Das bestehende Anliegenformular öffnen und mit Chatangaben vorausfüllen |
| `opsEntryForm` | Vorhandene Felder, Pflichtprüfung und Speichern-Schaltfläche; Kunde kann Angaben ändern |
| `opsDraft`, `opsFileInput`, `opsAddFiles`, `companyReadReceipt` | Originale Dateiauswahl, Typ-/Grössenprüfung und anliegenbezogene Dateiliste |
| `opsSaveRecord('case', …)` | Originale Validierung, Liegenschafts-/Einheitenbezüge, Bearbeitungsstatus, Verlauf und Speicherung |
| `companyCommit`, `portalReadStored` | Vorhandenen Portalbestand schreiben und tatsächlich gespeicherten Datensatz samt Anhängen zurücklesen |
| `opsAfterSave`, `caseDetail`, `go('cases')` | Bestehendes Anliegenregister und Detailansicht verwenden |
| `state.cases`, vorhandener Portal-Speicher | Einzige persistierte Anliegenverwaltung; keine zweite Entwurfsdatenbank |
| `/api/portal-chat` | Geschützte KI, signierter Gesprächszustand, Aktionsprüfung und Abgleich lokaler Belege |

Die native Speicherfunktion erhält lediglich einen optionalen MORA-Kontext für stabile Anliegen-ID und Gesprächsbelege im vorhandenen Verlauf. Normale Portalaufrufe verhalten sich unverändert. Der Quellvergleich bestätigt 1’073 bestehende benannte Funktionen, unveränderte native Styles und genau vier Ersetzungen für diese optionale Erweiterung. Alle weiteren Änderungen liegen im abgegrenzten MORA-Zusatz.

## Zentrales Datenmapping

`assets/mora-portal-map.js` ist die gemeinsame Abbildung zwischen Gesprächsfakten und echten Portalfeldern.

| Gesprächsdaten | Bestehendes Portal-Feld |
|---|---|
| Einrichtungsbezeichnung + Bereich | `title`, z. B. „Lampe / Leuchte · Wohnzimmer“ |
| Elektrik/Beleuchtung, Wasser, Heizung, Geräte | `caseInfo.category = Schaden / Reparatur`; genauer Fachbereich zusätzlich in `description` |
| Schlüssel/Zutritt bzw. Nachbarschaft | `Schlüssel / Zutritt` bzw. `Beschwerde` |
| Nicht zuordenbare Kategorie | `Allgemein`; Beschreibung kennzeichnet fehlende Fachzuordnung |
| Betroffener Raum/Bereich | `unit` (Freitextfeld Raum/Zusatzangabe), keine erfundene Wohnungs- oder Liegenschafts-ID |
| Einrichtung, konkreter Defekt, Anzahl, Beginn, Umfang, Zusatzangaben, genannte Ursache | `description`, weil die HTML-Version dafür keine separaten Felder besitzt |
| Beginn fehlt / ausdrücklich unbekannt | „Beginn: Nicht angegeben“ / „Beginn: unbekannt“ |
| Dateien | Native `attachments` des betreffenden `state.cases`-Datensatzes |
| Exakte Kundenaussagen | Bestehender Anliegenverlauf; frühere Angaben bleiben Belege und ersetzen keine spätere Korrektur |

Eine Anzahl von eins wird nicht aus „meine Lampe“ erfunden. Eine akzeptierte Raumkorrektur aktualisiert nach Prüfung und Speichern den Bereich derselben Anliegen-ID. Die Speicherlogik ist getestet; die vorgelagerte reale Modellentscheidung scheitert noch in einzelnen Gesprächen. Andere Fakten und andere Anliegen bleiben erhalten. Zu lange Beschreibungen werden zurückgewiesen, nicht still abgeschnitten. Manuelle Portaländerungen werden bei einem späteren Chat-Update erkannt und zur Prüfung im Register erhalten.

## Aktionen und wahrheitsgemässe Zustände

| Zustand | Nachweis / Verhalten |
|---|---|
| Im Gespräch erkannt | Validierte Fakten im signierten Gespräch; noch kein Portaleintrag |
| Vorbereitung möglich | Zentral geprüfter Defekt und Bereich; ausdrücklich unbekannter Bereich ist zulässig. Beginn, Anzahl und Gerätetyp sind keine zusätzlichen Pflichtfelder |
| Vorbereitung läuft | Eine ausstehende Client-Operation; wiederholte Klicks gesperrt |
| Formular vorbereitet / ans Portal übergeben | Native Felder wurden gesetzt und kontrolliert; `portalDraftOpen`, ausdrücklich noch ungespeichert |
| Speichern läuft | Originalformular, Datei-Lesestatus und nativer Speicher werden geprüft |
| Lokal gespeichert / aktualisiert | Erfolgreiches `companyCommit` plus `portalReadStored`; Inhalte und Dateibytes stimmen mit dem Formulardatensatz überein |
| Fehler | Fehlermeldung im Originalformular; keine erfundene Erfolgsbestätigung; bisheriger Datensatz bleibt erhalten |
| Speicherabgleich offen | Tatsächlicher lokaler Erfolg bleibt sichtbar; erneuter Abgleich schreibt keinen zweiten Datensatz |
| An MORADA gesendet | Nicht implementiert und wird nicht als Erfolg angezeigt |

Nur eine aktuelle Aktionsgruppe wird gerendert. Nach Speicherung entfällt „Anliegen vorbereiten“. Eine echte Ergänzung bietet die Aktualisierung derselben ID an. Die Anliegenauswahl wechselt nur zwischen signiert bekannten Anliegen. Ein ausdrücklicher Vorbereitungswunsch in natürlicher Sprache kann das vorausgefüllte Formular unmittelbar öffnen; er speichert es nicht ungeprüft.

Fotos werden über die vorhandene Auswahl angebunden: maximal drei Dateien mit je 1 MB, PDF/JPG/PNG/WEBP. Die Originalprüfung kontrolliert Dateiinhalt und Typ. Dateien bleiben lokal beim richtigen Anliegen und werden erst mit dem Formular gespeichert. Kein Upload, Versand und keine Bildanalyse werden behauptet. Je nach Browser ist die sichtbare native Dateiauswahl anzuklicken, falls eine nach asynchroner Anfrage ausgelöste Auswahl nicht automatisch geöffnet wird.

## Prüfungen

`npm test`: **328 bestanden**, keine fehlgeschlagen. `npm run typecheck` und `npm run build`: bestanden.

Die deterministischen Regressionstests verwenden klar gekennzeichnete Modell-Fixtures, führen aber den echten HTML-Formular-, Validierungs-, Datei- und Speicherpfad aus. Sie prüfen die zurückgelesenen Daten, nicht bloss den Chattext.

| Geforderter Fall | Geprüftes Ergebnis |
|---|---|
| 1. Lampe im Wohnzimmer | Bezeichnung, Fachbereich, Defekt, Raum, Anzahl/Beginn/Symptome in echtem Portaldatensatz |
| 2. Steckdose | Native Kategorie, Einrichtung und Büro korrekt gespeichert |
| 3. Wasserschaden | Wasserfleck und Bereich gespeichert, auch ohne bekannten Gerätetyp |
| 4. Unbekannte Angaben | Unbekannt getrennt von fehlenden Angaben; keine erfundene Kategorie oder Anzahl |
| 5. Raumkorrektur | Schlafzimmer ersetzt Wohnzimmer in derselben ID; andere Angaben bleiben |
| 6. Mehrere Anliegen | Getrennte IDs, Räume und Beschreibungen; Wechsel zwischen Anliegen |
| 7. Ergänzung | Bestehender Datensatz aktualisiert; anderer Datensatz unverändert; eigene Portaländerungen geschützt |
| 8. Foto | Reale PNG-Bytes über native Dateifunktion gelesen und beim richtigen Anliegen zurückgelesen |
| 9. Doppelter Klick | Doppeltes Vorbereiten und doppeltes Formular-Submit erzeugen nur einen Datensatz |
| 10. Speicherfehler | Erzwungener Speicherfehler erzeugt weder Datensatz noch Speichererfolg; Fehler bleibt sichtbar |

Weitere Regressionen: verlorene Speicherbestätigung, verlorener Formular-Abbruchabgleich, veraltete/tamperierte Tickets, nicht verfügbare Aktion, Themenwechsel, Sicherheitslagen und Entfernung alter Buttons nach Modellfehler.

Die gesamte HTML-Datei läuft in JSDOM. Fehlende Dialog-, Web-Locks- und einzelne File-APIs sind Test-Shims. Das ist **kein gerenderter Desktop-/Mobilgeräte- oder nativer Dateidialog-Test**. Die vorhandene Zugriffssperre für Browserprüfung wurde nicht umgangen; es wird keine solche Prüfung behauptet.

## Reale KI-Gespräche und Messwerte

Alle nachfolgenden Antworten stammen aus echten Aufrufen von `inception/mercury-2.5`. Die gesamte Serie umfasst 33 Kundennachrichten über mehrere Codeversionen; 24 erhielten eine akzeptierte Modellantwort. Eine akzeptierte Antwort ist ausdrücklich kein Beweis für einen korrekten vollständigen Anliegenablauf.

| Durchlauf / Nachweis unter `docs/evidence` | Ergebnis |
|---|---|
| `portal-integration-v11-first-run.json` | 0/5 vollständige Abläufe; native Erstablage der Lampe gelang, Korrektur bzw. weitere Vorbereitung scheiterten |
| `portal-integration-v11-second-run.json` | 4/5 native Speicherabläufe bestanden: Lampe samt Korrektur, Steckdose, Wasser, mehrere Anliegen. Unbekanntes Teil scheiterte. Zusätzlich unzulässige Versandformulierungen; deshalb keine Qualitätsfreigabe dieser früheren Version |
| `portal-integration-v11-live.json` | Neuer Prüfschritt; Abbruch durch Gateway HTTP 429 |
| `portal-integration-v11-unknown-live.json` und `portal-integration-v11-final-unknown.json` | Zwei gezielte unbekanntes-Teil-Prüfungen ohne vollständig bestandenen Ablauf; Format-/Vertragsfehler dokumentiert |
| `portal-integration-v11-release-live.json` — aktuelle Preview | Drei von fünf geplanten Fällen begonnen, **0/3 vollständig bestanden**, danach Abbruch bei HTTP 429. Unbekanntes Teil und mehrere Anliegen in dieser Endfassung nicht erneut ausgeführt |

**Aktuelle Preview im Detail:**

- Lampe: „lampe kaputt“ → „wohnzimmer“ → Vorbereitungswunsch führte zu einem tatsächlich gespeicherten nativen Eintrag. Titel: **Lampe / Leuchte · Wohnzimmer**, Kategorie: **Schaden / Reparatur**, Fachbereich: **Elektrik / Beleuchtung**, Raum: **Wohnzimmer**, Beginn: **Nicht angegeben**. Keine erfundene Anzahl. Doppeltes Submit erzeugte keinen zweiten Eintrag. Die anschliessende Korrektur „Nein, ich meinte Schlafzimmer.“ scheiterte mit `invalid_model_output`; der komplette Test gilt deshalb als fehlgeschlagen.
- Steckdose: Trotz „Die Steckdose im Büro funktioniert nicht …“ fehlte `location` in der akzeptierten Extraktion. Mercury fragte erneut nach dem Raum. Die anschliessende Vorbereitung scheiterte mit HTTP 503. Auch die semantische Prüfstufe erkannte das Weglassen von „Büro“ hier nicht. Es wurde kein korrekter Portaleintrag nachgewiesen.
- Wasser: HTTP 429 während der Verarbeitung. Kein Erfolg behauptet; weitere Modelltests gestoppt.

Originale Mercury-Beispiele der Endfassung zeigen die verbleibende Sprachqualität:

> „Da habe den Ort notiert. Möchten Sie das Anliegen jetzt für die Weitergabe vorbereiten?“

> „Ist ist eine wichtige Information, um den Schaden einzuschränken. Um das Anliegen vorzubereiten, fehlt noch eine wichtige Angabe: In welchem Raum befindet sich die Steckdose?“

Diese Texte werden nicht von lokalen Dialogvorlagen eingesetzt. Das Modell erzeugt sie unter dem bestehenden Prompt und Ausgabevertrag. Die Anwendung steuert jedoch, welche Kandidaten freigegeben und welche Aktionen angeboten werden. Ein zusätzlicher Prüflauf mit demselben Modell hat in diesen Beispielen weder das fehlende „Büro“ noch die verfrühte Vorbereitung zuverlässig verhindert. Mehr Prüfprompt allein ist deshalb kein nachgewiesener Qualitätsgewinn.

**Messwerte der aktuellen Preview:** 7 Modell-Nachrichten, 4 akzeptiert, 20 gestartete Modellaufrufe einschliesslich Prüfungen/Reparaturen. Gemessene HTTP-Dauer: Median **9,25 s**, Minimum **7,63 s**, Maximum **16,16 s**. Backend-Gesamtdauer: Median **5,14 s**. Diese Werte enthalten auch fehlgeschlagene Nachrichten; sie sind kein Browser-Rendering-Mass. Die frühere zweite Version hatte 6,89 s HTTP-Median, jedoch einen weniger strengen Prüfpfad und andere Antwortlängen. Daraus folgt keine isolierte Aussage über Modellgeschwindigkeit.

Kosten laut Gateway-Kontostand: gesamte Integration-1.1-Testserie **0,009848142 USD**, davon Abschlusstest **0,002983268 USD**, ausschliesslich aus bestehendem Guthaben. Restguthaben beim Abschluss **4,626517112 USD**. Keine neue Zahlung, kein zusätzlicher Schlüssel und keine Änderung kostenpflichtiger Einstellungen. Kontodifferenzen sind beobachtete Abrechnung, keine Garantie exakter Gesprächszuordnung bei paralleler Nutzung desselben Kontos.

**Technische Empfehlung für den nächsten Schritt:** Die native Formularbrücke, zentrale Feldabbildung, stabile IDs und Speicherbelege beibehalten. Keine weitere Prompt-Ausweitung und keine Freigabe als zuverlässig. Zunächst den Modellvertrag in einem isolierten Test mit denselben Rohgesprächen vereinfachen und messen: Gesprächsantwort und Fakten-/Aktionsentscheidung getrennt auswerten; eine zweite Entscheidung desselben Modells nicht als alleinigen Vollständigkeitsnachweis behandeln. Ein Formular erst durch die bestätigte aktuelle Aktion öffnen. Dafür sind zusätzliche Implementierung und vollständige echte Wiederholungsprüfungen nötig; das ist mit dieser Lieferung nicht als erledigt ausgewiesen.


Die Rohantwort `reply` in den Nachweisen stammt unverändert von Mercury. Begrüssung, Sicherheitsmeldung, Buttons, Statusanzeigen und Speicherbelege erzeugt die Anwendung. Ungültige Modellkandidaten werden nicht als erfolgreiche Antworten ausgegeben. Es gibt höchstens eine Vertragsreparatur, keinen simulierten Modell-Erfolg. Bei Anliegen sind normalerweise zwei Modellaufrufe erforderlich (Entscheidung und semantische Prüfung), mit gemeinsamer Entscheidungsreparatur und einer separaten Reparatur eines Prüfformats höchstens fünf; einfache allgemeine Nachrichten benötigen einen. Eine Vorbereitungsankündigung wird erst angezeigt, wenn das Originalformular tatsächlich befüllt wurde.

Streaming ist in dieser Integration nicht aktiviert: Antwort und ausführbare Metadaten werden gemeinsam validiert, bevor sie angezeigt bzw. ausgeführt werden. HTTP-Dauer und Modell-/Backend-Zeiten sind messbar. Die HTTP-Messung umfasst Gateway und Netzwerk; eine getrennte providerinterne Gateway-/Modelllatenz oder Browser-Zeit bis zum ersten Pixel kann daraus nicht seriös abgeleitet werden. Die künstlichen Testabstände betrugen zunächst 21, im Abschlusstest 65 Sekunden. Sie sind keine Antwortlatenz. Trotz dieses Abstands trat HTTP 429 auf; der Test wurde daraufhin gestoppt. Die konkrete freie Ratenquote wurde nicht ermittelt.

## Verbleibende Grenzen und Schnittstelle für Alexander

- Speicherung nur im bestehenden lokalen Portalbestand dieses Geräts. Keine zentrale Kundenakte, geräteübergreifende Synchronisation oder echte Einreichung.
- Bestehende Kundenansichten sind noch nicht schreibbar angebunden. MORA führt keinen eigenen Login, keine Kundenrollen und keine neue Anliegenverwaltung ein.
- Manuell geänderte und später widersprüchliche Portal-/Chatdaten werden zur Kontrolle angehalten; keine automatische Konfliktauflösung zulasten eigener Eingaben.
- Keine Fotoanalyse oder serverseitige Dateiablage. Anhänge werden nicht an das Sprachmodell gesendet.
- Reale Modellfehler betreffen nicht nur den Ton, sondern auch Faktenerfassung, Korrekturen und Aktionsabsicht. Die aktuelle Preview ist deshalb eine überprüfbare Entwicklungsfassung, keine vollständig zuverlässige Kundenfreigabe.

Für die spätere Kundenanbindung benötigt MORA folgende **noch nicht implementierte** geschützte Schnittstellen:

| Schnittstelle | Erforderlicher Vertrag |
|---|---|
| `POST /api/service-drafts` | Authentifizierte Kundenidentität und berechtigte Objektzuordnung serverseitig bestimmen. `Idempotency-Key`; Körper `{conversationId, issueId, revision, fields, fieldFacts}`. Antwort erst nach Persistenz: `{draftId, version, status:"draft", persisted:true, savedAt}` |
| `PATCH /api/service-drafts/:id` | Aktualisieren derselben ID; `If-Match`/erwartete Version, Idempotenz, Konflikt 409 ohne Überschreiben fremder Änderungen |
| `GET /api/service-drafts/:id` | Berechtigten gespeicherten Stand und Version zur tatsächlichen Kontrolle zurückgeben |
| Datei hinzufügen/entfernen | An `draftId` gebundene Upload-Berechtigung, serverseitige Typ-/Grössenprüfung, bestätigte Datei-ID und Status; Fehler führen nicht zu „hochgeladen“ |
| `POST /api/service-drafts/:id/submit` | Erst nach expliziter Kundenbestätigung und bestehender echter Übermittlung; Antwort mit eindeutiger `requestId`, `submittedAt` und bestätigtem Status. Ohne diese Schnittstelle kein Versandversprechen |

`fields` muss mindestens Anliegenart, Fachkategorie, Einrichtung, Defekt, Beschreibung, Bereich, Anzahl, Beginn, Umfang und weitere Angaben aufnehmen oder deren verlustfreie Abbildung verbindlich definieren. Fehlende, ausdrücklich unbekannte, unsichere und korrigierte Angaben müssen unterscheidbar bleiben. Fehlermeldungen benötigen maschinenlesbaren Code und kundenverständlichen Text; fehlende Rechte 403, Validierungsfehler 422, Versionskonflikt 409. Zugriff auf andere Kunden-/Objektdaten darf nicht durch Chatparameter entstehen.
