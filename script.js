/* ══════════════════════════════════════════════════════
   VoleiApp 2.0 — script.js
   Sistema completo: usuários, listas, times, placar
══════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────
   ESTADO GLOBAL
────────────────────────────────────────────────────── */
let APP = {
  currentUser: null,      // { username, name, pin }
  currentListId: null,    // id da lista aberta
  activeMatch: null,      // partida em andamento

  // dados persistidos
  users:   [],            // [{ username, name, pin }]
  lists:   [],            // [{ id, code, title, local, date, owner, players:[] }]
  history: [],            // partidas encerradas
};

/* ──────────────────────────────────────────────────────
   PERSISTÊNCIA
────────────────────────────────────────────────────── */
const save  = () => localStorage.setItem('setball_app', JSON.stringify(APP));
const load  = () => {
  try {
    const raw = localStorage.getItem('setball_app');
    if (raw) Object.assign(APP, JSON.parse(raw));
  } catch(e) {}
};

/* ──────────────────────────────────────────────────────
   UTILITÁRIOS
────────────────────────────────────────────────────── */
const uid  = () => Math.random().toString(36).slice(2, 9);
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

function formatDate(iso) {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ──────────────────────────────────────────────────────
   NAVEGAÇÃO
────────────────────────────────────────────────────── */
let screenHistory = [];

function goTo(id, push = true) {
  const all = document.querySelectorAll('.screen');

  // slide out current active
  const active = document.querySelector('.screen.active');
  if (active && active.id !== `screen-${id}`) {
    if (push) screenHistory.push(active.id.replace('screen-', ''));
    active.classList.add('slide-out');
    setTimeout(() => active.classList.remove('slide-out', 'active'), 320);
  }

  const next = document.getElementById(`screen-${id}`);
  if (next) {
    next.classList.add('active');
    // Trigger render hooks
    if (id === 'home')         renderHome();
    if (id === 'lists')        renderLists();
    if (id === 'list-detail')  renderListDetail();
    if (id === 'match-setup')  renderMatchSetup();
    if (id === 'history')      renderHistory();
  }
}

function goBack() {
  if (screenHistory.length) goTo(screenHistory.pop(), false);
  else goTo('home', false);
}

// Back buttons
document.querySelectorAll('.back-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dest = btn.dataset.back;
    if (dest) {
      screenHistory = screenHistory.filter(s => s !== dest);
      goTo(dest, false);
    } else goBack();
  });
});

/* ──────────────────────────────────────────────────────
   PIN INPUT UX
────────────────────────────────────────────────────── */
function setupPinRow(rowId) {
  const digits = document.querySelectorAll(`#${rowId} .pin-digit`);
  digits.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g,'').slice(-1);
      if (inp.value && i < digits.length - 1) digits[i+1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) digits[i-1].focus();
    });
  });
}

function getPinValue(rowId) {
  return Array.from(document.querySelectorAll(`#${rowId} .pin-digit`))
    .map(d => d.value).join('');
}

function clearPin(rowId) {
  document.querySelectorAll(`#${rowId} .pin-digit`).forEach(d => d.value = '');
}

setupPinRow('login-pin-row');
setupPinRow('reg-pin-row');

/* ──────────────────────────────────────────────────────
   AUTH — Tab switch
────────────────────────────────────────────────────── */
document.querySelectorAll('.tsw').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tsw').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(btn.dataset.form).classList.add('active');
  });
});

/* ──────────────────────────────────────────────────────
   AUTH — Register
────────────────────────────────────────────────────── */
document.getElementById('register-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('r-name').value.trim();
  const user = document.getElementById('r-user').value.trim().toLowerCase();
  const pin  = getPinValue('reg-pin-row');
  const err  = document.getElementById('r-error');

  err.classList.add('hidden');

  if (!name || !user || pin.length !== 4) {
    err.textContent = 'Preencha todos os campos corretamente.';
    err.classList.remove('hidden');
    document.getElementById('register-form').classList.add('shake');
    setTimeout(() => document.getElementById('register-form').classList.remove('shake'), 400);
    return;
  }
  if (APP.users.find(u => u.username === user)) {
    err.textContent = 'Nome de usuário já existe.';
    err.classList.remove('hidden');
    return;
  }

  APP.users.push({ username: user, name, pin });
  APP.currentUser = { username: user, name, pin };
  save();
  clearPin('reg-pin-row');
  goTo('home');
});

