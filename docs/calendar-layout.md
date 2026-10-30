# Calendar layout refinement

The calendar follows the supplied layout reference using existing MORADA colours, fonts and controls. The left column contains compact metrics, period navigation, filters and the calendar. The right-hand daily overview starts alongside the metrics and separates appointments, other due items, tasks and quick actions. Existing CSV/ICS exports, result counts and calendar notes remain available.

Month cells share seven equal columns and equal fractional week rows, with explicit sizing independent of event content. One compact entry is visible by default; spacious desktop viewports show two. Additional records remain reachable from the day selector, count indicator and daily overview. On short desktop displays the day count replaces the extra text row. The day panel shows up to two records per section and links to the existing full-day dialog. No source records are changed or discarded.

Responsive layouts stack the daily overview below the calendar on smaller screens. The existing mobile list default remains unchanged. Low-height laptop screens can still need a short vertical scroll, particularly for a six-week month or when the navigation history is shown. At 1363 × 936, the ordinary five-week calendar ends at y=811 and the daily overview at y=841, both within the viewport.

Validation:
- Build passes: 166 script/assets checked, 8198 shared messages.
- Calendar and language tests: 8/8 pass; language coverage includes 306 routes and 285 forms. The 3 calendar tests also pass after the final text adjustment.
- Existing month/week/list navigation, date selection, team filtering, appointment/task forms and return navigation verified; source state remains unchanged.
- Four-, five- and six-week months tested, including 20 records on a single day with long titles.
- Browser checks at 1366 × 768, 1440 × 900, 1672 × 941, 1920 × 1080, 1024 × 768, 768 × 1024, 390 × 844 and 320 × 640, covering DE/EN/FR and administration/property management.
- No cell content overflow or horizontal page overflow. Grid dimensions differ by at most the browser's 1/64 CSS-pixel rounding.
- All test records were temporary, in-memory QA fixtures. The screenshot shows the actual empty preview; no entries from the reference image were copied.

Evidence: [Desktop](evidence/calendar-layout/desktop.jpg), [Responsive measurements](evidence/calendar-layout/responsive-checks.json).
