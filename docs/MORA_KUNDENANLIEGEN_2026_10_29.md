# Kundenanliegen – integrierte lokale Testversion

## Behobene Ursachen

Die frühere Funktionsfreigabe leitete Formularfähigkeit ausschliesslich aus der Verwaltungsroute `cases` ab. Kunden hatten nur eine leere Tabelle. Jetzt kennzeichnet `customer-case` ausdrücklich einen vorhandenen lokalen Kundenformular-Einstieg. `hasCaseForm()` wird von API, Modellkontext und UI gemeinsam verwendet; persönliche Serverberechtigungen bleiben davon getrennt.

Die Kundenansichten tenantSupport/ownerCases erhalten innerhalb der MORA-Integration manuelle Erfassung, MORA-Einstieg und die lokalen Entwürfe der aktuellen Sitzung. Kein zweiter Speicher: `state.cases`, `casePrepare`, `opsValidateState`, `companyCommit` und `portalReadStored` bleiben massgeblich. Der Kundenformular-Adapter nutzt vorhandene Portal-Feld-/Anhangskomponenten. Er erlaubt nur Titel, Anliegenart, Beschreibung, Bereich und lokale Anhänge. Verwaltungsfelder werden weder angezeigt noch aus übermittelten Formularwerten übernommen. Die normale Verwaltungsfunktion und ihre Berechtigungssperre bleiben unverändert.

Entwürfe sind mit zufälligem Sitzungsscope und Ansichtsrolle markiert. Das verhindert versehentliches Anzeigen anderer lokaler Testentwürfe. Es ist **keine echte Kundenauthentifizierung**. Der lokale Gesamtspeicher ist kein sicherer Mehrbenutzerserver. Für echte Kunden ist weiterhin Alexanders Anmeldung/Objektfreigabe und ein serverseitiger Speicheradapter nötig. Ein Zugangswechsel verwirft den lokalen Sitzungsscope; gespeicherte Daten bleiben im Portalstand bestehen, sind dann aber nicht mehr in der neuen Kundensitzung gelistet.

Die manuelle Erfassung benötigt keine KI. MORA-Vorbereitung und spätere Korrekturen verwenden dieselbe Entwurfs-ID. Speicherung wird erst nach Rücklesen der tatsächlich gespeicherten Felder und Anhänge bestätigt. Kein Versand wird simuliert.

## Gespräch und Aktionen

Die allgemeine Frage nach dem Meldeweg soll zum vorhandenen Formular führen und die Wahl zwischen manueller Eingabe und MORA anzeigen. Konkrete Schadensangaben werden auch in einer Nachricht mit Frage erfasst. Die Sichtbarkeit von Aktionen richtet sich weiter nach validierten Daten und tatsächlichem Formularstatus.

Die Erfolgsprüfung erkennt zusätzlich Behauptungen wie „vorbereitet“, „erstellt“ und „geöffnet“. Ein abgelehnter Erfolgsbeitrag darf einmal mit eingefrorenen Fakten und Aktionen korrigiert werden. Die Korrektur läuft nur bei diesem Fehler, mit demselben Modell, bestehendem Budgetwächter und Zeitlimit; keine normale zusätzliche Stilrunde. Sie kann weder Daten ändern noch einen Speicherbeleg erzeugen. Misslingt sie, bleibt der Fehler sichtbar. Dies garantiert keine vollständige semantische Fehlerfreiheit.

## Prüfung und Grenzen

Automatisierte Tests prüfen die reale HTML/Formular-/Speicherstrecke mit ausdrücklich lokalen Testantworten, einschliesslich manuell/MORA, Raumkorrektur, unveränderter ID, mehreren Anliegen, Fotozuordnung, Doppelklick, Speicherfehler und getrennten Sitzungsscopes. Die unveränderte native Portalbasis wird per Quellhash geprüft. Echte KI-Antworten stehen separat im Evidenzbericht.

Nicht implementiert: echtes Einreichen, Kundenakten, Vertrags-/Rechnungsinhalte, persönliche Objektzuordnung, Versand, Handwerkerbeauftragung und Walkthrough-Auswahl. Keine neuen Rollen, keine API-Schlüssel im HTML, keine Produktionsänderung. Keine Behauptung einer „perfekten“ oder produktionsreifen Assistenz.
