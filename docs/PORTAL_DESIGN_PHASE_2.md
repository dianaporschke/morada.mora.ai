# MORADA Kundenportal – Gestaltung der Unterseiten

Stand: 8. Oktober 2026. Repository: `dianaporschke/morada.mora.ai`.
Arbeitsbranch: `alex-portal`.
Ausgangspunkt: `c333977870362e902eaed78fc8c76bae9430d57d`.

Die vier bestehenden Unterseiten übernehmen die Creme-/Kupfer-/Anthrazit-
Palette, Serifentitel, ruhige Karten und einheitliche Symbole des Dashboards.
Es wird keine Anwendung neu aufgebaut und kein Kundenbackend eingeführt.

## Ansichten und vorhandene Funktionen

- Portfolio: vorhandene Demo-Liegenschaft Baden, 12 Einheiten, 98 % vermietet,
  Status „Aktiv“ und ein offenes Beispielanliegen. Das vorhandene Immobilienmotiv
  wird erneut verwendet und als Beispielansicht markiert. Neue Tab-Verknüpfungen
  öffnen Dokumente und Anliegen. Der bisher nicht angebundene WalkThrough bleibt
  als nicht verfügbare Vorschau erkennbar; es wird kein Rundgang vorgetäuscht.
- Anliegen: bestehender Erfassungseinstieg und Beispiel „Fenster · Einheit 3A“.
  MORA öffnet und verarbeitet den Erfassungseinstieg wie bisher. Das vollständige
  Entwurfsformular inklusive Feldern, Hinweisen und Aktionen bleibt identisch.
- Dokumente: dieselben drei bisherigen PDF-Beispiele (Mieterspiegel 2026,
  Übergabeprotokoll Einheit 2B, Abrechnung August 2026), nun als Liste. Die Anzeige
  und der Download sind weiterhin nicht angebunden und werden so gekennzeichnet.
  Ein Tab-Link öffnet das Portfolio; keine Schein-Downloads oder Suchfunktionen.
- Profil: derselbe Demo-Kunde, dieselbe Eigentümer-Ansicht, Benachrichtigungs-
  vorschau und bestehende Kontaktvorbereitung. Die Kontaktkarte löst weiterhin
  den originalen MORA-Handler aus; ihre gesamte sichtbare Fläche ist anklickbar.
  Keine Authentifizierung, neuen Profileinstellungen oder Benachrichtigungsdienste.

Desktop verwendet grössere Inhaltsflächen und passende Zweispaltenlayouts.
Bei schmaleren Ansichten stehen die Karten untereinander. Mobil bleiben alle
fünf bisherigen Bereiche über die bestehende untere Navigation erreichbar.

## Geänderte Dateien

- `index.html`: Darstellung und Überschriften der vier vorhandenen Unterseiten,
  neue direkte Tab-Verknüpfungen, Hinweise zu Beispieldaten/Vorschauen.
- `assets/portal.css`: ausschliesslich Portal-Selektoren für diese Ansichten;
  Darstellung der bestehenden Erfassungs-/Kontaktbuttons über ihre Container.
- `docs/PORTAL_DESIGN_PHASE_1.md`: Verweis auf diese Folgephase.
- `docs/PORTAL_DESIGN_PHASE_2.md`: Umfang, Schutz gemeinsamer Bereiche und Prüfung.

## Schutz von MORA und Zusammenarbeit

Vor der Umsetzung wurden die Auswirkungen der vorhandenen Erfassungs- und
Kontaktbuttons angekündigt. Keine Änderungen an MORA-Logik, Prompts, APIs,
`assets/mora-client.js`, `assets/mora.css`, `lib/`, Abhängigkeiten, Logo-/Icon-
Dateien oder Vercel-Konfiguration. MORA-Fenster, Schaltfläche, Entwurfsformular,
Erfassungs- und Kontaktbutton bleiben im DOM identisch. Alle bestehenden IDs,
der Inline-CSS-Block, Einstieg, Original-Logo, Dashboard und Navigation wurden
gegen den Ausgangscommit verglichen und sind unverändert.

`index.html` ist weiterhin eine gemeinsam genutzte Datei. Bei einer späteren
Zusammenführung müssen die Portaländerungen gezielt mit Dianas Änderungen
verglichen werden; niemals eine vollständige ältere Datei übernehmen. Die IDs
`service`, `docs`, `profile`, `portfolio` und MORA-Verträge bleiben erhalten.
MORA-Formularstile bleiben unverändert; der Portalrahmen gibt ihnen mehr Breite.

## Tatsächlich geprüft

- 136 vorhandene automatisierte Tests bestanden.
- Typprüfung und Build/Syntax-/Assetprüfung bestanden.
- Chromium bei 320, 390, 600, 760, 768, 820, 900, 901, 1024, 1101 und 1440 Pixeln:
  alle fünf Ansichten, Tastaturbedienung und aktiver Navigationsstatus geprüft;
  kein horizontaler Überlauf, keine JavaScript-Laufzeitfehler oder fehlgeschlagenen
  Ressourcenanforderungen. Pro Ansicht genau eine Hauptüberschrift.
- Portfolio → Dokumente → Portfolio → Anliegen per Klick/Tastatur geprüft.
- Bei 390 und 1440 Pixeln: beide bestehenden MORA-Einstiege, geführte Erfassung,
  Foto, Übergabe an Anliegenentwurf, Bearbeiten/Speichern und Wiederherstellung
  nach Neuladen über tatsächliche Anfragen an isolierte lokale API-Handler.
- Desktop und Mobile anhand gerenderter Screenshots visuell geprüft.

Keine Produktionszugangsdaten oder echte semantische Modellinferenz genutzt.
Kein Anliegen an MORADA übermittelt. Safari und Installation als PWA sind nicht
neu geprüft. Vorschau-Build und lokale Browserprüfung sind getrennt zu bewerten:
Vercel-Vorschauen benötigen bisher Vercel-Authentifizierung.

Änderungen ausschliesslich auf `alex-portal` speichern. Kein Merge in `main`,
kein Force-Push, keine Änderung an Dianas Branch und kein manueller Produktionsdeploy.
