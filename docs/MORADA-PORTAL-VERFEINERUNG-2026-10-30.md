# MORADA Portal – visuelle Verfeinerung

Stand: 30. Oktober 2026. Arbeitsbranch: `codex/mora-ai-2.0`.

## Testversion

Implementierung: `9e448d2565ed219bc8193806a00d080e821d8c1d`.

Preview: https://morada-mora-fliv36e74-dianaporschke-1255s-projects.vercel.app/portal.html

Deployment: `dpl_4XuLwZzSz51v5VK8qHp8t4P9FXeL`, Vercel Preview, READY. Für den Zugang ohne Vercel-Anmeldung wurde ein befristeter Freigabelink bereitgestellt. Kein Produktionsdeployment, Merge oder Eingriff in Alexanders Branch.

## Umsetzung

- Die Kopfzeile enthält Suche, Glocke und beschriftetes Abmelden; mobil zusätzlich den vorhandenen Navigationsschalter. Der zusätzliche MORA-Startbutton, der Bereichswechsel und die redundante Kopfzeilen-Pfadzeile wurden entfernt.
- Abmelden verwendet einen Türrahmen mit nach aussen gerichtetem Pfeil. Die bestehende Abmeldefunktion bleibt erhalten.
- Das Zahnrad unten links öffnet ein Profilmenü oberhalb des Accountbereichs. Öffnen, erneutes Schliessen, Aussenklick, Escape und Tastatursteuerung sind umgesetzt. Escape im mobilen Profilmenü schliesst nur dieses Menü und hält die Navigation offen.
- Der vorhandene Bereichswechsel liegt im Profilmenü. Die vier bestehenden Arbeits-/Vorschauansichten bleiben erhalten; aktiver Bereich und Vorschaucharakter sind ausdrücklich gekennzeichnet. Die Auswahl vergibt keine Berechtigungen.
- Die kompakte persönliche Einstellungsansicht verwendet den vorhandenen Portal-Dialog. Sie zeigt den tatsächlichen Stand und enthält keine funktionslosen Schalter oder behauptete Speicherung.
- Mieter-/Eigentümerzugang und „Kein Profil zugeordnet“ bleiben sichtbar. Interne Ansichten sind im Profilbereich als lokale Arbeitsbereiche bezeichnet. Bestehende Inhalte und Stammdaten wurden nicht umgeschrieben.
- Karten erhalten konsistente Konturen, dezente Schatten, Innenabstände und Rundungen. Aktionskarten behalten ihre vorhandenen Ziele und einen Richtungspfeil. Informationskarten erhalten keine erfundene Klickaktion.
- Das bestehende SVG-System wird weiterverwendet: echte Zahnrad-, Personen-, Wechsel- und Logout-Symbole; konsistente Ausrichtung und Navigations-Chevrons.
- Die dekorative Gebäudezeichnung im unteren Hero-Bereich ist entfernt. Seine Texte und vorhandenen Aktionen bleiben erhalten. Keine Bilder oder Dekorationen ergänzt; Dokumente und Anhänge unverändert.
- Der einzige schwebende MORA-Startbutton bleibt „MORA Assistenz“ mit dem bestehenden Stern. Chat, Rauchglasgestaltung und sämtliche KI-/Anliegenlogik sind unverändert.

## Bestehende Gestaltung

Die Werte stammen aus den vorhandenen Portalvariablen, nicht aus dem Referenzbild:

| Element | Bestehender Wert |
| --- | --- |
| Portalhintergrund | `#f5f3ef` |
| Karten | `#ffffff` |
| Dunkelbraun | `#493629` |
| Kupfer | `#95502f` |
| Text | `#292722` |
| Sekundärtext | `#69645d` |
| Kontur | `#e1ddd5` |
| Titel | Outfit, serifenlos |
| Lauftext | Arial / Helvetica / sans-serif |

MORADA-Logo und bestehende Schriftdateien bleiben erhalten. Die neuen Portalregeln verwenden die bestehenden Variablen. MORA-spezifische Styles wurden nicht verändert.

## Was bereits funktioniert

| Funktion | Tatsächlicher Umfang |
| --- | --- |
| Profilmenü | Öffnen, Schliessen, Fokus, Tastatur und mobile Navigation |
| Profil & Einstellungen | Kompakte Anzeige des verfügbaren Kontostands |
| Bereich wechseln | Vorhandener lokaler Wechsel zwischen vier Vorschau-/Arbeitsansichten; keine Authentifizierung |
| Sprache | Anzeige Deutsch (Schweiz), der tatsächlich vorhandenen Sprache |
| Suche | Bestehende Suche und Ctrl+K |
| Glocke | Bisheriges bereichsspezifisches Ziel: Anliegen, Freigaben bzw. Aktivitäten; kein neuer Benachrichtigungsdienst |
| Abmelden | Bestehende Rückkehr zur lokalen Einstiegsseite |
| MORA | Vorhandenes Öffnen/Schliessen und unveränderte Integration |
| Anliegen | Vorhandenes Formular, lokale Speicherung und erneutes Prüfen/Ergänzen |

Es gibt in dieser Version keine persönlichen Einstellungen, die sicher auf einem Kundenkonto gespeichert werden könnten. Deshalb wurden keine Bearbeitungs- oder Speichern-Schalter vorgetäuscht.

## Benötigte spätere Anbindungen

Alexander muss mit der eigentlichen Kontoanbindung folgende Fähigkeiten bereitstellen. Dieser Auftrag führt dafür weder eine neue Datenbank noch erfundene API-Endpunkte ein:

