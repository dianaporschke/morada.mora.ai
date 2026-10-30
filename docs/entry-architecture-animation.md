# Architectural entry animation

The existing city illustration is retained byte for byte. A lightweight SVG contour layer follows its street perspective, building silhouettes, roofs, windows and balconies. Staggered line drawing starts at the foundations, progresses through the buildings and finishes with façade details. The original illustration fades in from 2.5 to 5.7 seconds; the contour layer fades out by 6.2 seconds.

After the reveal, only the illustration moves. A 32-second eased pan travels 1.4% horizontally and 0.55% vertically, then reverses smoothly. At a 1366 px desktop viewport this is approximately 12 px horizontally and 3 px vertically. There is no zoom. Logo, copy and workspace form remain stationary. The right-hand form markup and illustration image bytes are unchanged.

The original responsive layout is retained, including its compact 100 px mobile header. No additional images, video, framework, network service or JavaScript frame loop is introduced. The two new animation assets total about 13 KB before compression. After the reveal the SVG layer is hidden; continued movement uses a CSS transform.

Motion stops when the tab or entry page is hidden or the artwork leaves the viewport. A small keyboard-accessible pause/resume control is provided in the artwork, with labels in the existing DE/EN/FR catalogue. Reduced-motion preferences display the finished illustration immediately with no movement. Returning from the portal does not replay the reveal. Without the script the original static illustration remains visible.

Validation:

- Build passes: 8200 messages; 170 script/assets checked.
- 15/15 entry-animation, profile and language integration tests pass. These cover decode timing, pause/resume, visibility, reduced motion, language changes, disposal, portal entry/exit and existing profile/i18n behaviour.
- Browser inspected at 0.9/2.4/4.2/6.4-second stages and during the continuing pan. Pause produces a stable computed transform; resume and portal entry/exit work.
- Desktop/mobile checks at 320, 390, 768, 1024, 1366 and 1920 px. No horizontal page overflow introduced; role selection remains usable. Existing vertical scrolling on shorter devices is retained.
- No application errors observed during local browser checks. Browser-extension logging is unrelated to the portal.
- No production deployment, merge, role/access or user-data changes.

Evidence: [Desktop](evidence/entry-animation/desktop.jpg), [Sketch phase](evidence/entry-animation/sketch-phase.jpg), [Mobile](evidence/entry-animation/mobile.jpg), [Responsive measurements](evidence/entry-animation/responsive.json).
