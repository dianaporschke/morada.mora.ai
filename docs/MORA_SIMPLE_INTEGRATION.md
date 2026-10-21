# MORA C – Gesprächssteuerung und spätere HTML-Einbindung

Die bestehende App von Diana ist die Testumgebung. Alexanders eigenständiges, bereits mobilfähiges Portal wird aktuell in einer HTML-Datei mit seinen Integrationen entwickelt. Es ist nicht angebunden und wird durch diese Änderung nicht bearbeitet. C ist über dieselbe Testoberfläche mit `?mora=c` erreichbar; die bisherige API bleibt separat erhalten.

## Gesprächsentscheidung

`POST /api/chat-simple` erhält `{message, session?}` und liefert `reply`, `issues`, `issue`, `actions`, die neue signierte `session`, tatsächliche Fähigkeiten und Messwerte. Die Oberfläche gibt die Antwort als Text aus. Keine API-Schlüssel im HTML oder Browser.

Ein Modellaufruf erzeugt Antwort, neue belegte Fakten und optionale Aktionsvorschläge zusammen. Die Anwendung projiziert diese Daten auf eine Kopie des Zustands. Quellen, getrennte Anliegen und Referenzen werden geprüft. Eine semantische Mercury-Prüfung kann ausschliesslich Verstösse melden; sie erzeugt keine Formulierung und keine Rückfrage. Nur die gemeinsam akzeptierte Entscheidung wird gespeichert. Einmalige Vertragsreparatur ist erlaubt; nach erneutem Fehler folgt ein expliziter technischer Fehler mit unverändertem bisherigen Zustand. Ein Empfangsfehler ist kein Modell-Erfolg.

Der bisherige zweite Formulierungsauftrag, ein eingefrorener `questionKey=null` und der Rückfall auf eine vorläufige Formularantwort kommen im C-Pfad nicht vor. Der gemeinsame bestehende Faktenreducer und die zentrale Entwurfszuordnung bleiben erhalten. Unsichere Werte werden in der Zusammenfassung als unsicher angezeigt, auch wenn ihre bisherige Zahl für die Historie erhalten bleibt. Lokale Formularänderungen bleiben geschützt.

Bestehende Gefahrenerkennung wird von Server und Browser aus derselben Datei importiert. Der Browser zeigt den ersten einschlägigen Sicherheitshinweis sofort und einmal pro Gefahrenart/Chat. Die eigentliche Modellantwort folgt kontextbezogen; neue Angaben wie ein Kind im Zimmer werden nicht durch denselben Universaltext ersetzt. Der Server behält den Gefahrenkontext, bis eine tatsächliche Rücknahme vorliegt. Abschalten bedeutet nicht automatisch behobene Gefahr. Bei KI-Ausfall bleibt ein erforderlicher Sicherheitshinweis als Anwendungshinweis erhalten.

## Lokaler Speicherablauf der Test-App

1. Kundenklick auf eine zulässige Vorbereitung/Aktualisierung: `POST /api/chat-simple` mit `{actionId:"prepare-request", session}`. Es entsteht ein signierter Schreibauftrag mit `operationId`, `issueId`, `draftId`, `revision`, `contentHash` und Scope `this_device_test_app`. Das ist noch kein gespeicherter Entwurf. Derselbe Inhalt erhält dieselbe Operations-ID; der Entwurfsschlüssel bleibt immer die Anliegen-ID.
2. Die Testoberfläche bildet den Entwurf mit `mapServiceDraft` ab, schreibt mit IndexedDB `put` und liest den Datensatz erneut. Schlüssel, Quellrevision, Quellinhalt und Formularwerte müssen übereinstimmen. Erst dann ist ein lokaler Schreib-/Lesebeleg zulässig.
3. Bestätigung per `{session, draftReceipt:{operationId, issueId, draftId, revision, contentHash, status:"portal_received", conflictFields:[]}}`. Der Server akzeptiert nur den passenden zuvor vergebenen Auftrag zur aktuellen Revision. Historische interne Feldnamen bleiben zur Kompatibilität erhalten: `portal_received` bedeutet hier ausschliesslich die lokale Ansicht dieser Test-App, niemals Alexanders Portal. Der Modellkontext verwendet dafür `local_saved` und den ausdrücklichen Gerätescope.
4. Eine erfolgreiche lokale Bestätigung erzeugt einen festen operativen Belegtext, keinen simulierten KI-Erfolg. Derselbe Beleg ist idempotent. Neue Chatangaben verändern den vorhandenen Entwurf erst durch eine weitere bestätigte Aktualisierung unter derselben Entwurfs-ID. Es gibt im C-Pfad keine automatische Entwurfsaktualisierung beim Themenwechsel oder Chatreset.
5. Bei Schreib-/Lesefehlern wird `status:"error"` gemeldet. Ein verlorener Empfang der Bestätigung erhält den wirklich gespeicherten lokalen Entwurf und den ausstehenden Auftrag; vor der nächsten Modellnachricht wird der Status erneut abgeglichen. Ein gültiger älterer gespeicherter Entwurf wird durch eine fehlgeschlagene Aktualisierung nicht als nie vorhanden dargestellt.