/* ──────────────────────────────────────────────────────
   AUTH — Login
────────────────────────────────────────────────────── */
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const user = document.getElementById('l-user').value.trim().toLowerCase();
  const pin  = getPinValue('login-pin-row');
  const err  = document.getElementById('l-error');

  err.classList.add('hidden');

  const found = APP.users.find(u => u.username === user && u.pin === pin);
  if (!found) {
    err.classList.remove('hidden');
    document.getElementById('login-form').classList.add('shake');
    setTimeout(() => document.getElementById('login-form').classList.remove('shake'), 400);
    return;
  }

  APP.currentUser = found;
  save();
  clearPin('login-pin-row');
  goTo('home');
});

/* ──────────────────────────────────────────────────────
   LOGOUT
────────────────────────────────────────────────────── */
document.getElementById('btn-logout').addEventListener('click', () => {
  APP.currentUser = null;
  save();
  screenHistory = [];
  goTo('login', false);
});

/* ──────────────────────────────────────────────────────
   TELA HOME
────────────────────────────────────────────────────── */
function renderHome() {
  const u = APP.currentUser;
  if (!u) return;
  document.getElementById('hero-greet').textContent = greet();
  document.getElementById('hero-name').textContent  = u.name.split(' ')[0];
  document.getElementById('home-username').textContent = u.username;
  document.getElementById('home-avatar').textContent   = u.name[0].toUpperCase();

  // Partida ativa pill
  const pill = document.getElementById('active-match-pill');
  if (APP.activeMatch) {
    pill.classList.remove('hidden');
    const list = APP.lists.find(l => l.id === APP.activeMatch.listId);
    document.getElementById('active-pill-text').textContent =
      `Partida em andamento${list ? ` · ${list.title}` : ''}`;
  } else {
    pill.classList.add('hidden');
  }
}

document.getElementById('hc-lists').addEventListener('click', () => goTo('lists'));
document.getElementById('hc-match').addEventListener('click', () => {
  if (APP.activeMatch) goTo('scoreboard');
  else goTo('lists');
});
document.getElementById('hc-score').addEventListener('click', () => {
  if (APP.activeMatch) goTo('scoreboard');
  else { showToast('Nenhuma partida em andamento'); goTo('lists'); }
});
document.getElementById('hc-history').addEventListener('click', () => goTo('history'));
document.getElementById('pill-goto').addEventListener('click', () => goTo('scoreboard'));

/* ──────────────────────────────────────────────────────
   TELA LISTAS
────────────────────────────────────────────────────── */
function renderLists() {
  const u  = APP.currentUser;
  const my = APP.lists.filter(l => l.owner === u.username);

  document.getElementById('my-lists-count').textContent = my.length;
  const container = document.getElementById('my-lists-container');
  const empty     = document.getElementById('empty-lists');

  container.innerHTML = '';
  if (!my.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  my.forEach(list => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-title">${list.title}</div>
      <div class="list-card-meta">
        <span>📍 ${list.local || '–'}</span>
        <span>📅 ${formatDate(list.date)}</span>
      </div>
      <div class="list-card-footer">
        <span class="list-card-count">👥 ${list.players.length} jogadores</span>
        <span class="list-card-code">${list.code}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      APP.currentListId = list.id;
      save();
      goTo('list-detail');
    });
    container.appendChild(card);
  });
}

