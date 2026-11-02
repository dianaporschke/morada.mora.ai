# MORADA Portal 2.0 – Phase 3.4

Stand: 2. November 2026. Dianas bestehender Branch `codex/mora-ai-2.0`.

## Gezielte Korrekturen

- Die vorhandenen Dialoge verwenden auf mobilen Breiten die tatsächlich verfügbare Höhe und Position von `VisualViewport`. Lange Inhalte bleiben scrollbar; Kopfzeile und bestehende Formularaktionen bleiben getrennt erreichbar. Ohne diese Browser-API wird die Fensterhöhe verwendet. Manuelles Vergrössern wird nicht durch Fokuskorrekturen überschrieben.
- Navigation, Formular und verschachtelte Abbruchwarnung teilen eine Scrollsperre. Erst nach dem letzten geschlossenen Fenster wird die vorherige Seitenposition wiederhergestellt. Die Fokusrückgabe löst kein zusätzliches Scrollen aus.
- Eingabefelder und Auswahllisten verwenden mobil mindestens 16 px. Der Fokus wird innerhalb des Formulars sichtbar gehalten. Bestehende E-Mail-, Telefon-, Datums- und Uhrzeittypen bleiben erhalten. Sehr schmale Terminformulare zeigen Datums- und Uhrzeitfelder über die ganze Zeile.
- Kalenderpfeile, Tagesnavigation, wichtige Aktionen, Umschalter und Schliessen-Flächen sind mindestens 44 px hoch. Die sieben engen Monatsspalten bleiben gleich breit; kompakte Terminchips behalten ihre bestehende Darstellung und den Zugang über die grössere Tagesauswahl.
- Kalenderfilter nutzen zwei Spalten statt einer langen Folge einzelner Felder. Nach der Tagesauswahl steht die Tagesübersicht unterhalb der festen Kopfzeile. Dort werden lange Termintitel vollständig umgebrochen; die bestehende Auswahl für weitere Termine bleibt verfügbar.
- Sichere Randabstände, Querformat und reduzierte Höhen werden berücksichtigt. Korrekturen der Darstellung gelten ausschliesslich bis 1024 px; die Desktopaufteilung bleibt erhalten. Bestehende Farben, Schriften, Animationen und reduzierte Bewegung werden weiterverwendet.

## Abschlussprüfung

Build erfolgreich. 78 gezielte Tests bestanden, darunter vier neue Verhaltenstests für die mobile Scrollsperre, verschachtelte Warnungen, Fokus bei verkleinertem Sichtbereich und Browser ohne `VisualViewport`.

Browserprüfung in Chrome mit tatsächlichen eingebetteten CSS-Fenstergrössen (keine Gerätesimulation oder Änderung des User-Agents):

| Fenstergrösse | Prüfung |
| --- | --- |
| 320 × 568 | Schmale Dialoge, volle Datumsfelder, Filter, Navigation, Speicherfehler mit erhaltenen Eingaben; kein horizontaler Seitenüberlauf |
| 390 × 844 | Kalender mit zwölf isolierten Testterminen, sieben Spalten, gleich hohe Monatszellen, Tagesauswahl, lesbare Titel und Farben |
| 430 × 932 | Grösseres Terminformular; gleiche Eingaben und erreichbare Aktionszeile |
| 844 × 390 | Querformat; scrollbar bleibendes Formular und Profilfenster, erreichbare Kopf- und Aktionsbereiche |
| 390 × 400 | Reduzierte Höhe; fokussierte Notizen bleiben im Formular sichtbar, verschachtelte Warnung bleibt bedienbar |
| 1440 × 900 | Bestehender zweispaltiger Kalender, 42 Tagesfelder und sieben Wochentage, Profilfenster; kein horizontaler Seitenüberlauf oder verbliebene mobile Scrollsperre |

Zusätzlich geprüft: Monatswechsel, Heute/Morgen, Woche/Liste/Monat, Navigation zwischen Übersicht, Kalender, Aufgaben, Liegenschaften und Eigentümerkontakten; Profilmenü und Einstellungsbereiche per Klick. Bei reinen Kalenderwechseln erscheinen keine Benachrichtigungen. Die Termin- und Wiederherstellungsabläufe werden mit den vorhandenen Speicherfunktionen automatisiert geprüft.

Die zwölf Termine stammen aus einer isolierten, nicht veröffentlichten Layout-Prüfseite. Sie sind keine Kundendaten und werden nicht in den ausgelieferten Quellstand übernommen.

## Nicht überprüfbare Punkte

- Keine realen iPhone-/Safari- oder Android-/Chrome-Geräte vorhanden. Native Bildschirmtastaturen, Safari-Datumsauswahl, tatsächliche Notch-Abstände und mobile Browserleisten müssen auf Geräten nachgeprüft werden. Eine reduzierte CSS-Höhe ersetzt diesen Test nicht.
- Die Reaktion auf `VisualViewport`-Höhe und -Versatz ist automatisiert geprüft; eine echte Bildschirmtastatur wurde hier nicht eingeblendet.
- Eine installierte Portal-PWA war in dieser Umgebung nicht verfügbar.
- Die lokale HTTP-Vorschau unterstützt die bestehende geschützte Terminspeicherung über Web Locks nicht. Der reale Fehlerpfad wurde dort geprüft; erfolgreiche Termin-, Bearbeitungs-, Lösch- und Rückgängig-Abläufe sind durch die Speichertests abgedeckt.

Keine zusätzliche Bibliothek, keine parallele mobile Codebasis und kein neues Portalmodul. Alexanders unabhängige Entwicklung wurde nicht geändert.
