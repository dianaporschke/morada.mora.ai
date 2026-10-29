# Geprüftes Portalwissen für MORA

Die native HTML-Implementierung rendert die Kunden-Anliegen-, Dokumenten- und Zahlungstabellen mit einer leeren Zeilenliste. `tenantContract()` zeigt eine vorbereitete Vertragsübersicht; es gibt dort keinen PDF-Download. Die Kunden-Anliegentabellen enthalten keine Bearbeitungs- oder Fotoanhangsfunktion. Diese Befunde beschreiben die bereitgestellte Preview, nicht die tatsächlichen Unterlagen eines Kunden bei MORADA.

`lib/mora/portal/view-knowledge.js` ergänzt serverseitig die tatsächlich erlaubten Navigationsziele um Implementierungsstand, Datenanbindung, vorhandene Aktionen und unbekannten persönlichen Inhalt. Konkrete Hinweise unterscheiden Mietvertragsdaten von Vertragsdateien, Zahlungsverlauf von Nebenkostenabrechnungen und eine vorbereitete Anliegenansicht von einer angebundenen persönlichen Meldung.

Der gemeinsame Kontext in `agent.js` wird sowohl von der kompakten aktiven Architektur als auch vom Werkzeugagenten verwendet. `service.js` erhält denselben Navigationskatalog. `audience.js` führt die Wissensregeln allen drei Gesprächsvarianten zu. Es werden keine Zugriffsrechte hinzugefügt. Interne lokale Anliegenfunktionen bleiben bestehen. Das Portal-HTML, seine Funktionen, Rollenverwaltung, Modell, Budgetgrenze und Schlüssel bleiben unverändert.

Die Tests vergleichen die leere Tabellenimplementierung mit dem Katalog und prüfen die tatsächliche Übergabe im Modellkontext, die Beschränkung auf vorhandene Navigationsziele, ausgeschlossenen Finanzdatenzugriff und erhaltene interne Anliegenfunktionen.

Keine neuen kostenpflichtigen KI-Tests: Die bestehende USD-2-Testfreigabe ist nahezu ausgeschöpft. Die technische Übergabe lässt sich automatisiert prüfen; eine verbesserte Befolgung durch das Modell ist für diese Änderung noch nicht durch echte Antworten belegt. Frühere Tests zeigten, dass Vorgaben allein keine fehlerfreie Gesprächsqualität garantieren.

Bei einer späteren Portaländerung muss dieser versionsgebundene Katalog mit den tatsächlichen Schnittstellen aktualisiert werden. Kundendaten dürfen weiterhin nur aus separat authentifizierten und objektbezogen freigegebenen Serverabfragen stammen.
