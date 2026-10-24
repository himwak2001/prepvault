// ─────────────────────────────────────────────────────────────────
// CONFIG  – injected by GitHub Actions from secrets
// ─────────────────────────────────────────────────────────────────
const SUPABASE_URL  = window.ENV_SUPABASE_URL  || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON = window.ENV_SUPABASE_ANON || 'YOUR_SUPABASE_ANON_KEY';

// ─────────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────────
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  themeVariables: {
    primaryColor:       '#4A72E8',
    primaryTextColor:   '#ffffff',
    primaryBorderColor: '#3A5FD4',
    lineColor:          '#6B8FFF',
    secondaryColor:     '#EBF0FD',
    tertiaryColor:      '#f0f4ff',
    background:         'transparent',
    fontSize:           '14px',
    fontFamily:         'Inter, system-ui, sans-serif',
  }
});

marked.setOptions({ breaks: true, gfm: true });

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
const state = {
  user: null,
  topics: [],
  currentTopicId: null,
  questions: [],
  editingQId: null,
  editingTopicId: null,
  publicMode: false,
  theme: localStorage.getItem('pv-theme') || 'auto',
};

// ─────────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────────
function applyTheme() {
  const t = state.theme;
  const el = document.documentElement;
  if (t === 'dark')  el.setAttribute('data-theme', 'dark');
  else if (t === 'light') el.setAttribute('data-theme', 'light');
  else el.removeAttribute('data-theme');
}
function toggleTheme() {
  const themes = ['auto', 'dark', 'light'];
  state.theme = themes[(themes.indexOf(state.theme) + 1) % 3];
  localStorage.setItem('pv-theme', state.theme);
  applyTheme();
}
applyTheme();

// ─────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────
function esc(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function toast(msg, type = 'ok', dur = 3200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), dur);
}

function showConfirm(title, body) {
  return new Promise(resolve => {
    const m = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-body').textContent  = body;
    m.classList.remove('hidden');
    const cleanup = (v) => { m.classList.add('hidden'); resolve(v); };
    document.getElementById('confirm-yes').onclick = () => cleanup(true);
    document.getElementById('confirm-no').onclick  = () => cleanup(false);
  });
}

// ─────────────────────────────────────────────────────────────────
// URL HELPERS  (Fix 3: clean URL, no trailing ?)
// ─────────────────────────────────────────────────────────────────
function getPublicTopicId() {
  return new URLSearchParams(location.search).get('topic') || null;
}

function setCleanUrl(topicId) {
  // Called when a topic is selected so URL reflects it without ?
  const base = location.pathname;
  const next = topicId ? `${base}?topic=${topicId}` : base;
  history.replaceState(null, '', next);
}

