/* =============================================================
   ÉCRAN JOUEUR — combat en direct
   ============================================================= */

const API = 'https://myrpgtable.fr/api';

let combatId     = null;
let sessionId    = null;
let combatData   = null;
let monPerso     = null;
let monPersoId   = null;
let cibleId      = null;
let atkEnCours   = null;
let sortEnCours  = null;
let refreshTimer = null;

let slotsLocaux      = {};
let ressourcesLocales = {};
let trackingTour     = { action: false, bonus: false, reaction: false };
let jetsMort         = { succes: 0, echec: 0 };

// ─── AUTH ─────────────────────────────────────────────────────

function waitForAuth(fn) {
  if (window.SUPABASE_TOKEN) { fn(); return; }
  window.addEventListener('supabase-ready', fn, { once: true });
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SUPABASE_TOKEN || ''}`
  };
}

// ─── INIT ─────────────────────────────────────────────────────

waitForAuth(async () => {
  const params = new URLSearchParams(window.location.search);
  sessionId  = params.get('session');
  monPersoId = params.get('perso');

  if (!sessionId || !monPersoId) {
    document.getElementById('actions-panel').innerHTML =
      '<p style="color:#f87171;padding:1rem;">Paramètres manquants (session / perso).</p>';
    return;
  }

  await chargerTout();
  refreshTimer = setInterval(chargerTout, 5000);
});

// ─── CHARGEMENT PRINCIPAL ──────────────────────────────────────

async function chargerTout() {
  showSynchro(true);
  try {
    const [combatRes, persoRes] = await Promise.all([
      fetch(`${API}/Combats/${sessionId}`, { headers: authHeaders() }),
      fetch(`${API}/Personnages/${monPersoId}`, { headers: authHeaders() })
    ]);

    if (!combatRes.ok) throw new Error('Combat introuvable');
    if (!persoRes.ok)  throw new Error('Personnage introuvable');

    combatData = await combatRes.json();
    monPerso   = await persoRes.json();
    combatId   = combatData._id;

    if (!slotsInitialises) initSlotsLocaux();

    renderAll();
  } catch (e) {
    console.error(e);
  } finally {
    showSynchro(false);
  }
}

let slotsInitialises = false;

function initSlotsLocaux() {
  const empl = monPerso?.sorts?.emplacements || {};
  slotsLocaux = {};
  for (const [niv, total] of Object.entries(empl)) {
    slotsLocaux[niv] = parseInt(total, 10);
  }
  const res = monPerso?.ressources_classe || [];
  ressourcesLocales = {};
  res.forEach(r => { ressourcesLocales[r.nom] = { total: r.total, utilises: 0 }; });
  slotsInitialises = true;
}

// ─── RENDER GLOBAL ─────────────────────────────────────────────

function renderAll() {
  renderParticipants();
  renderActionsPanel();
  renderMessages();
  renderTopbar();
}

// ─── TOPBAR ────────────────────────────────────────────────────

function renderTopbar() {
  const nomEl = document.getElementById('topbar-session-nom');
  if (nomEl) nomEl.textContent = combatData.nom_session || combatData.session_id || '';

  const roundEl = document.getElementById('topbar-round');
  if (roundEl) roundEl.textContent = `Round ${combatData.round || 1}`;

  const persoNom = document.getElementById('topbar-perso-nom');
  if (persoNom) persoNom.textContent = monPerso?.nom || '';
}

function showSynchro(visible) {
  const el = document.getElementById('synchro-indicator');
  if (el) el.classList.toggle('visible', visible);
}

// ─── PARTICIPANTS (col gauche) ─────────────────────────────────

function renderParticipants() {
  const el = document.getElementById('participants-list');
  if (!combatData?.participants?.length) {
    el.innerHTML = '<p style="text-align:center;color:#555;padding:2rem;font-size:.82rem;">En attente du combat…</p>';
    return;
  }

  const sorted = [...combatData.participants].sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999));
  const tourActuel = combatData.tour_actuel ?? 0;

  el.innerHTML = sorted.map((p, i) => {
    const pct    = pvPct(p.pv_actuels, p.pv_max);
    const pvCls  = pvClass(pct);
    const isActif  = i === tourActuel;
    const isCible  = p.id === cibleId;
    const isMort   = p.pv_actuels <= 0;
    const isMe     = p.perso_id === monPersoId || p.user_id === window.USER_ID;

    const conditions = (p.conditions || []).map(c =>
      `<span class="pm-cond-badge">${c}</span>`
    ).join('');

    const pvNumsStr = isMort
      ? '<span style="color:#ef4444;font-size:.68rem;">KO</span>'
      : p.type !== 'monstre'
        ? `<span class="pm-pv-nums" style="font-size:.68rem;">${p.pv_actuels}/${p.pv_max}</span>`
        : '';

    return `<div class="participant-mini${isActif ? ' actif' : ''}${isMort ? ' mort' : ''}${isCible ? ' cible-active' : ''}"
      onclick="selectionnerCible('${p.id}','${escHtml(p.nom)}')"
      title="${escHtml(p.nom)}">
      <div class="pm-header">
        <span class="pm-nom">${typeIcon(p.type)} ${escHtml(p.nom)}${isMe ? ' <em style="color:#c9a84c;font-size:.65rem;">(moi)</em>' : ''}</span>
        ${isActif ? '<span class="pm-actif-badge">▶</span>' : ''}
      </div>
      <div class="pm-pv-bar"><div class="pm-pv-fill ${pvCls}" style="width:${pvCls==='zero'?100:pct}%"></div></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.15rem;">
        ${pvNumsStr}
        <div class="pm-conditions">${conditions}</div>
      </div>
    </div>`;
  }).join('');

  const cibleLbl = document.getElementById('cible-label');
  if (cibleLbl) {
    if (cibleId) {
      const c = combatData.participants.find(p => p.id === cibleId);
      cibleLbl.style.display = '';
      cibleLbl.textContent = c ? `→ ${c.nom}` : '';
    } else {
      cibleLbl.style.display = 'none';
    }
  }
}

function selectionnerCible(id, nom) {
  cibleId = (cibleId === id) ? null : id;
  renderParticipants();
}

// ─── ACTIONS PANEL (col centrale) ─────────────────────────────

function renderActionsPanel() {
  const el = document.getElementById('actions-panel');
  if (!combatData || !monPerso) { el.innerHTML = ''; return; }

  const moi = combatData.participants.find(
    p => p.perso_id === monPersoId || p.user_id === window.USER_ID
  );

  const sorted    = [...combatData.participants].sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999));
  const tourIdx   = combatData.tour_actuel ?? 0;
  const actifNow  = sorted[tourIdx];
  const monTour   = actifNow && (actifNow.perso_id === monPersoId || actifNow.user_id === window.USER_ID);

  let html = '';

  // PV hero
  if (moi) {
    const pct   = pvPct(moi.pv_actuels, moi.pv_max);
    const pvCls = pvClass(pct);
    html += `<div class="joueur-pv-hero">
      <div class="joueur-pv-hero-nom">${escHtml(monPerso.nom)}</div>
      <div class="joueur-pv-hero-infos">
        <span>${escHtml(monPerso.classe || '')} niv.${monPerso.niveau || 1}</span>
        <span style="color:${pvCls==='zero'?'#ef4444':pvCls==='bas'?'#f59e0b':'#4ade80'}">
          ${moi.pv_actuels} / ${moi.pv_max} PV
        </span>
        ${moi.pv_temp ? `<span style="color:#60a5fa">+${moi.pv_temp} temp</span>` : ''}
      </div>
      <div class="pm-pv-bar" style="height:6px;border-radius:3px;">
        <div class="pm-pv-fill ${pvCls}" style="width:${pvCls==='zero'?100:pct}%"></div>
      </div>
    </div>`;
  }

  // Tour banner
  html += `<div class="tour-banner${monTour ? ' mon-tour' : ''}">
    ${monTour ? '⚔️ C\'est votre tour !' : (actifNow ? `Tour de <strong>${escHtml(actifNow.nom)}</strong>` : 'En attente…')}
  </div>`;

  // Initiative
  const monInit = moi?.initiative;
  if (monInit == null || monInit === 0) {
    html += `<div class="initiative-panel">
      <label><i class="fa-solid fa-bolt"></i> Initiative</label>
      <input type="number" id="init-val" min="1" max="30" placeholder="—" style="width:56px;" />
      <button class="btn-sm-primary" onclick="soumettreInitiative()">OK</button>
    </div>`;
  } else {
    html += `<div class="initiative-panel" style="opacity:.6;">
      <label><i class="fa-solid fa-bolt"></i> Initiative</label>
      <strong style="color:#c9a84c;">${monInit}</strong>
    </div>`;
  }

  // Tracking action/bonus/reaction
  html += `<div class="tracking-row">
    ${trackBtn('action',   'fa-hand-fist',    'Action')}
    ${trackBtn('bonus',    'fa-plus',         'Bonus')}
    ${trackBtn('reaction', 'fa-bolt',         'Réaction')}
  </div>`;

  // Jets de mort si KO
  if (moi && moi.pv_actuels <= 0) {
    html += renderJetsMort();
  }

  // Tabs
  html += `<div class="tabs-row">
    <button class="tab-btn-j active" onclick="switchTabJ(this,'tab-attaques')"><i class="fa-solid fa-sword"></i> Attaques</button>
    <button class="tab-btn-j" onclick="switchTabJ(this,'tab-sorts')"><i class="fa-solid fa-hat-wizard"></i> Sorts</button>
    <button class="tab-btn-j" onclick="switchTabJ(this,'tab-ressources')"><i class="fa-solid fa-fire-flame-curved"></i> Ressources</button>
  </div>
  <div id="tab-attaques" class="tab-content-j active">${renderAttaques()}</div>
  <div id="tab-sorts"    class="tab-content-j">${renderSorts()}</div>
  <div id="tab-ressources" class="tab-content-j">${renderRessources()}</div>`;

  el.innerHTML = html;
}

function trackBtn(key, icon, label) {
  const used = trackingTour[key];
  return `<button class="track-btn ${used ? 'used' : 'available'}" onclick="toggleTrack('${key}')">
    <i class="fa-solid ${icon}"></i> ${label}
  </button>`;
}

function toggleTrack(key) {
  trackingTour[key] = !trackingTour[key];
  const btn = document.querySelector(`.track-btn[onclick="toggleTrack('${key}')"]`);
  if (btn) {
    btn.classList.toggle('used', trackingTour[key]);
    btn.classList.toggle('available', !trackingTour[key]);
  }
}

function switchTabJ(btn, tabId) {
  document.querySelectorAll('.tab-btn-j').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content-j').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const t = document.getElementById(tabId);
  if (t) t.classList.add('active');
}

// ─── JETS DE MORT ──────────────────────────────────────────────

function renderJetsMort() {
  const sucDots = [0,1,2].map(i =>
    `<div class="jm-dot${i < jetsMort.succes ? ' succes' : ''}"></div>`
  ).join('');
  const echDots = [0,1,2].map(i =>
    `<div class="jm-dot${i < jetsMort.echec ? ' echec' : ''}"></div>`
  ).join('');

  return `<div class="jets-mort-panel">
    <div class="jets-mort-titre">💀 Jets de mort</div>
    <div style="font-size:.72rem;color:#aaa;margin-bottom:.2rem;">Succès</div>
    <div class="jets-mort-dots">${sucDots}</div>
    <div style="font-size:.72rem;color:#aaa;margin-bottom:.2rem;">Échecs</div>
    <div class="jets-mort-dots">${echDots}</div>
    <div class="jets-mort-btns" style="margin-top:.5rem;">
      <button class="jm-btn succes" onclick="jetDeMort('succes')">Succès</button>
      <button class="jm-btn echec"  onclick="jetDeMort('echec')">Échec</button>
      <button class="jm-btn nat20"  onclick="jetDeMort('nat20')">Nat 20</button>
      <button class="jm-btn nat1"   onclick="jetDeMort('nat1')">Nat 1</button>
    </div>
  </div>`;
}

// ─── ATTAQUES ──────────────────────────────────────────────────

function renderAttaques() {
  const attaques = monPerso?.attaques || [];
  if (!attaques.length) return '<p style="color:#555;font-size:.78rem;text-align:center;padding:.5rem;">Aucune attaque définie.</p>';

  return `<div class="actions-section">
    <div class="actions-section-titre">Attaques</div>
    <div class="actions-grid">
      ${attaques.map(a => `
        <button class="btn-action-joueur atk" onclick="ouvrirModalAttaque(${escJson(a)})">
          <span>${escHtml(a.nom || 'Attaque')}</span>
          ${a.degats ? `<span class="btn-degats">${escHtml(a.degats)}</span>` : ''}
          ${a.bonus_attaque != null ? `<span class="btn-bonus">+${a.bonus_attaque} atk</span>` : ''}
        </button>`).join('')}
    </div>
  </div>`;
}

// ─── SORTS ─────────────────────────────────────────────────────

function renderSorts() {
  const sorts = monPerso?.sorts?.sorts_connus || [];
  if (!sorts.length) return '<p style="color:#555;font-size:.78rem;text-align:center;padding:.5rem;">Aucun sort connu.</p>';

  const parNiveau = {};
  sorts.forEach(s => {
    const n = s.niveau ?? 0;
    if (!parNiveau[n]) parNiveau[n] = [];
    parNiveau[n].push(s);
  });

  let html = '';
  for (const niv of Object.keys(parNiveau).sort((a,b) => a-b)) {
    const n = parseInt(niv, 10);
    const totalSlots = n === 0 ? '∞' : (slotsLocaux[niv] ?? 0);
    const slotsStr   = n === 0 ? '' : `<span class="sort-niveau-slots">${renderSlotBadges(n)}</span>`;

    html += `<div class="sort-niveau-titre">
      <span>${n === 0 ? 'Cantrips' : `Niveau ${n}`}</span>
      ${slotsStr}
    </div>`;

    parNiveau[niv].forEach(s => {
      const classe = [s.concentration ? 'concentration' : '', s.rituel ? 'rituel' : ''].filter(Boolean).join(' ');
      html += `<button class="sort-item ${classe}" onclick="ouvrirModalSort(${escJson(s)})">
        <span>${escHtml(s.nom || s.name || '')}</span>
        <span class="sort-ecole">${escHtml(s.ecole || '')}</span>
      </button>`;
    });
  }
  return html;
}

function renderSlotBadges(niv) {
  const total  = monPerso?.sorts?.emplacements?.[niv] ?? 0;
  const restants = slotsLocaux[niv] ?? 0;
  return Array.from({ length: total }, (_, i) =>
    `<span class="slot-badge${i >= restants ? ' vide' : ''}" title="Emplacement niv.${niv}" onclick="recupererSlot(event,${niv})">${i < restants ? niv : '·'}</span>`
  ).join('');
}

function recupererSlot(e, niv) {
  e.stopPropagation();
  const max = monPerso?.sorts?.emplacements?.[niv] ?? 0;
  if ((slotsLocaux[niv] ?? 0) < max) {
    slotsLocaux[niv] = (slotsLocaux[niv] ?? 0) + 1;
    renderActionsPanel();
    switchTabJ(document.querySelector('.tab-btn-j:nth-child(2)'), 'tab-sorts');
  }
}

// ─── RESSOURCES DE CLASSE ──────────────────────────────────────

function renderRessources() {
  const res = monPerso?.ressources_classe || [];
  if (!res.length) return '<p style="color:#555;font-size:.78rem;text-align:center;padding:.5rem;">Aucune ressource définie.</p>';

  return res.map(r => {
    const etat = ressourcesLocales[r.nom] || { total: r.total, utilises: 0 };
    const restants = etat.total - etat.utilises;
    const dots = Array.from({ length: etat.total }, (_, i) =>
      `<span class="use-dot${i >= restants ? ' vide' : ''}" onclick="toggleRessource('${escHtml(r.nom)}',${i},${etat.total})"></span>`
    ).join('');

    return `<div class="ressource-item">
      <span class="ressource-nom">${escHtml(r.nom)}</span>
      <span class="ressource-uses">${dots}</span>
      ${r.repos ? `<span class="ressource-repos">${escHtml(r.repos)}</span>` : ''}
    </div>`;
  }).join('');
}

function toggleRessource(nom, idx, total) {
  if (!ressourcesLocales[nom]) ressourcesLocales[nom] = { total, utilises: 0 };
  const etat = ressourcesLocales[nom];
  const restants = etat.total - etat.utilises;
  if (idx < restants) {
    etat.utilises = etat.total - idx;
  } else {
    etat.utilises = etat.total - idx - 1;
  }
  renderActionsPanel();
  setTimeout(() => switchToTab('tab-ressources'), 0);
}

function switchToTab(tabId) {
  document.querySelectorAll('.tab-btn-j').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content-j').forEach(t => t.classList.remove('active'));
  const t = document.getElementById(tabId);
  if (t) t.classList.add('active');
  const idx = ['tab-attaques','tab-sorts','tab-ressources'].indexOf(tabId);
  if (idx >= 0) {
    const btn = document.querySelectorAll('.tab-btn-j')[idx];
    if (btn) btn.classList.add('active');
  }
}

// ─── MESSAGES ─────────────────────────────────────────────────

function renderMessages() {
  const el = document.getElementById('messages-list');
  const msgs = combatData?.messages || [];
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:.82rem;">Aucun message</div>';
    return;
  }

  const lastId = el.dataset.lastId;
  const lastMsg = msgs[msgs.length - 1];
  if (lastId === String(lastMsg._id || lastMsg.timestamp)) return;

  el.innerHTML = msgs.map(m => {
    const isMe = m.auteur_id === window.USER_ID;
    const ts   = m.timestamp ? formatHeure(m.timestamp) : '';
    return `<div class="msg-bubble${isMe ? ' moi' : ''}" style="margin-bottom:.5rem;">
      <div class="msg-auteur" style="font-size:.65rem;color:#777;margin-bottom:.1rem;">${escHtml(m.auteur || '')} ${ts}</div>
      <div class="msg-texte" style="font-size:.8rem;color:#e2dfc8;background:rgba(255,255,255,0.04);padding:.35rem .5rem;border-radius:5px;">${escHtml(m.contenu || '')}</div>
    </div>`;
  }).join('');

  el.dataset.lastId = String(lastMsg._id || lastMsg.timestamp);
  el.scrollTop = el.scrollHeight;
}

async function envoyerMessage() {
  const input = document.getElementById('msg-contenu');
  const texte = input?.value?.trim();
  if (!texte || !combatId) return;
  input.value = '';

  await fetch(`${API}/Combats/${combatId}/message`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ contenu: texte, auteur: window.USER_PSEUDO || 'Joueur', auteur_id: window.USER_ID })
  });
  await chargerTout();
}

// ─── INITIATIVE ────────────────────────────────────────────────

async function soumettreInitiative() {
  const val = parseInt(document.getElementById('init-val')?.value, 10);
  if (!val || !combatId) return;

  const participants = combatData.participants.map(p => {
    if (p.perso_id === monPersoId || p.user_id === window.USER_ID) {
      return { ...p, initiative: val };
    }
    return p;
  });

  const res = await fetch(`${API}/Combats/${combatId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ participants })
  });

  if (res.ok) {
    showNotif('Initiative enregistrée', 'success');
    await chargerTout();
  } else {
    showNotif('Erreur initiative', 'error');
  }
}

