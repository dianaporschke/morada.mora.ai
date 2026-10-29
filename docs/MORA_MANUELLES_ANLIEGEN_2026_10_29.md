# Manuelle Erfassung und MORA-Vorbereitung

## Umgesetzt

- `new-case` öffnet das vorhandene `caseOpenForm()` ohne vorausgefüllte Chatangaben. Keine neue Anliegenverwaltung oder Speicherstruktur.
- Bei einem neuen vorbereitbaren Anliegen bietet die MORA-Oberfläche die manuelle Alternative einmal neben der Vorbereitung an. Nach Vorbereitung/Speicherung kein automatisches neues manuelles Angebot.
- Die native Rollensperre bleibt bestehen: Administration/Bewirtschaftung verfügbar; Mieter/Eigentümer nicht verfügbar.
- Gemeinsame Modellvorgaben erklären beide tatsächlich verfügbaren Wege ohne feste Antwortvorlage. Nicht angebundene Kundenübersichten dürfen nicht als Meldeformulare beschrieben werden. Fotos sind optional und keine Begründung für eine fehlende Textmeldung.
- Keine Änderung an Modell, Kostenlimit, Konten, Produktion oder Alexanders Branch.

## Offene Anforderung: Mieter

Die gelieferte HTML-Version hat unter `tenantSupport` eine leere Tabelle. `crmWritable()` schliesst Kunden aus; `caseOpenForm()` und `opsSaveRecord()` prüfen diese Sperre. Ein Verweis auf ein funktionierendes Mieterformular wäre weiterhin falsch. Die Sperre wurde nicht entfernt und keine Administratorrolle simuliert. Der vollständige vom Nutzer gewünschte Mieterablauf ist daher noch nicht implementiert.

## Benötigte Portal-Schnittstelle

Alexander muss einen berechtigten Kunden-Einstieg in die vorhandene Anliegenfunktion bereitstellen (manuell und mit optionalen Startwerten für dasselbe Formular):

```ts
openCustomerCaseForm(input: {
  draftId?: string;
  initialValues?: { title: string; description: string; category: string; unit: string };
}): Promise<{ opened: boolean; draftId: string }>;
```

Die serverseitige Anmeldung bestimmt Kundenkonto, Mietverhältnis und zulässige Objekte. Keine frei übermittelten Rollen oder Objekt-IDs als Berechtigung akzeptieren. Keine Zuständigkeits-, internen Status-, Kontakt- oder fremden Liegenschaftsauswahlen aus dem Verwaltungsformular offenlegen. Änderungen und Anhänge nur für eigene berechtigte Entwürfe. Der manuelle Einstieg darf keine KI-Anfrage erfordern.

Der Adapter braucht getrennte Ereignisse für Formular geöffnet, geschlossen, Speicherung fehlgeschlagen und Speicherung bestätigt. Letzteres liefert `draftId`, Revision und tatsächlich gespeicherte Felder/Anhänge zur Rückprüfung. Wiederholtes Speichern muss dieselbe ID aktualisieren. `transmitted` darf nur aus einer separaten bestätigten serverseitigen Übermittlung stammen. Eine lokale Speicherung oder ein geöffnetes Formular ist keine Übermittlung.

## Prüfung

Automatisierte DOM-Tests verwenden explizite lokale Testantworten. Geprüft: beide Wege benutzen das native Formular; manuelle Erfassung startet leer; native Speicherung und Rücklesen; keine doppelte manuelle Aktion; alte Aktionen verschwinden bei Fehlern; kein Kunden-Zugriff auf das Verwaltungsformular. Der bestehende Quellvergleich prüft den unveränderten Portalteil.

Echte Modellantworten und Kosten werden separat in `docs/evidence/mora-manual-paths-live-2026-10-29.json` festgehalten, sofern der bestehende Budgetwächter den Test zulässt. Automatisierte DOM-Tests belegen keine fehlerfreie Gesprächsqualität und keine mobile Safari-Prüfung.


### Ergebnis dieser Prüfung

- Gesamtlauf: 466 Tests, davon zunächst 465 erfolgreich; die alte Prüfung erwartete zwei statt nun drei Aktionen. Nach Änderung auf explizite Buttonbeschriftungen bestanden alle 32 Portal-Integrationstests. Die übrigen 434 Tests hatten bereits bestanden.
- Typecheck und Build (139 Dateien) erfolgreich. Native Portalquelle unverändert.
- Drei echte Antworten auf der Preview: Mieter nennt fehlendes Formular; Administration erklärt beide Wege; ausdrücklicher manueller Wunsch verweist auf den vorhandenen Formularbutton. Alle drei HTTP 200. Konto-Kostendifferenz ca. 0,0032014 USD (keine exakte Einzelabrechnung). HTTP-Laufzeiten 11,35 / 7,85 / 7,74 Sekunden; keine Messung der Browseranzeige.
- Die Antworten sind noch ausführlich. Kein Nachweis einer allgemeinen Verbesserung der Natürlichkeit; kein vollständiger Mieterablauf.
- Laufzeitcommit: e99c2c61e61a73d5e38c55a90369fe5152245fb7.
- Preview: https://morada-mora-bw7mu6ium-dianaporschke-1255s-projects.vercel.app/portal.html

- Offener Befund: Bei der kombinierten Verwaltungsfrage erklärt das Modell beide Möglichkeiten, liefert aber zunächst keine Aktionsbuttons (`controls.navigation=[]`, `save=null`). Erst auf den ausdrücklichen manuellen Wunsch folgt `new-case`. Die lokale UI-Prüfung belegt beide Buttons bei strukturiert vorbereitbarem Anliegen, nicht deren zuverlässige Auslösung durch jede natürliche Formulierung.
