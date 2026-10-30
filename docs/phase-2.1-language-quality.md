# MORADA Portal 2.0 · Phase 2.1

Sprachliche Qualitätsüberarbeitung vom 30. Oktober 2026. Entwicklungszweig: `codex/mora-ai-2.0`. Ausgangsstand: `dd89bb4c79341abd1aed756cd80dfe6101ab712c`.

## Ergebnis

Der gemeinsame Sprachkatalog umfasst 8’193 Einträge. 3’195 Einträge wurden gegenüber dem Ausgangsstand angepasst oder ergänzt: 374 deutsche, 2’590 englische und 2’228 französische Textwerte. Die englischen und französischen Ressourcen sind vollständig; Deutsch verwendet die bestehenden Quelltexte mit gezielten sprachlichen Überarbeitungen im selben Katalog.

DE-CH verwendet Schweizer Rechtschreibung ohne «ß» und die höfliche Sie-Anrede. EN verwendet britische Schreibweise. FR-CH verwendet die Vous-Anrede und Begriffe, die in der Romandie verständlich sind. Alle Interpolationsplatzhalter sind erhalten. Namen, Adressen, Dateien, eigene Eingaben und gespeicherte Gesprächsinhalte bleiben Originaldaten.

## Wichtige Änderungen

| Kontext | EN | FR-CH |
|---|---|---|
| Kontaktseite | Get in touch with MORADA. | Contactez MORADA. |
| Kontaktaktion | Send an email | Envoyer un e-mail |
| Persönliche Unterstützung | We’re here to help. | À votre écoute. |
| Ansprechpersonen | Your MORADA contacts | Vos contacts MORADA |
| Mietvertragsansicht | My tenancy agreement | Mon bail |
| Mieterportal | Your tenant portal. | Votre espace locataire. |
| Allgemeines Anliegen | Make a request | Faire une demande |
| Miete inklusive Nebenkosten | Rent including service charges | Loyer, charges comprises |
| Noch keine Wohnung verknüpft | No home linked yet | Aucun logement associé pour le moment |
| Erneute Prüfung der Speicherung | Check save status | Vérifier l’enregistrement |

Zusammengesetzte Kennzahlen, Mieterspiegel, Diagrammlegenden, Druckansichten und zugängliche Beschriftungen verwenden ganze übersetzbare Formulierungen. Das verhindert deutsche Wortstellung und verbliebene deutsche Fragmente. Kurze Navigationspfade wurden für schmale Bildschirme gekürzt. Die ausführlichen Bezeichnungen bleiben in Navigation und Ansichten erhalten.

## Verbindliche Terminologie

| DE-CH | EN | FR-CH | Kontext |
|---|---|---|---|
| Eigentümer | Owner | Propriétaire | Einzelne Rolle; Mehrzahl für Listen |
| Mieter | Tenant | Locataire | Einzelne Rolle; Mehrzahl für Listen |
| Immobilie | Property | Bien immobilier | Allgemeiner Immobilienbezug |
| Liegenschaft | Property | Immeuble | Bewirtschaftetes Gebäude |
| Einheit | Unit | Unité | Wohnung, Gewerbe, Parkplatz oder Lager |
| Mietverhältnis | Tenancy | Relation locative | Beziehung als allgemeines Fachkonzept |
| Mietvertrag | Tenancy agreement | Bail | Vertrag und zugehörige Kundenansicht |
| Bewirtschaftung | Property management | Gestion immobilière | Leistung und Portalbereich |
| Mandat | Management agreement | Mandat de gestion | Konkreter Bewirtschaftungsauftrag |
| Anliegen | Request | Demande | Allgemeines Kundenanliegen |
| Schadensmeldung | Maintenance request | Signalement de problème | Gemeldeter Schaden oder Reparaturbedarf |
| Leerstand | Vacancy | Vacance | Leerstehende vermietbare Einheit |
| Nettosollmiete | Expected net rent | Loyer net théorique | Erwarteter Mietwert; keine Forderung oder Zahlung |
| Nebenkosten | Service charges | Charges / frais accessoires | Kurzbezeichnung beziehungsweise Fachbegriff |
| Nebenkosten-Akonto | Advance service charge payment | Acompte de charges | Vorauszahlung mit späterer Abrechnung |
| Nebenkostenpauschale | Fixed service charge | Forfait de charges | Vereinbarter Pauschalbetrag |
| Mandatsrechnungen | Property invoices | Factures des immeubles | Rechnungen für verwaltete Liegenschaften |
| Mandatskonto | Client account | Compte de gestion | Konto der bewirtschafteten Liegenschaft |
| Dossier | Record | Dossier | Portaldatensatz; tatsächliche Datei bleibt file / fichier |
| Geplant | Planned | Prévu | Planung, noch nicht ausgeführt |
| Offen | Open | Ouvert | Noch nicht abgeschlossen |
| In Bearbeitung | In progress | En cours | Bearbeitung läuft |
| Abgeschlossen | Completed | Terminé | Inhaltlich erledigt |
| Beendet – Aufgaben-/Anliegenliste | Closed | Clôturées | Sammelansicht für erledigte und abgebrochene Vorgänge |
| Beendet – Vertragsstatus | Ended | Terminé | Vertragslaufzeit beendet |
| Freigegeben – Rechnung | Approved | Validée | Rechnung geprüft und freigegeben |
| Freigegeben – Kaution | Released | Libéré | Freigabe der Sicherheit |