// ─── MODAL ATTAQUE ─────────────────────────────────────────────

function ouvrirModalAttaque(atk) {
  atkEnCours = atk;
  document.getElementById('modal-atk-nom').textContent  = atk.nom || 'Attaque';
  document.getElementById('modal-atk-hint').textContent =
    [atk.degats ? `Dégâts: ${atk.degats}` : '', atk.portee ? `Portée: ${atk.portee}` : ''].filter(Boolean).join(' — ');
  document.getElementById('modal-atk-d20').value   = '';
  document.getElementById('modal-atk-degats').value = 0;
  document.getElementById('atk-avantage-btn').dataset.state = 'normal';
  document.getElementById('atk-avantage-btn').textContent   = 'Normal';
  document.getElementById('atk-d20-detail').textContent     = '';
  document.getElementById('modal-attaque').classList.remove('hidden');
}

function fermerModalAttaque() {
  document.getElementById('modal-attaque').classList.add('hidden');
  atkEnCours = null;
}

function cycleAtkAvantage() {
  const btn = document.getElementById('atk-avantage-btn');
  const states = ['normal', 'avantage', 'desavantage'];
  const labels = ['Normal', 'Avantage', 'Désavantage'];
  const cur = states.indexOf(btn.dataset.state);
  const next = (cur + 1) % 3;
  btn.dataset.state = states[next];
  btn.textContent   = labels[next];
}