// Nova lista
document.getElementById('btn-new-list').addEventListener('click', () => {
  document.getElementById('modal-new-list').classList.remove('hidden');
  document.getElementById('nl-date').value = new Date().toISOString().slice(0,10);
});
document.getElementById('nl-cancel').addEventListener('click', () => {
  document.getElementById('modal-new-list').classList.add('hidden');
});
document.getElementById('nl-create').addEventListener('click', () => {
  const title = document.getElementById('nl-title').value.trim();
  const local = document.getElementById('nl-local').value.trim();
  const date  = document.getElementById('nl-date').value;
  if (!title) { showToast('Digite um título para a lista'); return; }

  const newList = {
    id: uid(), code: code(),
    title, local, date,
    owner: APP.currentUser.username,
    players: []
  };
  APP.lists.push(newList);
  APP.currentListId = newList.id;
  save();
  document.getElementById('modal-new-list').classList.add('hidden');
  document.getElementById('nl-title').value = '';
  document.getElementById('nl-local').value = '';
  goTo('list-detail');
});

// Entrar com código
document.getElementById('btn-join-list').addEventListener('click', () => {
  const c = document.getElementById('join-code').value.trim().toUpperCase();
  const found = APP.lists.find(l => l.code === c);
  const err = document.getElementById('join-error');
  if (!found) {
    err.classList.remove('hidden');
    return;
  }
  err.classList.add('hidden');
  APP.currentListId = found.id;
  save();
  goTo('list-detail');
});

/* ──────────────────────────────────────────────────────
   TELA DETALHE DA LISTA
────────────────────────────────────────────────────── */
function renderListDetail() {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!list) { goTo('lists'); return; }

  document.getElementById('list-detail-title').textContent = list.title;
  document.getElementById('lic-local').textContent = list.local || '–';
  document.getElementById('lic-date').textContent  = formatDate(list.date);
  document.getElementById('lic-code').textContent  = list.code;
  document.getElementById('list-player-count').textContent = list.players.length;

  // Check se usuário já entrou
  const u = APP.currentUser;
  const selfBtn = document.getElementById('btn-self-join');
  const already = list.players.find(p => p.ref === u.username);
  if (already) {
    selfBtn.textContent = '✅ Você já está na lista';
    selfBtn.disabled = true;
    selfBtn.style.opacity = '0.5';
  } else {
    selfBtn.textContent = '✋ Entrar na lista com meu nome';
    selfBtn.disabled = false;
    selfBtn.style.opacity = '1';
  }

  // Render players
  const container = document.getElementById('list-players-container');
  container.innerHTML = '';
  list.players.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    const isOwner = list.owner === APP.currentUser.username;
    row.innerHTML = `
      <span class="pr-num">#${i+1}</span>
      <div class="pr-avatar">${p.name[0].toUpperCase()}</div>
      <span class="pr-name">${p.name}</span>
      ${p.ref ? `<span class="pr-badge">${p.ref}</span>` : ''}
      ${isOwner ? `<button class="pr-remove" data-ref="${p.id}">✕</button>` : ''}
    `;
    container.appendChild(row);
  });

  // Remover jogador
  container.querySelectorAll('.pr-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const list = APP.lists.find(l => l.id === APP.currentListId);
      list.players = list.players.filter(p => p.id !== btn.dataset.ref);
      save();
      renderListDetail();
    });
  });
}

// Entrar na lista como si mesmo
document.getElementById('btn-self-join').addEventListener('click', () => {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  const u = APP.currentUser;
  if (!list) return;
  if (list.players.find(p => p.ref === u.username)) return;
  list.players.push({ id: uid(), name: u.name, ref: u.username });
  save();
  renderListDetail();
  showToast(`${u.name} entrou na lista! ✅`);
});

// Adicionar manualmente
document.getElementById('btn-list-add-player').addEventListener('click', addManualPlayer);
document.getElementById('list-add-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addManualPlayer();
});

function addManualPlayer() {
  const inp  = document.getElementById('list-add-name');
  const name = inp.value.trim();
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!name || !list) return;
  list.players.push({ id: uid(), name, ref: null });
  inp.value = '';
  save();
  renderListDetail();
}

