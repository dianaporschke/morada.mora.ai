# MORADA Portal 2.0 – Phase 3.7

Technische Sicherheits- und Zuverlässigkeitsprüfung · 2. November 2026

## 1. Geprüfter Umfang

Geprüft wurde Dianas bestehender Arbeitsstand auf `codex/mora-ai-2.0`, ausgehend von `bd1dd359e64238c65c1a84410cc4bec11033e8ea`: Portal-HTML, vorhandene JSON-APIs, MORA-Konversationssignaturen, vorhandener serverseitiger Berechtigungsvertrag, lokale Speicherung, Upload-/Exportpfade, Fehlerausgaben, Abhängigkeiten und Vercel-Headerkonfiguration. Alexanders Branch und unabhängige Entwicklung wurden nicht verändert. Keine Datenbankmigrationen, produktiven Schreibtests oder echten Kundendaten.

## 2. Festgestellte Probleme und Einordnung

| Priorität | Befund | Behandlung |
|---|---|---|
| Kritische Voraussetzung, noch nicht implementiert | Die Bereichsauswahl ist keine persönliche Authentifizierung. Kalender, Kontakte, Unterlagen und Einstellungen gehören derzeit zu einem lokalen Geräte-Arbeitsstand. Eine Auswahl wie «Eigentümer» trennt diese Daten nicht nach Konten. | Keine neue Benutzerverwaltung gebaut. Vor Einsatz mit echten Eigentümer-/Mieterdaten ist eine serverseitige Anmeldung mit konsequenter Objektberechtigung erforderlich. |
| Hoch, bekannte Abhängigkeiten | `npm audit` meldete vier betroffene Pakete mit hoher Einstufung, einschliesslich transitiver Abhängigkeiten. Zod und Undici lagen in betroffenen Versionen. Das beweist keinen erfolgreichen Angriff auf diese Anwendung. | Aktualisiert; beide erneuten Audits melden null bekannte Schwachstellen. |
| Mittel | Die HTTP-Endpunkte erzwangen bisher weder JSON noch eine gemeinsame Herkunftsprüfung. Damit fehlte eine einheitliche Grenze gegen fremde Browseranfragen und Formular-POSTs. | Gemeinsame Prüfung vor Modell-, Diagnose- und Backendarbeit; unerlaubte Herkunft wird mit 403, falscher Inhaltstyp mit 415 abgelehnt. Kein Ersatz für Anmeldung, CSRF-Token oder Rate-Limiting. |
| Mittel | Die Portal-Testbudgetabfrage gab Guthaben-/Preisinformationen zurück. Fehler konnten verworfene Modelltexte und beliebige Diagnosedetails enthalten; ein weiterer Fehlerpfad protokollierte beliebige Validierungsdaten. | Budgetantwort auf bestanden/nicht bestanden begrenzt; öffentliche Fehler und Logs auf notwendige technische Kategorien reduziert. |
| Mittel, Absicherung | Für die Anwendung fehlten explizite Regeln für Framing, MIME-Erkennung, Referrer und Portal-Caching. Die Mietvertrags-PDF-Vorschau war im Gegensatz zur anderen Dokumentvorschau nicht sandboxed. | Kompatible Sicherheitsheader und PDF-Sandbox ergänzt. |
| Klein, Zuverlässigkeit | Konversationssignaturen prüften Ablaufwerte nicht vollständig. Ungültige Unicode-Signaturen konnten einen unspezifischen Kryptofehler auslösen. Der allgemeine CSV-Export berücksichtigte Formeln nach führenden Leerzeichen/BOM nicht. | Ablauf, Format und Eingabegrenzen verschärft; CSV nutzt die bereits vorhandene sichere gemeinsame Zellfunktion. |

## 3. Durchgeführte Korrekturen

- Zod 4.6.7, Undici 7.30.1 und die Entwicklungsabhängigkeit Undici 8.12.3 im Lockfile. Der veraltete Zod-Pin unter `@vercel/cli-config` wird gezielt innerhalb Hauptversion 4 überschrieben. Keine neue Bibliothek.
- Gemeinsame HTTP-Prüfung für alle sechs eigenständigen API-Handler; `portal-agent` übernimmt sie über seinen vorhandenen Handler. Private API-Antworten sind nicht cachebar.
- `nosniff`, `SAMEORIGIN`, `no-referrer`, eine begrenzte CSP für Basis-URL, Objekte und Einbettung sowie `private, no-store` für `/portal.html`. Keine pauschale Script-CSP, die bestehende Inline-Skripte brechen würde. HSTS wurde bereits von Vercel geliefert.
- Mietvertrags-PDFs erhalten `sandbox="allow-same-origin"` ohne Scriptfreigabe; Herunterladen bleibt möglich. Dateiprüfung und gespeicherte Anhänge bleiben unverändert.
- Signierte Gesprächszustände werden bei fehlendem/ungültigem Ablauf, abgelaufenem Zeitpunkt, ungültiger Signatur oder überschrittenen Dekodiergrenzen verworfen. Diese Signaturen sind weder Anmeldung noch Verschlüsselung.
- Allgemeine CSV-Ausgaben entschärfen führende Tabellenformeln auch nach Leerzeichen/BOM; Originaldaten werden nicht verändert.

## 4. Abschlusskontrolle

