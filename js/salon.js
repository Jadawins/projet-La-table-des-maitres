/* =============================================================
   SALON.JS — Salle d'attente / chat pré-combat
   ============================================================= */

const API = 'https://myrpgtable.fr/api';

let sessionId   = null;
let sessionData = null;
let estMJ       = false;
let refreshTimer = null;
let lastSalonMsgTs = null;
let lastPmTs       = null;
let pmNonLus       = 0;

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

function showSynchro(v) {
  document.getElementById('synchro-indicator').classList.toggle('visible', v);
}

// ─── INIT ─────────────────────────────────────────────────────

waitForAuth(() => {
  const params = new URLSearchParams(window.location.search);
  sessionId = params.get('session');
  if (!sessionId) { window.location.href = 'sessions.html'; return; }

  const userEl = document.getElementById('topbar-user');
  if (userEl) userEl.textContent = window.USER_PSEUDO || '';

  chargerSalon();
  chargerMessagesSalon();
  refreshTimer = setInterval(() => {
    chargerSalon();
    chargerMessagesSalon();
    const tabPm = document.getElementById('tab-pm');
    if (tabPm?.classList.contains('active')) chargerPM();
  }, 3000);
});

// ─── CHARGEMENT SESSION ────────────────────────────────────────

async function chargerSalon() {
  showSynchro(true);
  try {
    const res = await fetch(`${API}/Sessions/${sessionId}`, { headers: authHeaders() });
    if (!res.ok) { window.location.href = 'sessions.html'; return; }
    sessionData = await res.json();
    estMJ = sessionData.est_mj;

    renderTopbar();
    renderSessionInfo();
    renderJoueurs();
    renderMJActions();
    detecterCombat();
  } catch (e) {
    console.error(e);
  } finally {
    showSynchro(false);
  }
}

function renderTopbar() {
  const el = document.getElementById('topbar-session-nom');
  if (el) el.textContent = sessionData.nom || '';
  const retour = document.getElementById('btn-retour');
  if (retour) retour.href = `session-detail.html?id=${sessionId}`;
}

function renderSessionInfo() {
  const labels = { recrutement: 'Recrutement', en_cours: 'En cours', pausee: 'En pause', terminee: 'Terminée' };
  const el = document.getElementById('session-info');
  el.innerHTML = `
    <div class="session-nom">${escHtml(sessionData.nom)}</div>
    <div class="session-mj"><i class="fa-solid fa-crown"></i> MJ : ${escHtml(sessionData.mj_pseudo || '')}</div>
    <div class="session-statut">${labels[sessionData.statut] || sessionData.statut} · ${sessionData.nb_joueurs || 0} joueur(s)</div>`;
}

