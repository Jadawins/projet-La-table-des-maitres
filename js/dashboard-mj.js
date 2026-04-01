/* ================================================================
   DASHBOARD-MJ.JS — Hub central du Maître de Jeu
   ================================================================ */

'use strict';

// ─── État global ──────────────────────────────────────────────
let _userId      = null;
let _token       = null;
let _campagnes   = [];
let _sessions    = [];
let _campagneId  = null;   // campagne sélectionnée
let _sessionId   = null;   // session sélectionnée
let _blocs       = [];     // blocs éditeur campagne
let _campagneSale = false; // modifications non sauvées
let _refreshInterval = null;
const API = 'https://myrpgtable.fr/api';

// ─── Init ──────────────────────────────────────────────────────
function _autoInit() {
  if (window._supabaseUser && window._supabaseToken) {
    _userId = window._supabaseUser.id;
    _token  = window._supabaseToken;
    _init();
  } else {
    document.addEventListener('supabase-ready', e => {
      _userId = e.detail.user.id;
      _token  = e.detail.token;
      _init();
    }, { once: true });
    let tries = 0;
    const poll = setInterval(() => {
      if (window._supabaseToken) {
        clearInterval(poll);
        _userId = window._supabaseUser.id;
        _token  = window._supabaseToken;
        _init();
      } else if (++tries > 150) clearInterval(poll);
    }, 100);
  }
}

async function _init() {
  await Promise.all([chargerCampagnes(), chargerSessions()]);
  // Lire éventuel paramètre URL
  const params = new URLSearchParams(location.search);
  if (params.get('session')) selectionnerSession(params.get('session'));
  else if (params.get('campagne')) selectionnerCampagne(params.get('campagne'));
}

// ─── CHARGEMENTS ───────────────────────────────────────────────
async function chargerCampagnes() {
  try {
    const r = await fetch(`${API}/Campagnes`, { headers: { Authorization: `Bearer ${_token}` } });
    _campagnes = await r.json();
  } catch { _campagnes = []; }
  _renderCampagnes();
}

async function chargerSessions() {
  try {
    const r = await fetch(`${API}/Sessions?role=mj`, { headers: { Authorization: `Bearer ${_token}` } });
    _sessions = await r.json();
  } catch { _sessions = []; }
  _renderSessions();
}

// ─── RENDU NAVIGATION ──────────────────────────────────────────
function _renderCampagnes() {
  const el = document.getElementById('db-liste-campagnes');
  if (!el) return;
  if (!_campagnes.length) {
    el.innerHTML = '<p class="db-nav-empty">Aucune campagne</p>';
    return;
  }
  el.innerHTML = _campagnes.map(c => `
    <div class="db-nav-item ${_campagneId === String(c._id) ? 'actif' : ''}" onclick="selectionnerCampagne('${c._id}')">
      <span class="db-nav-item-name">${_esc(c.nom)}</span>
      <span class="db-nav-badge ${c.statut || 'prep'}">${_labelStatut(c.statut)}</span>
    </div>
  `).join('');
}

function _renderSessions() {
  const el = document.getElementById('db-liste-sessions');
  if (!el) return;
  if (!_sessions.length) {
    el.innerHTML = '<p class="db-nav-empty">Aucune session</p>';
    return;
  }
  el.innerHTML = _sessions.map(s => `
    <div class="db-nav-item ${_sessionId === String(s._id) ? 'actif' : ''}" onclick="selectionnerSession('${s._id}')">
      <span class="db-nav-item-name">${_esc(s.nom)}</span>
      <span class="db-nav-badge ${{ recrutement:'wait', en_cours:'active', active:'active', terminee:'done' }[s.statut] || 'wait'}">${{ recrutement:'⏳', en_cours:'●', active:'●', terminee:'✓' }[s.statut] || '⏳'}</span>
    </div>
  `).join('');
}

function _labelStatut(s) {
  if (!s || s === 'prep') return '⚙';
  if (s === 'recrutement') return '⏳';
  if (s === 'en_cours' || s === 'active') return '●';
  if (s === 'terminee') return '✓';
  return s;
}

