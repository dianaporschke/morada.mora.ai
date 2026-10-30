# Sidebar profile refinement

The account row has no outer panel. Only the menu above it retains the warm translucent surface and fine border. The role-switch caption remains visible on mobile.

Hovering the gear with a mouse opens the menu without moving keyboard focus. A hover-only opening closes when the pointer leaves the gear/menu; a short 180 ms grace period allows crossing the gap between them. Clicking a menu opened by hover keeps it open and focuses the first action. Moving the pointer away after an explicit click keeps the menu open. A further click on the gear, Escape or a click elsewhere dismisses it. Touch and keyboard navigation retain their existing click/arrow behaviour.

The first navigation group is labelled Mein MORADA / My MORADA / Mon MORADA for all four roles. The small label to the right of MORADA beneath the logo also uses this wording for every role, replacing TEAM/OWNER/TENANT. This affects only the sidebar: page headings and section breadcrumbs are unchanged. The extra separator beneath the language options is removed.

The overview date follows Europe/Zurich and updates at the minute boundary at midnight. Focus, visibility and page restoration refresh it after a suspended tab resumes. Only the date node changes; forms, focus, records and MORA history are retained.

Validation:
- `npm run build`: pass (165 script/assets checked; 8194 messages).
- `node --test tests/portal-profile.test.js tests/portal-i18n.test.js`: 12/12 pass, including hover/click dismissal, keyboard/touch behaviour, Swiss midnight, DST, year change and resuming after sleep; language coverage includes 306 routes and 285 forms.
- Browser layout matrix: 36 combinations of four roles, DE/EN/FR, and widths 320, 768 and 1280 px; no panel or text overflow.
- Desktop and mobile visual inspection; profile settings and outside-click dismissal verified. Computed account border is 0, background transparent, shadow none. Language footnote border is 0.
- No role permissions, record storage, page titles or MORA behaviour changed.

Evidence: [Desktop](evidence/sidebar-profile-panel/desktop.jpg), [Mobile](evidence/sidebar-profile-panel/mobile.jpg), [Language settings](evidence/sidebar-profile-panel/language-settings.jpg).

Hover follow-up: all seven profile tests pass, including pointer leave, crossing the menu gap, cancelling a pending dismissal by clicking, pinned-menu persistence, touch, keyboard and outside-click dismissal.