function renderJoueurs() {
  const el = document.getElementById('joueurs-list');
  const joueurs = sessionData.joueurs || [];

  const mjRow = `
    <div class="joueur-row mj-row" title="Maître du jeu">
      <span><i class="fa-solid fa-crown" style="color:#c9a84c;font-size:.7rem;"></i></span>
      <span class="joueur-pseudo">${escHtml(sessionData.mj_pseudo || 'MJ')}</span>
      ${!estMJ ? `<button class="joueur-pm-btn" onclick="ouvrirPM('${sessionData.mj_id}','${escHtml(sessionData.mj_pseudo || 'MJ')}')">MP</button>` : ''}
    </div>`;

  const joueurRows = joueurs.map(j => {
    const estMoi = j.user_id === window.USER_ID;
    return `<div class="joueur-row">
      <span class="online-dot"></span>
      <div style="flex:1;">
        <div class="joueur-pseudo">${escHtml(j.pseudo)}${estMoi ? ' <em style="color:#c9a84c;font-size:.65rem;">(moi)</em>' : ''}</div>
        ${j.personnage_nom ? `<div class="joueur-perso">${escHtml(j.personnage_nom)}</div>` : ''}
      </div>
      ${!estMoi ? `<button class="joueur-pm-btn" onclick="ouvrirPM('${j.user_id}','${escHtml(j.pseudo)}')">MP</button>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = mjRow + (joueurs.length ? joueurRows : '<p style="color:#555;font-size:.78rem;text-align:center;padding:.5rem;">Aucun joueur inscrit.</p>');

  // Peupler le select PM
  const pmSelect = document.getElementById('pm-dest');
  const currentVal = pmSelect.value;
  const members = [
    { id: sessionData.mj_id, nom: sessionData.mj_pseudo || 'MJ', isMJ: true },
    ...joueurs.filter(j => j.user_id !== window.USER_ID).map(j => ({ id: j.user_id, nom: j.pseudo }))
  ].filter(m => m.id !== window.USER_ID);
  pmSelect.innerHTML = '<option value="">Choisir un joueur…</option>' +
    members.map(m => `<option value="${m.id}" ${m.id === currentVal ? 'selected' : ''}>${escHtml(m.nom)}${m.isMJ ? ' (MJ)' : ''}</option>`).join('');
}

function renderMJActions() {
  const block = document.getElementById('mj-actions');
  if (!estMJ) { block.style.display = 'none'; return; }
  block.style.display = 'block';
  document.getElementById('btn-ecran-mj').href = `ecran-mj.html?session=${sessionId}`;
}

// ─── DÉTECTION COMBAT ACTIF ────────────────────────────────────

function detecterCombat() {
  const banner = document.getElementById('combat-banner');
  if (sessionData.combat_actif) {
    banner.style.display = 'flex';
    if (estMJ) {
      document.getElementById('btn-rejoindre-combat').href = `ecran-mj.html?session=${sessionId}`;
      document.getElementById('btn-rejoindre-combat').textContent = '';
      document.getElementById('btn-rejoindre-combat').innerHTML = '<i class="fa-solid fa-display"></i> Écran MJ';
    } else {
      const moi = (sessionData.joueurs || []).find(j => j.user_id === window.USER_ID);
      const persoId = moi?.personnage_id;
      if (persoId) {
        document.getElementById('btn-rejoindre-combat').href =
          `ecran-joueur.html?session=${sessionId}&perso=${persoId}`;
      } else {
        document.getElementById('btn-rejoindre-combat').textContent = 'Choisir un personnage';
        document.getElementById('btn-rejoindre-combat').href = `session-detail.html?id=${sessionId}`;
      }
    }
  } else {
    banner.style.display = 'none';
  }
}

// ─── LANCER COMBAT (MJ) ───────────────────────────────────────

async function lancerCombat() {
  try {
    const res = await fetch(`${API}/Combats`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ session_id: sessionId })
    });
    if (res.ok) {
      window.location.href = `ecran-mj.html?session=${sessionId}`;
    } else {
      const d = await res.json();
      alert(d.error || 'Erreur');
    }
  } catch (e) { console.error(e); }
}
window.lancerCombat = lancerCombat;

// ─── MESSAGES SALON ───────────────────────────────────────────

async function chargerMessagesSalon() {
  try {
    const res = await fetch(`${API}/Sessions/${sessionId}/salon`, { headers: authHeaders() });
    if (!res.ok) return;
    const msgs = await res.json();
    renderMessagesSalon(msgs);
  } catch(e) {}
}

