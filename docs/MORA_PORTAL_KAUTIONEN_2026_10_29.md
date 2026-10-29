# MORA in der Portalversion vom 29.10.2026

Grundlage: 29.10.2026_MORADA-Portal_Kautionen_Aktualisiert.html.
SHA256 der unveränderten gelieferten Datei: 6af8c190fafc2ee94b8a8cfdba904226d8a0c3d7f3303b8e1e7a6cbace162ef5.

Die vorhandene MORA-Integration wurde mit scripts/integrate-portal.mjs in portal.html übernommen. Rauchglasgestaltung, Verschieben/Grössenänderung, rollengetrennte Gespräche, Navigation, native Anliegen-/Fotoanbindung und geschütztes Backend bleiben erhalten. Der neue Kopfzeilenbutton nutzt denselben Chat wie der schwebende Startbutton. Keine zweite Chatinstanz.

Der Quelltreuetest entfernt den MORA-Block und die vier bisherigen optionalen Ergänzungen der nativen Speicherfunktion; das Ergebnis stimmt exakt mit dem SHA256 der gelieferten Datei überein. Damit bleiben insbesondere Kautionen, Verträge, Layout und alle sonstigen nativen Funktionen unverändert. Kautionen wird in MORAs Navigationskatalog nicht mehr als geplante Ansicht markiert; Finanzdaten bleiben für den Chat gesperrt.

Prüfung: 461 automatisierte Tests bestanden, TypeScript und Build (139 Dateien) erfolgreich. Die tatsächliche neue HTML-Datei wurde unter JSDOM geprüft: beide MORA-Startbuttons in allen vier Rollen, alle angebotenen Sidebarziele, Navigation, Formularübergabe, Speichern/Lesen, Raumkorrektur, gleiche Anliegen-ID, Fotos, Doppelklicks und kontrollierte Speicherfehler. Die neue asynchrone Ladephase wird im Test vor dem Eintritt abgewartet. Die Tests verwenden lokale Testantworten; keine kostenpflichtigen KI-Aufrufe. Keine neue visuelle Desktop-/Mobil-Browserabnahme.

Modell, Backend und Gesprächssteuerung wurden nicht geändert. Bekannte sprachliche Fehler und Grenzen der persönlichen Datenanbindung bleiben bestehen; diese Übertragung ist keine neue Qualitätsfreigabe. Kein Merge, keine Produktionsänderung, keine Änderung an main oder alex-portal.
