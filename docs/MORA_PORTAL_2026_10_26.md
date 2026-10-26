# MORA in der Portalversion vom 26. Oktober 2026

MORA ist in der neu gelieferten `26.10.2026_Portal.html` eingebunden. Der KI-Zugang bleibt separat blockiert: Die neue Preview ist zur Prüfung der Oberfläche verfügbar, aber derzeit keine funktionierende KI-Gesprächsversion.

## Quelle und Umfang

- Arbeitsbranch: `codex/mora-ai-2.0`; vor dem Schreiben GitHub geprüft, Ausgangscommit `d6503cd9b1d3e3042cd636469f6052e3bc59e5c6`.
- Gelieferte HTML: SHA-256 `1d8798759dbdce830c11717fc51f785a6719c3c72b3fe6006b802a5cac9a6614`, 4.518.774 Bytes.
- Integrierte HTML: SHA-256 `09a2a977582e7ca68369453bbe54770b8a937df0bedb66630ad16b71e6de37bb`, 4.564.114 Bytes. Die zurückgegebene Datei und `portal.html` sind bytegleich.
- Alle neuen Portalstile und Änderungen, einschliesslich Fachprüfungen, bleiben erhalten. Die Integration ergänzt einen gekapselten MORA-Block und vier optionale Identitäts-/Verlaufsangaben in der bestehenden Speicherfunktion. Nach deren Rücknahme entsteht bytegenau die gelieferte Datei; ein Regressionstest prüft ihren Hash.
- Kein neuer Servicebereich, kein zweiter Anliegenspeicher, keine Rollenänderung. Backend, Modellwahl und Prompts wurden bei dieser Übernahme nicht verändert. Keine Schlüssel im HTML.

## Übernommene Funktionen

Der vorhandene MORA-Button öffnet den Chat mit neutraler Begrüssung. Die vorhandenen Module für Gesprächszustand, zentrale Datenabbildung, aktuelle Aktionsbuttons, Speichernachweise und Anhänge sind in die HTML eingebettet. `POST /api/portal-chat` verwendet weiter das geschützte Gateway-Backend.

Die Anbindung verwendet `caseOpenForm`, `opsSaveRecord`, `companyCommit`, `portalReadStored`, `opsAfterSave` und `caseDetail`. Daten gelangen in das vorhandene Formular und anschliessend in `state.cases` beziehungsweise dessen nativen lokalen Speicher. Kunden prüfen und speichern das vorausgefüllte Formular. Speicherung wird erst nach erfolgreichem Rücklesen bestätigt. Korrekturen aktualisieren dieselbe Anliegen-ID; manuelle Formularänderungen werden nicht still überschrieben. Fotos verwenden das vorhandene Dateifeld des jeweiligen Anliegens.

| Gesprächsangabe | Vorhandenes Portalfeld |
| --- | --- |
| Anliegenart | `caseInfo.category`, beispielsweise Schaden / Reparatur |
| Einrichtung und Defekt | `title` und `description` |
| Raum / Bereich | `unit`, keine erfundene Liegenschafts- oder Einheiten-ID |
| Anzahl, Beginn, Symptome und weitere Angaben | `description`, unbekannte und nicht angegebene Werte unterscheidbar |
| Anhänge | native `attachments` desselben Anliegens |

Die lokalen Anliegenfunktionen stehen weiterhin nur in den vorhandenen Verwaltungsansichten zur Verfügung. Eigentümer- und Mieteransichten werden nicht umgangen oder eigenständig erweitert.

## Prüfung

- 329 vorhandene automatisierte Tests bestanden, darunter echte native Formular-/Speicheraufrufe in JSDOM für Lampe, Steckdose, Wasser, unbekannte Angaben, Raumkorrekturen, getrennte Anliegen, spätere Ergänzungen, Fotozuordnung, Doppelklicks, Speicherfehler, manuelle Konflikte und ausbleibende Empfangsbestätigung. Die Modellantworten dieser Regressionstests sind Testdaten; sie belegen keine Modellqualität.
- Ein zusätzlicher Quelltreuetest bestanden: gesamtes geliefertes Portal ausser den genannten MORA-Erweiterungen bytegleich erhalten. Insgesamt 330 bestandene Tests.
- Typprüfung und Build bestanden.
- Gerenderter Desktop-Browser: neue Portalübersicht geladen, MORA geöffnet, neutrale Begrüssung, Eingabefeld, Hinweis auf lokale Speicherung und Schliessen per Escape mit Fokusrückgabe geprüft. Keine Kundendaten angelegt. Kein echter Mobilgerätetest; bestehende responsive MORA-Regeln unverändert übernommen.
- Echter HTTPS-KI-Test: `lampe kaputt` an `google/gemini-3.8-flash`. Gateway HTTP 403 `no_providers_available`; Backend HTTP 503 `MODEL_UNAVAILABLE`. Eine Anfrage, keine generierte Antwort, keine gespeicherten Testanliegen, keine weiteren Modellversuche. Backendzeit 742 ms ist Fehlerlatenz und keine Modellgeschwindigkeit.
- Guthaben vor/nach: 4,625845368 USD, Gesamtnutzung 0,374154632 USD, beobachtete Differenz 0 USD. Keine Kosten-/Zugangs-/Schlüsseleinstellungen geändert. Nachweis: `evidence/portal-2026-10-26-live.json`.

## Preview und verbleibende Schnittstellen

Codecommit: `3e463bdcc795d769d038d7e7d251ef72d7f41dff`.

Preview: https://morada-mora-2e3144c37-dianaporschke-1255s-projects.vercel.app/portal.html

Deployment `dpl_8c2jzJcscF49pb14D1mXjx94pSSD`: READY, Preview (`target: null`), nur Entwicklungsbranch-Alias. Vercel-Anmeldung kann erforderlich sein. Kein Produktionsdeployment und kein Merge.

Offen bleiben der tatsächliche Gateway-Modellzugang sowie spätere serverseitige Schnittstellen für authentifizierte Mieter-/Eigentümerzuordnung, dauerhafte gemeinsame Anliegenablage, bestätigte Übermittlung und Datei-Upload. Die Integration behauptet weder Versand noch serverseitige Speicherung. Beim direkten Öffnen der HTML-Datei vom Rechner bleibt die Portaloberfläche verfügbar; KI-Anfragen benötigen die HTTPS-Preview mit ihrem Backend.
