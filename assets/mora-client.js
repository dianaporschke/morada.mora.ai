const TYPES = new Set(['select', 'handover', 'attachment', 'add_details', 'navigate', 'continue', 'call', 'reset', 'retry']);
const TABS = new Set(['docs', 'service', 'profile', 'portfolio']);
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const STORAGE_KEY = 'morada.mora.v2.thread';
const LABELS = { water:'Wasser / Feuchtigkeit', electricity:'Elektrik / Beleuchtung', heating:'Heizung', access:'Schlüssel / Zugang', neighbours:'Nachbarschaft / Lärm', appliances:'Geräte / Waschküche', general:'Allgemeines Anliegen' };

export function renderActions(document, actions, onAction) {
  const group = document.createElement('div'); group.className = 'mora-actions';
  for (const action of actions || []) {
    if (!TYPES.has(action.type) || typeof action.label !== 'string') continue;
    const button = document.createElement('button'); button.type = 'button';
    button.className = `mora-action${action.variant === 'primary' ? ' primary' : ''}`;
    button.textContent = action.label; button.dataset.actionId = action.id;
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
  let state = { session:null, issue:null, capabilities:{ submitRequest:false }, thread:[], files:[] };
  let busy = false; let latestActions; let retryPayload; let activeDraft; let drafts = [];
  const blobs = new Map(); const urls = new Map();
  const id = () => window.crypto.randomUUID();
  const scroll = () => { messages.scrollTop = messages.scrollHeight; };
  const persist = () => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { document.getElementById('moraStorageNote').textContent = 'Der Browser kann den Chat gerade nicht speichern. Bitte laden Sie Ihren Anliegenentwurf herunter.'; }
  };
  const addBubble = (content, who = 'assistant', actions = [], remember = true) => {
    const bubble = document.createElement('div'); bubble.className = `bubble${who === 'user' ? ' user' : ''}`;
    bubble.textContent = content; messages.appendChild(bubble);
    if (actions.length) { latestActions = renderActions(document, actions, onAction); messages.appendChild(latestActions); }
    if (remember) { state.thread.push({ content, who, actions }); persist(); }
    scroll(); return bubble;
  };
  const disableActions = () => { messages.querySelectorAll('.mora-action').forEach(button => { button.disabled = true; }); };
  const lock = value => { busy = value; send.disabled = value; if (latestActions) latestActions.querySelectorAll('button').forEach(button => { button.disabled = value; }); };

  async function submit(payload, displayText = undefined, retry = false) {
    if (busy) return;
    disableActions(); lock(true);
    if (displayText && !retry) addBubble(displayText, 'user');
    if (!retry && payload.message) text.value = '';
    const loading = addBubble('MORA nimmt Ihr Anliegen auf …', 'assistant', [], false); loading.classList.add('loading');
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 30000);
    const previousIssue = state.issue;
    try {
      const response = await fetcher('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ ...payload, ...(state.session ? { session:state.session } : {}) }), signal:controller.signal });
      const data = await response.json(); loading.remove();
      if (!response.ok) throw Object.assign(new Error(data.error || 'Die Antwort konnte nicht geladen werden.'), { code:data.code });
      if (typeof data.reply !== 'string' || typeof data.session !== 'string') throw new Error('Die Antwort konnte nicht geladen werden.');
      if (previousIssue && data.issue?.id !== previousIssue.id) await saveDraft(previousIssue, false);
      if (data.issue?.id !== previousIssue?.id) state.files = data.issue?.attachments || [];
      state.session = data.session; state.issue = data.issue; state.capabilities = data.capabilities;
      retryPayload = null; addBubble(data.reply, 'assistant', data.actions); await renderPhotos(); persist();
    } catch (error) {
      loading.remove(); retryPayload = { payload, displayText };
      const actions = error.code === 'INVALID_SESSION' || error.code === 'INVALID_ACTION' ? [] : [{ id:'retry', label:'Erneut versuchen', type:'retry', variant:'primary' }];
      if (state.issue) actions.push({ id:'prepare-request', label:'Anliegenentwurf öffnen', type:'handover', variant:'secondary' });
      actions.push({ id:'new-request', label:'Neuen Chat starten', type:'reset', variant:'secondary' });
      addBubble(error.code ? error.message : 'MORA ist gerade nicht erreichbar. Ihre Angaben bleiben im Chat erhalten. Sie können es erneut versuchen oder den bisherigen Anliegenentwurf öffnen.', 'assistant', actions);
    } finally { window.clearTimeout(timer); lock(false); scroll(); }
  }

  function navigate(target) {
    if (!TABS.has(target)) return;
    document.getElementById(target).checked = true; document.getElementById('mora').checked = false;
    window.scrollTo({ top:0, behavior:'auto' });
  }
  async function onAction(action) {
    if (busy) return;
    if (action.type === 'navigate') return navigate(action.target);
    if (action.type === 'call') { if (action.number === '112') window.location.href = 'tel:112'; return; }
    if (action.type === 'attachment') return fileInput.click();
    if (action.type === 'handover') return handover();
    if (action.type === 'retry') { if (retryPayload) return submit(retryPayload.payload, retryPayload.displayText, true); return; }
    if (action.type === 'reset') return resetChat();
    return submit({ actionId:action.id }, action.type === 'select' ? action.label : undefined);
  }

  async function resetChat() {
    if (busy) return;
    lock(true);
    if (state.issue) await saveDraft(state.issue, false);
    state.session = null; state.issue = null; state.files = []; persist(); await renderPhotos();
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
        if (busy) return; state.files = state.files.filter(item => item.id !== meta.id); persist();
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
    fileInput.value = ''; persist(); await renderPhotos();
    lock(false);
    if (added) await submit({ attachments:state.files });
    if (warning) addBubble(warning);
  }

  async function saveDraft(issue, show = true) {
    const draft = { ...structuredClone(issue), attachments:issue.attachments || state.files, status:'draft', session:state.session,
      updatedAt:new Date().toISOString(), delivery:'not_sent' };
    drafts = drafts.filter(item => item.id !== draft.id); drafts.unshift(draft);
    try { await dbOperation(window, 'drafts', 'readwrite', store => store.put(draft)); }
    catch { if (show) addBubble('Ihr Anliegen ist hier vorbereitet. Der Browser konnte es nicht dauerhaft speichern; bitte laden Sie den Entwurf herunter.'); }
    if (show) { activeDraft = draft; renderDraft(); }
    return draft;
  }
  function renderDraft() {
    if (!activeDraft) { draftSection.hidden = true; return; }
    draftSection.hidden = false; draftPicker.replaceChildren();
    for (const draft of drafts) {
      const option = document.createElement('option'); option.value = draft.id;
      option.textContent = `${LABELS[draft.category] || 'Anliegen'} · ${new Date(draft.createdAt).toLocaleDateString('de-CH')} · Entwurf`;
      option.selected = draft.id === activeDraft.id; draftPicker.appendChild(option);
    }
    for (const [id, field] of [['moraDraftDescription','description'],['moraDraftLocation','location'],['moraDraftSince','since'],['moraDraftDetails','details']]) document.getElementById(id).value = activeDraft[field] || '';
    document.getElementById('moraDraftSummary').textContent = activeDraft.summary;
    document.getElementById('moraDraftStatus').textContent = 'Noch nicht übermittelt. Die direkte Übermittlung ist noch nicht angeschlossen. Der Entwurf bleibt auf diesem Gerät.';
    const photos = document.getElementById('moraDraftPhotos'); photos.replaceChildren();
    for (const meta of activeDraft.attachments) { const label = document.createElement('span'); label.textContent = meta.name; label.className = 'muted'; photos.appendChild(label); }
  }
  function updateDraft() {
    for (const [id, field] of [['moraDraftDescription','description'],['moraDraftLocation','location'],['moraDraftSince','since'],['moraDraftDetails','details']]) activeDraft[field] = document.getElementById(id).value.trim();
    activeDraft.updatedAt = new Date().toISOString(); activeDraft.locallyEdited = true;
    return activeDraft;
  }
  async function handover() {
    if (!state.issue || busy) return;
    lock(true);
    await saveDraft({ ...state.issue, attachments:state.files });
    if (state.capabilities?.submitRequest) {
      lock(true);
      try {
        const response = await fetcher('/api/requests', { method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ session:state.session, idempotencyKey:state.issue.id }), signal:AbortSignal.timeout(25000) });
        const receipt = await response.json();
        if (!response.ok || receipt.accepted !== true || !receipt.requestId) throw new Error('Übermittlung nicht bestätigt');
        activeDraft.delivery = 'sent'; activeDraft.requestId = receipt.requestId;
        await dbOperation(window, 'drafts', 'readwrite', store => store.put(activeDraft));
        addBubble(`MORADA hat Ihr Anliegen erhalten. Vorgang: ${receipt.requestId}`);
      } catch {
        addBubble('Die Übermittlung wurde nicht bestätigt. Ihr Anliegen bleibt als Entwurf erhalten; bitte kontaktieren Sie MORADA bei dringenden Anliegen direkt.');
      } finally { lock(false); }
    } else addBubble('Ich habe Ihre Angaben in den Anliegenentwurf im Servicebereich übernommen. Die direkte Übermittlung an MORADA ist noch nicht angeschlossen; Ihr Anliegen wurde noch nicht versendet.');
    lock(false); navigate('service');
  }
  async function downloadDraft() {
    if (!activeDraft) return;
    updateDraft();
    const { session, ...exported } = activeDraft;
    const payload = { ...exported, notice:'Anliegenentwurf; noch nicht an MORADA übermittelt.', photos:[] };
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
  fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));
  document.getElementById('moraCaptureRequest').addEventListener('click', () => { document.getElementById('mora').checked = true; if (state.issue) return; submit({ message:'Ich möchte ein Anliegen melden.' }, 'Ich möchte ein Anliegen melden.'); });
  document.getElementById('moraContactCard').addEventListener('click', () => { document.getElementById('mora').checked = true; submit({ message:'Wie kann ich MORADA kontaktieren?' }, 'Wie kann ich MORADA kontaktieren?'); });
  document.getElementById('moraSaveDraft').addEventListener('click', async () => { if (!activeDraft) return; updateDraft();
    try { await dbOperation(window, 'drafts', 'readwrite', store => store.put(activeDraft)); document.getElementById('moraDraftStatus').textContent = 'Entwurf lokal gespeichert. Noch nicht an MORADA übermittelt.'; }
    catch { document.getElementById('moraDraftStatus').textContent = 'Der Browser konnte den Entwurf nicht speichern. Bitte laden Sie ihn herunter.'; }
  });
  document.getElementById('moraDownloadDraft').addEventListener('click', () => downloadDraft().catch(() => { document.getElementById('moraDraftStatus').textContent = 'Der Download konnte nicht erstellt werden. Ihr Entwurf bleibt hier erhalten.'; }));
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
      if (saved?.session && Array.isArray(saved.thread)) { state = saved; messages.replaceChildren();
        for (const entry of state.thread) addBubble(entry.content, entry.who, entry.actions || [], false);
        disableActions(); if (latestActions) latestActions.querySelectorAll('button').forEach(button => { button.disabled = false; });
        await renderPhotos(); }
    } catch {}
    try { drafts = await dbOperation(window, 'drafts', 'readonly', store => store.getAll()); drafts.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); activeDraft = drafts[0]; renderDraft(); } catch {}
  })();
  return { ready, submit, onAction, addFiles, getState:() => structuredClone(state), getDrafts:() => structuredClone(drafts) };
}

if (typeof document !== 'undefined' && document.getElementById('moraForm')) createMora(document, window);
