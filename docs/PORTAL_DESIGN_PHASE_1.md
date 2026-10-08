# MORADA Kundenportal – Dashboard und Navigation

Stand: 8. Oktober 2026. Arbeitsbranch: `alex-portal`.

Dieses Dokument beschreibt die Dashboard-Phase. Die anschliessende Gestaltung
der Unterseiten ist in `PORTAL_DESIGN_PHASE_2.md` dokumentiert.
Basis: `0b86dfc3344df62d3de02d8297959a495cc822d3`.

Die bestehende Anwendung wird weiterentwickelt. Die Desktopansicht erhält
eine helle seitliche Navigation, ein Immobilienbild mit dezent transparenter
Kennzahlenkarte, vier Schnellzugriffe und eine Übersicht der vorhandenen
Beispielinhalte. Mobil bleiben alle fünf bisherigen Navigationsbereiche unten
erreichbar. Das Demo-Konto und seine Beispieldaten werden ausdrücklich markiert.

## Dateien und Zuständigkeiten

- `index.html`: neue Dashboarddarstellung, Portalrahmen und Navigation;
  vorhandene Tab-IDs sowie MORA-Markup bleiben erhalten.
- `assets/portal.css`: auf Portal-Selektoren begrenzte Darstellung.
- `assets/portal-navigation.js`: Tastaturbedienung und aktiver Navigationsstatus,
  auch nach asynchronen MORA-Übergaben, ohne MORA-Handler zu ändern.
- `assets/portal-property.webp`: dasselbe Motiv wie auf Dianas MORADA Website,
  von `https://morada-website-kappa.vercel.app/morada-hero-property.png`;
  als WebP mit unveränderten Abmessungen für kürzere Ladezeiten gespeichert.
- `tests/portal.test.js`: Tastaturwechsel und Navigationsstatus nach einer
  asynchronen programmgesteuerten Anliegenübergabe.

Die Website-Palette wurde direkt abgeglichen: Creme `#f7f2eb`, Kupfer
`#ad6840`, Anthrazit `#1e2225`.

## Schutz von MORA und paralleler Entwicklung

Keine Änderungen an `assets/mora-client.js`, `assets/mora.css`, `api/`,
`lib/mora/`, `lib/portal/`, bestehenden Tests, Logo-/App-Icon-Dateien,
Abhängigkeiten oder Vercel-Konfiguration.

MORA-Fenster, MORA-Schaltfläche, Anliegenformular, ursprünglicher Inline-CSS-
Block und Inhalte von Portfolio, Dokumenten und Profil bleiben identisch.
Im bisherigen Servicebereich wurde ausschliesslich die sichtbare Überschrift
in „Anliegen“ umbenannt; das Formular und seine IDs bleiben identisch. Der neue
Portalrahmen beeinflusst die verfügbare Breite dieser bestehenden Ansichten.

`index.html` bleibt eine gemeinsam verwendete Datei. Änderungen daran müssen
bei einer späteren Zusammenführung gezielt verglichen werden. Keine komplette
Datei aus einem älteren Branch übernehmen. Navigation und MORA verwenden
weiterhin `home`, `portfolio`, `service`, `docs`, `profile` und `mora`.

## Prüfung

- 136 automatisierte Tests bestanden.
- `npm run typecheck` und `npm run build` inklusive Syntax-/Assetprüfung bestanden.
- Chromium: alle fünf Ansichten und Tastaturbedienung bei 320, 390, 768,
  1024 und 1440 Pixeln geprüft. Kein horizontaler Überlauf, keine JavaScript-
  Laufzeitfehler und keine fehlgeschlagenen Ressourcenanforderungen.
- Bei 390 und 1440 Pixeln: tatsächliche Browseranfragen an isoliert gestartete
  lokale API-Handler, geführter Chat, Foto, Übergabe in einen Anliegenentwurf,
  Bearbeiten, Speichern und Neuladen mit wiederhergestelltem Foto geprüft.
- Desktop- und Mobilansicht anhand gerenderter Screenshots kontrolliert.

Die lokalen API-Tests verwendeten keine Produktionszugangsdaten. Sie bestätigen
die geführte Erfassung, nicht die echte semantische Modellinferenz oder eine
Übermittlung an MORADA. Die noch nicht angeschlossenen Kunden-/Datenadapter
bleiben unverändert. Safari und Installation als PWA sind nicht neu getestet.

## Ergebnis prüfen

`npm ci`, `npm test`, `npm run typecheck`, `npm run build`.
Die erzeugte statische Ansicht liegt in `dist/`; ein rein statischer Server
liefert die MORA-API nicht mit. Für einen vollständigen lokalen Ablauf müssen
die bestehenden API-Handler isoliert mit Development-Konfiguration laufen.

Änderungen ausschliesslich auf `alex-portal` speichern. Kein Merge in `main`,
kein Force-Push und kein manueller Produktionsdeploy. Vercel-Workspace-Zugriff
war bei der Bestandsaufnahme eingeschränkt; Vorschau- und Produktionsregeln
sind daher nicht durch direkten Zugriff auf die Projekteinstellungen bestätigt.

## Feinschliff vom 8. Oktober 2026

Ausgangspunkt: `fcd21ad7304e0ce5761633b5e498c86fcf67004f` auf `alex-portal`.

- `assets/portal.css`: dunklere, grössere Nebenbeschriftungen; etwas kompaktere
  Immobilienfläche; einheitliche SVG-Strichstärke und Kupfertöne. Aktive
  Navigationssymbole übernehmen die Textfarbe ohne ursprüngliche Bildfilter.
  Bei 761–900 Pixeln stehen Kennzahlen und Immobilienlink untereinander,
  damit die grössere Beschriftung nicht den Einführungstext überdeckt.
- `index.html`: einheitliche dekorative SVGs für Navigation, Schnellzugriffe
  und Dokumentenvorschau; sichtbare Navigation, Bereichsüberschrift und
  Dashboard-Verknüpfung heissen nun „Anliegen“. Die interne Tab-ID `service`
  bleibt bestehen. Die ursprünglichen Icon-Dateien bleiben unverändert.
- Diese Dokumentation wurde um Umfang und Prüfergebnis ergänzt.

136 Tests, Typprüfung und Build bestanden. Erneuter Chromium-Durchlauf bei
320, 390, 600, 760, 768, 820, 900, 901, 1024, 1101 und 1440 Pixeln:
fünf Ansichten, Tastatur, Navigationsstatus,
Symbolfarben ohne Legacy-Filter und Abstand zwischen Begrüssungstext und
Kennzahlenkarte geprüft. Kein horizontaler Überlauf oder JavaScriptfehler.
Bei 390 und 1440 Pixeln wurde die lokale MORA-Erfassung mit Foto, Übergabe,
Bearbeiten/Speichern und Wiederherstellung nach Neuladen erneut geprüft.
Die Testgrenzen zu echter Modellinferenz, Übermittlung und Safari/PWA gelten
weiterhin. MORA-Markup, Logo, Inline-CSS und bestehende Unterseiten wurden
gegen den Ausgangscommit verglichen; abgesehen von der genannten Überschrift
sind sie identisch. Keine Änderung an MORA-Code, API oder Vercel-Konfiguration.