// ─────────────────────────────────────────────────────────────────
// MARKDOWN + MERMAID RENDERER
// ─────────────────────────────────────────────────────────────────
async function renderMdWithMermaid(el, md) {
  el.innerHTML = '';
  const raw = md || '';
  // Split on mermaid fences first
  const parts = raw.split(/(```mermaid[\s\S]*?```)/g);

  for (const part of parts) {
    const mmatch = part.match(/^```mermaid\n?([\s\S]*?)```$/);
    if (mmatch) {
      const code    = mmatch[1].trim();
      const id      = 'mm' + Math.random().toString(36).slice(2);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrapper';
      try {
        const { svg } = await mermaid.render(id, code);
        wrapper.innerHTML = svg;
      } catch(e) {
        wrapper.innerHTML = `<pre style="color:var(--red);font-size:.8rem;padding:8px">Diagram error: ${esc(e.message)}</pre>`;
      }
      el.appendChild(wrapper);
    } else if (part.trim()) {
      const div = document.createElement('div');
      div.innerHTML = DOMPurify.sanitize(marked.parse(part));
      // Enhance code blocks
      div.querySelectorAll('pre').forEach(enhanceCodeBlock);
      el.appendChild(div);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// FIX 7: Enhanced code blocks — copy button + language label
// ─────────────────────────────────────────────────────────────────
function enhanceCodeBlock(pre) {
  const code = pre.querySelector('code');
  if (!code) return;

  // Detect language from class e.g. language-javascript
  const langClass = Array.from(code.classList).find(c => c.startsWith('language-'));
  const lang = langClass ? langClass.replace('language-', '') : 'code';

  const wrapper = document.createElement('div');
  wrapper.className = 'code-block-wrapper';

  const header = document.createElement('div');
  header.className = 'code-block-header';
  header.innerHTML = `
    <span class="code-lang-label">${esc(lang)}</span>
    <button class="copy-btn" title="Copy code">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      Copy
    </button>`;

  header.querySelector('.copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(code.textContent).then(() => {
      const btn = header.querySelector('.copy-btn');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      btn.style.color = '#34c987';
      setTimeout(() => {
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        btn.style.color = '';
      }, 2000);
    });
  });

  // Set Cascadia Code font on the code element
  code.style.fontFamily = "'Cascadia Code', 'Fira Code', 'SF Mono', Consolas, monospace";

  pre.parentNode.insertBefore(wrapper, pre);
  wrapper.appendChild(header);
  wrapper.appendChild(pre);
}

// ─────────────────────────────────────────────────────────────────
// BOOT / ROUTER
// ─────────────────────────────────────────────────────────────────
async function boot() {
  const publicId = getPublicTopicId();
  if (publicId) { await bootPublic(publicId); return; }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showAuthScreen('login'); return; }
  state.user = session.user;
  await showApp();
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC MODE
// ─────────────────────────────────────────────────────────────────
async function bootPublic(topicId) {
  state.publicMode = true;
  document.body.classList.add('public-mode');
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('open-sidebar').classList.add('hidden');

  const banner = document.createElement('div');
  banner.id = 'public-banner';
  banner.innerHTML = `📖 Viewing a shared topic. <a href="${location.origin}${location.pathname}" style="font-weight:600">Create your own PrepVault →</a>`;
  document.getElementById('main').prepend(banner);

  const { data: topic, error } = await sb.from('topics')
    .select('*').eq('id', topicId).eq('is_public', true).single();

  if (error || !topic) {
    document.getElementById('content').innerHTML = `<div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h2>Topic not found</h2><p>This topic is private or does not exist.</p></div>`;
    return;
  }

  document.getElementById('header-title').textContent = topic.name;
  const { data: questions } = await sb.from('questions')
    .select('*').eq('topic_id', topicId).order('sort_order').order('created_at');
  renderQuestions(questions || [], topic, true);
}

// ─────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────
let authMode = 'login';

function showAuthScreen(mode = 'login') {
  authMode = mode;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  // Fix 3: strip ?topic= from URL when not logged in
  history.replaceState(null, '', location.pathname);
  updateAuthUI();
}

function updateAuthUI() {
  const isLogin = authMode === 'login';
  document.getElementById('auth-heading').textContent = isLogin ? 'Welcome back' : 'Create account';
  document.getElementById('auth-sub').textContent     = isLogin
    ? 'Sign in to access your interview questions.'
    : 'Start organizing your interview prep today.';
  const btn = document.getElementById('auth-submit');
  btn.disabled = false;
  btn.innerHTML = isLogin ? 'Sign in' : 'Create account';
  document.getElementById('name-field').style.display    = isLogin ? 'none' : '';
  document.getElementById('confirm-field').style.display = isLogin ? 'none' : '';
  document.getElementById('auth-switch').innerHTML = isLogin
    ? `Don't have an account? <a href="#" id="auth-toggle">Create one</a>`
    : `Already have an account? <a href="#" id="auth-toggle">Sign in instead</a>`;
  document.getElementById('auth-toggle').onclick = (e) => {
    e.preventDefault();
    authMode = isLogin ? 'signup' : 'login';
    updateAuthUI();
  };
}

