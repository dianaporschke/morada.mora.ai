/* Small presentation helpers. Call saved() only after a durable write succeeds. */
window.createPortalFeedback = function ({document, window, translate: t, busy}) {
  const root = document.getElementById('portalPreview');
  const mainDialog = document.getElementById('dialog');
  const toast = document.getElementById('toast');
  const stack = document.createElement('div');
  stack.className = 'portal-feedback-stack';
  toast.before(stack);
  const undoList = document.createElement('div');
  undoList.className = 'portal-undo-list';
  stack.append(toast, undoList);
  toast.classList.add('portal-feedback');
  toast.setAttribute('aria-atomic', 'true');
  const discardDialog = document.createElement('dialog');
  discardDialog.id = 'portalDiscardDialog';
  discardDialog.className = 'portal-discard-dialog';
  discardDialog.setAttribute('role', 'alertdialog');
  discardDialog.setAttribute('aria-labelledby', 'portalDiscardTitle');
  discardDialog.setAttribute('aria-describedby', 'portalDiscardCopy');
  root.append(discardDialog);
  let action = null, pendingDiscard = null, noticeTimer, savedTimer, savedPending = false;
  function node(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  }
  function contents(host, title, body = '', kind = 'info') {
    host.replaceChildren();
    host.dataset.kind = kind;
    host.append(node('span', 'portal-feedback-symbol', kind === 'success' ? '✓' : kind === 'error' ? '!' : '•'));
    host.firstChild.setAttribute('aria-hidden', 'true');
    const copy = node('div', 'portal-feedback-copy');
    copy.append(node('strong', '', t(title)));
    if (body) copy.append(node('p', '', t(body)));
    host.append(copy);
    return copy;
  }
  function notice(title, body = '', duration = 3000, kind = 'info') {
    window.clearTimeout(noticeTimer);
    contents(toast, title, body, kind);
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toast.hidden = false;
    noticeTimer = window.setTimeout(() => { toast.hidden = true; }, duration);
  }
  function showSaved(context = '') {
    savedPending = false;
    window.clearTimeout(savedTimer);
    notice('Änderungen gespeichert', 'Ihre Anpassungen wurden übernommen.', 3000, 'success');
    // Retain useful existing context when the saved event is hidden by filters.
    if (/Filter|filter/.test(context)) toast.querySelector('.portal-feedback-copy').append(node('p', '', context));
  }
  function saved() {
    savedPending = true;
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => showSaved(), 0);
  }
  function clearFailure() {
    mainDialog.querySelector('[data-portal-save-error]')?.remove();
  }
  function beginSave() {
    savedPending = false;
    window.clearTimeout(savedTimer);
    if (toast.dataset.kind === 'success') toast.hidden = true;
    clearFailure();
  }
  function failed(detail = '') {
    savedPending = false;
    window.clearTimeout(savedTimer);
    toast.hidden = true;
    clearFailure();
    const title = 'Speichern fehlgeschlagen';
    const body = 'Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.';
    if (mainDialog.open) {
      const banner = node('div', 'portal-feedback portal-save-error');
      banner.dataset.portalSaveError = '';
      banner.setAttribute('role', 'alert');
      contents(banner, title, body, 'error');
      const host = mainDialog.querySelector('.ux-form-scroll,form,.dialog-body') || mainDialog;
      host.prepend(banner);
    } else notice(title, detail ? t(body) + ' ' + t(detail) : body, 6000, 'error');
  }
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
    if (pending?.focus?.isConnected) pending.focus.focus({preventScroll: true});
  }
  function confirmDiscard(resume) {
    if (discardDialog.open) return;
    pendingDiscard = {resume, focus: document.activeElement};
    discardDialog.replaceChildren();
    const title = node('h2', '', t('Änderungen verwerfen?'));
    title.id = 'portalDiscardTitle';
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
    });
    actions.append(keep, discard);
    discardDialog.append(title, copy, actions);
    discardDialog.showModal();
    keep.focus();
  }
  discardDialog.addEventListener('cancel', event => { event.preventDefault(); keepEditing(); });
  function undo({title, restore}) {
    beginSave();
    const host = node('div', 'portal-feedback portal-undo');
    host.setAttribute('role', 'status'); host.setAttribute('aria-atomic', 'true');
    const copy = contents(host, title);
    const button = node('button', 'portal-undo-action', t('Rückgängig'));
    button.type = 'button'; button.dataset.portalUndo = '';
    host.append(button); undoList.append(host);
    let timer, deadline, running = false;
    const remove = () => { window.clearTimeout(timer); host.remove(); };
    const expire = () => { deadline = Date.now() + 6000; timer = window.setTimeout(remove, 6000); };
    button.addEventListener('click', async () => {
      if (running || Date.now() > deadline) return;
      running = true; button.disabled = true; window.clearTimeout(timer);
      try {
        const result = await restore();
        if (!result?.persisted || result.error) throw Error(result?.error || t('Bitte versuchen Sie es erneut.'));
        remove(); notice('Termin wiederhergestellt', '', 3000, 'success');
      } catch (error) {
        host.dataset.kind = 'error';
        copy.replaceChildren(node('strong', '', t('Wiederherstellung fehlgeschlagen')), node('p', '', error.message));
        running = false; button.disabled = false; expire();
      }
    });
    expire();
  }
  return {
    saved, failed, clearFailure, beginSave, notice, undo, confirmDiscard,
    get action() { return action; },
    notify(text) { if (savedPending) showSaved(t(text)); else notice(text, '', 4500); }
  };
};
