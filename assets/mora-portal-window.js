/** Presentation only: no chat state, persistence, portal actions or requests. */
export function enablePortalWindow(panel, window, onResize = () => {}) {
  const t = source => window.MoradaI18n?.t(source) ?? source;
  const header = panel.querySelector('header');
  const properties = ['left', 'top', 'width', 'height'];
  const directions = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
  let geometry = null, gesture = null;
  const desktop = () => window.innerWidth > 640;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const bounds = () => {
    const viewport = window.visualViewport, margin = 12;
    const left = (viewport?.offsetLeft || 0) + margin, top = (viewport?.offsetTop || 0) + margin;
    const width = Math.max(1, (viewport?.width || panel.ownerDocument.documentElement.clientWidth || window.innerWidth) - margin * 2);
    const height = Math.max(1, (viewport?.height || window.innerHeight) - margin * 2);
    return {left, top, right: left + width, bottom: top + height, width, height, minWidth: Math.min(360, width), minHeight: Math.min(360, height)};
  };
  function constrain(rect) {
    const b = bounds(), width = clamp(rect.width, b.minWidth, b.width), height = clamp(rect.height, b.minHeight, b.height);
    return {left: clamp(rect.left, b.left, b.right - width), top: clamp(rect.top, b.top, b.bottom - height), width, height};
  }
  function apply(rect) {
    geometry = constrain(rect);
    for (const key of properties) panel.style.setProperty('--mp-window-' + key, geometry[key] + 'px');
    onResize();
  }
  function clearGeometry() {
    geometry = null;
    for (const key of properties) panel.style.removeProperty('--mp-window-' + key);
    onResize();
  }
  function finish(cancel = false) {
    if (!gesture) return;
    const previous = gesture;
    gesture = null;
    panel.classList.remove('mora-portal-moving', 'mora-portal-resizing');
    if (cancel) previous.original ? apply(previous.original) : clearGeometry();
    if (previous.capture.hasPointerCapture?.(previous.pointerId)) previous.capture.releasePointerCapture(previous.pointerId);
  }
  function reset() { finish(); clearGeometry(); }
  function start(event, direction) {
    if (!desktop() || panel.hidden || gesture || event.button !== 0 || event.isPrimary === false) return;
    if (!direction && event.target.closest('button,a,input,textarea,select')) return;
    event.preventDefault();
    gesture = {direction, pointerId: event.pointerId, capture: event.currentTarget, x: event.clientX, y: event.clientY,
      rect: constrain(panel.getBoundingClientRect()), original: geometry && {...geometry}};
    panel.classList.add(direction ? 'mora-portal-resizing' : 'mora-portal-moving');
    gesture.capture.setPointerCapture?.(event.pointerId);
  }
  function resize(rect, direction, dx, dy) {
    const b = bounds();
    let {left, top} = rect, right = left + rect.width, bottom = top + rect.height;
    if (direction.includes('e')) right = clamp(right + dx, left + b.minWidth, b.right);
    if (direction.includes('w')) left = clamp(left + dx, b.left, right - b.minWidth);
    if (direction.includes('s')) bottom = clamp(bottom + dy, top + b.minHeight, b.bottom);
    if (direction.includes('n')) top = clamp(top + dy, b.top, bottom - b.minHeight);
    return {left, top, width: right - left, height: bottom - top};
  }
  header.tabIndex = 0;
  header.setAttribute('aria-label', 'MORA-Fenster verschieben. Pfeiltasten zum Verschieben, Pos1 für die Ausgangsgrösse.');
  header.title = 'Zum Verschieben ziehen · Doppelklick für die Ausgangsgrösse';
  header.addEventListener('pointerdown', event => start(event, ''));
  header.addEventListener('dblclick', event => {
    if (desktop() && !event.target.closest('button,a,input,textarea,select')) reset();
  });
  const handles = directions.map(direction => {
    const handle = panel.ownerDocument.createElement(direction === 'se' ? 'button' : 'div');
    handle.className = 'mora-portal-resize';
    handle.dataset.resize = direction;
    if (direction === 'se') {
      handle.type = 'button';
      handle.setAttribute('aria-label', 'MORA-Fenstergrösse ändern');
      handle.title = 'Grösse ziehen · Pfeiltasten für Breite und Höhe · Pos1 zum Zurücksetzen';
    } else handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', event => start(event, direction));
    panel.append(handle);
    return handle;
  });
  function keyboard(event, resizing) {
    if (!desktop() || event.target !== event.currentTarget) return;
    if (event.key === 'Home') { event.preventDefault(); reset(); return; }
    const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10, [dx, dy] = delta.map(value => value * step);
    const rect = constrain(panel.getBoundingClientRect());
    apply(resizing ? resize(rect, 'se', dx, dy) : {...rect, left: rect.left + dx, top: rect.top + dy});
  }
  header.addEventListener('keydown', event => keyboard(event, false));
  handles.find(handle => handle.dataset.resize === 'se').addEventListener('keydown', event => keyboard(event, true));
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (panel.hidden || !desktop()) { finish(); return; }
    const {rect, direction} = gesture, dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    apply(direction ? resize(rect, direction, dx, dy) : {...rect, left: rect.left + dx, top: rect.top + dy});
  });
  window.addEventListener('pointerup', event => { if (gesture?.pointerId === event.pointerId) finish(); });
  window.addEventListener('pointercancel', event => { if (gesture?.pointerId === event.pointerId) finish(true); });
  panel.addEventListener('lostpointercapture', () => finish());
  window.addEventListener('blur', () => finish());
  panel.addEventListener('keydown', event => {
    if (gesture && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(true); }
  }, true);
  function fit() {
    finish();
    header.tabIndex = desktop() ? 0 : -1;
    header.title = desktop() ? t('Zum Verschieben ziehen · Doppelklick für die Ausgangsgrösse') : '';
    header.setAttribute('aria-label', desktop() ? t('MORA-Fenster verschieben. Pfeiltasten zum Verschieben, Pos1 für die Ausgangsgrösse.') : 'MORA');
    const resizeHandle = handles.find(handle => handle.dataset.resize === 'se');
    resizeHandle.setAttribute('aria-label', t('MORA-Fenstergrösse ändern'));
    resizeHandle.title = t('Grösse ziehen · Pfeiltasten für Breite und Höhe · Pos1 zum Zurücksetzen');
    if (desktop() && geometry) apply(geometry);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('morada:languagechange', fit);
  window.visualViewport?.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('scroll', fit);
  new window.MutationObserver(() => { if (panel.hidden) finish(); }).observe(panel, {attributes: true, attributeFilter: ['hidden']});
  fit();
  return {fit};
}
