# MORA: vier Gesprächsperspektiven

## Ursache

Die bestehende HTML-Integration trennte Chatverläufe nach `bridge.role()` und filterte Navigationsziele. Der Request enthielt aber keine ausdrückliche Portalrolle. Die Backend-Zugriffsschicht kannte bei authentifizierten Zugängen die Rolle, gab sie jedoch nicht an die Gesprächssteuerung weiter. Der generische Prompt sprach gleichzeitig Mieter und Eigentümer an. Das Modell musste die Perspektive aus Routennamen erraten; dadurch erschienen im Eigentümerzugang unpassende Mieterbeispiele.

## Korrektur

- Der Client sendet bei jeder Anfrage die aktuelle `viewRole` (`tenant`, `owner`, `manager`, `admin`). Diese Angabe dient ausschliesslich der Gesprächsperspektive und vergibt keine Zugriffsrechte.
- Eine serverseitig authentifizierte Rolle hat immer Vorrang. In der unabhängigen HTML-Preview gilt die gewählte Ansicht als ausdrücklich unbestätigte Gesprächsperspektive.
- `lib/mora/portal/audience.js` enthält vier fachliche Perspektiven, keine vorformulierten Antworten. Mieter: eigenes Mietverhältnis; Eigentümer: eigenes betreutes Eigentum und Mietermeldungen; Bewirtschaftung: zugewiesene Mandate und Fälle; Administration: interne Organisation innerhalb expliziter Freigaben.
- Derselbe Kontext gelangt in die kompakte Standardarchitektur, den älteren Agenten und den Legacy-Endpunkt. Er wird bei jeder Nachricht übergeben und im Anwendungsstand kenntlich gemacht.
- Auch Funktionsbeschreibungen hängen von der aktuellen Ansicht ab. Die vorherige pauschale Aussage, das Portal könne immer lokale Anliegen samt Fotos vorbereiten, wurde auf `capabilities.localCases=true` begrenzt. Im derzeitigen Eigentümer-/Mieterbereich darf MORA nur die tatsächlich vorhandene Anliegenansicht anbieten. Fachliche Zuständigkeit einer Rolle ist keine ausführbare Aktion.
- Ein Satz im Chat ändert die Rolle nicht. Fragen über Mieter machen den fragenden Eigentümer nicht zum Mieter. Fremde Konten, zusätzliche Immobilien oder Rechte werden nicht unterstellt.
- Eine Sitzung kann nicht zwischen unterschiedlichen Gesprächsrollen wiederverwendet werden. Bestehende ältere Eigentümer-/Mieter-Previews erhalten einen begrenzten Kompatibilitätshinweis aus ihren eindeutigen Navigationszielen; bei fehlenden oder widersprüchlichen Hinweisen bleibt MORA neutral.
- Begrüssungen bleiben natürlich und offen. Keine automatisch eingefügte Defektliste, keine vier starren Dialogbäume und keine zusätzlichen Modellaufrufe pro normaler Nachricht.

## Unveränderte Grenzen

Rechnungsinhalte und persönliche Finanzdaten bleiben Navigation allein. Die Preview-Rollenwahl ist keine Anmeldung. Persönliche Anliegenauskünfte brauchen weiterhin Alexanders echte Authentifizierungs- und Objektfreigabeschnittstelle. Das Modell, Gateway, API-Schlüssel, Budgetgrenzen, Portaldesign und bestehende Anliegenverarbeitung wurden nicht umgestellt.

## Prüfung

`tests/portal-audience.test.js` prüft die vier Rollen über den echten API-Handler, Vorrang der authentifizierten Rolle, widersprüchliche Chatbehauptungen, Rollenwechsel, alte Clients, unbekannte Rollen sowie den Rollenkontext im Standard- und Legacy-Modellaufruf. Die vorhandenen HTML-Integrationstests prüfen zusätzlich, dass jede der vier Portalansichten ihre tatsächliche Rolle mitsendet. Tests mit vorgegebenem Modelltransport belegen die Datenübergabe, nicht die Qualität echter Modellformulierungen.

Automatisierte Prüfung des finalen Codes: **455 Tests bestanden**, TypeScript-Prüfung bestanden, Build bestanden (137 Dateien geprüft). Die Tests enthalten auch Rollenwechsel, manipulierte Rollenangaben und unveränderte native Portalbereiche. Sie ersetzen keine spätere Prüfung mit echten authentifizierten Kundenkonten.

## Tatsächliche Modelltests am 28. Oktober 2026

Getesteter Code: `1345c8aa9e263d2693e227776172fc7ee60d2578`. Preview: https://morada-mora-d2bkv7vc8-dianaporschke-1255s-projects.vercel.app/portal.html. Der abschliessende Dokumentationscommit ändert diesen Anwendungscode nicht.

