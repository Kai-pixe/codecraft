'use strict';

(() => {
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------
  // Constantes
  // ---------------------------------------------------------------
  const SYSTEM_PROMPT =
    'You are a helpful assistant built into a code editor. Answer EVERYTHING the user says: greetings, general questions, chat, explanations and programming. Never refuse to chat and do not ask what to change when the user only greets or asks something; just answer. ' +
    'Reply in the language the user writes in (Spanish if they write Spanish), clearly and concisely. When you show code, use fenced blocks with triple backticks (```).';
  const EDIT_PROMPT = SYSTEM_PROMPT +
    '\n\nEDIT MODE ENABLED: the user authorizes you to modify their code ONLY when they explicitly ask for it (change, fix, add, refactor, create). ' +
    'In that case, reply with one short sentence and deliver the result in blocks that start with ```apply (exactly that word after the backticks). ' +
    'If the code you received is a SELECTION, the ```apply block must contain ONLY the snippet that replaces it. If it is the WHOLE FILE, it must contain the COMPLETE modified file, without omitting parts or using "...". ' +
    'To create or modify ANOTHER file use ```apply:path/file.ext. If the user only asks questions or wants explanations, answer normally and use regular code blocks (```js), never ```apply.';
  const MAX_CODE_CHARS = 12000;      // código máximo enviado a la IA por mensaje
  const MAX_CHAT_STORED = 100;       // mensajes guardados por proveedor
  const MAX_CHAT_SENT = 12;          // mensajes de historial enviados a la IA
  const BIG_TEXT = 10 * 1024 * 1024; // a partir de aquí se avisa antes de abrir como texto
  const MAX_TERM_LINES = 500;        // líneas que conserva la terminal en pantalla
  const RUN_MAX_MS = 20000;          // tiempo máximo de un programa ejecutado desde la terminal
  const AI_TIMEOUT_MS = 60000;
  const SAVE_DELAY_MS = 1000;
  const DEFAULT_NAME = 'untitled.txt';
  const WIDE = window.matchMedia('(min-width: 900px)');
  const MODELS_CACHE = 'gemini_models';   // lista de modelos (no es secreta)
  const EXCLUDE_MODELS = /(tts|image|live|audio|embedding|robotics|computer-use|translate|native|aqa|learnlm|deep-research|imagen|veo|lyria|vision)/i;
  const SIDE = { openrouter: 'left', gemini: 'right' };

  const PROVIDERS = {
    gemini: { label: 'OpenRouter 2', defaultModel: 'openrouter/auto', keyName: 'openrouter_key', modelName: 'openrouter_model_b' },
    openrouter: { label: 'OpenRouter 1', defaultModel: 'openrouter/auto', keyName: 'openrouter_key', modelName: 'openrouter_model' }
  };

  // Lenguaje por extensión: [nombre, comentario de línea | [apertura, cierre]]
  const SLASH = '//';
  const LANGS = {
    js: ['JavaScript', SLASH], mjs: ['JavaScript', SLASH], cjs: ['JavaScript', SLASH], jsx: ['JavaScript React', SLASH],
    ts: ['TypeScript', SLASH], tsx: ['TypeScript React', SLASH], json: ['JSON', SLASH], md: ['Markdown', ['<!--', '-->']],
    py: ['Python', '#'], html: ['HTML', ['<!--', '-->']], htm: ['HTML', ['<!--', '-->']], css: ['CSS', ['/*', '*/']],
    scss: ['SCSS', SLASH], java: ['Java', SLASH], c: ['C', SLASH], cpp: ['C++', SLASH], h: ['C/C++ Header', SLASH],
    cs: ['C#', SLASH], go: ['Go', SLASH], rs: ['Rust', SLASH], php: ['PHP', SLASH], rb: ['Ruby', '#'], sh: ['Shell', '#'],
    bash: ['Shell', '#'], sql: ['SQL', '--'], yml: ['YAML', '#'], yaml: ['YAML', '#'], xml: ['XML', ['<!--', '-->']],
    svg: ['SVG', ['<!--', '-->']], txt: ['Plain text', SLASH], toml: ['TOML', '#'], ini: ['INI', ';'], env: ['Env', '#']
  };

  // ---------------------------------------------------------------
  // Utilidades de DOM
  // ---------------------------------------------------------------
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }

  // Iconos SVG propios (trazos simples, sin librerías)
  const ICONS = {
    files: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    file: 'M6 3h8l4 4v14H6z M14 3v4h4',
    save: 'M5 3h11l3 3v15H5z M8 3v6h8V3 M8 21v-7h8v7',
    play: 'M7 4l13 8-13 8z',
    stop: 'M6 6h12v12H6z',
    term: 'M4 5h16v14H4z M7 9l3 3-3 3 M12 15h5',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    edit: 'M4 20l4-1 11-11-3-3L5 16z',
    right: 'M9 6l6 6-6 6',
    down: 'M6 9l6 6 6-6',
    spark: 'M12 3l2 6 6 3-6 3-2 6-2-6-6-3 6-3z',
    router: 'M3 12h5l2-6 4 12 2-6h5',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v1l-2 1 1 3 2-.5 1.5 1.5-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
    clear: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    branch: 'M6 3v12 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 9c0 6-12 3-12 6',
    pleft: 'M3 5h18v14H3z M9 5v14',
    pbottom: 'M3 5h18v14H3z M3 14h18',
    pright: 'M3 5h18v14H3z M15 5v14',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    download: 'M12 4v12M7 11l5 5 5-5M4 20h16'
  };
  Object.assign(ICONS, {
    palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 11c0-4.4-4-8-9-8z M7.5 11.5h.01 M10.5 7.5h.01 M15.5 7.5h.01',
    flow: 'M5 4h4v4H5z M15 16h4v4h-4z M7 8v4a4 4 0 0 0 4 4h4',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M9 7h6',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
    folderplus: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M12 10v6 M9 13h6',
    chevrons: 'M7 9l5-5 5 5 M7 15l5 5 5-5'
  });
  function icon(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name] || '');
    s.appendChild(p);
    return h('span', { class: 'ico' }, s);
  }

  // ---------------------------------------------------------------
  // Elementos
  // ---------------------------------------------------------------
  const els = {
    wb: $('workbench'),
    center: $('center'),
    editor: $('code-editor'),
    editorWrap: $('editor-wrap'),
    gutter: $('gutter'),
    empty: $('empty-state'),
    emptyTitle: $('empty-title'),
    emptyText: $('empty-text'),
    emptyActions: $('empty-actions'),
    tabs: $('tabs'),
    left: $('panel-left'),
    act: $('activitybar'),
    filesList: $('files-list'),
    filesCount: $('files-count'),
    drawerFoot: $('drawer-foot'),
    scrim: $('scrim'),
    stFile: $('st-file'),
    stSave: $('st-save'),
    stPos: $('st-pos'),
    stLang: $('st-lang'),
    stTerm: $('st-term'),
    importInput: $('import-input'),
    importDir: $('import-dir'),
    dropHint: $('drop-hint'),
    menubar: $('menubar'),
    quick: $('quick-tools'),
    set: {
      dlg: $('settings-dlg'),
      gKey: $('set-gemini-key'),
      gModel: $('set-gemini-model'),
      oModelB: $('set-openrouter-model-b'),
      oKey: $('set-openrouter-key'),
      oModel: $('set-openrouter-model'),
      gClear: $('clear-gemini-key'),
      oClear: $('clear-openrouter-key'),
      gRefresh: $('refresh-models-settings'),
      msg: $('settings-msg')
    },
    nameDlg: $('name-dlg'),
    nameTitle: $('name-title'),
    nameInput: $('name-input'),
    nameOk: $('name-ok'),
    nameCancel: $('name-cancel'),
    infoDlg: $('info-dlg'),
    infoTitle: $('info-title'),
    infoBody: $('info-body')
  };
  const panels = { openrouter: $('panel-ai-left'), gemini: $('panel-ai-right') };
  const ui = { gemini: null, openrouter: null };   // referencias de cada panel de IA

  // ---------------------------------------------------------------
  // Estado y preferencias
  // ---------------------------------------------------------------
  const state = {
    dbOK: true,
    files: [],                       // solo metadatos (el contenido vive en el store 'docs')
    tabs: [],                        // ids de archivos abiertos
    current: null,
    blob: null,                      // contenido del archivo binario abierto
    dirty: false,
    saveTimer: null,
    chats: { gemini: [], openrouter: [] },
    ai: { gemini: { busy: false, abort: null }, openrouter: { busy: false, abort: null } },
    autosave: true,
    overlay: null,                   // panel de IA abierto como cajón en pantallas estrechas
    closedDirs: new Set(),
    projects: [{ id: 'default', name: 'General', link: null }],
    project: null,
    all: [],                         // metadatos de TODOS los proyectos (state.files = solo el proyecto actual)
    handles: new Map(),              // archivos enlazados a un archivo real del dispositivo
    buffers: new Map(),              // cambios sin guardar de pestañas que no están en pantalla
    draftTimer: null,
    find: { cs: false, re: false }
  };

  state.project = state.projects[0];
  Object.defineProperty(state, 'filesOpen', { get() { return isOpen('explorer'); } });

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } },
    remove(k) { try { localStorage.removeItem(k); } catch (_) { /* nada */ } }
  };

  const PREF_DEFAULTS = { leftView: 'explorer', lw: 320, rw: 340, th: 220, left: true, right: true, term: true, termN: false, wrap: false, fs: 16, uis: 1.1, theme: 'forja', pvmode: 'safe', pdev: 0, accent: null, uibg: null, ac: true, pairs: true, closed: [] };
  const prefs = Object.assign({}, PREF_DEFAULTS);
  try { Object.assign(prefs, JSON.parse(store.get('cc_prefs') || '{}')); } catch (_) { /* valores por defecto */ }
  if (!prefs.v) { if (prefs.fs === 14) prefs.fs = 16; prefs.v = 2; }
  if (!Array.isArray(prefs.closed)) prefs.closed = [];
  state.closedDirs = new Set(prefs.closed);
  let prefsTimer = null;
  function savePrefs() {
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(() => store.set('cc_prefs', JSON.stringify(prefs)), 200);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------
  // IndexedDB nativo (sin librerías)
  // Stores: files (metadatos), docs ({id, content} o {id, blob}), chat, meta
  // ---------------------------------------------------------------
  let dbp = null;

  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB not available'));
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open('codecraft', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chat')) db.createObjectStore('chat', { keyPath: 'provider' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        };
        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => { db.close(); dbp = null; };
          resolve(db);
        };
        req.onerror = () => { dbp = null; reject(req.error); };
      });
    }
    return dbp;
  }

  function run(stores, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let out;
      const req = fn(t);
      if (req && 'onsuccess' in req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    }));
  }

  const idb = {
    get: (s, k) => run(s, 'readonly', (t) => t.objectStore(s).get(k)),
    put: (s, v) => run(s, 'readwrite', (t) => t.objectStore(s).put(v)),
    all: (s) => run(s, 'readonly', (t) => t.objectStore(s).getAll()),
    del: (s, k) => run(s, 'readwrite', (t) => t.objectStore(s).delete(k))
  };

  // data: texto (string) o Blob si meta.binary
  const dbSaveFile = (meta, data) => run(['files', 'docs'], 'readwrite', (t) => {
    t.objectStore('files').put(meta);
    t.objectStore('docs').put(meta.binary ? { id: meta.id, blob: data } : { id: meta.id, content: data });
  });

  const dbDeleteFiles = (ids) => run(['files', 'docs'], 'readwrite', (t) => {
    ids.forEach((id) => { t.objectStore('files').delete(id); t.objectStore('docs').delete(id); });
  });

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  const uid = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  // Ruta de archivo: segmentos separados por «/», sin «..», sin caracteres de control
  function normalizePath(s) {
    const parts = String(s || '').replace(/\\/g, '/').split('/')
      .map((p) => p.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120))
      .filter((p) => p && p !== '.' && p !== '..');
    return parts.join('/').slice(0, 240) || DEFAULT_NAME;
  }
  const baseName = (p) => p.slice(p.lastIndexOf('/') + 1);
  const extOf = (p) => { const b = baseName(p); const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i + 1).toLowerCase() : (b.startsWith('.') ? b.slice(1).toLowerCase() : ''); };
  const langOf = (p) => LANGS[extOf(p)] || ['Plain text', SLASH];

  function uniqueName(name) {
    if (!state.files.some((f) => f.name === name)) return name;
    const slash = name.lastIndexOf('/') + 1;
    const dir = name.slice(0, slash);
    const b = name.slice(slash);
    const dot = b.lastIndexOf('.');
    const stem = dot > 0 ? b.slice(0, dot) : b;
    const ext = dot > 0 ? b.slice(dot) : '';
    for (let i = 1; i < 10000; i++) {
      const n = `${dir}${stem} (${i})${ext}`;
      if (!state.files.some((f) => f.name === n)) return n;
    }
    return `${dir}${stem}-${uid().slice(0, 6)}${ext}`;
  }

  const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const fmtDate = (ts) => new Date(ts).toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' });
  const byName = (a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
  const isRunnable = (name) => /\.(m?js)$/i.test(name);

  function setSave(text) { els.stSave.textContent = text; }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // ---------------------------------------------------------------
  // Archivos: registros, lectura y escritura
  // ---------------------------------------------------------------
  async function createFileRecord(name, data, opts) {
    const o = opts || {};
    const now = Date.now();
    const meta = { id: uid(), name: normalizePath(name), project: state.project.id, created: now, updated: now, size: o.binary ? data.size : data.length };
    if (o.binary) { meta.binary = true; meta.mime = o.mime || ''; }
    if (state.dbOK) await dbSaveFile(meta, data);
    state.files.push(meta);
    state.all.push(meta);
    return meta;
  }

  const isCurrent = (meta) => !!(state.current && meta && state.current.id === meta.id);

  // Texto actual de un archivo (si está abierto y editado, el del editor)
  async function getText(meta) {
    if (meta.binary) throw new Error(`«${meta.name}» is binary`);
    if (isCurrent(meta)) return els.editor.value;
    if (state.buffers.has(meta.id)) return state.buffers.get(meta.id);
    if (!state.dbOK) return '';
    const doc = await idb.get('docs', meta.id);
    return doc && typeof doc.content === 'string' ? doc.content : '';
  }

  async function getBlob(meta) {
    if (meta.binary) {
      if (isCurrent(meta) && state.blob) return state.blob;
      const doc = state.dbOK ? await idb.get('docs', meta.id) : null;
      return doc && doc.blob ? doc.blob : new Blob([]);
    }
    return new Blob([await getText(meta)], { type: 'text/plain;charset=utf-8' });
  }

  async function setText(meta, text) {
    if (isCurrent(meta)) {
      els.editor.value = text;
      setDirty(true);
      await saveNow();
      updateGutter();
      schedulePos();
      return;
    }
    meta.updated = Date.now();
    meta.size = text.length;
    state.buffers.delete(meta.id);
    if (state.dbOK) await dbSaveFile(meta, text);
  }

  async function loadFile(id) {
    const meta = state.files.find((f) => f.id === id);
    if (!meta) return;
    let content = '';
    let dirty = false;
    state.blob = null;
    if (state.dbOK) {
      const doc = await idb.get('docs', id);
      if (meta.binary) state.blob = doc && doc.blob ? doc.blob : new Blob([]);
      else content = doc && typeof doc.content === 'string' ? doc.content : '';
    }
    if (!meta.binary && state.buffers.has(id)) {
      // Cambios que no se habían guardado (se conservan hasta que tú guardes o los descartes)
      content = state.buffers.get(id);
      state.buffers.delete(id);
      dirty = true;
    }
    state.current = meta;
    noteRecent(meta);
    if (!state.tabs.includes(id)) { state.tabs.push(id); persistTabs(); }
    els.editor.value = meta.binary ? '' : content;
    els.editor.readOnly = !!meta.binary;
    els.editor.scrollTop = 0;
    els.editor.scrollLeft = 0;
    if (!meta.binary) els.editor.setSelectionRange(0, 0);
    els.stFile.textContent = meta.name;
    els.stLang.textContent = meta.binary ? 'Binary' : langOf(meta.name)[0];
    showEmpty(meta.binary ? 'binary' : null);
    setDirty(dirty);
    setSave(!state.dbOK ? 'No local storage' : (meta.binary ? 'Read only' : (dirty ? 'Unsaved — Ctrl+S' : 'Saved')));
    updateGutter(true);
    schedulePos();
    updateHLState();
    lintNow();
    renderTabs();
    if (state.filesOpen) renderFiles();
    if (state.dbOK) idb.put('meta', { key: 'currentId:' + state.project.id, value: id }).catch(() => {});
  }

  function showEmpty(mode) {
    // mode: null (oculto) | 'none' (sin archivos abiertos) | 'binary'
    els.empty.hidden = !mode;
    els.gutter.hidden = !!mode || prefs.wrap;
    if (!mode) return;
    els.emptyActions.replaceChildren();
    els.empty.querySelectorAll('.welcome-extra').forEach((n) => n.remove());
    if (mode === 'binary') {
      els.emptyTitle.textContent = baseName(state.current.name);
      els.emptyText.textContent = `Binary file (${fmtSize(state.current.size)}). It can't be edited as text, but it is kept intact and you can export it.`;
      els.emptyActions.append(h('button', { class: 'btn', type: 'button', 'data-action': 'export', text: 'Export file' }));
    } else {
      els.emptyTitle.textContent = 'CodeCraft';
      els.emptyText.textContent = (state.project ? `Project: ${state.project.name} · ${state.files.length} file${state.files.length === 1 ? '' : 's'}. ` : '') + 'Pick a recent file, create a new one, or import your files, folders or .zip.';
      els.emptyActions.append(
        h('button', { class: 'btn', type: 'button', 'data-action': 'new', text: 'New file' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'files', text: 'Explorer' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'import', text: 'Import' })
      );
      try { welcomeExtras(els.empty.querySelector('.empty-card')); } catch (_) { /* la bienvenida nunca debe romper el editor */ }
    }
  }

  function setNoFile() {
    state.current = null;
    state.blob = null;
    els.editor.value = '';
    els.editor.readOnly = true;
    els.stFile.textContent = '—';
    els.stLang.textContent = '—';
    setDirty(false);
    setSave('Ready');
    showEmpty('none');
    updateHLState();
    lintNow();
    renderTabs();
    schedulePos();
    document.title = 'CodeCraft';
    if (state.dbOK) idb.del('meta', 'currentId:' + state.project.id).catch(() => {});
  }

  // Punto blanco de "sin guardar" (pestaña, explorador y título de la ventana)
  function setDirty(v) {
    const changed = state.dirty !== v;
    state.dirty = v;
    document.title = (v ? '● ' : '') + (state.current ? baseName(state.current.name) + ' — ' : '') + 'CodeCraft';
    const tab = state.current && els.tabs.querySelector(`[data-id="${state.current.id}"]`);
    if (tab) tab.classList.toggle('dirty', v);
    if (changed && state.filesOpen) renderFiles();
  }

  async function saveNow(showFeedback) {
    clearTimeout(state.saveTimer);
    if (!state.current || !state.dbOK || state.current.binary) return;
    if (!state.dirty) { if (showFeedback) setSave('Saved'); return; }
    const meta = state.current;
    const content = els.editor.value;
    setDirty(false);
    meta.updated = Date.now();
    meta.size = content.length;
    setSave('Saving…');
    try {
      await dbSaveFile(meta, content);
      histPush(meta, content);
      state.buffers.delete(meta.id);
      persistDrafts();
      if (!state.dirty) setSave('Saved');
      if (state.filesOpen) renderFiles();
    } catch (_) {
      setDirty(true);
      setSave('Error saving');
    }
  }

  function onEdit() {
    if (!state.current || state.current.binary) return;
    if (state.dbOK) {
      setDirty(true);
      setSave(state.autosave ? 'Saving in a moment…' : 'Unsaved — Ctrl+S');
    } else {
      setSave('No local storage');
    }
    clearTimeout(state.saveTimer);
    if (state.autosave) state.saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
    else { clearTimeout(state.draftTimer); state.draftTimer = setTimeout(persistDrafts, 3000); }
    updateGutter();
    schedulePos();
    refreshPreviewSoon();
    scheduleGit();
    if (!document.getElementById('findbar').hidden) scheduleFindCount();
  }

  // Copia de seguridad de lo que no has guardado (por si se cierra la app); NO cuenta como guardar
  function persistDrafts() {
    if (!state.dbOK) return;
    const o = {};
    state.buffers.forEach((v, k) => { o[k] = v; });
    if (state.current && state.dirty && !state.current.binary) o[state.current.id] = els.editor.value;
    idb.put('meta', { key: 'drafts', map: o }).catch(() => {});
  }

  function persistOnHide() {
    if (!state.dbOK) return;
    if (state.autosave) { saveAll(); return; }
    persistDrafts();
  }

  const isDirtyId = (id) => (state.current && state.current.id === id && state.dirty) || state.buffers.has(id);

  // Al cambiar de pestaña: con autoguardado se guarda; en modo manual los cambios se conservan sin guardar
  async function leaveCurrent() {
    if (!state.current) return;
    if (state.autosave) { await saveNow(); return; }
    clearTimeout(state.saveTimer);
    if (state.dirty && !state.current.binary) {
      state.buffers.set(state.current.id, els.editor.value);
      persistDrafts();
    }
  }

  async function saveAll() {
    histForce = true;
    try { await saveAllInner(); } finally { histForce = false; }
  }
  async function saveAllInner() {
    await saveNow();
    for (const [id, text] of Array.from(state.buffers)) {
      const meta = state.files.find((f) => f.id === id);
      if (!meta || meta.binary) { state.buffers.delete(id); continue; }
      meta.updated = Date.now();
      meta.size = text.length;
      try {
        if (state.dbOK) await dbSaveFile(meta, text);
        histPush(meta, text);
        state.buffers.delete(id);
        const pr = projById(meta.project || 'default');
        if (pr && pr.link) await linkedWrite(pr, meta.name, text).catch(() => {});
      } catch (_) { /* se reintenta luego */ }
    }
    persistDrafts();
    renderTabs();
    renderFiles();
    setSave('Saved');
  }

  function persistTabs() {
    if (state.dbOK) idb.put('meta', { key: 'tabs:' + state.project.id, ids: state.tabs.slice() }).catch(() => {});
  }

  async function openFile(id) {
    if (state.current && state.current.id === id) { renderTabs(); return; }
    await leaveCurrent();
    await loadFile(id);
  }

  async function switchToNewFile(name, content) {
    await leaveCurrent();
    const meta = await createFileRecord(name, content);
    await loadFile(meta.id);
    renderFiles();
    return meta;
  }

  async function closeTab(id) {
    const idx = state.tabs.indexOf(id);
    if (idx === -1) return;
    const isCur = state.current && state.current.id === id;
    const f = state.files.find((x) => x.id === id);
    if (isDirtyId(id)) {
      if (state.autosave) {
        await saveAll();
      } else {
        if (!window.confirm(`«${f ? baseName(f.name) : 'file'}» has unsaved changes.\n\nOK = close and discard the changes.\nCancel = go back (save with Ctrl+S).`)) return;
        state.buffers.delete(id);
        if (isCur) { clearTimeout(state.saveTimer); setDirty(false); }
        persistDrafts();
      }
    }
    state.tabs.splice(idx, 1);
    persistTabs();
    if (isCur) {
      const nextId = state.tabs[Math.min(idx, state.tabs.length - 1)];
      if (nextId) await loadFile(nextId); else setNoFile();
    } else {
      renderTabs();
    }
  }

  async function deleteFiles(ids, ask) {
    const list = state.files.filter((f) => ids.includes(f.id));
    if (!list.length) return 0;
    if (ask !== false) {
      const msg = list.length === 1 ? `Delete «${list[0].name}»? This can't be undone.` : `Delete ${list.length} files? This can't be undone.`;
      if (!window.confirm(msg)) return 0;
    }
    const wasCurrent = state.current && ids.includes(state.current.id);
    if (wasCurrent) { clearTimeout(state.saveTimer); setDirty(false); }
    ids.forEach((i) => { state.buffers.delete(i); state.handles.delete(i); if (state.dbOK) { idb.del('meta', 'h:' + i).catch(() => {}); idb.del('meta', 'hist:' + i).catch(() => {}); } });
    try { if (state.dbOK) await dbDeleteFiles(list.map((f) => f.id)); } catch (_) { /* se ignora */ }
    state.files = state.files.filter((x) => !ids.includes(x.id));
    state.all = state.all.filter((x) => !ids.includes(x.id));
    persistDrafts();
    const oldIdx = state.current ? state.tabs.indexOf(state.current.id) : -1;
    state.tabs = state.tabs.filter((t) => !ids.includes(t));
    persistTabs();
    if (wasCurrent) {
      const nextId = state.tabs[Math.min(Math.max(oldIdx, 0), state.tabs.length - 1)];
      if (nextId) await loadFile(nextId); else setNoFile();
    } else {
      renderTabs();
    }
    renderFiles();
    return list.length;
  }

  async function renameFile(meta, newName) {
    const name = normalizePath(newName);
    if (name === meta.name) return true;
    if (state.files.some((f) => f.name === name && f.id !== meta.id)) return false;
    meta.name = name;
    meta.updated = Date.now();
    if (isCurrent(meta)) {
      els.stFile.textContent = name;
      els.stLang.textContent = meta.binary ? 'Binary' : langOf(name)[0];
      setDirty(state.dirty);
      updateHLState();
    }
    if (state.dbOK) { try { await idb.put('files', meta); } catch (_) { setSave('Error saving'); } }
    renderTabs();
    renderFiles();
    return true;
  }

  async function duplicateFile(meta) {
    if (!meta) return null;
    const name = uniqueName(meta.name);
    const data = meta.binary ? await getBlob(meta) : await getText(meta);
    const out = await createFileRecord(name, data, { binary: !!meta.binary, mime: meta.mime });
    renderFiles();
    return out;
  }

  // ---------------------------------------------------------------
  // Diálogos
  // ---------------------------------------------------------------
  function askName(title, initial) {
    return new Promise((resolve) => {
      let result = null;
      els.nameTitle.textContent = title;
      els.nameInput.value = initial || '';
      els.nameOk.onclick = () => { result = els.nameInput.value; els.nameDlg.close(); };
      els.nameCancel.onclick = () => els.nameDlg.close();
      els.nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); els.nameOk.click(); }
      };
      els.nameDlg.onclose = () => {
        els.nameOk.onclick = null;
        els.nameCancel.onclick = null;
        els.nameInput.onkeydown = null;
        els.nameDlg.onclose = null;
        resolve(result);
      };
      els.nameDlg.showModal();
      els.nameInput.select();
    });
  }

  function showInfo(title, nodes) {
    els.infoTitle.textContent = title;
    els.infoBody.replaceChildren(...nodes);
    if (!els.infoDlg.open) els.infoDlg.showModal();
  }

  // ---------------------------------------------------------------
  // Editor: números de línea, posición del cursor, tamaño de letra
  // ---------------------------------------------------------------
  let gLines = 0;
  function updateGutter(force) {
    if (prefs.wrap || !els.empty.hidden) { els.gutter.hidden = true; return; }
    els.gutter.hidden = false;
    const v = els.editor.value;
    let n = 1;
    for (let i = v.indexOf('\n'); i !== -1; i = v.indexOf('\n', i + 1)) n++;
    if (n !== gLines || force) {
      gLines = n;
      const a = new Array(n);
      for (let i = 0; i < n; i++) a[i] = i + 1;
      els.gutter.textContent = a.join('\n');
      els.gutter.style.setProperty('--digits', String(n).length);
    }
    syncGutter();
  }

  function syncGutter() {
    const ed = els.editor;
    els.gutter.style.setProperty('--sbh', Math.max(0, ed.offsetHeight - ed.clientHeight) + 'px');
    els.gutter.scrollTop = ed.scrollTop;
    scheduleHL();
  }

  let posQueued = false;
  function schedulePos() {
    if (posQueued) return;
    posQueued = true;
    requestAnimationFrame(() => {
      posQueued = false;
      const v = els.editor.value;
      const p = els.editor.selectionStart;
      let line = 1;
      let last = -1;
      for (let i = v.indexOf('\n'); i !== -1 && i < p; i = v.indexOf('\n', i + 1)) { line++; last = i; }
      const sel = els.editor.selectionEnd - p;
      els.stPos.textContent = `Ln ${line}, Col ${p - last}` + (sel ? ` (${sel} sel.)` : '');
    });
  }

  function applyFont() {
    document.documentElement.style.setProperty('--fs', prefs.fs + 'px');
    charW = 0;
    updateGutter(true);
    updateHLState();
  }

  function setFont(px) {
    prefs.fs = clamp(Math.round(px), 9, 28);
    savePrefs();
    applyFont();
  }

  function setWrap(on) {
    prefs.wrap = !!on;
    savePrefs();
    els.editorWrap.classList.toggle('wrap', prefs.wrap);
    els.editor.setAttribute('wrap', prefs.wrap ? 'soft' : 'off');
    updateGutter(true);
    updateHLState();
  }

  // Inserta texto en el cursor conservando el historial de deshacer
  function insertAtCursor(text) {
    els.editor.focus();
    const ok = text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text);
    if (!ok) {
      const s = els.editor.selectionStart;
      const e = els.editor.selectionEnd;
      els.editor.setRangeText(text, s, e, 'end');
      els.editor.dispatchEvent(new Event('input'));
    }
  }

  // Reemplaza [start, end) por text y deja seleccionado [selA, selB]
  function replaceRange(start, end, text, selA, selB) {
    const ed = els.editor;
    ed.focus();
    ed.setSelectionRange(start, end);
    insertAtCursor(text);
    ed.setSelectionRange(selA, selB);
    schedulePos();
  }

  let charW = 0;
  function charWidth() {
    if (charW) return charW;
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${prefs.fs}px ${getComputedStyle(els.editor).fontFamily}`;
    charW = c.measureText('0').width || prefs.fs * 0.6;
    return charW;
  }

  // Desplaza el editor para que la posición sea visible (sin ajuste de línea es exacto)
  function reveal(pos) {
    const ed = els.editor;
    const v = ed.value;
    let line = 0;
    let last = -1;
    for (let i = v.indexOf('\n'); i !== -1 && i < pos; i = v.indexOf('\n', i + 1)) { line++; last = i; }
    const lh = prefs.fs * 1.6;
    const top = 16 + line * lh;
    if (top < ed.scrollTop + lh || top > ed.scrollTop + ed.clientHeight - lh * 2) {
      ed.scrollTop = Math.max(0, top - ed.clientHeight / 2);
    }
    if (!prefs.wrap) {
      const x = 12 + (pos - last - 1) * charWidth();
      if (x < ed.scrollLeft || x > ed.scrollLeft + ed.clientWidth - 60) ed.scrollLeft = Math.max(0, x - ed.clientWidth / 2);
    }
    syncGutter();
  }

  // ---------------------------------------------------------------
  // Edición: líneas, comentarios, sangría
  // ---------------------------------------------------------------
  function lineBounds() {
    const ed = els.editor;
    const v = ed.value;
    const s = ed.selectionStart;
    let e = ed.selectionEnd;
    if (e > s && v[e - 1] === '\n') e--;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', e);
    if (le === -1) le = v.length;
    return { v, s, e: ed.selectionEnd, ls, le };
  }

  const edit = {
    duplicate() {
      const { v, s, e, ls, le } = lineBounds();
      const block = v.slice(ls, le);
      replaceRange(le, le, '\n' + block, s + block.length + 1, e + block.length + 1);
    },
    remove() {
      const { v, s, ls, le } = lineBounds();
      if (le < v.length) replaceRange(ls, le + 1, '', ls, ls);
      else if (ls > 0) replaceRange(ls - 1, le, '', ls - 1, ls - 1);
      else replaceRange(ls, le, '', 0, 0);
      void s;
    },
    move(dir) {
      const { v, s, e, ls, le } = lineBounds();
      const block = v.slice(ls, le);
      if (dir < 0) {
        if (ls === 0) return;
        const ps = v.lastIndexOf('\n', ls - 2) + 1;
        const prev = v.slice(ps, ls - 1);
        const d = prev.length + 1;
        replaceRange(ps, le, block + '\n' + prev, s - d, e - d);
      } else {
        if (le >= v.length) return;
        let ne = v.indexOf('\n', le + 1);
        if (ne === -1) ne = v.length;
        const next = v.slice(le + 1, ne);
        const d = next.length + 1;
        replaceRange(ls, ne, next + '\n' + block, s + d, e + d);
      }
    },
    comment() {
      if (!state.current || state.current.binary) return;
      const { v, s, e, ls, le } = lineBounds();
      const style = langOf(state.current.name)[1];
      const [open, close] = Array.isArray(style) ? style : [style, ''];
      const lines = v.slice(ls, le).split('\n');
      const filled = lines.filter((l) => l.trim());
      if (!filled.length) return;
      const isCommented = (l) => { const t = l.trim(); return t.startsWith(open) && (!close || t.endsWith(close)); };
      const uncomment = filled.every(isCommented);
      const out = lines.map((l) => {
        if (!l.trim()) return l;
        const indent = l.match(/^\s*/)[0];
        let body = l.slice(indent.length);
        if (uncomment) {
          body = body.slice(open.length);
          if (body.startsWith(' ')) body = body.slice(1);
          if (close) { body = body.slice(0, body.length - close.length); if (body.endsWith(' ')) body = body.slice(0, -1); }
          return indent + body;
        }
        return indent + open + ' ' + body + (close ? ' ' + close : '');
      });
      const text = out.join('\n');
      const delta = text.length - (le - ls);
      const firstDelta = out[0].length - lines[0].length;
      replaceRange(ls, le, text, Math.max(ls, s + firstDelta), e + delta);
    },
    indent(back) {
      const ed = els.editor;
      const { v, s, e, ls, le } = lineBounds();
      const multi = ed.selectionStart !== ed.selectionEnd && v.slice(ed.selectionStart, ed.selectionEnd).includes('\n');
      if (!back && !multi) { insertAtCursor('  '); return; }
      const lines = v.slice(ls, le).split('\n');
      let firstDelta = 0;
      let total = 0;
      const out = lines.map((l, i) => {
        let r;
        if (!back) r = '  ' + l;
        else if (l.startsWith('  ')) r = l.slice(2);
        else if (l.startsWith('\t')) r = l.slice(1);
        else if (l.startsWith(' ')) r = l.slice(1);
        else r = l;
        if (i === 0) firstDelta = r.length - l.length;
        total += r.length - l.length;
        return r;
      });
      replaceRange(ls, le, out.join('\n'), Math.max(ls, s + firstDelta), e + total);
    },
    enter() {
      const ed = els.editor;
      const v = ed.value;
      const s = ed.selectionStart;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const indent = v.slice(ls, s).match(/^[ \t]*/)[0];
      const before = v[s - 1];
      const after = v[ed.selectionEnd];
      const pairs = { '{': '}', '(': ')', '[': ']' };
      if (pairs[before] && after === pairs[before]) {
        insertAtCursor('\n' + indent + '  \n' + indent);
        const p = s + 1 + indent.length + 2;
        ed.setSelectionRange(p, p);
      } else if (pairs[before]) {
        insertAtCursor('\n' + indent + '  ');
      } else {
        insertAtCursor('\n' + indent);
      }
    }
  };

  async function copySelection(cut) {
    const ed = els.editor;
    ed.focus();
    if (document.execCommand(cut ? 'cut' : 'copy')) return;
    const t = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    try { await navigator.clipboard.writeText(t); if (cut && !ed.readOnly) insertAtCursor(''); } catch (_) { setSave('Could not copy'); }
  }

  async function pasteClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) insertAtCursor(t);
    } catch (_) { setSave('Clipboard permission denied — use Ctrl+V'); }
  }

  async function gotoLine() {
    const ans = await askName('Go to line', '');
    if (ans === null) return;
    const n = parseInt(ans, 10);
    if (!n || n < 1) return;
    const v = els.editor.value;
    let pos = 0;
    for (let i = 1; i < n; i++) { const nx = v.indexOf('\n', pos); if (nx === -1) { pos = v.length; break; } pos = nx + 1; }
    els.editor.focus();
    els.editor.setSelectionRange(pos, pos);
    reveal(pos);
    schedulePos();
  }

  // ---------------------------------------------------------------
  // Buscar y reemplazar
  // ---------------------------------------------------------------
  const fb = {
    bar: $('findbar'), input: $('find-input'), repl: $('repl-input'), replRow: $('repl-row'),
    count: $('find-count'), cs: $('find-case'), re: $('find-re')
  };
  let findTimer = null;

  function openFind(replaceMode) {
    fb.bar.hidden = false;
    fb.replRow.hidden = !replaceMode;
    const ed = els.editor;
    const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    if (sel && !sel.includes('\n') && sel.length < 200) fb.input.value = sel;
    fb.input.focus();
    fb.input.select();
    updateFindCount();
  }

  function closeFind() {
    fb.bar.hidden = true;
    els.editor.focus();
  }

  function buildRegex(global) {
    const q = fb.input.value;
    if (!q) return null;
    try {
      const src = state.find.re ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(src, (state.find.cs ? '' : 'i') + (global ? 'g' : '') + 'm');
    } catch (_) { return 'bad'; }
  }

  function scheduleFindCount() { clearTimeout(findTimer); findTimer = setTimeout(updateFindCount, 150); }

  function updateFindCount() {
    const re = buildRegex(true);
    fb.input.classList.toggle('bad', re === 'bad');
    if (!re) { fb.count.textContent = ''; return; }
    if (re === 'bad') { fb.count.textContent = 'Invalid regex'; return; }
    const v = els.editor.value;
    const ed = els.editor;
    let n = 0;
    let cur = 0;
    let m;
    while ((m = re.exec(v)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      n++;
      if (m.index === ed.selectionStart && m.index + m[0].length === ed.selectionEnd) cur = n;
      if (n >= 9999) break;
    }
    fb.count.textContent = n ? (cur ? `${cur} of ${n}` : `${n} results`) : 'No results';
  }

  function selectMatch(start, end) {
    els.editor.setSelectionRange(start, end);
    reveal(start);
    schedulePos();
    updateFindCount();
  }

  function findStep(dir) {
    const re = buildRegex(true);
    if (!re || re === 'bad') return false;
    const ed = els.editor;
    const v = ed.value;
    let m;
    if (dir > 0) {
      re.lastIndex = ed.selectionEnd;
      do { m = re.exec(v); if (m && m[0] === '') re.lastIndex++; } while (m && m[0] === '');
      if (!m) { re.lastIndex = 0; do { m = re.exec(v); if (m && m[0] === '') re.lastIndex++; } while (m && m[0] === ''); }
    } else {
      let last = null;
      let first = null;
      while ((m = re.exec(v)) !== null) {
        if (m[0] === '') { re.lastIndex++; continue; }
        first = m;
        if (m.index >= ed.selectionStart) break;
        last = m;
      }
      m = last || first;
      if (!last) {
        // sin coincidencias antes del cursor: se vuelve al final
        re.lastIndex = 0;
        let l2 = null;
        while ((m = re.exec(v)) !== null) { if (m[0] === '') { re.lastIndex++; continue; } l2 = m; }
        m = l2;
      }
    }
    if (!m) { fb.count.textContent = 'No results'; return false; }
    selectMatch(m.index, m.index + m[0].length);
    return true;
  }

  function replaceOne() {
    const re = buildRegex(false);
    if (!re || re === 'bad' || els.editor.readOnly) return;
    const ed = els.editor;
    const sel = ed.value.slice(ed.selectionStart, ed.selectionEnd);
    const exact = sel && new RegExp('^(?:' + re.source + ')$', re.flags).test(sel);
    if (exact) {
      const text = state.find.re ? sel.replace(re, fb.repl.value) : fb.repl.value;
      replaceRange(ed.selectionStart, ed.selectionEnd, text, ed.selectionStart, ed.selectionStart + text.length);
      ed.setSelectionRange(ed.selectionStart + text.length, ed.selectionStart + text.length);
    }
    findStep(1);
  }

  function replaceAll() {
    const re = buildRegex(true);
    const ed = els.editor;
    if (!re || re === 'bad' || ed.readOnly) return;
    const v = ed.value;
    let count = 0;
    const out = v.replace(re, (...a) => {
      count++;
      if (!state.find.re) return fb.repl.value;
      // soporta $1, $& en modo regex
      return fb.repl.value.replace(/\$(\d+|&)/g, (_, g) => (g === '&' ? a[0] : (typeof a[+g] === 'string' ? a[+g] : '')));
    });
    if (!count) { fb.count.textContent = 'No results'; return; }
    const top = ed.scrollTop;
    replaceRange(0, v.length, out, 0, 0);
    ed.scrollTop = top;
    fb.count.textContent = `${count} replacements`;
    syncGutter();
  }

  // ---------------------------------------------------------------
  // Pestañas
  // ---------------------------------------------------------------
  function renderTabs() {
    els.tabs.replaceChildren();
    let curEl = null;
    state.tabs.forEach((id) => {
      const f = state.files.find((x) => x.id === id);
      if (!f) return;
      const cur = state.current && state.current.id === id;
      const t = h('div', { class: 'tab' + (cur ? ' current' : '') + (isDirtyId(id) ? ' dirty' : ''), 'data-id': id, draggable: 'true', role: 'tab', 'aria-selected': cur ? 'true' : 'false' },
        h('button', { class: 'tab-label', type: 'button', title: f.name, text: baseName(f.name), onclick: () => openFile(id) }),
        h('button', { class: 'tab-close', type: 'button', 'aria-label': `Close ${baseName(f.name)}`, title: 'Close', onclick: (e) => { e.stopPropagation(); closeTab(id); } },
          h('span', { class: 'x', text: '×' }), h('span', { class: 'dotmark' }))
      );
      t.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(id); } });
      els.tabs.appendChild(t);
      if (cur) curEl = t;
    });
    if (curEl) curEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ---------------------------------------------------------------
  // Explorador de archivos (árbol por carpetas)
  // ---------------------------------------------------------------
  function buildTree() {
    const root = { dirs: new Map(), files: [], path: '' };
    projDirs().forEach((dp) => {
      const parts = dp.split('/'); let n = root;
      for (let i = 0; i < parts.length; i++) {
        const d = parts[i];
        if (!n.dirs.has(d)) n.dirs.set(d, { dirs: new Map(), files: [], path: parts.slice(0, i + 1).join('/') });
        n = n.dirs.get(d);
      }
    });
    state.files.forEach((f) => {
      const parts = f.name.split('/');
      let n = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const d = parts[i];
        if (!n.dirs.has(d)) n.dirs.set(d, { dirs: new Map(), files: [], path: parts.slice(0, i + 1).join('/') });
        n = n.dirs.get(d);
      }
      n.files.push(f);
    });
    return root;
  }

  function countFiles(node) {
    let c = node.files.length;
    node.dirs.forEach((d) => { c += countFiles(d); });
    return c;
  }

  function collectIds(node, out) {
    node.files.forEach((f) => out.push(f.id));
    node.dirs.forEach((d) => collectIds(d, out));
    return out;
  }

  // ===============================================================
  // Explorador estilo VS Code
  // ===============================================================
  const ex = { sel: 'd:', set: new Set(), anchor: null, trash: null, edit: null, rootOpen: true, lastCur: null, drag: null, rows: [], hoverT: 0 };
  const IND = 16;
  const FI = {
    js: ['JS', '#e5c07b'], mjs: ['JS', '#e5c07b'], cjs: ['JS', '#e5c07b'], jsx: ['JSX', '#61dafb'], ts: ['TS', '#4aa3df'], tsx: ['TSX', '#4aa3df'],
    json: ['{}', '#d8b24c'], html: ['<>', '#e8794a'], htm: ['<>', '#e8794a'], css: ['#', '#5aa9e6'], scss: ['#', '#e07ab0'], md: ['M↓', '#7fb0d9'],
    svg: ['◇', '#e8a54a'], png: ['▣', '#6bbf8a'], jpg: ['▣', '#6bbf8a'], jpeg: ['▣', '#6bbf8a'], gif: ['▣', '#6bbf8a'], webp: ['▣', '#6bbf8a'], ico: ['▣', '#6bbf8a'],
    py: ['PY', '#5fa0d3'], sh: ['$', '#8fd18f'], txt: ['≡', '#8190a5'], yml: ['!', '#c678dd'], yaml: ['!', '#c678dd'], toml: ['!', '#c678dd'], env: ['⚙', '#e5c07b'],
    zip: ['▤', '#b0b8c6'], pdf: ['PDF', '#e06c75'], csv: ['▦', '#6bbf8a'], xml: ['<>', '#c58a52'], wasm: ['W', '#8b7dd8']
  };
  function fileIco(name) {
    const e = extOf(name);
    const d = FI[e] || (baseName(name).toLowerCase() === '.gitignore' ? ['◆', '#e0775a'] : ['▫', '#8190a5']);
    const s = h('span', { class: 'fi', text: d[0], 'aria-hidden': 'true' });
    s.style.color = d[1];
    return s;
  }
  const keyOf = (t, p) => t + ':' + p;
  const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const joinP = (a, b) => (a ? a + '/' + b : b);
  const exSelDir = () => { const k = ex.sel || 'd:'; const p = k.slice(2); return k[0] === 'd' ? p : parentOf(p); };

  function findNode(path) {
    let n = buildTree();
    if (!path) return n;
    for (const seg of path.split('/')) { n = n.dirs.get(seg); if (!n) return null; }
    return n;
  }
  function openAncestors(path) {
    if (!path) return;
    const parts = path.split('/');
    for (let i = 1; i <= parts.length; i++) state.closedDirs.delete(parts.slice(0, i).join('/'));
    saveClosed();
  }

  function exRows() {
    const rows = [];
    const walk = (node, depth) => {
      if (ex.edit && ex.edit.mode === 'create' && ex.edit.parent === node.path) rows.push({ t: 'edit', depth, kind: ex.edit.kind });
      [...node.dirs.keys()].sort(byName).forEach((n) => {
        const d = node.dirs.get(n);
        const open = !state.closedDirs.has(d.path);
        rows.push({ t: 'd', path: d.path, name: n, depth, open });
        if (open) walk(d, depth + 1);
      });
      node.files.slice().sort((a, b) => byName(baseName(a.name), baseName(b.name))).forEach((f) => rows.push({ t: 'f', path: f.name, name: baseName(f.name), depth, meta: f }));
    };
    walk(buildTree(), 0);
    return rows;
  }

  function exInput(initial, stem, commit) {
    const inp = h('input', { class: 'tr-input', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Name' });
    inp.value = initial;
    inp.dataset.stem = stem ? '1' : '';
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = inp.value.trim();
      ex.edit = null;
      renderFiles();
      if (ok && v) Promise.resolve(commit(v)).catch((err) => toast(String((err && err.message) || err), 'err'));
      else if (els.filesList) els.filesList.focus({ preventScroll: true });
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', () => finish(true));
    inp.addEventListener('click', (e) => e.stopPropagation());
    return inp;
  }

  function exRow(r, cur) {
    if (r.t === 'edit') {
      const row = h('div', { class: 'tr edit', role: 'none' });
      row.style.setProperty('--d', r.depth);
      const kind = r.kind;
      const par = ex.edit.parent;
      row.append(h('span', { class: 'tw' }), kind === 'dir' ? h('span', { class: 'fi dir' }, icon('files')) : fileIco(''),
        exInput('', false, (v) => commitCreate(kind, par, v)));
      return row;
    }
    const key = keyOf(r.t, r.path);
    const renaming = ex.edit && ex.edit.mode === 'rename' && ex.edit.key === key;
    const row = h('div', { class: 'tr ' + (r.t === 'd' ? 'dir' : 'file') + (ex.set.has(key) ? ' sel' : '') + (r.t === 'f' && cur && cur.id === r.meta.id ? ' active' : ''),
      role: 'treeitem', 'data-key': key, draggable: renaming ? null : 'true', title: r.path, 'aria-level': String(r.depth + 1) });
    if (r.t === 'd') row.setAttribute('aria-expanded', r.open ? 'true' : 'false');
    row.style.setProperty('--d', r.depth);
    row.append(h('span', { class: 'tw' }, r.t === 'd' ? icon(r.open ? 'down' : 'right') : null));
    row.append(r.t === 'd' ? h('span', { class: 'fi dir' }, icon('files')) : fileIco(r.name));
    if (renaming) row.append(exInput(r.name, r.t === 'f', (v) => commitRename(key, v)));
    else {
      const nm = h('span', { class: 'tn', text: r.name });
      row.append(nm);
      if (r.t === 'f' && isDirtyId(r.meta.id)) row.append(h('span', { class: 'dot', title: 'Unsaved changes' }));
      row.append(h('button', { class: 'tr-more', type: 'button', 'data-more': '1', 'aria-label': 'More actions', title: 'More actions', text: '⋯', tabindex: '-1' }));
    }
    return row;
  }

  function updateRootRow() {
    const lab = $('ex-root-label');
    if (!lab) return;
    lab.textContent = (state.project ? state.project.name : 'Files').toUpperCase();
    $('ex-root-chev').textContent = ex.rootOpen ? '▾' : '▸';
    const rf = $('ex-refresh');
    if (rf) rf.hidden = !(state.project && state.project.link);
  }

  function renderFiles() {
    const box = els.filesList;
    if (!box) return;
    const keep = box.scrollTop;
    box.replaceChildren();
    els.filesCount.textContent = state.files.length ? `(${state.files.length})` : '';
    updateRootRow();
    const cur = state.current;
    if (cur && ex.lastCur !== cur.id) {
      ex.lastCur = cur.id;
      openAncestors(parentOf(cur.name));
      ex.sel = keyOf('f', cur.name);
      ex.set = new Set([ex.sel]); ex.anchor = ex.sel;
    }
    const empty = !state.files.length && !projDirs().length;
    if (empty && !ex.edit) {
      ex.rows = [];
      box.append(h('div', { class: 'ex-empty' },
        h('p', { text: 'This project has no files yet.' }),
        h('button', { class: 'btn', type: 'button', text: 'New file', onclick: () => startCreate('file', '') }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'New folder', onclick: () => startCreate('dir', '') }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Import files', onclick: () => els.importInput.click() }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Open Chromebook folder', onclick: () => runAction('open-folder') })));
    } else if (ex.rootOpen) {
      ex.rows = exRows();
      ex.rows.forEach((r) => box.appendChild(exRow(r, cur)));
    } else ex.rows = [];
    { const live = new Set(ex.rows.filter((r) => r.t !== 'edit').map((r) => keyOf(r.t, r.path))); ex.set = new Set([...ex.set].filter((k) => live.has(k))); }
    renderSelBar();
    box.scrollTop = keep;
    const inp = box.querySelector('.tr-input');
    if (inp) {
      inp.focus();
      if (inp.dataset.stem) { const i = inp.value.lastIndexOf('.'); inp.setSelectionRange(0, i > 0 ? i : inp.value.length); } else inp.select();
      inp.scrollIntoView({ block: 'nearest' });
    } else {
      const a = box.querySelector('.tr.sel') || box.querySelector('.tr.active');
      if (a && state.filesOpen) a.scrollIntoView({ block: 'nearest' });
    }
    if (state.filesOpen) updateStorageInfo();
    scheduleGit();
  }

  const visKeys = () => ex.rows.filter((r) => r.t !== 'edit').map((r) => keyOf(r.t, r.path));
  function exSelect(key, mode) {
    if (mode === 'toggle' && key !== 'd:') {
      if (ex.set.has(key)) ex.set.delete(key); else ex.set.add(key);
      ex.sel = key; ex.anchor = key;
    } else if (mode === 'range') {
      const keys = visKeys();
      let a = keys.indexOf(ex.anchor || ex.sel);
      const b = keys.indexOf(key);
      if (b < 0) return;
      if (a < 0) a = b;
      ex.set = new Set(keys.slice(Math.min(a, b), Math.max(a, b) + 1));
      ex.sel = key;
    } else {
      ex.sel = key; ex.anchor = key;
      ex.set = key === 'd:' ? new Set() : new Set([key]);
    }
    paintSel();
  }
  function paintSel() {
    els.filesList.querySelectorAll('.tr[data-key]').forEach((n) => {
      n.classList.toggle('sel', ex.set.has(n.dataset.key));
      if (n.dataset.key === ex.sel) n.scrollIntoView({ block: 'nearest' });
    });
    renderSelBar();
  }
  function exSelectAll(kind) {
    const rows = ex.rows.filter((r) => r.t !== 'edit' && (kind !== 'folders' || r.t === 'd'));
    ex.set = new Set(rows.map((r) => keyOf(r.t, r.path)));
    ex.sel = rows.length ? keyOf(rows[rows.length - 1].t, rows[rows.length - 1].path) : 'd:';
    ex.anchor = rows.length ? keyOf(rows[0].t, rows[0].path) : null;
    paintSel();
    if (!rows.length) toast(kind === 'folders' ? 'There are no folders.' : 'There is nothing to select.', 'err');
  }
  function renderSelBar() {
    const bar = $('ex-selbar');
    if (!bar) return;
    const n = ex.set.size;
    bar.hidden = n < 2;
    bar.replaceChildren();
    if (n < 2) return;
    const nd = [...ex.set].filter((k) => k[0] === 'd').length, nf = n - nd;
    bar.append(h('span', { class: 'ex-selcount', text: `${n} selected` + (nd && nf ? ` (${nd} folders, ${nf} files)` : nd ? ' (folders)' : ' (files)') }),
      h('button', { class: 'btn danger sm', type: 'button', text: 'Delete', onclick: () => exDeleteKeys([...ex.set]) }),
      h('button', { class: 'btn btn-ghost sm', type: 'button', text: 'Clear', onclick: () => exSelect('d:') }));
  }

  async function exOpen(path) {
    const meta = state.files.find((f) => f.name === path);
    if (!meta) return;
    await openFile(meta.id);
    if (!WIDE.matches) setPanel('explorer', false);
    restoreEditorFocus();
  }
  function exToggle(path, force) {
    const open = !state.closedDirs.has(path);
    const want = force == null ? !open : force;
    if (want) state.closedDirs.delete(path); else state.closedDirs.add(path);
    saveClosed();
    renderFiles();
  }

  function startCreate(kind, parent) {
    if (!state.filesOpen) setPanel('explorer', true);
    ex.rootOpen = true;
    openAncestors(parent);
    ex.edit = { mode: 'create', kind, parent: parent || '' };
    renderFiles();
  }
  function startRename(key) {
    if (!key || key === 'd:') return;
    if (!state.filesOpen) setPanel('explorer', true);
    ex.edit = { mode: 'rename', key };
    renderFiles();
  }

  async function commitCreate(kind, parent, val) {
    const path = normalizePath(joinP(parent, val));
    if (kind === 'dir') {
      if (state.files.some((f) => f.name === path)) { toast('A file with that name already exists.', 'err'); return; }
      const dirs = projDirs();
      if (!dirs.includes(path)) dirs.push(path);
      openAncestors(path);
      persistProjects();
      ex.sel = keyOf('d', path); ex.set = new Set([ex.sel]);
      renderFiles();
      return;
    }
    if (allDirPaths().has(path)) { toast('A folder with that name already exists.', 'err'); return; }
    openAncestors(parentOf(path));
    const old = state.files.find((f) => f.name === path);
    if (old) await openFile(old.id); else await switchToNewFile(path, '');
    if (!WIDE.matches) setPanel('explorer', false);
    focusEd();
  }

  async function commitRename(key, val) {
    const type = key[0], path = key.slice(2);
    const np = normalizePath(joinP(parentOf(path), val));
    if (np === path) return;
    if (type === 'f') {
      const meta = state.files.find((f) => f.name === path);
      if (!meta) return;
      if (allDirPaths().has(np)) { toast('A folder with that name already exists.', 'err'); return; }
      if (!(await renameFile(meta, np))) { toast('A file with that name already exists.', 'err'); return; }
    } else {
      if (np.startsWith(path + '/')) { toast('A folder cannot be moved into itself.', 'err'); return; }
      if (state.files.some((f) => f.name === np)) { toast('A file with that name already exists.', 'err'); return; }
      if (!(await renameDirTo(path, np))) return;
    }
    openAncestors(parentOf(np));
    ex.sel = keyOf(type, np); ex.set = new Set([ex.sel]);
    renderFiles();
  }

  async function renameDirTo(path, np) {
    const inside = state.files.filter((f) => f.name.startsWith(path + '/'));
    if (inside.some((f) => state.files.some((x) => x.name === np + f.name.slice(path.length) && x.id !== f.id))) { toast('There are already files with those names in the destination folder.', 'err'); return false; }
    for (const f of inside) await renameFile(f, np + f.name.slice(path.length));
    const dirs = projDirs();
    for (let i = 0; i < dirs.length; i++) if (dirs[i] === path || dirs[i].startsWith(path + '/')) dirs[i] = np + dirs[i].slice(path.length);
    if (!dirs.includes(np)) dirs.push(np);
    const closed = new Set();
    state.closedDirs.forEach((c) => closed.add(c === path || c.startsWith(path + '/') ? np + c.slice(path.length) : c));
    state.closedDirs = closed;
    saveClosed();
    persistProjects();
    return true;
  }

  async function moveNode(srcKey, dest) {
    const type = srcKey[0], path = srcKey.slice(2);
    if (!path || parentOf(path) === dest) return;
    const np = joinP(dest, baseName(path));
    if (type === 'd') {
      if (dest === path || dest.startsWith(path + '/')) { toast('A folder cannot be moved into itself.', 'err'); return; }
      if (state.files.some((f) => f.name === np)) { toast('A file with that name already exists there.', 'err'); return; }
      if (!(await renameDirTo(path, np))) return;
    } else {
      const meta = state.files.find((f) => f.name === path);
      if (!meta) return;
      if (allDirPaths().has(np)) { toast('A folder with that name already exists there.', 'err'); return; }
      if (!(await renameFile(meta, np))) { toast('A file with that name already exists there.', 'err'); return; }
    }
    openAncestors(dest);
    ex.sel = keyOf(type, np); ex.set = new Set([ex.sel]);
    renderFiles();
  }

  function exCollect(keys) {
    const sel = keys.filter((k) => k[0] === 'd').map((k) => k.slice(2)).filter(Boolean);
    const top = sel.filter((p) => !sel.some((q) => q !== p && p.startsWith(q + '/')));
    const names = new Set(keys.filter((k) => k[0] === 'f').map((k) => k.slice(2)));
    state.files.forEach((f) => { if (top.some((d) => f.name.startsWith(d + '/'))) names.add(f.name); });
    const files = [...names].map((n) => state.files.find((f) => f.name === n)).filter(Boolean);
    const dirs = new Set();
    projDirs().forEach((d) => { if (top.some((t) => d === t || d.startsWith(t + '/'))) dirs.add(d); });
    top.forEach((t) => dirs.add(t));
    files.forEach((f) => { const p = f.name.split('/'); for (let i = 1; i < p.length; i++) { const d = p.slice(0, i).join('/'); if (top.some((t) => d === t || d.startsWith(t + '/'))) dirs.add(d); } });
    return { top, files, dirs: [...dirs] };
  }

  async function exDeleteKeys(keys) {
    keys = keys.filter((k) => k && k !== 'd:');
    if (!keys.length) return;
    const c = exCollect(keys);
    if (!c.files.length && !c.top.length) return;
    const parts = [];
    if (c.top.length) parts.push(`${c.top.length} folder${c.top.length > 1 ? 's' : ''}`);
    if (c.files.length) parts.push(`${c.files.length} file${c.files.length > 1 ? 's' : ''}`);
    if (!window.confirm(`Delete ${parts.join(' and ')}?\n\nYou can undo it right afterwards with Ctrl+Z in the explorer.`)) return;
    const snap = { files: [], dirs: c.dirs.slice() };
    for (const f of c.files) snap.files.push({ name: f.name, binary: !!f.binary, mime: f.mime, data: f.binary ? await getBlob(f) : await getText(f) });
    if (c.files.length) await deleteFiles(c.files.map((f) => f.id), false);
    const dirs = projDirs();
    for (let i = dirs.length - 1; i >= 0; i--) if (c.top.some((t) => dirs[i] === t || dirs[i].startsWith(t + '/'))) dirs.splice(i, 1);
    persistProjects();
    ex.trash = snap; ex.set = new Set(); ex.sel = 'd:';
    renderFiles();
    toast(`Deleted ${parts.join(' and ')}. Ctrl+Z in the explorer undoes it.`, 'ok');
  }
  const exDelete = (key) => exDeleteKeys([key]);

  async function exUndoDelete() {
    const t = ex.trash;
    if (!t) { toast('Nothing to undo.', 'err'); return; }
    ex.trash = null;
    const dirs = projDirs();
    t.dirs.forEach((d) => { if (!dirs.includes(d)) dirs.push(d); });
    let n = 0;
    for (const r of t.files) {
      if (state.files.some((f) => f.name === r.name)) continue;
      await createFileRecord(r.name, r.data, { binary: r.binary, mime: r.mime });
      n++;
    }
    persistProjects();
    renderFiles();
    toast(`Restored ${n} file${n === 1 ? '' : 's'}.`, 'ok');
  }

  async function exCopy(text) {
    try { await navigator.clipboard.writeText(text); toast('Path copied', 'ok'); } catch (_) { toast('Could not copy', 'err'); }
  }

  // ---- Menú contextual ----
  let exCtx = null;
  function closeCtx() { if (exCtx) { exCtx.remove(); exCtx = null; } }
  function showCtx(items, x, y) {
    closeCtx();
    const ul = h('ul', { class: 'dropdown-menu show ex-ctx', role: 'menu' });
    items.forEach((it) => {
      if (it === '-') { ul.append(h('li', { class: 'sep', role: 'separator' })); return; }
      const b = h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '' }, h('span', { class: 'mi-check' }), h('span', { text: it.label }), h('span', { class: 'mi-key', text: it.key || '' }));
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', () => { closeCtx(); Promise.resolve(it.fn()).catch((e) => toast(String((e && e.message) || e), 'err')); });
      ul.append(h('li', null, b));
    });
    document.body.append(ul);
    exCtx = ul;
    const r = ul.getBoundingClientRect();
    ul.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
    ul.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
    const f = ul.querySelector('button:not(:disabled)');
    if (f) f.focus({ preventScroll: true });
  }
  function ctxItemsFor(key) {
    if (ex.set.size > 1 && ex.set.has(key)) {
      return [{ label: `Delete ${ex.set.size} items`, key: 'Del', danger: true, fn: () => exDeleteKeys([...ex.set]) }, { label: 'Clear selection', fn: () => exSelect('d:') }];
    }
    const type = key ? key[0] : 'd', path = key ? key.slice(2) : '';
    const it = [];
    if (type === 'f') {
      const meta = state.files.find((f) => f.name === path);
      if (!meta) return it;
      it.push({ label: 'Open', fn: () => exOpen(path) }, '-',
        { label: 'Rename', key: 'F2', fn: () => startRename(key) },
        { label: 'Duplicate', fn: async () => { const m = await duplicateFile(meta); if (m) await openFile(m.id); } },
        { label: 'Download', fn: async () => { downloadBlob(await getBlob(meta), baseName(meta.name)); } }, '-',
        { label: 'Copy path', fn: () => exCopy(path) }, '-',
        { label: 'Delete', key: 'Del', danger: true, fn: () => exDelete(key) });
      return it;
    }
    it.push({ label: 'New file…', fn: () => startCreate('file', path) }, { label: 'New folder…', fn: () => startCreate('dir', path) }, '-');
    if (path) {
      const open = !state.closedDirs.has(path);
      it.push({ label: 'Rename', key: 'F2', fn: () => startRename(key) }, { label: 'Copy path', fn: () => exCopy(path) },
        { label: open ? 'Collapse' : 'Expand', fn: () => exToggle(path) }, '-', { label: 'Delete folder', key: 'Del', danger: true, fn: () => exDelete(key) });
    } else {
      it.push({ label: 'Select all', key: 'Ctrl+A', fn: () => exSelectAll('all') }, { label: 'Select all folders', fn: () => exSelectAll('folders') },
        { label: 'Undo last delete', key: 'Ctrl+Z', fn: () => exUndoDelete(), disabled: !ex.trash }, '-',
        { label: 'Import files…', fn: () => els.importInput.click() }, { label: 'Import folder…', fn: () => els.importDir.click() },
        { label: 'Export everything (.zip)', fn: () => exportZip(), disabled: !state.files.length }, '-',
        { label: 'Collapse all folders', fn: () => actions['collapse-all']() }, { label: 'Expand all folders', fn: () => actions['expand-all']() });
      if (state.project && state.project.link) it.push('-', { label: 'Reload from folder', fn: () => syncProject(false) });
    }
    return it;
  }

  // ---- Eventos del árbol (una sola vez) ----
  function bindExplorer() {
    const box = els.filesList;
    const rowOf = (e) => (e.target.closest ? e.target.closest('.tr[data-key]') : null);
    box.addEventListener('click', (e) => {
      if (e.target.closest('.tr-input')) return;
      const row = rowOf(e);
      if (!row) { exSelect('d:'); return; }
      const key = row.dataset.key, path = key.slice(2);
      if (e.target.closest('[data-more]')) { e.stopPropagation(); const r = e.target.getBoundingClientRect(); if (!ex.set.has(key)) exSelect(key); showCtx(ctxItemsFor(key), r.left, r.bottom + 2); return; }
      if (e.ctrlKey || e.metaKey) { exSelect(key, 'toggle'); return; }
      if (e.shiftKey) { exSelect(key, 'range'); return; }
      exSelect(key);
      if (key[0] === 'd') exToggle(path); else exOpen(path);
    });
    box.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const row = rowOf(e);
      const key = row ? row.dataset.key : 'd:';
      if (!ex.set.has(key)) exSelect(key);
      showCtx(ctxItemsFor(key), e.clientX, e.clientY);
    });
    box.addEventListener('keydown', (e) => {
      if (e.target !== box || ex.edit) return;
      const keys = visKeys();
      const i = keys.indexOf(ex.sel);
      const k = e.key, cur = ex.sel || 'd:', path = cur.slice(2);
      const mod = e.ctrlKey || e.metaKey;
      const go = (n) => { const t = keys[Math.max(0, Math.min(keys.length - 1, n))]; if (t) exSelect(t, e.shiftKey ? 'range' : null); e.preventDefault(); };
      if (mod && k.toLowerCase() === 'a') { e.preventDefault(); exSelectAll('all'); }
      else if (mod && k.toLowerCase() === 'z') { e.preventDefault(); exUndoDelete(); }
      else if (k === 'Escape') { exSelect('d:'); }
      else if (k === 'ArrowDown') go(i < 0 ? 0 : i + 1);
      else if (k === 'ArrowUp') go(i < 0 ? 0 : i - 1);
      else if (k === 'Home') go(0);
      else if (k === 'End') go(keys.length - 1);
      else if (k === 'ArrowRight' && cur[0] === 'd' && path) { e.preventDefault(); if (state.closedDirs.has(path)) exToggle(path, true); else go(i + 1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); if (cur[0] === 'd' && path && !state.closedDirs.has(path)) exToggle(path, false); else if (parentOf(path)) exSelect(keyOf('d', parentOf(path))); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (cur[0] === 'f') exOpen(path); else if (path) exToggle(path); }
      else if (k === 'F2') { e.preventDefault(); if (ex.set.size <= 1) startRename(cur); }
      else if (k === 'Delete') { e.preventDefault(); exDeleteKeys(ex.set.size ? [...ex.set] : [cur]); }
      else if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) { e.preventDefault(); const n = box.querySelector('.tr.sel'); const r = (n || box).getBoundingClientRect(); showCtx(ctxItemsFor(cur), r.left + 24, r.bottom); }
    });
    // Arrastrar y soltar para mover (los archivos del sistema siguen importándose)
    const clearDrop = () => { box.classList.remove('drop-root'); document.querySelectorAll('.tr.drop, .ex-root.drop').forEach((n) => n.classList.remove('drop')); clearTimeout(ex.hoverT); };
    box.addEventListener('dragstart', (e) => {
      const row = rowOf(e);
      if (!row) return;
      const k = row.dataset.key;
      ex.drag = ex.set.has(k) && ex.set.size > 1 ? [...ex.set] : [k];
      e.dataTransfer.setData('application/x-cc-node', ex.drag.join('\n'));
      e.dataTransfer.setData('text/plain', row.title);
      e.dataTransfer.effectAllowed = 'move';
    });
    const targetOf = (e) => { const row = rowOf(e); if (!row) return { dir: '', row: null }; const k = row.dataset.key; return { dir: k[0] === 'd' ? k.slice(2) : parentOf(k.slice(2)), row }; };
    box.addEventListener('dragover', (e) => {
      if (!ex.drag) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      const t = targetOf(e);
      clearDrop();
      if (t.row && t.row.dataset.key[0] === 'd') {
        t.row.classList.add('drop');
        const p = t.row.dataset.key.slice(2);
        if (state.closedDirs.has(p)) ex.hoverT = setTimeout(() => exToggle(p, true), 700);
      } else if (t.row) { const pr = [...box.querySelectorAll('.tr.dir')].find((n) => n.dataset.key === 'd:' + t.dir); if (pr) pr.classList.add('drop'); else box.classList.add('drop-root'); }
      else box.classList.add('drop-root');
    });
    box.addEventListener('dragleave', (e) => { if (!box.contains(e.relatedTarget)) clearDrop(); });
    const doDrop = async (src, dest) => { for (const k of src.filter((x) => !src.some((y) => y !== x && y[0] === 'd' && x.slice(2).startsWith(y.slice(2) + '/')))) await moveNode(k, dest); };
    box.addEventListener('drop', (e) => { if (!ex.drag) return; e.preventDefault(); e.stopPropagation(); const t = targetOf(e), src = ex.drag; ex.drag = null; clearDrop(); doDrop(src, t.dir); });
    box.addEventListener('dragend', () => { ex.drag = null; clearDrop(); });
    const root = $('drawer-actions');
    root.addEventListener('dragover', (e) => { if (!ex.drag) return; e.preventDefault(); root.classList.add('drop'); });
    root.addEventListener('dragleave', () => root.classList.remove('drop'));
    root.addEventListener('drop', (e) => { if (!ex.drag) return; e.preventDefault(); e.stopPropagation(); const src = ex.drag; ex.drag = null; root.classList.remove('drop'); doDrop(src, ''); });
    document.addEventListener('mousedown', (e) => { if (exCtx && !exCtx.contains(e.target)) closeCtx(); }, true);
    document.addEventListener('keydown', (e) => { if (exCtx && e.key === 'Escape') { e.preventDefault(); closeCtx(); } }, true);
    addEventListener('resize', closeCtx);
    box.addEventListener('scroll', closeCtx);
  }

  async function updateStorageInfo() {
    try {
      const total = state.files.reduce((a, f) => a + (f.size || 0), 0);
      let txt = `Content: ${fmtSize(total)}`;
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        if (e && e.usage != null) txt += ` · Storage used: ${fmtSize(e.usage)}`;
      }
      els.drawerFoot.textContent = txt;
    } catch (_) { /* se ignora */ }
  }

  async function renamePrompt(meta) {
    if (!meta) return;
    const name = await askName('Rename or move (you can use folders: src/app.js)', meta.name);
    if (name === null) return;
    const ok = await renameFile(meta, name);
    if (!ok) window.alert('A file with that name already exists.');
  }

  // ---------------------------------------------------------------
  // Paneles, diseño y barras de arrastre
  // ---------------------------------------------------------------
  const termVisible = () => (WIDE.matches ? prefs.term : prefs.termN);

  const LEFT_FIX = () => { if (prefs.leftView === 'gemini') prefs.leftView = 'openrouter'; };
  const LEFT_VIEWS = ['explorer', 'search', 'git', 'workflow', 'openrouter'];
  const leftOpen = () => (WIDE.matches ? prefs.left : state.overlay === 'left');

  function isOpen(name) {
    if (name === 'files') name = 'explorer';
    if (name === 'terminal') return termVisible();
    if (name === 'gemini') return WIDE.matches ? prefs.right : state.overlay === 'right';
    return leftOpen() && prefs.leftView === name;
  }

  function applyLayout() {
    LEFT_FIX();
    const w = WIDE.matches;
    const wb = els.wb;
    wb.style.setProperty('--lw', prefs.lw + 'px');
    wb.style.setProperty('--rw', prefs.rw + 'px');
    els.center.style.setProperty('--th', prefs.th + 'px');
    wb.classList.toggle('no-left', w && !prefs.left);
    wb.classList.toggle('no-right', w && !prefs.right);
    els.left.classList.toggle('open', leftOpen());
    panels.gemini.classList.toggle('open', isOpen('gemini'));
    els.left.querySelectorAll(':scope > .view').forEach((v) => { v.hidden = v.dataset.view !== prefs.leftView; });
    els.center.classList.toggle('term-hidden', !termVisible());
    els.scrim.classList.toggle('show', !w && !!state.overlay);
    syncToggles();
    requestAnimationFrame(syncGutter);
  }

  function setPanel(name, open) {
    if (name === 'files') name = 'explorer';
    if (name === 'terminal') {
      if (WIDE.matches) prefs.term = open; else prefs.termN = open;
      savePrefs();
    } else if (name === 'gemini') {
      if (WIDE.matches) { prefs.right = open; savePrefs(); }
      else if (open) state.overlay = 'right';
      else if (state.overlay === 'right') state.overlay = null;
    } else if (LEFT_VIEWS.includes(name)) {
      if (open) {
        prefs.leftView = name;
        if (WIDE.matches) prefs.left = true; else state.overlay = 'left';
      } else if (prefs.leftView === name) {
        if (WIDE.matches) prefs.left = false; else if (state.overlay === 'left') state.overlay = null;
      }
      savePrefs();
    }
    applyLayout();
    if (!open) return;
    if (name === 'gemini' || name === 'openrouter') afterOpenAI(name);
    else if (name === 'explorer') renderFiles();
    else if (name === 'search') { sr.input.focus(); sr.input.select(); }
    else if (name === 'git') renderGit();
    else if (name === 'workflow') renderWorkflow();
  }

  const togglePanel = (name) => setPanel(name, !isOpen(name));

  function resetLayout() {
    prefs.lw = PREF_DEFAULTS.lw;
    prefs.rw = PREF_DEFAULTS.rw;
    prefs.th = PREF_DEFAULTS.th;
    savePrefs();
    applyLayout();
  }

  // Barra de arrastre (ratón, tacto y teclado)
  function makeHandle(el, o) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* se ignora */ }
      const start = o.axis === 'x' ? e.clientX : e.clientY;
      const base = o.get();
      let raf = 0;
      let delta = 0;
      document.body.classList.add('resizing', o.axis);
      el.classList.add('drag');
      const move = (ev) => {
        delta = (o.axis === 'x' ? ev.clientX : ev.clientY) - start;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; o.set(clamp(base + o.dir * delta, o.min(), o.max())); });
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        document.body.classList.remove('resizing', 'x', 'y');
        el.classList.remove('drag');
        savePrefs();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('dblclick', () => { o.set(o.def); savePrefs(); });
    el.addEventListener('keydown', (e) => {
      const keys = o.axis === 'x' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      o.set(clamp(o.get() + o.dir * keys[e.key] * (e.shiftKey ? 48 : 16), o.min(), o.max()));
      savePrefs();
    });
  }

  function setupHandles() {
    const total = () => els.wb.clientWidth;
    makeHandle($('h-left'), {
      axis: 'x', dir: 1, def: PREF_DEFAULTS.lw, get: () => prefs.lw,
      min: () => 200, max: () => Math.max(200, total() - (prefs.right ? prefs.rw : 0) - 340),
      set: (v) => { prefs.lw = v; els.wb.style.setProperty('--lw', v + 'px'); syncGutter(); }
    });
    makeHandle($('h-right'), {
      axis: 'x', dir: -1, def: PREF_DEFAULTS.rw, get: () => prefs.rw,
      min: () => 200, max: () => Math.max(200, total() - (prefs.left ? prefs.lw : 0) - 340),
      set: (v) => { prefs.rw = v; els.wb.style.setProperty('--rw', v + 'px'); syncGutter(); }
    });
    makeHandle($('h-term'), {
      axis: 'y', dir: -1, def: PREF_DEFAULTS.th, get: () => prefs.th,
      min: () => 80, max: () => Math.max(80, els.center.clientHeight - 150),
      set: (v) => { prefs.th = v; els.center.style.setProperty('--th', v + 'px'); syncGutter(); }
    });
  }

  // ---------------------------------------------------------------
  // Menús y herramientas
  // ---------------------------------------------------------------
  let deferredInstall = null;
  const hasEditor = () => !!(state.current && !state.current.binary);

  const MENUS = [
    { label: 'File', items: [
      { label: 'New file', action: 'new' },
      { label: 'File explorer', action: 'files', key: 'Ctrl+B', checked: () => state.filesOpen },
      { label: 'Save…', action: 'save', key: 'Ctrl+S', disabled: () => !hasEditor() },
      { label: 'Save as… (on my device)', action: 'save-as', key: 'Ctrl+Shift+S', disabled: () => !hasEditor() },
      { label: 'Save all (in the app)', action: 'save-all', disabled: () => !state.files.length },
      { label: 'Autosave (off = you save)', action: 'autosave', checked: () => state.autosave },
      '-',
      { label: 'Open from my device…', action: 'open-device' },
      { label: 'Import files, .zip or copy…', action: 'import' },
      { label: 'Import folder…', action: 'import-dir' },
      '-',
      { label: 'Export current file', action: 'export', disabled: () => !state.current },
      { label: 'Export everything (.zip)', action: 'export-zip', disabled: () => !state.files.length },
      { label: 'Export backup (.json)', action: 'export-backup', disabled: () => !state.files.length },
      '-',
      { label: 'Rename or move…', action: 'rename', disabled: () => !state.current },
      { label: 'Duplicate', action: 'duplicate', disabled: () => !state.current },
      { label: 'Close tab', action: 'close-tab', disabled: () => !state.current },
      { label: 'Delete file', action: 'delete', danger: true, disabled: () => !state.current },
      { label: 'Install app', action: 'install', hidden: () => !deferredInstall }
    ] },
    { label: 'Edit', items: [
      { label: 'Undo', action: 'undo', key: 'Ctrl+Z', disabled: () => !hasEditor() },
      { label: 'Redo', action: 'redo', key: 'Ctrl+Y', disabled: () => !hasEditor() },
      '-',
      { label: 'Cut', action: 'cut', key: 'Ctrl+X', disabled: () => !hasEditor() },
      { label: 'Copy', action: 'copy', key: 'Ctrl+C', disabled: () => !state.current },
      { label: 'Paste', action: 'paste', key: 'Ctrl+V', disabled: () => !hasEditor() },
      '-',
      { label: 'Find', action: 'find', key: 'Ctrl+F', disabled: () => !hasEditor() },
      { label: 'Replace', action: 'replace', key: 'Ctrl+H', disabled: () => !hasEditor() },
      { label: 'Go to line…', action: 'goto', key: 'Ctrl+G', disabled: () => !hasEditor() },
      '-',
      { label: 'Comment / uncomment line', action: 'comment', key: 'Ctrl+/', disabled: () => !hasEditor() },
      { label: 'Format document', action: 'format', key: 'Shift+Alt+F', disabled: () => !hasEditor() },
      { label: 'Local history…', action: 'history', disabled: () => !hasEditor() },
      { label: 'AI suggestion', action: 'ai-suggest', key: 'Alt+Enter', disabled: () => !hasEditor() },
      { label: 'Suggest with AI when pausing (automatic)', action: 'toggle-aiauto', checked: () => !!prefs.aiauto }
    ] },
    { label: 'Selection', items: [
      { label: 'Select all', action: 'select-all', key: 'Ctrl+A', disabled: () => !state.current },
      { label: 'Select line', action: 'select-line', disabled: () => !hasEditor() },
      '-',
      { label: 'Duplicate line', action: 'dup-line', key: 'Ctrl+Shift+D', disabled: () => !hasEditor() },
      { label: 'Delete line', action: 'del-line', key: 'Ctrl+Shift+K', disabled: () => !hasEditor() },
      { label: 'Move line up', action: 'move-up', key: 'Alt+↑', disabled: () => !hasEditor() },
      { label: 'Move line down', action: 'move-down', key: 'Alt+↓', disabled: () => !hasEditor() },
      '-',
      { label: 'Increase indent', action: 'indent', key: 'Tab', disabled: () => !hasEditor() },
      { label: 'Decrease indent', action: 'outdent', key: 'Shift+Tab', disabled: () => !hasEditor() }
    ] },
    { label: 'Project', items: [
      { label: 'Projects…', action: 'projects' },
      { label: 'New project…', action: 'new-project' },
      { label: 'Open Chromebook folder…', action: 'open-folder' },
      { label: 'Reload from folder', action: 'sync-project', disabled: () => !(state.project && state.project.link) },
      '-',
      { label: 'Open file…', action: 'quick-open', key: 'Ctrl+P' },
      { label: 'Search in all files…', action: 'search-files', key: 'Ctrl+Shift+F' },
      { label: 'Command palette…', action: 'palette', key: 'Ctrl+Shift+P' },
      '-',
      { label: 'Source control (GitHub)…', action: 'git', key: 'Ctrl+Shift+G', checked: () => isOpen('git') },
      { label: 'HTML preview', action: 'preview', checked: () => previewOpen() }
    ] },
    { label: 'View', items: [
      { label: 'File explorer', action: 'explorer', checked: () => isOpen('explorer') },
      { label: 'Left sidebar', action: 'toggle-left', key: 'Ctrl+B', checked: () => leftOpen() },
      { label: 'Search in files', action: 'search', key: 'Ctrl+Shift+F', checked: () => isOpen('search') },
      { label: 'Source control', action: 'git', key: 'Ctrl+Shift+G', checked: () => isOpen('git') },
      { label: 'Workflows and rules', action: 'workflow', checked: () => isOpen('workflow') },
      { label: 'OpenRouter 1 (left)', action: 'openrouter', checked: () => isOpen('openrouter') },
      { label: 'OpenRouter 2 (right column)', action: 'gemini', checked: () => isOpen('gemini') },
      { label: 'Terminal', action: 'terminal', key: 'Ctrl+`', checked: () => isOpen('terminal') },
      '-',
      { label: 'Word wrap', action: 'wrap', key: 'Alt+Z', checked: () => prefs.wrap },
      { label: 'Syntax highlighting', action: 'toggle-hl', checked: () => prefs.hl !== false },
      { label: 'HTML preview', action: 'preview', checked: () => previewOpen() },
      { label: 'Appearance: themes, colors and font…', action: 'appearance' },
      { label: 'Autocomplete', action: 'toggle-ac', checked: () => prefs.ac !== false },
      { label: 'Increase font size', action: 'font-up', key: 'Ctrl+=' },
      { label: 'Decrease font size', action: 'font-down', key: 'Ctrl+-' },
      { label: 'Default font size', action: 'font-reset' },
      '-',
      { label: 'Reset panel sizes', action: 'reset-layout' }
    ] },
    { label: 'Run', items: [
      { label: 'Show / hide terminal', action: 'terminal', key: 'Ctrl+`', checked: () => isOpen('terminal') },
      { label: 'Focus the terminal input', action: 'term-focus' },
      { label: 'Terminal commands (help)', action: 'term-help' },
      { label: 'Run current file', action: 'run', key: 'Ctrl+Enter', disabled: () => !state.current },
      { label: 'Stop execution', action: 'stop' },
      { label: 'Clear terminal', action: 'term-clear' },
    ] },
    { label: 'AI', items: [
      { label: 'OpenRouter 2', action: 'gemini', checked: () => isOpen('gemini') },
      { label: 'OpenRouter 1', action: 'openrouter', checked: () => isOpen('openrouter') },
      '-',
      { label: 'Choose OpenRouter model…', action: 'or-models' },
      { label: 'Workflows and rules', action: 'workflow', checked: () => isOpen('workflow') },
      '-',
      { label: 'API settings…', action: 'settings' },
      { label: 'Unlock keys…', action: 'unlock-keys', disabled: () => sec.state === 'open' },
      { label: 'Lock keys', action: 'lock-keys', disabled: () => sec.state !== 'open' }
    ] },
    { label: 'Help', items: [
      { label: 'Keyboard shortcuts', action: 'shortcuts' },
      { label: 'Terminal commands', action: 'term-help' },
      { label: 'About CodeCraft', action: 'about' }
    ] }
  ];

  let openMenuIdx = -1;
  let hoverOpenedAt = 0;

  function buildMenus() {
    MENUS.forEach((m, i) => {
      const ul = h('ul', { class: 'dropdown-menu', role: 'menu', id: 'menu-' + i });
      m.items.forEach((it) => {
        if (it === '-') { ul.appendChild(h('li', { role: 'separator', class: 'sep' })); return; }
        const b = h('button', { type: 'button', role: it.checked ? 'menuitemcheckbox' : 'menuitem', 'data-action': it.action, class: it.danger ? 'danger' : '' },
          h('span', { class: 'mi-check' }), h('span', { text: it.label }), h('span', { class: 'mi-key', text: it.key || '' }));
        const li = h('li', { role: 'none' }, b);
        li._entry = it;
        ul.appendChild(li);
      });
      const trigger = h('button', { class: 'menu-trigger', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'menu-' + i, text: m.label });
      trigger.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && openMenuIdx !== -1 && openMenuIdx !== i) { openMenu(i, false); hoverOpenedAt = performance.now(); } });
      els.menubar.appendChild(h('div', { class: 'menu-container' }, trigger, ul));
    });
  }

  function refreshMenu(ul) {
    ul.querySelectorAll('li').forEach((li) => {
      const it = li._entry;
      if (!it) return;
      li.hidden = !!(it.hidden && it.hidden());
      const b = li.firstChild;
      b.disabled = !!(it.disabled && it.disabled());
      const on = !!(it.checked && it.checked());
      b.firstChild.textContent = on ? '✓' : '';
      if (it.checked) b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function openMenu(i, focusFirst) {
    closeMenus();
    const c = els.menubar.children[i];
    if (!c) return;
    const t = c.querySelector('.menu-trigger');
    const ul = c.querySelector('.dropdown-menu');
    refreshMenu(ul);
    const r = t.getBoundingClientRect();
    ul.style.top = (r.bottom + 4) + 'px';
    ul.style.maxHeight = Math.max(160, window.innerHeight - r.bottom - 12) + 'px';
    ul.style.left = Math.max(8, Math.min(r.left, window.innerWidth - ul.offsetWidth - 8)) + 'px';
    t.classList.add('active');
    t.setAttribute('aria-expanded', 'true');
    ul.classList.add('show');
    openMenuIdx = i;
    if (focusFirst) { const b = ul.querySelector('li:not([hidden]) button:not(:disabled)'); if (b) b.focus(); }
  }

  function closeMenus() {
    els.menubar.querySelectorAll('.menu-trigger').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-expanded', 'false'); });
    els.menubar.querySelectorAll('.dropdown-menu').forEach((m) => m.classList.remove('show'));
    openMenuIdx = -1;
  }

  function menuKey(e) {
    const c = els.menubar.children[openMenuIdx];
    if (!c) return false;
    const items = [...c.querySelectorAll('li:not([hidden]) button:not(:disabled)')];
    const idx = items.indexOf(document.activeElement);
    const n = MENUS.length;
    if (e.key === 'ArrowDown') { (items[(idx + 1) % items.length] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { (items[(idx - 1 + items.length) % items.length] || items[items.length - 1]).focus(); }
    else if (e.key === 'Home') items[0].focus();
    else if (e.key === 'End') items[items.length - 1].focus();
    else if (e.key === 'ArrowRight') openMenu((openMenuIdx + 1) % n, true);
    else if (e.key === 'ArrowLeft') openMenu((openMenuIdx - 1 + n) % n, true);
    else if (e.key === 'Escape') { const t = c.querySelector('.menu-trigger'); closeMenus(); t.focus(); }
    else return false;
    e.preventDefault();
    return true;
  }

  function buildQuickTools() {
    const mk = (id, ico, label, action, title) =>
      h('button', { class: 'tool-btn', type: 'button', id: 'qt-' + id, 'data-action': action, title, 'aria-label': title },
        icon(ico), label ? h('span', { class: 'lbl', text: label }) : null);
    els.quick.append(
      mk('save', 'save', 'Save', 'save', 'Save (Ctrl+S)'),
      mk('run', 'play', 'Run', 'run', 'Run the current file (Ctrl+Enter): .js in the browser, .html in the preview'),
      mk('find', 'search', '', 'find', 'Find (Ctrl+F)'),
      mk('preview', 'eye', 'Preview', 'preview', 'Project preview'),
      mk('gemini', 'router', 'OpenRouter 2', 'gemini', 'OpenRouter 2 panel'),
      mk('openrouter', 'router', 'OpenRouter 1', 'openrouter', 'OpenRouter 1 panel'),
      h('span', { class: 'tool-sep', 'aria-hidden': 'true' }),
      mk('L', 'pleft', '', 'toggle-left', 'Show or hide the left sidebar (Ctrl+B)'),
      mk('B', 'pbottom', '', 'terminal', 'Show or hide the output panel (Ctrl+`)'),
      mk('R', 'pright', '', 'toggle-right', 'Show or hide the right column (OpenRouter 2)')
    );
    $('btn-files').appendChild(icon('files'));
    document.querySelectorAll('[data-action="toggle-left"].icon-btn').forEach((b) => b.appendChild(icon('x')));
    $('tab-actions').append(
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'new', 'aria-label': 'New file', title: 'New file' }, icon('plus'))
    );
    const db = $('drawer-actions');
    const tb = (ic, label, fn, id) => h('button', { class: 'icon-btn sm', type: 'button', id, 'aria-label': label, title: label, onclick: (e) => { e.stopPropagation(); fn(e); } }, ic);
    db.append(
      h('button', { class: 'ex-root-name', type: 'button', title: 'Collapse or expand the project tree', onclick: () => { ex.rootOpen = !ex.rootOpen; renderFiles(); } },
        h('span', { id: 'ex-root-chev', text: '▾' }), h('span', { id: 'ex-root-label', text: 'PROJECT' })),
      h('span', { class: 'ex-tools' },
        tb(icon('plus'), 'New file', () => startCreate('file', exSelDir())),
        tb(icon('folderplus'), 'New folder', () => startCreate('dir', exSelDir())),
        tb(h('span', { text: '↻' }), 'Reload from folder', () => syncProject(false), 'ex-refresh'),
        tb(icon('chevrons'), 'Collapse all folders', () => actions['collapse-all']()),
        tb(h('span', { text: '⋯' }), 'More actions', (e) => { const r = e.currentTarget.getBoundingClientRect(); showCtx(ctxItemsFor('d:'), r.left - 160, r.bottom + 2); })));
    db.addEventListener('contextmenu', (e) => { e.preventDefault(); showCtx(ctxItemsFor('d:'), e.clientX, e.clientY); });
    const pvSel = (opts, cur, title, fn) => { const sel = h('select', { class: 'pv-sel', title, 'aria-label': title }); opts.forEach(([v, t]) => { const o = h('option', { text: t }); o.value = String(v); sel.append(o); }); sel.value = String(cur); sel.addEventListener('change', () => fn(sel.value)); return sel; };
    $('preview-btns').append(
      pvSel([[0, 'Responsive'], [390, 'Mobile 390'], [820, 'Tablet 820'], [1280, 'Laptop 1280']], prefs.pdev || 0, 'Screen size', (v) => { prefs.pdev = +v; savePrefs(); applyPreviewDevice(); }),
      pvSel([['safe', 'Safe'], ['full', 'Full']], prefs.pvmode, 'Safe: isolated, cannot touch your keys. Full: runs with the same access as the app (for multi-file ES modules)', (v) => { prefs.pvmode = v; savePrefs(); if (v === 'full') { store.get('cc_preview_ok') === 'yes' || (window.confirm('Full preview gives your project the SAME access as the app (including saved data). Only use it with code you trust.\n\nContinue?') ? store.set('cc_preview_ok', 'yes') : (prefs.pvmode = 'safe', savePrefs())); } refreshPreview(); }),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'preview-refresh', 'aria-label': 'Refresh', title: 'Refresh' }, h('span', { text: '↻' })),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'preview-open', 'aria-label': 'Open in a tab', title: 'Open in a new tab' }, h('span', { text: '↗' })),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'preview', 'aria-label': 'Close preview', title: 'Close' }, icon('x'))
    );
    $('term-btns').append(
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'run', 'aria-label': 'Run current file', title: 'Run current file' }, icon('play')),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'stop', 'aria-label': 'Stop', title: 'Stop execution' }, icon('stop')),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'term-clear', 'aria-label': 'Clear output', title: 'Clear output' }, icon('clear')),
      h('button', { class: 'icon-btn', type: 'button', 'data-action': 'terminal', 'aria-label': 'Close output', title: 'Close output' }, icon('x'))
    );
  }

  function buildActivityBar() {
    const defs = [['explorer', 'files', 'Explorer (Ctrl+B)'], ['search', 'search', 'Search in files (Ctrl+Shift+F)'], ['git', 'branch', 'Source control / GitHub (Ctrl+Shift+G)'], ['workflow', 'flow', 'Workflows and rules'], ['openrouter', 'router', 'OpenRouter 1']];
    defs.forEach(([v, ic, t]) => {
      const b = h('button', { class: 'act-btn', type: 'button', id: 'act-' + v, title: t, 'aria-label': t, 'aria-pressed': 'false', onclick: () => togglePanel(v) }, icon(ic));
      if (v === 'git') b.appendChild(h('span', { class: 'act-badge', id: 'git-badge', hidden: true }));
      els.act.appendChild(b);
    });
    els.act.appendChild(h('div', { class: 'act-spacer' }));
    els.act.appendChild(h('button', { class: 'act-btn', type: 'button', title: 'Appearance: themes, colors and font', 'aria-label': 'Appearance', 'data-action': 'appearance' }, icon('palette')));
    els.act.appendChild(h('button', { class: 'act-btn', type: 'button', title: 'API settings', 'aria-label': 'API settings', 'data-action': 'settings' }, icon('gear')));
  }

  function syncToggles() {
    const set = (id, v) => { const b = $(id); if (b) b.setAttribute('aria-pressed', v ? 'true' : 'false'); };
    set('qt-B', isOpen('terminal'));
    set('qt-L', leftOpen());
    set('qt-R', isOpen('gemini'));
    LEFT_VIEWS.forEach((v) => set('act-' + v, isOpen(v)));
    set('qt-preview', previewOpen());
    set('qt-gemini', isOpen('gemini'));
    set('qt-openrouter', isOpen('openrouter'));
    set('btn-files', isOpen('explorer'));
    const run = $('qt-run');
    if (run) run.disabled = !state.current;
    const save = $('qt-save');
    if (save) save.disabled = !hasEditor();
    els.stTerm.textContent = isOpen('terminal') ? 'Output ▾' : 'Output ▴';
  }

  const SHORTCUTS = [
    ['Save (asks where the first time)', 'Ctrl+S'], ['Save as… on the device', 'Ctrl+Shift+S'], ['Show / hide sidebar', 'Ctrl+B'], ['Source control (GitHub)', 'Ctrl+Shift+G'], ['Show / hide terminal', 'Ctrl+` (or Ctrl+ñ)'],
    ['Quick open file', 'Ctrl+P'], ['Command palette', 'Ctrl+Shift+P'], ['Search in all files', 'Ctrl+Shift+F'], ['Find', 'Ctrl+F'], ['Replace', 'Ctrl+H'], ['Go to line', 'Ctrl+G'],
    ['Comment / uncomment', 'Ctrl+/'], ['Duplicate line', 'Ctrl+Shift+D'], ['Delete line', 'Ctrl+Shift+K'],
    ['Move line', 'Alt+↑ / Alt+↓  ·  Ctrl+Shift+↑ / ↓'], ['Indent', 'Tab / Shift+Tab'],
    ['Terminal: history · complete · stop · clear', '↑ ↓ · Tab · Ctrl+C · Ctrl+L'], ['Run a terminal command from the palette', 'Ctrl+P, then type $ and the command'],
    ['Run .js file', 'Ctrl+Enter'], ['Word wrap', 'Alt+Z'], ['Font size', 'Ctrl+= / Ctrl+-'],
    ['Adjust panels', 'Drag the bars · double tap = reset · arrow keys with the bar focused']
  ];

  // ---------------------------------------------------------------
  // Guardar: tú decides cuándo y dónde
  // ---------------------------------------------------------------
  let toastTimer = null;
  function toast(text, kind) {
    const t = $('toast');
    t.textContent = text;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
    setSave(text.length > 60 ? text.slice(0, 57) + '…' : text);
  }

  async function getHandle(id) {
    if (state.handles.has(id)) return state.handles.get(id);
    if (!state.dbOK) return null;
    try { const r = await idb.get('meta', 'h:' + id); if (r && r.handle) state.handles.set(id, r.handle); return r && r.handle ? r.handle : null; } catch (_) { return null; }
  }

  async function writeHandle(h, text) {
    const opts = { mode: 'readwrite' };
    if (h.queryPermission && (await h.queryPermission(opts)) !== 'granted') {
      if (!h.requestPermission || (await h.requestPermission(opts)) !== 'granted') throw new Error('permission denied');
    }
    const w = await h.createWritable();
    await w.write(text);
    await w.close();
  }

  function askSaveTarget(meta) {
    return new Promise((resolve) => {
      const dlg = $('save-dlg');
      let result = null;
      $('save-note').textContent = `«${meta.name}» — where do you want to save it?`;
      $('save-app').onclick = () => { result = 'app'; dlg.close(); };
      $('save-device').onclick = () => { result = 'device'; dlg.close(); };
      $('save-cancel').onclick = () => dlg.close();
      dlg.onclose = () => { dlg.onclose = null; resolve(result); };
      dlg.showModal();
    });
  }

  // Guardar como…: elige carpeta y nombre en el dispositivo (o descarga si el navegador no lo permite)
  async function saveAs() {
    if (!hasEditor()) return;
    const meta = state.current;
    const text = els.editor.value;
    const suggested = baseName(meta.name);
    if (window.showSaveFilePicker) {
      let h;
      try { h = await window.showSaveFilePicker({ suggestedName: suggested }); }
      catch (e) { if (e && e.name === 'AbortError') return; throw e; }
      await writeHandle(h, text);
      state.handles.set(meta.id, h);
      try { await idb.put('meta', { key: 'h:' + meta.id, handle: h }); } catch (_) { /* se ignora */ }
      meta.appOnly = false;
      await saveNow();
      toast(`Saved on your device: ${h.name} (and in the app)`, 'ok');
      return;
    }
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), suggested);
    await saveNow();
    toast(`Downloaded «${suggested}» (your browser chooses or asks for the folder). Also saved in the app.`, 'ok');
  }

  // Guardar (Ctrl+S)
  async function saveFile() { histForce = true; try { await saveFileInner(); } finally { histForce = false; } }
  async function saveFileInner() {
    if (!hasEditor()) { toast('There is no text file open to save.', 'err'); return; }
    const meta = state.current;
    const proj = state.project;
    if (proj && proj.link) {
      try {
        await linkedWrite(proj, meta.name, els.editor.value);
        await saveNow();
        toast(`Saved in ${'your folder'}: ${meta.name} (and in the app)`, 'ok');
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        await saveNow();
        toast('Saved in the app, but NOT in ' + 'the folder' + ': ' + ((e && e.message) || e), 'err');
      }
      return;
    }
    const handle = await getHandle(meta.id);
    if (handle) {
      try {
        await writeHandle(handle, els.editor.value);
        await saveNow();
        toast(`Saved on your device: ${handle.name} (and in the app)`, 'ok');
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        toast('Could not write to the device file (' + ((e && e.message) || e) + '). It will be saved in the app.', 'err');
        await saveNow();
        return;
      }
    }
    if (!meta.appOnly) {
      const choice = await askSaveTarget(meta);
      if (!choice) return;
      if (choice === 'device') { await saveAs(); return; }
      meta.appOnly = true;
      if (state.dbOK) idb.put('files', meta).catch(() => {});
    }
    await saveNow();
    toast(`Saved in the app: ${meta.name}`, 'ok');
  }

  async function openFromDevice() {
    if (!window.showOpenFilePicker) { els.importInput.click(); return; }
    let hs;
    try { hs = await window.showOpenFilePicker({ multiple: true }); }
    catch (e) { if (e && e.name === 'AbortError') return; throw e; }
    const items = [];
    for (const hd of hs) items.push({ blob: await hd.getFile(), path: hd.name, handle: hd });
    await importFiles(items);
  }

  // ---------------------------------------------------------------
  // Acciones de menú
  // ---------------------------------------------------------------
  function updateAutosave() { store.set('cc_autosave', state.autosave ? 'on' : 'off'); }
  let lastSel = [0, 0];
  // Chrome deja el editor "enfocado" pero sin aceptar teclas tras cerrar un diálogo: se desenfoca y se vuelve a enfocar
  function restoreEditorFocus() {
    if (!hasEditor()) return;
    const a = document.activeElement;
    if (a && a !== document.body && a !== els.editor) return;
    const [s, t] = lastSel;
    const e = els.editor;
    e.blur();
    e.focus({ preventScroll: true });
    const max = e.value.length;
    e.setSelectionRange(Math.min(s, max), Math.min(t, max));
  }
  const focusEd = () => { if (hasEditor()) els.editor.focus(); };

  const actions = {
    async new() {
      const name = await askName('New file (you can use folders: src/app.js)', DEFAULT_NAME);
      if (name === null) return;
      const clean = normalizePath(name);
      const ex = state.files.find((f) => f.name === clean);
      if (ex) { await openFile(ex.id); } else { await switchToNewFile(clean, ''); }
      if (!WIDE.matches) setPanel('explorer', false);
      focusEd();
    },
    files() { togglePanel('explorer'); },
    explorer() { togglePanel('explorer'); },
    search() { togglePanel('search'); },
    git() { togglePanel('git'); },
    'toggle-left'() { setPanel(prefs.leftView, !leftOpen()); },
    'toggle-right'() { togglePanel('gemini'); },
    async save() { await saveFile(); },
    async 'save-as'() { await saveAs(); },
    async 'save-all'() { await saveAll(); toast('Everything saved in the app', 'ok'); },
    async 'open-device'() { await openFromDevice(); },
    async autosave() {
      state.autosave = !state.autosave;
      updateAutosave();
      if (state.autosave) { await saveAll(); toast('Autosave ON: saves automatically in the app', 'ok'); }
      else { clearTimeout(state.saveTimer); toast('Autosave off: you save with Ctrl+S', 'ok'); }
    },
    async rename() { await renamePrompt(state.current); },
    async duplicate() { const m = await duplicateFile(state.current); if (m) { await openFile(m.id); } },
    async 'close-tab'() { if (state.current) await closeTab(state.current.id); },
    async delete() { if (state.current) await deleteFiles([state.current.id], true); },
    async export() { await exportCurrent(); },
    async 'export-zip'() { await exportZip(); },
    async 'export-backup'() { await exportBackup(); },
    import() { els.importInput.click(); },
    'import-dir'() { els.importDir.click(); },
    undo() { focusEd(); document.execCommand('undo'); },
    redo() { focusEd(); document.execCommand('redo'); },
    cut() { copySelection(true); },
    copy() { copySelection(false); },
    paste() { pasteClipboard(); },
    find() { openFind(false); },
    replace() { openFind(true); },
    goto() { gotoLine(); },
    format() { formatDoc(); },
    history() { return historyDialog(); },
    problems() { showProblem(); },
    comment() { edit.comment(); },
    'select-all'() { els.editor.focus(); els.editor.select(); schedulePos(); },
    'select-line'() { const b = lineBounds(); els.editor.focus(); els.editor.setSelectionRange(b.ls, Math.min(b.v.length, b.le + 1)); schedulePos(); },
    'dup-line'() { edit.duplicate(); },
    'del-line'() { edit.remove(); },
    'move-up'() { edit.move(-1); },
    'move-down'() { edit.move(1); },
    indent() { focusEd(); edit.indent(false); },
    outdent() { focusEd(); edit.indent(true); },
    gemini() { togglePanel('gemini'); },
    openrouter() { togglePanel('openrouter'); },
    terminal() { togglePanel('terminal'); if (isOpen('terminal')) setTimeout(tmFocus, 60); },
    'term-focus'() { if (!isOpen('terminal')) setPanel('terminal', true); setTimeout(tmFocus, 60); },
    'term-help'() { return termExecLine('help'); },
    wrap() { setWrap(!prefs.wrap); },
    'font-up'() { setFont(prefs.fs + 1); },
    'font-down'() { setFont(prefs.fs - 1); },
    'font-reset'() { setFont(PREF_DEFAULTS.fs); },
    'reset-layout'() { resetLayout(); },
    async run() { await runCurrent2(); },
    stop() { stopRun(true); },
    'term-clear'() { term.out.replaceChildren(); },
    settings() { openSettings(); },
    shortcuts() {
      showInfo('Keyboard shortcuts', SHORTCUTS.map(([a, b]) => h('div', { class: 'kb-row' }, h('span', { text: a }), h('kbd', { text: b }))));
    },
    about() {
      showInfo('CodeCraft', [
        h('p', { text: 'Personal, offline, low-resource code editor: HTML, CSS and JavaScript with no dependencies.' }),
        h('p', { text: 'Three columns (OpenRouter 1 · code and terminal · OpenRouter 2) with adjustable sizes. Your files live only on this device (IndexedDB) and your keys are never in the code.' })
      ]);
    },
    projects() { return projectDialog(); },
    async 'new-project'() { const n = await askName('Project name', ''); if (n && n.trim()) await createProject(n, null); },
    'open-folder'() { return openFolderProject(); },
    'sync-project'() { return syncProject(false); },
    'quick-open'() { openPalette(''); },
    palette() { openPalette('>'); },
    'search-files'() { openSearch(); },
    github() { setPanel('git', true); },
    preview() { setPreview(!previewOpen()); },
    'preview-refresh'() { refreshPreview(); },
    'preview-open'() {
      if (prefs.pvmode !== 'full') { toast('The safe preview stays inside the app. Switch to Full to open it in its own tab.', 'err'); return; }
      const e = previewEntry();
      if (!e) { toast('There is no .html file in the project.', 'err'); return; }
      window.open(new URL('./__preview/', location.href).href + encodeURIComponent(state.project.id) + '/' + e.split('/').map(encodeURIComponent).join('/'), '_blank', 'noopener');
    },
    'toggle-hl'() { prefs.hl = prefs.hl === false; savePrefs(); updateHLState(); },
    appearance() { appearanceDialog(); },
    'ai-suggest'() { focusEd(); sugRequest(true); },
    'toggle-aiauto'() { prefs.aiauto = !prefs.aiauto; savePrefs(); sugClose(); toast('AI suggestions on pause ' + (prefs.aiauto ? 'ON (uses your AI quota)' : 'OFF'), 'ok'); },
    'toggle-ac'() { prefs.ac = prefs.ac === false; savePrefs(); acClose(); toast('Autocomplete ' + (prefs.ac ? 'ON' : 'OFF'), 'ok'); },
    workflow() { togglePanel('workflow'); },
    'or-models'() { orPicker(); },
    'unlock-keys'() { return ensureVault(); },
    'lock-keys'() { secLock(); },
    'new-folder'() { return newFolder(); },
    'new-file-here'() { startCreate('file', exSelDir()); },
    'collapse-all'() { state.closedDirs = new Set(allDirPaths()); saveClosed(); renderFiles(); },
    'expand-all'() { state.closedDirs = new Set(); ex.rootOpen = true; saveClosed(); renderFiles(); },
    async install() {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (_) { /* nada */ }
      deferredInstall = null;
    }
  };

  function runAction(name) {
    const fn = actions[name];
    if (!fn) return;
    Promise.resolve().then(fn).catch((err) => { setSave('Unexpected error'); if (term && term.out) tprint('Error: ' + ((err && err.message) || err), 'err'); });
  }

  // ---------------------------------------------------------------
  // IA: errores, llamadas fetch y chat
  // ---------------------------------------------------------------
  class AIError extends Error {}

  async function readJson(res) {
    try { return await res.json(); } catch (_) { return null; }
  }

  function httpError(res, data, provider) {
    const detail = String((data && data.error && data.error.message) || (data && data.message) || '').slice(0, 200);
    let base;
    if (res.status === 400) base = 'The request was rejected (400). Check the model or the content sent.';
    else if (res.status === 401 || res.status === 403) base = 'Invalid key or missing permissions. Check it in AI → API settings.';
    else if (res.status === 404) base = provider === 'gemini'
      ? 'Model not available. Choose it again in the selector and press ↻ to load the current models.'
      : 'Model not found. Check the model name in the OpenRouter panel.';
    else if (res.status === 429) base = 'Usage limit reached. Wait a moment and try again.';
    else if (res.status >= 500) base = 'The AI service is not available right now. Try again later.';
    else base = `Unexpected service error (${res.status}).`;
    const err = new AIError(detail ? `${base}\n${detail}` : base);
    err.status = res.status;
    return err;
  }

  async function callGemini(messages, signal, system) {
    const key = secret('gemini_key').trim();
    if (!key) throw new AIError('Gemini key is missing. Go to AI → API settings.');
    const model = (store.get('gemini_model') || PROVIDERS.gemini.defaultModel).trim();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system || SYSTEM_PROMPT }] },
          contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }))
        }),
        signal
      }
    );
    const data = await readJson(res);
    if (!res.ok) throw httpError(res, data, 'gemini');
    const cand = data && data.candidates && data.candidates[0];
    const parts = cand && cand.content && cand.content.parts;
    const text = parts ? parts.map((p) => p.text || '').join('') : '';
    if (!text) {
      const reason = (data && data.promptFeedback && data.promptFeedback.blockReason) || (cand && cand.finishReason);
      throw new AIError('The AI returned no text' + (reason ? ` (${reason}).` : '.'));
    }
    return text;
  }

  // ---- Lista de modelos Gemini: se lee en vivo de la cuenta del usuario ----
  function modelRank(id) {
    const m = id.match(/gemini-(\d+(?:\.\d+)?)/);
    const version = m ? parseFloat(m[1]) : 0;
    const tier = /flash-lite/.test(id) ? 3 : /flash/.test(id) ? 2 : /pro/.test(id) ? 1 : 4;
    const unstable = /(preview|exp)/.test(id) ? 1 : 0;
    return { version, tier, unstable };
  }

  function pickChatModels(models) {
    const out = [];
    (models || []).forEach((m) => {
      const id = String(m.name || '').replace(/^models\//, '');
      const methods = m.supportedGenerationMethods || [];
      if (!/^gemini-/.test(id) || !methods.includes('generateContent') || EXCLUDE_MODELS.test(id)) return;
      const label = m.displayName && m.displayName !== id ? `${m.displayName} (${id})` : id;
      out.push({ id, label });
    });
    out.sort((a, b) => {
      const aa = /-latest$/.test(a.id) ? 0 : 1;
      const bb = /-latest$/.test(b.id) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      const ra = modelRank(a.id);
      const rb = modelRank(b.id);
      return (rb.version - ra.version) || (ra.unstable - rb.unstable) || (ra.tier - rb.tier) || a.id.localeCompare(b.id);
    });
    return out;
  }

  async function fetchGeminiModels() {
    const key = secret('gemini_key').trim();
    if (!key) throw new AIError('First save your Gemini key in API settings.');
    if (!navigator.onLine) throw new AIError('No internet connection.');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
        headers: { 'x-goog-api-key': key },
        signal: ctrl.signal
      });
      const data = await readJson(res);
      if (!res.ok) throw httpError(res, data, 'gemini');
      const list = pickChatModels(data && data.models);
      if (!list.length) throw new AIError('Your account returned no compatible chat models.');
      return list;
    } finally {
      clearTimeout(timer);
    }
  }

  function readModelCache() {
    try {
      const v = JSON.parse(store.get(MODELS_CACHE) || '[]');
      return Array.isArray(v) ? v.filter((m) => m && typeof m.id === 'string') : [];
    } catch (_) { return []; }
  }

  function populateModelSelects() {
    const list = [];
    const current = '';
    [].forEach((sel) => {
      sel.replaceChildren();
      sel.add(new Option('Automatic — latest Flash', ''));
      const seen = new Set(['']);
      list.forEach((m) => {
        if (seen.has(m.id)) return;
        seen.add(m.id);
        sel.add(new Option(m.label || m.id, m.id));
      });
      if (current && !seen.has(current)) sel.add(new Option(`${current} (saved)`, current));
      sel.value = current;
    });
    fillOrSelect();
    updateModelTips();
  }

  async function loadModels() {
    const list = await fetchGeminiModels();
    store.set(MODELS_CACHE, JSON.stringify(list));
    populateModelSelects();
    return list;
  }

  function notify(text, isError) {
    if (els.set.dlg.open) settingsMessage(text, isError);
    else addSystem('gemini', text, isError ? 'error' : 'system');
  }

  async function refreshModels(btn) {
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const typed = els.set.dlg.open ? els.set.gKey.value.trim() : '';
      if (typed) { if (!(await setSecret('gemini_key', typed))) throw new Error('The key was not saved (keys are locked).'); els.set.gKey.value = ''; refreshSettingsHints(); }
      const list = await loadModels();
      const newest = list.find((m) => !/-latest$/.test(m.id));
      notify(`${list.length} models loaded` + (newest ? `. Newest: ${newest.id}` : '.'), false);
    } catch (err) {
      notify(friendlyError(err, false), true);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  async function callOpenRouter(messages, signal, system, provider) {
    const key = secret('openrouter_key').trim();
    if (!key) throw new AIError('OpenRouter key is missing. Go to AI → API settings.');
    const model = (store.get(PROVIDERS[provider || 'openrouter'].modelName) || 'openrouter/auto').trim();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system || SYSTEM_PROMPT }].concat(
          messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
        )
      }),
      signal
    });
    const data = await readJson(res);
    if (!res.ok) throw httpError(res, data, 'openrouter');
    if (data && data.error) throw new AIError(String(data.error.message || 'Service error').slice(0, 200));
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new AIError('The AI returned no text.');
    return text;
  }

  const callAI = (provider, history, signal, system) => callOpenRouter(history, signal, system, provider);

  // Si un asistente llega a su límite (429) o falla (5xx), prueba con el otro (si lo permites en Ajustes)
  async function callWithFallback(provider, history, signal, system) {
    try {
      return { text: await callAI(provider, history, signal, system), by: provider };
    } catch (err) {
      throw err;
    }
  }

  function friendlyError(err, timedOut) {
    if (timedOut) return 'The AI took too long (60 s). Try again.';
    if (err && err.name === 'AbortError') return 'Request cancelled.';
    if (err instanceof AIError) return err.message;
    if (err instanceof TypeError) return 'Could not connect to the AI service. Check your internet connection.';
    return 'Unexpected error: ' + ((err && err.message) || err);
  }

  function hasKey(provider) {
    return !!secret(PROVIDERS[provider].keyName).trim();
  }

  function scrollChat(provider) { const b = ui[provider].chat; b.scrollTop = b.scrollHeight; }

  function addSystem(provider, text, cls) {
    const d = h('div', { class: 'ai-message ' + (cls || 'system'), text });
    ui[provider].chat.appendChild(d);
    return d;
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
    } catch (_) {
      btn.textContent = 'Could not';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
  }

  function replaceWithCode(code) {
    if (!hasEditor()) { toast('Open a text file to replace its content.', 'err'); return; }
    const ed = els.editor;
    if (ed.selectionStart !== ed.selectionEnd) {
      replaceRange(ed.selectionStart, ed.selectionEnd, code, ed.selectionStart, ed.selectionStart + code.length);
    } else if (window.confirm('Nothing is selected. Replace the WHOLE file with this code? (Ctrl+Z undoes it)')) {
      replaceRange(0, ed.value.length, code, 0, 0);
    }
  }

  function fillFreeModels() {
    const dl = ui.openrouter && ui.openrouter.datalist;
    if (!dl) return;
    let list = [];
    try { list = JSON.parse(store.get('or_free_models') || '[]'); } catch (_) { list = []; }
    dl.replaceChildren(...list.map((m) => h('option', { value: m.id, label: `${m.name || m.id} · ${Math.round((m.ctx || 0) / 1000)}k` })));
  }

  async function loadFreeModels() {
    if (!navigator.onLine) throw new AIError('No internet connection.');
    let res;
    try { res = await fetch('https://openrouter.ai/api/v1/models'); } catch (_) { throw new TypeError('red'); }
    const data = await readJson(res);
    if (!res.ok) throw httpError(res, data, 'openrouter');
    const list = ((data && data.data) || [])
      .filter((m) => m && typeof m.id === 'string' && (m.id.endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)))
      .map((m) => ({ id: m.id, name: m.name || m.id, ctx: m.context_length || 0 }))
      .sort((a, b) => b.ctx - a.ctx);
    if (!list.length) throw new AIError('OpenRouter returned no free models right now.');
    store.set('or_free_models', JSON.stringify(list));
    fillFreeModels();
    return list.length;
  }

  function renderRich(container, text) {
    const fence = /```([^\n`]*)\n?([\s\S]*?)```/g;
    const addText = (t) => {
      const s = t.trim();
      if (!s) return;
      container.appendChild(h('p', { text: s }));
    };
    let last = 0;
    let m;
    while ((m = fence.exec(text)) !== null) {
      if (m.index > last) addText(text.slice(last, m.index));
      const info = (m[1] || '').trim();
      const code = m[2].replace(/\n$/, '');
      const isEdit = /^(apply|aplicar)/i.test(info);
      const editPath = isEdit ? (info.split(':')[1] || '').trim() : '';
      const bCopy = h('button', { type: 'button', text: 'Copy' });
      bCopy.addEventListener('click', () => copyText(code, bCopy));
      const closeDrawer = () => { if (!WIDE.matches) { state.overlay = null; applyLayout(); } };
      const bIns = h('button', { type: 'button', text: 'Insert', onclick: () => { if (hasEditor()) { insertAtCursor(code); closeDrawer(); } } });
      const bRep = h('button', { type: 'button', text: 'Replace', title: 'Replaces the selection (or the whole file)', onclick: () => { replaceWithCode(code); closeDrawer(); } });
      const bNew = h('button', { type: 'button', text: 'New file', onclick: async () => { await switchToNewFile(uniqueName(editPath || DEFAULT_NAME), code); closeDrawer(); } });
      if (isEdit) container.appendChild(h('div', { class: 'edit-tag', text: '✎ Change for ' + (editPath || 'the current file') }));
      container.appendChild(h('div', { class: 'code-block' },
        h('div', { class: 'code-actions' }, bCopy, bIns, bRep, bNew),
        h('pre', null, h('code', { text: code }))));
      last = fence.lastIndex;
    }
    if (last < text.length) addText(text.slice(last));
  }

  function appendMsg(provider, m) {
    let div;
    if (m.role === 'user') {
      div = h('div', { class: 'ai-message user', text: m.view != null ? m.view : m.text });
    } else {
      div = h('div', { class: 'ai-message response' });
      renderRich(div, m.text);
    }
    ui[provider].chat.appendChild(div);
    return div;
  }

  function renderChat(provider) {
    const box = ui[provider].chat;
    box.replaceChildren();
    const msgs = state.chats[provider];
    if (!msgs.length) {
      addSystem(provider, hasKey(provider)
        ? 'Type your question. I can include the selection or the current editor file.'
        : 'Your API key is missing. Open it in AI → API settings.');
    } else {
      msgs.forEach((m) => appendMsg(provider, m));
    }
    scrollChat(provider);
  }

  function persistChat(provider) {
    if (!state.dbOK) return;
    idb.put('chat', { provider, messages: state.chats[provider] }).catch(() => {});
  }

  function afterOpenAI(provider) {
    if (!state.chats[provider].length) renderChat(provider);
    
    scrollChat(provider);
    if (WIDE.matches) ui[provider].input.focus({ preventScroll: true });
  }

  function getCodeContext() {
    if (!hasEditor()) return null;
    const ed = els.editor;
    const hasSel = ed.selectionStart !== ed.selectionEnd;
    const start = ed.selectionStart;
    const end = ed.selectionEnd;
    let code = hasSel ? ed.value.slice(start, end) : ed.value;
    if (!code.trim()) return null;
    const original = code;
    let truncated = false;
    if (code.length > MAX_CODE_CHARS) { code = code.slice(0, MAX_CODE_CHARS); truncated = true; }
    return { code, truncated, label: hasSel ? 'selection' : 'whole file', mode: hasSel ? 'selection' : 'file', start, end, text: original, id: state.current.id };
  }

  // @archivo en el mensaje: incluye el contenido de otros archivos del proyecto
  async function mentionedFiles(prompt) {
    const out = [];
    const seen = new Set();
    const re = /@([^\s@,;:()]+)/g;
    let m;
    while ((m = re.exec(prompt)) !== null && out.length < 5) {
      const q = m[1];
      let f = state.files.find((x) => x.name === q);
      if (!f) { const c = state.files.filter((x) => baseName(x.name) === q); if (c.length === 1) f = c[0]; }
      if (!f || f.binary || seen.has(f.id)) continue;
      seen.add(f.id);
      let t = await getText(f);
      if (t.length > MAX_CODE_CHARS) t = t.slice(0, MAX_CODE_CHARS) + '\n… (truncated)';
      out.push({ name: f.name, text: t });
    }
    return out;
  }

  const parseEditBlocks = (text) => {
    const out = [];
    const re = /```[ \t]*(?:apply|aplicar)(?::([^\n`]*))?[^\n`]*\n([\s\S]*?)```/gi;
    let m;
    while ((m = re.exec(text)) !== null) out.push({ path: (m[1] || '').trim() || null, code: m[2].replace(/\n$/, '') });
    return out;
  };

  // Applies to the editor what the AI returned in ```apply blocks (solo si lo activaste en su panel)
  async function applyAIEdits(blocks, ctx) {
    const done = [];
    const skipped = [];
    let usedMain = false;
    let mainApplied = false;
    for (const b of blocks) {
      const target = b.path ? normalizePath(b.path) : null;
      const curName = state.current ? state.current.name : null;
      if (!target || target === curName) {
        if (usedMain) { skipped.push('repeated block for the current file'); continue; }
        usedMain = true;
        if (!hasEditor()) { skipped.push('there is no text file open'); continue; }
        const ed = els.editor;
        if (ctx && ctx.truncated) { skipped.push('the code was too long; use the Replace button on the block'); continue; }
        if (ctx && ctx.id !== state.current.id) { skipped.push('you switched files; use the Replace button'); continue; }
        if (ctx && ctx.mode === 'selection') {
          if (ed.value.slice(ctx.start, ctx.end) !== ctx.text) { skipped.push('the selection changed; use the Replace button'); continue; }
          replaceRange(ctx.start, ctx.end, b.code, ctx.start, ctx.start + b.code.length);
          done.push('selection of ' + curName);
        } else if (ctx) {
          replaceRange(0, ed.value.length, b.code, 0, 0);
          done.push(curName);
        } else {
          insertAtCursor(b.code);
          done.push('code inserted at the cursor');
        }
        mainApplied = true;
        continue;
      }
      const ex = state.files.find((f) => f.name === target);
      if (ex) {
        if (ex.binary) { skipped.push(target + ' is binary'); continue; }
        if (!window.confirm(`The AI wants to modify «${target}».\nAllow? (changes stay unsaved until you save)`)) { skipped.push(target + ' (rejected)'); continue; }
        if (state.autosave) await setText(ex, b.code);
        else { state.buffers.set(ex.id, b.code); persistDrafts(); }
        done.push(target);
      } else {
        await createFileRecord(target, b.code);
        done.push(target + ' (new)');
      }
    }
    renderTabs();
    renderFiles();
    return { done, skipped, mainApplied };
  }

  function buildHistory(provider) {
    const msgs = state.chats[provider].slice(-MAX_CHAT_SENT);
    return msgs.map((m, i) => ({
      role: m.role,
      // Solo el último mensaje lleva el código completo; los anteriores van resumidos
      text: (i === msgs.length - 1 || m.role !== 'user') ? m.text : (m.view != null ? m.view : m.text)
    }));
  }

  function setBusy(provider, b) {
    state.ai[provider].busy = b;
    const s = ui[provider].send;
    s.textContent = b ? 'Stop' : 'Send';
    s.classList.toggle('stop', b);
  }

  async function sendAI(provider) {
    const st = state.ai[provider];
    const u = ui[provider];
    if (st.busy) { if (st.abort) st.abort.abort(); return; }
    const prompt = u.input.value.trim();
    if (!prompt) return;

    let full = prompt;
    let view = prompt;
    const editOn = u.edit.checked;
    let ctx = null;
    if (u.include.checked) {
      ctx = getCodeContext();
      if (ctx) {
        const note = ctx.label + (ctx.truncated ? ' (truncated)' : '');
        full += `\n\nCode (${note} of «${state.current ? state.current.name : 'editor'}»):\n\`\`\`\n${ctx.code}\n\`\`\``;
        view += `\n📎 ${note}`;
      }
    }
    const extra = await mentionedFiles(prompt);
    extra.forEach((f) => { full += `\n\nContents of «${f.name}»:\n\`\`\`\n${f.text}\n\`\`\``; view += `\n📎 ${f.name}`; });
    if (editOn && state.files.length) full += `\n\n(Project files: ${state.files.slice(0, 60).map((f) => f.name).join(', ')})`;

    if (guardOn()) {
      const sec = guardScanText(full, 'message').filter((x) => x.sev === 'high');
      if (sec.length && !window.confirm(`🛡 GitGuard: the message seems to contain a secret (${sec[0].label}: ${sec[0].sample}).\n\nSend it to the AI anyway?`)) { u.input.value = prompt; return; }
    }
    const userMsg = { role: 'user', text: full, view, ts: Date.now() };
    state.chats[provider].push(userMsg);
    u.input.value = '';
    if (state.chats[provider].length === 1) u.chat.replaceChildren();
    const userDiv = appendMsg(provider, userMsg);
    const pending = addSystem(provider, 'Thinking…');
    scrollChat(provider);

    setBusy(provider, true);
    const ctrl = new AbortController();
    st.abort = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, AI_TIMEOUT_MS);

    try {
      if (!navigator.onLine) {
        throw new AIError('No internet connection. The editor works offline, but the AI needs a network.');
      }
      const got = await callWithFallback(provider, buildHistory(provider), ctrl.signal, await buildSystem(editOn ? EDIT_PROMPT : SYSTEM_PROMPT));
      const reply = got.text;
      const botMsg = { role: 'model', text: reply, ts: Date.now() };
      state.chats[provider].push(botMsg);
      pending.remove();
      appendMsg(provider, botMsg);
      if (got.by !== provider) addSystem(provider, `⚠ ${PROVIDERS[provider].label} reached its limit or did not respond; ${PROVIDERS[got.by].label} answered.`);
      if (editOn) {
        const blocks = parseEditBlocks(reply);
        if (blocks.length) {
          const r = await applyAIEdits(blocks, ctx);
          const msg = h('div', { class: 'ai-message system' },
            r.done.length ? `✔ Applied: ${r.done.join(', ')}. The changes are UNSAVED: review and press Ctrl+S.` : 'No changes were applied.',
            r.skipped.length ? `\nNot applied: ${r.skipped.join('; ')}.` : '');
          if (r.mainApplied) msg.appendChild(h('div', null, h('button', { class: 'btn btn-ghost sm', type: 'button', text: 'Undo change', onclick: () => { els.editor.focus(); document.execCommand('undo'); } })));
          u.chat.appendChild(msg);
        }
      }
    } catch (err) {
      // Se revierte el mensaje para poder reintentar sin perder lo escrito
      const idx = state.chats[provider].lastIndexOf(userMsg);
      if (idx !== -1) state.chats[provider].splice(idx, 1);
      userDiv.remove();
      pending.remove();
      if (!u.input.value) u.input.value = prompt;
      addSystem(provider, friendlyError(err, timedOut), 'error');
    } finally {
      clearTimeout(timer);
      st.abort = null;
      setBusy(provider, false);
      const list = state.chats[provider];
      if (list.length > MAX_CHAT_STORED) list.splice(0, list.length - MAX_CHAT_STORED);
      persistChat(provider);
      scrollChat(provider);
    }
  }

  function clearChat(provider) {
    if (!state.chats[provider].length) return;
    if (!window.confirm('Delete this chat history?')) return;
    state.chats[provider] = [];
    persistChat(provider);
    renderChat(provider);
  }

  // Construye el contenido de un panel de IA (uno por proveedor)
  function buildPanel(provider) {
    const P = PROVIDERS[provider];
    const root = panels[provider];
    const u = {};
    const side = SIDE[provider];
    u.mtoggle = h('button', { class: 'icon-btn sm model-toggle', type: 'button', 'aria-label': 'Show or hide the model selector', 'aria-expanded': prefs['mb_' + provider] ? 'true' : 'false' }, icon('down'));
    const header = h('div', { class: 'sidebar-header' },
      h('div', { class: 'title-row' }, h('h3', { text: P.label }), u.mtoggle),
      h('div', { class: 'header-actions' },
        h('button', { class: 'btn btn-ghost sm', type: 'button', text: 'Clear', onclick: () => clearChat(provider) }),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': 'API settings', title: 'API settings', 'data-action': 'settings' }, icon('gear')),
        h('button', { class: 'icon-btn sm', type: 'button', 'aria-label': `Close ${P.label}`, title: 'Close panel', onclick: () => setPanel(provider, false) }, icon('x'))
      ));
    let modelRow;
    if (false) {
      u.model = h('select', { 'aria-label': 'Gemini model' });
      u.refresh = h('button', { class: 'btn btn-ghost', type: 'button', title: 'Load the latest models from your account', 'aria-label': 'Refresh model list', text: '↻' });
      modelRow = h('div', { class: 'model-row' }, u.model, u.refresh);
    } else {
      u.model = h('select', { 'aria-label': P.label + ' model' });
      u.browse = h('button', { class: 'btn btn-ghost', type: 'button', title: 'Search among all OpenRouter models', 'aria-label': 'Browse models', text: 'Browse…' });
      u.refresh = h('button', { class: 'btn btn-ghost', type: 'button', title: 'Refresh the model list', 'aria-label': 'Refresh models', text: '↻' });
      u.datalist = null;
      modelRow = h('div', { class: 'model-row' }, u.model, u.browse, u.refresh);
    }
    u.chat = h('div', { class: 'chat-history', role: 'log', 'aria-live': 'polite' });
    u.include = h('input', { type: 'checkbox', checked: true });
    u.edit = h('input', { type: 'checkbox', checked: store.get('cc_ai_edit_' + provider) !== 'off' });
    u.edit.addEventListener('change', () => store.set('cc_ai_edit_' + provider, u.edit.checked ? 'on' : 'off'));
    u.input = h('input', { type: 'text', class: 'chat-input', placeholder: `Ask ${P.label} something (@file to include others)`, autocomplete: 'off', enterkeyhint: 'send', 'aria-label': `Message for ${P.label}` });
    u.send = h('button', { type: 'button', class: 'send-btn', text: 'Send' });
    modelRow.hidden = !prefs['mb_' + provider];
    u.modelRow = modelRow;
    u.slash = h('div', { class: 'slash-pop', hidden: true });
    u.rulesNote = h('small', { class: 'rules-note' });
    u.mtoggle.addEventListener('click', () => {
      modelRow.hidden = !modelRow.hidden;
      prefs['mb_' + provider] = !modelRow.hidden; savePrefs();
      u.mtoggle.setAttribute('aria-expanded', modelRow.hidden ? 'false' : 'true');
    });
    root.append(header, modelRow, u.chat,
      h('div', { class: 'chat-input-container' }, u.slash,
        h('label', { class: 'include-row' }, u.include, h('span', { text: 'Send code (selection or file)' })),
        h('label', { class: 'include-row edit' }, u.edit, h('span', { text: 'Allow it to edit my code when I ask' })),
        h('div', { class: 'input-row' }, u.input, u.send), u.rulesNote));
    root.dataset.side = side;
    ui[provider] = u;

    u.send.addEventListener('click', () => sendAI(provider));
    u.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (state.ai[provider].busy) return; if (/^\/[\w-]/.test(u.input.value) && slashRun(provider)) return; sendAI(provider); }
    });
    u.input.addEventListener('input', () => updateSlash(provider));
    {
      u.browse.addEventListener('click', () => orPicker(provider));
      u.refresh.addEventListener('click', async () => {
        u.refresh.disabled = true;
        try { const l = await loadAllOrModels(); fillOrSelect(); addSystem(provider, `${l.length} models loaded (${l.filter((m) => m.free).length} free). Pick one in the list or in «Browse…».`); }
        catch (e) { addSystem(provider, friendlyError(e, false), 'error'); }
        finally { u.refresh.disabled = false; scrollChat(provider); }
      });
      u.model.addEventListener('change', () => setOrModel(u.model.value, provider));
      fillOrSelect(provider);
    }
    refreshRulesNote();
    updateModelTips();
  }

  // ---------------------------------------------------------------
  // Llaves y tokens cifrados (AES-256-GCM, clave derivada con PBKDF2 de tu frase)
  // ---------------------------------------------------------------
  const SECRETS = ['gemini_key', 'openrouter_key', 'github_token'];
  const sec = { map: {}, key: null, salt: null, state: 'none', idle: 0 };   // none | locked | open
  const legacyKeys = () => SECRETS.filter((n) => (store.get(n) || '').trim());
  const secret = (n) => sec.map[n] || (sec.state === 'none' ? (store.get(n) || '') : '');
  const b64 = (u) => { let t = ''; u.forEach((c) => { t += String.fromCharCode(c); }); return btoa(t); };
  const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  const deriveKey = async (pass, salt) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  async function secPersist() {
    if (!sec.key) return false;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sec.key, new TextEncoder().encode(JSON.stringify(sec.map))));
    return store.set('cc_vault', JSON.stringify({ v: 1, s: b64(sec.salt), i: b64(iv), c: b64(ct) }));
  }
  async function secCreate(pass) {
    sec.salt = crypto.getRandomValues(new Uint8Array(16));
    sec.key = await deriveKey(pass, sec.salt);
    const m = {};
    legacyKeys().forEach((n) => { m[n] = (store.get(n) || '').trim(); });
    sec.map = m;
    if (!(await secPersist())) { sec.key = null; sec.map = {}; return false; }
    legacyKeys().forEach((n) => store.remove(n));
    ['vm_token', 'vm_url'].forEach((n) => store.remove(n));
    sec.state = 'open';
    return true;
  }
  async function secUnlock(pass) {
    let rec;
    try { rec = JSON.parse(store.get('cc_vault') || ''); } catch (_) { return false; }
    try {
      const salt = unb64(rec.s);
      const key = await deriveKey(pass, salt);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.i) }, key, unb64(rec.c));
      sec.map = JSON.parse(new TextDecoder().decode(pt));
      sec.key = key; sec.salt = salt; sec.state = 'open';
      return true;
    } catch (_) { return false; }
  }
  function secLock(quiet) {
    sec.map = {}; sec.key = null; sec.salt = null;
    sec.state = store.get('cc_vault') ? 'locked' : 'none';
    if (!quiet) toast('Keys locked. Unlock them from AI → Unlock keys.', 'ok');
    if (typeof refreshSettingsHints === 'function' && els.set && els.set.dlg.open) refreshSettingsHints();
    if (typeof refreshEmptyChats === 'function') { try { refreshEmptyChats(); } catch (_) { /* nada */ } }
  }
  function vaultDialog(mode) {
    return new Promise((resolve) => {
      const dlg = $('vault-dlg'), p1 = $('vault-pass'), p2 = $('vault-pass2'), msg = $('vault-msg');
      const create = mode === 'create';
      $('vault-title').textContent = create ? 'Protect your keys' : 'Unlock your keys';
      $('vault-note').textContent = create
        ? 'Choose a passphrase (10+ characters). Your API keys and GitHub token are encrypted with it (AES-256-GCM) before they touch the disk. If you forget it they cannot be recovered; you would paste them again.'
        : 'Type your passphrase to use Gemini, OpenRouter and GitHub in this session.';
      $('vault-pass2-wrap').hidden = !create;
      p1.value = ''; p2.value = ''; msg.textContent = ''; msg.classList.remove('error');
      let result = false, busy = false;
      const ok = $('vault-ok'), cancel = $('vault-cancel');
      const fail = (t) => { msg.textContent = t; msg.classList.add('error'); };
      ok.onclick = async () => {
        if (busy) return;
        const a = p1.value;
        if (create) {
          if (a.length < 10) return fail('Use at least 10 characters.');
          if (a !== p2.value) return fail('The passphrases do not match.');
        } else if (!a) return fail('Type your passphrase.');
        busy = true; ok.disabled = true; msg.textContent = 'Working…'; msg.classList.remove('error');
        const good = create ? await secCreate(a) : await secUnlock(a);
        busy = false; ok.disabled = false;
        if (!good) { fail(create ? 'Could not save (the browser blocks local storage).' : 'Wrong passphrase.'); return; }
        result = true; p1.value = ''; p2.value = ''; dlg.close();
      };
      cancel.onclick = () => dlg.close();
      [p1, p2].forEach((el) => { el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } }; });
      dlg.onclose = () => { dlg.onclose = null; p1.value = ''; p2.value = ''; resolve(result); };
      dlg.showModal();
      p1.focus();
    });
  }
  async function ensureVault() {
    if (sec.state === 'open') return true;
    const ok = await vaultDialog(sec.state === 'locked' ? 'unlock' : 'create');
    if (ok) { if (typeof refreshSettingsHints === 'function') refreshSettingsHints(); try { refreshEmptyChats(); } catch (_) { /* nada */ } }
    return ok;
  }
  async function setSecret(n, v) {
    if (!(await ensureVault())) return false;
    sec.map[n] = v;
    return secPersist();
  }
  async function delSecret(n) {
    if (sec.state === 'open') { delete sec.map[n]; await secPersist(); }
    else store.remove(n);
  }
  function secInit() {
    sec.state = store.get('cc_vault') ? 'locked' : 'none';
    const bump = () => { sec.idle = Date.now(); };
    ['keydown', 'pointerdown'].forEach((t) => document.addEventListener(t, bump, true));
    bump();
    setInterval(() => { if (sec.state === 'open' && Date.now() - sec.idle > 30 * 60 * 1000) secLock(); }, 30000);
    if (sec.state === 'locked') setTimeout(() => { ensureVault(); }, 600);
    else if (legacyKeys().length) setTimeout(() => { toast('Your keys are stored without encryption. Protect them with a passphrase.', 'err'); ensureVault(); }, 600);
  }

  // ---------------------------------------------------------------
  // Ajustes de API
  // ---------------------------------------------------------------
  function refreshSettingsHints() {
    const s = els.set;
    const g = hasKey('gemini');
    const o = hasKey('openrouter');
    s.gKey.placeholder = g ? 'Key saved — type to replace it' : 'Paste your Gemini key';
    s.oKey.placeholder = o ? 'Key saved — type to replace it' : 'Paste your OpenRouter key';
    s.gClear.hidden = !g;
    s.oClear.hidden = !o;
    const vs = $('set-vault-state'), vb = $('set-vault-btn');
    if (vs && vb) {
      vs.textContent = sec.state === 'open' ? '🔓 Keys unlocked (encrypted on disk)' : sec.state === 'locked' ? '🔒 Keys locked' : (legacyKeys().length ? '⚠ Keys stored without encryption' : 'No passphrase yet');
      vb.textContent = sec.state === 'open' ? 'Lock now' : sec.state === 'locked' ? 'Unlock…' : 'Encrypt with a passphrase…';
    }
  }

  function settingsMessage(text, isError) {
    els.set.msg.textContent = text;
    els.set.msg.classList.toggle('error', !!isError);
  }

  function openSettings() {
    const s = els.set;
    s.gKey.value = '';
    s.oKey.value = '';
    populateModelSelects();
    s.oModel.value = store.get('openrouter_model') || '';
    s.oModelB.value = store.get('openrouter_model_b') || '';
    $('set-fallback').checked = store.get('cc_ai_fallback') !== 'off';
    settingsMessage('');
    refreshSettingsHints();
    s.dlg.showModal();
  }

  function refreshEmptyChats() {
    Object.keys(PROVIDERS).forEach((p) => { if (!state.chats[p].length) renderChat(p); });
  }

  async function saveSettings() {
    const s = els.set;
    let ok = true;
    const gk = s.gKey.value.trim();
    const ok2 = s.oKey.value.trim();
    if ((gk || ok2) && !(await ensureVault())) { settingsMessage('Not saved: your keys are only stored encrypted, so a passphrase is required.', true); return; }
    if (gk) ok = (await setSecret('gemini_key', gk)) && ok;
    if (ok2) ok = (await setSecret('openrouter_key', ok2)) && ok;
    store.set('cc_ai_fallback', $('set-fallback').checked ? 'on' : 'off');
    const gm = (s.gModel.value || '').trim();
    const om = s.oModel.value.trim();
    if (gm) ok = store.set('gemini_model', gm) && ok; else store.remove('gemini_model');
    if (om) ok = store.set('openrouter_model', om) && ok; else store.remove('openrouter_model');
    const omb = s.oModelB.value.trim();
    if (omb) ok = store.set('openrouter_model_b', omb) && ok; else store.remove('openrouter_model_b');
    s.gKey.value = '';
    s.oKey.value = '';
    refreshSettingsHints();
    populateModelSelects();
    if (!ok) { settingsMessage('Could not save: the browser blocks local storage.', true); return; }
    settingsMessage('Saved encrypted on this device.');
    if (gk) loadModels().then((l) => settingsMessage(`Saved. ${l.length} models loaded.`)).catch(() => {});
    refreshEmptyChats();
  }

  async function clearKey(provider) {
    await delSecret(PROVIDERS[provider].keyName);
    refreshSettingsHints();
    settingsMessage('Key deleted.');
    refreshEmptyChats();
  }

  // ---------------------------------------------------------------
  // Importar y exportar (sin límite de tamaño ni de tipo)
  // ---------------------------------------------------------------
  // ---- ZIP: escritor (sin compresión, valido en cualquier programa) ----
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZip(entries) {
    if (entries.length > 65000) throw new Error('Too many files for a .zip (max. 65,000).');
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    let cdSize = 0;
    const d = new Date();
    const dt = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dd = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    entries.forEach((e) => {
      const nm = enc.encode(e.name);
      const sz = e.data.length;
      if (sz > 0xFFFFFFFF || offset > 0xFFFFFFFF) throw new Error('The .zip would exceed 4 GB. Export in parts or use the .json backup.');
      const crc = crc32(e.data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nm, e.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, nm);
      cdSize += 46 + nm.length;
      offset += 30 + nm.length + sz;
    });
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
  }

  // ---- ZIP: lector (almacenado y deflate, con DecompressionStream nativo) ----
  async function readZip(file) {
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('does not look like a valid .zip');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder('utf-8');
    const out = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const flags = dv.getUint16(p + 8, true);
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const loff = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/') || name.startsWith('__MACOSX/') || (flags & 1) || csize === 0xFFFFFFFF) continue;
      const lnl = dv.getUint16(loff + 26, true);
      const lel = dv.getUint16(loff + 28, true);
      const start = loff + 30 + lnl + lel;
      const raw = u8.subarray(start, start + csize);
      let data;
      if (method === 0) {
        data = new Blob([raw]);
      } else if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot decompress .zip');
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        data = await new Response(stream).blob();
      } else {
        continue;
      }
      out.push({ path: name, blob: data });
    }
    return out;
  }

  // ---- Copia de seguridad .json ----
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function exportBackup() {
    setSave('Preparing backup…');
    const files = [];
    for (const f of state.files.slice().sort((a, b) => byName(a.name, b.name))) {
      if (f.binary) files.push({ name: f.name, mime: f.mime || '', base64: await blobToBase64(await getBlob(f)) });
      else files.push({ name: f.name, content: await getText(f) });
    }
    const json = JSON.stringify({ format: 'codecraft-backup', version: 1, exported: new Date().toISOString(), files });
    downloadBlob(new Blob([json], { type: 'application/json' }), `codecraft-copia-${stamp()}.json`);
    setSave(`Backup exported (${files.length} files)`);
  }

  async function readBackup(file) {
    const data = JSON.parse(await file.text());
    if (!data || data.format !== 'codecraft-backup' || !Array.isArray(data.files)) throw new Error('invalid backup');
    return data.files.filter((f) => f && typeof f.name === 'string').map((f) => {
      if (typeof f.base64 === 'string') {
        const bin = atob(f.base64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return { path: f.name, blob: new Blob([u8], { type: f.mime || '' }), forceBinary: true };
      }
      return { path: f.name, blob: new Blob([String(f.content || '')], { type: 'text/plain' }) };
    });
  }

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

  async function exportCurrent() {
    if (!state.current) return;
    const blob = await getBlob(state.current);
    downloadBlob(blob, baseName(state.current.name));
    setSave('File exported');
  }

  async function exportZip(onlyPrefix) {
    const list = state.files.filter((f) => !onlyPrefix || f.name === onlyPrefix || f.name.startsWith(onlyPrefix + '/'));
    if (!list.length) { setSave('No files to export'); return; }
    setSave('Creating .zip…');
    const enc = new TextEncoder();
    const entries = [];
    for (const f of list) {
      const data = f.binary ? new Uint8Array(await (await getBlob(f)).arrayBuffer()) : enc.encode(await getText(f));
      entries.push({ name: f.name, data });
    }
    try {
      downloadBlob(buildZip(entries), `${(state.project.name || 'codecraft').replace(/[^\w.-]+/g, '_')}-${stamp()}.zip`);
      setSave(`Exported ${entries.length} files`);
    } catch (err) {
      setSave('Error exporting');
      window.alert(err.message);
    }
  }

  // ---- Importación ----
  async function classify(item) {
    const blob = item.blob;
    if (item.forceBinary) return { binary: true };
    if (blob.size === 0) return { binary: false, text: '' };
    const head = new Uint8Array(await blob.slice(0, 8192).arrayBuffer());
    if (head.includes(0)) return { binary: true };
    if (blob.size > BIG_TEXT &&
        !window.confirm(`«${item.path}» weighs ${fmtSize(blob.size)}. Opening it as text can be slow and use a lot of memory.\n\nOK = open as text.\nCancel = save it without opening (keeps the file intact and it can be exported).`)) {
      return { binary: true };
    }
    try {
      return { binary: false, text: new TextDecoder('utf-8', { fatal: true }).decode(await blob.arrayBuffer()) };
    } catch (_) {
      return { binary: true };   // no es UTF-8: se conserva byte a byte
    }
  }

  async function importFiles(items, opts) {
    opts = opts || {};
    if (!items.length) return;
    if (!state.dbOK) { window.alert('Files cannot be imported without local storage.'); return; }
    await leaveCurrent();
    setSave('Importing…');
    const queue = [];
    const notes = [];
    for (const it of items) {
      const lower = it.path.toLowerCase();
      if (!opts.raw && lower.endsWith('.zip')) {
        if (window.confirm(`Unzip «${it.path}»?\n\nOK = extract its files.\nCancel = import it as a .zip file.`)) {
          try { queue.push(...await readZip(it.blob)); continue; } catch (err) { notes.push(`${it.path}: ${err.message}`); }
        }
      } else if (!opts.raw && lower.endsWith('.json') && it.blob.size > 40) {
        const head = await it.blob.slice(0, 300).text();
        if (head.includes('"codecraft-backup"') &&
            window.confirm(`«${it.path}» is a CodeCraft backup.\n\nOK = restore its files.\nCancel = import it as a normal .json file.`)) {
          try { queue.push(...await readBackup(it.blob)); continue; } catch (err) { notes.push(`${it.path}: ${err.message}`); }
        }
      }
      queue.push(it);
    }
    if (!queue.length) { setSave(notes[0] || 'Nothing to import'); return; }
    if (queue.length > 1500 && !window.confirm(`You are about to import ${queue.length} files. Continue?`)) { setSave('Import cancelled'); return; }

    const clashes = queue.filter((q) => state.files.some((f) => f.name === normalizePath(q.path))).length;
    const replace = !!opts.replace || (clashes > 0 && window.confirm(`${clashes} file(s) already exist with the same name.\n\nOK = replace them.\nCancel = keep both (the imported copy is renamed).`));

    let added = 0;
    let replaced = 0;
    let first = null;
    const touched = new Set();
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      setSave(`Importing ${i + 1}/${queue.length}…`);
      try {
        const cls = await classify(it);
        const data = cls.binary ? it.blob : cls.text;
        const opts = { binary: cls.binary, mime: it.blob.type };
        let name = normalizePath(it.path);
        const ex = state.files.find((f) => f.name === name);
        let meta;
        if (ex && replace) {
          clearTimeout(state.saveTimer);
          state.buffers.delete(ex.id);
          if (cls.binary) { ex.binary = true; ex.mime = it.blob.type || ''; } else { delete ex.binary; delete ex.mime; }
          ex.size = cls.binary ? it.blob.size : cls.text.length;
          ex.updated = Date.now();
          await dbSaveFile(ex, data);
          meta = ex;
          replaced++;
        } else {
          if (ex) name = uniqueName(name);
          meta = await createFileRecord(name, data, opts);
          added++;
        }
        if (it.handle) state.handles.set(meta.id, it.handle);
        if (it.handle && state.dbOK) { meta.appOnly = false; idb.put('meta', { key: 'h:' + meta.id, handle: it.handle }).catch(() => {}); }
        touched.add(meta.id);
        if (!first) first = meta;
      } catch (err) {
        notes.push(`${it.path}: ${(err && err.message) || 'error'}`);
      }
    }
    if (opts.replace && state.current) {
      if (touched.has(state.current.id)) await loadFile(state.current.id);
    } else if (first) {
      await loadFile(first.id);
      if (queue.length > 1 && !state.filesOpen) setPanel('files', true);
    }
    renderFiles();
    const msg = `Imported ${added + replaced} file(s)` + (replaced ? ` (${replaced} replaced)` : '') + (notes.length ? ` · ${notes.length} with errors` : '');
    setSave(msg);
    if (term && term.out && !opts.quiet) { tprint(msg, notes.length ? 'warn' : 'ok'); notes.slice(0, 10).forEach((n) => tprint('  ' + n, 'err')); }
    else if (notes.length) window.alert(notes.slice(0, 8).join('\n'));
  }

  const fromInput = (input) => Array.from(input.files || []).map((f) => ({ blob: f, path: f.webkitRelativePath || f.name }));

  // Arrastrar y soltar (archivos y carpetas completas)
  async function walkEntry(en, prefix, out) {
    if (en.isFile) {
      const f = await new Promise((res, rej) => en.file(res, rej));
      out.push({ blob: f, path: prefix + en.name });
    } else if (en.isDirectory) {
      const reader = en.createReader();
      const all = [];
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        all.push(...batch);
      }
      for (const c of all) await walkEntry(c, prefix + en.name + '/', out);
    }
  }

  async function handleDrop(dt) {
    const entries = Array.from(dt.items || []).map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
    const plain = Array.from(dt.files || []).map((f) => ({ blob: f, path: f.name }));
    const out = [];
    if (entries.length) {
      for (const en of entries) { try { await walkEntry(en, '', out); } catch (_) { /* se ignora */ } }
    }
    await importFiles(out.length ? out : plain);
  }

  // ---------------------------------------------------------------
  // Salida (solo lectura): muestra el resultado de ejecutar archivos .js
  // ---------------------------------------------------------------
  const term = { out: $('term-out'), busy: false };
  function tprint(text, cls) {
    term.out.appendChild(h('div', { class: 'tl' + (cls ? ' ' + cls : ''), text: String(text) }));
    while (term.out.childElementCount > MAX_TERM_LINES) term.out.firstChild.remove();
    term.out.scrollTop = term.out.scrollHeight;
  }

  // ---- Ejecución de JavaScript en un Worker aislado (sin acceso a la página) ----
  const PRELUDE = "const __f=(x)=>{try{return typeof x==='string'?x:(x instanceof Error?(x.stack||String(x)):(JSON.stringify(x,null,2)??String(x)))}catch(_){return String(x)}};const __p=(t,a)=>postMessage({t:t,m:a.map(__f).join(' ')});console.log=(...a)=>__p('log',a);console.info=console.log;console.debug=console.log;console.warn=(...a)=>__p('warn',a);console.error=(...a)=>__p('err',a);addEventListener('unhandledrejection',(e)=>{__p('err',['Promesa rechazada: '+((e.reason&&e.reason.message)||e.reason)])});";
  let runState = null;

  function stopRun(manual) {
    if (runState) runState.finish('stopped');
    else if (manual) tprint('Nothing is running.', 'dim');
  }

  async function runFile(meta) {
    if (meta.binary || !isRunnable(meta.name)) { tprint(`Only .js or .mjs files can be run (${meta.name}).`, 'err'); return false; }
    let code;
    try { code = await getText(meta); } catch (e) { tprint(e.message, 'err'); return false; }
    return runCode(meta.name, code);
  }

  // Ejecuta código JS en el Worker aislado. Devuelve false si terminó con error o por límite de tiempo.
  async function runCode(label, code) {
    if (runState) stopRun();
    if (!termVisible()) setPanel('terminal', true);
    const url = URL.createObjectURL(new Blob([PRELUDE + '\n' + code + '\n;postMessage({t:"done"});'], { type: 'text/javascript' }));
    let w;
    try { w = new Worker(url, { type: 'module' }); } catch (e) { URL.revokeObjectURL(url); tprint('Could not start the runner: ' + e.message, 'err'); return false; }
    tprint(`▶ running ${label}`, 'dim');
    const t0 = performance.now();
    return new Promise((resolve) => {
      let idle = null;
      let ended = false;
      const max = setTimeout(() => finish(`time limit reached (${RUN_MAX_MS / 1000} s)`, true), RUN_MAX_MS);
      function finish(why, bad) {
        if (ended) return;
        ended = true;
        clearTimeout(idle);
        clearTimeout(max);
        w.terminate();
        URL.revokeObjectURL(url);
        runState = null;
        tprint(`■ ${why} (${Math.round(performance.now() - t0)} ms)`, bad ? 'err' : (why === 'finished' ? 'ok' : 'dim'));
        resolve(!bad);
      }
      runState = { finish };
      w.onmessage = (e) => {
        const d = e.data || {};
        if (d.t === 'done') { clearTimeout(idle); idle = setTimeout(() => finish('finished'), 600); return; }
        tprint(d.m, d.t === 'err' ? 'err' : (d.t === 'warn' ? 'warn' : ''));
        if (idle) { clearTimeout(idle); idle = setTimeout(() => finish('finished'), 600); }
      };
      w.onerror = (e) => {
        if (e.preventDefault) e.preventDefault();
        tprint(`Error: ${e.message || 'the file could not be loaded. Imports such as node:http or package names do not work in the browser; use relative files with the Full preview.'}${e.lineno ? ` (line ${Math.max(1, e.lineno - 1)})` : ''}`, 'err');
        finish('finished with an error', true);
      };
    });
  }

  async function runCurrent() {
    if (!state.current) { tprint('No file is open.', 'err'); return; }
    await runFile(state.current);
  }

  // ---------------------------------------------------------------
  // Proyectos y carpetas enlazadas (Chromebook)
  // ---------------------------------------------------------------
  const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', '__pycache__', '.venv', '.next']);
  state.dirHandles = new Map();

  const projById = (id) => state.projects.find((p) => p.id === id);
  const curProj = () => state.project;

  function persistProjects() {
    if (state.dbOK) idb.put('meta', { key: 'projects', list: state.projects }).catch(() => {});
    scheduleGit();
  }
  function updateProjLabel() {
    const p = curProj();
    const tag = p && p.link ? ' · folder' : '';
    $('st-proj').textContent = 'Project: ' + (p ? p.name : '—') + tag;
  }

  async function switchProject(pid) {
    const p = projById(pid);
    if (!p) return;
    if (state.project && state.project.id !== pid) await leaveCurrent();
    state.project = p;
    state.files = state.all.filter((f) => (f.project || 'default') === pid);
    if (state.dbOK) idb.put('meta', { key: 'activeProject', value: pid }).catch(() => {});
    let ids = [];
    let curId = null;
    if (state.dbOK) {
      try {
        const t = await idb.get('meta', 'tabs:' + pid);
        ids = (t && Array.isArray(t.ids) ? t.ids : []).filter((id) => state.files.some((f) => f.id === id));
        const c = await idb.get('meta', 'currentId:' + pid);
        curId = c && c.value;
      } catch (_) { /* se ignora */ }
    }
    state.tabs = ids;
    updateProjLabel();
    git.mode = 'main';
    git.msg = '';
    if (isOpen('git')) renderGit();
    const target = state.files.find((f) => f.id === curId) || state.files.find((f) => f.id === ids[0]);
    if (target) await loadFile(target.id); else setNoFile();
    renderTabs();
    renderFiles();
    refreshPreviewSoon();
  }

  async function createProject(name, link) {
    const p = { id: uid(), name: name.trim().slice(0, 60) || 'Project', link: link || null };
    state.projects.push(p);
    persistProjects();
    await switchProject(p.id);
    return p;
  }

  async function deleteProject(p) {
    if (!window.confirm(`Delete project «${p.name}» and all its files from the app? ${p.link ? 'The real files in the folder are NOT deleted.' : 'This can\'t be undone.'}`)) return;
    const ids = state.all.filter((f) => (f.project || 'default') === p.id).map((f) => f.id);
    if (ids.length) { try { if (state.dbOK) await dbDeleteFiles(ids); } catch (_) { /* se ignora */ } }
    ids.forEach((i) => { state.buffers.delete(i); state.handles.delete(i); });
    state.all = state.all.filter((f) => !ids.includes(f.id));
    state.projects = state.projects.filter((x) => x.id !== p.id);
    if (state.dbOK) { idb.del('meta', 'ph:' + p.id).catch(() => {}); idb.del('meta', 'tabs:' + p.id).catch(() => {}); }
    state.dirHandles.delete(p.id);
    if (!state.projects.length) state.projects.push({ id: 'default', name: 'General', link: null });
    persistProjects();
    state.project = null;
    await switchProject(state.projects[0].id);
  }

  async function projectDialog() {
    const dlg = $('project-dlg');
    const list = $('proj-list');
    const acts = $('proj-actions');
    const draw = () => {
      list.replaceChildren();
      state.projects.forEach((p) => {
        const n = state.all.filter((f) => (f.project || 'default') === p.id).length;
        const kind = p.link ? 'Chromebook folder' : 'App only';
        list.appendChild(h('button', { class: 'proj-item' + (p.id === state.project.id ? ' current' : ''), type: 'button',
          onclick: async () => { dlg.close(); await switchProject(p.id); } },
          icon('files'), h('span', null, p.name, h('small', { text: `${n} file(s) · ${kind}` }))));
      });
    };
    draw();
    acts.replaceChildren(
      h('button', { class: 'btn', type: 'button', text: '＋ New project', onclick: async () => { const n = await askName('Project name', ''); if (n) { dlg.close(); await createProject(n, null); } } }),
      h('button', { class: 'btn btn-ghost', type: 'button', text: 'Open Chromebook folder…', onclick: () => { dlg.close(); runAction('open-folder'); } }),
      h('button', { class: 'btn btn-ghost', type: 'button', text: 'Rename this one', onclick: async () => { const n = await askName('New name', state.project.name); if (n && n.trim()) { state.project.name = n.trim().slice(0, 60); persistProjects(); updateProjLabel(); draw(); } } }),
      h('button', { class: 'btn btn-ghost', type: 'button', text: 'Delete this one', onclick: async () => { dlg.close(); await deleteProject(state.project); } })
    );
    dlg.showModal();
  }

  // ---- Acceso a lo enlazado ----
  async function projDirHandle(p) {
    if (state.dirHandles.has(p.id)) return state.dirHandles.get(p.id);
    const r = state.dbOK ? await idb.get('meta', 'ph:' + p.id) : null;
    if (r && r.handle) { state.dirHandles.set(p.id, r.handle); return r.handle; }
    return null;
  }

  async function ensureDirPerm(hd) {
    const o = { mode: 'readwrite' };
    if (hd.queryPermission && (await hd.queryPermission(o)) !== 'granted') {
      if (!hd.requestPermission || (await hd.requestPermission(o)) !== 'granted') throw new Error('permission denied for the folder');
    }
  }

  async function linkedWrite(p, rel, data) {
    const root = await projDirHandle(p);
    if (!root) throw new Error('the folder is no longer linked; open it again');
    await ensureDirPerm(root);
    const parts = rel.split('/');
    let d = root;
    for (const seg of parts.slice(0, -1)) d = await d.getDirectoryHandle(seg, { create: true });
    const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }

  // Lee todos los archivos de la carpeta enlazada → [{path, blob}]
  async function linkedReadAll(p, onProgress) {
    const out = [];
    const root = await projDirHandle(p);
    if (!root) throw new Error('the folder is no longer linked');
    await ensureDirPerm(root);
    const walk = async (dir, prefix) => {
      for await (const [name, hd] of dir.entries()) {
        if (hd.kind === 'directory') { if (!SKIP_DIRS.has(name)) await walk(hd, prefix + name + '/'); }
        else { out.push({ path: prefix + name, blob: await hd.getFile() }); if (onProgress) onProgress(out.length); }
      }
    };
    await walk(root, '');
    return out;
  }

  async function openFolderProject() {
    if (!window.showDirectoryPicker) { toast('This browser cannot open folders. Use File → Import folder.', 'err'); return; }
    let root;
    try { root = await window.showDirectoryPicker({ mode: 'readwrite' }); }
    catch (e) { if (e && e.name === 'AbortError') return; throw e; }
    const p = await createProject(root.name, { kind: 'dir' });
    state.dirHandles.set(p.id, root);
    try { await idb.put('meta', { key: 'ph:' + p.id, handle: root }); } catch (_) { /* se ignora */ }
    await syncProject(true);
  }

  // Trae los archivos de la carpeta al proyecto (reemplaza los de igual nombre)
  async function syncProject(first) {
    const p = curProj();
    if (!p || !p.link) { toast('This project is not linked to a folder.', 'err'); return; }
    if (!first && !window.confirm('The files will be read again from disk and will replace the project files with the same name. Unsaved changes in those files will be lost.\n\nContinue?')) return;
    try {
      setSave('Reading files…');
      const items = await linkedReadAll(p, (n) => setSave(`Reading ${n}…`));
      await importFiles(items, { raw: true, replace: true, quiet: true });
      toast(`${items.length} file(s) loaded from the folder`, 'ok');
    } catch (e) {
      toast('Could not read: ' + ((e && e.message) || e), 'err');
    }
  }

  // ---------------------------------------------------------------
  // Control de código fuente: cuenta de GitHub, inicializar, publicar, commit, traer y clonar
  // (todo con la API de GitHub; no necesita git ni terminal)
  // ---------------------------------------------------------------
  const git = { user: null, mode: 'main', busy: false, msg: '', note: '', noteErr: false, changes: [], timer: null, cache: new Map() };
  const ghToken = () => secret('github_token');
  const slug = (t) => String(t || 'proyecto').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';

  function fnv(str) {
    let hs = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { hs ^= str.charCodeAt(i); hs = Math.imul(hs, 0x01000193); }
    return (hs >>> 0).toString(36) + ':' + str.length;
  }

  async function fileHash(f) {
    if (f.binary) return `b:${f.size}:${f.updated || 0}`;
    const live = isDirtyId(f.id);
    const key = `${f.id}:${f.updated}:${f.size}`;
    if (!live && git.cache.has(key)) return git.cache.get(key);
    const hv = fnv(await getText(f));
    if (!live) { if (git.cache.size > 4000) git.cache.clear(); git.cache.set(key, hv); }
    return hv;
  }

  async function computeChanges() {
    const p = curProj();
    if (!p || !p.gh) return [];
    const snap = p.gh.snap || {};
    const out = [];
    const seen = new Set();
    const prot = guardIgnore();
    for (const f of state.files) {
      seen.add(f.name);
      if (prot.has(f.name)) continue;
      const hv = await fileHash(f);
      if (!(f.name in snap)) out.push({ st: 'A', f, name: f.name, hash: hv });
      else if (snap[f.name] !== hv) out.push({ st: 'M', f, name: f.name, hash: hv });
    }
    Object.keys(snap).forEach((k) => { if (!seen.has(k)) out.push({ st: 'D', name: k }); });
    out.sort((a, b) => byName(a.name, b.name));
    return out;
  }

  async function ghApi(path, method, body) {
    const token = ghToken();
    if (!token) throw new Error('Connect your GitHub account first.');
    let res;
    try {
      res = await fetch('https://api.github.com' + path, {
        method: method || 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (_) { throw new Error('No connection to GitHub.'); }
    let data = null;
    try { data = await res.json(); } catch (_) { /* sin cuerpo */ }
    if (!res.ok) {
      const hint = res.status === 401 ? ' (invalid or expired token)' : (res.status === 404 ? ' (not found, or the token has no access)' : (res.status === 403 || res.status === 429 ? ' (limit or token permissions)' : (res.status === 422 ? ' (invalid data or it already exists)' : '')));
      throw new Error(`GitHub ${res.status}${hint}: ${(data && data.message) || ''}`.trim());
    }
    return data;
  }

  function gitNote(text, bad) {
    git.note = text || '';
    git.noteErr = !!bad;
    const el = $('git-note');
    if (el) { el.textContent = git.note; el.classList.toggle('error', git.noteErr); }
  }

  async function gitRun(label, fn) {
    if (git.busy) return;
    git.busy = true;
    gitNote(label);
    const body = $('git-body');
    if (body) body.classList.add('busy');
    try { await fn(); }
    catch (e) { gitNote((e && e.message) || String(e), true); }
    finally {
      git.busy = false;
      if (body) body.classList.remove('busy');
      const keep = git.note; const bad = git.noteErr;
      await renderGit();
      gitNote(keep, bad);
    }
  }

  async function ghEntries(changes) {
    const entries = [];
    for (const c of changes) {
      if (c.st === 'D') { entries.push({ path: c.name, mode: '100644', type: 'blob', sha: null }); continue; }
      const f = c.f;
      if (f.binary) {
        const blob = await ghApi(`/repos/${curProj().gh.repo}/git/blobs`, 'POST', { content: await blobToBase64(await getBlob(f)), encoding: 'base64' });
        entries.push({ path: c.name, mode: '100644', type: 'blob', sha: blob.sha });
      } else {
        const text = await getText(f);
        if (text === '') {
          const blob = await ghApi(`/repos/${curProj().gh.repo}/git/blobs`, 'POST', { content: '', encoding: 'utf-8' });
          entries.push({ path: c.name, mode: '100644', type: 'blob', sha: blob.sha });
        } else entries.push({ path: c.name, mode: '100644', type: 'blob', content: text });
      }
    }
    return entries;
  }

  async function ghCommitPush(message) {
    const p = curProj();
    const gh = p.gh;
    const changes = await computeChanges();
    if (!changes.length) { gitNote('No changes to push.'); return; }
    if (!(await guardCheck(changes))) { gitNote('Push cancelled by GitGuard.', true); return; }
    if (!changes.length) { gitNote('All changes were protected by GitGuard; nothing was pushed.'); return; }
    const repo = gh.repo;
    const branch = gh.branch || 'main';
    gitNote('Reading the branch…');
    const ref = await ghApi(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    const parent = ref.object.sha;
    const pc = await ghApi(`/repos/${repo}/git/commits/${parent}`);
    gitNote(`Preparing ${changes.length} file(s)…`);
    const entries = await ghEntries(changes);
    const tree = await ghApi(`/repos/${repo}/git/trees`, 'POST', { base_tree: pc.tree.sha, tree: entries });
    if (tree.sha === pc.tree.sha) { gitNote('GitHub already has exactly these files.'); return; }
    gitNote('Creating the commit…');
    const commit = await ghApi(`/repos/${repo}/git/commits`, 'POST', { message: message || 'Update from CodeCraft', tree: tree.sha, parents: [parent] });
    await ghApi(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, 'PATCH', { sha: commit.sha });
    gh.snap = gh.snap || {};
    gh.shas = gh.shas || {};
    changes.forEach((c) => { if (c.st === 'D') { delete gh.snap[c.name]; delete gh.shas[c.name]; } else gh.snap[c.name] = c.hash; });
    (tree.tree || []).forEach((t) => { if (t.type === 'blob' && t.path in gh.snap) gh.shas[t.path] = t.sha; });
    persistProjects();
    git.msg = '';
    toast(`Pushed to GitHub: ${repo}@${branch} (${commit.sha.slice(0, 7)})`, 'ok');
    toast(`GitHub: commit ${commit.sha.slice(0, 7)} on ${repo}@${branch}`, 'ok');
    gitNote(`✔ Commit ${commit.sha.slice(0, 7)} pushed to ${repo}@${branch}`);
  }

  async function ghFetchBlobs(repo, list, onProgress) {
    const items = [];
    let next = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= list.length) return;
        const t = list[i];
        const b = await ghApi(`/repos/${repo}/git/blobs/${t.sha}`);
        const bin = atob((b.content || '').replace(/\n/g, ''));
        const u8 = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
        items.push({ path: t.path, blob: new Blob([u8]), sha: t.sha });
        if (onProgress) onProgress(++done);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    return items;
  }

  async function ghRemoteBlobs(repo, branch) {
    const tree = await ghApi(`/repos/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const blobs = (tree.tree || []).filter((t) => t.type === 'blob' && (t.size || 0) <= 5 * 1024 * 1024);
    return { blobs, truncated: !!tree.truncated };
  }

  async function ghRecordSnapshot(shaByPath) {
    const gh = curProj().gh;
    gh.snap = gh.snap || {};
    gh.shas = gh.shas || {};
    for (const f of state.files) {
      if (f.name in shaByPath) { gh.snap[f.name] = await fileHash(f); gh.shas[f.name] = shaByPath[f.name]; }
    }
    persistProjects();
  }

  async function ghClone(repo, branchIn) {
    const info = await ghApi(`/repos/${repo}`);
    const branch = branchIn || info.default_branch || 'main';
    gitNote('Reading the repository tree…');
    const { blobs, truncated } = await ghRemoteBlobs(repo, branch);
    if (blobs.length > 400 && !window.confirm(`The repository has ${blobs.length} files. Clone anyway?`)) return;
    if (truncated) toast('The repository is very large: GitHub returned a partial list.', 'err');
    await createProject(info.name, null);
    curProj().gh = { repo: info.full_name, branch, snap: {}, shas: {} };
    persistProjects();
    const items = await ghFetchBlobs(info.full_name, blobs, (n) => gitNote(`Downloading ${n}/${blobs.length}…`));
    await importFiles(items, { raw: true, quiet: true });
    const map = {};
    items.forEach((it) => { map[normalizePath(it.path)] = it.sha; });
    await ghRecordSnapshot(map);
    toast(`Cloned ${info.full_name} (${items.length} files)`, 'ok');
  }

  async function ghPull() {
    const p = curProj();
    const gh = p.gh;
    const branch = gh.branch || 'main';
    gitNote('Comparing with GitHub…');
    const { blobs } = await ghRemoteBlobs(gh.repo, branch);
    gh.snap = gh.snap || {};
    gh.shas = gh.shas || {};
    const fetchList = [];
    const conflicts = [];
    for (const t of blobs) {
      const local = state.files.find((f) => f.name === t.path);
      if (!local) { fetchList.push(t); continue; }
      if (gh.shas[t.path] === t.sha) continue;
      const changedLocal = gh.snap[t.path] !== await fileHash(local);
      if (!changedLocal) fetchList.push(t);
      else if (gh.shas[t.path]) conflicts.push(t.path);
    }
    if (!fetchList.length) { gitNote(conflicts.length ? `No new changes to pull. Conflicts (you changed it and GitHub did too): ${conflicts.join(', ')}` : 'You are up to date with GitHub.'); return; }
    if (fetchList.length > 300 && !window.confirm(`${fetchList.length} files will be pulled. Continue?`)) return;
    const items = await ghFetchBlobs(gh.repo, fetchList, (n) => gitNote(`Downloading ${n}/${fetchList.length}…`));
    await importFiles(items, { raw: true, replace: true, quiet: true });
    const map = {};
    items.forEach((it) => { map[normalizePath(it.path)] = it.sha; });
    await ghRecordSnapshot(map);
    gitNote(`✔ Pulled ${items.length} file(s).` + (conflicts.length ? ` Left untouched because of conflicts: ${conflicts.join(', ')}` : ''));
    toast(`Pulled ${items.length} file(s) from GitHub`, 'ok');
  }

  async function ghPublish(name, desc, priv) {
    const data = await ghApi('/user/repos', 'POST', { name, description: desc || undefined, private: !!priv, auto_init: true });
    curProj().gh = { repo: data.full_name, branch: data.default_branch || 'main', snap: {}, shas: {} };
    persistProjects();
    gitNote(`Repository ${data.full_name} created. Uploading the files…`);
    await ghCommitPush('First commit from CodeCraft');
  }

  async function aiCommitMessage() {
    const provider = hasKey('gemini') ? 'gemini' : (hasKey('openrouter') ? 'openrouter' : null);
    if (!provider) { gitNote('Save a Gemini or OpenRouter key in API settings.', true); return; }
    if (!git.changes.length) { gitNote('No changes.'); return; }
    let txt = git.changes.slice(0, 15).map((c) => `${c.st} ${c.name}`).join('\n');
    for (const c of git.changes.filter((x) => x.st !== 'D' && x.f && !x.f.binary).slice(0, 4)) txt += `\n\n--- ${c.name} ---\n${(await getText(c.f)).slice(0, 700)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    gitNote('Writing the message…');
    try {
      const r = await callWithFallback(provider, [{ role: 'user', text: 'Write ONLY a commit message in English, imperative mood, at most 72 characters, for these changes (A=new, M=modified, D=deleted):\n' + txt }], ctrl.signal);
      git.msg = r.text.trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').slice(0, 100);
      const ta = $('git-msg');
      if (ta) ta.value = git.msg;
      gitNote('');
    } catch (e) { gitNote(friendlyError(e, false), true); }
    finally { clearTimeout(timer); }
  }

  function gitConnectForm(body, errText) {
    const tok = h('input', { type: 'password', id: 'git-token', placeholder: 'Paste your GitHub token', autocomplete: 'off', spellcheck: 'false' });
    body.replaceChildren(
      h('p', { class: 'dlg-note', text: 'Connect your GitHub account with a personal token (Gemini and OpenRouter cannot access GitHub: the app itself does it). Use a «fine-grained» token only for your repositories, with Contents: Read and write permission (and Administration: Read and write if you want to create repositories from here). It is stored only on this device.' }),
      h('button', { class: 'btn btn-ghost', type: 'button', text: 'Create a token on GitHub ↗', onclick: () => window.open('https://github.com/settings/personal-access-tokens/new', '_blank', 'noopener') }),
      tok,
      h('button', { class: 'btn', type: 'button', text: 'Connect to GitHub', onclick: () => gitRun('Checking the token…', async () => {
        const t = tok.value.trim();
        if (!t) throw new Error('Paste the token first.');
        if (!(await setSecret('github_token', t))) throw new Error('The token was not saved (keys are locked).');
        try { git.user = await ghApi('/user'); } catch (e) { await delSecret('github_token'); git.user = null; throw e; }
        gitNote(`Connected as ${git.user.login}`);
      }) }),
      h('div', { class: 'git-msgline' + (errText ? ' error' : ''), id: 'git-note', text: errText || '' })
    );
  }

  async function renderGit() {
    const body = $('git-body');
    if (!body) return;
    const p = curProj();
    if (!ghToken()) { git.user = null; gitConnectForm(body, ''); return; }
    if (!git.user) {
      try { git.user = await ghApi('/user'); }
      catch (e) { gitConnectForm(body, e.message); return; }
    }
    const nodes = [];
    nodes.push(h('div', { class: 'git-who' }, h('span', null, 'GitHub: ', h('b', { text: '@' + git.user.login })),
      h('button', { class: 'btn btn-ghost sm', type: 'button', style: 'width:auto', text: 'Sign out', onclick: () => { delSecret('github_token'); git.user = null; renderGit(); } })));
    const note = h('div', { class: 'git-msgline', id: 'git-note' });
    const gh = p.gh;
    if (git.mode === 'clone') {
      const repo = h('input', { type: 'text', placeholder: 'user/repository', id: 'git-clone-repo', list: 'git-repos', autocomplete: 'off', spellcheck: 'false' });
      const br = h('input', { type: 'text', placeholder: 'Branch (empty = the default one)', autocomplete: 'off', spellcheck: 'false' });
      nodes.push(h('div', { class: 'git-title', text: 'CLONE REPOSITORY' }), repo, br, h('datalist', { id: 'git-repos' }),
        h('div', { class: 'git-row' },
          h('button', { class: 'btn', type: 'button', text: 'Clone', onclick: () => { const r = repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''); if (!/^[\w.-]+\/[\w.-]+$/.test(r)) { gitNote('Type user/repository.', true); return; } git.mode = 'main'; gitRun('Cloning…', () => ghClone(r, br.value.trim())); } }),
          h('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel', onclick: () => { git.mode = 'main'; renderGit(); } })), note);
      body.replaceChildren(...nodes);
      ghApi('/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator').then((list) => {
        const dl = $('git-repos');
        if (dl) dl.replaceChildren(...list.map((r) => h('option', { value: r.full_name })));
      }).catch(() => {});
      return;
    }
    if (git.mode === 'publish' || git.mode === 'link') {
      const pub = git.mode === 'publish';
      const name = h('input', { type: 'text', value: pub ? slug(p.name) : '', placeholder: pub ? 'repository-name' : 'user/repository', autocomplete: 'off', spellcheck: 'false' });
      const desc = h('input', { type: 'text', placeholder: 'Description (optional)', autocomplete: 'off' });
      const br = h('input', { type: 'text', placeholder: 'Branch (main)', autocomplete: 'off', spellcheck: 'false' });
      const priv = h('input', { type: 'checkbox', checked: true });
      nodes.push(h('div', { class: 'git-title', text: pub ? 'PUBLISH TO GITHUB' : 'LINK EXISTING REPOSITORY' }), name);
      if (pub) nodes.push(desc, h('label', { class: 'git-check' }, priv, 'Private repository')); else nodes.push(br);
      nodes.push(h('div', { class: 'git-row' },
        h('button', { class: 'btn', type: 'button', text: pub ? 'Create and push' : 'Link', onclick: () => {
          if (pub) {
            const n = name.value.trim();
            if (!/^[\w.-]+$/.test(n)) { gitNote('The name can only have letters, numbers, dots, hyphens and underscores.', true); return; }
            git.mode = 'main';
            gitRun('Creating the repository…', () => ghPublish(n, desc.value.trim(), priv.checked));
          } else {
            const r = name.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
            if (!/^[\w.-]+\/[\w.-]+$/.test(r)) { gitNote('Type user/repository.', true); return; }
            git.mode = 'main';
            p.gh = { repo: r, branch: br.value.trim() || 'main', snap: {}, shas: {} };
            persistProjects();
            gitRun('Linked.', async () => {});
          }
        } }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel', onclick: () => { git.mode = 'main'; renderGit(); } })), note);
      body.replaceChildren(...nodes);
      return;
    }
    if (!gh) {
      nodes.push(h('p', { class: 'dlg-note', text: 'This project is not a repository yet.' }),
        h('button', { class: 'btn', type: 'button', text: 'Initialize repository', onclick: () => { p.gh = { branch: 'main', snap: {}, shas: {} }; persistProjects(); renderGit(); } }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Publish to GitHub…', onclick: () => { git.mode = 'publish'; renderGit(); } }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Link an existing repository…', onclick: () => { git.mode = 'link'; renderGit(); } }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Clone a repository…', onclick: () => { git.mode = 'clone'; renderGit(); } }), note);
      body.replaceChildren(...nodes);
      return;
    }
    if (!gh.repo) {
      nodes.push(h('p', { class: 'dlg-note', text: 'Repository initialized (branch main). It is not on GitHub yet.' }),
        h('button', { class: 'btn', type: 'button', text: 'Publish to GitHub…', onclick: () => { git.mode = 'publish'; renderGit(); } }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Link an existing repository…', onclick: () => { git.mode = 'link'; renderGit(); } }), note);
      body.replaceChildren(...nodes);
      return;
    }
    // Repositorio enlazado: cambios + commit
    git.changes = await computeChanges();
    updateGitBadge();
    const msg = h('textarea', { id: 'git-msg', placeholder: 'Commit message', rows: '2' });
    msg.value = git.msg;
    msg.addEventListener('input', () => { git.msg = msg.value; });
    nodes.push(h('div', null, h('div', { class: 'git-repo', text: `${gh.repo}@${gh.branch || 'main'}` })),
      h('div', { class: 'git-title', text: `CHANGES (${git.changes.length})` }));
    if (git.changes.length) {
      nodes.push(h('ul', { class: 'git-changes' }, git.changes.map((c) => h('li', null,
        h('button', { type: 'button', title: c.name, onclick: () => { if (c.f) openFile(c.f.id); } },
          h('span', { class: 'st st-' + c.st, text: c.st }), h('span', { class: 'nm', text: c.name }))))));
    } else nodes.push(h('p', { class: 'dlg-note', text: 'No changes since the last commit.' }));
    nodes.push(guardCard());
    nodes.push(msg,
      h('div', { class: 'git-row' },
        h('button', { class: 'btn', type: 'button', text: 'Commit and push', onclick: () => gitRun('Pushing…', () => ghCommitPush(msg.value.trim())) }),
        h('button', { class: 'btn btn-ghost', type: 'button', style: 'flex:none;width:auto', title: 'Write the message with AI', 'aria-label': 'Write the message with AI', text: '✨', onclick: () => gitRun('', aiCommitMessage) })),
      h('div', { class: 'git-row' },
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Pull changes', onclick: () => gitRun('Pulling…', ghPull) }),
        h('button', { class: 'btn btn-ghost', type: 'button', text: 'Open on GitHub ↗', onclick: () => window.open('https://github.com/' + gh.repo, '_blank', 'noopener') })),
      note);
    body.replaceChildren(...nodes);
  }

  function updateGitBadge() {
    const b = $('git-badge');
    if (!b) return;
    const n = git.changes.length;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  }

  function scheduleGit() {
    clearTimeout(git.timer);
    git.timer = setTimeout(async () => {
      const p = curProj();
      if (!p || !p.gh || !p.gh.repo) { git.changes = []; updateGitBadge(); return; }
      const body = $('git-body');
      if (isOpen('git') && !git.busy && !(body && body.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))) await renderGit();
      else { git.changes = await computeChanges(); updateGitBadge(); }
    }, 900);
  }

  // ---------------------------------------------------------------
  // Abrir archivo rápido (Ctrl+P), paleta (Ctrl+Shift+P) y buscar en archivos
  // ---------------------------------------------------------------
  const qo = { dlg: $('qo-dlg'), input: $('qo-input'), list: $('qo-list'), items: [], sel: 0 };

  function fuzzyScore(q, name) {
    const n = name.toLowerCase();
    const b = baseName(n);
    if (!q) return 1;
    if (b.startsWith(q)) return 1000 - b.length;
    if (b.includes(q)) return 800 - b.length;
    if (n.includes(q)) return 600 - n.length;
    let i = 0;
    for (const c of n) { if (c === q[i]) i++; if (i === q.length) return 300 - n.length; }
    return 0;
  }

  function paletteCommands() {
    const out = [];
    const seen = new Set();
    MENUS.forEach((m) => m.items.forEach((it) => {
      if (it === '-' || seen.has(it.label)) return;
      if ((it.hidden && it.hidden()) || (it.disabled && it.disabled())) return;
      seen.add(it.label);
      out.push({ label: it.label, key: it.key || '', action: it.action, group: m.label });
    }));
    return out;
  }

  function renderPalette() {
    const raw = qo.input.value;
    qo.list.replaceChildren();
    qo.items = [];
    if (raw.startsWith('$')) {
      const cmd = raw.slice(1).trim();
      if (cmd) qo.items.push({ title: 'Run in terminal: ' + cmd, sub: 'Terminal', run: () => { termExecLine(cmd); } });
    } else if (raw.startsWith('>')) {
      const q = raw.slice(1).trim().toLowerCase();
      paletteCommands().filter((c) => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)).slice(0, 40)
        .forEach((c) => qo.items.push({ title: c.label, sub: c.group + (c.key ? '  ·  ' + c.key : ''), run: () => runAction(c.action) }));
    } else {
      const q = raw.trim().toLowerCase();
      state.files.map((f) => ({ f, s: fuzzyScore(q, f.name) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40)
        .forEach((x) => qo.items.push({ title: baseName(x.f.name), sub: x.f.name + (isDirtyId(x.f.id) ? '  ●' : ''), run: () => openFile(x.f.id).then(focusEd) }));
    }
    if (!qo.items.length) qo.list.appendChild(h('li', { class: 'files-empty', text: raw.startsWith('$') ? 'Type a terminal command after $ (try: $ help)' : (raw.startsWith('>') ? 'No commands.' : 'No matching files.') }));
    qo.items.forEach((it, i) => {
      const b = h('button', { type: 'button', class: i === 0 ? 'sel' : '', role: 'option', onclick: () => pickPalette(i) }, it.title, h('small', { text: it.sub }));
      qo.list.appendChild(h('li', { role: 'none' }, b));
    });
    qo.sel = 0;
  }

  function movePalette(d) {
    const btns = qo.list.querySelectorAll('button');
    if (!btns.length) return;
    btns[qo.sel] && btns[qo.sel].classList.remove('sel');
    qo.sel = (qo.sel + d + btns.length) % btns.length;
    btns[qo.sel].classList.add('sel');
    btns[qo.sel].scrollIntoView({ block: 'nearest' });
  }

  function pickPalette(i) {
    const it = qo.items[i];
    if (!it) return;
    qo.dlg.close();
    setTimeout(it.run, 40);
  }

  function openPalette(prefill) {
    qo.input.value = prefill || '';
    renderPalette();
    qo.dlg.showModal();
    qo.input.focus();
  }

  const sr = { input: $('sr-input'), list: $('sr-list'), status: $('sr-status'), cs: false, re: false, run: 0, timer: null };

  async function runSearch() {
    const my = ++sr.run;
    sr.list.replaceChildren();
    const q = sr.input.value;
    if (!q) { sr.status.textContent = ''; return; }
    let re;
    try { re = new RegExp(sr.re ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), sr.cs ? '' : 'i'); }
    catch (_) { sr.status.textContent = 'Invalid regular expression'; return; }
    let hits = 0;
    let filesHit = 0;
    let scanned = 0;
    for (const f of state.files) {
      if (my !== sr.run) return;
      if (f.binary) continue;
      const text = await getText(f);
      if (++scanned % 15 === 0) await new Promise((r) => setTimeout(r, 0));
      const lines = text.split('\n');
      let hitInFile = false;
      for (let i = 0; i < lines.length && hits < 300; i++) {
        const m = re.exec(lines[i]);
        if (!m) continue;
        hits++;
        hitInFile = true;
        const li = h('li', { role: 'none' }, h('button', { type: 'button', onclick: () => openSearchHit(f, i, m.index, m[0].length) },
          lines[i].trim().slice(0, 160) || '(blank line)', h('small', { text: `${f.name}:${i + 1}` })));
        sr.list.appendChild(li);
      }
      if (hitInFile) filesHit++;
      if (hits >= 300) break;
    }
    if (my !== sr.run) return;
    sr.status.textContent = hits ? `${hits}${hits >= 300 ? '+' : ''} result(s) in ${filesHit} file(s)` : 'No results';
  }

  async function openSearchHit(f, lineIdx, col, len) {
    if (!WIDE.matches) { state.overlay = null; applyLayout(); }
    await openFile(f.id);
    if (f.binary) return;
    const v = els.editor.value;
    let pos = 0;
    for (let i = 0; i < lineIdx; i++) { const nx = v.indexOf('\n', pos); if (nx === -1) break; pos = nx + 1; }
    els.editor.focus();
    els.editor.setSelectionRange(pos + col, pos + col + len);
    reveal(pos + col);
    schedulePos();
  }

  function openSearch() {
    const ed = els.editor;
    const sel = hasEditor() ? ed.value.slice(ed.selectionStart, ed.selectionEnd) : '';
    if (sel && !sel.includes('\n') && sel.length < 120) sr.input.value = sel;
    setPanel('search', true);
    sr.input.focus();
    sr.input.select();
    runSearch();
  }

  // ---------------------------------------------------------------
  // Resaltado de sintaxis ligero (solo las líneas visibles)
  // ---------------------------------------------------------------
  const hlEl = { inner: $('hl-inner'), raf: 0, lines: null, lineVal: null, blocks: null, blockTimer: null, key: '' };
  const FAM = {
    js: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'kt', 'swift'],
    py: ['py', 'rb', 'sh', 'bash', 'zsh', 'yml', 'yaml', 'toml', 'ini', 'env', 'conf'],
    css: ['css', 'scss', 'less'], html: ['html', 'htm', 'xml', 'svg', 'vue'], json: ['json', 'jsonc'], md: ['md', 'markdown']
  };
  const famOf = (name) => { const e = extOf(name); for (const k of Object.keys(FAM)) if (FAM[k].includes(e)) return k; return null; };
  const KW_JS = new Set('abstract async await boolean break case catch class const continue debugger default delete do else enum export extends false final finally for from function get if implements import in instanceof interface let new null of package private protected public return set static super switch this throw true try type typeof undefined var void while with yield int long float double char string byte short struct fn pub mut impl use mod match loop self Self where trait func defer go chan map range package namespace using foreach elif echo'.split(' '));
  const KW_PY = new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield print self then fi do done esac function export local source alias unset true false null'.split(' '));
  const escH = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sp = (c, s) => `<span class="${c}">${escH(s)}</span>`;

  const RE_JS = /(\/\/[^\n]*)|(\/\*)|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?)|(\b0x[\da-fA-F]+\b|\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  const RE_PY = /(#[^\n]*)|("""|''')|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)|(\b\d[\d_]*\.?\d*\b)|([A-Za-z_][\w]*)/g;
  const RE_CSS = /(\/\*)|("[^"]*"?|'[^']*'?)|(#[\da-fA-F]{3,8}\b)|(-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)|(@[\w-]+)|([\w-]+)(?=\s*:)|([.#][\w-]+)/g;
  const RE_HTML = /(<!--)|(<\/?[A-Za-z][\w:-]*)|(\s[\w:@.-]+(?==))|("[^"]*"?|'[^']*'?)|(\/?>)/g;
  const RE_JSON = /("(?:\\.|[^"\\])*"?)(\s*:)?|(-?\b\d[\d.eE+-]*\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

  // Devuelve { html, block } para una línea. block = sigue dentro de un comentario de varias líneas
  function hlLine(line, fam, inBlock) {
    if (line.length > 4000) return { html: escH(line), block: inBlock };
    if (fam === 'md') {
      if (/^#{1,6}\s/.test(line)) return { html: sp('tk-k', line), block: false };
      if (/^\s*(```|~~~)/.test(line)) return { html: sp('tk-c', line), block: false };
      return { html: escH(line).replace(/`[^`]+`/g, (m) => `<span class="tk-s">${m}</span>`), block: false };
    }
    const closeTok = fam === 'html' ? '-->' : '*/';
    let out = '';
    let last = 0;
    if (inBlock) {
      const e = line.indexOf(closeTok);
      if (e === -1) return { html: sp('tk-c', line), block: true };
      out += sp('tk-c', line.slice(0, e + closeTok.length));
      last = e + closeTok.length;
      inBlock = false;
    }
    const re = fam === 'js' ? RE_JS : fam === 'py' ? RE_PY : fam === 'css' ? RE_CSS : fam === 'html' ? RE_HTML : RE_JSON;
    re.lastIndex = last;
    let m;
    while ((m = re.exec(line)) !== null) {
      out += escH(line.slice(last, m.index));
      last = re.lastIndex;
      let cls = '';
      if (fam === 'js') {
        if (m[1]) cls = 'tk-c';
        else if (m[2]) {
          const e = line.indexOf('*/', m.index + 2);
          if (e === -1) { out += sp('tk-c', line.slice(m.index)); last = line.length; inBlock = true; break; }
          out += sp('tk-c', line.slice(m.index, e + 2)); last = e + 2; re.lastIndex = last; continue;
        } else if (m[3]) cls = 'tk-s';
        else if (m[4]) cls = 'tk-n';
        else if (KW_JS.has(m[5])) cls = 'tk-k';
        else if (line[re.lastIndex] === '(') cls = 'tk-f';
        else if (/^[A-Z]/.test(m[5])) cls = 'tk-t';
      } else if (fam === 'py') {
        if (m[1]) cls = 'tk-c';
        else if (m[2]) { const e = line.indexOf(m[2], m.index + 3); const end = e === -1 ? line.length : e + 3; out += sp('tk-s', line.slice(m.index, end)); last = end; re.lastIndex = end; continue; }
        else if (m[3]) cls = 'tk-s';
        else if (m[4]) cls = 'tk-n';
        else if (KW_PY.has(m[5])) cls = 'tk-k';
        else if (line[re.lastIndex] === '(') cls = 'tk-f';
      } else if (fam === 'css') {
        if (m[1]) {
          const e = line.indexOf('*/', m.index + 2);
          if (e === -1) { out += sp('tk-c', line.slice(m.index)); last = line.length; inBlock = true; break; }
          out += sp('tk-c', line.slice(m.index, e + 2)); last = e + 2; re.lastIndex = last; continue;
        } else if (m[2]) cls = 'tk-s';
        else if (m[3] || m[4]) cls = 'tk-n';
        else if (m[5]) cls = 'tk-k';
        else if (m[6]) cls = 'tk-p';
        else if (m[7]) cls = 'tk-t';
      } else if (fam === 'html') {
        if (m[1]) {
          const e = line.indexOf('-->', m.index + 4);
          if (e === -1) { out += sp('tk-c', line.slice(m.index)); last = line.length; inBlock = true; break; }
          out += sp('tk-c', line.slice(m.index, e + 3)); last = e + 3; re.lastIndex = last; continue;
        } else if (m[2]) cls = 'tk-t';
        else if (m[3]) cls = 'tk-p';
        else if (m[4]) cls = 'tk-s';
        else if (m[5]) cls = 'tk-t';
      } else { // json
        if (m[1]) cls = m[2] ? 'tk-p' : 'tk-s';
        else if (m[3]) cls = 'tk-n';
        else if (m[4]) cls = 'tk-k';
      }
      out += cls ? sp(cls, m[0]) : escH(m[0]);
    }
    out += escH(line.slice(last));
    return { html: out, block: inBlock };
  }

  const hlActive = () => prefs.hl !== false && !prefs.wrap && hasEditor() && !!famOf(state.current.name) && els.editor.value.length < 3000000;

  function updateHLState() {
    const on = hlActive();
    els.editorWrap.classList.toggle('hl-on', on);
    if (!on) els.editorWrap.classList.remove('hl-ok');
    hlEl.key = '';
    if (on) scheduleHL(); else hlEl.inner.textContent = '';
  }

  function scheduleHL() {
    if (hlEl.raf || !els.editorWrap.classList.contains('hl-on')) return;
    hlEl.raf = requestAnimationFrame(() => { hlEl.raf = 0; renderHL(); });
  }

  function computeBlocks(lines, fam) {
    // Estado de "dentro de comentario" al inicio de cada línea (solo si el archivo tiene comentarios multilínea)
    const v = hlEl.lineVal;
    const has = fam === 'html' ? v.includes('<!--') : ((fam === 'js' || fam === 'css') && v.includes('/*'));
    if (!has || lines.length > 30000) { hlEl.blocks = null; return; }
    const arr = new Array(lines.length);
    let b = false;
    for (let i = 0; i < lines.length; i++) { arr[i] = b; b = hlLine(lines[i], fam, b).block; }
    hlEl.blocks = arr;
  }

  function renderHL() {
    if (!hlActive()) { updateHLState(); return; }
    const ed = els.editor;
    const fam = famOf(state.current.name);
    const v = ed.value;
    if (hlEl.lineVal !== v) {
      hlEl.lineVal = v;
      hlEl.lines = v.split('\n');
      hlEl.key = '';
      clearTimeout(hlEl.blockTimer);
      hlEl.blockTimer = setTimeout(() => { computeBlocks(hlEl.lines, fam); hlEl.key = ''; scheduleHL(); }, 180);
      if (!hlEl.blocks) computeBlocks(hlEl.lines, fam);
    }
    const lh = prefs.fs * 1.6;
    const first = Math.max(0, Math.floor((ed.scrollTop - 16) / lh) - 1);
    const count = Math.ceil(ed.clientHeight / lh) + 4;
    const key = first + ':' + count + ':' + fam + ':' + v.length;
    if (key !== hlEl.key) {
      hlEl.key = key;
      const out = [];
      let b = hlEl.blocks ? !!hlEl.blocks[first] : false;
      for (let i = first; i < Math.min(hlEl.lines.length, first + count); i++) {
        const r = hlLine(hlEl.lines[i], fam, b);
        out.push(r.html);
        b = r.block;
      }
      hlEl.inner.innerHTML = out.join('\n');
    }
    hlEl.inner.style.transform = `translate(${-ed.scrollLeft}px, ${16 + first * lh - ed.scrollTop}px)`;
    if (!els.editorWrap.classList.contains('hl-ok')) els.editorWrap.classList.add('hl-ok');
  }

  // ---------------------------------------------------------------
  // Vista previa (servida por el Service Worker, como un mini servidor)
  // ---------------------------------------------------------------
  const pv = { frame: $('preview-frame'), pane: $('preview'), split: $('h-prev'), timer: null, nav: null, navFor: null, shown: false };
  const previewOpen = () => !pv.pane.hidden;

  function previewEntry() {
    if (pv.nav && pv.navFor === (state.current && state.current.id) && state.files.some((f) => f.name === pv.nav)) return pv.nav;
    if (state.current && /\.html?$/i.test(state.current.name)) return state.current.name;
    const idx = state.files.find((f) => f.name === 'index.html') || state.files.find((f) => /\.html?$/i.test(f.name));
    return idx ? idx.name : null;
  }

  // ---- Vista previa AISLADA (por defecto): sin acceso a tus llaves ni a los datos de la app ----
  const PV_MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon', css: 'text/css', js: 'text/javascript', json: 'application/json', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm', wav: 'audio/wav', txt: 'text/plain' };
  const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
  function resolveRef(base, ref) {
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref.trim())) return null;
    let r = ref.trim().split('#')[0].split('?')[0];
    if (!r) return null;
    try { r = decodeURIComponent(r); } catch (_) { /* nada */ }
    const out = [];
    for (const x of (r.startsWith('/') ? r.slice(1) : base + r).split('/')) { if (x === '.' || x === '') continue; if (x === '..') out.pop(); else out.push(x); }
    return out.join('/');
  }
  const pvFile = (p) => state.files.find((f) => f.name === p);
  async function pvText(p) { const f = pvFile(p); if (!f || f.binary) return null; return isCurrent(f) ? els.editor.value : await getText(f); }
  async function pvData(p) {
    const f = pvFile(p);
    if (!f || (f.size || 0) > 8 * 1048576) return null;
    const blob = await getBlob(f);
    const typed = new Blob([blob], { type: PV_MIME[extOf(p)] || blob.type || 'application/octet-stream' });
    return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(typed); });
  }
  async function replaceAsync(str, re, fn) {
    const m = [...str.matchAll(re)];
    const rs = await Promise.all(m.map((x) => fn(...x)));
    let i = 0;
    return str.replace(re, () => rs[i++]);
  }
  async function pvCss(css, base) {
    return replaceAsync(css, /url\(\s*(["']?)([^)"']+)\1\s*\)/gi, async (all, q, ref) => {
      const p = resolveRef(base, ref); if (!p) return all;
      const d = await pvData(p); return d ? `url("${d}")` : all;
    });
  }
  const PV_BRIDGE = '<script>(function(){var P=function(t,l,x){try{parent.postMessage({cc:t,lvl:l,text:x},"*")}catch(e){}};'
    + '["log","info","warn","error","debug"].forEach(function(k){var o=console[k];console[k]=function(){var a=[].slice.call(arguments).map(function(v){try{return typeof v==="string"?v:(v instanceof Error?(v.stack||String(v)):JSON.stringify(v))}catch(e){return String(v)}}).join(" ");P("console",k,a);try{o.apply(console,arguments)}catch(e){}}});'
    + 'addEventListener("error",function(e){P("console","error",(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});'
    + 'addEventListener("unhandledrejection",function(e){P("console","error","Unhandled promise: "+((e.reason&&e.reason.message)||e.reason))});'
    + 'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");if(!h||/^(?:[a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(h))return;e.preventDefault();P("nav",null,h)},true);})();</scr' + 'ipt>';
  async function buildSafeHtml(entry) {
    let html = await pvText(entry);
    if (html == null) return '<body>Cannot preview ' + entry + '</body>';
    const base = dirOf(entry);
    html = await replaceAsync(html, /<link\b[^>]*>/gi, async (tag) => {
      const href = (tag.match(/\shref\s*=\s*(["'])(.*?)\1/i) || [])[2];
      const p = resolveRef(base, href);
      if (!p || !pvFile(p)) return tag;
      if (/rel\s*=\s*["']?stylesheet/i.test(tag)) {
        const css = await pvText(p); if (css == null) return tag;
        return '<style>' + (await pvCss(css, dirOf(p))).replace(/<\/style/gi, '<\\/style') + '</style>';
      }
      const d = await pvData(p); return d ? tag.replace(href, d) : tag;
    });
    html = await replaceAsync(html, /<script\b([^>]*?)\ssrc\s*=\s*(["'])(.*?)\2([^>]*)>\s*<\/script>/gi, async (all, a, q, src, b) => {
      const p = resolveRef(base, src);
      if (!p) return all;
      const js = await pvText(p); if (js == null) return all;
      return '<script' + a + b + '>' + js.replace(/<\/script/gi, '<\\/script') + '</scr' + 'ipt>';
    });
    html = await replaceAsync(html, /(<(?:img|source|video|audio|track|input)\b[^>]*?\s(?:src|poster)\s*=\s*)(["'])(.*?)\2/gi, async (all, pre, q, ref) => {
      const p = resolveRef(base, ref); if (!p) return all;
      const d = await pvData(p); return d ? pre + q + d + q : all;
    });
    html = await replaceAsync(html, /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, async (all, a, css, c) => a + (await pvCss(css, base)) + c);
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + PV_BRIDGE);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + PV_BRIDGE);
    return PV_BRIDGE + html;
  }

  async function refreshPreview() {
    if (!previewOpen()) return;
    const entry = previewEntry();
    if (!entry) { pv.frame.removeAttribute('src'); pv.frame.srcdoc = '<body style="font-family:system-ui;color:#888">Open or create an .html file in the project to see it here.</body>'; return; }
    pv.shown = false;
    if (prefs.pvmode !== 'full') {
      pv.frame.removeAttribute('srcdoc');
      pv.frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
      let html;
      try { html = await buildSafeHtml(entry); } catch (e) { toast('Preview error: ' + ((e && e.message) || e), 'err'); return; }
      pv.frame.onload = () => { try { pv.frame.contentWindow.postMessage({ html }, '*'); } catch (_) { /* nada */ } };
      pv.frame.src = 'preview-sandbox.html?t=' + Date.now();
      return;
    }
    if (!('serviceWorker' in navigator)) { toast('The full preview needs the Service Worker (open the app from http://localhost or https).', 'err'); return; }
    const reg = await navigator.serviceWorker.ready;
    const files = {};
    state.files.forEach((f) => { if (!f.binary && (isDirtyId(f.id))) files[f.name] = isCurrent(f) ? els.editor.value : state.buffers.get(f.id); });
    if (reg.active) reg.active.postMessage({ type: 'preview-files', pid: state.project.id, files });
    const base = new URL('./__preview/', location.href).href;
    pv.frame.onload = null;
    pv.frame.removeAttribute('srcdoc');
    pv.frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups');
    pv.frame.src = base + encodeURIComponent(state.project.id) + '/' + entry.split('/').map(encodeURIComponent).join('/') + '?t=' + Date.now();
  }

  window.addEventListener('message', (e) => {
    if (e.source !== pv.frame.contentWindow || !e.data || typeof e.data !== 'object') return;
    const d = e.data;
    if (d.cc === 'console') {
      const bad = d.lvl === 'error';
      tprint('[preview] ' + String(d.text).slice(0, 2000), bad ? 'err' : d.lvl === 'warn' ? 'warn' : '');
      if (bad && !pv.shown) { pv.shown = true; if (!termVisible()) setPanel('terminal', true); }
    } else if (d.cc === 'nav' && typeof d.text === 'string') {
      const p = resolveRef(dirOf(previewEntry() || ''), d.text);
      if (p && state.files.some((f) => f.name === p)) { pv.nav = p; pv.navFor = state.current && state.current.id; refreshPreview(); }
      else toast('That page is not in the project: ' + d.text, 'err');
    }
  });

  function applyPreviewDevice() {
    const w = prefs.pdev || 0;
    pv.frame.style.width = w ? w + 'px' : '100%';
    pv.frame.style.maxWidth = '100%';
    pv.frame.style.margin = w ? '0 auto' : '0';
    pv.frame.style.boxShadow = w ? '0 0 0 1px var(--border-glow)' : 'none';
  }

  function refreshPreviewSoon() {
    if (!previewOpen()) return;
    clearTimeout(pv.timer);
    pv.timer = setTimeout(refreshPreview, 500);
  }

  function setPreview(on) {
    if (on && prefs.pvmode === 'full' && store.get('cc_preview_ok') !== 'yes') {
      if (!window.confirm('Full preview runs your project with the SAME access as the app (including saved data). Use it only with code you wrote or reviewed. The safe preview does not have this access.\n\nContinue?')) { prefs.pvmode = 'safe'; savePrefs(); return; }
      store.set('cc_preview_ok', 'yes');
    }
    pv.pane.hidden = !on;
    pv.split.hidden = !on;
    prefs.preview = on;
    savePrefs();
    if (on) { pv.pane.style.setProperty('--pw', (prefs.pw || 480) + 'px'); applyPreviewDevice(); refreshPreview(); } else pv.frame.removeAttribute('src');
    syncToggles();
    requestAnimationFrame(syncGutter);
  }

  // ===============================================================
  // Historial local (como VS Code), comparación, snippets, formato y avisos de sintaxis
  // ===============================================================
  const HIST_MAX = 30;
  let histForce = false;
  async function histPush(meta, text) {
    const force = histForce;
    if (!state.dbOK || !meta || meta.binary || typeof text !== 'string' || text.length > 400000) return;
    try {
      const rec = (await idb.get('meta', 'hist:' + meta.id)) || { key: 'hist:' + meta.id, list: [] };
      const last = rec.list[rec.list.length - 1];
      if (last && last.text === text) return;
      if (!force && last && last.auto && Date.now() - last.t < 60000) last.text = text; else rec.list.push({ t: Date.now(), text, auto: !force });
      while (rec.list.length > HIST_MAX) rec.list.shift();
      await idb.put('meta', rec);
    } catch (_) { /* el historial nunca debe romper el guardado */ }
  }

  function lineDiff(a, b) {
    const A = a.split('\n'), B = b.split('\n');
    let p = 0;
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    let qa = A.length, qb = B.length;
    while (qa > p && qb > p && A[qa - 1] === B[qb - 1]) { qa--; qb--; }
    const a2 = A.slice(p, qa), b2 = B.slice(p, qb), n = a2.length, m = b2.length;
    if (n * m > 4e6) return null;
    const w = m + 1, dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * w + j] = a2[i] === b2[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    const out = [];
    for (let i = 0; i < p; i++) out.push({ t: '=', s: A[i] });
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { out.push({ t: '=', s: a2[i] }); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ t: '-', s: a2[i++] });
      else out.push({ t: '+', s: b2[j++] });
    }
    while (i < n) out.push({ t: '-', s: a2[i++] });
    while (j < m) out.push({ t: '+', s: b2[j++] });
    for (let k = qa; k < A.length; k++) out.push({ t: '=', s: A[k] });
    return out;
  }
  function diffNode(oldT, newT) {
    const d = lineDiff(oldT, newT);
    const pre = h('pre', { class: 'diff' });
    if (!d) { pre.textContent = 'The files are too different to compare here.'; return pre; }
    if (!d.some((x) => x.t !== '=')) { pre.textContent = 'No differences.'; return pre; }
    const CTX = 2;
    const show = d.map((x, i) => x.t !== '=' || d.slice(Math.max(0, i - CTX), i + CTX + 1).some((y) => y.t !== '='));
    let skipped = 0;
    d.forEach((x, i) => {
      if (!show[i]) { skipped++; return; }
      if (skipped) { pre.append(h('span', { class: 'df-gap', text: `⋯ ${skipped} unchanged line${skipped > 1 ? 's' : ''}\n` })); skipped = 0; }
      pre.append(h('span', { class: x.t === '+' ? 'df-add' : x.t === '-' ? 'df-del' : 'df-eq', text: (x.t === '=' ? '  ' : x.t + ' ') + x.s + '\n' }));
    });
    if (skipped) pre.append(h('span', { class: 'df-gap', text: `⋯ ${skipped} unchanged line${skipped > 1 ? 's' : ''}\n` }));
    return pre;
  }
  async function historyDialog() {
    if (!hasEditor()) { toast('Open a text file first.', 'err'); return; }
    const meta = state.current;
    const rec = state.dbOK ? await idb.get('meta', 'hist:' + meta.id) : null;
    const list = rec ? rec.list.slice().reverse() : [];
    const cur = els.editor.value;
    const view = h('div', { class: 'diff-view' });
    const nodes = [h('p', { class: 'dlg-note', text: list.length ? `Saved versions of ${meta.name}. Compare shows what changed since then (− old, + current).` : 'No saved versions yet. Each time you save, a version is kept here (up to 30).' })];
    list.forEach((v) => {
      nodes.push(h('div', { class: 'hist-row' },
        h('span', { class: 'hist-t', text: new Date(v.t).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + fmtSize(v.text.length) }),
        h('button', { class: 'btn btn-ghost sm', type: 'button', text: 'Compare', onclick: () => { view.replaceChildren(diffNode(v.text, cur)); } }),
        h('button', { class: 'btn btn-ghost sm', type: 'button', text: 'Restore', onclick: () => {
          els.infoDlg.close();
          replaceRange(0, els.editor.value.length, v.text, 0, 0);
          toast('Version restored as an unsaved edit. Ctrl+Z undoes it, Ctrl+S keeps it.', 'ok');
        } })));
    });
    nodes.push(view);
    showInfo('Local history', nodes);
  }

  // ---- Snippets y mini-Emmet (Tab) ----
  const TAB_SNIPS = {
    html: { '!': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${1:Document}</title>\n</head>\n<body>\n  $0\n</body>\n</html>',
      'link:css': '<link rel="stylesheet" href="$0">', 'script:src': '<script src="$0"></script>', 'meta:vp': '<meta name="viewport" content="width=device-width, initial-scale=1">', 'a:blank': '<a href="$0" target="_blank" rel="noopener noreferrer"></a>' },
    js: { log: 'console.log($0);', fn: 'function ${1:name}() {\n  $0\n}', afn: 'const ${1:name} = () => {\n  $0\n};', for: 'for (let i = 0; i < ${1:n}; i++) {\n  $0\n}', forof: 'for (const ${1:item} of ${2:items}) {\n  $0\n}',
      try: 'try {\n  $0\n} catch (err) {\n  console.error(err);\n}', imp: "import ${1:name} from '${2:module}';", cls: 'class ${1:Name} {\n  constructor() {\n    $0\n  }\n}',
      fetch: "const res = await fetch(${1:url});\nif (!res.ok) throw new Error('HTTP ' + res.status);\nconst data = await res.json();$0", qs: "document.querySelector('${1:.selector}')", ael: "${1:el}.addEventListener('${2:click}', (e) => {\n  $0\n});" },
    css: { flex: 'display: flex;\n  align-items: center;\n  justify-content: center;', grid: 'display: grid;\n  grid-template-columns: repeat(${1:3}, 1fr);\n  gap: ${2:1rem};', '@m': '@media (max-width: ${1:768px}) {\n  $0\n}', abs: 'position: absolute;\n  inset: 0;', tr: 'transition: ${1:all} ${2:.2s} ease;' }
  };
  const VOID_TAGS = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
  const EMMET_TAGS = new Set('div span p a ul ol li h1 h2 h3 h4 h5 h6 section article nav header footer main aside button form label input select option textarea table thead tbody tr th td img pre code strong em figure figcaption video audio canvas svg'.split(' '));
  function emmet(abbr) {
    const segs = abbr.split('>');
    if (segs.some((x) => !/^[a-z][a-z0-9-]*(?:[#.][\w-]+)*(?:\*\d{1,2})?(?:\{[^{}]*\})?$/i.test(x))) return null;
    const first = segs[0].match(/^[a-z][a-z0-9-]*/i)[0].toLowerCase();
    if (segs.length === 1 && !/[#.*{]/.test(abbr) && !EMMET_TAGS.has(first)) return null;
    const build = (i, ind) => {
      const m = segs[i].match(/^([a-z][a-z0-9-]*)((?:[#.][\w-]+)*)(?:\*(\d{1,2}))?(?:\{([^{}]*)\})?$/i);
      const tag = m[1].toLowerCase(), cnt = +(m[3] || 1), text = m[4] || '';
      let id = '', cls = [];
      (m[2].match(/[#.][\w-]+/g) || []).forEach((t) => { if (t[0] === '#') id = t.slice(1); else cls.push(t.slice(1)); });
      const attrs = (id ? ` id="${id}"` : '') + (cls.length ? ` class="${cls.join(' ')}"` : '') + (tag === 'a' ? ' href=""' : tag === 'img' ? ' src="" alt=""' : '');
      const pad = '  '.repeat(ind);
      let out = '';
      for (let k = 0; k < cnt; k++) {
        if (VOID_TAGS.has(tag)) out += `${pad}<${tag}${attrs}>\n`;
        else if (i + 1 < segs.length) out += `${pad}<${tag}${attrs}>\n${build(i + 1, ind + 1)}${pad}</${tag}>\n`;
        else out += `${pad}<${tag}${attrs}>${text}</${tag}>\n`;
      }
      return out;
    };
    return build(0, 0).replace(/\n$/, '');
  }
  function snipExpand() {
    const ed = els.editor;
    if (ed.selectionStart !== ed.selectionEnd || !state.current) return false;
    const pos = ed.selectionStart, v = ed.value;
    const ext = extOf(state.current.name);
    const fam = /^html?$/.test(ext) ? 'html' : /^(m?js|jsx|tsx?)$/.test(ext) ? 'js' : /^s?css$/.test(ext) ? 'css' : '';
    if (!fam) return false;
    const m = /[A-Za-z0-9!#.>*:@{}\-_]+$/.exec(v.slice(Math.max(0, pos - 80), pos));
    if (!m) return false;
    const word = m[0], start = pos - word.length;
    if (/[<\/"'=]/.test(v[start - 1] || '')) return false;
    const ls = v.lastIndexOf('\n', start - 1) + 1;
    const indent = (/^[ \t]*/.exec(v.slice(ls, start)) || [''])[0];
    let tpl = TAB_SNIPS[fam][word];
    if (tpl == null && fam === 'html') tpl = emmet(word);
    if (tpl == null) return false;
    tpl = tpl.replace(/\n/g, '\n' + indent);
    let selA = -1, selB = -1, out = '';
    const re = /\$\{1:([^}]*)\}|\$0/g;
    let last = 0, mm, cursor = -1;
    while ((mm = re.exec(tpl))) {
      out += tpl.slice(last, mm.index);
      if (mm[0] === '$0') { if (cursor < 0) cursor = out.length; }
      else if (selA < 0) { selA = out.length; out += mm[1]; selB = out.length; } else out += mm[1];
      last = mm.index + mm[0].length;
    }
    out += tpl.slice(last);
    out = out.replace(/\$\{\d:([^}]*)\}/g, '$1');
    let a, b;
    if (selA >= 0) { a = start + selA; b = start + selB; } else if (cursor >= 0) { a = b = start + cursor; } else { a = b = start + out.length; }
    replaceRange(start, pos, out, a, b);
    return true;
  }

  // ---- Formato (JSON y CSS completos; el resto: limpieza segura) ----
  function formatCss(src) {
    let out = '', ind = 0, i = 0, q = '', paren = 0, buf = '';
    const flush = () => { let t = buf.trim().replace(/\s+/g, ' '); if (ind > 0) t = t.replace(/^([\w-]+)\s*:\s*/, '$1: '); if (t) out += '  '.repeat(ind) + t + '\n'; buf = ''; };
    while (i < src.length) {
      const c = src[i], n = src[i + 1];
      if (q) { buf += c; if (c === '\\') { buf += n || ''; i += 2; continue; } if (c === q) q = ''; i++; continue; }
      if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; flush(); out += '  '.repeat(ind) + src.slice(i, end).trim() + '\n'; i = end; continue; }
      if (c === '"' || c === "'") { q = c; buf += c; i++; continue; }
      if (c === '(') paren++; else if (c === ')') paren = Math.max(0, paren - 1);
      if (c === '{' && !paren) { buf = buf.trim().replace(/\s+/g, ' '); out += '  '.repeat(ind) + buf + (buf ? ' {' : '{') + '\n'; buf = ''; ind++; i++; continue; }
      if (c === '}' && !paren) { { const t = buf.trim(); if (t && !/;$/.test(t)) buf = t + ';'; } flush(); ind = Math.max(0, ind - 1); out += '  '.repeat(ind) + '}\n'; i++; if (ind === 0) out += '\n'; continue; }
      if (c === ';' && !paren) { buf += ';'; flush(); i++; continue; }
      buf += c; i++;
    }
    flush();
    return out.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
  }
  function formatDoc() {
    if (!hasEditor()) return;
    const ed = els.editor, ext = extOf(state.current.name), v = ed.value;
    let out, note = 'Formatted';
    if (ext === 'json') {
      try { out = JSON.stringify(JSON.parse(v), null, 2) + '\n'; } catch (e) { toast('JSON error: ' + e.message, 'err'); return; }
    } else if (ext === 'css' || ext === 'scss') out = formatCss(v);
    else { out = v.replace(/[ \t]+$/gm, '').replace(/\s*$/, '\n'); note = 'Trailing spaces removed and final newline added (full formatting is only available for JSON and CSS)'; }
    if (out === v) { toast('Already formatted.', 'ok'); return; }
    const line = v.slice(0, ed.selectionStart).split('\n').length;
    const top = ed.scrollTop;
    replaceRange(0, v.length, out, 0, 0);
    const lines = out.split('\n'); let off = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length - 1); i++) off += lines[i].length + 1;
    ed.setSelectionRange(off, off);
    ed.scrollTop = top;
    toast(note, 'ok');
  }

  // ---- Avisos de sintaxis (ligeros: JSON exacto; llaves/paréntesis en JS y CSS) ----
  function lintBrackets(text, kind) {
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const stack = [];
    const n = text.length;
    let line = 1, i = 0, last = '';
    const REGEX_OK = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
    const KW = /^(?:return|typeof|case|do|else|in|of|void|delete|throw|new|yield|await)$/;
    const bad = (msg, ln) => ({ line: ln, msg });
    // Lee texto de plantilla desde j hasta la comilla de cierre o un ${ ; devuelve null si no termina
    const scanTpl = (j) => {
      while (j < n) {
        const ch = text[j];
        if (ch === '\n') line++;
        if (ch === '\\') { j += 2; continue; }
        if (ch === '`') return { j: j + 1, end: true };
        if (ch === '$' && text[j + 1] === '{') { stack.push({ ch: '${', line }); return { j: j + 2, end: false }; }
        j++;
      }
      return null;
    };
    while (i < n) {
      const c = text[i], d = text[i + 1];
      if (c === '\n') { line++; i++; continue; }
      if (c === '/' && d === '*') {
        const e = text.indexOf('*/', i + 2);
        const seg = text.slice(i, e < 0 ? n : e + 2);
        if (e < 0) return bad('Unterminated comment', line);
        line += (seg.match(/\n/g) || []).length; i = e + 2; continue;
      }
      if (c === '/' && d === '/' && kind === 'js') { const e = text.indexOf('\n', i); i = e < 0 ? n : e; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && text[j] !== c && text[j] !== '\n') { if (text[j] === '\\') j++; j++; }
        if (text[j] !== c) return bad('Unterminated string', line);
        i = j + 1; last = 'x'; continue;
      }
      if (c === '`' && kind === 'js') {
        const r = scanTpl(i + 1);
        if (!r) return bad('Unterminated template string', line);
        i = r.j; last = r.end ? 'x' : '{'; continue;
      }
      if (kind === 'js' && c === '/' && (REGEX_OK.has(last) || KW.test(last))) {
        let j = i + 1, cls = false;
        while (j < n && text[j] !== '\n') { if (text[j] === '\\') j++; else if (text[j] === '[') cls = true; else if (text[j] === ']') cls = false; else if (text[j] === '/' && !cls) break; j++; }
        if (text[j] === '/') { i = j + 1; last = 'x'; continue; }
      }
      if (c === '(' || c === '[' || c === '{') { stack.push({ ch: c, line }); last = c; i++; continue; }
      if (c === ')' || c === ']' || c === '}') {
        const top = stack[stack.length - 1];
        if (c === '}' && top && top.ch === '${') {
          stack.pop();
          const r = scanTpl(i + 1);
          if (!r) return bad('Unterminated template string', line);
          i = r.j; last = r.end ? 'x' : '{'; continue;
        }
        if (!top || top.ch !== pairs[c]) return bad(`Unexpected "${c}"` + (top ? ` (expected to close "${top.ch}" from line ${top.line})` : ''), line);
        stack.pop(); last = c; i++; continue;
      }
      if (/[\w$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(text[j])) j++; last = text.slice(i, j); i = j; continue; }
      if (!/\s/.test(c)) last = c;
      i++;
    }
    if (stack.length) { const t = stack[stack.length - 1]; return bad(`"${t.ch}" is never closed`, t.line); }
    return null;
  }
  let lintTimer = 0;
  function lintNow() {
    const b = $('st-prob');
    if (!b) return;
    const f = state.current;
    if (!f || f.binary) { b.hidden = true; return; }
    const ext = extOf(f.name), v = els.editor.value;
    let p = null, known = true;
    if (v.length > 600000) known = false;
    else if (ext === 'json') { try { if (v.trim()) JSON.parse(v); } catch (e) { const m = /position (\d+)/.exec(e.message) || null; const lc = /line (\d+) column (\d+)/.exec(e.message); p = { line: lc ? +lc[1] : m ? v.slice(0, +m[1]).split('\n').length : 1, msg: e.message.replace(/ in JSON at position \d+.*/, '') }; } }
    else if (/^(m?js|jsx|tsx?)$/.test(ext)) p = lintBrackets(v, 'js');
    else if (ext === 'css' || ext === 'scss') p = lintBrackets(v, 'css');
    else known = false;
    b.hidden = !known;
    if (!known) return;
    b.textContent = p ? `⚠ Line ${p.line}` : '✓ No problems';
    b.title = p ? p.msg + ' (click to go there)' : 'No syntax problems found (quick check)';
    b.classList.toggle('bad', !!p);
    b.dataset.line = p ? p.line : '';
    b.dataset.msg = p ? p.msg : '';
  }
  function lintSoon() { clearTimeout(lintTimer); lintTimer = setTimeout(lintNow, 450); }
  function showProblem() {
    const b = $('st-prob'), ln = +b.dataset.line;
    if (!ln) { toast('No syntax problems found.', 'ok'); return; }
    const v = els.editor.value; let off = 0;
    for (let i = 1; i < ln; i++) { const k = v.indexOf('\n', off); if (k < 0) break; off = k + 1; }
    els.editor.focus(); els.editor.setSelectionRange(off, v.indexOf('\n', off) < 0 ? v.length : v.indexOf('\n', off));
    toast(b.dataset.msg, 'err');
  }

  // ---- Pestañas: arrastrar para reordenar ----
  function bindTabsDrag() {
    const box = els.tabs;
    let dragId = null;
    const clear = () => box.querySelectorAll('.tab').forEach((t) => t.classList.remove('drop-l', 'drop-r'));
    box.addEventListener('dragstart', (e) => { const t = e.target.closest('.tab'); if (!t) return; dragId = t.dataset.id; e.dataTransfer.setData('application/x-cc-tab', dragId); e.dataTransfer.effectAllowed = 'move'; });
    box.addEventListener('dragover', (e) => {
      if (!dragId) return;
      const t = e.target.closest('.tab'); if (!t) return;
      e.preventDefault(); clear();
      const r = t.getBoundingClientRect();
      t.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-l' : 'drop-r');
    });
    box.addEventListener('drop', (e) => {
      if (!dragId) return;
      const t = e.target.closest('.tab'); if (!t) return;
      e.preventDefault();
      const r = t.getBoundingClientRect(), after = e.clientX >= r.left + r.width / 2;
      const id = dragId; dragId = null; clear();
      if (t.dataset.id === id) return;
      const arr = state.tabs.filter((x) => x !== id);
      const at = arr.indexOf(t.dataset.id);
      arr.splice(at + (after ? 1 : 0), 0, id);
      state.tabs = arr; persistTabs(); renderTabs();
    });
    box.addEventListener('dragend', () => { dragId = null; clear(); });
  }

  // ---------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------
  function bindUI() {
    // Clics: menús, botones con data-action y cierre al hacer clic fuera
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.menu-trigger');
      if (trigger) {
        const i = [...els.menubar.querySelectorAll('.menu-trigger')].indexOf(trigger);
        if (openMenuIdx === i && performance.now() - hoverOpenedAt > 700) closeMenus(); else if (openMenuIdx !== i) openMenu(i, e.detail === 0);
        return;
      }
      const item = e.target.closest('[data-action]');
      if (item && !item.disabled) { closeMenus(); runAction(item.dataset.action); return; }
      if (!e.target.closest('.dropdown-menu')) closeMenus();
    });

    els.scrim.addEventListener('click', () => { state.overlay = null; applyLayout(); });

    // Editor
    const ed = els.editor;
    ed.addEventListener('blur', () => { lastSel = [ed.selectionStart, ed.selectionEnd]; });
    document.querySelectorAll('dialog').forEach((d) => d.addEventListener('close', () => setTimeout(restoreEditorFocus, 30)));
    ed.addEventListener('input', onEdit);
    ed.addEventListener('input', lintSoon);
    ed.addEventListener('input', (e) => { if (e.inputType && /^insert(Text|CompositionText)$/.test(e.inputType)) acUpdate(false); else acClose(); sugAuto(); });
    ed.addEventListener('blur', acClose);
    ed.addEventListener('scroll', acClose, { passive: true });
    ed.addEventListener('mousedown', acClose);
    ed.addEventListener('keyup', schedulePos);
    ed.addEventListener('click', schedulePos);
    ed.addEventListener('select', schedulePos);
    ed.addEventListener('scroll', syncGutter, { passive: true });
    ed.addEventListener('keydown', (e) => {
      if (ed.readOnly) return;
      if (acKey(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Tab' && !mod && !e.altKey) { e.preventDefault(); if (e.shiftKey || !snipExpand()) edit.indent(e.shiftKey); }
      else if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey && !e.isComposing) { e.preventDefault(); edit.enter(); }
      else if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (e.shiftKey) { if (e.key === 'ArrowDown') edit.duplicate(); } else edit.move(e.key === 'ArrowUp' ? -1 : 1);
      } else if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        edit.move(e.key === 'ArrowUp' ? -1 : 1);
      } else if (mod && e.key === '/') { e.preventDefault(); edit.comment(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); edit.remove(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); edit.duplicate(); }
    });

    // Atajos globales
    document.addEventListener('keydown', (e) => {
      if (openMenuIdx !== -1 && menuKey(e)) return;
      if (document.querySelector('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toLowerCase();
      const inField = e.target && e.target.matches && e.target.matches('.chat-input, #find-input, #repl-input, #term-input, .model-row input');
      if (mod && k === 's') { e.preventDefault(); if (e.shiftKey) saveAs().catch((er) => toast(String((er && er.message) || er), 'err')); else saveFile().catch((er) => toast(String((er && er.message) || er), 'err')); }
      else if (mod && !e.shiftKey && k === 'b') { e.preventDefault(); actions['toggle-left'](); }
      else if (mod && e.shiftKey && k === 'g') { e.preventDefault(); togglePanel('git'); }
      else if (mod && (e.key === '`' || e.code === 'Backquote' || k === 'ñ')) { e.preventDefault(); runAction('terminal'); }
      else if (e.altKey && e.shiftKey && k === 'f' && hasEditor()) { e.preventDefault(); formatDoc(); }
      else if (mod && !e.shiftKey && k === 'f' && hasEditor()) { e.preventDefault(); openFind(false); }
      else if (mod && !e.shiftKey && k === 'h' && hasEditor()) { e.preventDefault(); openFind(true); }
      else if (mod && !e.shiftKey && k === 'g' && hasEditor()) { e.preventDefault(); gotoLine(); }
      else if (mod && !e.shiftKey && k === 'p') { e.preventDefault(); openPalette(''); }
      else if (mod && e.shiftKey && k === 'p') { e.preventDefault(); openPalette('>'); }
      else if (mod && e.shiftKey && k === 'f') { e.preventDefault(); openSearch(); }
      else if (mod && k === 'enter' && !inField) { e.preventDefault(); actions.run(); }
      else if (e.altKey && !mod && k === 'z') { e.preventDefault(); setWrap(!prefs.wrap); }
      else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); setFont(prefs.fs + 1); }
      else if (mod && e.key === '-') { e.preventDefault(); setFont(prefs.fs - 1); }
      else if (e.key === 'Escape') {
        if (openMenuIdx !== -1) { closeMenus(); return; }
        if (!fb.bar.hidden && fb.bar.contains(document.activeElement)) { closeFind(); return; }
        if (state.overlay) { state.overlay = null; applyLayout(); return; }

      }
    });

    // Buscar y reemplazar
    $('find-close').addEventListener('click', closeFind);
    $('find-next').addEventListener('click', () => findStep(1));
    $('find-prev').addEventListener('click', () => findStep(-1));
    $('find-toggle-repl').addEventListener('click', () => { fb.replRow.hidden = !fb.replRow.hidden; });
    $('repl-one').addEventListener('click', replaceOne);
    $('repl-all').addEventListener('click', replaceAll);
    fb.cs.addEventListener('click', () => { state.find.cs = !state.find.cs; fb.cs.setAttribute('aria-pressed', String(state.find.cs)); incrementalFind(); });
    fb.re.addEventListener('click', () => { state.find.re = !state.find.re; fb.re.setAttribute('aria-pressed', String(state.find.re)); incrementalFind(); });
    fb.input.addEventListener('input', incrementalFind);
    fb.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
    });
    fb.repl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
    });

    // Importar (selectores y arrastrar-soltar)
    els.importInput.addEventListener('change', async () => { const items = fromInput(els.importInput); els.importInput.value = ''; await importFiles(items); });
    els.importDir.addEventListener('change', async () => { const items = fromInput(els.importDir); els.importDir.value = ''; await importFiles(items); });
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    document.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); els.dropHint.hidden = false; });
    document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) els.dropHint.hidden = true; });
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      els.dropHint.hidden = true;
      handleDrop(e.dataTransfer);
    });

    // Proyectos, paleta, búsqueda, GitHub
    $('project-close').addEventListener('click', () => $('project-dlg').close());
    $('st-proj').addEventListener('click', () => {});
    qo.input.addEventListener('input', renderPalette);
    qo.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); pickPalette(qo.sel); }
    });
    sr.input.addEventListener('input', () => { clearTimeout(sr.timer); sr.timer = setTimeout(runSearch, 250); });
    sr.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
    $('sr-case').addEventListener('click', (e) => { sr.cs = !sr.cs; e.currentTarget.setAttribute('aria-pressed', String(sr.cs)); runSearch(); });
    $('sr-re').addEventListener('click', (e) => { sr.re = !sr.re; e.currentTarget.setAttribute('aria-pressed', String(sr.re)); runSearch(); });
    makeHandle($('h-prev'), {
      axis: 'x', dir: -1, def: 480, get: () => prefs.pw || 480,
      min: () => 180, max: () => Math.max(200, $('work-row').clientWidth - 260),
      set: (v) => { prefs.pw = v; pv.pane.style.setProperty('--pw', v + 'px'); syncGutter(); }
    });

    // Diálogos
    $('settings-save').addEventListener('click', saveSettings);
    $('settings-cancel').addEventListener('click', () => els.set.dlg.close());
    $('info-close').addEventListener('click', () => els.infoDlg.close());
    els.set.gClear.addEventListener('click', () => clearKey('gemini'));
    $('set-vault-btn').addEventListener('click', async () => { if (sec.state === 'open') secLock(); else await ensureVault(); refreshSettingsHints(); });
    els.set.oClear.addEventListener('click', () => clearKey('openrouter'));
    els.set.gRefresh.addEventListener('click', () => refreshModels(els.set.gRefresh));
    els.set.dlg.addEventListener('close', () => { els.set.gKey.value = ''; els.set.oKey.value = ''; });

    // Persistencia al salir / ocultar
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistOnHide(); });
    window.addEventListener('pagehide', persistOnHide);

    // Diseño
    WIDE.addEventListener('change', () => { closeMenus(); state.overlay = null; applyLayout(); });
    window.addEventListener('resize', () => { closeMenus(); syncGutter(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => syncGutter()).observe(els.editorWrap);

    // Instalación PWA
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
    window.addEventListener('appinstalled', () => { deferredInstall = null; });
  }

  // Búsqueda mientras se escribe: salta a la primera coincidencia desde el cursor
  function execFrom(re, from) {
    const v = els.editor.value;
    const scan = (start) => {
      re.lastIndex = start;
      let m;
      while ((m = re.exec(v)) !== null) {
        if (m[0] !== '') return m;
        re.lastIndex++;
        if (re.lastIndex > v.length) break;
      }
      return null;
    };
    return scan(from) || (from > 0 ? scan(0) : null);
  }

  function incrementalFind() {
    updateFindCount();
    const re = buildRegex(true);
    if (!re || re === 'bad') return;
    const m = execFrom(re, els.editor.selectionStart);
    if (m) selectMatch(m.index, m.index + m[0].length);
  }

  // ===============================================================
  // NUEVO · Temas de color, apariencia y tamaños de letra
  // ===============================================================
  const THEMES = {
    forja: { name: 'Forja Dark (recommended)', v: { '--bg-main': '#171b22', '--bg-sidebar': '#12161d', '--bg-toolbar': '#0e1116', '--bg-menu': '#1d222b', '--text-main': '#c9d3e0', '--text-strong': '#f2f5f9', '--text-muted': '#8593a6', '--accent-color': '#3b6fe0', '--accent-hover': '#7aa2ff', '--border-glow': 'rgba(148,163,184,0.14)', '--soft-bg': 'rgba(148,163,184,0.09)', '--input-bg': 'rgba(0,0,0,0.25)', '--ed-text': '#d6deeb', '--gutter-text': '#66748a', '--tk-c': '#6b7a8f', '--tk-s': '#8fd694', '--tk-n': '#f2a672', '--tk-k': '#c0a0ff', '--tk-t': '#5ccfe6', '--tk-p': '#9ecbff', '--tk-f': '#ffd479', '--ok': '#56d364', '--danger': '#f47067', '--warn': '#e3b341' } },
    'forja-light': { name: 'Forja Light', light: true, v: { '--bg-main': '#fbfcfe', '--bg-sidebar': '#f1f4f8', '--bg-toolbar': '#e6ebf2', '--bg-menu': '#ffffff', '--text-main': '#1f2937', '--text-strong': '#0b1220', '--text-muted': '#5b6678', '--accent-color': '#2457d6', '--accent-hover': '#1b46b0', '--border-glow': 'rgba(15,23,42,0.13)', '--soft-bg': 'rgba(15,23,42,0.06)', '--input-bg': 'rgba(15,23,42,0.045)', '--ed-text': '#1f2937', '--gutter-text': '#7a8699', '--tk-c': '#6b7686', '--tk-s': '#0f7b3a', '--tk-n': '#b45309', '--tk-k': '#6d3fd1', '--tk-t': '#0b7285', '--tk-p': '#1d4ed8', '--tk-f': '#8a5a00', '--ok': '#1a7f37', '--danger': '#cf222e', '--warn': '#9a6700' } },
    'dark-plus': { name: 'Dark+ (VS Code)', v: { '--bg-main': '#1e1e1e', '--bg-sidebar': '#252526', '--bg-toolbar': '#333333', '--bg-menu': '#252526', '--text-main': '#cccccc', '--text-strong': '#ffffff', '--text-muted': '#8b8b8b', '--accent-color': '#0e639c', '--accent-hover': '#1c97ea', '--border-glow': 'rgba(255,255,255,0.10)', '--ed-text': '#d4d4d4', '--gutter-text': '#6e7681', '--tk-c': '#6a9955', '--tk-s': '#ce9178', '--tk-n': '#b5cea8', '--tk-k': '#569cd6', '--tk-t': '#4ec9b0', '--tk-p': '#9cdcfe', '--tk-f': '#dcdcaa' } },
    'light-plus': { name: 'Light+ (light)', light: true, v: { '--bg-main': '#ffffff', '--bg-sidebar': '#f3f3f3', '--bg-toolbar': '#e4e4e4', '--bg-menu': '#f3f3f3', '--text-main': '#333333', '--text-strong': '#000000', '--text-muted': '#6e6e6e', '--accent-color': '#0066b8', '--accent-hover': '#005a9e', '--border-glow': 'rgba(0,0,0,0.14)', '--soft-bg': 'rgba(0,0,0,0.07)', '--input-bg': 'rgba(0,0,0,0.05)', '--ed-text': '#1f1f1f', '--gutter-text': '#237893', '--tk-c': '#008000', '--tk-s': '#a31515', '--tk-n': '#098658', '--tk-k': '#0000ff', '--tk-t': '#267f99', '--tk-p': '#001080', '--tk-f': '#795e26', '--danger': '#c62828', '--ok': '#1b873f' } },
    monokai: { name: 'Monokai', v: { '--bg-main': '#272822', '--bg-sidebar': '#1e1f1c', '--bg-toolbar': '#1b1c19', '--bg-menu': '#33342b', '--text-main': '#e8e8e2', '--text-strong': '#ffffff', '--text-muted': '#97978c', '--accent-color': '#a6e22e', '--accent-hover': '#bef250', '--on-accent': '#1b1c19', '--border-glow': 'rgba(255,255,255,0.10)', '--ed-text': '#f8f8f2', '--gutter-text': '#75715e', '--tk-c': '#75715e', '--tk-s': '#e6db74', '--tk-n': '#ae81ff', '--tk-k': '#f92672', '--tk-t': '#66d9ef', '--tk-p': '#a6e22e', '--tk-f': '#a6e22e' } },
    dracula: { name: 'Dracula', v: { '--bg-main': '#282a36', '--bg-sidebar': '#21222c', '--bg-toolbar': '#191a21', '--bg-menu': '#343746', '--text-main': '#f8f8f2', '--text-strong': '#ffffff', '--text-muted': '#8a93bf', '--accent-color': '#bd93f9', '--accent-hover': '#d0b0ff', '--on-accent': '#1d1e26', '--border-glow': 'rgba(255,255,255,0.10)', '--ed-text': '#f8f8f2', '--gutter-text': '#6272a4', '--tk-c': '#6272a4', '--tk-s': '#f1fa8c', '--tk-n': '#bd93f9', '--tk-k': '#ff79c6', '--tk-t': '#8be9fd', '--tk-p': '#50fa7b', '--tk-f': '#50fa7b' } },
    'one-dark': { name: 'One Dark Pro', v: { '--bg-main': '#282c34', '--bg-sidebar': '#21252b', '--bg-toolbar': '#1c1f24', '--bg-menu': '#2c313a', '--text-main': '#abb2bf', '--text-strong': '#ffffff', '--text-muted': '#7f848e', '--accent-color': '#4d78cc', '--accent-hover': '#61afef', '--border-glow': 'rgba(255,255,255,0.09)', '--ed-text': '#abb2bf', '--gutter-text': '#4b5263', '--tk-c': '#5c6370', '--tk-s': '#98c379', '--tk-n': '#d19a66', '--tk-k': '#c678dd', '--tk-t': '#e5c07b', '--tk-p': '#e06c75', '--tk-f': '#61afef' } },
    'github-dark': { name: 'GitHub Dark', v: { '--bg-main': '#0d1117', '--bg-sidebar': '#010409', '--bg-toolbar': '#161b22', '--bg-menu': '#161b22', '--text-main': '#c9d1d9', '--text-strong': '#ffffff', '--text-muted': '#8b949e', '--accent-color': '#1f6feb', '--accent-hover': '#388bfd', '--border-glow': 'rgba(240,246,252,0.12)', '--ed-text': '#c9d1d9', '--gutter-text': '#6e7681', '--tk-c': '#8b949e', '--tk-s': '#a5d6ff', '--tk-n': '#79c0ff', '--tk-k': '#ff7b72', '--tk-t': '#ffa657', '--tk-p': '#7ee787', '--tk-f': '#d2a8ff' } },
    solarized: { name: 'Solarized Dark', v: { '--bg-main': '#002b36', '--bg-sidebar': '#00212b', '--bg-toolbar': '#073642', '--bg-menu': '#073642', '--text-main': '#a2b1b1', '--text-strong': '#fdf6e3', '--text-muted': '#7a9097', '--accent-color': '#268bd2', '--accent-hover': '#4aa3e6', '--border-glow': 'rgba(255,255,255,0.10)', '--ed-text': '#93a1a1', '--gutter-text': '#586e75', '--tk-c': '#586e75', '--tk-s': '#2aa198', '--tk-n': '#d33682', '--tk-k': '#859900', '--tk-t': '#b58900', '--tk-p': '#268bd2', '--tk-f': '#cb4b16' } },
    medianoche: { name: 'Midnight (original)', v: { '--bg-main': '#0b0c10', '--bg-sidebar': '#14151c', '--bg-toolbar': '#0f1016', '--bg-menu': '#171821', '--text-main': '#e2e8f0', '--text-strong': '#ffffff', '--text-muted': '#8190a5', '--accent-color': '#6366f1', '--accent-hover': '#7c7ff5', '--border-glow': 'rgba(255,255,255,0.08)', '--ed-text': '#f8fafc', '--gutter-text': '#4b5568', '--tk-c': '#6b7a90', '--tk-s': '#a5d6a7', '--tk-n': '#f5a97f', '--tk-k': '#c4a7ff', '--tk-t': '#7aa2ff', '--tk-p': '#8bd5ca', '--tk-f': '#f0d97c' } }
  };
  const ACCENTS = ['#0e639c', '#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#14b8a6', '#a855f7'];
  const BASE_VARS = { '--soft-bg': 'rgba(255,255,255,0.07)', '--input-bg': 'rgba(0,0,0,0.28)', '--on-accent': '#ffffff', '--danger': '#f87171', '--ok': '#4ade80', '--warn': '#fbbf24' };

  const hex2rgb = (hx) => { const m = /^#?([\da-f]{6})$/i.exec(hx || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
  function shade(hx, amt) {
    const c = hex2rgb(hx); if (!c) return hx;
    const t = amt < 0 ? 0 : 255; const p = Math.abs(amt);
    return rgb2hex(c[0] + (t - c[0]) * p, c[1] + (t - c[1]) * p, c[2] + (t - c[2]) * p);
  }
  const lumin = (hx) => { const c = hex2rgb(hx) || [0, 0, 0]; return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };

  function applyTheme() {
    const t = THEMES[prefs.theme] || THEMES.forja;
    const light = !!t.light;
    const vars = Object.assign({}, BASE_VARS, t.v);
    if (prefs.uibg && hex2rgb(prefs.uibg)) {
      const b = prefs.uibg;
      vars['--bg-main'] = b;
      vars['--bg-sidebar'] = shade(b, light ? -0.035 : 0.045);
      vars['--bg-toolbar'] = shade(b, light ? -0.08 : -0.28);
      vars['--bg-menu'] = shade(b, light ? -0.02 : 0.08);
    }
    if (prefs.accent && hex2rgb(prefs.accent)) {
      vars['--accent-color'] = prefs.accent;
      vars['--accent-hover'] = shade(prefs.accent, light ? -0.15 : 0.22);
      vars['--on-accent'] = lumin(prefs.accent) > 0.6 ? '#101010' : '#ffffff';
    }
    const rgb = hex2rgb(vars['--accent-color']) || [99, 102, 241];
    vars['--accent-rgb'] = rgb.join(', ');
    vars['--hover-bg'] = `rgba(${rgb.join(', ')}, ${light ? 0.14 : 0.2})`;
    vars['--sel-bg'] = `rgba(${rgb.join(', ')}, ${light ? 0.28 : 0.42})`;
    const root = document.documentElement;
    Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
    root.style.colorScheme = light ? 'light' : 'dark';
    root.dataset.theme = prefs.theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', vars['--bg-toolbar']);
    root.style.setProperty('--uis', String(prefs.uis));
  }

  function setTheme(id) { prefs.theme = id; savePrefs(); applyTheme(); }
  function setUiScale(v) { prefs.uis = clamp(Math.round(v * 20) / 20, 0.85, 1.6); savePrefs(); applyTheme(); charW = 0; syncGutter(); }

  function appearanceDialog() {
    const body = h('div', { class: 'appear' });
    const draw = () => {
      const themeGrid = h('div', { class: 'theme-grid' }, Object.keys(THEMES).map((id) => {
        const t = THEMES[id]; const v = t.v;
        const b = h('button', { type: 'button', class: 'theme-card' + (prefs.theme === id ? ' sel' : ''), 'aria-pressed': prefs.theme === id ? 'true' : 'false', onclick: () => { setTheme(id); draw(); } },
          h('span', { class: 'theme-sw' },
            ...['--bg-main', '--bg-toolbar', '--accent-color', '--tk-k', '--tk-s', '--tk-f', '--tk-t'].map((k) => { const s = h('i'); s.style.background = v[k]; return s; })),
          h('span', { class: 'theme-nm', text: t.name }));
        return b;
      }));
      const accRow = h('div', { class: 'acc-row' });
      ACCENTS.forEach((c) => {
        const b = h('button', { type: 'button', class: 'acc-dot' + (prefs.accent === c ? ' sel' : ''), title: c, 'aria-label': 'Color ' + c, onclick: () => { prefs.accent = c; savePrefs(); applyTheme(); draw(); } });
        b.style.background = c; accRow.appendChild(b);
      });
      const accIn = h('input', { type: 'color', class: 'acc-input', 'aria-label': 'Custom accent color' });
      accIn.value = prefs.accent || (THEMES[prefs.theme] || THEMES.forja).v['--accent-color'];
      accIn.addEventListener('input', () => { prefs.accent = accIn.value; savePrefs(); applyTheme(); });
      accRow.append(accIn, h('button', { type: 'button', class: 'btn btn-ghost sm', style: 'width:auto', text: 'From theme', onclick: () => { prefs.accent = null; savePrefs(); applyTheme(); draw(); } }));
      const bgIn = h('input', { type: 'color', class: 'acc-input', 'aria-label': 'Interface background color' });
      bgIn.value = prefs.uibg || (THEMES[prefs.theme] || THEMES.forja).v['--bg-main'];
      bgIn.addEventListener('input', () => { prefs.uibg = bgIn.value; savePrefs(); applyTheme(); });
      const stepper = (label, valueText, down, up) => h('div', { class: 'stepper' }, h('span', { text: label }),
        h('div', null, h('button', { type: 'button', class: 'btn btn-ghost sm', text: '−', 'aria-label': 'Decrease ' + label, onclick: () => { down(); draw(); } }),
          h('b', { text: valueText }),
          h('button', { type: 'button', class: 'btn btn-ghost sm', text: '+', 'aria-label': 'Increase ' + label, onclick: () => { up(); draw(); } })));
      const toggle = (label, key, dflt, after) => {
        const cb = h('input', { type: 'checkbox' }); cb.checked = prefs[key] === undefined ? dflt : !!prefs[key];
        cb.addEventListener('change', () => { prefs[key] = cb.checked; savePrefs(); if (after) after(); });
        return h('label', { class: 'include-row' }, cb, h('span', { text: label }));
      };
      body.replaceChildren(
        h('div', { class: 'git-title', text: 'COLOR THEME (like VS Code)' }), themeGrid,
        h('div', { class: 'git-title', text: 'INTERFACE COLOR (accent: buttons, selection, active bar)' }), accRow,
        h('div', { class: 'git-title', text: 'INTERFACE BACKGROUND COLOR' }),
        h('div', { class: 'acc-row' }, bgIn, h('button', { type: 'button', class: 'btn btn-ghost sm', style: 'width:auto', text: 'From theme', onclick: () => { prefs.uibg = null; savePrefs(); applyTheme(); draw(); } })),
        h('div', { class: 'git-title', text: 'FONT SIZE' }),
        stepper('Code editor', prefs.fs + ' px', () => setFont(prefs.fs - 1), () => setFont(prefs.fs + 1)),
        stepper('Interface (menus, panels, chat)', Math.round(prefs.uis * 100) + ' %', () => setUiScale(prefs.uis - 0.05), () => setUiScale(prefs.uis + 0.05)),
        h('div', { class: 'git-title', text: 'EDITOR' }),
        toggle('Autocomplete while I type', 'ac', true, () => acClose()),
        toggle('Suggest code with AI on its own when I pause (uses quota; otherwise use Alt+Enter)', 'aiauto', false, () => sugClose()),
        toggle('Auto-close ( [ { " \' `', 'pairs', true),
        toggle('Syntax highlighting', 'hl', true, () => updateHLState()),
        h('div', { class: 'dlg-actions' }, h('button', { type: 'button', class: 'btn btn-ghost', text: 'Reset appearance', onclick: () => {
          Object.assign(prefs, { theme: PREF_DEFAULTS.theme, accent: null, uibg: null, uis: PREF_DEFAULTS.uis, fs: PREF_DEFAULTS.fs }); savePrefs(); applyTheme(); applyFont(); draw();
        } })));
    };
    draw();
    showInfo('Appearance', [body]);
  }

  // ===============================================================
  // NUEVO · Modelos de OpenRouter fáciles de cambiar
  // ===============================================================
  const orJson = (k, d) => { try { const v = JSON.parse(store.get(k) || ''); return v == null ? d : v; } catch (_) { return d; } };
  const orFavs = () => orJson('or_fav', []);
  const orRecent = () => orJson('or_recent', []);
  const orAll = () => orJson('or_models_all', []);

  let orTarget = 'openrouter';
  const orKey = (p) => PROVIDERS[p || orTarget].modelName;
  function setOrModel(id, p) {
    id = String(id || '').trim();
    if (id) store.set(orKey(p), id); else store.remove(orKey(p));
    if (id) store.set('or_recent', JSON.stringify([id].concat(orRecent().filter((x) => x !== id)).slice(0, 8)));
    populateModelSelects();
  }

  function orModelOptions(p) {
    const cur = store.get(orKey(p)) || '';
    const seen = new Set(['']);
    const groups = [];
    const add = (title, ids) => {
      const opts = ids.filter((id) => id && !seen.has(id));
      opts.forEach((id) => seen.add(id));
      if (opts.length) groups.push([title, opts]);
    };
    add('Current', cur ? [cur] : []);
    add('★ Favorites', orFavs());
    add('Recent', orRecent());
    add('Free (more context)', orAll().filter((m) => m.free).slice(0, 12).map((m) => m.id));
    return groups;
  }

  function fillOrSelect(p) {
    if (!p) { fillOrSelect('openrouter'); fillOrSelect('gemini'); return; }
    const sel = ui[p] && ui[p].model;
    if (!sel) return;
    sel.replaceChildren();
    sel.add(new Option('Automatic — openrouter/auto', ''));
    orModelOptions(p).forEach(([title, ids]) => {
      const g = document.createElement('optgroup'); g.label = title;
      ids.forEach((id) => { const m = orAll().find((x) => x.id === id); g.appendChild(new Option(m ? (m.name || id) : id, id)); });
      sel.appendChild(g);
    });
    sel.value = store.get(orKey(p)) || '';
  }

  function updateModelTips() {
    ['gemini', 'openrouter'].forEach((p) => { if (ui[p] && ui[p].mtoggle) ui[p].mtoggle.title = `Model: ${store.get(PROVIDERS[p].modelName) || 'openrouter/auto'} — click to change`; });
  }

  async function loadAllOrModels() {
    if (!navigator.onLine) throw new AIError('No internet connection.');
    let res;
    try { res = await fetch('https://openrouter.ai/api/v1/models'); } catch (_) { throw new TypeError('red'); }
    const data = await readJson(res);
    if (!res.ok) throw httpError(res, data, 'openrouter');
    const list = ((data && data.data) || []).filter((m) => m && typeof m.id === 'string').map((m) => {
      const pp = m.pricing ? Number(m.pricing.prompt) : NaN;
      const pc = m.pricing ? Number(m.pricing.completion) : NaN;
      const free = m.id.endsWith(':free') || (pp === 0 && pc === 0);
      return { id: m.id, name: m.name || m.id, ctx: m.context_length || 0, free, price: free ? 'free' : (isNaN(pp) ? '' : `$${(pp * 1e6).toFixed(2)}/M`) };
    }).sort((a, b) => b.ctx - a.ctx);
    if (!list.length) throw new AIError('OpenRouter returned no models.');
    store.set('or_models_all', JSON.stringify(list));
    store.set('or_free_models', JSON.stringify(list.filter((m) => m.free)));
    fillFreeModels();
    return list;
  }

  function orPicker(p) {
    orTarget = p || 'openrouter';
    const dlg = $('or-dlg');
    const q = $('or-q'); const listEl = $('or-list'); const note = $('or-note'); const tabs = $('or-tabs');
    let tab = orAll().length ? 'free' : 'free';
    const draw = () => {
      const all = orAll();
      const favs = new Set(orFavs());
      const term = q.value.trim().toLowerCase();
      let items = all.filter((m) => (tab === 'free' ? m.free : tab === 'fav' ? favs.has(m.id) : true) && (!term || m.id.toLowerCase().includes(term) || (m.name || '').toLowerCase().includes(term)));
      const total = items.length;
      items = items.slice(0, 150);
      tabs.replaceChildren(...[['free', 'Free'], ['fav', '★ Favorites'], ['all', 'All']].map(([id, label]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': tab === id ? 'true' : 'false', text: label, onclick: () => { tab = id; draw(); } })));
      listEl.replaceChildren(...items.map((m) => h('li', { class: 'or-item' },
        h('button', { type: 'button', class: 'or-pick', onclick: () => { setOrModel(m.id); dlg.close(); toast('Model: ' + m.id, 'ok'); } },
          h('span', { class: 'or-nm', text: m.name }),
          h('small', { text: `${m.id} · ${Math.round((m.ctx || 0) / 1000)}k · ${m.price || ''}` })),
        h('button', { type: 'button', class: 'icon-btn sm or-star' + (favs.has(m.id) ? ' on' : ''), 'aria-label': 'Favorite', title: 'Favorite', text: favs.has(m.id) ? '★' : '☆',
          onclick: () => { const f = orFavs(); const i = f.indexOf(m.id); if (i === -1) f.unshift(m.id); else f.splice(i, 1); store.set('or_fav', JSON.stringify(f.slice(0, 30))); fillOrSelect(); draw(); } }))));
      note.textContent = all.length ? `${total} models${total > 150 ? ' (showing 150: narrow your search)' : ''}. Your current choice (${PROVIDERS[orTarget].label}): ${store.get(orKey()) || 'openrouter/auto'}` : 'Press «Refresh» to download the model list.';
    };
    const reload = async () => {
      note.textContent = 'Downloading list…';
      try { const l = await loadAllOrModels(); fillOrSelect(); draw(); note.textContent = `${l.length} models loaded.`; }
      catch (e) { note.textContent = friendlyError(e, false); }
    };
    q.value = '';
    q.oninput = draw;
    $('or-reload').onclick = reload;
    $('or-use').onclick = () => { const v = q.value.trim(); if (!v) { toast('Type the model id (e.g. openai/gpt-4o-mini).', 'err'); return; } setOrModel(v); dlg.close(); toast('Model: ' + v, 'ok'); };
    $('or-close').onclick = () => dlg.close();
    draw();
    dlg.showModal();
    q.focus();
    if (!orAll().length) reload();
  }

  // ===============================================================
  // NUEVO · Autocompletado y cierre automático de paréntesis/comillas
  // ===============================================================
  const CSS_PROPS = 'display position top left right bottom width height min-width max-width min-height max-height margin margin-top margin-bottom margin-left margin-right padding padding-top padding-bottom padding-left padding-right border border-radius border-color border-width background background-color background-image color font-size font-family font-weight line-height letter-spacing text-align text-decoration text-transform flex flex-direction flex-wrap flex-grow flex-shrink justify-content align-items align-self gap grid grid-template-columns grid-template-rows overflow overflow-x overflow-y opacity transition transform animation box-shadow box-sizing z-index cursor content white-space outline visibility object-fit pointer-events user-select'.split(' ');
  const HTML_TAGS = 'div span a p ul ol li h1 h2 h3 h4 button input form label img nav header footer main section article aside table thead tbody tr td th script style link meta title body head html textarea select option canvas video audio svg iframe pre code strong em br hr'.split(' ');
  const JS_GLOBALS = 'console.log document.getElementById document.querySelector document.querySelectorAll addEventListener setTimeout setInterval clearTimeout JSON.stringify JSON.parse Promise.all Array.isArray Object.keys Object.entries Object.assign Math.floor Math.random Math.max Math.min localStorage sessionStorage fetch async await require module.exports process.argv'.split(' ');
  const PY_GLOBALS = 'print len range enumerate input open isinstance str int float list dict set tuple sorted zip map filter sum min max abs round import from __name__ self os sys json re math datetime random'.split(' ');
  const SNIPS = {
    js: { log: 'console.log($0);', fn: 'function name($0) {\n  \n}', afn: 'const name = ($0) => {\n  \n};', for: 'for (let i = 0; i < $0; i++) {\n  \n}', forof: 'for (const item of $0) {\n  \n}', if: 'if ($0) {\n  \n}', ifelse: 'if ($0) {\n  \n} else {\n  \n}', try: 'try {\n  $0\n} catch (err) {\n  console.error(err);\n}', cls: 'class Name {\n  constructor($0) {\n    \n  }\n}', fetch: 'const res = await fetch($0);\nconst data = await res.json();', qs: "document.querySelector('$0')", ael: "addEventListener('click', () => {\n  $0\n});" },
    py: { def: 'def name($0):\n    ', for: 'for i in range($0):\n    ', if: 'if $0:\n    ', ifelse: 'if $0:\n    \nelse:\n    ', try: 'try:\n    $0\nexcept Exception as e:\n    print(e)', cls: 'class Name:\n    def __init__(self$0):\n        ', main: "if __name__ == '__main__':\n    $0", with: "with open('$0') as f:\n    " },
    css: { flex: 'display: flex;\nalign-items: center;\njustify-content: center;\n', grid: 'display: grid;\ngrid-template-columns: repeat($0, 1fr);\ngap: 8px;\n', media: '@media (max-width: 700px) {\n  $0\n}' },
    html: { 'html5': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>$0</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  \n  <script src="app.js"></script>\n</body>\n</html>', link: '<link rel="stylesheet" href="$0">', script: '<script src="$0"></script>', btn: '<button type="button">$0</button>' }
  };
  const AC_WORD = /[A-Za-z0-9_$]/;
  const ac = { el: null, items: [], sel: 0, start: 0, open: false, words: null, wordsAt: 0, wordsId: '' };

  function acFam() {
    if (!state.current || state.current.binary) return null;
    const f = famOf(state.current.name);
    return f === 'md' ? null : f;
  }

  function acClose() { if (ac.open) { ac.open = false; if (ac.el) ac.el.hidden = true; } if (typeof sugClose === 'function') sugClose(); }

  function acWords(v) {
    const now = performance.now();
    const id = state.current ? state.current.id : '';
    if (ac.words && ac.wordsId === id && ac.wordsV === v) return ac.words;
    const map = new Map();
    if (v.length < 600000) {
      const re = /[A-Za-z_$][\w$]{2,}/g; let m;
      while ((m = re.exec(v)) !== null) map.set(m[0], (map.get(m[0]) || 0) + 1);
    }
    ac.words = map; ac.wordsAt = now; ac.wordsId = id; ac.wordsV = v;
    return map;
  }

  function acCandidates(prefix, fam, v, caret, start) {
    const p = prefix.toLowerCase();
    const out = []; const seen = new Set();
    const push = (label, insert, kind, detail) => { if (seen.has(label + kind) || label === prefix) return; seen.add(label + kind); out.push({ label, insert: insert || label, kind, detail: detail || '' }); };
    const sn = SNIPS[fam] || {};
    Object.keys(sn).forEach((k) => { if (k.toLowerCase().startsWith(p)) push(k, sn[k], 'snip', 'snippet'); });
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const before = v.slice(lineStart, start);
    if (fam === 'html' && /<\/?$/.test(before)) {
      HTML_TAGS.forEach((t) => { if (t.startsWith(p)) push(t, t, 'kw', 'tag'); });
    } else if (fam === 'css') {
      const inValue = /:\s*[^;{}]*$/.test(before);
      if (!inValue) CSS_PROPS.forEach((t) => { if (t.startsWith(p)) push(t, t + ': ', 'prop', 'property'); });
    } else if (fam === 'js') {
      KW_JS.forEach((k) => { if (k.startsWith(p)) push(k, k, 'kw', 'keyword'); });
      JS_GLOBALS.forEach((k) => { if (k.toLowerCase().startsWith(p)) push(k, k, 'kw', 'API'); });
    } else if (fam === 'py') {
      KW_PY.forEach((k) => { if (k.startsWith(p)) push(k, k, 'kw', 'keyword'); });
      PY_GLOBALS.forEach((k) => { if (k.startsWith(p)) push(k, k, 'kw', 'function'); });
    }
    const words = acWords(v);
    const near = [...words.entries()].filter(([w]) => w.toLowerCase().startsWith(p) && w !== prefix).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
    near.slice(0, 12).forEach(([w]) => push(w, w, 'word', 'in this file'));
    const rank = { snip: 0, prop: 1, kw: 2, word: 3 };
    out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.label.length - b.label.length);
    return out.slice(0, 8);
  }

  function acRender() {
    if (!ac.el) {
      ac.el = h('div', { class: 'ac', role: 'listbox', 'aria-label': 'Suggestions', hidden: true });
      ac.el.addEventListener('pointerdown', (e) => { e.preventDefault(); const li = e.target.closest('[data-i]'); if (li) acAccept(Number(li.dataset.i)); });
      $('code-area').appendChild(ac.el);
    }
    ac.el.replaceChildren(...ac.items.map((it, i) => h('div', { class: 'ac-item' + (i === ac.sel ? ' sel' : ''), role: 'option', 'data-i': String(i), 'aria-selected': i === ac.sel ? 'true' : 'false' },
      h('span', { class: 'ac-k k-' + it.kind, text: it.kind === 'snip' ? '⌘' : it.kind === 'prop' ? 'p' : it.kind === 'kw' ? 'k' : 'w' }),
      h('span', { class: 'ac-l', text: it.label }), h('small', { text: it.detail }))));
  }

  function acPlace(caret) {
    const ed = els.editor; const v = ed.value;
    let line = 0; let last = -1;
    for (let i = v.indexOf('\n'); i !== -1 && i < caret; i = v.indexOf('\n', i + 1)) { line++; last = i; }
    const lh = prefs.fs * 1.6;
    let x = 12 + (caret - last - 1) * charWidth() - ed.scrollLeft;
    let y = 16 + (line + 1) * lh - ed.scrollTop + 2;
    const area = $('code-area');
    ac.el.hidden = false;
    const w = ac.el.offsetWidth; const hh = ac.el.offsetHeight;
    x = clamp(x, 4, Math.max(4, area.clientWidth - w - 4));
    if (y + hh > area.clientHeight) y = Math.max(4, y - lh - hh - 4);
    ac.el.style.left = x + 'px'; ac.el.style.top = y + 'px';
  }

  function acUpdate(force) {
    if (prefs.ac === false && !force) { acClose(); return; }
    const fam = acFam();
    const ed = els.editor;
    if (!fam || ed.readOnly || ed.selectionStart !== ed.selectionEnd || prefs.wrap) { acClose(); return; }
    const v = ed.value; const caret = ed.selectionStart;
    let s = caret;
    while (s > 0 && (AC_WORD.test(v[s - 1]) || (fam === 'css' && v[s - 1] === '-'))) s--;
    const prefix = v.slice(s, caret);
    if (!prefix || (!force && prefix.length < 2) || /^\d/.test(prefix)) { acClose(); return; }
    const list = acCandidates(prefix, fam, v, caret, s);
    if (!list.length) { acClose(); return; }
    ac.items = list; ac.sel = 0; ac.start = s; ac.open = true;
    acRender(); acPlace(caret);
  }

  function acAccept(i) {
    const it = ac.items[i]; if (!it) return;
    const ed = els.editor; const v = ed.value; const caret = ed.selectionStart;
    let text = it.insert;
    const ls = v.lastIndexOf('\n', ac.start - 1) + 1;
    const ind = v.slice(ls, ac.start).match(/^[ \t]*/)[0];
    if (ind && text.includes('\n')) text = text.replace(/\n/g, '\n' + ind);
    let pos = text.indexOf('$0');
    if (pos !== -1) text = text.replace('$0', ''); else pos = text.length;
    const start = ac.start;
    acClose();
    replaceRange(start, caret, text, start + pos, start + pos);
  }

  function acKey(e) {
    const ed = els.editor;
    const mod = e.ctrlKey || e.metaKey;
    if (sugKey(e)) return true;
    if (mod && e.code === 'Space') { e.preventDefault(); acUpdate(true); return true; }
    if (ac.open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); ac.sel = (ac.sel + 1) % ac.items.length; acRender(); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); ac.sel = (ac.sel - 1 + ac.items.length) % ac.items.length; acRender(); return true; }
      if ((e.key === 'Enter' || e.key === 'Tab') && !mod && !e.shiftKey) { e.preventDefault(); acAccept(ac.sel); return true; }
      if (e.key === 'Escape') { e.preventDefault(); acClose(); return true; }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) acClose();
    }
    // Cierre automático de pares
    if (prefs.pairs === false || mod || e.altKey || e.isComposing) return false;
    const fam = acFam(); if (!fam) return false;
    const v = ed.value; const s = ed.selectionStart; const t = ed.selectionEnd;
    const OPEN = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    const next = v[t]; const prev = v[s - 1];
    if (e.key === 'Backspace' && s === t && OPEN[prev] && next === OPEN[prev]) { e.preventDefault(); replaceRange(s - 1, s + 1, '', s - 1, s - 1); return true; }
    if (')]}"\'`'.includes(e.key) && e.key.length === 1 && s === t && next === e.key) { e.preventDefault(); ed.setSelectionRange(s + 1, s + 1); schedulePos(); return true; }
    if (OPEN[e.key]) {
      const open = e.key; const close = OPEN[open];
      if (s !== t) { e.preventDefault(); replaceRange(s, t, open + v.slice(s, t) + close, s + 1, t + 1); return true; }
      const isQuote = open === '"' || open === "'" || open === '`';
      if (isQuote && ((prev && AC_WORD.test(prev)) || (next && AC_WORD.test(next)))) return false;
      if (!isQuote && next && !/[\s)\]}.,;:]/.test(next)) return false;
      e.preventDefault(); replaceRange(s, s, open + close, s + 1, s + 1); return true;
    }
    return false;
  }

  // ===============================================================
  // NUEVO · GitGuard: revisa secretos y archivos peligrosos antes de subir
  // ===============================================================
  const GUARD_RULES = [
    ['Private key', 'high', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
    ['GitHub token', 'high', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
    ['OpenRouter key', 'high', /\bsk-or-v1-[A-Za-z0-9]{20,}\b/],
    ['Anthropic key', 'high', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
    ['OpenAI key', 'high', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
    ['Google / Gemini key', 'high', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['AWS key', 'high', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['Slack token', 'high', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
    ['Stripe key', 'high', /\b[sr]k_live_[0-9A-Za-z]{16,}\b/],
    ['Possible password or key in plain text', 'medium', /\b(?:password|passwd|secret|api[_-]?key|token|auth)\w*["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i]
  ];
  const GUARD_FILES = /(^|\/)(\.env(\.[\w.-]+)?|id_rsa[\w.-]*|id_ed25519[\w.-]*|\.npmrc|\.htpasswd|credentials\.json|service-account[\w.-]*\.json|[\w.-]+\.(pem|key|p12|pfx|keystore|jks))$/i;
  const GUARD_OK_FILES = /\.(example|sample|template)$/i;
  const guardOn = () => store.get('cc_guard') !== 'off';
  const guardIgnore = () => { const p = curProj(); return new Set((p && p.gh && p.gh.guardIgnore) || []); };
  const maskSecret = (s) => (s.length <= 10 ? s.slice(0, 3) + '…' : s.slice(0, 5) + '…' + s.slice(-2));

  function guardScanText(text, name) {
    const out = [];
    if (!text) return out;
    const myKeys = ['gemini_key', 'openrouter_key', 'github_token'].map((k) => [k, secret(k).trim()]).filter(([, v]) => v.length >= 12);
    const lines = text.slice(0, 2000000).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 3000) continue;
      for (const [label, sev, re] of GUARD_RULES) {
        const m = re.exec(line);
        if (m) { out.push({ name, line: i + 1, label, sev, sample: maskSecret(m[0]) }); break; }
      }
      for (const [k, val] of myKeys) if (line.includes(val)) out.push({ name, line: i + 1, label: 'Contains YOUR saved key (' + k.replace('_key', '').replace('_token', '') + ')', sev: 'high', sample: maskSecret(val) });
    }
    return out;
  }

  async function guardScan(changes) {
    const found = [];
    for (const c of changes) {
      if (c.st === 'D' || !c.f) continue;
      if (GUARD_FILES.test(c.name) && !GUARD_OK_FILES.test(c.name)) found.push({ name: c.name, line: 0, label: 'File that usually contains secrets', sev: 'high', sample: baseName(c.name) });
      if ((c.f.size || 0) > 50 * 1048576) found.push({ name: c.name, line: 0, label: 'Very large file (GitHub rejects > 100 MB)', sev: 'medium', sample: fmtSize(c.f.size) });
      if (c.f.binary) continue;
      let text = '';
      try { text = await getText(c.f); } catch (_) { continue; }
      found.push(...guardScanText(text, c.name));
    }
    return found;
  }

  function guardDialog(found, changes) {
    return new Promise((resolve) => {
      const names = [...new Set(found.map((f) => f.name))];
      const hasHigh = found.some((f) => f.sev === 'high');
      let result = false;
      const rows = found.slice(0, 40).map((f) => h('li', { class: 'guard-row ' + f.sev },
        h('b', { text: f.name + (f.line ? ':' + f.line : '') }), h('span', { text: ' — ' + f.label }), h('code', { text: f.sample })));
      const act = h('div', { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancel', onclick: () => dlg.close() }),
        h('button', { type: 'button', class: 'btn', text: 'Protect and push the rest', onclick: () => {
          const p = curProj(); p.gh.guardIgnore = [...new Set((p.gh.guardIgnore || []).concat(names))]; persistProjects();
          for (let i = changes.length - 1; i >= 0; i--) if (names.includes(changes[i].name)) changes.splice(i, 1);
          result = true; dlg.close();
        } }),
        h('button', { type: 'button', class: 'btn btn-danger', text: hasHigh ? 'Push anyway (risky)' : 'Push anyway', onclick: () => { result = true; dlg.close(); } }));
      const dlg = h('dialog', { 'aria-labelledby': 'guard-t' }, h('div', { class: 'dlg-body' },
        h('h3', { id: 'guard-t', text: '🛡 GitGuard: review before pushing' }),
        h('p', { class: 'dlg-note', text: hasHigh ? 'Possible secrets were found. Once on GitHub, even if you delete them they stay in the history: the safe move is not to push them and, if they were already exposed, to revoke that key.' : 'There are minor warnings. Review and decide.' }),
        h('ul', { class: 'guard-list' }, rows), found.length > 40 ? h('p', { class: 'dlg-note', text: `…and ${found.length - 40} more.` }) : null,
        h('p', { class: 'dlg-note', text: '«Protect» excludes those files from this project commits (you can undo it in the Git panel).' }), act));
      dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
      document.body.appendChild(dlg);
      dlg.showModal();
    });
  }

  async function guardCheck(changes) {
    if (!guardOn()) return true;
    gitNote('GitGuard checking…');
    const found = await guardScan(changes);
    if (!found.length) { gitNote('GitGuard: nothing suspicious ✔'); return true; }
    return guardDialog(found, changes);
  }

  function guardCard() {
    const p = curProj(); const ign = (p && p.gh && p.gh.guardIgnore) || [];
    const cb = h('input', { type: 'checkbox' }); cb.checked = guardOn();
    cb.addEventListener('change', () => { store.set('cc_guard', cb.checked ? 'on' : 'off'); renderGit(); });
    const out = h('div', { class: 'guard-card' },
      h('div', { class: 'git-title', text: '🛡 GITGUARD' }),
      h('label', { class: 'git-check' }, cb, 'Check for secrets before every push'));
    if (guardOn()) {
      out.appendChild(h('button', { class: 'btn btn-ghost', type: 'button', text: 'Scan changes now', onclick: async () => {
        const ch = await computeChanges(); const found = await guardScan(ch);
        gitNote(found.length ? `GitGuard: ${found.length} warning(s) in ${new Set(found.map((f) => f.name)).size} file(s).` : 'GitGuard: nothing suspicious ✔', !!found.length);
        if (found.length) { const keep = ch.slice(); await guardDialog(found, keep); renderGit(); }
      } }));
    }
    if (ign.length) {
      out.appendChild(h('div', { class: 'dlg-note', text: `Protected (not pushed): ${ign.length}` }));
      out.appendChild(h('ul', { class: 'git-changes' }, ign.map((n) => h('li', null, h('button', { type: 'button', title: 'Remove protection', onclick: () => { p.gh.guardIgnore = ign.filter((x) => x !== n); persistProjects(); renderGit(); } },
        h('span', { class: 'st st-D', text: '🛡' }), h('span', { class: 'nm', text: n }), h('span', { class: 'muted', text: 'remove' }))))));
    }
    return out;
  }

  // ===============================================================
  // NUEVO · Workflows y Reglas
  // ===============================================================
  const DEFAULT_WORKFLOWS = [
    { id: 'w1', name: 'explain', desc: 'Explains the current code step by step', text: 'Explain this code step by step, in plain language, and point out possible problems. {{args}}' },
    { id: 'w2', name: 'fix', desc: 'Finds errors and fixes them in the editor', text: 'Review this code, find errors or bad practices and fix them by applying the changes in the editor. {{args}}' },
    { id: 'w3', name: 'tests', desc: 'Creates tests for the file', text: 'Write tests for this code in a new file next to this one. {{args}}' },
    { id: 'w4', name: 'document', desc: 'Adds comments and documentation', text: 'Add short comments and a description at the top of this file, without changing the logic. {{args}}' },
    { id: 'w5', name: 'run-and-summarize', desc: 'Runs the file and summarizes the result', text: '$ {{file}}\nExplain in a few lines what this code does and what it should print.' }
  ];
  const DEFAULT_RULES = [
    { id: 'r1', name: 'Reply in English', text: 'Always reply in English, clearly and briefly.', on: true, scope: 'global' },
    { id: 'r2', name: 'Clean code', text: 'Write simple, readable code. Do not add new dependencies unless I ask and comment only what is not obvious.', on: true, scope: 'global' },
    { id: 'r3', name: 'Security', text: 'Never put keys or tokens inside the code: use environment variables or a .env file that is not pushed.', on: true, scope: 'global' }
  ];
  const LEGACY_NAMES = { w1: 'explicar', w2: 'corregir', w3: 'pruebas', w4: 'documentar', w5: 'ejecutar-y-resumir', r1: 'Responder en español', r2: 'Código limpio', r3: 'Seguridad' };
  function loadList(key, defaults) {
    const raw = store.get(key);
    if (raw === null) { store.set(key, JSON.stringify(defaults)); return defaults.map((x) => Object.assign({}, x)); }
    try {
      let v = JSON.parse(raw); if (!Array.isArray(v)) return [];
      // Migración: los ejemplos originales (en español) que no editaste pasan a su versión en inglés
      let changed = false;
      v = v.map((x) => { const d = defaults.find((y) => y.id === x.id); if (d && LEGACY_NAMES[x.id] === x.name) { changed = true; return Object.assign({}, d, x.on === false ? { on: false } : {}); } return x; });
      if (changed) store.set(key, JSON.stringify(v));
      return v;
    } catch (_) { return []; }
  }
  const wfList = () => loadList('cc_workflows', DEFAULT_WORKFLOWS);
  const ruList = () => loadList('cc_rules', DEFAULT_RULES);
  const saveWf = (l) => store.set('cc_workflows', JSON.stringify(l));
  const saveRu = (l) => store.set('cc_rules', JSON.stringify(l));
  const wfTab = { v: 'wf' };

  function activeRules() {
    const pid = state.project ? state.project.id : 'default';
    return ruList().filter((r) => r.on && (r.scope === 'global' || r.scope === pid) && r.text && r.text.trim());
  }

  async function projectRuleText() {
    let out = '';
    for (const n of ['AGENTS.md', '.codecraft/rules.md']) {
      const f = state.files.find((x) => x.name === n && !x.binary);
      if (f) { try { out += `\n[${n}] ` + (await getText(f)).trim().replace(/\s+/g, ' ').slice(0, 1500); } catch (_) { /* nada */ } }
    }
    return out;
  }

  async function buildSystem(base) {
    const rules = activeRules();
    const files = await projectRuleText();
    if (!rules.length && !files) return base;
    let extra = '\n\nUSER RULES (always follow them, unless the user says otherwise in their message):\n' + rules.map((r) => '- ' + r.text.trim().replace(/\s+/g, ' ')).join('\n') + files;
    if (extra.length > 5000) extra = extra.slice(0, 5000);
    return base + extra;
  }

  function refreshRulesNote() {
    const n = activeRules().length;
    Object.keys(PROVIDERS).forEach((p) => { if (ui[p] && ui[p].rulesNote) ui[p].rulesNote.textContent = n ? `${n} active rule${n > 1 ? 's' : ''}` : 'no active rules'; });
  }

  function editItem(kind, item) {
    return new Promise((resolve) => {
      const dlg = $('wf-dlg');
      const isWf = kind === 'wf';
      $('wf-title').textContent = (item ? 'Edit ' : 'New ') + (isWf ? 'workflow' : 'rule');
      $('wf-name').value = item ? item.name : '';
      $('wf-name').placeholder = isWf ? 'short-name (used as /name)' : 'Rule title';
      $('wf-desc-row').hidden = !isWf;
      $('wf-scope-row').hidden = isWf;
      $('wf-desc').value = item && item.desc ? item.desc : '';
      const sc = $('wf-scope'); sc.replaceChildren(new Option('Global (all projects)', 'global'), new Option('This project only: ' + (state.project ? state.project.name : ''), state.project ? state.project.id : 'default'));
      sc.value = item && item.scope ? item.scope : 'global';
      $('wf-text').value = item ? item.text : '';
      $('wf-text').placeholder = isWf ? 'One line = one step.\nLines that start with $ run a terminal command:\n$ node {{file}}\n$ git push -m "update"\nThe rest are sent to the AI.\nYou can use {{args}}, {{file}} (current file) and {{project}} (project name).' : 'Example: Always use single quotes and semicolons.';
      $('wf-msg').textContent = '';
      let out = null;
      $('wf-ok').onclick = () => {
        const name = $('wf-name').value.trim().replace(/^\//, '');
        const text = $('wf-text').value;
        if (!name || !text.trim()) { $('wf-msg').textContent = 'The name or the content is missing.'; return; }
        out = Object.assign({}, item || { id: 'x' + Date.now().toString(36) }, { name: isWf ? name.toLowerCase().replace(/[^\w-]+/g, '-') : name, text });
        if (isWf) out.desc = $('wf-desc').value.trim(); else { out.scope = sc.value; if (out.on === undefined) out.on = true; }
        dlg.close();
      };
      $('wf-cancel').onclick = () => dlg.close();
      dlg.onclose = () => { dlg.onclose = null; resolve(out); };
      dlg.showModal();
      $('wf-name').focus();
    });
  }

  function renderWorkflow() {
    const body = $('wf-body');
    if (!body) return;
    const tabs = h('div', { class: 'wf-tabs' },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': wfTab.v === 'wf' ? 'true' : 'false', text: 'Workflows', onclick: () => { wfTab.v = 'wf'; renderWorkflow(); } }),
      h('button', { type: 'button', class: 'chip', 'aria-pressed': wfTab.v === 'ru' ? 'true' : 'false', text: 'Rules', onclick: () => { wfTab.v = 'ru'; renderWorkflow(); } }));
    const nodes = [tabs];
    if (wfTab.v === 'wf') {
      const list = wfList();
      const prov = h('select', { 'aria-label': 'Assistant that runs the workflows' }, h('option', { value: 'gemini', text: 'with OpenRouter 2' }), h('option', { value: 'openrouter', text: 'with OpenRouter 1' }));
      prov.value = store.get('cc_wf_provider') || (hasKey('gemini') || !hasKey('openrouter') ? 'gemini' : 'openrouter');
      prov.addEventListener('change', () => store.set('cc_wf_provider', prov.value));
      nodes.push(h('p', { class: 'dlg-note', text: 'A workflow is a recipe of steps you repeat often. Each line is a step: lines that start with $ run a terminal command (for example $ node {{file}} or $ git push) and the rest go to the AI. In the chat type /name.' }), prov);
      list.forEach((w) => nodes.push(h('div', { class: 'wf-item' },
        h('button', { type: 'button', class: 'wf-run', title: 'Run /' + w.name, 'aria-label': 'Run ' + w.name, onclick: () => runWorkflow(w, '', prov.value) }, icon('play')),
        h('div', { class: 'wf-main' }, h('b', { text: '/' + w.name }), h('small', { text: w.desc || w.text.split('\n')[0].slice(0, 70) })),
        h('button', { type: 'button', class: 'icon-btn sm', title: 'Edit', 'aria-label': 'Edit ' + w.name, onclick: async () => { const r = await editItem('wf', w); if (r) { saveWf(list.map((x) => (x.id === w.id ? r : x))); renderWorkflow(); } } }, icon('edit')),
        h('button', { type: 'button', class: 'icon-btn sm', title: 'Delete', 'aria-label': 'Delete ' + w.name, onclick: () => { if (window.confirm(`Delete the workflow /${w.name}?`)) { saveWf(list.filter((x) => x.id !== w.id)); renderWorkflow(); } } }, icon('trash')))));
      nodes.push(h('button', { type: 'button', class: 'btn', text: '＋ New workflow', onclick: async () => { const r = await editItem('wf', null); if (r) { saveWf(list.concat(r)); renderWorkflow(); } } }));
    } else {
      const list = ruList();
      nodes.push(h('p', { class: 'dlg-note', text: 'Active rules are added to every message you send to Gemini or OpenRouter. The AGENTS.md and .codecraft/rules.md files of the project are also read, if they exist.' }));
      list.forEach((r) => {
        const cb = h('input', { type: 'checkbox', 'aria-label': 'Enable ' + r.name }); cb.checked = !!r.on;
        cb.addEventListener('change', () => { r.on = cb.checked; saveRu(list); refreshRulesNote(); });
        nodes.push(h('div', { class: 'wf-item' }, cb,
          h('div', { class: 'wf-main' }, h('b', { text: r.name }), h('small', { text: (r.scope === 'global' ? 'Global · ' : 'Project · ') + r.text.slice(0, 80) })),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Edit', 'aria-label': 'Edit ' + r.name, onclick: async () => { const n = await editItem('ru', r); if (n) { saveRu(list.map((x) => (x.id === r.id ? n : x))); renderWorkflow(); refreshRulesNote(); } } }, icon('edit')),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Delete', 'aria-label': 'Delete ' + r.name, onclick: () => { if (window.confirm(`Delete the rule «${r.name}»?`)) { saveRu(list.filter((x) => x.id !== r.id)); renderWorkflow(); refreshRulesNote(); } } }, icon('trash'))));
      });
      nodes.push(h('button', { type: 'button', class: 'btn', text: '＋ New rule', onclick: async () => { const n = await editItem('ru', null); if (n) { saveRu(list.concat(n)); renderWorkflow(); refreshRulesNote(); } } }));
    }
    body.replaceChildren(...nodes);
  }

  async function runWorkflow(wf, args, provider) {
    provider = provider || store.get('cc_wf_provider') || (hasKey('gemini') || !hasKey('openrouter') ? 'gemini' : 'openrouter');
    const sub = (t) => t.replace(/\{\{\s*args\s*\}\}/g, args || '').replace(/\{\{\s*(?:archivo|file)\s*\}\}/g, state.current ? state.current.name : '').replace(/\{\{\s*(?:proyecto|project)\s*\}\}/g, state.project ? state.project.name : '');
    const steps = []; let buf = [];
    String(wf.text).split('\n').forEach((line) => {
      if (/^\s*\$\s/.test(line)) { if (buf.length) { steps.push({ t: 'ai', x: buf.join('\n') }); buf = []; } steps.push({ t: 'sh', x: sub(line.replace(/^\s*\$\s*/, '')) }); }
      else if (line.trim()) buf.push(sub(line));
    });
    if (buf.length) steps.push({ t: 'ai', x: buf.join('\n') });
    if (!steps.length) { toast('The workflow is empty.', 'err'); return; }
    if (steps.some((s) => s.t === 'ai') && !hasKey(provider)) { toast(`The ${PROVIDERS[provider].label} key is missing (AI → API settings).`, 'err'); return; }
    toast(`/${wf.name}: ${steps.length} step${steps.length > 1 ? 's' : ''}`, 'ok');
    for (const st of steps) {
      if (st.t === 'sh') {
        const okStep = await termExecLine(st.x);
        if (!okStep) { toast('Workflow stopped: the terminal command failed: ' + st.x, 'err'); return; }
        continue;
      } else {
        setPanel(provider, true);
        ui[provider].input.value = st.x;
        await sendAI(provider);
        if (ui[provider].input.value) { toast('Workflow stopped: the AI did not respond.', 'err'); return; }
      }
    }
  }

  function slashRun(provider) {
    const u = ui[provider];
    const m = /^\/([\w-]+)\s*(.*)$/s.exec(u.input.value.trim());
    if (!m) return false;
    const wf = wfList().find((w) => w.name === m[1].toLowerCase());
    if (!wf) { addSystem(provider, `The workflow /${m[1]} does not exist. See the list in the Workflows panel.`, 'error'); return true; }
    u.input.value = '';
    updateSlash(provider);
    runWorkflow(wf, m[2], provider);
    return true;
  }

  function updateSlash(provider) {
    const u = ui[provider];
    if (!u.slash) return;
    const m = /^\/([\w-]*)$/.exec(u.input.value);
    if (!m) { u.slash.hidden = true; return; }
    const list = wfList().filter((w) => w.name.startsWith(m[1].toLowerCase())).slice(0, 6);
    u.slash.hidden = !list.length;
    u.slash.replaceChildren(...list.map((w) => h('button', { type: 'button', class: 'slash-item', onclick: () => { u.input.value = '/' + w.name + ' '; u.slash.hidden = true; u.input.focus(); } }, h('b', { text: '/' + w.name }), h('small', { text: w.desc || '' }))));
  }

  // ===============================================================
  // NUEVO · Explorador: carpetas (también vacías), contraer/expandir
  // ===============================================================
  const projDirs = () => { const p = curProj(); if (!p) return []; if (!Array.isArray(p.dirs)) p.dirs = []; return p.dirs; };

  async function newFolder() { startCreate('dir', exSelDir()); }
  async function newInDir(path) { startCreate('file', path); }

  async function deleteDir(d) {
    const ids = collectIds(d, []);
    if (ids.length) await deleteFiles(ids, true);
    else if (!window.confirm(`Delete the empty folder «${d.path}»?`)) return;
    if (!state.files.some((f) => f.name.startsWith(d.path + '/'))) {
      const dirs = projDirs();
      for (let i = dirs.length - 1; i >= 0; i--) if (dirs[i] === d.path || dirs[i].startsWith(d.path + '/')) dirs.splice(i, 1);
      persistProjects();
    }
    renderFiles();
  }

  function allDirPaths() {
    const set = new Set();
    state.files.forEach((f) => { const p = f.name.split('/'); for (let i = 1; i < p.length; i++) set.add(p.slice(0, i).join('/')); });
    projDirs().forEach((d) => { const p = d.split('/'); for (let i = 1; i <= p.length; i++) set.add(p.slice(0, i).join('/')); });
    return set;
  }
  function saveClosed() { prefs.closed = [...state.closedDirs]; savePrefs(); }

  // ===============================================================
  // Ejecutar: .html en la vista previa, .js en el navegador (Worker aislado)
  // ===============================================================
  async function runFile2(f) {
    const ext = extOf(f.name);
    if (f.binary) { toast('A binary file cannot be run.', 'err'); return; }
    if (/^html?$/.test(ext)) { setPreview(true); return; }
    if (ext === 'js' || ext === 'mjs') { await runFile(f); return; }
    toast(`.${ext || 'extensionless'} files cannot be run here. HTML opens in the preview and .js runs in the browser.`, 'err');
  }

  async function runCurrent2() {
    if (!state.current) { toast('No file is open.', 'err'); return; }
    if (term.busy) { toast('Something is already running.', 'err'); return; }
    term.busy = true;
    try { await runFile2(state.current); }
    catch (e) { toast('Error while running: ' + ((e && e.message) || e), 'err'); }
    finally { term.busy = false; }
  }

  // ===============================================================
  // NUEVO · Sugerencias de código con IA (Alt+Enter, o solas al pausar)
  // ===============================================================
  const sug = { el: null, text: '', open: false, abort: null, timer: null, seq: 0 };
  const SUG_SYSTEM = 'You are a code autocomplete engine inside an editor. You receive the code before and after the cursor (marked with <<CURSOR>>). ' +
    'Reply ONLY with the exact text that should be inserted at the cursor to continue the code (maximum 10 lines), with no explanations, no ``` fences and without repeating what is already written before the cursor. ' +
    'If the cursor is in the middle of a line, complete that line. If there is nothing useful to add, reply with an empty string.';

  function sugClose() {
    if (sug.abort) { sug.abort.abort(); sug.abort = null; }
    clearTimeout(sug.timer);
    sug.seq++;
    if (sug.open) { sug.open = false; if (sug.el) sug.el.hidden = true; }
  }

  function sugShow(text, busy) {
    if (!sug.el) {
      sug.el = h('div', { class: 'ai-sug', role: 'status', hidden: true });
      sug.el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (sug.text) sugAccept(); });
      $('code-area').appendChild(sug.el);
    }
    sug.open = true;
    sug.el.replaceChildren(
      h('div', { class: 'ai-sug-h', text: busy ? '✨ The AI is thinking…' : '✨ AI suggestion — Tab accept · Esc dismiss' }),
      busy ? null : h('pre', { text }));
    const ed = els.editor; const v = ed.value; const caret = ed.selectionStart;
    let line = 0; let last = -1;
    for (let i = v.indexOf('\n'); i !== -1 && i < caret; i = v.indexOf('\n', i + 1)) { line++; last = i; }
    const lh = prefs.fs * 1.6;
    const area = $('code-area');
    sug.el.hidden = false;
    const w = sug.el.offsetWidth; const hh = sug.el.offsetHeight;
    let x = clamp(12 + (caret - last - 1) * charWidth() - ed.scrollLeft, 4, Math.max(4, area.clientWidth - w - 4));
    let y = 16 + (line + 1) * lh - ed.scrollTop + 2;
    if (y + hh > area.clientHeight) y = Math.max(4, y - lh - hh - 4);
    sug.el.style.left = x + 'px'; sug.el.style.top = y + 'px';
  }

  function sugAccept() {
    const text = sug.text; if (!text) return;
    const ed = els.editor; const caret = ed.selectionStart;
    sugClose();
    replaceRange(caret, caret, text, caret + text.length, caret + text.length);
  }

  function sugClean(raw, before, after) {
    let t = String(raw || '').replace(/\r/g, '');
    const fence = /^\s*```[\w-]*\n([\s\S]*?)\n?```\s*$/.exec(t);
    if (fence) t = fence[1];
    t = t.replace(/^\n+/, '').replace(/\s+$/, '');
    // Si la IA repitió el final de lo ya escrito, se recorta
    const tail = before.slice(-200);
    for (let n = Math.min(tail.length, t.length, 120); n >= 8; n--) {
      if (tail.endsWith(t.slice(0, n))) { t = t.slice(n); break; }
    }
    // Sangría: si el cursor ya está tras espacios, no se duplican
    const lineBefore = before.slice(before.lastIndexOf('\n') + 1);
    if (lineBefore && /^[ \t]*$/.test(lineBefore)) t = t.replace(new RegExp('^[ \\t]{0,' + lineBefore.length + '}'), '');
    // Si la IA repitió lo que ya hay después del cursor (p. ej. la llave de cierre), se recorta
    for (let n = Math.min(t.length, after.length, 200); n >= 1; n--) {
      const seg = after.slice(0, n);
      if (seg.trim() && t.endsWith(seg)) { t = t.slice(0, t.length - n).replace(/\s+$/, ''); break; }
    }
    return t;
  }

  async function sugRequest(manual) {
    if (!hasEditor() || els.editor.readOnly) return;
    const prov = ['gemini', 'openrouter'].find((p) => hasKey(p) && (p === (store.get('cc_wf_provider') || 'gemini')))
      || ['gemini', 'openrouter'].find((p) => hasKey(p));
    if (!prov) { if (manual) toast('A key is missing for AI suggestions (AI → API settings).', 'err'); return; }
    if (!navigator.onLine) { if (manual) toast('No internet connection.', 'err'); return; }
    const ed = els.editor; const v = ed.value; const caret = ed.selectionStart;
    if (ed.selectionStart !== ed.selectionEnd) { if (manual) toast('Clear the selection and try again.', 'err'); return; }
    const before = v.slice(Math.max(0, caret - 3000), caret);
    const after = v.slice(caret, caret + 1000);
    if (!before.trim() && !after.trim()) { if (manual) toast('Type something first so the AI has context.', 'err'); return; }
    if (guardOn() && guardScanText(before + after, 'ctx').some((x) => x.sev === 'high')) { if (manual) toast('🛡 GitGuard: there is a secret near the cursor; it was not sent to the AI.', 'err'); return; }
    if (sug.abort) sug.abort.abort();
    const my = ++sug.seq;
    const ctrl = new AbortController(); sug.abort = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 20000);
    if (manual) sugShow('', true);
    try {
      const msg = `File: ${state.current.name} (${langOf(state.current.name)[0]})\n\n${before}<<CURSOR>>${after}`;
      const got = await callWithFallback(prov, [{ role: 'user', text: msg }], ctrl.signal, SUG_SYSTEM);
      if (my !== sug.seq || ed.selectionStart !== caret || ed.value !== v) return;   // el usuario siguió escribiendo
      const text = sugClean(got.text, before, after);
      if (!text) { sugClose(); if (manual) toast('The AI has nothing to add here.', 'ok'); return; }
      sug.text = text; sugShow(text, false);
    } catch (err) {
      if (my !== sug.seq) return;
      sugClose();
      if (manual || !(err && err.name === 'AbortError')) { if (manual) toast(friendlyError(err, false), 'err'); }
    } finally { clearTimeout(timer); if (sug.abort === ctrl) sug.abort = null; }
  }

  function sugAuto() {
    clearTimeout(sug.timer);
    if (!prefs.aiauto || !hasEditor()) return;
    sug.timer = setTimeout(() => sugRequest(false), 1400);
  }

  function sugKey(e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Enter') { e.preventDefault(); acClose(); sugRequest(true); return true; }
    if (!sug.open) return false;
    if (e.key === 'Tab' && !e.shiftKey && sug.text) { e.preventDefault(); sugAccept(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); sugClose(); return true; }
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) sugClose();
    return false;
  }

  // ---------------------------------------------------------------
  // Inicio
  // ---------------------------------------------------------------
  async function init() {
    // Cada paso va protegido: si uno falla, el resto de la interfaz igual aparece
    const step = (name, fn) => { try { fn(); } catch (err) { try { console.error('[CodeCraft] ' + name, err); } catch (_) { /* nada */ } (window.__ccErrors = window.__ccErrors || []).push(name + ': ' + ((err && err.message) || err)); } };
    state.autosave = store.get('cc_autosave') === 'on';
    step('theme', applyTheme);
    step('menus', buildMenus);
    step('toolbar', buildQuickTools);
    step('activity bar', buildActivityBar);
    step('Gemini panel', () => buildPanel('gemini'));
    step('OpenRouter panel', () => buildPanel('openrouter'));
    step('models', populateModelSelects);
    step('drag handles', setupHandles);
    step('events', bindUI);
    step('explorer', bindExplorer);
    step('tabsdrag', bindTabsDrag);
    step('word wrap', () => setWrap(prefs.wrap));
    step('font', applyFont);
    step('layout', applyLayout);
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      state.all = await idb.all('files');
      const pr = await idb.get('meta', 'projects');
      if (pr && Array.isArray(pr.list) && pr.list.length) state.projects = pr.list;
      const ap = await idb.get('meta', 'activeProject');
      state.project = projById(ap && ap.value) || state.projects[0];
      state.files = state.all.filter((f) => (f.project || 'default') === state.project.id);
      if (state.project.id === 'default' && !(await idb.get('meta', 'tabs:default'))) {
        const old = await idb.get('meta', 'tabs');       // datos de la versión anterior
        if (old && old.ids) await idb.put('meta', { key: 'tabs:default', ids: old.ids });
        const oc = await idb.get('meta', 'currentId');
        if (oc) await idb.put('meta', { key: 'currentId:default', value: oc.value });
      }
      const tabsRec = await idb.get('meta', 'tabs:' + state.project.id);
      state.tabs = (tabsRec && Array.isArray(tabsRec.ids) ? tabsRec.ids : []).filter((id) => state.files.some((f) => f.id === id));
      const dr = await idb.get('meta', 'drafts');
      if (dr && dr.map) Object.keys(dr.map).forEach((id) => { if (state.files.some((f) => f.id === id && !f.binary) && typeof dr.map[id] === 'string') state.buffers.set(id, dr.map[id]); });
      const cur = await idb.get('meta', 'currentId:' + state.project.id);
      let target = state.files.find((f) => cur && f.id === cur.value) || state.files.find((f) => f.id === state.tabs[0]);
      if (!target && !state.files.length) target = await createFileRecord(DEFAULT_NAME, '');
      if (!target) target = recentFiles(1)[0] || null;      // reabre el último archivo en vez de mostrar el centro vacío
      if (target) await loadFile(target.id); else setNoFile();
      for (const p of Object.keys(PROVIDERS)) {
        const rec = await idb.get('chat', p);
        state.chats[p] = (rec && Array.isArray(rec.messages)) ? rec.messages : [];
      }
    } catch (_) {
      // Modo sin almacenamiento (p. ej. navegación privada): el editor sigue funcionando
      state.dbOK = false;
      if (!state.current) {
        const now = Date.now();
        state.current = { id: 'mem', name: DEFAULT_NAME, created: now, updated: now, size: 0 };
        state.files = [state.current];
        state.tabs = ['mem'];
        els.editor.readOnly = false;
        els.stFile.textContent = DEFAULT_NAME;
        els.stLang.textContent = langOf(DEFAULT_NAME)[0];
        renderTabs();
      }
      setSave('No local storage');
    }
    step('chats', () => { renderChat('gemini'); renderChat('openrouter'); });
    step('project', updateProjLabel);
    step('preview', () => { if (prefs.preview) setPreview(true); });
    step('tabs', renderTabs);
    step('files', renderFiles);
    step('buttons', syncToggles);
    window.__ccReady = true;
    step('keys', secInit);
    // Reintentos de pintado: algunas veces el navegador aún no tiene medidas al abrir la app
    const repaint = () => { step('repaint', () => { applyLayout(); updateGutter(true); updateHLState(); syncGutter(); }); };
    requestAnimationFrame(repaint);
    setTimeout(repaint, 350);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(repaint).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') repaint(); });
    window.addEventListener('pageshow', repaint);
  }

  // ===============================================================
  // NUEVO · Terminal virtual y pantalla de bienvenida
  // No hay procesos reales: son comandos de texto sobre los archivos del proyecto, git por la API de GitHub
  // y ejecución de JS en el Worker aislado. Por eso casi no usa memoria ni CPU.
  // ===============================================================
  // >>> TERMINAL BEGIN
  const tm = { cwd: '', hist: [], hi: 0, draft: '', busy: false, input: $('term-input'), ps: $('term-ps') };
  const tmCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  const tmSecretLine = /(key|token|secret|passw|ghp_|github_pat|sk-|AIza)/i;
  try {
    const saved = JSON.parse(store.get('cc_term_hist') || '[]');
    if (Array.isArray(saved)) tm.hist = saved.filter((x) => typeof x === 'string').slice(-60);
  } catch (_) { /* sin historial */ }
  tm.hi = tm.hist.length;

  // ---- Rutas: relativas a la carpeta actual; «/» o «~» = raíz del proyecto ----
  function tmResolve(p) {
    p = String(p == null ? '' : p).replace(/\\/g, '/');
    let parts;
    if (p === '~' || p.startsWith('~/')) { parts = []; p = p.slice(1); }
    else if (p.startsWith('/')) parts = [];
    else parts = tm.cwd ? tm.cwd.split('/') : [];
    p.split('/').forEach((s) => {
      if (!s || s === '.') return;
      if (s === '..') parts.pop();
      else parts.push(s.replace(/[\u0000-\u001f]/g, '').slice(0, 120));
    });
    return parts.join('/').slice(0, 240);
  }
  const tmIsDir = (p) => p === '' || allDirPaths().has(p);
  const tmFile = (p) => state.files.find((f) => f.name === p);
  const tmBlockedParent = (p) => { for (let a = parentOf(p); a; a = parentOf(a)) if (tmFile(a)) return a; return ''; };
  const tmPad2 = (n) => String(n).padStart(2, '0');
  function tmDate(ms, secs) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${tmPad2(d.getMonth() + 1)}-${tmPad2(d.getDate())} ${tmPad2(d.getHours())}:${tmPad2(d.getMinutes())}` + (secs ? ':' + tmPad2(d.getSeconds()) : '');
  }

  // Comodines * y ? (dentro de un mismo nivel de carpeta)
  function tmGlob(arg) {
    const abs = tmResolve(arg);
    const re = new RegExp('^' + abs.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]') + '$');
    const out = [];
    state.files.forEach((f) => { if (re.test(f.name)) out.push(f.name); });
    allDirPaths().forEach((d) => { if (re.test(d)) out.push(d); });
    return out.sort(tmCmp);
  }
  function tmPaths(args) {
    const out = [];
    args.forEach((a) => {
      if (/[*?]/.test(a)) { const g = tmGlob(a); if (g.length) { out.push(...g); return; } }
      out.push(tmResolve(a));
    });
    return out;
  }

  // Hijos directos de una carpeta
  function tmList(p) {
    const pre = p ? p + '/' : '';
    const dirs = new Set();
    const files = [];
    state.files.forEach((f) => {
      if (!f.name.startsWith(pre)) return;
      const rest = f.name.slice(pre.length);
      const i = rest.indexOf('/');
      if (i === -1) files.push(f); else dirs.add(rest.slice(0, i));
    });
    projDirs().forEach((d) => {
      if (!d.startsWith(pre)) return;
      const rest = d.slice(pre.length);
      if (rest) dirs.add(rest.split('/')[0]);
    });
    return { dirs: [...dirs].sort(tmCmp), files: files.sort((a, b) => tmCmp(baseName(a.name), baseName(b.name))) };
  }

  // Opciones tipo -abc, -n 5, -n5, -5
  function tmFlags(args, withVal) {
    const f = new Set();
    const val = {};
    const rest = [];
    const wv = withVal || [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--') { rest.push(...args.slice(i + 1)); break; }
      if (/^-[A-Za-z]+$/.test(a)) {
        for (let k = 1; k < a.length; k++) {
          const ch = a[k];
          if (wv.includes(ch)) { val[ch] = a.length > k + 1 ? a.slice(k + 1) : args[++i]; break; }
          f.add(ch);
        }
      } else if (/^-\d+$/.test(a) && wv.includes('n')) val.n = a.slice(1);
      else rest.push(a);
    }
    return { f, val, rest };
  }

  // ---- Análisis de la línea: palabras, comillas, | && > >> ----
  function tmTokenize(line) {
    const toks = [];
    let cur = '';
    let has = false;
    let q = null;
    const push = () => { if (has) toks.push({ t: 'w', v: cur }); cur = ''; has = false; };
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === q) q = null;
        else if (c === '\\' && q === '"' && /["\\]/.test(line[i + 1] || '')) cur += line[++i];
        else cur += c;
        continue;
      }
      if (c === '"' || c === "'") { q = c; has = true; continue; }
      if (c === '\\' && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
      if (/\s/.test(c)) { push(); continue; }
      if (c === '|') { push(); toks.push({ t: '|' }); continue; }
      if (c === '&' && line[i + 1] === '&') { push(); toks.push({ t: '&&' }); i++; continue; }
      if (c === '>') { push(); if (line[i + 1] === '>') { toks.push({ t: '>>' }); i++; } else toks.push({ t: '>' }); continue; }
      cur += c;
      has = true;
    }
    if (q) throw new Error('Unclosed quote.');
    push();
    return toks;
  }

  function tmParse(line) {
    const toks = tmTokenize(line);
    const seq = [];
    let pipe = [];
    let cmd = { argv: [], out: null };
    let redir = null;
    const endCmd = () => {
      if (!cmd.argv.length) throw new Error('A command is missing next to | or &&.');
      pipe.push(cmd);
      cmd = { argv: [], out: null };
    };
    for (const t of toks) {
      if (redir) {
        if (t.t !== 'w') throw new Error('A file name is missing after >');
        cmd.out = { append: redir === '>>', target: t.v };
        redir = null;
        continue;
      }
      if (t.t === 'w') cmd.argv.push(t.v);
      else if (t.t === '>' || t.t === '>>') redir = t.t;
      else if (t.t === '|') endCmd();
      else if (t.t === '&&') { endCmd(); seq.push(pipe); pipe = []; }
    }
    if (redir) throw new Error('A file name is missing after >');
    if (cmd.argv.length || pipe.length) endCmd();
    if (pipe.length) seq.push(pipe);
    return seq;
  }

  // ---- Salida ----
  function tmFlush(lines) {
    if (!lines.length) return;
    const MAXL = 400;
    const frag = document.createDocumentFragment();
    lines.slice(0, MAXL).forEach((l) => {
      const a = Array.isArray(l);
      const txt = a ? l[0] : l;
      frag.append(h('div', { class: 'tl' + (a && l[1] ? ' ' + l[1] : ''), text: txt === '' ? '\u00a0' : txt }));
    });
    term.out.appendChild(frag);
    if (lines.length > MAXL) tprint(`… ${lines.length - MAXL} more lines (narrow it down with head, tail or grep)`, 'dim');
    while (term.out.childElementCount > MAX_TERM_LINES) term.out.firstChild.remove();
    term.out.scrollTop = term.out.scrollHeight;
  }
  const tmText = (lines) => lines.map((l) => (Array.isArray(l) ? l[0] : l));
  const tmSplit = (t) => {
    const a = String(t).replace(/\r\n?/g, '\n').split('\n');
    if (a.length && a[a.length - 1] === '') a.pop();
    return a;
  };

  async function tmWrite(target, text, append) {
    const p = tmResolve(target);
    if (!p) throw new Error('invalid file name');
    if (tmIsDir(p)) throw new Error(`${p}: is a folder`);
    const bp = tmBlockedParent(p);
    if (bp) throw new Error(`${bp} is a file, not a folder`);
    const m = tmFile(p);
    if (m) {
      if (m.binary) throw new Error(`${p}: binary file`);
      await setText(m, append ? (await getText(m)) + text : text);
    } else {
      await createFileRecord(p, text);
    }
    renderFiles();
  }

  // Lee archivos (o la entrada de una tubería) como listas de líneas
  async function tmSources(rest, io, name) {
    if (!rest.length) {
      if (io.stdin) return [{ name: '', lines: io.stdin }];
      io.err(`${name}: missing file (or use a pipe, for example: cat file | ${name})`);
      return null;
    }
    const out = [];
    for (const p of tmPaths(rest)) {
      const m = tmFile(p);
      if (!m) { io.err(`${name}: ${p || '/'}: ${tmIsDir(p) ? 'is a folder' : 'no such file'}`); continue; }
      if (m.binary) { io.err(`${name}: ${p}: binary file`); continue; }
      out.push({ name: p, lines: tmSplit(await getText(m)) });
    }
    return out;
  }

  async function tmCopyFile(m, to, force, io) {
    const bp = tmBlockedParent(to);
    if (bp) { io.err(`cp: ${bp} is a file, not a folder`); return 0; }
    if (tmIsDir(to)) { io.err(`cp: ${to}: is a folder`); return 0; }
    const ex = tmFile(to);
    if (ex) {
      if (ex.id === m.id) { io.err('cp: source and destination are the same file'); return 0; }
      if (!force || ex.binary || m.binary) { io.err(`cp: ${to}: already exists${force ? ' (binary files cannot be overwritten)' : ' (use -f to overwrite text files)'}`); return 0; }
      await setText(ex, await getText(m));
      return 1;
    }
    await createFileRecord(to, m.binary ? await getBlob(m) : await getText(m), { binary: !!m.binary, mime: m.mime });
    return 1;
  }

  // ---- Git (todo por la API de GitHub) ----
  async function tmGitReady(io, needLink) {
    const p = curProj();
    if (needLink && !(p && p.gh)) { io.err('This project is not linked to GitHub. Open Source control (Ctrl+Shift+G) and use Publish, Link or Clone.'); return false; }
    if (!ghToken() && sec.state === 'locked') await ensureVault();
    if (!ghToken()) { io.err('Connect your GitHub account first (Source control → Connect to GitHub).'); return false; }
    return true;
  }
  async function tmGitRun(io, fn) {
    if (git.busy) { io.err('Source control is busy with another operation.'); return; }
    git.busy = true;
    git.note = '';
    git.noteErr = false;
    try { await fn(); }
    catch (e) { git.note = (e && e.message) || String(e); git.noteErr = true; }
    finally { git.busy = false; }
    if (git.note) tprint(git.note, git.noteErr ? 'err' : 'ok');
    if (git.noteErr) io.fail = true;
    try { if (isOpen('git')) renderGit(); scheduleGit(); } catch (_) { /* nada */ }
  }

  // ---- Comandos que necesitan un sistema real: se explican en vez de fallar en silencio ----
  const TM_REAL = {};
  const tmReal = (names, tip) => names.split(' ').forEach((n) => { TM_REAL[n] = tip; });
  const TM_LINUX = 'use the Linux terminal (Crostini) on the same files (Project → Open Chromebook folder links a real folder that both see).';
  // ---- Puente opcional a un shell real (cc-bridge.py corriendo en el Linux de la Chromebook) ----
  const bridge = { on: false, port: 7878, token: '', cwd: '', ctl: null, busy: false };
  try { const b = JSON.parse(store.get('cc_bridge') || 'null'); if (b && b.token) { bridge.token = String(b.token); bridge.port = +b.port || 7878; bridge.on = true; } } catch (_) { /* sin puente */ }
  const bridgeUrl = (p) => `http://127.0.0.1:${bridge.port}${p}`;
  const bridgeHead = () => ({ 'Content-Type': 'application/json', 'X-CC-Token': bridge.token });
  const ANSI = /\u001b\[[0-9;?]*[ -\/]*[@-~]|\u001b\][^\u0007]*\u0007|\r/g;
  async function bridgeRun(line) {
    if (!bridge.on) { tprint('Real shell not connected. Run: python3 cc-bridge.py, then here: bridge connect TOKEN', 'warn'); return false; }
    bridge.ctl = new AbortController();
    let rc = 1;
    try {
      const res = await fetch(bridgeUrl('/run'), { method: 'POST', headers: bridgeHead(), body: JSON.stringify({ cmd: line }), signal: bridge.ctl.signal });
      if (res.status === 401) { tprint('Wrong token. Copy it again from the bridge window: bridge connect TOKEN', 'err'); return false; }
      if (!res.ok || !res.body) { tprint('Bridge error ' + res.status, 'err'); return false; }
      const rd = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      const flush = (all) => {
        const parts = buf.split('\n');
        buf = all ? '' : parts.pop();
        parts.forEach((l) => {
          const m = /^\u0000CC:(\d+):(.*)$/.exec(l);
          if (m) { rc = +m[1]; bridge.cwd = m[2]; return; }
          if (l.indexOf('\u0000CC:') === 0) return;
          tprint(l.replace(ANSI, ''), '');
        });
      };
      for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); flush(false); }
      buf += '\n'; flush(true);
      if (rc !== 0) tprint('exit ' + rc, 'dim');
      return rc === 0;
    } catch (e) {
      if (e && e.name === 'AbortError') { tprint('stopped', 'dim'); return false; }
      tprint('Cannot reach the bridge on 127.0.0.1:' + bridge.port + '. Is cc-bridge.py running? (' + ((e && e.message) || e) + ')', 'err');
      return false;
    } finally { bridge.ctl = null; }
  }
  const tmBridgeWants = (line) => {
    if (!bridge.on) return false;
    const w = (line.trim().split(/\s+/)[0] || '');
    if (!w || w === 'bridge' || w === 'help' || w === 'clear' || w === 'cls' || w === 'exit') return false;
    const real = ['git', 'ls', 'cat', 'cd', 'pwd'].indexOf(w) === -1;
    return real && !Object.prototype.hasOwnProperty.call(TM, w) && !tmFile(tmResolve(w));
  };
  tmReal('npm npx yarn pnpm bun deno', 'Package managers need a real system: ' + TM_LINUX);
  tmReal('python python3 pip pip3', 'Python is not included in CodeCraft on purpose, to keep it light. If you need it, ' + TM_LINUX);
  tmReal('wrangler', 'wrangler needs Node and a real system. To publish, use git push (or deploy) and let Cloudflare Pages build from GitHub. For wrangler itself, ' + TM_LINUX);
  tmReal('sudo apt apt-get curl wget ssh scp docker make gcc g++ java javac cargo go ruby php bash sh zsh vim nano', 'This needs a real system: ' + TM_LINUX);

  async function tmUnknown(name, args, io) {
    const p = tmResolve(name);
    const m = tmFile(p);
    if (m && /^(m?js|html?)$/.test(extOf(m.name)) && !m.binary) { await runFile2(m); return; }
    if (TM_REAL[name]) { io.err(`${name}: not available in the browser terminal.`); io.print(TM_REAL[name], 'dim'); return; }
    io.err(`${name}: command not found. Type help.`);
  }

  const TM_HELP = [
    ['Files', [
      ['ls [-l] [path]', 'list files and folders'],
      ['cd [path]', 'change folder (cd = root, cd .. = up)'],
      ['pwd', 'current folder'],
      ['tree [-L n] [path]', 'folder tree'],
      ['cat [-n] file…', 'show a file'],
      ['head / tail [-n N] file', 'first / last lines'],
      ['wc [-l -w -c] file…', 'count lines, words, characters'],
      ['touch file…', 'create empty files'],
      ['mkdir folder…', 'create folders'],
      ['cp [-r -f] src… dest', 'copy'],
      ['mv src… dest', 'move or rename'],
      ['rm [-r] path…', 'delete (asks first; * and ? work)'],
      ['echo [-e] text [> file]', 'print or write text (>> appends)'],
      ['grep [-i -n -r -l -c -v] text [path]', 'search inside files'],
      ['find [path] [-name "*.js"] [-type f|d]', 'find files and folders'],
      ['sort [-r -n] · uniq [-c]', 'sort / remove repeated lines'],
      ['du [path]', 'sizes']
    ]],
    ['Run', [
      ['node file.js  ·  run [file]', 'run .js (isolated worker) or open .html in the preview'],
      ['js 2+2  ·  node -e "code"', 'run a snippet'],
      ['open file…  ·  edit file', 'open in the editor (edit creates it if missing)'],
      ['preview', 'open the HTML preview'],
      ['stop  (or Ctrl+C)', 'stop what is running']
    ]],
    ['Git (GitHub API, no git needed)', [
      ['git status', 'changes since the last push'],
      ['git commit -m "msg"', 'save the message for the push'],
      ['git push [-m "msg"]', 'create the commit and push everything'],
      ['git pull', 'bring changes from GitHub'],
      ['git log [-n 10]', 'latest commits'],
      ['git branch · git remote', 'branch and repository'],
      ['git clone user/repo [branch]', 'download a repository as a new project'],
      ['deploy ["msg"]', 'git push + what happens next on Cloudflare Pages']
    ]],
    ['Project', [
      ['projects · project <name>', 'list / switch project'],
      ['save · export', 'save all in the app · download everything as .zip'],
      ['history · clear · date · exit', 'previous commands · clear screen · date · close terminal']
    ]],
    ['Real shell (optional)', [
      ['bridge connect TOKEN', 'link to cc-bridge.py in the Linux terminal (npm, wrangler, git, python…)'],
      ['! command', 'run one real command, e.g. ! git status · ! npx wrangler pages deploy .'],
      ['bridge off', 'back to the virtual terminal only']
    ]]
  ];

  const TM = {
    help(a, io) {
      if (a[0]) {
        const rows = [];
        TM_HELP.forEach(([, list]) => list.forEach((r) => { if (r[0].split(/[\s·]+/).includes(a[0]) || r[0].startsWith(a[0])) rows.push(r); }));
        if (!rows.length) { io.err(`help: no help for «${a[0]}»`); return; }
        rows.forEach((r) => io.print(r[0].padEnd(40) + r[1]));
        return;
      }
      TM_HELP.forEach(([title, list]) => {
        io.print(title, 'ok');
        list.forEach((r) => io.print('  ' + r[0].padEnd(40) + r[1]));
      });
      io.print('');
      io.print('Tips: | pipes · > and >> write to a file · && chains · * ? wildcards · Tab completes · ↑ ↓ history · Ctrl+C stop · Ctrl+L clear', 'dim');
      io.print('Not available (need a real system): npm, python, wrangler… Use git push / deploy to publish, or the Linux terminal (Crostini).', 'dim');
    },
    pwd(a, io) { io.print('/' + tm.cwd); },
    cd(a, io) {
      if (!a[0] || a[0] === '~') { tm.cwd = ''; return; }
      const p = tmResolve(a[0]);
      if (tmFile(p)) { io.err(`cd: ${p}: not a folder`); return; }
      if (!tmIsDir(p)) { io.err(`cd: ${a[0]}: no such folder`); return; }
      tm.cwd = p;
    },
    ls(a, io) {
      const fl = tmFlags(a);
      const long = fl.f.has('l');
      const targets = fl.rest.length ? tmPaths(fl.rest) : [tm.cwd];
      const row = (name, f, dir) => {
        if (!long) { io.print(dir ? name + '/' : name, dir ? 'dir' : ''); return; }
        const when = f && f.updated ? tmDate(f.updated) : ''.padEnd(16);
        io.print((dir ? '-' : fmtSize(f.size || 0)).padStart(9) + '  ' + when + '  ' + (dir ? name + '/' : name), dir ? 'dir' : '');
      };
      targets.forEach((p) => {
        const f = tmFile(p);
        if (f) { row(p, f, false); return; }
        if (!tmIsDir(p)) { io.err(`ls: ${p || '/'}: no such file or folder`); return; }
        if (targets.length > 1) io.print(`${p || '/'}:`, 'dim');
        const { dirs, files } = tmList(p);
        dirs.forEach((d) => row(d, null, true));
        files.forEach((x) => row(baseName(x.name), x, false));
        if (!dirs.length && !files.length) io.print('(empty)', 'dim');
      });
    },
    tree(a, io) {
      const fl = tmFlags(a, ['L']);
      const root = tmResolve(fl.rest[0] || '');
      if (!tmIsDir(root)) { io.err(`tree: ${fl.rest[0]}: no such folder`); return; }
      const maxD = Math.max(1, parseInt(fl.val.L, 10) || 4);
      let shown = 0; let nd = 0; let nf = 0; let cut = false;
      io.print('/' + root, 'dir');
      (function walk(p, prefix, depth) {
        const { dirs, files } = tmList(p);
        const items = [...dirs.map((d) => ({ n: d, d: true })), ...files.map((f) => ({ n: baseName(f.name), d: false }))];
        items.forEach((it, i) => {
          if (shown >= 300) { cut = true; return; }
          shown++;
          if (it.d) nd++; else nf++;
          const last = i === items.length - 1;
          io.print(prefix + (last ? '└── ' : '├── ') + it.n + (it.d ? '/' : ''), it.d ? 'dir' : '');
          if (it.d && depth < maxD) walk(joinP(p, it.n), prefix + (last ? '    ' : '│   '), depth + 1);
        });
      })(root, '', 1);
      io.print(`${nd} folder(s), ${nf} file(s)${cut ? ' (list cut at 300)' : ''}`, 'dim');
    },
    async cat(a, io) {
      const fl = tmFlags(a);
      const src = await tmSources(fl.rest, io, 'cat');
      if (!src) return;
      src.forEach((s) => s.lines.forEach((l, i) => io.print(fl.f.has('n') ? String(i + 1).padStart(4) + '  ' + l : l)));
    },
    async head(a, io) {
      const fl = tmFlags(a, ['n']);
      const n = Math.max(0, parseInt(fl.val.n, 10) || 10);
      const src = await tmSources(fl.rest, io, 'head');
      if (!src) return;
      src.forEach((s) => {
        if (src.length > 1) io.print(`==> ${s.name} <==`, 'dim');
        s.lines.slice(0, n).forEach((l) => io.print(l));
      });
    },
    async tail(a, io) {
      const fl = tmFlags(a, ['n']);
      const n = Math.max(0, parseInt(fl.val.n, 10) || 10);
      const src = await tmSources(fl.rest, io, 'tail');
      if (!src) return;
      src.forEach((s) => {
        if (src.length > 1) io.print(`==> ${s.name} <==`, 'dim');
        s.lines.slice(Math.max(0, s.lines.length - n)).forEach((l) => io.print(l));
      });
    },
    async wc(a, io) {
      const fl = tmFlags(a);
      const src = await tmSources(fl.rest, io, 'wc');
      if (!src) return;
      const all = !fl.f.has('l') && !fl.f.has('w') && !fl.f.has('c');
      const fmt = (l, w, c, name) => {
        let s = '';
        if (all || fl.f.has('l')) s += String(l).padStart(7);
        if (all || fl.f.has('w')) s += String(w).padStart(7);
        if (all || fl.f.has('c')) s += String(c).padStart(8);
        return s + (name ? ' ' + name : '');
      };
      const T = [0, 0, 0];
      src.forEach((s) => {
        const text = s.lines.join('\n');
        const w = (text.match(/\S+/g) || []).length;
        const c = text.length + (s.lines.length ? 1 : 0);
        T[0] += s.lines.length; T[1] += w; T[2] += c;
        io.print(fmt(s.lines.length, w, c, s.name));
      });
      if (src.length > 1) io.print(fmt(T[0], T[1], T[2], 'total'));
    },
    async sort(a, io) {
      const fl = tmFlags(a);
      const src = await tmSources(fl.rest, io, 'sort');
      if (!src) return;
      const lines = [].concat(...src.map((s) => s.lines));
      lines.sort(fl.f.has('n') ? (x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0) : (x, y) => (x < y ? -1 : x > y ? 1 : 0));
      if (fl.f.has('r')) lines.reverse();
      lines.forEach((l) => io.print(l));
    },
    async uniq(a, io) {
      const fl = tmFlags(a);
      const src = await tmSources(fl.rest, io, 'uniq');
      if (!src) return;
      const lines = [].concat(...src.map((s) => s.lines));
      let i = 0;
      while (i < lines.length) {
        let j = i;
        while (j + 1 < lines.length && lines[j + 1] === lines[i]) j++;
        io.print((fl.f.has('c') ? String(j - i + 1).padStart(5) + ' ' : '') + lines[i]);
        i = j + 1;
      }
    },
    async touch(a, io) {
      if (!a.length) { io.err('touch: missing file name'); return; }
      for (const arg of a) {
        const p = tmResolve(arg);
        if (!p || tmIsDir(p)) continue;
        const bp = tmBlockedParent(p);
        if (bp) { io.err(`touch: ${bp} is a file, not a folder`); continue; }
        if (!tmFile(p)) await createFileRecord(p, '');
      }
      renderFiles();
    },
    mkdir(a, io) {
      const fl = tmFlags(a);
      if (!fl.rest.length) { io.err('mkdir: missing folder name'); return; }
      let made = 0;
      fl.rest.forEach((arg) => {
        const p = tmResolve(arg);
        if (!p) return;
        if (tmFile(p)) { io.err(`mkdir: ${p}: a file with that name exists`); return; }
        if (tmIsDir(p)) { if (!fl.f.has('p')) io.err(`mkdir: ${p}: already exists`); return; }
        const bp = tmBlockedParent(p);
        if (bp) { io.err(`mkdir: ${bp} is a file, not a folder`); return; }
        projDirs().push(normalizePath(p));
        made++;
      });
      if (made) { persistProjects(); renderFiles(); }
    },
    async cp(a, io) {
      const fl = tmFlags(a);
      const rec = fl.f.has('r') || fl.f.has('R');
      const force = fl.f.has('f');
      if (fl.rest.length < 2) { io.err('cp: usage: cp [-r] source… destination'); return; }
      const dest = tmResolve(fl.rest[fl.rest.length - 1]);
      const srcs = tmPaths(fl.rest.slice(0, -1));
      const destIsDir = tmIsDir(dest);
      if (srcs.length > 1 && !destIsDir) { io.err('cp: with several sources the destination must be an existing folder'); return; }
      let n = 0;
      for (const s of srcs) {
        const mf = tmFile(s);
        if (mf) {
          n += await tmCopyFile(mf, destIsDir ? joinP(dest, baseName(s)) : dest, force, io);
        } else if (s && tmIsDir(s)) {
          if (!rec) { io.err(`cp: ${s}: is a folder (use -r)`); continue; }
          const to = destIsDir ? joinP(dest, baseName(s)) : dest;
          if (to === s || to.startsWith(s + '/')) { io.err('cp: cannot copy a folder into itself'); continue; }
          for (const f of state.files.filter((x) => x.name.startsWith(s + '/'))) n += await tmCopyFile(f, to + f.name.slice(s.length), force, io);
          const pd = projDirs();
          pd.filter((d) => d === s || d.startsWith(s + '/')).forEach((d) => { const nd = to + d.slice(s.length); if (!pd.includes(nd)) pd.push(nd); });
          persistProjects();
        } else io.err(`cp: ${s || '/'}: no such file or folder`);
      }
      renderFiles();
      if (n) io.print(`${n} file(s) copied`, 'dim');
    },
    async mv(a, io) {
      const fl = tmFlags(a);
      if (fl.rest.length < 2) { io.err('mv: usage: mv source… destination'); return; }
      const dest = tmResolve(fl.rest[fl.rest.length - 1]);
      const srcs = tmPaths(fl.rest.slice(0, -1));
      const destIsDir = tmIsDir(dest);
      if (srcs.length > 1 && !destIsDir) { io.err('mv: with several sources the destination must be an existing folder'); return; }
      for (const s of srcs) {
        if (!s) { io.err('mv: cannot move the project root'); continue; }
        const to = destIsDir ? joinP(dest, baseName(s)) : dest;
        const mf = tmFile(s);
        if (mf) {
          if (tmIsDir(to)) { io.err(`mv: ${to}: is a folder`); continue; }
          const bp = tmBlockedParent(to);
          if (bp) { io.err(`mv: ${bp} is a file, not a folder`); continue; }
          if (!(await renameFile(mf, to))) io.err(`mv: ${to}: already exists`);
        } else if (tmIsDir(s)) {
          if (to === s) continue;
          if (to.startsWith(s + '/')) { io.err('mv: cannot move a folder into itself'); continue; }
          if (tmFile(to)) { io.err(`mv: ${to}: a file with that name exists`); continue; }
          await renameDirTo(s, to);
        } else io.err(`mv: ${s}: no such file or folder`);
      }
      renderFiles();
    },
    async rm(a, io) {
      const fl = tmFlags(a);
      const rec = fl.f.has('r') || fl.f.has('R');
      if (!fl.rest.length) { io.err('rm: usage: rm [-r] path…'); return; }
      const ids = new Set();
      const dirs = new Set();
      for (const p of tmPaths(fl.rest)) {
        if (!p) { io.err('rm: cannot delete the project root'); continue; }
        const m = tmFile(p);
        if (m) ids.add(m.id);
        else if (tmIsDir(p)) {
          if (!rec) { io.err(`rm: ${p}: is a folder (use -r)`); continue; }
          dirs.add(p);
          state.files.forEach((f) => { if (f.name.startsWith(p + '/')) ids.add(f.id); });
        } else if (!fl.f.has('f')) io.err(`rm: ${p}: no such file or folder`);
      }
      if (!ids.size && !dirs.size) return;
      const what = `${ids.size} file(s)` + (dirs.size ? ` and ${dirs.size} folder(s)` : '');
      if (!window.confirm(`Delete ${what}?\n\nThe terminal cannot undo this.`)) { io.print('cancelled', 'dim'); io.fail = true; return; }
      if (ids.size) await deleteFiles([...ids], false);
      if (dirs.size) {
        const pd = projDirs();
        for (let i = pd.length - 1; i >= 0; i--) if ([...dirs].some((d) => pd[i] === d || pd[i].startsWith(d + '/'))) pd.splice(i, 1);
        persistProjects();
      }
      renderFiles();
      io.print(`deleted ${what}`, 'dim');
    },
    echo(a, io) {
      let args = a;
      let esc = false;
      if (args[0] === '-e') { esc = true; args = args.slice(1); }
      let text = args.join(' ');
      if (esc) text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      text.split('\n').forEach((l) => io.print(l));
    },
    async grep(a, io) {
      const fl = tmFlags(a);
      const pat = fl.rest.shift();
      if (pat == null) { io.err('grep: usage: grep [-i -n -r -l -c -v] text [path]'); return; }
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = fl.f.has('i') ? 'i' : '';
      let re;
      try { re = new RegExp(fl.f.has('F') ? esc(pat) : pat, flags); } catch (_) { re = new RegExp(esc(pat), flags); }
      const inv = fl.f.has('v');
      const num = fl.f.has('n');
      const test = (s) => re.test(s) !== inv;
      if (io.stdin && !fl.rest.length) {
        io.stdin.forEach((l, i) => { if (test(l)) io.print((num ? (i + 1) + ':' : '') + l); });
        return;
      }
      const rec = fl.f.has('r') || fl.f.has('R');
      const files = [];
      for (const p of (fl.rest.length ? tmPaths(fl.rest) : [tm.cwd])) {
        const m = tmFile(p);
        if (m) files.push(m);
        else if (tmIsDir(p)) {
          if (!rec && fl.rest.length) { io.err(`grep: ${p}: is a folder (use -r)`); continue; }
          const pre = p ? p + '/' : '';
          state.files.forEach((f) => { if (f.name.startsWith(pre)) files.push(f); });
        } else io.err(`grep: ${p || '/'}: no such file or folder`);
      }
      const multi = files.length > 1 || rec;
      let hits = 0;
      let scanned = 0;
      for (const f of files) {
        if (f.binary || scanned++ > 3000) continue;
        const lines = tmSplit(await getText(f));
        let cnt = 0;
        for (let k = 0; k < lines.length; k++) {
          if (!test(lines[k])) continue;
          cnt++; hits++;
          if (fl.f.has('l')) break;
          if (!fl.f.has('c')) io.print((multi ? f.name + ':' : '') + (num ? (k + 1) + ':' : '') + lines[k].slice(0, 300));
          if (hits >= 500) break;
        }
        if (fl.f.has('l') && cnt) io.print(f.name);
        if (fl.f.has('c')) io.print((multi ? f.name + ':' : '') + cnt);
        if (hits >= 500) { io.print('… too many matches, narrow the search', 'dim'); break; }
      }
      if (!hits && !io.capture) { io.print('no matches', 'dim'); io.fail = true; }
    },
    find(a, io) {
      let start = tm.cwd; let name = null; let type = null; let ci = false;
      for (let k = 0; k < a.length; k++) {
        const x = a[k];
        if (x === '-name' || x === '-iname') { name = a[++k]; ci = x === '-iname'; }
        else if (x === '-type') type = a[++k];
        else if (!x.startsWith('-')) start = tmResolve(x);
      }
      if (!tmIsDir(start)) { io.err(`find: ${start}: no such folder`); return; }
      const rx = name ? new RegExp('^' + name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', ci ? 'i' : '') : null;
      const pre = start ? start + '/' : '';
      const items = [];
      if (type !== 'f') allDirPaths().forEach((d) => { if (d.startsWith(pre)) items.push([d, true]); });
      if (type !== 'd') state.files.forEach((f) => { if (f.name.startsWith(pre)) items.push([f.name, false]); });
      items.filter((it) => !rx || rx.test(baseName(it[0]))).sort((x, y) => tmCmp(x[0], y[0])).forEach((it) => io.print(it[0] + (it[1] ? '/' : ''), it[1] ? 'dir' : ''));
    },
    du(a, io) {
      const p = a[0] ? tmResolve(a[0]) : tm.cwd;
      if (!tmIsDir(p)) { io.err(`du: ${a[0]}: no such folder`); return; }
      const pre = p ? p + '/' : '';
      const { dirs, files } = tmList(p);
      const rows = [];
      dirs.forEach((d) => {
        let s = 0;
        state.files.forEach((f) => { if (f.name.startsWith(pre + d + '/')) s += f.size || 0; });
        rows.push([s, d + '/']);
      });
      files.forEach((f) => rows.push([f.size || 0, baseName(f.name)]));
      rows.sort((x, y) => y[0] - x[0]).slice(0, 40).forEach((r) => io.print(fmtSize(r[0]).padStart(9) + '  ' + r[1]));
      const inside = state.files.filter((f) => !p || f.name.startsWith(pre));
      io.print(fmtSize(inside.reduce((s, f) => s + (f.size || 0), 0)).padStart(9) + `  total (${inside.length} files)`, 'ok');
    },
    async node(a, io) {
      if (a[0] === '-e') {
        const code = a.slice(1).join(' ');
        if (!code.trim()) { io.err('node -e: missing code'); return; }
        io.fail = (await runCode('<eval>', code)) === false;
        return;
      }
      if (!a.length) { io.err('node: usage: node file.js  ·  node -e "code"'); return; }
      const p = tmResolve(a[0]);
      const m = tmFile(p);
      if (!m) { io.err(`node: ${p || '/'}: no such file`); return; }
      io.fail = (await runFile(m)) === false;
    },
    async js(a, io) {
      const code = a.join(' ');
      if (!code.trim()) { io.err('js: usage: js 2+2  ·  js console.log("hi")'); return; }
      const isExpr = !/[;\n]/.test(code) && !/^\s*(const|let|var|function|class|if|for|while|switch|try|import|export|await|console\.|throw|return)\b/.test(code);
      io.fail = (await runCode('<js>', isExpr ? `console.log(${code});` : code)) === false;
    },
    async run(a, io) {
      let m = state.current;
      if (a.length) {
        const p = tmResolve(a[0]);
        m = tmFile(p);
        if (!m) { io.err(`run: ${p || '/'}: no such file`); return; }
      }
      if (!m) { io.err('run: no file is open'); return; }
      if (m.binary || !/^(m?js|html?)$/.test(extOf(m.name))) { io.err(`run: ${m.name}: only .js and .html files can be run here`); return; }
      await runFile2(m);
    },
    async open(a, io) {
      if (!a.length) { io.err('open: usage: open file…'); return; }
      let any = false;
      for (const p of tmPaths(a)) {
        const m = tmFile(p);
        if (!m) { io.err(`open: ${p || '/'}: no such file (edit ${a[0]} creates it)`); continue; }
        await openFile(m.id);
        any = true;
      }
      if (any) focusEd();
    },
    async edit(a, io) {
      const p = tmResolve(a[0] || '');
      if (!p) { io.err('edit: usage: edit file'); return; }
      if (tmIsDir(p)) { io.err(`edit: ${p}: is a folder`); return; }
      const bp = tmBlockedParent(p);
      if (bp) { io.err(`edit: ${bp} is a file, not a folder`); return; }
      let m = tmFile(p);
      if (!m) { m = await createFileRecord(p, ''); renderFiles(); }
      await openFile(m.id);
      focusEd();
    },
    preview() { setPreview(true); },
    stop() { stopRun(true); },
    clear() { term.out.replaceChildren(); },
    history(a, io) { tm.hist.forEach((c, i) => io.print(String(i + 1).padStart(4) + '  ' + c)); },
    date(a, io) { io.print(tmDate(Date.now(), true)); },
    exit() { setPanel('terminal', false); },
    projects(a, io) {
      state.projects.forEach((p) => io.print((state.project && p.id === state.project.id ? '* ' : '  ') + p.name + (p.link ? '  (folder)' : '') + (p.gh ? '  ' + p.gh.repo : '')));
    },
    async project(a, io) {
      const n = a.join(' ').trim().toLowerCase();
      if (!n) { io.print(state.project ? state.project.name : '—'); return; }
      const p = state.projects.find((x) => x.name.toLowerCase() === n) || state.projects.find((x) => x.name.toLowerCase().startsWith(n));
      if (!p) { io.err(`project: «${a.join(' ')}» not found (see: projects)`); return; }
      await switchProject(p.id);
      tm.cwd = '';
      io.print('now in project ' + p.name, 'dim');
    },
    async save(a, io) { await saveAll(); io.print('everything saved in the app', 'dim'); },
    async export() { await actions['export-zip'](); },
    async git(a, io) {
      const sub = a[0];
      const rest = a.slice(1);
      const p = curProj();
      if (!sub || sub === 'help') { io.print('git: status · add · commit -m "msg" · push [-m "msg"] · pull · log · branch · remote · clone user/repo'); return; }
      if (sub === 'status') {
        if (!(p && p.gh)) { io.print('This project is not linked to GitHub. Open Source control (Ctrl+Shift+G) and use Publish, Link or Clone.'); return; }
        io.print(`On branch ${p.gh.branch || 'main'} · ${p.gh.repo}`, 'ok');
        const ch = await computeChanges();
        if (!ch.length) { io.print('Nothing to push: everything matches GitHub.'); return; }
        ch.forEach((c) => io.print(`  ${c.st}  ${c.name}`, c.st === 'A' ? 'ok' : (c.st === 'D' ? 'err' : 'warn')));
        io.print(`${ch.length} change(s). Next: git push -m "message"`, 'dim');
      } else if (sub === 'add') {
        io.print('CodeCraft has no staging area: git push sends every change (GitGuard checks it first).', 'dim');
      } else if (sub === 'commit') {
        const fl = tmFlags(rest, ['m']);
        const msg = (fl.val.m || fl.rest.join(' ') || '').trim();
        if (!msg) { io.err('git commit: usage: git commit -m "message"  (the commit is created together with git push)'); return; }
        git.msg = msg;
        io.print('message saved. Now run: git push', 'dim');
      } else if (sub === 'push') {
        if (!(await tmGitReady(io, true))) return;
        const fl = tmFlags(rest, ['m']);
        const msg = (fl.val.m || fl.rest.join(' ') || git.msg || '').trim();
        tprint('… sending to GitHub', 'dim');
        await tmGitRun(io, () => ghCommitPush(msg));
      } else if (sub === 'pull') {
        if (!(await tmGitReady(io, true))) return;
        tprint('… talking to GitHub', 'dim');
        await tmGitRun(io, ghPull);
      } else if (sub === 'log') {
        if (!(await tmGitReady(io, true))) return;
        const fl = tmFlags(rest, ['n']);
        const n = Math.min(30, Math.max(1, parseInt(fl.val.n, 10) || 10));
        const list = await ghApi(`/repos/${p.gh.repo}/commits?sha=${encodeURIComponent(p.gh.branch || 'main')}&per_page=${n}`);
        (list || []).forEach((c) => io.print(`${String(c.sha).slice(0, 7)}  ${String((c.commit.author && c.commit.author.date) || '').slice(0, 10)}  ${String(c.commit.message).split('\n')[0].slice(0, 80)}  — ${(c.commit.author && c.commit.author.name) || ''}`));
      } else if (sub === 'branch') {
        if (!(p && p.gh)) { io.err('This project is not linked to GitHub.'); return; }
        io.print('* ' + (p.gh.branch || 'main'));
      } else if (sub === 'remote') {
        if (!(p && p.gh)) { io.err('This project is not linked to GitHub.'); return; }
        io.print(`origin  https://github.com/${p.gh.repo}`);
      } else if (sub === 'clone') {
        const fl = tmFlags(rest);
        const repo = String(fl.rest[0] || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
        if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { io.err('git clone: usage: git clone user/repository [branch]'); return; }
        if (!(await tmGitReady(io, false))) return;
        tprint('… downloading from GitHub', 'dim');
        await tmGitRun(io, () => ghClone(repo, fl.rest[1] || ''));
        tm.cwd = '';
      } else if (sub === 'diff') {
        io.print('git diff is not available. Use Edit → Local history… (Compare) to see what changed in a file.', 'dim');
      } else if (sub === 'init' || sub === 'remote-add') {
        io.print('To create or link a repository use Source control (Ctrl+Shift+G): Initialize, Publish or Link.', 'dim');
      } else io.err(`git ${sub}: not supported. Type: git help`);
    },
    async deploy(a, io) {
      if (!(await tmGitReady(io, true))) return;
      const msg = a.join(' ').trim() || git.msg || 'Deploy from CodeCraft';
      tprint('… sending to GitHub', 'dim');
      await tmGitRun(io, () => ghCommitPush(msg));
      if (!io.fail && /^✔/.test(git.note)) tprint('If this repository is connected to Cloudflare Pages, the deploy starts by itself (usually 1–2 min). Follow it in Cloudflare → Workers & Pages → your project → Deployments.', 'dim');
    }
  };
  TM.bridge = async (a, io) => {
    const sub = a[0] || 'status';
    if (sub === 'connect') {
      if (!a[1]) { io.err('usage: bridge connect TOKEN [port]'); return; }
      bridge.token = a[1]; bridge.port = +a[2] || 7878; bridge.on = true;
      try {
        const res = await fetch(bridgeUrl('/ping'), { headers: bridgeHead() });
        if (!res.ok) throw new Error(res.status === 401 ? 'wrong token' : 'status ' + res.status);
        const j = await res.json();
        bridge.cwd = j.cwd || '';
        store.set('cc_bridge', JSON.stringify({ token: bridge.token, port: bridge.port }));
        io.print('✔ Connected. Real shell in ' + bridge.cwd + '. Anything that is not a CodeCraft command now runs there (npm, wrangler, python…). Use ! to force a real command: ! git status', 'ok');
      } catch (e) { bridge.on = false; io.err('Could not connect: ' + ((e && e.message) || e) + '. Start it with: python3 cc-bridge.py'); }
    } else if (sub === 'off') {
      bridge.on = false; store.remove('cc_bridge'); io.print('Bridge disconnected.');
    } else io.print(bridge.on ? 'Bridge connected (port ' + bridge.port + ', folder ' + (bridge.cwd || '?') + ').' : 'Bridge not connected. In the Linux terminal run: python3 cc-bridge.py  — then here: bridge connect TOKEN', bridge.on ? 'ok' : 'dim');
  };
  // Atajos de costumbre
  TM.ll = (a, io) => TM.ls(['-l', ...a], io);
  TM.cls = TM.clear;
  TM.rename = TM.mv;
  TM.code = TM.open;
  TM.dir = TM.ls;
  TM.type = TM.cat;
  TM.quit = TM.exit;
  const tmCmdNames = () => [...new Set([...Object.keys(TM), ...Object.keys(TM_REAL)])].sort();

  async function tmExec(cmd, stdin, capture) {
    const io = { stdin, out: [], fail: false, capture };
    io.print = (t, c) => { io.out.push(c ? [String(t), c] : String(t)); };
    io.err = (t) => { tprint(String(t), 'err'); io.fail = true; };
    const name = cmd.argv[0];
    const args = cmd.argv.slice(1);
    try {
      if (Object.prototype.hasOwnProperty.call(TM, name)) await TM[name](args, io);
      else await tmUnknown(name, args, io);
    } catch (e) { io.err(name + ': ' + ((e && e.message) || e)); }
    return io;
  }

  async function tmRunPipeline(cmds) {
    let stdin = null;
    let ok = true;
    for (let i = 0; i < cmds.length; i++) {
      const c = cmds[i];
      const last = i === cmds.length - 1;
      const io = await tmExec(c, stdin, !last || !!c.out);
      if (c.out) {
        const text = tmText(io.out).join('\n');
        try { await tmWrite(c.out.target, text ? text + '\n' : '', c.out.append); }
        catch (e) { tprint('> ' + ((e && e.message) || e), 'err'); io.fail = true; }
      } else if (last) tmFlush(io.out);
      else stdin = tmText(io.out);
      ok = !io.fail;
      if (!ok) break;
    }
    return ok;
  }

  const tmPrompt = () => (state.project ? String(state.project.name).slice(0, 20) : '~') + ':/' + tm.cwd + '$';
  function tmUpdatePrompt() {
    try { if (!tmIsDir(tm.cwd)) tm.cwd = ''; } catch (_) { tm.cwd = ''; }
    if (tm.ps) tm.ps.textContent = tmPrompt();
  }
  const tmFocus = () => { if (tm.input) tm.input.focus(); };

  // Ejecuta una línea (también la usan los workflows con «$» y la paleta con «$»). Devuelve true si salió bien.
  async function termExecLine(line) {
    line = String(line || '').trim();
    if (!line) return true;
    if (tm.busy) { tprint('Wait: another command is still running (Ctrl+C stops it).', 'warn'); return false; }
    if (!termVisible()) setPanel('terminal', true);
    tm.busy = true;
    tmUpdatePrompt();
    tprint(tmPrompt() + ' ' + line, 'cmd');
    let ok = true;
    if (line[0] === '!' || tmBridgeWants(line)) {
      const real = line[0] === '!' ? line.slice(1).trim() : line;
      try { ok = real ? await bridgeRun(real) : true; } finally { tm.busy = false; tmUpdatePrompt(); }
      return ok;
    }
    try {
      const seq = tmParse(line);
      for (const pipe of seq) { ok = await tmRunPipeline(pipe); if (!ok) break; }
    } catch (e) { tprint((e && e.message) || String(e), 'err'); ok = false; }
    finally { tm.busy = false; tmUpdatePrompt(); }
    return ok;
  }

  function tmPushHist(line) {
    line = line.trim();
    if (!line) return;
    if (tm.hist[tm.hist.length - 1] !== line) tm.hist.push(line);
    if (tm.hist.length > 60) tm.hist.splice(0, tm.hist.length - 60);
    store.set('cc_term_hist', JSON.stringify(tm.hist.filter((l) => !tmSecretLine.test(l))));
  }

  function tmComplete() {
    const inp = tm.input;
    const pos = inp.selectionStart;
    const before = inp.value.slice(0, pos);
    const after = inp.value.slice(pos);
    const word = /[^\s|&>]*$/.exec(before)[0];
    const head = before.slice(0, before.length - word.length);
    const raw = word.replace(/\\ /g, ' ');
    let cands;
    if (/(^\s*|[|&]\s*)$/.test(head) && !raw.includes('/')) {
      cands = tmCmdNames().filter((n) => n.startsWith(raw)).map((n) => [n, false]);
    } else {
      const slash = raw.lastIndexOf('/');
      const dirPart = raw.slice(0, slash + 1);
      const stem = raw.slice(slash + 1);
      const base = dirPart ? tmResolve(dirPart) : tm.cwd;
      if (!tmIsDir(base)) return;
      const { dirs, files } = tmList(base);
      cands = [...dirs.map((d) => [dirPart + d + '/', true]), ...files.map((f) => [dirPart + baseName(f.name), false])]
        .filter((c) => baseName(c[0].replace(/\/$/, '')).startsWith(stem));
    }
    if (!cands.length) return;
    const names = cands.map((c) => c[0]);
    const common = names.reduce((x, y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return x.slice(0, i); });
    const single = cands.length === 1;
    const text = common.replace(/ /g, '\\ ') + (single && !cands[0][1] ? ' ' : '');
    inp.value = head + text + after;
    inp.setSelectionRange((head + text).length, (head + text).length);
    if (!single && common.length <= raw.length) tprint(cands.slice(0, 60).map((c) => baseName(c[0].replace(/\/$/, '')) + (c[1] ? '/' : '')).join('  '), 'dim');
  }

  if (tm.input) {
    tm.input.addEventListener('focus', tmUpdatePrompt);
    tm.input.addEventListener('keydown', async (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = (e.key || '').toLowerCase();
      const inp = tm.input;
      if (e.key === 'Enter') {
        e.preventDefault();
        const line = inp.value;
        inp.value = '';
        tmPushHist(line);
        tm.hi = tm.hist.length;
        tm.draft = '';
        await termExecLine(line);
        if (!document.activeElement || document.activeElement === document.body) tmFocus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (tm.hi > 0) { if (tm.hi === tm.hist.length) tm.draft = inp.value; tm.hi--; inp.value = tm.hist[tm.hi]; inp.setSelectionRange(inp.value.length, inp.value.length); }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (tm.hi < tm.hist.length) { tm.hi++; inp.value = tm.hi === tm.hist.length ? tm.draft : tm.hist[tm.hi]; inp.setSelectionRange(inp.value.length, inp.value.length); }
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        tmComplete();
      } else if (mod && k === 'c' && inp.selectionStart === inp.selectionEnd) {
        e.preventDefault();
        if (bridge.ctl) { try { fetch(bridgeUrl('/stop'), { method: 'POST', headers: bridgeHead(), body: '{}' }); } catch (_) {} bridge.ctl.abort(); } else if (runState) stopRun(); else { tprint(tmPrompt() + ' ' + inp.value + '^C', 'dim'); inp.value = ''; }
      } else if (mod && k === 'l') {
        e.preventDefault();
        term.out.replaceChildren();
      } else if (e.key === 'Escape') {
        focusEd();
      }
    });
  }
  tmUpdatePrompt();
  tprint('CodeCraft terminal — type help. It works on your project files; git uses the GitHub API.', 'dim');

  // ---- Pantalla de bienvenida: archivos recientes y accesos ----
  function noteRecent(meta) {
    try {
      const m = JSON.parse(store.get('cc_recent') || '{}');
      const k = state.project.id;
      const arr = (m[k] || []).filter((x) => x !== meta.id);
      arr.unshift(meta.id);
      m[k] = arr.slice(0, 8);
      store.set('cc_recent', JSON.stringify(m));
    } catch (_) { /* nada */ }
  }

  function recentFiles(n) {
    let ids = [];
    try { const m = JSON.parse(store.get('cc_recent') || '{}'); ids = (state.project && m[state.project.id]) || []; } catch (_) { /* nada */ }
    const out = [];
    ids.forEach((id) => { const f = state.files.find((x) => x.id === id); if (f && !f.binary) out.push(f); });
    if (out.length < n) {
      state.files.filter((f) => !f.binary && !out.includes(f)).sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, n - out.length).forEach((f) => out.push(f));
    }
    return out.slice(0, n);
  }

  function welcomeExtras(card) {
    const rec = recentFiles(6);
    if (rec.length) {
      card.append(h('div', { class: 'welcome-extra' },
        h('h3', { text: 'Recent files' }),
        h('ul', { class: 'recent-list' }, rec.map((f) => h('li', null,
          h('button', { type: 'button', onclick: () => { openFile(f.id).then(focusEd); } },
            h('span', { text: baseName(f.name) }), h('small', { text: parentOf(f.name) || '/' })))))));
    }
    card.append(h('div', { class: 'welcome-extra' },
      h('h3', { text: 'More' }),
      h('div', { class: 'empty-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'term-focus', text: 'Terminal' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'open-folder', text: 'Open Chromebook folder' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'git', text: 'GitHub' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'palette', text: 'Commands' }))));
    card.append(h('p', { class: 'welcome-extra welcome-keys', text: 'Ctrl+P open file · Ctrl+Shift+P commands · Ctrl+` terminal · Ctrl+S save' }));
  }
  // <<< TERMINAL END

  init();

  // ---------------------------------------------------------------
  // Service Worker
  // ---------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const hadCtl = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl) toast('CodeCraft was updated. Reload to use the new version.', 'ok'); });
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