// ─── SÉLECTION CAMPAGNE ────────────────────────────────────────
async function selectionnerCampagne(id) {
  if (_campagneSale && !confirm('Des modifications non sauvées seront perdues. Continuer ?')) return;
  _campagneId = String(id);
  _sessionId  = null;
  _campagneSale = false;
  _renderCampagnes();
  _renderSessions();
  _stopRefresh();

  const c = _campagnes.find(x => String(x._id) === _campagneId);
  if (!c) return;

  document.getElementById('campagne-titre').textContent = c.nom;
  const badge = document.getElementById('campagne-statut-badge');
  badge.textContent = _labelStatutLong(c.statut);
  badge.className = `db-nav-badge ${c.statut || 'prep'}`;
  document.getElementById('campagne-desc').value = c.description || '';
  _blocs = Array.isArray(c.blocs) ? c.blocs : [];
  _renderBlocs();
  afficherVue('vue-campagne');
  _mettreAJourCtxCampagne(c);
  document.getElementById('db-topbar-titre').textContent = c.nom;
}

function _labelStatutLong(s) {
  if (!s || s === 'prep') return 'Préparation';
  if (s === 'active') return 'Active';
  if (s === 'terminee') return 'Terminée';
  return s;
}

// ─── SÉLECTION SESSION ─────────────────────────────────────────
async function selectionnerSession(id) {
  _sessionId = String(id);
  _campagneId = null;
  _renderCampagnes();
  _renderSessions();

  let s = _sessions.find(x => String(x._id) === _sessionId);
  if (!s) return;

  document.getElementById('session-titre').textContent = s.nom;
  document.getElementById('db-topbar-titre').textContent = s.nom;
  afficherVue('vue-session');

  // Re-fetch le statut depuis l'API pour ne pas afficher un cache périmé
  try {
    const rf = await fetch(`${API}/Sessions/${_sessionId}`, { headers: { Authorization: `Bearer ${_token}` } });
    if (rf.ok) {
      const fresh = await rf.json();
      // Normaliser 'active' → 'en_cours'
      if (fresh.statut === 'active') fresh.statut = 'en_cours';
      s = { ...s, ...fresh };
      // Mettre à jour le cache local
      const idx = _sessions.findIndex(x => String(x._id) === _sessionId);
      if (idx !== -1) _sessions[idx] = s;
    }
  } catch (e) { /* garder le cache */ }

  const badge = document.getElementById('session-statut-badge');
  const statutBadge = { recrutement: '⏳ Recrutement', en_cours: '● En cours', terminee: '✓ Terminée' };
  const statutCls   = { recrutement: 'wait', en_cours: 'active', terminee: 'done' };
  badge.textContent = statutBadge[s.statut] || s.statut;
  badge.className = `db-nav-badge ${statutCls[s.statut] || 'wait'}`;

  await _chargerDashboardSession(s._id);
  _mettreAJourCtxSession(s);

  if (s.statut === 'en_cours' || s.statut === 'active') {
    _stopRefresh();
    _refreshInterval = setInterval(() => _chargerDashboardSession(_sessionId), 5000);
  }
}

async function _chargerDashboardSession(id) {
  try {
    const r = await fetch(`${API}/Sessions/${id}/stats`, { headers: { Authorization: `Bearer ${_token}` } });
    if (!r.ok) return;
    const data = await r.json();
    _renderDashboardSession(data);
  } catch (e) { console.warn('Erreur chargement session stats:', e); }
}

function _renderDashboardSession(data) {
  const { joueurs = [], stats = {}, journal = [] } = data;

  // Stats rapides
  document.getElementById('stat-joueurs').textContent = `${joueurs.length} joueurs`;
  document.getElementById('stat-duree').textContent = stats.duree || '—';
  document.getElementById('stat-morts').textContent = stats.morts || 0;
  document.getElementById('stat-xp').textContent = stats.xp_total || 0;

  // Cartes joueurs
  const grid = document.getElementById('db-joueurs-grid');
  if (joueurs.length === 0) {
    grid.innerHTML = '<p class="db-ctx-empty">Aucun joueur dans cette session.</p>';
  } else {
    grid.innerHTML = joueurs.map(j => _renderCarteJoueur(j)).join('');
  }

  // Journal
  const journalEl = document.getElementById('db-journal');
  if (journal.length === 0) {
    journalEl.innerHTML = '<p class="db-ctx-empty" style="padding:0.5rem 0;">Aucune entrée de journal.</p>';
  } else {
    journalEl.innerHTML = journal.map(e => `
      <div class="db-journal-entry">
        <span class="db-journal-time">${_formatTime(e.date)}</span>
        <span class="db-journal-text">${_esc(e.message)}</span>
      </div>
    `).join('');
    journalEl.scrollTop = journalEl.scrollHeight;
  }
}

