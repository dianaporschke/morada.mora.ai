# Profil & Einstellungen 2.0 · Phase 1

Die bisherige 2×2-Ansicht ist durch ein Einstellungsfenster mit sechs navigierbaren Bereichen ersetzt. Auf Desktop und Tablet steht die Navigation links; auf Smartphones wechseln Bereichsliste und Inhalt mit «Alle Einstellungen» zurück.

## Basis und Umfang

- Projekt: `dianaporschke/morada.mora.ai`, Branch `codex/mora-ai-2.0`.
- Ausgangs-Preview: `morada-mora-fliv36e74-dianaporschke-1255s-projects.vercel.app/portal.html`, Quellcommit `9e448d2565ed219bc8193806a00d080e821d8c1d`.
- Arbeitsbasis: `b37caec98773acb66ea7ced6fd9dad75e12ad72f`; dieser Folgecommit ergänzt ausschliesslich Dokumentation und Nachweise, keinen Portalcode.
- Bestehende Farbvariablen, Typografie, Profilmenü, Modal und Portalfunktionen wiederverwendet.
- MORA-Integrationsblock unverändert; keine Änderungen an APIs, Modellen, Konten, Datenhaltung oder Diensten.
- `main` und `alex-portal` nicht bearbeitet; kein Merge, nur Preview.
- Portaldatei über die GitHub-Schnittstelle gespeichert; der zurückgegebene Blob-Hash `b4b545d268440cdb7f5569bc6adee0eb7f77571a` stimmt exakt mit der lokal gebauten und geprüften Datei überein.

## Bereiche

| Bereich | Phase 1 |
| --- | --- |
| Mein Profil | Klarer Leerzustand ohne erfundene Kontaktdaten; spätere Bearbeitung gekennzeichnet. |
| Sprache & Darstellung | Deutsch (Schweiz) aktuell; Englisch und Französisch für Phase 2; bestehendes Design. |
| Benachrichtigungen | E-Mail und Push als geplant; keine inaktiven Schalter und kein Versand. |
| Meine Zugänge | Aktueller Vorschaubereich, unzugeordnete Eigentümer-/Mieterzugänge und Immobilien. |
| Sicherheit & Datenschutz | Anmeldung, Anmeldeschutz und Geräte vorbereitet; ehrlicher Hinweis zur lokalen Speicherung und KI-Verarbeitung. |
| Hilfe & Support | Öffnet vorhandene MORA mit Fokus im Texteingabefeld; vorhandener E-Mail-Link öffnet das Mailprogramm. |

## Prüfung am 30.10.2026

- Build erfolgreich; Syntax-/Assetprüfung im bestehenden Build.
- 44 relevante Tests aus `portal-source`, `portal-ui`, `portal-profile`, `portal-access`, `portal-audience` bestanden. Nach der Fokuskorrektur die vier betroffenen Profiltests nochmals erfolgreich geprüft.
- DOM-Prüfung aller sechs Bereiche in allen vier bestehenden Vorschaurollen: keine Veränderung von Portaldatensätzen, keine simulierten Personendaten, keine nicht angebundenen Eingabefelder.
- Tastatur: Pfeile, Pos1/Ende, Enter, Escape, Fokus-Rückgabe, mobile Rücknavigation.
- Browserprüfung des Desktopfensters und aller Bereiche; Tablet 768 × 1024 sowie Smartphone 390 × 844 und 320 × 640 über echte gerenderte Browser-Iframes in diesen Grössen.
- MORA-Öffnung aus Hilfe im Browser geprüft; native asynchrone Dialog-Fokusübergabe korrigiert und erneut geprüft, Cursor landet im MORA-Eingabefeld.
- Keine echten KI-Anfragen für diese UI-Änderung; kein E-Mail-Versand. Physische iOS-/Android-Geräte wurden nicht geprüft.

