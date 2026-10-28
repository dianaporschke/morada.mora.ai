# MORA Chat – Rauchglas und Kupfer

Umgesetzt auf `codex/mora-ai-2.0`, Ausgangsstand `80bb1107745bddafe0cbcd7637b22698e2ba1f82`. Die zuletzt verlinkte Preview `morada-mora-fwl7ibk0c-dianaporschke-1255s-projects.vercel.app/portal.html` hatte denselben Runtime-Stand; danach kamen nur Prüfdokumente hinzu.

## Umfang

- `assets/mora-portal.css`: ausschliesslich gekapselte MORA-Styles. Warmes, transparentes Rauchglas mit Hintergrundunschärfe, deckender Ersatzfläche, Kupferaktionen, lesbaren Nachrichten, Fokus- und deaktivierten Zuständen. Desktopbreite 552 px. Mobile Ansicht mit sicheren Randabständen und kompakterem Avatar.
- `assets/mora-portal-client.js`: bestehende Oberfläche und Eventhandler weiterverwendet. Vierstrahliger Stern, beschriftete Linienicons, visuelle Aktionshierarchie. Ein gemeinsamer Scrollbereich für Verlauf und Aktionen; Kopf und Eingabe bleiben sichtbar. Automatisch begrenzt wachsende Eingabe, VisualViewport-Anpassung, Leseposition bleibt beim Eintreffen einer Antwort und Wiederöffnen erhalten. Der Startbutton überlagert den geöffneten Chat nicht.
- `portal.html`: identischer integrierter MORA-Block. Der HTML-Quelltext ausserhalb dieses Blocks ist bytegleich zum Ausgangsstand.
- `tests/portal-ui.test.js`: fünf neue Verhaltenstests.
- `scripts/ui-redesign/`: isolierte, gekennzeichnete lokale Testansichten. Alle API-Aufrufe sind Testantworten; keine KI-Aufrufe. Generierte QA-Seiten werden durch den regulären Build entfernt und nicht veröffentlicht.
- `docs/evidence/mora-glass-{desktop,mobile}.jpg`: echte Browseraufnahmen der implementierten Oberfläche mit sichtbar markierten Testdaten, keine generierten Designbilder.

Modell, Prompts, Gesprächsentscheidungen, Datenmapping, Speicherung, Portal-Bridge und Backend wurden nicht verändert. Keine neue Chatimplementierung, keine neuen Dienste. Portalnavigation und bestehende Portalformulare bleiben unverändert. Keine Änderungen an `main` oder `alex-portal`, kein Merge, kein Produktionsdeployment.

## Prüfung

- 413 automatisierte Tests bestanden (408 bestehende + 5 neue), TypeScript-Prüfung und Build bestanden.
- Neue Tests: Aktionsdarstellung ohne Duplikate und Gesprächserhalt; Enter/Shift+Enter/IME und Doppelausführung; Leseposition bei eintreffender Antwort; mehrzeilige Eingabe mit Höhenbegrenzung; Viewport-Anpassung ohne Gesprächsänderung.
- Tatsächlicher Chromium-Browser, responsive Framegrössen: 1440×900, 1180×720, 390×844 sowie 390×460 als verringerte Tastaturhöhe. Keine horizontale Scrollfläche innerhalb von MORA. Kopfzeile, Eingabe und Speicherhinweis bleiben im kleineren verfügbaren Bereich erreichbar.
- Visuell geprüft: Begrüssung, kurzer Verlauf, lange mehrteilige Nachrichten, Anliegenübersicht mit primärer/sekundärer Aktion, Ladezustand, Fehlermeldung, mehrzeilige Eingabe und deckende Ersatzfläche ohne Blur.
- Interaktiv geprüft: Öffnen/Schliessen und Erhalt der Nachrichten, Tastaturscrollen im langen Verlauf, Eingabe wächst/schrumpft, deaktiviertes Senden während einer gehaltenen Testantwort, Freigabe dieser Antwort, Fotoaktion öffnet bestehendes Anliegenformular. Die ausgewählte lokale Test-PNG erscheint im vorhandenen Anhangsbereich mit Dateiname und Entfernen-Aktion.
- Der lokale HTTP-Testbrowser kann die geschützte native Portalspeicherung nicht ausführen: Der Speicherversuch meldete korrekt die erforderliche HTTPS-Umgebung und behielt die Eingaben. Daher wird ein erfolgreicher echter Speichervorgang mit Anhang hier **nicht** behauptet. Bestehende automatisierte Speicher-/Bridge-Regressionen bestehen weiterhin.
- Keine neue Anhangsvorschau im Chat erfunden: Fotos bleiben in der bereits vorhandenen Portal-Anhangsfunktion.
- Berechneter Mindestkontrast über weissem Portalhintergrund: Sekundärtext auf hellster Glasstelle 4,64:1, Kundennachricht 4,89:1, primärer Button 4,83:1, Hover 4,54:1. Text/Icons/Container haben keinen Blur; Container-Opacity ist 1. Nur der Hintergrund wird weichgezeichnet.

## Grenzen

Responsive Mobilprüfung im Desktop-Chromium, kein physisches iPhone/Android-Gerät und keine echte Bildschirmtastatur. Die Höhenänderung wurde simuliert; VisualViewport-Verhalten ist zusätzlich automatisiert geprüft. Safari und leistungsschwache Geräte wurden nicht direkt geprüft. Reduzierte Bewegung und reduzierte Transparenz sind per CSS berücksichtigt. Keine Live-KI-Gespräche und keine KI-Kosten für diese UI-Abnahme.

## Verfeinerung nach visueller Rückmeldung

Die Desktopansicht wurde von 552×780 auf maximal 440×620 px verkleinert (rund 37 % weniger Fläche bei voller Höhe). Kopfzeile, Stern, Nachrichtenabstände und Eingabe sind kompakter; Kontur und Schatten zurückhaltender. Der doppelte Fokusrahmen der Eingabe wurde zu einer einzelnen klaren Kontur vereinfacht. Nachrichtentext bleibt 15 px auf Desktop und 16 px mobil. Die mobile Flächennutzung bleibt erhalten.

Nur CSS und der daraus generierte MORA-Block wurden angepasst. Die sechs einschlägigen UI-/Portalquelltests sowie der Build bestehen. Browserprüfung bei 1440×900, 1180×720 und 390×844: kein horizontaler Chatüberlauf, Eingabe erreichbar, Aktionen weiterhin sichtbar. Aktuelle Aufnahme: `docs/evidence/mora-compact-desktop.jpg`.