function _renderCarteJoueur(j) {
  const pvPct = j.pv_max > 0 ? Math.round((j.pv / j.pv_max) * 100) : 0;
  const pvClass = pvPct > 60 ? 'haut' : pvPct > 30 ? 'moyen' : 'bas';
  const conditions = (j.conditions || []).slice(0, 3);
  return `
    <div class="db-joueur-card ${j.pv <= 0 ? 'mort' : ''}">
      <div class="db-joueur-header">
        <span class="db-joueur-nom">${_esc(j.nom)}</span>
        <span class="db-joueur-classe">${_esc(j.classe || '')} Niv.${j.niveau || 1}</span>
      </div>
      <div class="db-pv-bar-track">
        <div class="db-pv-bar-fill ${pvClass}" style="width:${pvPct}%"></div>
      </div>
      <div class="db-joueur-pv">
        <span>${j.pv || 0} / ${j.pv_max || 0} PV</span>
        <span style="color:var(--db-secondary);font-size:0.75rem;">${pvPct}%</span>
      </div>
      ${conditions.length ? `
        <div class="db-joueur-conditions">
          ${conditions.map(c => `<span class="db-condition-badge">${_esc(c)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="db-joueur-actions">
        <button class="db-btn ghost sm" onclick="ouvrirFicheJoueur('${j.perso_id}')">
          <i class="fa-solid fa-id-card"></i>
        </button>
        <button class="db-btn danger sm" onclick="soignerJoueur('${j.perso_id}', ${j.pv}, ${j.pv_max})">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
    </div>
  `;
}

// ─── VUES ──────────────────────────────────────────────────────
function afficherVue(id) {
  document.querySelectorAll('.db-view').forEach(v => v.classList.remove('active'));
  const v = document.getElementById(id);
  if (v) v.classList.add('active');
}

// ─── ÉDITEUR DE BLOCS ──────────────────────────────────────────
const TYPES_BLOCS = {
  rencontre: { label: 'Rencontre',  icon: 'fa-swords' },
  jet:       { label: 'Jet de dés', icon: 'fa-dice-d20' },
  loot:      { label: 'Loot',       icon: 'fa-gem' },
  pnj:       { label: 'PNJ',        icon: 'fa-person' },
  lieu:      { label: 'Lieu',       icon: 'fa-map-location-dot' },
  texte:     { label: 'Texte',      icon: 'fa-align-left' }
};

function _renderBlocs() {
  const container = document.getElementById('editeur-blocs');
  if (!container) return;
  if (_blocs.length === 0) {
    container.innerHTML = '<p class="db-editeur-vide">Aucun bloc. Utilisez la barre d\'outils pour ajouter du contenu.</p>';
    return;
  }
  container.innerHTML = _blocs.map((b, i) => _renderBloc(b, i)).join('');
}

function _renderBloc(b, i) {
  const meta = TYPES_BLOCS[b.type] || TYPES_BLOCS.texte;
  let contenu = '';

  if (b.type === 'rencontre') {
    contenu = `
      <input type="text" class="db-input db-bloc-input" placeholder="Nom de la rencontre…"
        value="${_esc(b.nom || '')}" oninput="majBloc(${i},'nom',this.value)">
      <textarea class="db-input db-textarea db-bloc-input" rows="2" placeholder="Monstres, difficulté, contexte…"
        oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
      <div style="display:flex;gap:0.5rem;margin-top:0.4rem;">
        <input type="text" class="db-input db-bloc-input" style="flex:1" placeholder="XP récompense"
          value="${_esc(b.xp || '')}" oninput="majBloc(${i},'xp',this.value)">
        <select class="db-input db-select db-bloc-input" style="flex:1" onchange="majBloc(${i},'difficulte',this.value)">
          <option value="">Difficulté</option>
          ${['Facile','Moyenne','Difficile','Mortelle'].map(d => `<option ${b.difficulte===d?'selected':''}>${d}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (b.type === 'jet') {
    contenu = `
      <input type="text" class="db-input db-bloc-input" placeholder="Compétence ou caractéristique…"
        value="${_esc(b.competence || '')}" oninput="majBloc(${i},'competence',this.value)">
      <div style="display:flex;gap:0.5rem;margin-top:0.4rem;align-items:center;">
        <span style="color:var(--db-secondary);font-size:0.85rem;">DD</span>
        <input type="number" class="db-input db-bloc-input" style="width:80px" placeholder="15"
          value="${b.dd || ''}" oninput="majBloc(${i},'dd',parseInt(this.value)||0)">
        <textarea class="db-input db-textarea db-bloc-input" style="flex:1" rows="1" placeholder="Description…"
          oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
      </div>
    `;
  } else if (b.type === 'loot') {
    contenu = `
      <textarea class="db-input db-textarea db-bloc-input" rows="3" placeholder="Liste des objets, monnaie…"
        oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
    `;
  } else if (b.type === 'pnj') {
    contenu = `
      <input type="text" class="db-input db-bloc-input" placeholder="Nom du PNJ…"
        value="${_esc(b.nom || '')}" oninput="majBloc(${i},'nom',this.value)">
      <input type="text" class="db-input db-bloc-input" style="margin-top:0.4rem;" placeholder="Rôle / Relation…"
        value="${_esc(b.role || '')}" oninput="majBloc(${i},'role',this.value)">
      <textarea class="db-input db-textarea db-bloc-input" rows="2" style="margin-top:0.4rem;" placeholder="Description, motivations…"
        oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
    `;
  } else if (b.type === 'lieu') {
    contenu = `
      <input type="text" class="db-input db-bloc-input" placeholder="Nom du lieu…"
        value="${_esc(b.nom || '')}" oninput="majBloc(${i},'nom',this.value)">
      <textarea class="db-input db-textarea db-bloc-input" rows="3" style="margin-top:0.4rem;" placeholder="Description sensorielle, ambiance…"
        oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
    `;
  } else {
    contenu = `
      <textarea class="db-input db-textarea db-bloc-input" rows="3" placeholder="Texte libre…"
        oninput="majBloc(${i},'contenu',this.value)">${_esc(b.contenu || '')}</textarea>
    `;
  }

  return `
    <div class="db-bloc" data-index="${i}">
      <div class="db-bloc-header">
        <span class="db-bloc-type ${b.type}">
          <i class="fa-solid ${meta.icon}"></i> ${meta.label}
        </span>
        <div class="db-bloc-actions">
          <button class="db-bloc-btn" onclick="monterBloc(${i})" title="Monter" ${i===0?'disabled':''}>▲</button>
          <button class="db-bloc-btn" onclick="descendreBloc(${i})" title="Descendre" ${i===_blocs.length-1?'disabled':''}>▼</button>
          <button class="db-bloc-btn danger" onclick="supprimerBloc(${i})" title="Supprimer">✕</button>
        </div>
      </div>
      <div class="db-bloc-body">${contenu}</div>
    </div>
  `;
}

function ajouterBloc(type) {
  _blocs.push({ type, nom: '', contenu: '' });
  marqueSaleCampagne();
  _renderBlocs();
  // Scroll to last bloc
  const container = document.getElementById('editeur-blocs');
  if (container) container.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function majBloc(i, champ, valeur) {
  if (!_blocs[i]) return;
  _blocs[i][champ] = valeur;
  marqueSaleCampagne();
}

function monterBloc(i) {
  if (i <= 0) return;
  [_blocs[i-1], _blocs[i]] = [_blocs[i], _blocs[i-1]];
  marqueSaleCampagne();
  _renderBlocs();
}

function descendreBloc(i) {
  if (i >= _blocs.length - 1) return;
  [_blocs[i], _blocs[i+1]] = [_blocs[i+1], _blocs[i]];
  marqueSaleCampagne();
  _renderBlocs();
}

function supprimerBloc(i) {
  if (!confirm('Supprimer ce bloc ?')) return;
  _blocs.splice(i, 1);
  marqueSaleCampagne();
  _renderBlocs();
}

function marqueSaleCampagne() {
  _campagneSale = true;
}

// ─── SAUVEGARDE CAMPAGNE ───────────────────────────────────────
async function enregistrerCampagne() {
  if (!_campagneId) return;
  const desc = document.getElementById('campagne-desc').value;
  try {
    const r = await fetch(`${API}/Campagnes/${_campagneId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ description: desc, blocs: _blocs })
    });
    if (!r.ok) throw new Error('Erreur sauvegarde');
    _campagneSale = false;
    _showToast('success', 'Campagne sauvegardée');
    // Mettre à jour le cache local
    const idx = _campagnes.findIndex(c => String(c._id) === _campagneId);
    if (idx >= 0) { _campagnes[idx].description = desc; _campagnes[idx].blocs = _blocs; }
  } catch (e) {
    _showToast('danger', 'Erreur lors de la sauvegarde');
  }
}

// ─── CRÉER CAMPAGNE ────────────────────────────────────────────
function ouvrirModalNouvelleC() {
  document.getElementById('nc-nom').value = '';
  document.getElementById('nc-desc').value = '';
  ouvrirModal('modal-nouvelle-campagne');
}

async function creerCampagne() {
  const nom = document.getElementById('nc-nom').value.trim();
  if (!nom) { alert('Nom requis.'); return; }
  const desc = document.getElementById('nc-desc').value.trim();
  try {
    const r = await fetch(`${API}/Campagnes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ nom, description: desc })
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    fermerModal('modal-nouvelle-campagne');
    await chargerCampagnes();
    selectionnerCampagne(data._id || data.insertedId);
  } catch {
    _showToast('danger', 'Erreur lors de la création');
  }
}

// ─── CRÉER SESSION ─────────────────────────────────────────────
function ouvrirModalNouvelleS() {
  document.getElementById('ns-nom').value = '';
  document.getElementById('ns-mdp').value = '';
  document.getElementById('ns-mdp-wrap').style.display = 'none';
  // Remplir liste campagnes
  const sel = document.getElementById('ns-campagne');
  sel.innerHTML = '<option value="">— Aucune campagne —</option>' +
    _campagnes.map(c => `<option value="${c._id}">${_esc(c.nom)}</option>`).join('');
  document.getElementById('ns-visibilite').value = 'public';
  ouvrirModal('modal-nouvelle-session');
}

document.getElementById('ns-visibilite')?.addEventListener('change', function() {
  document.getElementById('ns-mdp-wrap').style.display = this.value === 'private' ? 'block' : 'none';
});

async function creerSession() {
  const nom = document.getElementById('ns-nom').value.trim();
  if (!nom) { alert('Nom requis.'); return; }
  const campagne_id = document.getElementById('ns-campagne').value || null;
  const visibilite  = document.getElementById('ns-visibilite').value;
  const mdp         = document.getElementById('ns-mdp').value.trim() || null;
  try {
    const r = await fetch(`${API}/Sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ nom, campagne_id, visibilite, mot_de_passe: mdp })
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    fermerModal('modal-nouvelle-session');
    await chargerSessions();
    selectionnerSession(data._id || data.insertedId);
  } catch {
    _showToast('danger', 'Erreur lors de la création');
  }
}

// ─── ACTIONS SESSION ────────────────────────────────────────────
function ouvrirEcranMJ() {
  if (_sessionId) window.open(`ecran-mj.html?session=${_sessionId}`, '_blank');
}

function ouvrirModalMessage() {
  document.getElementById('msg-contenu').value = '';
  ouvrirModal('modal-message');
}

async function envoyerMessageGroupe() {
  const msg = document.getElementById('msg-contenu').value.trim();
  if (!msg) return;
  try {
    const r = await fetch(`${API}/Sessions/${_sessionId}/message-groupe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ message: msg })
    });
    if (!r.ok) throw new Error();
    fermerModal('modal-message');
    _showToast('success', 'Message envoyé au groupe');
  } catch {
    _showToast('danger', 'Erreur envoi message');
  }
}

