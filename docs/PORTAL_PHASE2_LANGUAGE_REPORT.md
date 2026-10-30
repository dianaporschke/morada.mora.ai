# MORADA Portal · Phase 2 / Einstellungen 2.1

Stand: 30. Oktober 2026. Ausgangsstand: `84c0be5a6cf2dbbdc101c9750cc404853fa84eff` auf `codex/mora-ai-2.0`.

## Ergebnis

Eine gemeinsame Sprachverwaltung steuert Deutsch (Schweiz), Englisch und Französisch. Sie umfasst die Einstiegsvorschau, Hauptnavigation, alle vorhandenen Menüziele der vier Vorschaurollen, Dashboard, Portfolio, Bewirtschaftung, Dokumente, Finanzen, Organisation, Formulare, Dialoge, Filter, Leerzustände, MORADA-Systemmeldungen und die MORA-Oberfläche. Vorhandene geplante Ansichten bleiben als solche gekennzeichnet.

Die Ressourcen enthalten 8’125 MORADA-Oberflächentexte. Deutsch ist die Quellsprache und der kontrollierte Rückfall für zukünftige fehlende Schlüssel. Englisch und Französisch besitzen jeweils dieselben Platzhalter wie der deutsche Ausgangstext. Eigennamen, Eingaben, hochgeladene Dateinamen, Dokumentinhalte, Vertragsoriginale und vorhandene Chatnachrichten werden nicht nachträglich übersetzt.

## Technik und Erweiterung

- `assets/portal-i18n-core.js`: zentrale Übersetzung, parametrisierte Nachrichten, Zahlen- und Datumsformate (`de-CH`, `en-GB`, `fr-CH`). HTML-Vorlagen übersetzen ihre festen Texte und zugänglichen Beschriftungen; eingefügte Kundendaten bleiben unverändert.
- `assets/i18n/part-*.json` und `additional.json`: zentrale Übersetzungsressourcen. `messages.json` wird daraus erstellt. Neue Texte benötigen beide Übersetzungen; dynamische Werte werden mit `{0}`, `{1}` usw. eingefügt.
- `assets/portal-i18n-browser.js`: einzige Sprachpräferenz unter `localStorage['morada.portal.language.v1']`. Ein späterer Kontoanschluss kann den gekapselten Lade-/Speicheradapter ersetzen. Keine neue Datenbank oder Anmeldung.
- `morada:languagechange`: aktualisiert Navigation, aktuelle Seite, Einstellungen und MORA ohne Seitenreload. Vorhandene Datensätze, Auswahlwerte und Dialogeingaben werden nicht umgeschrieben.
- `assets/portal-language-controls.js`: Globus-Dropdown, markierte aktuelle Sprache, Tastaturbedienung und Begrenzung auf die Bildschirmbreite. Einstellungen und Kopfzeile verwenden dieselbe Präferenz.
- `node scripts/build-i18n.mjs`: baut Ressourcen und die Inline-Sprachverwaltung. `npm run build` führt dies ebenfalls aus. Die bereits bestehende MORA-Bündelung erfolgt weiterhin über `node scripts/integrate-portal.mjs portal.html`.

## Einstellungen 2.1

Die vertikale Navigation und sechs Bereiche bleiben erhalten. Ein zentraler Vorschauhinweis steht unten in der Navigation. Wiederholte technische Hinweise und die statische Design-Karte wurden entfernt. Die drei Sprachoptionen sind aktiv, die aktuelle Sprache ist markiert. „Meine Zugänge“ zeigt die aktuelle Ansicht und die spätere gemeinsame Zuordnung von Eigentümer- und Mieterrollen mit einem zusammengefassten Leerzustand. Eine Rollenwahl verleiht weiterhin keine Berechtigungen. Innenabstände und Karten sind kompakter; längere französische Texte umbrechen.

## MORA