1. **Authentifizierter Profilkontext:** tatsächliche Person, freigegebene Bereiche und aktiver Bereich aus einer serverseitig geprüften Sitzung. Eine Frontendauswahl darf diese Rechte nicht erzeugen.
2. **Sichere Profiländerung:** validierte, autorisierte Änderung erlaubter Kontaktfelder mit bestätigtem Speicherergebnis und Fehlerantwort. Wohnungen, Rollen, Eigentums- und Vertragsdaten bleiben ausserhalb des persönlichen Editors.
3. **Benachrichtigungseinstellungen:** tatsächlich unterstützte Ereignisse und Kanäle, Lesen/Speichern der persönlichen Auswahl sowie ein realer Zustelldienst. Erst dann E-Mail-/Push-Schalter anbieten.
4. **Sprachen:** vollständige Übersetzungen und unterstützte Sprachenliste, bevor eine Auswahl erscheint.
5. **Anmeldung & Sicherheit:** Aktionen des real eingesetzten Identitätsdienstes. Passwortänderung, Sitzungsverwaltung und Kontoaktionen nur entsprechend dessen vorhandenem sicheren Ablauf.

## Prüfung

### Tatsächlich im Browser

Die veröffentlichte Preview wurde als Mieter geöffnet und geprüft:

- Normale Übersicht ohne Anliegen-Dialog, bereinigte Kopfzeile und ein schwebender MORA-Button.
- Profilmenü und persönliche Einstellungsansicht, lesbare Symbole und Texte.
- Ctrl+K fokussiert das Suchfeld; Suche nach „Dokumente“ öffnet die vorhandene Suchseite. Ohne zugeordnete Dateien liefert sie ehrlich keine Treffer.
- Glocke öffnet „Meine Anliegen“.
- Vorhandenes manuelles Anliegenformular mit deutlich gekennzeichnetem lokalem UI-Testeintrag ausgefüllt und gespeichert. Anschliessend über „Prüfen / ergänzen“ erneut geöffnet: Titel, Beschreibung und Raum waren erhalten. Status: „Lokal gespeichert · nicht übermittelt“.
- MORA über den bestehenden Startbutton geöffnet und geschlossen. Keine Nachricht an ein KI-Modell gesendet.
- Bereichswechsel von Mieter zu Eigentümer und Administration; aktiver Bereich und Vorschauhinweis kontrolliert.
- Abmelden führt zur bisherigen Einstiegsseite zurück.

Responsive Prüfung derselben Portaldatei über einen lokalen iframe-Prüfrahmen bei 320×700, 390×844, 1180×740 und 1440×900 CSS-Pixeln. Der Dokumentinhalt hatte in allen vier Breiten keine horizontale Überbreite. Mobil wurden Navigation, Profilmenü, Escape und Einstellungsdialog bedient. Das ist eine Browserprüfung, kein Test auf physischer iPhone-/Android-Hardware. Desktop-Screenshots stammen aus der veröffentlichten Preview; der mobile Screenshot stammt aus dieser lokalen Prüfung derselben Implementierung.

### Automatisiert

- Vollständiger `npm test`-Lauf: **480 bestanden, 0 fehlgeschlagen** vor der abschliessenden mobilen Escape-Korrektur.
- Anschliessend gezielte Prüfung der finalen Escape-/Fokus-Korrektur und Quelltext-Erhaltung: **4 bestanden, 0 fehlgeschlagen** (`portal-profile.test.js` und `portal-source.test.js`). Diese Zahlen sind getrennte Läufe, keine behaupteten zusätzlichen KI-Gespräche.
- Die bestehenden Integrationstests decken unter anderem Anliegenmapping, Korrekturen, Anhänge, lokale Speicherung, Doppelausführung und Speicherfehler ab.
- `npm run build`, `npm run typecheck` und `git diff --check` erfolgreich; zusätzlich ist das Vercel-Deployment READY.
- Ein Quelltext-Fingerprint bestätigt den unveränderten kompletten MORA-Integrationsblock. Ein weiterer schützt die native Geschäftslogik ausserhalb der ausdrücklich bearbeiteten Darstellungsteile.
- Keine kostenpflichtigen KI-Aufrufe oder neue Dienste für diese UI-Prüfung. Keine Aussage über eine verbesserte Gesprächsqualität; diese war nicht Teil dieses Auftrags.

## Geänderte Dateien

- `portal.html`: Portalrahmen, Symbole, Profilmenü, Einstellungsdialog und visuelle Verfeinerung.
- `tests/portal-profile.test.js`: neue native DOM-Prüfungen für Menü, Bereiche, Kopfzeile und mobile Fokussteuerung.
- `tests/portal-source.test.js`: Erhaltung von MORA und Geschäftslogik trotz erlaubter Portal-UI-Änderungen.
- `tests/portal-integration.test.js`: nur noch den vorhandenen schwebenden MORA-Startbutton erwarten.
- `scripts/ui-redesign/portal-frame.html`: lokaler Responsive-Prüfrahmen; wird nicht in die ausgelieferte Portalversion eingebaut.
- Diese Dokumentation und `docs/evidence/portal-polish-2026-10-30/`: vier echte Browser-Screenshots.

## Screenshots

- [Mieterübersicht Desktop](evidence/portal-polish-2026-10-30/desktop.jpg)
- [Profilmenü unten links](evidence/portal-polish-2026-10-30/profilmenue.jpg)
- [Einstellungsansicht](evidence/portal-polish-2026-10-30/einstellungen.jpg)
- [Mobile Mieterübersicht](evidence/portal-polish-2026-10-30/mobile.jpg)

`main`, `alex-portal`, Produktion, Preiseinstellungen, API-Schlüssel, KI-Modell und Backend-Anbindung wurden nicht geändert.