// Fix 2: proper spinner in auth button
function setAuthLoading(on) {
  const btn = document.getElementById('auth-submit');
  if (on) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> ${authMode === 'login' ? 'Signing in…' : 'Creating…'}`;
  } else {
    updateAuthUI();
  }
}

document.getElementById('auth-submit').onclick = async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pwd   = document.getElementById('auth-password').value;
  const name  = document.getElementById('auth-name').value.trim();
  const conf  = document.getElementById('auth-confirm').value;

  if (!email || !pwd) { toast('Email and password required', 'err'); return; }
  if (pwd.length < 6)  { toast('Password must be at least 6 characters', 'err'); return; }

  setAuthLoading(true);

  if (authMode === 'signup') {
    if (pwd !== conf) { toast('Passwords do not match', 'err'); setAuthLoading(false); return; }
    const { data: su, error: se } = await sb.auth.signUp({
      email, password: pwd, options: { data: { full_name: name } }
    });
    if (se) {
      if (se.message.toLowerCase().includes('already')) {
        toast('Account exists. Signing you in…', 'warn');
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
        if (error) { toast(error.message, 'err'); setAuthLoading(false); return; }
        state.user = data.user; await showApp(); return;
      }
      toast(se.message, 'err'); setAuthLoading(false); return;
    }
    if (su?.session) { state.user = su.session.user; await showApp(); return; }
    toast('Account created! Check your email, then sign in.', 'ok', 8000);
    authMode = 'login'; setAuthLoading(false); updateAuthUI(); return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pwd });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) toast('Wrong email or password.', 'err');
    else if (m.includes('email not confirmed')) toast('Please confirm your email first.', 'warn', 6000);
    else if (m.includes('rate limit') || m.includes('too many'))  toast('Too many attempts. Wait a few minutes.', 'warn', 6000);
    else toast(error.message, 'err');
    setAuthLoading(false); return;
  }
  state.user = data.user;
  await showApp();
};

document.getElementById('auth-google').onclick = async () => {
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}` }
  });
};

// ─────────────────────────────────────────────────────────────────
// APP INIT
// ─────────────────────────────────────────────────────────────────
async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const u = state.user;
  document.getElementById('user-email').textContent  = u.email || '';
  document.getElementById('user-avatar').textContent = (u.user_metadata?.full_name || u.email || 'U')[0].toUpperCase();
  await loadTopics();
  showWelcome();
}

// ─────────────────────────────────────────────────────────────────
// TOPICS
// ─────────────────────────────────────────────────────────────────
async function loadTopics() {
  const { data, error } = await sb.from('topics')
    .select('*, questions(count)').eq('user_id', state.user.id).order('created_at');
  if (error) { toast('Failed to load topics', 'err'); return; }
  state.topics = data || [];
  renderTopicsList();
}

