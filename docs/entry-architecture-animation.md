# Architectural entry animation

The entry scene reveals the fine pencil marks of the existing illustration itself. Its raster source is unchanged. SVG paths are invisible reveal masks, not replacement building outlines. A colour matrix separates warm sepia ink from the paper; a very small blur softens the raster edges. This avoids the broad beige bands that would otherwise follow the masks. The full left-hand artwork panel uses warm beige #f2e7d8, with a faint, stationary paper tint beneath the drawing.

The street perspective, building edges, windows, balconies and vegetation appear in overlapping, softly eased passes. The remaining fine background details settle in between 6.76 and 8.84 seconds. A shared CSS pace factor stretches every delay and duration equally by 30%, preserving the approved drawing sequence. The same filtered artwork remains on screen throughout: there is no handoff to a different image, crossfade between illustrations, camera movement or continuous loop. After completion the animations are removed and the pause control disappears.

The animation refinement retained the right-hand form, logo, copy, original illustration bytes and responsive layout. The subsequent [entry card refinement](entry-card-refinement.md) changes only the workspace selection card and sidebar colour; the animation assets and source illustration remain unchanged. The compact 100 px mobile header is retained. There is no new image download, video, framework or JavaScript frame loop. The SVG reuses the image already embedded in the page.

The animation pauses when the tab or entry page is hidden or the artwork leaves the viewport. Its keyboard-accessible pause/resume control uses the existing DE/EN/FR catalogue. Reduced-motion preferences show the finished scene. Returning from the portal does not replay the reveal. Without JavaScript the original static illustration remains visible.

Validation:

- Build passes: 8200 messages; 170 script/assets checked. The four entry-animation lifecycle tests also pass after the beige/pacing refinement. Desktop computed styles confirm #f2e7d8 and a 6.76 s delay plus 2.08 s finish (8.84 s total).
- 16/16 entry-animation, profile and language integration tests pass, including matching source artwork, completion, decode timing, pause/resume, visibility, reduced motion, language changes and disposal.
- The original sequence was inspected locally at 0.9, 2.4, 4.2 and 7.2 seconds before the uniform pace adjustment. Fine original lines remain visible throughout; no coarse substitute contours or broad tinted mask bands.
- A real pause held the same computed stroke offset across observations. Resume, workspace entry and logout work. The completed scene reports no camera transform, a fully revealed mask and no running animation.
- Browser layout measurements at 320, 390, 768, 1024, 1366 and 1920 px show no horizontal page overflow. Mobile workspace choices and the open action remain readable.
- No application errors observed; browser-extension metadata errors are unrelated to the portal. No device-level frame-rate benchmark was performed.
- Changes stay on the integration development branch. No merge, production deployment, role/access or user-data changes.

Evidence: [Desktop](evidence/entry-animation/desktop.jpg), [Sketch phase](evidence/entry-animation/sketch-phase.jpg), [Mobile](evidence/entry-animation/mobile.jpg), [Responsive measurements](evidence/entry-animation/responsive.json).
