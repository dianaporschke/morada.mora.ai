# MORA: vier Gesprächsperspektiven

## Ursache

Die bestehende HTML-Integration trennte Chatverläufe nach `bridge.role()` und filterte Navigationsziele. Der Request enthielt aber keine ausdrückliche Portalrolle. Die Backend-Zugriffsschicht kannte bei authentifizierten Zugängen die Rolle, gab sie jedoch nicht an die Gesprächssteuerung weiter. Der generische Prompt sprach gleichzeitig Mieter und Eigentümer an. Das Modell musste die Perspektive aus Routennamen erraten; dadurch erschienen im Eigentümerzugang unpassende Mieterbeispiele.

## Korrektur

- Der Client sendet bei jeder Anfrage die aktuelle `viewRole` (`tenant`, `owner`, `manager`, `admin`). Diese Angabe dient ausschliesslich der Gesprächsperspektive und vergibt keine Zugriffsrechte.
- Eine serverseitig authentifizierte Rolle hat immer Vorrang. In der unabhängigen HTML-Preview gilt die gewählte Ansicht als ausdrücklich unbestätigte Gesprächsperspektive.
- `lib/mora/portal/audience.js` enthält vier fachliche Perspektiven, keine vorformulierten Antworten. Mieter: eigenes Mietverhältnis; Eigentümer: eigenes betreutes Eigentum und Mietermeldungen; Bewirtschaftung: zugewiesene Mandate und Fälle; Administration: interne Organisation innerhalb expliziter Freigaben.
- Derselbe Kontext gelangt in die kompakte Standardarchitektur, den älteren Agenten und den Legacy-Endpunkt. Er wird bei jeder Nachricht übergeben und im Anwendungsstand kenntlich gemacht.
- Ein Satz im Chat ändert die Rolle nicht. Fragen über Mieter machen den fragenden Eigentümer nicht zum Mieter. Fremde Konten, zusätzliche Immobilien oder Rechte werden nicht unterstellt.
- Eine Sitzung kann nicht zwischen unterschiedlichen Gesprächsrollen wiederverwendet werden. Bestehende ältere Eigentümer-/Mieter-Previews erhalten einen begrenzten Kompatibilitätshinweis aus ihren eindeutigen Navigationszielen; bei fehlenden oder widersprüchlichen Hinweisen bleibt MORA neutral.
- Begrüssungen bleiben natürlich und offen. Keine automatisch eingefügte Defektliste, keine vier starren Dialogbäume und keine zusätzlichen Modellaufrufe pro normaler Nachricht.

## Unveränderte Grenzen

Rechnungsinhalte und persönliche Finanzdaten bleiben Navigation allein. Die Preview-Rollenwahl ist keine Anmeldung. Persönliche Anliegenauskünfte brauchen weiterhin Alexanders echte Authentifizierungs- und Objektfreigabeschnittstelle. Das Modell, Gateway, API-Schlüssel, Budgetgrenzen, Portaldesign und bestehende Anliegenverarbeitung wurden nicht umgestellt.

## Prüfung

`tests/portal-audience.test.js` prüft die vier Rollen über den echten API-Handler, Vorrang der authentifizierten Rolle, widersprüchliche Chatbehauptungen, Rollenwechsel, alte Clients, unbekannte Rollen sowie den Rollenkontext im Standard- und Legacy-Modellaufruf. Die vorhandenen HTML-Integrationstests prüfen zusätzlich, dass jede der vier Portalansichten ihre tatsächliche Rolle mitsendet. Tests mit vorgegebenem Modelltransport belegen die Datenübergabe, nicht die Qualität echter Modellformulierungen.

Ein getrennter Live-Prüflauf ist über `scripts/portal-integration/role-live.py` möglich: vier Rollen, je Begrüssung und Folgefrage, bestehende serverseitige Budgetgrenze plus maximal USD 0.25 für den gesamten Lauf. Keine Freigabeerhöhung und keine automatische Wiederholung fehlgeschlagener Modellaufrufe. Resultate werden nach erfolgreicher tatsächlicher Durchführung getrennt dokumentiert.