async function demarrerSession() {
  if (!_sessionId) return;
  try {
    const r = await fetch(`${API}/Sessions/${_sessionId}/demarrer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${_token}` }
    });
    if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
    _showToast('success', 'Session démarrée !');
    await chargerSessions();
    const s = _sessions.find(x => String(x._id) === _sessionId);
    if (s) {
      const badge = document.getElementById('session-statut-badge');
      badge.textContent = '● En cours';
      badge.className = 'db-nav-badge active';
      _mettreAJourCtxSession(s);
      _stopRefresh();
      _refreshInterval = setInterval(() => _chargerDashboardSession(_sessionId), 5000);
    }
  } catch (e) {
    _showToast('danger', e.message || 'Erreur lors du démarrage');
  }
}

function terminerSession() {
  document.getElementById('terminer-resume').value = '';
  ouvrirModal('modal-terminer');
}

async function confirmerTerminerSession() {
  const resume = document.getElementById('terminer-resume').value.trim();
  try {
    const r = await fetch(`${API}/Sessions/${_sessionId}/terminer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ resume })
    });
    if (!r.ok) throw new Error();
    fermerModal('modal-terminer');
    _showToast('success', 'Session terminée');
    _stopRefresh();
    await chargerSessions();
    // Mettre à jour le badge
    const badge = document.getElementById('session-statut-badge');
    if (badge) { badge.textContent = '✓ Terminée'; badge.className = 'db-nav-badge done'; }
    // Masquer bouton terminer
    document.getElementById('ctx-xp').style.display = 'none';
  } catch {
    _showToast('danger', 'Erreur lors de la clôture');
  }
}

// ─── ACTIONS JOUEURS ───────────────────────────────────────────
function ouvrirFicheJoueur(id) {
  window.open(`fiche-personnage.html?id=${id}`, '_blank');
}

async function soignerJoueur(persoId, pvActuels, pvMax) {
  const val = prompt(`Soins pour ce joueur (PV actuels : ${pvActuels}/${pvMax}) :`, '');
  if (val === null) return;
  const soins = parseInt(val);
  if (isNaN(soins) || soins <= 0) return;
  try {
    const r = await fetch(`${API}/Personnages/${persoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ pv: Math.min(pvMax, pvActuels + soins) })
    });
    if (!r.ok) throw new Error();
    _showToast('success', `+${soins} PV appliqués`);
  } catch {
    _showToast('danger', 'Erreur application soins');
  }
}

