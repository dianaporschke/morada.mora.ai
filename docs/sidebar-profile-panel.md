# Sidebar profile refinement

The account row has no outer panel. Only the menu above it retains the warm translucent surface and fine border. The role-switch caption remains visible on mobile.

Hovering the gear with a mouse opens the menu without moving keyboard focus. A hover-only opening closes when the pointer leaves the gear/menu; a short 180 ms grace period allows crossing the gap between them. Clicking a menu opened by hover keeps it open and focuses the first action. Moving the pointer away after an explicit click keeps the menu open. A further click on the gear, Escape or a click elsewhere dismisses it. Touch and keyboard navigation retain their existing click/arrow behaviour.

The first navigation group is labelled Mein MORADA / My MORADA / Mon MORADA for all four roles. The separate workspace row below the logo (dot, MORADA and the right-hand label) has been removed for all roles. This affects only the sidebar: page headings and section breadcrumbs are unchanged. The extra separator beneath the language options is removed.

The overview date follows Europe/Zurich and updates at the minute boundary at midnight. Focus, visibility and page restoration refresh it after a suspended tab resumes. Only the date node changes; forms, focus, records and MORA history are retained.

Validation:
- `npm run build`: pass (165 script/assets checked; 8194 messages).
- `node --test tests/portal-profile.test.js tests/portal-i18n.test.js`: 12/12 pass, including hover/click dismissal, keyboard/touch behaviour, Swiss midnight, DST, year change and resuming after sleep; language coverage includes 306 routes and 285 forms.
- Browser layout matrix: 36 combinations of four roles, DE/EN/FR, and widths 320, 768 and 1280 px; no panel or text overflow.
- Desktop and mobile visual inspection; profile settings and outside-click dismissal verified. Computed account border is 0, background transparent, shadow none. Language footnote border is 0.
- No role permissions, record storage, page titles or MORA behaviour changed.

Evidence: [Desktop](evidence/sidebar-profile-panel/desktop.jpg), [Mobile](evidence/sidebar-profile-panel/mobile.jpg), [Language settings](evidence/sidebar-profile-panel/language-settings.jpg).

Hover follow-up: all seven profile tests pass, including pointer leave, crossing the menu gap, cancelling a pending dismissal by clicking, pinned-menu persistence, touch, keyboard and outside-click dismissal.

Typography follow-up: Schnellzugriff now shares the existing Space Grotesk section font with Mein MORADA. Browser-computed styles match: 11 px, weight 600, line-height 15.4 px and letter-spacing 0.66 px. Build and visual preview pass. [Evidence](evidence/sidebar-profile-panel/sidebar-typography.jpg).

Sidebar colour follow-up: the sidebar uses the exact MORA launcher gradient (135deg, #4c3b2d to #2b241d). Brand and navigation surfaces are transparent so the gradient remains continuous. Existing light text, active navigation and hover styles are retained. Build passes; browser-computed gradients match. [Evidence](evidence/sidebar-profile-panel/sidebar-dark-brown.jpg).

Flat colour correction: the sidebar now uses solid warm brown #514234, lighter than both ends of the previous gradient. The shared sidebar base token uses the same colour, so the profile menu remains coordinated. No directional gradient remains; navigation child surfaces stay transparent. Build passes (8198 messages; 167 scripts/assets checked). Desktop visual inspection confirms consistent colour from top to bottom and legible text/icons; computed background image is none and colour is rgb(81, 66, 52). [Evidence](evidence/sidebar-profile-panel/sidebar-flat-warm-brown.jpg).

Reference colour restoration: restored the original solid sidebar brown #45372b, sampled directly from the supplied reference screenshot (RGB 69, 55, 43). The shared sidebar base token matches, with no directional gradient. Local desktop preview confirms that exact computed RGB and background-image: none. Build passes (8198 messages; 167 scripts/assets checked). [Evidence](evidence/sidebar-profile-panel/sidebar-original-brown.jpg).

Brightness refinement: slightly lifted the solid reference brown from #45372b to #4b3c30 while retaining its warm hue. The sidebar and shared base token match. Local visual inspection confirms legible text/icons, computed RGB 75, 60, 48 and background-image: none. Build passes (8198 messages; 167 scripts/assets checked). [Evidence](evidence/sidebar-profile-panel/sidebar-lighter-warm-brown.jpg).