function lancerD20Attaque() {
  const state = document.getElementById('atk-avantage-btn').dataset.state;
  const d1 = Math.ceil(Math.random() * 20);
  const d2 = Math.ceil(Math.random() * 20);
  let val, detail;

  if (state === 'avantage') {
    val    = Math.max(d1, d2);
    detail = `(${d1}, ${d2}) → ${val}`;
  } else if (state === 'desavantage') {
    val    = Math.min(d1, d2);
    detail = `(${d1}, ${d2}) → ${val}`;
  } else {
    val    = d1;
    detail = `${d1}`;
  }

  document.getElementById('modal-atk-d20').value  = val;
  document.getElementById('atk-d20-detail').textContent = detail;
}

async function confirmerAttaque() {
  if (!atkEnCours || !combatId) return;
  if (!cibleId) { showNotif('Sélectionnez une cible', 'warning'); return; }

  const d20    = parseInt(document.getElementById('modal-atk-d20').value, 10)   || 0;
  const degats = parseInt(document.getElementById('modal-atk-degats').value, 10) || 0;
  const avantage = document.getElementById('atk-avantage-btn').dataset.state;

  const res = await fetch(`${API}/Combats/${combatId}/attaque`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      attaquant_id: monPersoId,
      cible_id:     cibleId,
      nom_attaque:  atkEnCours.nom,
      d20,
      degats,
      avantage:     avantage !== 'normal' ? avantage : undefined,
      bonus_attaque: atkEnCours.bonus_attaque
    })
  });

  if (res.ok) {
    fermerModalAttaque();
    trackingTour.action = true;
    showNotif(`Attaque — ${degats} dégâts`, 'success');
    await chargerTout();
  } else {
    const err = await res.json().catch(() => ({}));
    showNotif(err.error || 'Erreur attaque', 'error');
  }
}