function renderTopicsList(filter = '') {
  const el   = document.getElementById('topics-list');
  const list = filter
    ? state.topics.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    : state.topics;

  if (!list.length) {
    el.innerHTML = `<div style="padding:12px 8px;font-size:.82rem;color:var(--text-3)">${filter ? 'No topics match.' : 'No topics yet.'}</div>`;
    return;
  }
  el.innerHTML = list.map(t => {
    const count  = t.questions?.[0]?.count ?? 0;
    const active = t.id === state.currentTopicId;
    return `<div class="topic-item${active ? ' active' : ''}" data-id="${t.id}">
      <span class="ti-name">${esc(t.name)}</span>
      ${t.is_public ? `<svg class="ti-lock" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>` : ''}
      <span class="ti-badge">${count}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.topic-item').forEach(item => {
    item.addEventListener('click', () => { closeSidebar(); loadTopic(item.dataset.id); });
  });
}

async function loadTopic(id) {
  state.currentTopicId = id;
  renderTopicsList();
  // Fix 3: update URL to reflect selected topic (no trailing ?)
  setCleanUrl(id);

  const topic = state.topics.find(t => t.id === id);
  if (!topic) return;
  document.getElementById('header-title').textContent = topic.name;

  const ha = document.getElementById('header-actions');
  ha.innerHTML = '';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary btn-sm';
  addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Question`;
  addBtn.onclick = () => openEditor(null, id);
  ha.appendChild(addBtn);

  const optBtn = document.createElement('button');
  optBtn.className = 'btn btn-ghost btn-sm';
  optBtn.title = 'Topic options';
  optBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
  optBtn.onclick = () => openTopicModal(topic);
  ha.appendChild(optBtn);

  document.getElementById('content').innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;
  const { data, error } = await sb.from('questions')
    .select('*').eq('topic_id', id).order('sort_order').order('created_at');
  if (error) { toast('Failed to load questions', 'err'); return; }
  state.questions = data || [];
  renderQuestions(state.questions, topic);
}

// ─────────────────────────────────────────────────────────────────
// RENDER QUESTIONS
// ─────────────────────────────────────────────────────────────────
function renderQuestions(questions, topic, readOnly = false) {
  const content = document.getElementById('content');
  const pubBadge = topic.is_public
    ? `<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Public</span>`
    : `<span class="badge badge-yellow"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Private</span>`;
  const shareBtn = (!readOnly && topic.is_public)
    ? `<button class="btn btn-ghost btn-sm" id="share-btn-top"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share</button>` : '';

  if (!questions.length) {
    content.innerHTML = `
      <div class="topic-meta">${pubBadge}${shareBtn}</div>
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h2>No questions yet</h2>
        <p>${readOnly ? 'This topic has no questions.' : 'Click "Add Question" to get started.'}</p>
        ${readOnly ? '' : `<button class="btn btn-primary" onclick="openEditor(null,'${topic.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add first question</button>`}
      </div>`;
    if (!readOnly && topic.is_public) document.getElementById('share-btn-top')?.addEventListener('click', () => showShareModal(topic));
    return;
  }

  content.innerHTML = `
    <div class="topic-meta">
      ${pubBadge}
      <span class="badge badge-blue">${questions.length} question${questions.length !== 1 ? 's' : ''}</span>
      ${topic.description ? `<span style="font-size:.82rem;color:var(--text-3)">${esc(topic.description)}</span>` : ''}
      <div style="flex:1"></div>
      ${shareBtn}
    </div>
    <div class="q-list" id="q-list">${questions.map((q,i) => renderQCard(q, i+1, readOnly)).join('')}</div>`;

  content.querySelectorAll('.q-card').forEach(card => {
    card.querySelector('.q-header').addEventListener('click', async (e) => {
      if (e.target.closest('.q-actions')) return;
      card.classList.toggle('open');
      if (card.classList.contains('open')) {
        const inner = card.querySelector('.q-answer-inner');
        if (inner && !inner.dataset.rendered) {
          inner.dataset.rendered = '1';
          await renderMdWithMermaid(inner, inner.dataset.md);
        }
      }
    });
  });

  if (!readOnly) {
    content.querySelectorAll('.q-edit').forEach(b   => b.addEventListener('click', () => openEditor(b.dataset.id, topic.id)));
    content.querySelectorAll('.q-delete').forEach(b  => b.addEventListener('click', () => deleteQuestion(b.dataset.id)));
    if (topic.is_public) document.getElementById('share-btn-top')?.addEventListener('click', () => showShareModal(topic));
  }
}

function renderQCard(q, num, readOnly) {
  const actions = readOnly ? '' : `
    <div class="q-actions">
      <button class="btn-icon q-edit" data-id="${q.id}" title="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon q-delete" data-id="${q.id}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`;
  return `<div class="q-card" data-id="${q.id}">
    <div class="q-header">
      <div class="q-num">${num}</div>
      <div class="q-text">${esc(q.question)}</div>
      ${actions}
      <svg class="q-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
    <div class="q-answer">
      <div class="q-answer-inner md-body" data-md="${escAttr(q.answer || '')}">
        <div class="spinner" style="width:18px;height:18px"></div>
      </div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────
// EDITOR
// ─────────────────────────────────────────────────────────────────
let previewTimer = null;

function openEditor(qId, topicId) {
  state.editingQId    = qId;
  state.editingTopicId = topicId;
  const titleInput = document.getElementById('q-title-input');
  const textarea   = document.getElementById('answer-editor');
  if (qId) {
    const q = state.questions.find(x => x.id === qId);
    titleInput.value = q?.question || '';
    textarea.value   = q?.answer   || '';
  } else {
    titleInput.value = '';
    textarea.value   = '';
  }
  document.getElementById('editor-modal').classList.remove('hidden');
  updatePreview();
  setTimeout(() => titleInput.focus(), 50);
}

async function updatePreview() {
  await renderMdWithMermaid(
    document.getElementById('editor-preview'),
    document.getElementById('answer-editor').value
  );
}

document.getElementById('answer-editor').addEventListener('input', () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(updatePreview, 600);
});

// Fix 8: editor close/cancel properly wired
function closeEditor() {
  document.getElementById('editor-modal').classList.add('hidden');
  state.editingQId = null;
}
document.getElementById('editor-close').addEventListener('click',  closeEditor);
document.getElementById('editor-cancel').addEventListener('click', closeEditor);

document.getElementById('editor-save').onclick = async () => {
  const question = document.getElementById('q-title-input').value.trim();
  const answer   = document.getElementById('answer-editor').value.trim();
  if (!question) { toast('Please enter a question', 'err'); return; }
  const btn = document.getElementById('editor-save');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px"></span> Saving…`;

  const topicId = state.editingTopicId;
  const qId     = state.editingQId;

  if (qId) {
    const { error } = await sb.from('questions')
      .update({ question, answer, updated_at: new Date().toISOString() })
      .eq('id', qId).eq('topic_id', topicId);
    if (error) { toast('Save failed: ' + error.message, 'err'); btn.disabled=false; btn.textContent='Save Question'; return; }
    toast('Question updated');
  } else {
    const { error } = await sb.from('questions')
      .insert({ question, answer, topic_id: topicId, user_id: state.user.id, sort_order: state.questions.length });
    if (error) { toast('Save failed: ' + error.message, 'err'); btn.disabled=false; btn.textContent='Save Question'; return; }
    toast('Question added');
  }

  btn.disabled = false; btn.textContent = 'Save Question';
  closeEditor();
  await loadTopic(topicId);
  await loadTopics();
};

// Toolbar
document.querySelectorAll('.tb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    insertMarkdown(document.getElementById('answer-editor'), btn.dataset.action);
    updatePreview();
  });
});