// ─── XP (PANNEAU CONTEXTUEL) ───────────────────────────────────
async function distribuerXPDashboard() {
  const xp = parseInt(document.getElementById('ctx-xp-valeur').value);
  if (!xp || xp <= 0 || !_sessionId) return;
  try {
    const r = await fetch(`${API}/Sessions/${_sessionId}/xp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ xp })
    });
    if (!r.ok) throw new Error();
    document.getElementById('ctx-xp-valeur').value = '';
    _showToast('success', `${xp} XP distribués`);
    _chargerDashboardSession(_sessionId);
  } catch {
    _showToast('danger', 'Erreur distribution XP');
  }
}

async function jalonDashboard() {
  if (!_sessionId) return;
  if (!confirm('Appliquer un jalon (montée en niveau) à tous les joueurs de la session ?')) return;
  try {
    const r = await fetch(`${API}/Sessions/${_sessionId}/jalon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` }
    });
    if (!r.ok) throw new Error();
    _showToast('success', 'Jalon appliqué — montée en niveau déclenchée');
    _chargerDashboardSession(_sessionId);
  } catch {
    _showToast('danger', 'Erreur jalon');
  }
}

// ─── HISTORIQUE ────────────────────────────────────────────────
async function afficherHistorique(sessionId) {
  afficherVue('vue-historique');
  const el = document.getElementById('db-historique-liste');
  el.innerHTML = '<div class="db-nav-loading"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>';
  try {
    const r = await fetch(`${API}/Sessions/${sessionId}/historique`, { headers: { Authorization: `Bearer ${_token}` } });
    const data = await r.json();
    if (!data.length) {
      el.innerHTML = '<p class="db-nav-empty">Aucune entrée d\'historique.</p>';
      return;
    }
    el.innerHTML = data.map(e => `
      <div class="db-histo-item">
        <div class="db-histo-header">
          <span class="db-histo-date">${_formatDate(e.date)}</span>
          <span class="db-histo-type">${_esc(e.type || 'journal')}</span>
        </div>
        <p class="db-histo-contenu">${_esc(e.message || e.contenu || '')}</p>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<p class="db-nav-empty">Erreur de chargement.</p>';
  }
}

// ─── STATS CAMPAGNE ────────────────────────────────────────────
async function ouvrirModalStatsC() {
  if (!_campagneId) return;
  const c = _campagnes.find(x => String(x._id) === _campagneId);
  if (c) document.getElementById('stats-campagne-nom').textContent = c.nom;
  afficherVue('vue-stats');
  const grid = document.getElementById('db-stats-grid');
  grid.innerHTML = '<div class="db-nav-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const r = await fetch(`${API}/Campagnes/${_campagneId}/stats`, { headers: { Authorization: `Bearer ${_token}` } });
    const stats = await r.json();
    grid.innerHTML = [
      { label: 'Sessions jouées',    val: stats.nb_sessions     || 0, icon: 'fa-scroll' },
      { label: 'Temps total',        val: stats.duree_totale    || '—', icon: 'fa-hourglass' },
      { label: 'XP distribué',       val: stats.xp_total        || 0, icon: 'fa-star' },
      { label: 'Monstres vaincus',   val: stats.monstres_total  || 0, icon: 'fa-skull' },
      { label: 'Morts de joueurs',   val: stats.morts_total     || 0, icon: 'fa-heart-crack' },
      { label: 'Joueurs actifs',     val: stats.nb_joueurs      || 0, icon: 'fa-users' },
    ].map(s => `
      <div class="db-stat-card">
        <i class="fa-solid ${s.icon} db-stat-icon"></i>
        <div class="db-stat-val">${s.val}</div>
        <div class="db-stat-label">${s.label}</div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '<p class="db-nav-empty">Impossible de charger les statistiques.</p>';
  }
}

// ─── JOURNAL ───────────────────────────────────────────────────
async function ajouterNoteJournal() {
  const input = document.getElementById('journal-input');
  const msg = input.value.trim();
  if (!msg || !_sessionId) return;
  input.value = '';
  try {
    await fetch(`${API}/Sessions/${_sessionId}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ message: msg, type: 'note' })
    });
    _chargerDashboardSession(_sessionId);
  } catch { /* ignore */ }
}