// ─── MODAL SORT ───────────────────────────────────────────────

function ouvrirModalSort(sort) {
  sortEnCours = sort;
  document.getElementById('modal-sort-nom').textContent  = sort.nom || sort.name || 'Sort';
  document.getElementById('modal-sort-desc').textContent = sort.description || sort.desc || '';

  const conc = document.getElementById('modal-sort-concentration');
  conc.style.display = sort.concentration ? '' : 'none';

  const niv = sort.niveau ?? 0;
  const wrap = document.getElementById('modal-sort-niveau-wrap');

  if (niv === 0) {
    wrap.style.display = 'none';
  } else {
    wrap.style.display = '';
    const cont = document.getElementById('modal-sort-niveaux');
    const empl = monPerso?.sorts?.emplacements || {};
    let btns = '';
    for (let n = niv; n <= 9; n++) {
      if (!empl[n] && !slotsLocaux[n]) continue;
      const dispo = slotsLocaux[n] ?? 0;
      btns += `<button class="btn-niveau-sort${n === niv ? ' selected' : ''}"
        onclick="selectNiveauSort(this,${n})"
        ${dispo <= 0 ? 'disabled' : ''}
        title="${dispo} emplacement(s) restant(s)">
        Niv.${n} <span style="font-size:.65rem;opacity:.7;">(${dispo})</span>
      </button>`;
    }
    cont.innerHTML = btns || '<span style="color:#f87171;font-size:.75rem;">Aucun emplacement disponible</span>';
    wrap._niveauChoisi = niv;
  }

  document.getElementById('modal-sort').classList.remove('hidden');
}