// Compartilhar (copiar código)
document.getElementById('btn-share-list').addEventListener('click', () => {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!list) return;
  const text = `📋 ${list.title}\n📍 ${list.local || '–'} · 📅 ${formatDate(list.date)}\n\nEntre no VoleiApp com o código: *${list.code}*`;
  navigator.clipboard.writeText(text).catch(() => {});
  showToast(`Código copiado: ${list.code}`);
});

// Copiar lista WhatsApp
document.getElementById('btn-copy-list').addEventListener('click', () => {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!list) return;
  const lines = list.players.map((p, i) => `${i+1}. ${p.name}`).join('\n');
  const text  = `📋 *${list.title}*\n📍 ${list.local || '–'}  📅 ${formatDate(list.date)}\n\n${lines}`;
  navigator.clipboard.writeText(text).catch(() => {});
  const t = document.getElementById('toast-copied');
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
});

// Ir para o jogo
document.getElementById('btn-goto-match').addEventListener('click', () => {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!list || list.players.length < 4) {
    showToast('Adicione pelo menos 4 jogadores primeiro');
    return;
  }
  goTo('match-setup');
});

/* ──────────────────────────────────────────────────────
   TELA MONTAR TIMES
────────────────────────────────────────────────────── */
let selectedPlayers = [];
let currentMode     = 4;
let pendingTeamA    = [];
let pendingTeamB    = [];
let pendingQueue    = [];

function renderMatchSetup() {
  const list = APP.lists.find(l => l.id === APP.currentListId);
  if (!list) { goTo('lists'); return; }

  document.getElementById('setup-list-name').textContent = `Lista: ${list.title}`;
  document.getElementById('setup-player-count').textContent = list.players.length;

  selectedPlayers = [...list.players];

  const grid = document.getElementById('setup-players-grid');
  grid.innerHTML = '';

  list.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className  = 'ps-chip selected';
    chip.dataset.id = p.id;
    chip.textContent = p.name;
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      if (chip.classList.contains('selected')) {
        selectedPlayers.push(p);
      } else {
        selectedPlayers = selectedPlayers.filter(s => s.id !== p.id);
      }
      updateModeInfo();
    });
    grid.appendChild(chip);
  });

  updateModeInfo();
  document.getElementById('teams-preview').classList.add('hidden');
}

// Mode pills
document.querySelectorAll('.mode-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentMode = Number(pill.dataset.mode);
    updateModeInfo();
  });
});

function updateModeInfo() {
  const sel  = selectedPlayers.length;
  const need = currentMode * 2;
  const info = document.getElementById('mode-info');
  if (sel < need) {
    info.textContent = `⚠ Selecione pelo menos ${need} jogadores (${sel}/${need})`;
    info.style.color = 'var(--orange)';
  } else {
    const queue = sel - need;
    info.textContent = `✅ ${sel} selecionados · ${queue} na fila`;
    info.style.color = 'var(--green)';
  }
}

// Gerar times
document.getElementById('btn-generate-teams').addEventListener('click', () => {
  generateTeams();
});
document.getElementById('btn-reshuffle').addEventListener('click', generateTeams);

function generateTeams() {
  if (selectedPlayers.length < currentMode * 2) {
    showToast(`Selecione pelo menos ${currentMode * 2} jogadores`);
    return;
  }
  const shuffled = shuffle(selectedPlayers);
  pendingTeamA = shuffled.slice(0, currentMode);
  pendingTeamB = shuffled.slice(currentMode, currentMode * 2);
  pendingQueue = shuffled.slice(currentMode * 2);
  renderTeamsPreview();
}