- **558 von 558 automatisierten Tests bestanden.** Externe `fetch`-Aufrufe wurden während dieses Laufs gesperrt; Modell- und Backendfälle verwenden vorhandene Simulationen. Nach der abschliessenden Signaturverschärfung zusätzlich 27 relevante Tests erneut bestanden.
- Berechtigungsvertrag: fremde/duplizierte Datensätze, manipulierte Rollen/Objektkennungen, abgelaufene Freigaben, Widerruf während des Datenabrufs und unbestätigte Speicherbelege werden abgelehnt. Ohne angeschlossenen Serveradapter gibt es keine persönliche Datenauskunft. Diese Tests ersetzen keinen Test einer späteren echten Datenbankanbindung.
- Speicherfehler, Doppelauslösung, Konflikte zwischen Tabs, echte lokale Wiederherstellung, Abbruchwarnung und Erhalt von Eingaben durch die bestehenden Tests geprüft. Keine falsche Erfolgsbestätigung in den geprüften Fehlerfällen.
- Neue Regressionstests prüfen Herkunft/Inhaltstyp vor Seiteneffekten, redigierte Fehler-/Budgetausgaben, ungültige Signaturen, PDF-Sandbox, maskierte Dateinamen und tatsächlichen CSV-Export.
- `npm audit --omit=dev` und vollständiges `npm audit`: **0 bekannte Schwachstellen** zum Prüfzeitpunkt. Keine Garantie gegen unentdeckte oder spätere Lücken.
- Build/Syntaxprüfung erfolgreich: 194 Dateien. `git diff --check` ohne Befund. Typecheck bleibt bei vier bereits bekannten Diagnosen in `assets/portal-entry-scene.js` und `assets/portal-feedback.js`; keine neue Diagnose durch diese Phase.
- Browser-Stichprobe: Desktop-Kalender und mobiles Terminformular bei 390 × 844 CSS-Pixeln; Abbruchwarnung, «Weiter bearbeiten» und unveränderter Entwurf sichtbar geprüft. Das ist keine Prüfung auf einem echten iPhone/Androidgerät.
- Begrenzter Geheimnis-Musterscan: 466 getrackte Textdateien im Ausgangsstand, keine Treffer für die geprüften Schlüssel-/Tokenmuster; einzige getrackte Umgebungsdatei `.env.example`. Keine Prüfung aller historischen Commits und keine Garantie der Geheimnisfreiheit.

## 5. Nicht überprüfbar und spätere Massnahmen

**Vor persönlicher Kundennutzung erforderlich:** Alexander muss seinen bestehenden Authentifizierungs-/Backendansatz anschliessen und Anmeldung, serverseitige Sitzungswiderrufe, getrennte Lese-/Schreib-/Löschrechte und Objektzuordnung mit mindestens zwei echten Testkonten prüfen. Der vorhandene `portalServerAdapter` ist absichtlich nicht angeschlossen; auch die direkte Anliegenübermittlung meldet ohne Backend ausdrücklich «nicht versendet».

Der lokale Geräte-Arbeitsstand bleibt nach «Abmelden» erhalten; die Aktion beendet die Vorschau und räumt Chat-/Oberflächenreste auf, ersetzt aber keine Kontositzung und löscht keine lokalen Geschäftsunterlagen. Unverschlüsselte lokale Browserdaten und lesbare, signierte Gesprächszustände sind kein geschützter Kundenspeicher. Keine neuen Passwörter oder Geheimnisse wurden im Browser abgelegt. Geräteübergreifende Kontosynchronisierung, zentrale Backups/Wiederherstellung und serverseitige Konfliktkontrolle sind noch nicht vorhanden.

Nicht verifiziert: reale Datenbank-/Dateispeicherrechte, sichere Auth-Cookieattribute, echte Kontositzungen und deren Ablauf, vollständige API-Ratenbegrenzung pro Benutzer, alle externen Anbieter-/Auftragsbearbeitungsvereinbarungen, Lösch-/Aufbewahrungsfristen, vollständige Git-Historie, Penetrationstest und echte Mobilgeräte/PWA. Externe KI-Anbindung kann vom Benutzer eingegebene Inhalte an den konfigurierten Anbieter übertragen; diese Datenflüsse und Freigaben müssen vor Echtdatenbetrieb organisatorisch geprüft werden. Eine strengere Script-CSP benötigt eine spätere abgestimmte Behandlung bestehender Inline-Skripte. Vercel-Vorschauschutz ist Hosting-Zugangsschutz, keine Portalrollenverwaltung; Freigabelinks nur für die Arbeitsvorschau verwenden.

Die Änderungen sind für eine isolierte Preview bestimmt. Keine produktive Veröffentlichung oder Veränderung produktiver Benutzerdaten. Die technische Prüfung orientiert sich an Datenschutz durch Technik und angemessener Datensicherheit; sie ist keine rechtliche DSG-Prüfung und bescheinigt keine vollständige Sicherheit.

## Quellen zur Einordnung

- [EDÖB: Informatiksicherheit](https://www.edoeb.admin.ch/de/informatiksicherheit)
- [Schweizer Datenschutzgesetz, insbesondere Art. 7 und 8](https://www.fedlex.admin.ch/eli/oc/2022/491/de)
- [Zod-Advisory GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Undici-Advisory GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26)
- [Undici-Advisory GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)