function selectNiveauSort(btn, niv) {
  document.querySelectorAll('.btn-niveau-sort').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('modal-sort-niveaux')._niveauChoisi = niv;
}

function fermerModalSort() {
  document.getElementById('modal-sort').classList.add('hidden');
  sortEnCours = null;
}

async function confirmerSort() {
  if (!sortEnCours || !combatId) return;

  const niv = sortEnCours.niveau ?? 0;
  let niveauUtilise = niv;

  if (niv > 0) {
    niveauUtilise = document.getElementById('modal-sort-niveaux')._niveauChoisi ?? niv;
    if ((slotsLocaux[niveauUtilise] ?? 0) <= 0) {
      showNotif('Aucun emplacement disponible', 'warning');
      return;
    }
  }

  const body = {
    lanceur_id:  monPersoId,
    nom_sort:    sortEnCours.nom || sortEnCours.name,
    niveau_sort: niveauUtilise
  };
  if (cibleId) body.cible_id = cibleId;

  const res = await fetch(`${API}/Combats/${combatId}/sort`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  });

  if (res.ok) {
    if (niv > 0) slotsLocaux[niveauUtilise] = Math.max(0, (slotsLocaux[niveauUtilise] ?? 0) - 1);
    fermerModalSort();
    trackingTour.action = true;
    showNotif(`Sort lancé — niv.${niveauUtilise}`, 'success');
    await chargerTout();
  } else {
    const err = await res.json().catch(() => ({}));
    showNotif(err.error || 'Erreur sort', 'error');
  }
}

