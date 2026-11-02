/* Existing portal feedback, shared by all short-lived system responses.
   This component never saves data. saved() requires a confirmed durable write. */
window.createPortalFeedback = function ({document, window, translate: t, busy}) {
  const root = document.getElementById('portalPreview');
  const mainDialog = document.getElementById('dialog');
  const toast = document.getElementById('toast');
  const stack = toast;
  stack.className = 'portal-feedback-stack';
  stack.replaceChildren();
  stack.removeAttribute('role');
  stack.removeAttribute('aria-atomic');
  const discardDialog = document.createElement('dialog');
  discardDialog.id = 'portalDiscardDialog';
  discardDialog.className = 'portal-discard-dialog';
  discardDialog.setAttribute('role', 'alertdialog');
  discardDialog.setAttribute('aria-labelledby', 'portalDiscardTitle');
  discardDialog.setAttribute('aria-describedby', 'portalDiscardCopy');
  root.append(discardDialog);
  const entries = [], recent = new Map();
  const priority = {error: 0, warning: 1, success: 2, info: 3};
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sequence = 0, action = null, pendingDiscard = null, savedTimer, savedPending = false;
  let savedTitle = 'Änderungen gespeichert', saveFailure = null, lastOutsideFocus = null;
  function node(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function symbol(kind) {
    const host = node('span', 'portal-feedback-symbol');
    host.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', {
      success: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      error: 'M9 9l6 6m0-6-6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      warning: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v.2',
      info: 'M12 11v6m0-10v.2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
      close: 'M6 6l12 12M18 6 6 18'
    }[kind] || '');
    svg.append(path); host.append(svg); return host;
  }
  function safe(value, fallback = 'Die Aktion konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (/https?:\/\/|Bearer\s|api[_ -]?key|access[_ -]?token|secret[=:]|sk-[a-zA-Z0-9]{8}|(?:Type|Reference|Syntax)?Error:|ECONN|ERR_|\bat\s+\w+.*:\d+|\{\s*"(?:error|stack)"/i.test(text) || text.length > 1600) return t(fallback);
    return text;
  }
  function pause(entry, reason) {
    if (!entry.pauses.has(reason) && entry.timer) entry.remaining = Math.max(0, entry.deadline - Date.now());
    entry.pauses.add(reason); window.clearTimeout(entry.timer); entry.timer = null;
  }
  function arm(entry) {
    window.clearTimeout(entry.timer); entry.timer = null;
    if (entry.state !== 'visible' || !entry.duration || entry.pauses.size) return;
    entry.deadline = Date.now() + entry.remaining;
    entry.timer = window.setTimeout(() => dismiss(entry), entry.remaining);
  }
  function resume(entry, reason) { entry.pauses.delete(reason); arm(entry); }
  function position() {
    const bottoms = [...root.querySelectorAll('.topbar,#globalSearch,#main .page-head .head-actions')].map(el=>el.getBoundingClientRect()).filter(rect=>rect.width&&rect.height).map(rect=>rect.bottom);
    const top = Math.max(window.visualViewport?.offsetTop || 0,...bottoms,70)+12;
    const value = top+'px';
    if (stack.style.getPropertyValue('--portal-notice-top') !== value) stack.style.setProperty('--portal-notice-top',value);
  }
  function syncHost() {
    const body = mainDialog.open && mainDialog.querySelector('.dialog-body');
    const parent = body || root;
    if (stack.parentElement !== parent) {
      if (body) body.prepend(stack); else root.append(stack);
    }
    stack.classList.toggle('is-dialog', !!body);
    position();
    stack.hidden = !entries.some(e => e.state === 'visible' || e.state === 'leaving');
    for (const entry of entries.filter(e => e.state === 'visible')) {
      if (document.hidden || discardDialog.open) pause(entry, 'visibility');
      else if (entry.pauses.has('visibility')) resume(entry, 'visibility');
    }
  }
  function contents(entry) {
    const host = entry.element;
    host.replaceChildren(); host.dataset.kind = entry.kind; host.dataset.noticeState = entry.state;
    host.setAttribute('role', entry.kind === 'error' ? 'alert' : 'status');
    host.setAttribute('aria-atomic', 'true');
    host.append(symbol(entry.kind));
    const copy = node('div', 'portal-feedback-copy');
    copy.append(node('strong', '', safe(t(entry.title))));
    if (entry.body) copy.append(node('p', '', safe(t(entry.body))));
    host.append(copy);
    if (entry.action) {
      const button = node('button', 'portal-feedback-action', t(entry.action.label));
      button.type = 'button';
      if (entry.undo) button.dataset.portalUndo = '';
      button.disabled = !!entry.running;
      button.addEventListener('click', async () => {
        if (entry.running || entry.state !== 'visible') return;
        const hadFocus = host.contains(document.activeElement);
        entry.running = true; button.disabled = true; pause(entry, 'running');
        try { await entry.action.run(entry); }
        catch { update(entry, {kind: 'error', title: 'Aktion fehlgeschlagen', body: 'Bitte versuchen Sie es erneut.', duration: 0}); }
        finally {
          entry.running = false;
          if (entry.state === 'visible') for (const control of entry.element.querySelectorAll('button')) control.disabled = false;
          if (entry.state === 'visible' && hadFocus && document.activeElement === document.body) entry.element.querySelector('.portal-feedback-action')?.focus({preventScroll:true});
          if (!entry.element.contains(document.activeElement)) entry.pauses.delete('focus');
          resume(entry, 'running');
        }
      });
      host.append(button);
    }
    const close = node('button', 'portal-feedback-close');
    close.type = 'button'; close.setAttribute('aria-label', t('Meldung schliessen'));
    close.dataset.noticeClose = ''; close.append(symbol('close'));
    close.disabled = !!entry.running;
    close.addEventListener('click', () => { if (!entry.running) dismiss(entry); });
    host.append(close);
  }
  function finish(entry, parked = false) {
    if (entry.state === 'closed' || !entries.includes(entry)) return;
    entry.element.remove();
    if (parked) { entry.state = 'queued'; entry.pauses.delete('parked'); }
    else { entry.state = 'closed'; entries.splice(entries.indexOf(entry), 1); recent.set(entry.key, Date.now()); if(recent.size>100)for(const [key,at]of recent)if(Date.now()-at>1200)recent.delete(key); }
    pump();
  }
  function dismiss(entry, parked = false) {
    if (!entry || entry.state === 'closed' || entry.state === 'leaving') return;
    if (entry.state === 'queued') { finish(entry); return; }
    pause(entry, 'parked'); entry.state = 'leaving';
    entry.element.dataset.noticeState = 'leaving'; entry.element.setAttribute('aria-hidden', 'true');
    entry.element.querySelector('[data-portal-undo]')?.removeAttribute('data-portal-undo');
    for (const button of entry.element.querySelectorAll('button')) button.disabled = true;
    if (entry.element.contains(document.activeElement) && lastOutsideFocus?.isConnected) lastOutsideFocus.focus({preventScroll: true});
    if (reduced.matches) finish(entry, parked);
    else window.setTimeout(() => finish(entry, parked), 200);
  }
  function pump() {
    let count = entries.filter(e => e.state === 'visible' || e.state === 'leaving').length;
    const waiting = entries.filter(e => e.state === 'queued').sort((a,b) => priority[a.kind] - priority[b.kind] || a.id - b.id);
    while (count < 3 && waiting.length) {
      const entry = waiting.shift(); entry.state = 'visible'; contents(entry);
      stack.append(entry.element); count++; arm(entry);
    }
    // Errors go first. Displaced passive notices keep their remaining time in the queue.
    const error = entries.find(e => e.state === 'queued' && e.kind === 'error');
    if (error && !entries.some(e => e.state === 'leaving')) {
      const passive = [...entries].reverse().find(e => e.state === 'visible' && ['success','info'].includes(e.kind) && !e.action && !e.element.contains(document.activeElement));
      if (passive) dismiss(passive, true);
    }
    const ordered = entries.filter(e => e.state === 'visible').sort((a,b) => priority[a.kind] - priority[b.kind] || a.id - b.id);
    ordered.forEach((entry,index) => { if (stack.children[index] !== entry.element) stack.insertBefore(entry.element, stack.children[index] || null); });
    syncHost();
  }
  function update(entry, changes) {
    Object.assign(entry, changes);
    if (entry.kind === 'error') entry.duration = 0;
    entry.remaining = entry.duration; entry.key = [entry.kind,entry.title,entry.body].join('|');
    if (entry.state === 'visible') contents(entry);
    pump(); arm(entry); return entry;
  }
  function notice(title, body = '', duration = 3000, kind = 'info', options = {}) {
    title = String(title); body = String(body);
    const key = options.key || [kind,title,body].join('|');
    const existing = entries.find(e => e.key === key && e.state !== 'closed' && e.state !== 'leaving');
    if (existing) { if (existing.duration) { existing.remaining = existing.duration; arm(existing); } return existing; }
    if (['success','info'].includes(kind) && !options.action && Date.now() - (recent.get(key) || 0) < 1200) return null;
    const entry = {id: ++sequence,key,title,body,kind,duration:kind === 'error' ? 0 : duration,remaining:duration,element:node('div','portal-feedback'),state:'queued',pauses:new Set(),...options};
    if (entry.undo) entry.element.classList.add('portal-undo');
    entry.element.addEventListener('pointerenter', () => pause(entry, 'hover'));
    entry.element.addEventListener('pointerleave', () => resume(entry, 'hover'));
    entry.element.addEventListener('focusin', () => pause(entry, 'focus'));
    entry.element.addEventListener('focusout', event => { if (!entry.element.contains(event.relatedTarget)) resume(entry, 'focus'); });
    entries.push(entry); pump(); return entry;
  }
  function showSaved(context = '') {
    savedPending = false;
    window.clearTimeout(savedTimer);
    notice(savedTitle, /Filter|filter/.test(context) ? safe(context) : 'Ihre Anpassungen wurden übernommen.', 3000, 'success');
  }
  function saved(title = 'Änderungen gespeichert') {
    savedTitle = title || 'Änderungen gespeichert';
    savedPending = true;
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => showSaved(), 0);
  }
  function clearFailure() {
    if (saveFailure) { dismiss(saveFailure.entry); saveFailure = null; }
  }
  function beginSave() {
    savedPending = false;
    window.clearTimeout(savedTimer);
    clearFailure();
  }
  function failed(detail = '') {
    savedPending = false;
    window.clearTimeout(savedTimer);
    const form = mainDialog.open && mainDialog.querySelector('form');
    const retry = form && !/anderer Tab|another tab|HTTPS|Browser|100 MB/i.test(detail) ? {label:'Erneut versuchen',run:()=>{if(form.isConnected&&!busy())form.requestSubmit();}} : null;
    const body = /anderer Tab|another tab/.test(detail) ? 'Ihre Eingaben bleiben erhalten. Laden Sie zuerst den aktuellen Datenstand.' : 'Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.';
    const entry = notice('Speichern fehlgeschlagen', body, 0, 'error', {key:'save-error',action:retry});
    if (entry) entry.element.dataset.portalSaveError = '';
    saveFailure = {entry,detail:String(detail)};
  }
  document.addEventListener('focusin', event => { if (!stack.contains(event.target)) lastOutsideFocus = event.target; }, true);
  document.addEventListener('visibilitychange', syncHost);
  window.addEventListener('resize',position);
  window.addEventListener('scroll',position,{passive:true});
  window.visualViewport?.addEventListener('resize',position);
  window.visualViewport?.addEventListener('scroll',position);
  if(window.ResizeObserver){const sizing=new window.ResizeObserver(position);for(const el of root.querySelectorAll('.topbar,#globalSearch'))sizing.observe(el);}
  const observer = new window.MutationObserver(syncHost);
  observer.observe(mainDialog,{attributes:true,attributeFilter:['open'],childList:true});
  // Remember the user's synchronous intent without changing the existing handlers.
  document.addEventListener('click', event => {
    if (discardDialog.contains(event.target)) return;
    const target = event.target.closest?.('button,a,summary');
    if (!target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const next = () => { if (target.isConnected) target.click(); };
    action = next;
    window.queueMicrotask(() => { if (action === next) action = null; });
  }, true);
  function keepEditing() {
    const pending = pendingDiscard;
    pendingDiscard = null;
    discardDialog.close();
    syncHost();
    if (pending?.focus?.isConnected) pending.focus.focus({preventScroll: true});
  }
  function confirmDiscard(resume) {
    if (discardDialog.open) return;
    pendingDiscard = {resume, focus: document.activeElement};
    discardDialog.replaceChildren();
    const title = node('h2', '', t('Änderungen verwerfen?'));
    title.id = 'portalDiscardTitle';
    title.prepend(symbol('warning'));
    const copy = node('p', '', t('Sie haben ungespeicherte Änderungen. Möchten Sie diese verwerfen?'));
    copy.id = 'portalDiscardCopy';
    const actions = node('div', 'dialog-actions');
    const keep = node('button', 'btn primary', t('Weiter bearbeiten'));
    const discard = node('button', 'btn', t('Verwerfen'));
    keep.type = discard.type = 'button';
    keep.dataset.discardKeep = ''; discard.dataset.discardConfirm = '';
    keep.addEventListener('click', keepEditing);
    discard.addEventListener('click', () => {
      if (busy() || discard.disabled) return;
      discard.disabled = true;
      const pending = pendingDiscard;
      pendingDiscard = null;
      discardDialog.close();
      pending?.resume();
      syncHost();
    });
    actions.append(keep, discard);
    discardDialog.append(title, copy, actions);
    discardDialog.showModal();
    syncHost();
    keep.focus();
  }
  discardDialog.addEventListener('cancel', event => { event.preventDefault(); keepEditing(); });
  function undo({title, restore}) {
    beginSave();
    const restoreAction = async entry => {
      try {
        const result = await restore();
        if (!result?.persisted || result.error) throw Error(result?.error || t('Bitte versuchen Sie es erneut.'));
        // A failed restore may have emitted a shared storage error; resolve it on retry.
        clearFailure(); dismiss(entry); notice('Termin wiederhergestellt', '', 3000, 'success');
      } catch {
        clearFailure();
        update(entry,{kind:'error',title:'Wiederherstellung fehlgeschlagen',body:'Der Termin konnte nicht wiederhergestellt werden. Bitte versuchen Sie es erneut.',duration:0,action:{label:'Erneut versuchen',run:restoreAction}});
      }
    };
    // Each deletion has its own snapshot and six visible seconds. Waiting time is free.
    return notice(title,'',6000,'success',{key:'undo-'+(++sequence),undo:true,action:{label:'Rückgängig',run:restoreAction}});
  }
  function notify(text) {
    const message = String(text ?? '');
    if (/Failed to fetch|NetworkError|network|Verbindung|offline|connection/i.test(message)) {
      notice('Verbindung unterbrochen','Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',0,'error');
    } else if (/fehlgeschlagen|konnte.*nicht|nicht gespeichert|could not|failed|unavailable|not saved|\bError\b|\bFehler\b|ECONN|ERR_|(?:Type|Syntax|Reference)Error/i.test(message)) {
      notice('Aktion fehlgeschlagen',safe(message),0,'error');
    } else if (savedPending) {
      showSaved(message);
    } else if (/Überschneidung|Konflikt|ungespeichert|conflict|overlap|unsaved/i.test(message)) {
      notice('Bitte prüfen',safe(message),0,'warning');
    } else notice(safe(message),'',4000,'info');
  }
  function decorateWarning(host) {
    if (!host || host.hidden || host.querySelector('.portal-feedback-symbol')) return;
    host.dataset.kind='warning'; host.classList.add('portal-inline-warning'); host.prepend(symbol('warning'));
  }
  function reset() {
    window.clearTimeout(savedTimer);savedPending=false;saveFailure=null;
    for(const entry of entries){window.clearTimeout(entry.timer);entry.state='closed';}
    entries.length=0;recent.clear();pendingDiscard=null;lastOutsideFocus=null;
    if(discardDialog.open)discardDialog.close();
    stack.replaceChildren();syncHost();
  }
  window.addEventListener('morada:languagechange',()=>{for(const entry of entries)if(entry.state==='visible')contents(entry);pump();});
  syncHost();
  return {
    saved, failed, clearFailure, beginSave, notice, undo, confirmDiscard, reset,
    decorateWarning,
    publicMessage:safe,
    handlesFailure(detail) { return saveFailure?.entry?.state !== 'closed' && saveFailure?.detail === String(detail); },
    get action() { return action; },
    notify
  };
};
