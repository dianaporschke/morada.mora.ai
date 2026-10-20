const TYPES = new Set(['select', 'handover', 'attachment', 'add_details', 'navigate', 'continue', 'call', 'reset', 'retry', 'switch_issue']);
const TABS = new Set(['docs', 'service', 'profile', 'portfolio']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const STORAGE_KEY = 'morada.mora.v2.thread';
import { categoryLabels as LABELS, equipmentLabels as EQUIPMENT, equipmentCategories, mapServiceDraft, draftSummary, draftLabel, preparationState } from './mora-data.js';
const DRAFT_FIELDS = [['moraDraftDescription','description'], ['moraDraftEquipment','equipment'], ['moraDraftDefect','defect'], ['moraDraftCount','count'], ['moraDraftExtent','extent'], ['moraDraftLocation','location'], ['moraDraftSince','since'], ['moraDraftDetails','details']];
const FIELD_LABELS = { description:'Beschreibung', equipment:'Einrichtung', defect:'Defekt', count:'Anzahl', extent:'Umfang', location:'Bereich', since:'Beginn', details:'Zusatzangaben' };

export function renderActions(document, actions, onAction) {
  const group = document.createElement('div'); group.className = 'mora-actions';
  for (const action of (Array.isArray(actions) ? actions : []).slice(0, 4)) {
    if (!action || !TYPES.has(action.type) || typeof action.label !== 'string') continue;
    const button = document.createElement('button'); button.type = 'button';
    button.className = `mora-action${action.variant === 'primary' ? ' primary' : ''}`;
    button.textContent = action.label; button.dataset.actionId = action.id; button.dataset.actionType = action.type;
    button.addEventListener('click', () => onAction(action)); group.appendChild(button);
  }
  return group;
}

function database(window) {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('Storage unavailable'));
    const request = window.indexedDB.open('morada-mora-v2', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files', { keyPath:'id' });
      request.result.createObjectStore('drafts', { keyPath:'id' });
    };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function dbOperation(window, store, mode, operation) {
  const db = await database(window);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode); const request = operation(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export function createMora(document, window, fetcher = window.fetch.bind(window)) {
  const form = document.getElementById('moraForm'); const text = document.getElementById('moraText');
  const messages = document.getElementById('moraMessages'); const send = document.getElementById('moraSend');
  const fileInput = document.getElementById('moraFileInput'); const attachments = document.getElementById('moraAttachments');
  const draftSection = document.getElementById('moraDrafts'); const draftPicker = document.getElementById('moraDraftPicker');
  const issueControls = document.getElementById('moraIssueControls'); const issuePicker = document.getElementById('moraIssuePicker');
  let state = { session:null, issue:null, issues:[], capabilities:{ submitRequest:false }, thread:[], files:[] };
  let busy = false; let preparationPhase='not_prepared'; let latestActions; let retryPayload; let activeDraft; let drafts = [];
  const blobs = new Map(); const urls = new Map();
  const id = () => window.crypto.randomUUID();
  const scroll = () => { messages.scrollTop = messages.scrollHeight; };
  const persist = () => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { document.getElementById('moraStorageNote').textContent = 'Der Browser kann den Chat gerade nicht speichern. Bitte laden Sie Ihren Anliegenentwurf herunter.'; }
  };
  const addBubble = (content, who = 'assistant', actions = [], remember = true) => {
    if (who === 'assistant') { disableActions(); latestActions = null; }
    const bubble = document.createElement('div'); bubble.className = `bubble${who === 'user' ? ' user' : ''}`;
    bubble.textContent = content; messages.appendChild(bubble);
    actions=actions.map(item=>item.type==='handover' && drafts.some(draft=>draft.id===state.issue?.id) ? {...item,label:'Entwurf aktualisieren'} : item);
    actions=actions.filter(item=>item.type!=='handover' || preparationState(state.issue,drafts.find(draft=>draft.id===state.issue?.id))!=='portal_received');
    if (Array.isArray(actions) && actions.length) { latestActions = renderActions(document, actions, onAction); messages.appendChild(latestActions); }
    if (remember) { state.thread.push({ content, who, actions }); persist(); }
    if (who === 'assistant') renderIssueControls();
    scroll(); return bubble;
  };
  const disableActions = () => { messages.querySelectorAll('.mora-action').forEach(button => { button.disabled = true; }); };
  const lock = value => {
    busy = value; send.disabled = value;
    if (latestActions) latestActions.querySelectorAll('button').forEach(button => { button.disabled = value; });
    issueControls.querySelectorAll('button,select').forEach(control => { control.disabled = value; });
    document.getElementById('moraNewChat').disabled = value;
  };

  function renderIssueControls() {
    issuePicker.replaceChildren();
    const retained = state.issues || [];
    document.getElementById('moraIssuePickerLabel').hidden = retained.length < 2;
    for (const issue of retained) {
      const option = document.createElement('option'); option.value = issue.id;
      option.textContent = [EQUIPMENT[issue.equipment] || LABELS[issue.category] || 'Anliegen', issue.location].filter(Boolean).join(' · ');
      option.selected = issue.id === state.issue?.id; issuePicker.appendChild(option);
    }
    const attach = document.getElementById('moraAttachPhoto'); const prepare = document.getElementById('moraPrepareIssue');
    attach.disabled = busy; prepare.disabled = busy;
    attach.hidden = state.issue?.urgency === 'emergency' || Boolean(latestActions?.querySelector('[data-action-type="attachment"]'));
    const phase=preparationState(state.issue,drafts.find(draft=>draft.id===state.issue?.id));
    prepare.textContent=drafts.some(draft=>draft.id===state.issue?.id) ? 'Entwurf aktualisieren' : 'Für MORADA vorbereiten';
    prepare.hidden = phase==='portal_received' || phase==='sent' || Boolean(latestActions?.querySelector('[data-action-type="handover"]'));
    const tools = issueControls.querySelector('.mora-issue-tools'); tools.hidden = attach.hidden && prepare.hidden;
    issueControls.hidden = !state.issue || (retained.length < 2 && tools.hidden);
  }

  function syncPhotos() {
    if (!state.issue) return;
    state.issue.attachments = structuredClone(state.files);
    state.issues = state.issues.map(issue => issue.id === state.issue.id ? state.issue : issue);
  }

  async function submit(payload, displayText = undefined, retry = false) {
    if (busy) return;
    disableActions(); lock(true);
    if (displayText && !retry) addBubble(displayText, 'user');
    if (!retry && payload.message) text.value = '';
    const loading = addBubble('MORA antwortet …', 'assistant', [], false); loading.classList.add('loading');
    const startedAt=window.performance.now();
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 65000);
    const previousIssue = state.issue;
    try {
      const local=drafts.find(draft=>draft.id===state.issue?.id);
      if (local && preparationState(state.issue,local)==='portal_received' && state.issue.preparation?.revision!==state.issue.revision) {try {await acknowledgeDraft(state.issue,'portal_received');} catch {}}
      const response = await fetcher('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ ...(!payload.draftReceipt && state.issue ? { attachments:state.files } : {}), ...payload, ...(state.session ? { session:state.session } : {}) }), signal:controller.signal });
      const data = await response.json(); loading.remove();
      if (!response.ok) throw Object.assign(new Error(data.error || 'Die Antwort konnte nicht geladen werden.'), { code:data.code, retryable:data.retryable });
      if (typeof data.reply !== 'string' || typeof data.session !== 'string') throw new Error('Die Antwort konnte nicht geladen werden.');
      if (previousIssue && drafts.some(draft=>draft.id===previousIssue.id) && data.issue?.id !== previousIssue.id) {try {await saveDraft(previousIssue,false);} catch {preparationPhase='error';}}
      state.session = data.session; state.issue = data.issue || null; state.capabilities = data.capabilities;
      state.issues = Array.isArray(data.issues) ? data.issues : (data.issue ? [data.issue] : []);
      state.files = structuredClone(data.issue?.attachments || []);
      retryPayload = null; delete state.pendingTurn; addBubble(data.reply, 'assistant', data.actions || []); renderIssueControls(); await renderPhotos(); persist();
      // Measure the actual browser roundtrip, separately from server/model time.
      // No text, signed sessions, photos or personal data are logged.
      window.console.info('MORA response timing',{roundtripMs:Math.round(window.performance.now()-startedAt),
        serverMs:data.timingMs?.total ?? null,modelMs:data.timingMs?.model ?? null,modelCalls:data.modelCalls ?? null});
    } catch (error) {
      loading.remove(); retryPayload = { payload, displayText }; state.pendingTurn=retryPayload;
      const actions = error.retryable === false || error.code === 'INVALID_SESSION' || error.code === 'INVALID_ACTION' ? [] : [{ id:'retry', label:'Erneut versuchen', type:'retry', variant:'primary' }];
      if (state.issue) actions.push({ id:'prepare-request', label:'Anliegenentwurf öffnen', type:'handover', variant:'secondary' });
      actions.push({ id:'new-request', label:'Neuen Chat starten', type:'reset', variant:'secondary' });
      addBubble(error.code ? error.message : 'MORA ist gerade nicht erreichbar. Ihre Angaben bleiben im Chat erhalten. Sie können es erneut versuchen oder den bisherigen Anliegenentwurf öffnen.', 'assistant', actions);
      persist();
    } finally { window.clearTimeout(timer); renderIssueControls(); lock(false); scroll(); }
  }

  function navigate(target) {
    if (!TABS.has(target)) return;
    document.getElementById(target).checked = true; document.getElementById('mora').checked = false;
    window.scrollTo({ top:0, behavior:'auto' });
  }
  async function onAction(action) {
    if (busy || !action || !TYPES.has(action.type)) return;
    if (action.type === 'navigate') return navigate(action.target);
    if (action.type === 'call') { if (action.number === '112') window.location.href = 'tel:112'; return; }
    if (action.type === 'attachment') return fileInput.click();
    if (action.type === 'handover') return handover();
    if (action.type === 'retry') { const pending=retryPayload || state.pendingTurn; if (pending) return submit(pending.payload, pending.displayText, true); return; }
    if (action.type === 'reset') return resetChat();
    if (typeof action.id !== 'string' || action.id.length > 100) return;
    return submit({ actionId:action.id }, action.type === 'select' ? action.label : undefined);
  }

  async function resetChat() {
    if (busy) return;
    lock(true);
    for (const issue of state.issues.filter(issue=>drafts.some(draft=>draft.id===issue.id))) {try {await saveDraft(issue,false);} catch {preparationPhase='error';}}
    state.session = null; state.issue = null; state.issues = []; state.files = []; persist(); renderIssueControls(); await renderPhotos();
    lock(false);
    return submit({ actionId:'new-request' });
  }

  async function renderPhotos() {
    attachments.replaceChildren(); attachments.hidden = !state.files.length;
    for (const meta of state.files) {
      let file = blobs.get(meta.id);
      if (!file) { try { file = (await dbOperation(window, 'files', 'readonly', store => store.get(meta.id)))?.file; if (file) blobs.set(meta.id, file); } catch {} }
      const row = document.createElement('div'); row.className = 'mora-photo';
      if (file && window.URL.createObjectURL && !/heic|heif/.test(meta.type)) {
        if (!urls.has(meta.id)) urls.set(meta.id, window.URL.createObjectURL(file));
        const img = document.createElement('img'); img.src = urls.get(meta.id); img.alt = 'Angehängtes Foto'; row.appendChild(img);
      }
      const label = document.createElement('span'); label.textContent = `${meta.name} · ${file ? 'lokal hinzugefügt' : 'Datei bitte erneut auswählen'}`; row.appendChild(label);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Entfernen';
      remove.setAttribute('aria-label', `${meta.name} entfernen`);
      remove.addEventListener('click', async () => {
        if (busy) return; state.files = state.files.filter(item => item.id !== meta.id); syncPhotos(); persist();
        await renderPhotos(); await submit({ attachments:state.files });
      }); row.appendChild(remove); attachments.appendChild(row);
    }
  }

  async function addFiles(files) {
    if (busy || !state.issue) return;
    lock(true);
    let warning = ''; let added = 0;
    for (const file of files) {
      if (state.files.length >= 6) { warning = 'Pro Anliegen sind bis zu 6 Fotos möglich.'; break; }
      if (!IMAGE_TYPES.has(file.type) || file.size > 10 * 1024 * 1024 || !file.size) { warning = 'Bitte wählen Sie JPG-, PNG-, WebP- oder HEIC-Fotos bis 10 MB.'; continue; }
      const meta = { id:id(), name:file.name.slice(0,180), type:file.type, size:file.size };
      blobs.set(meta.id, file); state.files.push(meta); added++;
      try { await dbOperation(window, 'files', 'readwrite', store => store.put({ ...meta, file })); }
      catch { warning = 'Die Fotos sind in diesem Chat verfügbar. Der Browser konnte sie nicht dauerhaft lokal speichern.'; }
    }
    fileInput.value = ''; syncPhotos(); persist(); await renderPhotos();
    lock(false);
    if (added) await submit({ attachments:state.files });
    if (warning) addBubble(warning);
  }

  async function saveDraft(issue, show = true) {
    const existing = drafts.find(item => item.id === issue.id);
    const draft=mapServiceDraft(issue,existing,{session:state.session});
    // Persist first: a failed transaction must not look like a successful handover.
    await dbOperation(window, 'drafts', 'readwrite', store => store.put(draft));
    drafts = drafts.filter(item => item.id !== draft.id); drafts.unshift(draft);
    if (show || activeDraft?.id === draft.id) { activeDraft = draft; renderDraft(); }
    return draft;
  }
  function renderDraft() {
    if (!activeDraft) { draftSection.hidden = true; return; }
    draftSection.hidden = false; draftPicker.replaceChildren();
    for (const draft of drafts) {
      const option = document.createElement('option'); option.value = draft.id;
      option.textContent = `${draftLabel(draft)}${draft.location ? ` · ${draft.location}` : ''} · ${draft.delivery === 'sent' && draft.requestId ? 'Übermittelt' : 'Entwurf'}`;
      option.selected = draft.id === activeDraft.id; draftPicker.appendChild(option);
    }
    const equipmentSelect=document.getElementById('moraDraftEquipment');
    equipmentSelect.querySelectorAll('[data-mora-custom]').forEach(option=>option.remove());
    if (activeDraft.equipment && ![...equipmentSelect.options].some(option=>option.value===activeDraft.equipment)) {
      const option=document.createElement('option');option.value=activeDraft.equipment;option.textContent=activeDraft.equipment;
      option.dataset.moraCustom='true';equipmentSelect.appendChild(option);
    }
    for (const [id, field] of DRAFT_FIELDS) document.getElementById(id).value = activeDraft[field] ?? '';
    activeDraft.summary = draftSummary(activeDraft); document.getElementById('moraDraftSummary').textContent = activeDraft.summary;
    const sent = activeDraft.delivery === 'sent' && activeDraft.requestId;
    document.getElementById('moraDraftHeading').textContent = sent ? 'An MORADA übermittelt.' : 'Für MORADA vorbereitet.';
    document.getElementById('moraDraftNotice').textContent = sent
      ? 'Die Übermittlung des Anliegens wurde bestätigt. Fotos bleiben lokal gespeichert, solange deren Upload nicht bestätigt ist.'
      : 'Noch nicht übermittelt. Ihre Angaben und Fotos bleiben lokal auf diesem Gerät. Die direkte Übermittlung an MORADA ist noch nicht angeschlossen.';
    document.getElementById('moraDraftStatus').textContent = sent
      ? `Übermittlung bestätigt. Vorgang: ${activeDraft.requestId}${activeDraft.unsentChanges ? '. Ihre nachträglichen lokalen Änderungen wurden noch nicht übermittelt.' : ''}`
      : 'Noch nicht übermittelt. Die direkte Übermittlung ist noch nicht angeschlossen. Der Entwurf bleibt auf diesem Gerät.';
    const conflict = document.getElementById('moraDraftConflict');
    conflict.hidden = !activeDraft.conflictFields?.length;
    conflict.textContent = conflict.hidden ? '' : `Der Chat enthält inzwischen andere Angaben zu: ${activeDraft.conflictFields.map(field => FIELD_LABELS[field] || field).join(', ')}. Ihre Änderungen im Entwurf wurden beibehalten. Bitte prüfen Sie diese Felder vor der Weitergabe.`;
    const photos = document.getElementById('moraDraftPhotos'); photos.replaceChildren();
    for (const meta of activeDraft.attachments || []) { const label = document.createElement('span'); label.textContent = meta.name; label.className = 'muted'; photos.appendChild(label); }
  }
  function updateDraft() {
    if (!activeDraft) return;
    activeDraft.localEdits ||= {};
    for (const [id, field] of DRAFT_FIELDS) {
      const control = document.getElementById(id); const input = control.value.trim();
      const value = field === 'count' ? (input && control.checkValidity() ? Number(input) : null) : input || null;
      // Discard a generated count-only scope when the number is edited; detailed scope remains editable.
      if (field === 'count' && activeDraft.count !== value && /^\d+ (?:Steckdosen?|Heizkörper|Leuchten?|Lampen?|Schalter|betroffene Einrichtung\(en\))$/i.test(activeDraft.extent || '') && !activeDraft.localEdits.extent) {
        activeDraft.extent = null; activeDraft.localEdits.extent = true; document.getElementById('moraDraftExtent').value = '';
      }
      if ((activeDraft[field] ?? null) !== value) {
        activeDraft[field] = value; activeDraft.localEdits[field] = true;
        if (activeDraft.delivery === 'sent') activeDraft.unsentChanges = true;
      }
    }
    activeDraft.category=equipmentCategories[activeDraft.equipment] || activeDraft.category;
    activeDraft.updatedAt = new Date().toISOString(); activeDraft.locallyEdited = Object.keys(activeDraft.localEdits).length > 0;
    activeDraft.summary = draftSummary(activeDraft); document.getElementById('moraDraftSummary').textContent = activeDraft.summary;
    return activeDraft;
  }
  async function acknowledgeDraft(issue, status) {
    const response=await fetcher('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({session:state.session,draftReceipt:{issueId:issue.id,revision:issue.revision || 1,status}}),signal:AbortSignal.timeout(25000)});
    const data=await response.json();
    if (!response.ok || typeof data.session!=='string') throw new Error('Receipt not acknowledged');
    state.session=data.session;state.issue=data.issue;state.issues=data.issues;persist();
  }
  async function handover() {
    if (!state.issue || busy) return;
    const current=drafts.find(draft=>draft.id===state.issue.id);
    if (['portal_received','sent'].includes(preparationState(state.issue,current))) {navigate('service');return;}
    lock(true);preparationPhase='preparing';disableActions();
    try {
      const draft=await saveDraft({...state.issue,attachments:state.files});
      preparationPhase=current ? 'updated':'created';
      // Existing local Service view is the receiving boundary. No submit operation.
      navigate('service');preparationPhase='portal_received';
      try { await acknowledgeDraft(state.issue,'portal_received'); }
      catch { draft.receiptPending=true; }
      addBubble(current ? 'Der bestehende Entwurf wurde im Servicebereich aktualisiert. Er wurde noch nicht versendet.' : 'Ihr Anliegen ist im Servicebereich auf diesem Gerät vorbereitet. Es wurde noch nicht an MORADA gesendet.');
      persist();
    } catch {
      preparationPhase='error';
      addBubble('Der Entwurf konnte nicht im Servicebereich gespeichert werden. Ihre Angaben bleiben im Chat erhalten. Bitte versuchen Sie es erneut.', 'assistant', [{id:'prepare-request',type:'handover',label:'Erneut vorbereiten',variant:'primary'}]);
    } finally {lock(false);renderIssueControls();}
  }
  async function downloadDraft() {
    if (!activeDraft) return;
    updateDraft();
    try { await dbOperation(window, 'drafts', 'readwrite', store => store.put(activeDraft)); } catch {}
    const { session, chatSnapshot, localEdits, conflictFields, ...exported } = activeDraft;
    const payload = { ...exported, notice:activeDraft.delivery === 'sent' && activeDraft.requestId
      ? `Übermittlung bestätigt. Vorgang: ${activeDraft.requestId}.${activeDraft.unsentChanges ? ' Nachträgliche lokale Änderungen sind noch nicht übermittelt.' : ''} Fotos lokal gespeichert.`
      : 'Anliegenentwurf; noch nicht an MORADA übermittelt.', photos:[] };
    for (const meta of activeDraft.attachments) {
      let file = blobs.get(meta.id);
      if (!file) { try { file = (await dbOperation(window, 'files', 'readonly', store => store.get(meta.id)))?.file; } catch {} }
      if (file) {
        const dataUrl = await new Promise((resolve, reject) => { const reader = new window.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        payload.photos.push({ ...meta, dataUrl });
      } else payload.photos.push({ ...meta, missingFile:true });
    }
    const blob = new window.Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = window.URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `MORADA-Anliegen-${activeDraft.id.slice(0,8)}.json`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  }

  form.addEventListener('submit', event => { event.preventDefault(); const message = text.value.trim(); if (message && !busy) submit({ message, ...(state.issue ? { attachments:state.files } : {}) }, message); });
  document.querySelectorAll('[data-mora-message]').forEach(button => button.addEventListener('click', () => { document.getElementById('mora').checked = true; submit({ message:button.dataset.moraMessage }, button.dataset.moraMessage); }));
  document.getElementById('moraNewChat').addEventListener('click', resetChat);
  document.getElementById('moraAttachPhoto').addEventListener('click', () => { if (state.issue && !busy) fileInput.click(); });
  document.getElementById('moraPrepareIssue').addEventListener('click', handover);
  issuePicker.addEventListener('change', () => {
    const selected = state.issues.find(issue => issue.id === issuePicker.value);
    if (selected && selected.id !== state.issue?.id) onAction({type:'switch_issue', id:`switch-${selected.id}`});
  });
  fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));
  document.getElementById('moraCaptureRequest').addEventListener('click', () => { document.getElementById('mora').checked = true; if (state.issue) return; submit({ message:'Ich möchte ein Anliegen melden.' }, 'Ich möchte ein Anliegen melden.'); });
  document.getElementById('moraContactCard').addEventListener('click', () => { document.getElementById('mora').checked = true; submit({ message:'Wie kann ich MORADA kontaktieren?' }, 'Wie kann ich MORADA kontaktieren?'); });
  document.getElementById('moraSaveDraft').addEventListener('click', async () => { if (!activeDraft) return; updateDraft();
    try { await dbOperation(window, 'drafts', 'readwrite', store => store.put(activeDraft)); renderDraft();
      document.getElementById('moraDraftStatus').textContent = activeDraft.delivery === 'sent' && activeDraft.requestId
        ? `Lokal gespeichert. Vorgang ${activeDraft.requestId} wurde übermittelt.${activeDraft.unsentChanges ? ' Nachträgliche lokale Änderungen wurden noch nicht übermittelt.' : ''}`
        : 'Entwurf lokal gespeichert. Noch nicht an MORADA übermittelt.';
    }
    catch { document.getElementById('moraDraftStatus').textContent = 'Der Browser konnte den Entwurf nicht speichern. Bitte laden Sie ihn herunter.'; }
  });
  document.getElementById('moraDownloadDraft').addEventListener('click', () => downloadDraft().catch(() => { document.getElementById('moraDraftStatus').textContent = 'Der Download konnte nicht erstellt werden. Ihr Entwurf bleibt hier erhalten.'; }));
  for (const [id] of DRAFT_FIELDS) document.getElementById(id).addEventListener('input', updateDraft);
  draftPicker.addEventListener('change', () => { activeDraft = drafts.find(draft => draft.id === draftPicker.value); renderDraft(); });
  document.querySelectorAll('.mora-close,.mora-fab,.enter-btn').forEach(label => {
    label.tabIndex = 0; label.setAttribute('role','button'); label.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); label.click(); } });
  });
  function resize() {
    const viewport = window.visualViewport; const height = viewport?.height || window.innerHeight;
    const keyboard = viewport && window.innerHeight - height > 120;
    document.documentElement.style.setProperty('--mora-max-height', `${Math.max(180, height - (keyboard ? 24 : 112))}px`);
    document.documentElement.style.setProperty('--mora-bottom', keyboard ? `${Math.max(12, window.innerHeight - height - viewport.offsetTop + 12)}px` : '82px');
  }
  window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize); resize();
  const ready = (async () => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
      if ((saved?.session || saved?.pendingTurn) && Array.isArray(saved.thread)) { state = saved; state.issues ||= state.issue ? [state.issue] : []; state.files ||= state.issue?.attachments || []; messages.replaceChildren();
        for (const entry of state.thread) addBubble(entry.content, entry.who, entry.actions || [], false);
        if (state.thread.at(-1)?.who !== 'assistant') { disableActions(); latestActions = null; }
        await renderPhotos(); }
    } catch {}
    renderIssueControls();
    try { drafts = await dbOperation(window, 'drafts', 'readonly', store => store.getAll()); drafts.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); activeDraft = drafts[0]; renderDraft(); } catch {}
  })();
  return { ready, submit, onAction, addFiles, getState:() => structuredClone(state), getDrafts:() => structuredClone(drafts), getPreparationState:()=>preparationPhase };
}

if (typeof document !== 'undefined' && document.getElementById('moraForm')) createMora(document, window);