Der Browser ist in diesem Scope die Instanz für seinen eigenen Gerätespeicher. Die serverseitige Plausibilisierung des Auftrags ist keine unabhängige serverseitige Prüfung einer IndexedDB-Datenbank. Ein vom Browser gelieferter Beleg berechtigt deshalb ausschliesslich Aussagen über lokalen Speicher. Er ist ausdrücklich keine Bestätigung über Versand, einen MORADA-Vorgang, eine Reparatur oder eine Übernahme ins echte Portal.

## Einbindung in Alexanders HTML-Portal

Die bestehende HTML-Oberfläche kann später die Chat-API verwenden und ihre Anzeige nach `reply`, `actions` und `issues` aktualisieren. Die aktuelle `createMora`-Oberfläche setzt die DOM-Elemente der Test-App voraus; sie ist keine bereits fertige Einbindung in Alexanders HTML. Für dessen Struktur wird ein kleiner Anzeige-/Speicheradapter benötigt. Authentifizierung und Berechtigungen müssen aus dem echten Portal kommen; keine Nutzerdaten aus Platzhaltern ableiten.

Benötigter Speichervertrag für Alexander:

| Aufruf | Eingabe | Erforderlicher bestätigter Rückgabewert |
| --- | --- | --- |
| Anliegenentwurf speichern/aktualisieren | stabile `issueId`, `operationId` als Idempotenzschlüssel, `sourceRevision`, Quellhash, zentrale gemappte Felder samt `fieldFacts`/Unsicherheiten und eigener Bearbeitung | `draftId`, gespeicherte Version, `storedAt`, Quellhash, `receiptId`, Scope `portal` |
| Gespeicherten Entwurf prüfen | `draftId`, erwartete Version/Quellhash | tatsächlich gespeicherte Felder und Version oder konkreter Fehler |
| Anliegen wirklich übermitteln | bestätigter Entwurf, eigene Übermittlungs-Idempotenz, authentifizierter Kunden-/Objektkontext | echte serverseitige `requestId`, bestätigter Status, Zeitstempel und Zustellbeleg |

Eine Speicherschnittstelle muss wiederholte Aufrufe derselben Operation auf denselben Datensatz führen, Konflikte mit manuellen Änderungen melden und Objektberechtigungen serverseitig prüfen. Ihr Beleg wird über einen vertrauenswürdigen Serveradapter in den MORA-Zustand übernommen. Ein frei vom Browser behaupteter Portalerfolg genügt für diesen späteren Scope nicht.

Speicherung, Portalübernahme und tatsächliche Übermittlung bleiben getrennte Vorgänge. Erst eine tatsächlich verfügbare und bestätigte Übermittlung erlaubt eine entsprechende Aussage. Bis diese Schnittstelle existiert, kann MORA weder versenden noch Termine, Handwerker oder spätere Rückmeldungen auslösen. Die jetzige Testversion verändert keine Portal-Datenbank und keine allgemeine Benutzerverwaltung.

## Prüfungen und Grenzen

Automatisierte Vertrags-/Browsermodultests verwenden gekennzeichnete Fixtures und eine IndexedDB-Testimplementierung. Sie prüfen unter anderem doppelte Aktionen, ungültige Aufträge, Korrekturen, unbekannte Angaben, getrennte Anliegen, Schreib-/Lesefehler, Aktualisierung derselben ID und verlorene Bestätigungen. Sie ersetzen keine echten Modellgespräche. Der separate Livevergleich mit den unveränderten 20 Phase-1-Gesprächen und acht semantischen Gegenproben ist vorbereitet, aber beim Abschluss noch nicht durchgeführt. Der technische Pilot ist unvollständig; den genauen belegten Stand dokumentiert `MORA_PHASE2_REPORT.md`. Ein semantischer Prüfer kann sich selbst irren; seine Zuverlässigkeit ist mit dem bisherigen Pilot nicht nachgewiesen.