function renderMessagesSalon(msgs) {
  const el = document.getElementById('salon-messages');
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:.82rem;">Aucun message. Dites bonjour !</div>';
    return;
  }
  const last = msgs[msgs.length - 1];
  const lastTs = last?.timestamp;
  if (lastTs === lastSalonMsgTs) return;
  lastSalonMsgTs = lastTs;

  el.innerHTML = msgs.map(m => {
    const moi = m.auteur_id === window.USER_ID;
    return `<div class="msg-bubble${moi ? ' moi' : ''}">
      <div class="msg-meta">
        <span class="msg-auteur${moi ? ' moi' : ''}">${escHtml(m.auteur)}</span>
        <span class="msg-heure">${formatHeure(m.timestamp)}</span>
      </div>
      <div class="msg-texte">${escHtml(m.contenu)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function envoyerSalon() {
  const input = document.getElementById('salon-input');
  const contenu = input?.value?.trim();
  if (!contenu) return;
  input.value = '';

  await fetch(`${API}/Sessions/${sessionId}/salon`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ contenu, auteur: window.USER_PSEUDO || 'Joueur' })
  });
  await chargerMessagesSalon();
}
window.envoyerSalon = envoyerSalon;

// ─── MESSAGES PRIVÉS ──────────────────────────────────────────

function ouvrirPM(userId, nom) {
  const select = document.getElementById('pm-dest');
  select.value = userId;
  switchTab(document.getElementById('btn-tab-pm'), 'tab-pm');
  chargerPM();
}
window.ouvrirPM = ouvrirPM;

async function chargerPM() {
  const avec = document.getElementById('pm-dest').value;
  if (!avec) {
    document.getElementById('pm-messages').innerHTML =
      '<div style="text-align:center;padding:2rem;color:#555;font-size:.82rem;">Sélectionnez un joueur pour voir vos échanges.</div>';
    return;
  }
  try {
    const res = await fetch(`${API}/Sessions/${sessionId}/pm?avec=${avec}`, { headers: authHeaders() });
    if (!res.ok) return;
    const msgs = await res.json();
    renderPM(msgs);
  } catch(e) {}
}
window.chargerPM = chargerPM;

function renderPM(msgs) {
  const el = document.getElementById('pm-messages');
  if (!msgs.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:#555;font-size:.82rem;">Aucun échange pour l\'instant.</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const moi = m.de === window.USER_ID;
    return `<div class="msg-bubble${moi ? ' moi' : ''}">
      <div class="msg-meta">
        <span class="msg-auteur${moi ? ' moi' : ''}">${escHtml(m.auteur)}</span>
        <span class="msg-heure">${formatHeure(m.timestamp)}</span>
      </div>
      <div class="msg-texte">${escHtml(m.contenu)}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

async function envoyerPM() {
  const dest = document.getElementById('pm-dest').value;
  const input = document.getElementById('pm-input');
  const contenu = input?.value?.trim();
  if (!dest || !contenu) return;
  input.value = '';

  await fetch(`${API}/Sessions/${sessionId}/pm`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ destinataire_id: dest, contenu, auteur: window.USER_PSEUDO || 'Joueur' })
  });
  await chargerPM();
}
window.envoyerPM = envoyerPM;

// ─── TABS ─────────────────────────────────────────────────────

function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-salon').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-salon-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const t = document.getElementById(tabId);
  if (t) t.classList.add('active');
  if (tabId === 'tab-pm') {
    pmNonLus = 0;
    const badge = document.getElementById('pm-badge');
    if (badge) badge.style.display = 'none';
    chargerPM();
  }
}
window.switchTab = switchTab;

// ─── REPOS (MJ) ───────────────────────────────────────────────

let _reposTypeSalon = null;

function ouvrirModalReposSalon(type) {
  _reposTypeSalon = type;
  document.getElementById('repos-salon-titre').textContent =
    type === 'court' ? '🌙 Proposer un Repos Court' : '💤 Proposer un Repos Long';
  document.getElementById('repos-salon-result').textContent = '';
  document.getElementById('modal-repos-salon').classList.remove('hidden');
}
window.ouvrirModalReposSalon = ouvrirModalReposSalon;

async function confirmerReposSalon() {
  const mode  = document.getElementById('repos-salon-mode').value;
  const timer = parseInt(document.getElementById('repos-salon-timer').value) || 0;
  document.getElementById('modal-repos-salon').classList.add('hidden');
  try {
    const r = await fetch(`${API}/Repos`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        type: _reposTypeSalon,
        demandeur_nom: window.USER_PSEUDO || 'MJ',
        mode_validation: mode,
        timer_secondes: timer
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur');
    document.getElementById('repos-salon-result').innerHTML =
      `<span style="color:#4ade80;">✅ Repos ${_reposTypeSalon} proposé !</span>`;
  } catch(e) {
    document.getElementById('repos-salon-result').innerHTML =
      `<span style="color:#f87171;">❌ ${escHtml(e.message)}</span>`;
  }
}
window.confirmerReposSalon = confirmerReposSalon;

// ─── UTILITAIRES ──────────────────────────────────────────────

function formatHeure(ts) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
