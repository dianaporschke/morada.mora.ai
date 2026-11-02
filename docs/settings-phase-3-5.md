# MORADA Portal 2.0 – Phase 3.5

Stand: 2. November 2026. Dianas bestehender Branch `codex/mora-ai-2.0`.

## Vorhandener Funktionsumfang

Die aktuelle Oberfläche ist ein lokaler Arbeitsbereich mit Vorschaurollen. Die Rollenwahl ist keine persönliche Anmeldung. Für Profilangaben, E-Mail-/Push-Einstellungen, Passwortänderungen und angemeldete Geräte gibt es noch keine bearbeitbaren Kontofunktionen und keine angebundene Einstellungsschnittstelle. Diese Bereiche bleiben als geplant gekennzeichnet; persönliche Profilangaben tragen nun ebenfalls das bestehende «Geplant»-Kennzeichen.

Die Portalsprache ist tatsächlich bearbeitbar. Sie wird gerätebezogen unter `morada.portal.language.v1` gespeichert. Der bestehende Schnellzugriff ist eine weitere bearbeitbare Oberflächeneinstellung und liegt unter `morada-interface-preferences-v3`, getrennt nach Vorschau-Arbeitsbereichen. Beides ist keine kontobezogene oder geräteübergreifende Speicherung.

## Behobene Fehler

- **Sprachspeicherung:** Nach einem Schreibversuch wird der gespeicherte Wert zurückgelesen. Fehlende Speicherung erzeugt keine Erfolgsmeldung. Die gewählte Sprache bleibt für die Sitzung erhalten; erneutes Antippen derselben Sprache versucht die Speicherung nochmals. Nach erfolgreichem Wiederholen wird die dazugehörige Speicherfehlermeldung aufgelöst, ohne einen fremden Formularfehler zu schliessen.
- **Sprachabgleich:** Andere Browser-Tabs übernehmen den aktuell gespeicherten gültigen Wert ohne erneutes Schreiben, Fokusübernahme oder Erfolgsmeldung. Veraltete Ereignisse und ungültige Werte setzen die Oberfläche nicht unbeabsichtigt zurück. Eine fehlgeschlagene lokale Auswahl wird bis zum erneuten Speichern erhalten. Kopfzeile, Einstellungsanzeige und bestehende Übersetzungen verwenden weiter dieselbe Logik.
- **Schnellzugriff:** Ein Speicherfehler schliesst das Formular nicht mehr und bestätigt keine erfolgreiche Änderung. Die Auswahl bleibt erhalten und kann über die vorhandene Wiederholungsaktion gespeichert werden. Es wird nur der aktuelle Vorschau-Arbeitsbereich in die zuletzt gespeicherten Einstellungen übernommen. Beschädigte gespeicherte Einstellungen werden nicht durch eine leere Fassung überschrieben. Doppelte oder veraltete Formularübermittlungen sind blockiert; höchstens sechs verfügbare Bereiche sind zulässig.
- **Übersetzungen:** Die bestehenden Bereichsnamen im Schnellzugriffsformular folgen jetzt der Portalsprache. Gespeicherte Route-IDs bleiben unverändert.
- **Abmelden:** Vorherige Meldungen einschliesslich Warteschlange und auslaufender Timer werden entfernt. Die vorhandene MORA-Bereinigung wird beim Verlassen ausgelöst und entfernt alte Chat-Sitzungsinhalte aus dem Sitzungsbereich. Portaldatensätze und nicht vertrauliche Geräteeinstellungen werden dabei nicht gelöscht.

Die Sprache wird weiterhin direkt bei der Auswahl übernommen und gespeichert; das Schliessen des Fensters ist keine Rücknahme einer bereits bestätigten Sprachwahl. Das bestehende Schnellzugriffsformular verwendet Speichern, Abbrechen und die Warnung vor ungespeicherten Änderungen. Es wurde kein neuer Einstellungsbereich ergänzt.

## Abschlussprüfung

