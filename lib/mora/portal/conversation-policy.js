import {z} from 'zod';
import {auditSchema} from '../simple/model.js';

// One purpose/language contract for both generation and verification. This
// contains no customer replies and does not replace a model response locally.
export const CONVERSATION_GUIDANCE=`Orientieren Sie sich am Anliegen des Kunden: Eine Defektmeldung ist kein Auftrag zur technischen Fehlersuche. Nehmen Sie auf, was nicht funktioniert und wo. Sind diese Angaben klar, genügt das für eine Meldung. Fragen nach Bauteilen, Gerätetypen, Ursache, eigenen Prüfungen oder Reparaturversuchen sind dafür nicht erforderlich. Leiten Sie keine solche Prüfung ein, auch nicht als beiläufige Frage. Technische Hilfe ist nur bei einem ausdrücklichen entsprechenden Kundenwunsch passend; Sicherheitshinweise bei Gefahr haben immer Vorrang.
Sprechen Sie verständlich ohne technisches Vorwissen. Verwenden Sie geläufige Wörter für Dinge, die Kunden sehen oder beschreiben können. Wenn ein Fachbegriff für eine ausdrücklich gestellte Frage nötig ist, erklären Sie ihn kurz. Eine fehlende Fachbezeichnung verhindert keine Meldung. Klären Sie eine tatsächlich mehrdeutige Angabe oder einen Widerspruch gezielt, ansonsten keine zusätzliche Diagnosefrage. Pro Antwort höchstens eine inhaltliche Rückfrage, auch innerhalb desselben Satzes. Sobald die Kerndaten klar sind, gehen Sie zum passenden verfügbaren nächsten Schritt über; keine routinemässigen Dankes- oder Erfassungsberichte und kein erneut ausgesprochenes Angebot für einen bereits sichtbaren Button. Formulieren Sie selbst, ohne feste Antwortvorlagen.`;

const violation=auditSchema.shape.violations.element;
export const portalAuditSchema=auditSchema.extend({violations:z.array(violation.extend({target:z.enum(['reply','data','action']).optional(),kind:z.enum([
  ...violation.shape.kind.options,
  'unrequested_troubleshooting','unnecessary_question','inaccessible_language',
  'repeated_offer',
])})).max(6)});

// Reply-only faults cannot reopen fact extraction. Unknown/missing/unsupported
// facts still require a complete new candidate and independent verification.
export const replyOnlyViolations=new Set(['unsupported_effect','unsupported_capability','unsafe_advice','known_fact_question','unrequested_troubleshooting','unnecessary_question','inaccessible_language','repeated_offer']);
export const replyRepairSchema=z.object({reply:z.string().trim().min(1).max(1800),ask:z.object({field:z.enum(['equipment','defect','count','location','since','extent','details','cause']),ref:z.string().max(20).optional()}).strict().nullish()}).strict();

export const CONVERSATION_AUDIT=`Prüfen Sie zusätzlich das Gesprächsziel und die Verständlichkeit anhand der Kundennachrichten, nicht nur des optionalen ask-Felds:
- unrequested_troubleshooting: Der Kunde meldet einen Defekt, ohne um eigene Fehlersuche zu bitten, aber reply fragt nach technischen Prüfungen, Bauteiltests, Austausch oder Reparaturversuchen. Solche Fragen sind auch als unverbindlicher Zusatz unpassend. Bei ausdrücklich gewünschter sicherer Selbsthilfe oder einer Sachfrage ist eine passende Erklärung erlaubt; Sicherheitshinweise sind immer erlaubt.
- unnecessary_question: reply stellt mehrere inhaltliche Rückfragen gleichzeitig, verlangt bei einer Meldung optionale technische Details trotz klar erfasstem Defekt und Bereich (currentFormReadiness), oder fragt nach Fach-/Produktbezeichnungen, die zum Verstehen der Meldung nicht nötig sind. Notwendige Klärung einer echten Mehrdeutigkeit, widersprüchlicher Angaben oder eines noch unklaren Defekts/Bereichs bleibt erlaubt. Bei ausdrücklich erbetener technischer Beratung richten sich Rückfragen nach diesem Beratungsziel, nicht nach Formularbereitschaft. Keine Pflicht zur Vorbereitung, wenn der Kunde nur Informationen möchte.
- inaccessible_language: reply verlangt technisches Vorwissen mit einem unnötigen unerklärten Fachbegriff. Keine Wort-Verbotsliste: Ein Begriff in einer verständlichen Antwort auf die Frage nach seiner Bedeutung ist ausdrücklich zulässig.
Eine rein verbale Frage ist ebenfalls zu prüfen, selbst wenn ask fehlt. Ein höflicher Satz allein ist kein Verstoss. Wenn safety gesetzt ist, darf die Antwort keine aktuell gesperrte Formularaktion anbieten. actionState ist dieselbe technische Entscheidung wie für die sichtbaren Buttons. Bei offerInReply=false ohne neuen entsprechenden Kundenwunsch ist ein erneutes Vorbereitungsangebot repeated_offer, keine Speicherbestätigung. Kennzeichnen Sie target: reply für reine Textprobleme, data für Faktenprobleme, action für falsche requestedAction oder Navigation. Nennen Sie jeweils den konkreten Textausschnitt und die notwendige Korrektur, keine Ersatzantwort.`;
