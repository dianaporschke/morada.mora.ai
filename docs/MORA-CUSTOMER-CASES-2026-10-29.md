# MORA customer case integration — 29 October 2026

Runtime base: c0189131ff20462482516a7274c60902765c78e0, branch codex/mora-ai-2.0. No production deployment.

## Findings and changes
The customer views previously exposed an empty table without a writable case adapter, while administrative cases had the native form and writer. MORA correctly saw no form in customer views. A shared customer-case capability now connects the existing cases collection, casePrepare/opsValidateState, companyCommit and portalReadStored. No second case store was introduced.
Manual and MORA forms use the same public fields and attachment controls. MORA updates keep record identity, protect manual edits and verify durable readback. Unknown onset stays unknown; light maps to Lampe / Leuchte. Customer records are scoped to role and local session; internal fields are not editable through the adapter.
Success wording now covers prepared/created/opened claims as well as storage claims, with a bounded conditional repair. No model change or routine second wording call.
Browser QA also found a stale empty-table notice and zero counter after saving; the adapter now updates both and uses the existing details column.

## Verification
470 automated tests passed, including customer manual/MORA persistence, room correction with same record ID, multiple cases, attachments, updates, repeated clicks and failed storage. Typecheck and build passed (140 files).
Live evidence: docs/evidence/mora-customer-cases-live-2026-10-29.json. Three conversations, six real responses, all HTTP 200. Tested defect reporting navigation; lamp → living room → bedroom correction → unknown onset and explicit prepare; separate heating/window concerns. Lamp retained equipment=light, defect=kaputt and corrected bedroom; onset was explicitly unknown. Prepare returns an action with no model reply by design: the client opens the form. This HTTP runner did not itself perform the resulting browser save.
Observed request durations 5.98–10.05 seconds. Account usage delta USD 0.0069918 (may include concurrent account usage), not a universal per-conversation tariff.
Desktop browser: temporary share link opened without Vercel login; tenant service page, manual form, save and resulting row verified. Test data labelled UI-Test. Final counter correction covered by regression and requires final Preview recheck. No new physical smartphone verification.

## Remaining limitations
Live responses still included mechanical thanks and repeated preparation wording despite current instructions. Do not claim natural-language quality is completely fixed.
Customer drafts are local, not transmitted to MORADA. Browser session scoping is not authentication or server-side authorization. Native account binding, shared persistence, actual submission acknowledgements, and permissions need the portal backend from Alexander. Documents, invoices, personal financial records and walkthrough are not connected to model data access.
The existing homepage “Anliegen melden” still opens the portal's contact page; the actual local form is under Meine Anliegen. Native portal navigation was preserved.
The standalone HTML requires the existing protected API backend and matching assets/routes to run MORA; opening HTML alone does not provide AI.