function renderTeamsPreview() {
  document.getElementById('teams-preview').classList.remove('hidden');
  renderTagList('tp-team-a', pendingTeamA, 'tp-tag');
  renderTagList('tp-team-b', pendingTeamB, 'tp-tag');
  renderTagList('tp-queue',  pendingQueue,  'tp-tag');

  const qcard = document.getElementById('tp-queue-card');
  pendingQueue.length ? qcard.classList.remove('hidden') : qcard.classList.add('hidden');

  document.getElementById('teams-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTagList(elId, arr, cls) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  arr.forEach(p => {
    const tag = document.createElement('span');
    tag.className = cls;
    tag.textContent = p.name;
    el.appendChild(tag);
  });
}

// Iniciar partida
document.getElementById('btn-start-match').addEventListener('click', () => {
  if (!pendingTeamA.length || !pendingTeamB.length) return;

  APP.activeMatch = {
    id:         uid(),
    listId:     APP.currentListId,
    mode:       currentMode,
    teamA:      [...pendingTeamA],
    teamB:      [...pendingTeamB],
    queue:      [...pendingQueue],
    scoreA:     0,
    scoreB:     0,
    winsA:      0,
    winsB:      0,
    streakA:    0,
    streakB:    0,
    lastWinner: null,
    gameLog:    [],
    gameNum:    1,
    startTs:    Date.now(),
  };

  save();
  goTo('scoreboard');
  startTimer();
});

/* ──────────────────────────────────────────────────────
   TELA PLACAR (SCOREBOARD)
────────────────────────────────────────────────────── */
let timerInterval = null;

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function updateTimer() {
  const m = APP.activeMatch;
  if (!m) { clearInterval(timerInterval); return; }
  const elapsed = Math.floor((Date.now() - m.startTs) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const el = document.getElementById('sb-timer');
  if (el) el.textContent = `${mm}:${ss}`;
}

// When entering scoreboard screen
const origGoTo = goTo;
// Patch: start timer when scoreboard becomes active
const _screenScoreboard = document.getElementById('screen-scoreboard');
const obs = new MutationObserver(() => {
  if (_screenScoreboard.classList.contains('active') && APP.activeMatch) {
    renderScoreboard();
    startTimer();
  }
});
obs.observe(_screenScoreboard, { attributes: true, attributeFilter: ['class'] });

function renderScoreboard() {
  const m = APP.activeMatch;
  if (!m) return;

  document.getElementById('sb-set-num').textContent = m.gameNum;
  document.getElementById('sb-score-a').textContent = m.scoreA;
  document.getElementById('sb-score-b').textContent = m.scoreB;
  document.getElementById('sb-sets-a').textContent  = `Vitórias: ${m.winsA}`;
  document.getElementById('sb-sets-b').textContent  = `Vitórias: ${m.winsB}`;

  // Set history mini (last 5)
  if (m.gameLog.length) {
    document.getElementById('sb-set-history').textContent =
      m.gameLog.slice(-5).map(s => `${s.scoreA}–${s.scoreB}`).join('  ');
  }

  // Streak dots
  renderStreakDots('streak-a', m.streakA, 'filled-a');
  renderStreakDots('streak-b', m.streakB, 'filled-b');

  // Streak badges
  const badgeA = document.getElementById('badge-streak-a');
  const badgeB = document.getElementById('badge-streak-b');
  if (m.streakA > 0) {
    badgeA.textContent = `🔥 ${m.streakA}× seguidas`;
    badgeA.classList.remove('hidden');
  } else { badgeA.classList.add('hidden'); }
  if (m.streakB > 0) {
    badgeB.textContent = `🔥 ${m.streakB}× seguidas`;
    badgeB.classList.remove('hidden');
  } else { badgeB.classList.add('hidden'); }

  // Alert color when close to limit
  const sA = document.getElementById('streak-a');
  const sB = document.getElementById('streak-b');
  sA.style.opacity = m.streakA === STREAK_LIMIT - 1 ? '1' : '0.7';
  sB.style.opacity = m.streakB === STREAK_LIMIT - 1 ? '1' : '0.7';

  // Teams on court
  renderCourtTeam('sct-team-a', m.teamA);
  renderCourtTeam('sct-team-b', m.teamB);

  // Queue
  const qEl = document.getElementById('sbq-players');
  qEl.innerHTML = '';
  if (m.queue.length === 0) {
    const empty = document.createElement('span');
    empty.style.cssText = 'font-size:0.78rem;color:var(--text3)';
    empty.textContent = 'Sem jogadores na fila';
    qEl.appendChild(empty);
  } else {
    m.queue.forEach(p => {
      const t = document.createElement('span');
      t.className = 'sbq-tag';
      t.textContent = p.name;
      qEl.appendChild(t);
    });
  }

  // Log
  renderGameLog();
}

function renderStreakDots(rowId, streak, filledClass) {
  const dots = document.querySelectorAll(`#${rowId} .streak-dot`);
  dots.forEach((dot, i) => {
    dot.classList.remove('filled-a', 'filled-b', 'fire');
    if (i < streak) {
      dot.classList.add(filledClass);
      if (i === streak - 1) dot.classList.add('fire');
    }
  });
}

function renderCourtTeam(elId, players) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  players.forEach(p => {
    const t = document.createElement('div');
    t.className = 'sct-tag';
    t.textContent = p.name;
    el.appendChild(t);
  });
}