function exporterJournal() {
  const entries = document.querySelectorAll('#db-journal .db-journal-entry');
  if (!entries.length) return;
  const txt = Array.from(entries).map(e => {
    const t = e.querySelector('.db-journal-time')?.textContent || '';
    const m = e.querySelector('.db-journal-text')?.textContent || '';
    return `[${t}] ${m}`;
  }).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txt);
  a.download = `journal-session-${_sessionId}.txt`;
  a.click();
}

// ─── LANCEUR DE DÉS ────────────────────────────────────────────
const _desHistorique = [];

function lancerDe(faces) {
  const val = Math.ceil(Math.random() * faces);
  const el = document.getElementById('db-de-resultat');
  if (el) {
    el.textContent = val;
    el.className = 'db-de-resultat ' + (val === faces ? 'critique' : val === 1 ? 'echec' : '');
  }
  _desHistorique.unshift(`d${faces} → ${val}`);
  if (_desHistorique.length > 5) _desHistorique.pop();
  const histo = document.getElementById('db-de-historique');
  if (histo) histo.innerHTML = _desHistorique.map(x => `<span class="db-de-histo-item">${x}</span>`).join('');
}

// ─── PANNEAU CTX ───────────────────────────────────────────────
function _mettreAJourCtxCampagne(c) {
  document.getElementById('ctx-session-info').style.display = 'none';
  document.getElementById('ctx-xp').style.display = 'none';
  const actionsEl = document.getElementById('ctx-actions-contenu');
  actionsEl.innerHTML = `
    <button class="db-btn primary" style="width:100%;margin-bottom:0.4rem;" onclick="enregistrerCampagne()">
      <i class="fa-solid fa-floppy-disk"></i> Enregistrer
    </button>
    <button class="db-btn blue" style="width:100%;margin-bottom:0.4rem;" onclick="ouvrirModalNouvelleS()">
      <i class="fa-solid fa-play"></i> Lancer une session
    </button>
    <button class="db-btn ghost" style="width:100%;" onclick="ouvrirModalStatsC()">
      <i class="fa-solid fa-chart-simple"></i> Statistiques
    </button>
  `;
}

