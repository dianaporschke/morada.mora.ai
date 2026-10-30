# Sidebar profile panel refinement

Warm, subtly lighter profile surfaces use the existing MORADA brown/beige palette. The account row and profile menu share aligned edges, a fine translucent border, restrained depth and gentle hover/active states. Existing keyboard focus indication remains visible. The role-switch caption stays visible on mobile, overriding the old compact topbar rule only inside the profile menu.

Only the existing profile CSS in `portal.html` changed. Markup, text, icons, scripts, roles, language behaviour and portal functions are unchanged.

Validation:
- `npm run build`: pass (165 script/assets checked).
- `node --test tests/portal-profile.test.js`: 4/4 pass.
- Browser layout check: 48 combinations of four roles, DE/EN/FR, and widths 320, 390, 768 and 1280 px (568 px height at 320 px width; 780 px otherwise); no panel overflow, text overflow or alignment issues.
- Visual inspection on desktop and mobile; settings and workspace selector open correctly.
- Source comparison confirms all non-style content is byte-for-byte unchanged.

Evidence: [Desktop](evidence/sidebar-profile-panel/desktop.jpg), [Mobile](evidence/sidebar-profile-panel/mobile.jpg).