function renderGameLog() {
  const el = document.getElementById('sb-log-list');
  el.innerHTML = '';
  const m = APP.activeMatch;
  if (!m) return;
  if (!m.gameLog.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:0.78rem;text-align:center;padding:8px">Nenhuma partida ainda</div>';
    return;
  }
  [...m.gameLog].reverse().forEach(s => {
    const div = document.createElement('div');
    div.className = 'sb-log-item';
    div.innerHTML = `
      <span style="color:var(--text3)">Partida ${s.gameNum}</span>
      <span class="sb-log-winner win-${s.winner.toLowerCase()}">${s.scoreA} – ${s.scoreB} · Time ${s.winner} venceu</span>
    `;
    el.appendChild(div);
  });
}

// Pontos
function addPoint(team) {
  const m = APP.activeMatch;
  if (!m) return;
  if (team === 'A') m.scoreA++;
  else m.scoreB++;
  save();
  const el = document.getElementById(`sb-score-${team.toLowerCase()}`);
  el.classList.remove('pop');
  void el.offsetWidth; // reflow
  el.classList.add('pop');
  setTimeout(() => el.classList.remove('pop'), 200);
  renderScoreboard();
}

function removePoint(team) {
  const m = APP.activeMatch;
  if (!m) return;
  if (team === 'A' && m.scoreA > 0) m.scoreA--;
  if (team === 'B' && m.scoreB > 0) m.scoreB--;
  save();
  renderScoreboard();
}

document.getElementById('sb-plus-a').addEventListener('click',  () => addPoint('A'));
document.getElementById('sb-plus-b').addEventListener('click',  () => addPoint('B'));
document.getElementById('sb-minus-a').addEventListener('click', () => removePoint('A'));
document.getElementById('sb-minus-b').addEventListener('click', () => removePoint('B'));

// ─── LÓGICA DE VITÓRIA E ROTAÇÃO ──────────────────────────
//
//  PARTIDA NORMAL:
//    • Vencedor FICA em quadra (streak continua)
//    • Perdedor vai para o FINAL da fila
//    • Próximo time completo da fila entra
//
//  3 VITÓRIAS SEGUIDAS (STREAK_LIMIT):
//    • Vencedor E perdedor saem juntos
//    • Dois times novos entram da fila (frente da fila → Time A, próximos → Time B)
//    • Vencedor vai para o INÍCIO da fila (próximo a entrar)
//    • Perdedor vai depois do vencedor na fila
//    • SE A FILA NÃO TIVER 2 TIMES COMPLETOS:
//        - Campeão permanece em quadra normalmente
//        - Streak zera (recomeça do zero)
//        - Perdedor sai normalmente e vai pra fila
//        - Próximo time disponível da fila entra (mesmo incompleto se necessário)