function _mettreAJourCtxSession(s) {
  const statut = s.statut || 'recrutement';
  const isRecrutement = statut === 'recrutement';
  const isEnCours     = statut === 'en_cours' || statut === 'active';
  const isTerminee    = statut === 'terminee';

  document.getElementById('ctx-session-info').style.display = 'block';
  document.getElementById('ctx-xp').style.display = isEnCours ? 'block' : 'none';

  const statutLabels = { recrutement: 'Recrutement', en_cours: 'En cours', active: 'En cours', terminee: 'Terminée' };
  document.getElementById('ctx-session-infos-contenu').innerHTML = `
    <div style="font-size:0.82rem;color:var(--db-secondary);">
      <div style="margin-bottom:0.3rem;"><i class="fa-solid fa-circle${isEnCours ? ' text-success' : ''}"></i> Statut : <strong>${statutLabels[statut] || statut}</strong></div>
      ${s.campagne_nom ? `<div style="margin-bottom:0.3rem;"><i class="fa-solid fa-book-skull"></i> Campagne : ${_esc(s.campagne_nom)}</div>` : ''}
      ${isEnCours ? `<button class="db-btn primary" style="width:100%;margin-top:0.5rem;" onclick="ouvrirEcranMJ()"><i class="fa-solid fa-display"></i> Écran MJ</button>` : ''}
      ${isTerminee ? `<button class="db-btn ghost" style="width:100%;margin-top:0.5rem;" onclick="afficherHistorique('${s._id}')"><i class="fa-solid fa-clock-rotate-left"></i> Voir historique</button>` : ''}
    </div>
  `;

  const actionsEl = document.getElementById('ctx-actions-contenu');
  if (isRecrutement) {
    actionsEl.innerHTML = `
      <button class="db-btn primary" style="width:100%;margin-bottom:0.4rem;" onclick="demarrerSession()">
        <i class="fa-solid fa-play"></i> Démarrer la session
      </button>
    `;
  } else if (isEnCours) {
    actionsEl.innerHTML = `
      <button class="db-btn blue" style="width:100%;margin-bottom:0.4rem;" onclick="ouvrirModalMessage()">
        <i class="fa-solid fa-paper-plane"></i> Message groupe
      </button>
      <button class="db-btn danger" style="width:100%;" onclick="terminerSession()">
        <i class="fa-solid fa-flag-checkered"></i> Terminer la session
      </button>
    `;
  } else {
    actionsEl.innerHTML = `
      <button class="db-btn ghost" style="width:100%;margin-bottom:0.4rem;" onclick="afficherHistorique('${s._id}')">
        <i class="fa-solid fa-clock-rotate-left"></i> Historique
      </button>
      <button class="db-btn ghost" style="width:100%;" onclick="ouvrirModalStatsS('${s._id}')">
        <i class="fa-solid fa-chart-simple"></i> Statistiques
      </button>
    `;
  }
}