function insertMarkdown(ta, action) {
  const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd);
  const s = ta.selectionStart, e = ta.selectionEnd;
  const map = {
    bold:      ['**','**','bold text'],
    italic:    ['_','_','italic text'],
    code:      ['`','`','code'],
    h2:        ['## ','','Heading'],
    h3:        ['### ','','Heading'],
    ul:        ['- ','','item'],
    ol:        ['1. ','','item'],
    link:      ['[','](url)','link text'],
    table:     ['| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |','',''],
    codeblock: ['```javascript\n','\n```','// your code here'],
    mermaid:   ['```mermaid\ngraph TD\n  A[Start] --> B{Decision}\n  B -- Yes --> C[Do it]\n  B -- No  --> D[Skip]\n```','',''],
  };
  const [before, after, ph] = map[action] || ['','',''];
  ta.setRangeText(before + (sel || ph) + after, s, e, 'select');
  ta.focus();
}

// ─────────────────────────────────────────────────────────────────
// DELETE QUESTION
// ─────────────────────────────────────────────────────────────────
async function deleteQuestion(qId) {
  const ok = await showConfirm('Delete question?', 'This cannot be undone.');
  if (!ok) return;
  const { error } = await sb.from('questions').delete().eq('id', qId);
  if (error) { toast('Delete failed', 'err'); return; }
  toast('Question deleted');
  await loadTopic(state.currentTopicId);
  await loadTopics();
}

