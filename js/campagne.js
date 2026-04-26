// ═══════════════════════════════════════════════════════════════
//  CAMPAGNE.JS — Liste des campagnes (V2)
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;
let _allCampagnes = [];
let _filtre = 'toutes';

let _authDone = false;
function waitForAuth(cb) {
  function fire() { if (_authDone) return; _authDone = true; token = window.SUPABASE_TOKEN; cb(); }
  if (window.SUPABASE_TOKEN) { fire(); return; }
  window.addEventListener('supabase-ready', fire, { once: true });
  let n = 0;
  const t = setInterval(() => {
    if (window.SUPABASE_TOKEN) { clearInterval(t); fire(); }
    if (++n > 150) clearInterval(t);
  }, 100);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Statuts ──────────────────────────────────────────────────
const STATUTS = {
  en_cours:    { lbl: 'EN COURS',     col: '#4ade80', bg: 'rgba(74,222,128,0.15)',  pulse: true  },
  preparation: { lbl: 'PRÉPARATION',  col: '#865dff', bg: 'rgba(134,93,255,0.15)', pulse: false },
  terminee:    { lbl: 'ACHEVÉE',      col: '#6b7085', bg: 'rgba(107,112,133,0.15)',pulse: false },
};

const COVER_ICONS = ['🌫', '⚓', '🗡', '⚒', '🌙', '🔮', '📖', '🐉', '🏔', '🌿'];
const COVER_GRADS = [
  'linear-gradient(135deg,#1a4a3a,#0d2818)',
  'linear-gradient(135deg,#1e3a5a,#0a1828)',
  'linear-gradient(135deg,#4a1a1a,#2a0808)',
  'linear-gradient(135deg,#4a2c1a,#2a1808)',
  'linear-gradient(135deg,#3a1a4a,#1c0828)',
  'linear-gradient(135deg,#1a1a4a,#080828)',
  'linear-gradient(135deg,#1a3a2a,#081808)',
  'linear-gradient(135deg,#4a3a1a,#281e08)',
  'linear-gradient(135deg,#2a1a4a,#120828)',
  'linear-gradient(135deg,#1a3a3a,#082020)',
];
const COVER_ACCENTS = ['#4ade80','#60a5fa','#f87171','#fbbf24','#c084fc','#818cf8','#34d399','#f59e0b','#a78bfa','#2dd4bf'];

function coverForId(id) {
  // Derive consistent cover from id string
  let hash = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COVER_ICONS.length;
  return { icon: COVER_ICONS[idx], grad: COVER_GRADS[idx], accent: COVER_ACCENTS[idx] };
}

function labelStatut(s) {
  return { preparation: 'Préparation', en_cours: 'En cours', terminee: 'Terminée' }[s] || s;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── CHARGEMENT ───────────────────────────────────────────────
async function chargerCampagnes() {
  try {
    const res = await fetch(`${API}/Campagnes`, { headers: authHeaders() });
    _allCampagnes = await res.json();
    updateCounts();
    afficherCampagnes();
    initFilters();
  } catch {
    document.getElementById('campagnes-grid').innerHTML =
      '<div class="camp-empty"><div class="camp-empty__icon">⚠️</div><p>Erreur de chargement</p></div>';
  }
}

function updateCounts() {
  const totals = { toutes: _allCampagnes.length, en_cours: 0, preparation: 0, terminee: 0 };
  _allCampagnes.forEach(c => { if (totals[c.statut] !== undefined) totals[c.statut]++; });

  Object.entries(totals).forEach(([k, v]) => {
    const el = document.getElementById(`count-${k}`);
    if (el) el.textContent = v;
  });

  const actives = totals.en_cours;
  document.getElementById('campagnes-count').textContent =
    `${_allCampagnes.length} campagne${_allCampagnes.length > 1 ? 's' : ''} · ${actives} active${actives > 1 ? 's' : ''}`;
}

function afficherCampagnes() {
  const grid = document.getElementById('campagnes-grid');
  const list = _filtre === 'toutes'
    ? _allCampagnes
    : _allCampagnes.filter(c => c.statut === _filtre);

  // Carte créer
  const createCard = `
    <div class="camp-card-create" onclick="ouvrirModalCreer()">
      <div class="camp-card-create__icon">+</div>
      <div>
        <div class="camp-card-create__title">Forger une nouvelle campagne</div>
        <div class="camp-card-create__desc">Donnez-lui un nom, une description, et lancez l'aventure.</div>
      </div>
      <button class="btn btn--primary" onclick="event.stopPropagation();ouvrirModalCreer()">
        <i class="fa-solid fa-plus"></i> Créer
      </button>
    </div>`;

  if (!list.length) {
    grid.innerHTML = createCard + `
      <div class="camp-empty">
        <div class="camp-empty__icon"><i class="fa-solid fa-book-skull"></i></div>
        <div class="camp-empty__title">Aucune campagne ici</div>
        <p>Changez le filtre ou créez votre première campagne.</p>
      </div>`;
    return;
  }

  grid.innerHTML = createCard + list.map(c => buildCard(c)).join('');
}

function buildCard(c) {
  const s = STATUTS[c.statut] || STATUTS.preparation;
  const cover = coverForId(c._id);
  const terminee = c.statut === 'terminee';
  const nbChap = c.chapitres_count ?? (Array.isArray(c.chapitres) ? c.chapitres.length : 0);

  const pulseDot = s.pulse
    ? `<span class="camp-status-dot" style="background:${s.col}"></span>`
    : '';

  const pitch = c.description
    ? `<div class="camp-card-pitch">« ${esc(c.description)} »</div>`
    : '';

  return `
    <div class="camp-card ${terminee ? 'camp-card--terminee' : ''}"
         style="border-color:${c.statut === 'en_cours' ? 'rgba(74,222,128,0.2)' : ''}"
         onclick="ouvrirCampagne('${c._id}')"
         onmouseenter="this.style.borderColor='${cover.accent}'"
         onmouseleave="this.style.borderColor='${c.statut === 'en_cours' ? 'rgba(74,222,128,0.2)' : 'rgba(201,168,76,0.15)'}'">

      <div class="camp-card-cover" style="background:${cover.grad}">
        <div class="camp-card-cover-icon" style="filter:drop-shadow(0 4px 14px ${cover.accent}88)">
          ${cover.icon}
        </div>
        <div class="camp-card-status"
             style="background:${s.bg};color:${s.col};border-color:${s.col}55">
          ${pulseDot}${s.lbl}
        </div>
      </div>

      <div class="camp-card-body">
        <div>
          <div class="camp-card-sys">D&D 5e</div>
          <div class="camp-card-nom">${esc(c.nom)}</div>
        </div>
        ${pitch}

        <div class="camp-card-meta">
          <div class="camp-meta-item">
            <div class="camp-meta-label">Chapitres</div>
            <div class="camp-meta-val">${nbChap}</div>
          </div>
          <div class="camp-meta-item">
            <div class="camp-meta-label">Modifiée</div>
            <div class="camp-meta-val" style="font-size:var(--text-xs)">${formatDate(c.derniere_modification)}</div>
          </div>
          <div class="camp-card-actions">
            <button class="camp-btn camp-btn--primary"
                    onclick="event.stopPropagation();ouvrirCampagne('${c._id}')">
              <i class="fa-solid fa-pen"></i> Éditer
            </button>
            <button class="camp-btn camp-btn--danger"
                    onclick="event.stopPropagation();supprimerCampagne('${c._id}','${esc(c.nom)}')"
                    title="Supprimer">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function initFilters() {
  document.querySelectorAll('.camp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtre = btn.dataset.filter;
      document.querySelectorAll('.camp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      afficherCampagnes();
    });
  });
}

// ─── NAVIGATION ───────────────────────────────────────────────
function ouvrirCampagne(id) {
  window.location.href = `campagne-detail.html?id=${id}`;
}
window.ouvrirCampagne = ouvrirCampagne;

async function supprimerCampagne(id, nom) {
  if (!confirm(`Supprimer la campagne "${nom}" ? Cette action est irréversible.`)) return;
  try {
    await fetch(`${API}/Campagnes/${id}`, { method: 'DELETE', headers: authHeaders() });
    chargerCampagnes();
  } catch {
    alert('Erreur lors de la suppression');
  }
}
window.supprimerCampagne = supprimerCampagne;

// ─── CRÉATION ─────────────────────────────────────────────────
function ouvrirModalCreer() {
  document.getElementById('c-nom').value = '';
  document.getElementById('c-desc').value = '';
  document.getElementById('modal-creer').classList.remove('hidden');
  setTimeout(() => document.getElementById('c-nom').focus(), 50);
}
window.ouvrirModalCreer = ouvrirModalCreer;

function fermerModal() {
  document.getElementById('modal-creer').classList.add('hidden');
}
window.fermerModal = fermerModal;

async function creerCampagne() {
  const nom = document.getElementById('c-nom').value.trim();
  if (!nom) { alert('Donnez un nom à la campagne'); return; }
  const description = document.getElementById('c-desc').value.trim();
  const statut = document.getElementById('c-statut').value;
  try {
    const res = await fetch(`${API}/Campagnes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ nom, description, statut })
    });
    const data = await res.json();
    fermerModal();
    window.location.href = `campagne-detail.html?id=${data._id}`;
  } catch {
    alert('Erreur lors de la création');
  }
}
window.creerCampagne = creerCampagne;

// ─── CLAVIER ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fermerModal();
});

waitForAuth(chargerCampagnes);
