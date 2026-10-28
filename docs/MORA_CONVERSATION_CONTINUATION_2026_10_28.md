# MORA: natürliche Fortsetzung nach kurzen Antworten

## Beobachteter Fehler und Herkunft

Die Kundenscreenshots zeigen die Folge «lampe geht nicht» → Rückfrage zum Raum → «wohnzimmer» → «Danke, die Lampe im Wohnzimmer lässt sich also nicht einschalten». Die Antwort wiederholt die erfassten Angaben und präzisiert den Defekt unbelegt. Auch die anschliessende Aufforderung, die Angabe in einem Anliegen zu ergänzen, setzt einen nicht bestätigten Formularstand voraus.

Der aktive Endpunkt `/api/portal-agent` verwendet `createCompactPortalAgent`. Dessen `plan.reply` gelangt unverändert an den Client; `assets/mora-portal-client.js` zeigt `data.reply` über `textContent`. Es gibt keinen lokalen Satzbaustein, der diese Bestätigung einfügt. Der Systemprompt untersagte routinemässige Dankesformeln bereits. Der Vorfall ist daher ein tatsächliches Befolgungsproblem des Modells. Die bisherige technische Prüfung kontrolliert Daten und Aktionsbehauptungen, nicht den Gesprächsstil.

## Begrenzte Korrektur

`lib/mora/portal/compact-agent.js` beschreibt jetzt den Zweck von `reply` direkt im tatsächlich an den Anbieter übergebenen Ausgabeschema. Eine kurze Antwort auf eine Rückfrage soll zum hilfreichen nächsten Schritt führen. Erbetene Zusammenfassungen und knappe Korrekturbestätigungen bleiben möglich. Die Formulierung muss zur aktiven Rolle und zur tatsächlich verfügbaren Aktion passen. Eine blosse Navigation darf keine Datenübernahme oder vorhandene Speicherung unterstellen.

Das Schema führt strukturierte Angaben und Aktionsentscheidung vor dem Antwortfeld auf. Das ist eine Anleitung innerhalb desselben Modellaufrufs, keine Garantie über interne Modellschritte. Die Feldbeschreibung für den Defekt verlangt zusätzlich, allgemeines Nichtfunktionieren nicht als konkreten Einschaltfehler oder als Diagnose auszugeben.

Keine neuen Antwortvorlagen, kein nachträgliches Streichen einzelner Wörter, keine zusätzliche KI-Formulierungsstufe, kein Modellwechsel. Portalrollen, Berechtigungsprüfung, Speicherung, Anliegenaktionen und Oberfläche bleiben unverändert.

## Prüfung

Die SDK-Regression prüft, dass der Anbieter die Beschreibungen im tatsächlichen `responseFormat` erhält. Eine weitere Prüfung erhält ausdrücklich gewünschte Zusammenfassungen und zitierte Dankesformulierungen unverändert; damit entsteht keine lokale Wortverbotsliste. Diese Tests beweisen die technische Übergabe, nicht die Qualität einer echten Modellantwort.

Der vorhandene Live-Runner unterstützt jetzt zusätzlich pro Rolle konfigurierte Nachrichten und protokolliert die tatsächlich zurückgegebenen Anliegenfelder und Aktionen. Die bestehende Kostenobergrenze bleibt unverändert. Ergebnisse des gezielten echten Gesprächstests werden nach Durchführung ergänzt.