// ─────────────────────────────────────────────────────────────────
// TOPIC MODAL
// ─────────────────────────────────────────────────────────────────
document.getElementById('new-topic-btn').onclick = () => openTopicModal(null);

function openTopicModal(topic = null) {
  state.editingTopicId = topic?.id || null;
  document.getElementById('topic-modal-title').textContent = topic ? 'Edit Topic' : 'New Topic';
  document.getElementById('topic-name').value   = topic?.name        || '';
  document.getElementById('topic-desc').value   = topic?.description || '';
  document.getElementById('topic-public').checked = topic?.is_public || false;
  document.getElementById('topic-save').textContent = topic ? 'Save Changes' : 'Create Topic';

  // Remove old delete button
  document.getElementById('topic-delete-btn')?.remove();
  if (topic) {
    const delBtn = document.createElement('button');
    delBtn.id = 'topic-delete-btn';
    delBtn.className = 'btn btn-danger btn-sm';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete Topic';
    delBtn.onclick = () => deleteTopic(topic.id);
    document.getElementById('topic-form').querySelector('.topic-form-actions').prepend(delBtn);
  }
  document.getElementById('topic-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('topic-name').focus(), 50);
}

document.getElementById('topic-cancel').onclick = () => document.getElementById('topic-modal').classList.add('hidden');

document.getElementById('topic-form').onsubmit = async () => {
  const name     = document.getElementById('topic-name').value.trim();
  const desc     = document.getElementById('topic-desc').value.trim();
  const isPublic = document.getElementById('topic-public').checked;
  if (!name) { toast('Name required', 'err'); return; }

  const btn = document.getElementById('topic-save');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>`;

  const payload = { name, description: desc, is_public: isPublic };

  if (state.editingTopicId) {
    const { error } = await sb.from('topics').update(payload).eq('id', state.editingTopicId);
    if (error) { toast(error.message, 'err'); btn.disabled=false; btn.textContent='Save Changes'; return; }
    toast('Topic updated');
  } else {
    const { error } = await sb.from('topics').insert({ ...payload, user_id: state.user.id });
    if (error) { toast(error.message, 'err'); btn.disabled=false; btn.textContent='Create Topic'; return; }
    toast('Topic created');
  }

  btn.disabled = false;
  document.getElementById('topic-modal').classList.add('hidden');
  const prevId = state.editingTopicId;
  await loadTopics();
  if (prevId) await loadTopic(prevId);
};

// Fix 1: deleteTopic — delete questions first then topic, both with user_id guard
async function deleteTopic(id) {
  const ok = await showConfirm('Delete topic?', 'All questions in this topic will be deleted. This cannot be undone.');
  if (!ok) return;

  document.getElementById('topic-modal').classList.add('hidden');

  const { error: qErr } = await sb.from('questions')
    .delete().eq('topic_id', id).eq('user_id', state.user.id);
  if (qErr) { toast('Failed to delete questions: ' + qErr.message, 'err'); return; }

  const { error: tErr } = await sb.from('topics')
    .delete().eq('id', id).eq('user_id', state.user.id);
  if (tErr) { toast('Failed to delete topic: ' + tErr.message, 'err'); return; }

  state.currentTopicId = null;
  // Fix 3: clean URL after topic deleted
  setCleanUrl(null);
  toast('Topic deleted');
  await loadTopics();
  showWelcome();
}

// ─────────────────────────────────────────────────────────────────
// SHARE MODAL
// ─────────────────────────────────────────────────────────────────
function showShareModal(topic) {
  const url = `${location.origin}${location.pathname}?topic=${topic.id}`;
  document.getElementById('share-url').value = url;
  document.getElementById('share-modal').classList.remove('hidden');
}
document.getElementById('copy-share-url').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('share-url').value)
    .then(() => toast('Link copied!'));
};
document.getElementById('share-close').onclick = () => document.getElementById('share-modal').classList.add('hidden');

// ─────────────────────────────────────────────────────────────────
// WELCOME
// ─────────────────────────────────────────────────────────────────
function showWelcome() {
  document.getElementById('header-title').textContent = 'PrepVault';
  document.getElementById('header-actions').innerHTML = '';
  // Fix 3: clear URL when on welcome
  setCleanUrl(null);
  const topicCount = state.topics.length;
  const totalQ     = state.topics.reduce((a,t) => a + (t.questions?.[0]?.count ?? 0), 0);
  document.getElementById('content').innerHTML = `
    <div class="empty-state" style="gap:20px">
      <div style="width:64px;height:64px;border-radius:18px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff">📝</div>
      <div>
        <h2 style="font-family:var(--serif)">Your Interview Prep Hub</h2>
        <p style="margin-top:8px">${topicCount
          ? `You have <strong>${topicCount}</strong> topic${topicCount>1?'s':''} and <strong>${totalQ}</strong> question${totalQ!==1?'s':''}.`
          : 'No topics yet. Create your first topic to start.'}</p>
      </div>
      <button class="btn btn-primary" onclick="openTopicModal(null)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        ${topicCount ? 'New Topic' : 'Create first topic'}
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────
let searchTimer = null;
document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) { renderTopicsList(); return; }
  searchTimer = setTimeout(() => doSearch(q), 300);
});