Der Client sendet `language: de | en | fr` an die bestehenden Portal-Endpunkte. Der Server validiert die Auswahl und übergibt sie auch an Antwortkorrekturen. MORA soll diese Sprache verwenden und ausdrückliche anderssprachige Wünsche berücksichtigen. Begrüssung, Eingabefeld, Hinweise, Aktionen und Systemfehler sind lokalisiert. Kundennachrichten und vorhandene Antworten behalten ihren Originaltext.

Modellwahl, Gateway-Zugang, vorhandene Kostengrenzen, Rollenprüfung, bestehende lokale Speicherung und die übrigen KI-Prozesse bleiben bestehen. Englische und französische Gefahrmeldungen sowie unzulässige Erfolgsbehauptungen sind in den vorhandenen Prüfpfad einbezogen.

## Prüfung

- Gesamte Testsuite: **492 bestanden, 0 Fehler**.
- Übersetzungsdurchlauf: **204 Seitenaufrufe und 190 Formularaufrufe** über EN/FR und Administration, Bewirtschaftung, Eigentümer, Mieter. Kein verbleibender bekannter deutscher Oberflächentext in diesen Durchläufen; keine Portaldatenänderung durch Navigation/Sprachwechsel.
- Sprachwechsel DE → EN in der Kopfzeile, FR in den Einstellungen, Schliessen/Öffnen, Rollenwechsel, neue Seite mit gespeicherter Sprache, Rückkehr zu DE: bestanden.
- Originaleingaben, Dateinamen und MORA-Eingaben bleiben erhalten; Sprachpräferenz durch Client/API und Modellanweisung geprüft.
- Bestehende MORA-, Speicher-, Berechtigungs- und Sicherheitsprüfungen bestehen.
- `npm run build` und `npm run typecheck`: bestanden.
- Browserkontrolle: Desktop, Tablet mit 768 Pixeln sowie schmale 390-/320-Pixel-Ansichten. Bei 320 Pixeln wurde das Dropdown korrigiert und mit linkem Rand 12 px/rechtem Rand 242 px verifiziert. Der lange Zugangsbereich scrollt intern ohne horizontalen Überlauf.

Zusätzlich geprüft: gespeicherte EN-/FR-Sprache auf einer frisch geladenen Einstiegsseite, vollständiger Vorschauhinweis, Einstiegsschaltfläche und Sprachwechsel der MORA-Fensterhinweise auch nach Resize.

Browsernachweis: `docs/evidence/portal-language-2026-10-30/language-settings.jpg`.

Maschinenlesbare Ergebnisse: `docs/evidence/portal-language-2026-10-30/checks.json`.

## Grenzen und spätere Phasen

Persönliche Anmeldung, Kontospeicherung der Sprache, echte Eigentümer-/Mieterzuordnungen sowie E-Mail-/Push-Einstellungen bleiben spätere Aufgaben. Es wurden keine Kundendaten erfunden und keine neuen kostenpflichtigen Dienste eingerichtet. Bestehende lokale Freitexte und historische Inhalte werden bewusst in ihrer Originalsprache erhalten. Browser-eigene Meldungen richten sich weiterhin nach dem Browser.

Die automatisierten Tests prüfen deterministische Anwendungsabläufe; sie sind keine Garantie für jede frei formulierte KI-Antwort. Live-KI-Prüfung auf geschützten Vercel-Previews: deutsche und englische Antworten bestätigt. Nach Präzisierung der Sprachvorgabe direkt im strukturierten Antwortfeld antwortete MORA bei französischer Portalsprache auf eine deutsche Frage ausschliesslich auf Französisch. Ein anschliessender ausdrücklicher Wunsch nach Englisch wurde auf Englisch beantwortet. Modelle, Gateway und Kostengrenzen wurden dabei nicht verändert. Die endgültige Preview-Adresse steht in der Abschlussnachricht.

Es werden keine Branches zusammengeführt. `main`, `alex-portal` und Produktion bleiben unverändert.