const STREAK_LIMIT = 3;

function winGame(winner) {
  const m = APP.activeMatch;
  if (!m) return;

  // Registra no log
  m.gameLog.push({ scoreA: m.scoreA, scoreB: m.scoreB, winner, gameNum: m.gameNum });
  if (winner === 'A') m.winsA++;
  else m.winsB++;
  m.gameNum++;

  // Atualiza streak: vencedor acumula, perdedor zera
  if (winner === 'A') { m.streakA++; m.streakB = 0; }
  else                { m.streakB++; m.streakA = 0; }
  m.lastWinner = winner;

  // Reset placar do set
  m.scoreA = 0;
  m.scoreB = 0;

  const streak = winner === 'A' ? m.streakA : m.streakB;

  if (streak >= STREAK_LIMIT) {
    handleTripleWin(winner);
  } else {
    handleNormalRotation(winner);
  }

  save();
  renderScoreboard();
}

// ── Rotação normal ──────────────────────────────────────
function handleNormalRotation(winner) {
  const m    = APP.activeMatch;
  const modo = m.mode;
  const venc = winner === 'A' ? [...m.teamA] : [...m.teamB];
  const perd = winner === 'A' ? [...m.teamB] : [...m.teamA];

  // Perdedor vai pro FIM da fila
  const fila = [...m.queue, ...perd];

  // Próximos [modo] jogadores da fila formam o novo adversário
  const novoAdvers = fila.splice(0, modo);

  if (winner === 'A') { m.teamA = venc; m.teamB = novoAdvers; }
  else                { m.teamB = venc; m.teamA = novoAdvers; }
  m.queue = fila;

  const s = winner === 'A' ? m.streakA : m.streakB;
  const faltam = STREAK_LIMIT - s;
  const msg = faltam === 1
    ? `⚠️ Time ${winner}: mais 1 pra sair!`
    : `🏆 Time ${winner} venceu! (${s}× seguidas)`;

  showRotationBanner(
    `🔄 Time ${winner === 'A' ? 'B' : 'A'} saiu · Próximo entrou`,
    s === STREAK_LIMIT - 1 ? '⚠️' : '🔄'
  );
  showToast(msg);
}

// ── Triple win ──────────────────────────────────────────
function handleTripleWin(winner) {
  const m    = APP.activeMatch;
  const modo = m.mode;
  const camp = winner === 'A' ? [...m.teamA] : [...m.teamB];
  const perd = winner === 'A' ? [...m.teamB] : [...m.teamA];

  // Verifica se tem jogadores suficientes para 2 times novos na fila ATUAL
  const filaAtual = [...m.queue];
  const temDoisTimes = filaAtual.length >= modo * 2;

  if (temDoisTimes) {
    // ✅ Tem 2 times completos → ambos saem, dois novos entram
    const novoTimeEntrada1 = filaAtual.splice(0, modo);  // será Time A
    const novoTimeEntrada2 = filaAtual.splice(0, modo);  // será Time B

    // Campeão entra no INÍCIO da fila (próximo a jogar), perdedor logo após
    const novaFila = [...camp, ...perd, ...filaAtual];

    m.teamA   = novoTimeEntrada1;
    m.teamB   = novoTimeEntrada2;
    m.queue   = novaFila;
    m.streakA = 0;
    m.streakB = 0;

    showRotationBanner('🏅 3× seguidas! Campeão vai pra fila!', '🏅');
    showToast(`🏅 Time ${winner} ganhou 3× seguidas! Dois times novos em quadra. Campeão é o próximo da fila!`);

  } else {
    // ❌ Fila insuficiente → campeão permanece, streak zera, rotação normal
    // Perdedor sai pra fila, próximo disponível entra
    const fila = [...filaAtual, ...perd];
    const novoAdvers = fila.splice(0, modo);  // pode ser incompleto, mas entra o que tiver

    if (winner === 'A') { m.teamA = camp; m.teamB = novoAdvers; }
    else                { m.teamB = camp; m.teamA = novoAdvers; }
    m.queue = fila;

    // Zera streak do campeão (recomeça do zero)
    if (winner === 'A') m.streakA = 0; else m.streakB = 0;

    showRotationBanner('⚠️ 3× seguidas! Fila incompleta – campeão continua', '⚠️');
    showToast(`🏅 Time ${winner} ganhou 3×! Sem fila completa → campeão permanece com streak zerado.`);
  }
}