async function doSearch(q) {
  const { data } = await sb.from('questions')
    .select('id, question, topic_id, topics(name)')
    .eq('user_id', state.user.id)
    .ilike('question', `%${q}%`)
    .limit(30);

  const el = document.getElementById('topics-list');
  if (!data?.length) {
    el.innerHTML = `<div style="padding:12px 8px;font-size:.82rem;color:var(--text-3)">No results for "${esc(q)}"</div>`;
    return;
  }
  el.innerHTML = data.map(r => `
    <div class="search-result-q" data-qid="${r.id}" data-tid="${r.topic_id}">
      <div class="srq-topic">${esc(r.topics?.name || '')}</div>
      <div class="srq-text">${esc(r.question)}</div>
    </div>`).join('');

  el.querySelectorAll('.search-result-q').forEach(item => {
    item.addEventListener('click', async () => {
      document.getElementById('search-input').value = '';
      await loadTopic(item.dataset.tid);
      setTimeout(() => {
        const card = document.querySelector(`.q-card[data-id="${item.dataset.qid}"]`);
        if (card) { card.classList.add('open'); card.scrollIntoView({ behavior:'smooth', block:'center' }); }
      }, 300);
      renderTopicsList();
      closeSidebar();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// FIX 8: SIDEBAR TOGGLE — properly wired
// ─────────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
document.getElementById('open-sidebar').addEventListener('click',     openSidebar);
document.getElementById('close-sidebar').addEventListener('click',    closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click',  closeSidebar);

// ─────────────────────────────────────────────────────────────────
// SIGN OUT + THEME
// ─────────────────────────────────────────────────────────────────
document.getElementById('signout-btn').onclick = async () => {
  await sb.auth.signOut();
  state.user = null; state.topics = []; state.currentTopicId = null;
  showAuthScreen('login');
};
document.getElementById('theme-toggle').onclick = toggleTheme;

// ─────────────────────────────────────────────────────────────────
// AUTH STATE LISTENER
// ─────────────────────────────────────────────────────────────────
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && !state.user) {
    state.user = session.user; showApp();
  }
  if (event === 'SIGNED_OUT') {
    state.user = null; showAuthScreen('login');
  }
});

// ─────────────────────────────────────────────────────────────────
// GO
// ─────────────────────────────────────────────────────────────────
boot();
