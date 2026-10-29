# MORA: Wiederholungen und unbelegte Defektpräzisierung

## Zwei getrennte Fehler

Die Kundenscreenshots zeigen «lampe geht nicht» → Rückfrage zum Raum → «wohnzimmer» → «Danke, die Lampe im Wohnzimmer lässt sich also nicht einschalten».

Der vollständige Satz stammt vom Modell. Der aktive Endpunkt `/api/portal-agent` verwendet `createCompactPortalAgent`; dessen `plan.reply` gelangt unverändert an den Client, der `data.reply` über `textContent` anzeigt. Der Systemprompt untersagt routinemässige Dankesformeln bereits. Dass trotzdem eine solche Formulierung erscheint, ist ein tatsächliches Befolgungsproblem. Die technische Prüfung kontrolliert Daten und Aktionsbehauptungen, nicht zuverlässig den Gesprächsstil.

Zusätzlich existierte eine konkrete lokale Ursache für den wiederkehrenden Defektwortlaut: `applyPatch` in `lib/mora/issue-state.js` ersetzte bei Lampen «geht nicht», «geht gar nicht» und «funktioniert nicht» automatisch durch «Lampe lässt sich nicht einschalten.». Die gleiche Regel erfasste auch Formulierungen mit dem Präfix «Lampe». Dieser genauere, nicht belegte Defekt gelangte in den Gesprächszustand, den nächsten Modellkontext und die Portalbeschreibung. Die erste, auf den Portalordner begrenzte Prüfung hatte diese gemeinsame Zustandsregel übersehen.

## Nachweislich fehlgeschlagener Formulierungsversuch

Commit `2944f882d0e063b1628a5a263d94dcfffe63575d` ergänzte den Zweck von `reply` direkt im Ausgabeschema und stellte Angaben/Aktionsentscheidung vor das Antwortfeld. Eine Feldbeschreibung sollte die unbelegte Defektpräzisierung verhindern. Die lokalen Tests waren erfolgreich, der echte Test aber nicht.

Der geschützte Preview-Lauf verwendete das unveränderte Modell `anthropic/claude-haiku-5.5`. Für Mieter und Eigentümer waren jeweils «lampe geht nicht», «wohnzimmer», «nein, schlafzimmer» geplant. Tatsächlich wurden fünf Nachrichten verarbeitet, bevor der Lauf beim ersten HTTP-Fehler automatisch stoppte:

- Mieter: alle drei HTTP 200, aber unnötige Mehrfachfragen und erneut «Danke, die Lampe im Wohnzimmer haben wir vermerkt». Auch die Raumkorrektur begann mit «Danke für die Korrektur». Der Raum wurde im Datensatz richtig zu Schlafzimmer geändert.
- Eigentümer: erste Antwort HTTP 200. Die Folgeantwort begann ebenfalls mit «Danke … notiert»; die bestehende Wirkungsprüfung verwarf sie als `unconfirmed_success` (HTTP 503). Die letzte geplante Korrektur wurde nicht mehr aufgerufen.
- Die ursprüngliche lokale Umdeutung blieb in den zurückgegebenen Daten sichtbar. Eine zusätzliche Modellanweisung konnte sie nicht verhindern.

[Vollständige tatsächliche Antworten und Daten](evidence/mora-conversation-continuation-live-2026-10-28.json). Fünf Nachrichten verursachten sechs Modellaufrufe einschliesslich der vorhandenen Wirkungsprüfung. Beobachtete Änderung des Gateway-Kontostands: USD 0.0052632. Das ist eine Kontostandsdifferenz, keine separat zugeordnete Rechnung. Die bestehende USD-2-Testgrenze wurde nicht erhöht.

**Der Formulierungsversuch wurde zurückgenommen.** Es gibt keine neue Antwortvorlage, Wortverbotsliste oder zusätzliche KI-Formulierungsstufe. Ein erfolgreicher HTTP-Aufruf und bestandene technische Tests werden hier ausdrücklich nicht als Nachweis guter Gesprächsqualität gewertet.

## Tatsächliche Korrektur und Grenze

Die unbelegte Umdeutung in `lib/mora/issue-state.js` wurde entfernt. Die lokale Verarbeitung bewahrt nun den vom Modell gelieferten berichteten Defekt, statt selbst einen Einschaltfehler hinzuzufügen. Ein ausdrücklich genannter Einschaltfehler bleibt erhalten. Die Regression prüft fünf Varianten über die tatsächlichen Reducer, den nächsten Modellkontext, eine Raumkorrektur und das Portal-Mapping.

`scripts/portal-integration/role-live.py` kann jetzt pro Rolle konfigurierte Nachrichten ausführen und die zurückgegebenen Anliegenfelder protokollieren. Modell, Portalrollen, Berechtigungen, Speicherung und Oberfläche wurden nicht verändert. Früher gespeicherte Datensätze werden nicht rückwirkend umgeschrieben; für einen neuen Vergleich ist ein neues Gespräch nötig.

Die Entfernung der lokalen Regel behebt die von der Anwendung hinzugefügte Präzisierung. Sie garantiert nicht, dass das Modell selbst nie genauer formuliert, und löst insbesondere das mechanische «Danke …» noch nicht zuverlässig. Dafür ist eine echte vergleichende Prüfung einer veränderten Gesprächssteuerung nötig; eine weitere unbelegte Erfolgsmeldung oder pauschale Ersatzformulierung wäre nicht gerechtfertigt.

Automatisierte Prüfung nach Entfernung der Regel und Rücknahme des Formulierungsversuchs: **456 Tests bestanden**, Typprüfung bestanden, Build bestanden (137 Dateien geprüft). Die neue Regression deckt allgemein gemeldetes Nichtfunktionieren und ausdrücklich gemeldeten Einschaltfehler getrennt ab.