async function ouvrirModalStatsS(sessionId) {
  // Réutilise la vue stats mais pour une session
  afficherVue('vue-stats');
  document.getElementById('stats-campagne-nom').textContent = 'Session';
  const grid = document.getElementById('db-stats-grid');
  grid.innerHTML = '<div class="db-nav-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const r = await fetch(`${API}/Sessions/${sessionId}/stats`, { headers: { Authorization: `Bearer ${_token}` } });
    const data = await r.json();
    const stats = data.stats || {};
    grid.innerHTML = [
      { label: 'Joueurs',           val: (data.joueurs || []).length, icon: 'fa-users' },
      { label: 'Durée',             val: stats.duree         || '—', icon: 'fa-hourglass' },
      { label: 'XP distribué',      val: stats.xp_total      || 0,   icon: 'fa-star' },
      { label: 'Monstres vaincus',  val: stats.monstres      || 0,   icon: 'fa-skull' },
      { label: 'Morts',             val: stats.morts         || 0,   icon: 'fa-heart-crack' },
      { label: 'Entrées journal',   val: (data.journal || []).length, icon: 'fa-book-open' },
    ].map(s => `
      <div class="db-stat-card">
        <i class="fa-solid ${s.icon} db-stat-icon"></i>
        <div class="db-stat-val">${s.val}</div>
        <div class="db-stat-label">${s.label}</div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '<p class="db-nav-empty">Impossible de charger.</p>';
  }
}

// ─── MODALS ────────────────────────────────────────────────────
function ouvrirModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

function fermerModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

// Fermer en cliquant sur l'overlay
document.querySelectorAll('.db-modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// ─── REFRESH ───────────────────────────────────────────────────
function _stopRefresh() {
  if (_refreshInterval) { clearInterval(_refreshInterval); _refreshInterval = null; }
}

// ─── UTILITAIRES ───────────────────────────────────────────────
function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}

function _formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function _showToast(type, msg) {
  if (typeof toastLocal === 'function') {
    toastLocal(type, msg, '', null);
    return;
  }
  // Fallback simple
  const el = Object.assign(document.createElement('div'), {
    className: `db-toast db-toast-${type}`,
    textContent: msg
  });
  Object.assign(el.style, { position:'fixed', bottom:'1.5rem', right:'1.5rem', padding:'0.6rem 1rem',
    borderRadius:'8px', color:'#fff', zIndex:9999,
    background: type==='success'?'#4ade80':type==='danger'?'#f87171':'#4a9eff' });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── EXPOSER AU HTML ───────────────────────────────────────────
Object.assign(window, {
  selectionnerCampagne, selectionnerSession, afficherVue,
  ouvrirModalNouvelleC, ouvrirModalNouvelleS,
  creerCampagne, creerSession,
  enregistrerCampagne, marqueSaleCampagne,
  ajouterBloc, majBloc, monterBloc, descendreBloc, supprimerBloc,
  ouvrirModalMessage, envoyerMessageGroupe,
  demarrerSession, terminerSession, confirmerTerminerSession,
  ouvrirEcranMJ, ouvrirFicheJoueur, soignerJoueur,
  distribuerXPDashboard, jalonDashboard,
  afficherHistorique, ouvrirModalStatsC, ouvrirModalStatsS,
  ajouterNoteJournal, exporterJournal,
  lancerDe,
  ouvrirModal, fermerModal
});

// ─── AUTO-INIT ─────────────────────────────────────────────────
_autoInit();