// ─── JETS DE MORT (actions) ─────────────────────────────────────

async function jetDeMort(type) {
  if (!combatId) return;

  if (type === 'nat20') {
    jetsMort.succes = 3;
    showNotif('Nat 20 — Retour à 1 PV !', 'success');
  } else if (type === 'nat1') {
    jetsMort.echec = Math.min(3, jetsMort.echec + 2);
  } else if (type === 'succes') {
    jetsMort.succes = Math.min(3, jetsMort.succes + 1);
    if (jetsMort.succes >= 3) showNotif('3 succès — Stabilisé !', 'success');
  } else {
    jetsMort.echec = Math.min(3, jetsMort.echec + 1);
    if (jetsMort.echec >= 3) showNotif('3 échecs — Mort du personnage…', 'error');
  }

  await fetch(`${API}/Combats/${combatId}/mort`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      personnage_id: monPersoId,
      resultat: type,
      succes:  jetsMort.succes,
      echecs:  jetsMort.echec
    })
  });

  renderActionsPanel();
}

// ─── UTILITAIRES ──────────────────────────────────────────────

function pvPct(cur, max) {
  if (!max) return 0;
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
}

function pvClass(pct) {
  if (pct <= 0)  return 'zero';
  if (pct < 25)  return 'bas';
  if (pct < 50)  return 'moyen';
  return 'haut';
}

function typeIcon(type) {
  if (type === 'joueur') return '<i class="fa-solid fa-user" style="color:#865dff"></i>';
  if (type === 'pnj')    return '<i class="fa-solid fa-person" style="color:#c9a84c"></i>';
  return '<i class="fa-solid fa-dragon" style="color:#ff6666"></i>';
}

function formatHeure(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escJson(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "\\'") + "'";
}

function showNotif(msg, type) {
  if (typeof window.showNotification === 'function') {
    window.showNotification(msg, type);
  } else {
    console.log(`[${type}] ${msg}`);
  }
}
