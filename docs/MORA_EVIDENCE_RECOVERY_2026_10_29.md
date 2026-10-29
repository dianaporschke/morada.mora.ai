# Begrenzte Korrektur nicht auffindbarer Textbelege

Auslöser: Screenshot 29.10.2026 10:40 Schweizer Zeit, „Seit gestern funktioniert eine Lampe im Wohnzimmer nicht.“ Serverdiagnose field_quote_not_in_message, Feld defect, ein Modellaufruf. Der genaue verworfene Textbeleg wurde nicht protokolliert.

Der kompakte Agent korrigiert einmalig die strukturierte Erfassung, wenn ein Anliegen- oder Feldbeleg nicht im Originaltext auffindbar ist. Dabei erhält dasselbe Modell den Originalkontext, die verworfene Ausgabe und die genaue Diagnose. Vor dieser Korrektur werden weder Fakten noch Aktionen angewendet. Die korrigierte Ausgabe durchläuft unverändert Schema-, Beleg-, Referenz-, Aktions- und Antwortprüfungen. Wiederholter Fehler bleibt ein Fehler; kein Erfinden von Belegen, kein stilles Weglassen betroffener Fakten.

Nur diese beiden Belegfehler lösen den zusätzlichen Aufruf aus. Keine Schleife, kein Modellwechsel, keine zusätzliche Stilüberarbeitung. Der bestehende Zeitrahmen und die Budgetreserve gelten vor jedem Aufruf. Normale Nachrichten bleiben bei einem Aufruf, die bisherige bedingte Aktionsprüfung bleibt bestehen. Erfolgreiche Belegkorrektur erscheint als repaired=true, repairScope=source_evidence und evidence_repair-Ereignis.

464 automatisierte Tests, Typprüfung und Build bestanden. Regressionen: Screenshot-Lampe, vollständiges Mapping, anschliessende Raumkorrektur unter gleicher ID; zweimal falscher Beleg ohne Zustandsänderung; Budgetblock vor zweitem Aufruf. Mock-Modelltransporte sind kein Nachweis echter Gesprächsqualität. Live-Test wird separat aufgezeichnet. Bestehende Probleme mit Portalbehauptungen und Fehlalarmen der Aktionsprüfung sind nicht Gegenstand dieser gezielten Änderung.

## Erster echter Versuch und nachgewiesene Grenze
Die erste Korrekturvariante scheiterte am Screenshot-Satz erneut mit field_quote_not_in_message. Zwei echte Modellaufrufe, beobachtete Kontodifferenz USD 0,0023073. Nachweis: evidence/mora-source-recovery-live-2026-10-29.json. Der Test wurde sofort beendet; kein Erfolgsnachweis.

Die Korrektur verwendet deshalb jetzt ein eingeschränktes Schema: quote kann ausschliesslich aus wörtlichen Originalpassagen gewählt werden. Passagen entstehen aus Sätzen, bei langen Sätzen aus begrenzten Abschnitten, und bereits gültigen Originalbelegen. Werte und Referenzen durchlaufen weiter die vorhandenen Prüfungen. Das macht falsche Wortfolgen im Textbeleg strukturell ungültig, ersetzt aber keine vollständige semantische Wahrheitsprüfung.
