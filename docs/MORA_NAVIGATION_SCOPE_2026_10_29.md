# Navigation nach verfügbarem Zugang

## Befund
Preview eba684d meldete am 29.10.2026 um 07:42 UTC invalid_show_view nach einem Modellaufruf (2148 ms). Der aktive strukturierte Antwortvertrag erlaubte alle globalen Portalziele, während Ausführung und Kontext nur die für den Zugang verfügbaren Ziele erlaubten. Das genaue abgelehnte Ziel wurde nicht protokolliert.

## Änderung
compact-agent erzeugt die view-Zielauswahl aus capabilities.navigation des aktuellen Turns. Ohne Ziele entfällt die view-Alternative. Der gemeinsame show_view-Vertrag verwendet dieselbe gefilterte Navigationsliste. Die zusätzliche Laufzeitprüfung bleibt erhalten; es werden keine Zugriffsrechte erweitert. Portalwissen stellt klar, dass Navigation vor dem Klick nur angeboten wird.

## Prüfung
461 automatisierte Tests bestanden, TypeScript und Build (139 Dateien) erfolgreich. Neue Tests prüfen gültige Ziele, fremde Ziele, Toolvalidierung und Antworten ohne Navigation. Diese Tests verwenden ausdrücklich Mock-Modelltransporte und sind kein Nachweis natürlicher Modellantworten. Echte Preview-Prüfung wird separat dokumentiert.

## Grenzen
Persönliche Datenanbindung und Versand werden nicht hinzugefügt. Die Rollenanzeige ersetzt keine serverseitige Autorisierung. Allgemeine Gesprächsqualität ist mit dieser gezielten Navigationskorrektur nicht vollständig gelöst.

## Echte Preview-Prüfung
Getestete Preview: https://morada-mora-mngga4gfx-dianaporschke-1255s-projects.vercel.app/portal.html (Commit 88e4a4a).
Fünf echte Antworten, vier Rollen, alle HTTP 200 und ausschliesslich verfügbare Ziele: tenantSupport, tenantDocuments, ownerCases, cases. Viermal die Screenshotfrage zum Versandstatus, zusätzlich die Dokumentenfrage. Kein invalid_show_view. HTTP-Laufzeiten 6,55–8,67 Sekunden (kein Browser-TTFT). Beobachtete Kontodifferenz USD 0,0049227; kein exakt zugeordnetes Rechnungsprotokoll. Testobergrenze USD 0,06, bestehende Preview-Grenze unverändert.

Die Sprachqualität ist ausdrücklich nicht vollständig bestanden: Die Eigentümerantwort behauptet zunächst sichtbare Bearbeitungsstände und erwähnt erst danach die fehlende Anbindung; auch interne Rollen beschreiben eine nicht belegte Versandstatusanzeige. Navigationstexte sind trotz Klarstellung teilweise weiterhin ungenau. Diese Antworten stehen unverändert in docs/evidence/mora-navigation-scope-live-2026-10-29.json. Die strukturelle Zielbeschränkung funktioniert in diesen Tests, die semantische Wahrheit aller Antworttexte ist damit nicht garantiert.
