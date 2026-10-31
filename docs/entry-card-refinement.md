# Entry card refinement

The entry page now uses the supplied reference for its right-hand card: a short welcome heading, four vertically stacked workspace actions, warm circular line icons and a subtle arrow on each row. Selecting a row calls the existing workspace entry handler directly; native submit buttons retain Enter/Space keyboard behaviour. The former radio selection and separate open button are replaced by these four actions. No access rights or workspace data are changed.

The existing city artwork, its bytes, animation JavaScript and 8.84-second reveal are untouched. Both columns now share the lighter warm beige `#f5eee4`, with no dividing line or separate paper tint. The illustration remains confined to the left column. The reference image is not bundled or used as artwork. The portal sidebar is a flat dark warm brown, `#503c2e`, without a gradient.

The new heading, introduction, short role descriptions and local-workspace notice use the existing DE/EN/FR catalogue. Owner and tenant areas remain clearly marked as previews. The reference's secure-account claim is not copied: the current app stores local workspace data on the device and does not provide personal authenticated accounts. The contact link remains available.

Validation:

- Positioning follow-up: the desktop art column now uses the viewport height instead of a fixed 820 px minimum, and the entire title block starts at `clamp(145px, 19svh, 220px)`. At desktop heights up to 850 px, modestly reduced card spacing keeps it fully visible and centred. Desktop measurements from 1024×768 through 1920×1080 show equal top/bottom margins within 0.02 px, no horizontal overflow and no page-height overflow. The mobile layout is retained. Build passes.

- Background-only follow-up: the build passes, and desktop/mobile browser measurements confirm `rgb(245, 238, 228)` on the root and both columns, no dividing borders, and a transparent scene surface. Artwork, timing, JavaScript and layout are unchanged.

- Production build passes: 8205 messages; 171 scripts/assets checked.
- 17/17 entry-animation, profile and language integration tests pass. The new native-button test opens all four workspaces in each of the three languages and verifies that portal records do not change. Existing coverage exercises 306 role/language routes and 285 forms.
- Browser checks confirm direct entry for administration, management and owner, Enter-key entry for tenant, logout, retained language preference, and translated DE/EN/FR card content.
- Layout measurements at 320, 390, 768, 1024, 1366 and 1920 px show no horizontal page overflow or overflowing choice rows. French and English mobile text remains fully readable; short mobile viewports scroll vertically.
- Computed sidebar background is `rgb(80, 60, 46)` and its background image is `none`.
- No portal application errors observed. Browser-extension metadata errors are unrelated to the portal.
- Integration branch only: no main/alex-portal changes, merge or production deployment.

Evidence: [Desktop](evidence/entry-card/desktop.jpg), [Mobile EN](evidence/entry-card/mobile-en.jpg), [Sidebar](evidence/entry-card/sidebar.jpg), [Responsive measurements](evidence/entry-card/responsive.json), [Card positioning](evidence/entry-card/centering.json).
