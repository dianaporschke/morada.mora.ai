# MORA – verschiebbares Fenster

Ausgangsstand: `832feb764aee10c10e7cde59f5e1385f457adabe`, ausschliesslich `codex/mora-ai-2.0`.

## Bedienung

- Desktop: Kopfzeile zum Verschieben ziehen. Vier Ränder und vier Ecken verändern Breite und/oder Höhe. Unten rechts ist ein dezenter Griff sichtbar.
- Doppelklick auf die Kopfzeile setzt Position und Grösse auf den kompakten Standard zurück.
- Tastatur: Kopfzeile fokussieren und Pfeiltasten verwenden; am rechten unteren Griff ändern Pfeiltasten die Grösse. Shift vergrössert die Schrittweite. Pos1 setzt zurück. Escape bricht eine laufende Ziehbewegung ab.
- Mindestgrösse 360×360 px, soweit der sichtbare Bildschirm dies erlaubt. Alle Kanten bleiben mit 12 px Abstand im sichtbaren Bereich. Änderungen der Browsergrösse werden berücksichtigt.
- Position und Grösse bleiben während der geöffneten Portalseite beim Schliessen/Wiederöffnen und beim Wechsel zwischen Desktop- und mobiler Breite erhalten. Nach Neuladen gilt wieder die Ausgangsgrösse. Keine zusätzliche Speicherung.
- Bis 640 px bleibt die vorhandene nahezu bildschirmfüllende mobile Ansicht aktiv; Ziehflächen werden ausgeblendet.

## Umsetzung und Grenzen

`assets/mora-portal-window.js` kapselt ausschliesslich die Fenstergeometrie. `assets/mora-portal-client.js` bindet diese an die bestehende Oberfläche an. `assets/mora-portal.css` enthält lokal begrenzte Cursor, Griffe und Grössenvariablen. `scripts/integrate-portal.mjs` übernimmt das neue Modul in den vorhandenen MORA-Block von `portal.html`. Keine zweite Chatimplementierung, keine Bibliothek, kein Modellaufruf. Portalquelltext ausserhalb des MORA-Blocks bleibt unverändert.

## Prüfung

- 420 automatisierte Tests bestanden, Typecheck und Build erfolgreich.
- Sieben neue Tests in `tests/portal-window.test.js`: Verschieben, alle acht Ziehrichtungen und gegenüberliegende Anker, Mindest-/Maximalgrösse und kleinerer Viewport, Abbruch, Tastatur/Reset/Schutz bestehender Buttons, mobile Umschaltung und Mehrfinger-/Loslassen-Verhalten.
- Echter Chromium-Browser: Kopfzeile mit Maus gezogen (440×620 px), Ecke auf 590×664 px gezogen, Schliessen/Wiederöffnen, Doppelklick auf 440×620 px zurückgesetzt, an den Bildschirmrand gezogen (12 px Abstand), anschliessend auf 560×480 px verändert. Textfeld und Aktionen bleiben erreichbar. Tastatur verkleinert die Breite auf 550 px.
- Responsive Wechsel 1180×720 → 390×844 → 1180×720: mobile Ziehflächen unsichtbar, kein horizontaler Chatüberlauf, Desktopposition und -grösse wiederhergestellt.
- Bildschirmaufnahme: `docs/evidence/mora-window-controls.jpg`, mit markierten lokalen Testdaten. Keine KI-Kosten. Kein Test auf einem physischen Smartphone.