Der finale Lauf über `scripts/portal-integration/role-live.py` verwendete das unveränderte aktive Modell `anthropic/claude-haiku-5.5`. Jede Rolle erhielt dieselben zwei Nachrichten: «hey» und «Wobei können Sie mir in diesem Portalbereich helfen?». Alle acht Antworten kamen mit HTTP 200 zurück. Die folgenden Auszüge sind echte Modellantworten, keine Testvorlagen:

| Zugang | Auszug aus der Antwort auf die Folgefrage | Beobachtung |
| --- | --- | --- |
| Mieter | «bei Fragen rund um Ihre Mietwohnung» | Eigene Mietansichten; Zahlungsdaten werden nicht ausgelesen. |
| Eigentümer | «die Anliegenansicht für Unterhalt und Meldungen zu Ihren Liegenschaften» | Eigentümerperspektive; fehlende persönliche Datenanbindung wird benannt. |
| Bewirtschaftung | «Meldungen zu Schäden oder Defekten in einer Liegenschaft oder Einheit» | Betreute Fälle; lokale Vorbereitung nur in der tatsächlich dafür ausgestatteten Ansicht. |
| Administration | «bei Verwaltungs- und Bewirtschaftungsabläufen» | Interne Perspektive und vorhandene Ansichten; keine Behauptung über Versand oder Buchung. |

Vollständige Antworten, Tokenzahlen und Laufzeiten: [finale Live-Evidenz](evidence/mora-role-final-live-2026-10-28.json). Acht Antworten verursachten elf Modellaufrufe: bei drei Funktionsbeschreibungen prüfte die bereits bestehende `effect_review`-Validierung zusätzlich die Aussage. Die Rollenübergabe selbst fügt keinen Modellaufruf hinzu.

Die gemessene Backend-Gesamtzeit lag bei 1,37–6,76 Sekunden, davon 1,19–6,58 Sekunden Modellverarbeitung laut bestehender Instrumentierung. Der externe HTTP-Client mass 5,59–11,24 Sekunden inklusive Netzwerk und geschütztem Deployment-Zugang. Dies ist keine Messung der ersten sichtbaren Browserantwort; Gateway- und reine Anbieterzeit werden hier nicht getrennt ausgewiesen. Im aktuellen Arbeitsschritt wurden keine neuen manuellen Desktop-/Mobiltests durchgeführt; die Browserintegration wurde durch die bestehenden automatisierten HTML-Tests geprüft.

Der finale Lauf hatte zusätzlich zur unveränderten bestehenden USD-2-Testfreigabe eine eigene Grenze von USD 0.02. Die beobachtete Änderung des Gateway-Kontostands betrug USD 0.009326. Das ist eine Kontostandsdifferenz, keine separat zugeordnete Rechnung; zeitversetzte Verbuchung oder parallele Nutzung sind damit nicht ausgeschlossen. Es wurden keine Guthaben-, Modell- oder Tarifeinstellungen verändert.

## Vorheriger Fehler und verbleibende Grenzen

Im ersten Live-Lauf kam die Mieterbegrüssung durch, die Folgeantwort wurde mit `unconfirmed_success` von der bestehenden Wirkungsprüfung verworfen (HTTP 503). Die verworfene Modellformulierung wurde nicht aufgezeichnet; ihre genaue Behauptung lässt sich daher nicht nachträglich belegen. Der Code enthielt allerdings nachweislich ein widersprüchliches pauschales Angebot lokaler Anliegenvorbereitung, obwohl diese Fähigkeit in der Mieter-/Eigentümeransicht fehlt. Diese Aussage wurde im finalen Code an die echten Fähigkeiten gebunden. Ein gesonderter Eigentümertest vor dieser letzten Korrektur war bereits erfolgreich. Beide ursprünglichen Ergebnisse bleiben erhalten: [erster Lauf](evidence/mora-role-live-2026-10-28.json), [Eigentümertest](evidence/mora-role-owner-live-2026-10-28.json).

Die vier abschliessenden kurzen Gespräche belegen eine passende Rollenperspektive in diesen Fällen. Sie belegen weder fehlerfreie Antworten auf beliebige Fragen noch die produktive Mandantentrennung. Einige Funktionsbeschreibungen sind weiterhin ausführlich und technisch formuliert. Persönliche Eigentümerauswertungen und tatsächliche Anliegenstände bleiben gesperrt, bis der Server die angemeldete Identität, Rolle und ausdrücklich freigegebenen Objekte aus Alexanders Portal liefert. Dazu gilt weiterhin der Vertrag in [MORA_PORTAL_ACCESS_2026_10_28.md](MORA_PORTAL_ACCESS_2026_10_28.md).