Finanzielle Zuweisungen werden als allocation / affectation bezeichnet; Verknüpfungen zwischen Datensätzen als link / association. Eine Rücknahme einer fehlerhaften Erfassung wird nicht als tatsächliche Rückzahlung beschrieben. Unvollständige Budgetangaben werden nicht mit ausstehenden Zahlungen verwechselt.

## Geprüfte Bereiche

Administration, Bewirtschaftung, Eigentümer- und Mieterportal; Dashboard, Portfolio, Liegenschaften und Einheiten, Mandate, Mietverträge und Mieterspiegel, Unterhalt, Wartung, Fachprüfungen, Dienstleister, Neuvermietung, Interessenten, Abnahmen, Dokumente, Finanzen, Buchungen, Konten, Forderungen, Rechnungen, Budgets, Kautionen, Nebenkosten, Organisation, Aufgaben, Kalender, Kontakt, Suche, Profileinstellungen, Sprachwahl, Bereichswechsel und fest hinterlegte MORA-Texte.

Auch Formularfelder, Platzhalter, Bestätigungen, Fehler, leere Zustände, Statusanzeigen und zugängliche Beschriftungen wurden einbezogen. MORA-Begrüssung, Aktionen, Auswahlfelder, Hinweise zur Verarbeitung und Speicherbestätigungen wurden geprüft. Frei generierte Antworten wurden nicht nachträglich übersetzt.

## Prüfung

- Vollständige Testsuite: 493 Tests bestanden.
- Sprachintegration: 306 Ansichten und 285 Formularaufrufe über alle vier Rollen und drei Sprachen; keine fehlenden bekannten UI-Beschriftungen.
- Zusätzliche Prüfung befüllter Diagramme, Filter, Kennzahlen, ursprünglicher Benutzereingaben und bestehender MORA-Verläufe.
- Sprachwechsel, Speicherung der Sprache, Rollenwechsel und Wiederöffnung geprüft.
- Typprüfung, Syntaxprüfung und Build erfolgreich.
- Browserprüfung: 612 Ansichten bei 390 und 1’280 Pixeln; zusätzlich 24 Einstellungs-/Kontaktansichten und 12 MORA-Ansichten bei 320, 390, 768 und 1’280 Pixeln. Ergebnis der abschliessenden Prüfung siehe `evidence/phase-2.1/layout.json`.
- Die bestehende horizontal scrollbare Unterhaltsnavigation wurde geprüft und erhalten. Ihre Beschriftungen sind vollständig erreichbar.

Die 63 vorhandenen CSS-Blöcke sind identisch mit dem Ausgangsstand. Rollenwerte, Zugriffsregeln, Benutzerverwaltung, fachliche Berechnungen und gespeicherte Vertrags-/Statuswerte wurden nicht geändert. Die bestehende Übersetzungsarchitektur bleibt bestehen; optionale deutsche Textwerte ermöglichen Verbesserungen ohne Umbenennung gespeicherter Quellwerte.

Es wurden keine bestehenden Datensätze oder Chatverläufe bearbeitet. Kein Merge und kein Produktionsdeployment. `main` und `alex-portal` bleiben unverändert. Die bestehende Vercel-Konfiguration erstellt ausschliesslich die aktualisierte Entwicklungsvorschau.