| Szenario | Ergebnis |
| --- | --- |
| Profilangabe ändern und neu laden | Nicht möglich: keine implementierten Profil-Eingabefelder oder Profil-Speicherfunktion. Nicht bearbeitbare Angaben sind klar gekennzeichnet. |
| Sprache wechseln und vollständig neu laden | Erfolgreich automatisiert und im Browser geprüft; Englisch bleibt beim Neuladen und erneuten Öffnen erhalten. |
| Sprachabgleich in einem zweiten Browser-Tab | Im Browser in beide Richtungen DE/EN geprüft. Der empfangende Tab zeigt keine zusätzliche Erfolgsmeldung. Das ist kein Zweitgerätetest. |
| Benachrichtigungseinstellung ändern | Nicht möglich: E-Mail und Push sind als geplant markiert und werden nicht künstlich aktiviert. |
| Schnellzugriff speichern und neu laden | Erfolgreich im Browser und automatisiert geprüft; die ursprüngliche Testauswahl wurde danach wiederhergestellt. Andere Vorschau-Arbeitsbereiche bleiben erhalten. |
| Änderungen abbrechen | Automatisiert geprüft: Weiterbearbeiten erhält die Auswahl; Verwerfen stellt beim erneuten Öffnen die gespeicherten Werte her. |
| Speicherfehler und Wiederholen | Blockierte und unbestätigte Schreibvorgänge, beschädigte gespeicherte Einstellungen, erhaltene Eingaben und Wiederholung geprüft. Keine Erfolgsmeldung vor bestätigter Speicherung. |
| Netzwerkstörung | Die vorhandenen Geräteeinstellungen benötigen keine Netzwerkanfrage. Die Tests verbieten Netzwerkzugriffe. Ein Ausfall einer Konto-Einstellungsschnittstelle ist nicht prüfbar, weil eine solche Schnittstelle noch fehlt. |
| Abmelden und erneut öffnen | Im Browser und automatisiert geprüft. Sprache bleibt erhalten; alte Meldungen und MORA-Sitzungsinhalte werden nicht in eine neue Sitzung übernommen. Keine echte Kontoneuanmeldung vorhanden. |
| Zweites Gerät / Kontowechsel | Nicht möglich: keine benutzerbezogene Einstellungsschnittstelle oder persönliche Konten angebunden. Keine neue Datenbank- oder Authentifizierungsarchitektur angelegt. |
| Desktop und Mobile | Bestehende sechs Einstellungsbereiche geprüft; mobile Fenster mit 390 × 844 und 320 × 568 CSS-Pixeln sowie Desktop ohne horizontalen Überlauf. |

**66 gezielte Tests bestanden**, einschliesslich neuer Fälle für Speicherbestätigung, Wiederholung derselben Sprachwahl, Tab-Abgleich, unveränderte Eingaben, Abbrechen, beschädigte Daten, getrennte Vorschau-Arbeitsbereiche, Abmeldebereinigung und übersetzte Schnellzugriffe. Die Sprachregression prüft zusätzlich 204 bestehende Routen und 190 Dialogaufrufe.

Der Build ist erfolgreich. `npm run typecheck` bleibt durch vier bereits vorhandene Diagnosen blockiert: zwei in `assets/portal-entry-scene.js` und zwei in `assets/portal-feedback.js`. Ein Vergleich mit dem vorherigen Commit `ac0fd4664a6488dcf168b3d5ff17145cf022dfe9` bestätigt dieselben Diagnosen; diese Änderung erzeugt keine zusätzlichen Typfehler.

## Grenzen und Sicherheit

- Sprache und Schnellzugriff sind bewusst Geräteeinstellungen. Ihre gemeinsame Verfügbarkeit im selben Browser ist keine Kontosynchronisation. Eine browserbasierte Rollenwahl darf nicht als Berechtigungsnachweis verwendet werden.
- Profiländerungen, kontobezogene Isolation und geräteübergreifende Synchronisation können erst mit der vorgesehenen authentifizierten Backendanbindung geprüft werden. Vorhandene MORA-Zugriffsverträge bleiben unverändert und liefern ohne angebundenen Adapter keine verifizierten persönlichen Daten.
- Es werden keine Passwörter oder Zugangstokens in die Einstellungsspeicherung geschrieben. Die Änderungen speichern dort ausschliesslich Sprachcodes beziehungsweise vorhandene Bereichs-IDs. Bestehende Datensätze werden nicht migriert oder überschrieben.
- Echte iPhone-/Android-Geräte und eine installierte PWA sind hier nicht verfügbar; die Browserprüfung verwendet tatsächliche CSS-Fenstergrössen in Chrome.

Keine zusätzlichen Bibliotheken, kein Redesign und keine Änderungen an Alexanders unabhängiger Portalentwicklung.