function showRotationBanner(text, icon = '🔄') {
  const banner = document.getElementById('rotation-banner');
  document.getElementById('rb-icon').textContent = icon;
  document.getElementById('rb-text').textContent = text;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 4000);
}

document.getElementById('sb-win-a').addEventListener('click', () => winGame('A'));
document.getElementById('sb-win-b').addEventListener('click', () => winGame('B'));

// Encerrar partida
document.getElementById('btn-end-match').addEventListener('click', () => {
  if (!confirm('Encerrar a partida e salvar no histórico?')) return;
  endMatch();
});

function endMatch() {
  const m = APP.activeMatch;
  if (!m) return;
  clearInterval(timerInterval);

  const list = APP.lists.find(l => l.id === m.listId);
  APP.history.unshift({
    id:     uid(),
    title:  list ? list.title : 'Partida',
    date:   new Date().toLocaleDateString('pt-BR'),
    winsA:  m.winsA,
    winsB:  m.winsB,
    games:  [...m.gameLog],
    mode:   m.mode,
  });

  APP.activeMatch = null;
  save();
  showToast('Partida encerrada e salva! 🏁');
  goTo('home', false);
  screenHistory = [];
}

/* ──────────────────────────────────────────────────────
   TELA HISTÓRICO
────────────────────────────────────────────────────── */
function renderHistory() {
  const el    = document.getElementById('history-list');
  const empty = document.getElementById('empty-history');
  el.innerHTML = '';

  if (!APP.history.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  APP.history.forEach(h => {
    const card = document.createElement('div');
    card.className = 'history-card';
    const wA = h.winsA || 0; const wB = h.winsB || 0;
    const winnerText = wA > wB ? '🏆 Time A' : wB > wA ? '🏆 Time B' : '🤝 Empate';
    const games = h.games || h.sets || [];
    card.innerHTML = `
      <div class="hc-head">
        <div class="hc-title">${h.title}</div>
        <div class="hc-date">${h.date}</div>
      </div>
      <div class="hc-result">
        <span class="hc-team-score" style="color:var(--a-color)">${wA}</span>
        <span style="color:var(--text3);font-size:1rem;font-weight:700"> vitórias · </span>
        <span class="hc-team-score" style="color:var(--b-color)">${wB}</span>
        <span style="color:var(--text2);font-size:0.82rem;margin-left:8px">${winnerText}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text3);margin-top:6px">${h.mode}×${h.mode} · ${games.length} partidas</div>
    `;
    el.appendChild(card);
  });
}

/* ──────────────────────────────────────────────────────
   GLOBAL TOAST
────────────────────────────────────────────────────── */
let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById('global-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add('hidden'), 2400);
}

/* ──────────────────────────────────────────────────────
   PWA
────────────────────────────────────────────────────── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwa-banner').classList.remove('hidden');
});
document.getElementById('btn-pwa-install').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  document.getElementById('pwa-banner').classList.add('hidden');
  deferredPrompt = null;
});
document.getElementById('btn-pwa-close').addEventListener('click', () => {
  document.getElementById('pwa-banner').classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

/* ──────────────────────────────────────────────────────
   INICIALIZAÇÃO
────────────────────────────────────────────────────── */
(function init() {
  load();

  // Se já logado, vai direto para home
  if (APP.currentUser) {
    goTo('home', false);
    if (APP.activeMatch) {
      startTimer();
    }
  } else {
    document.getElementById('screen-login').classList.add('active');
  }
})();
