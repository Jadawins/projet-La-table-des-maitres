// ═══════════════════════════════════════════════════════════════
//  CAMPAGNE.JS — Liste des campagnes
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;

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

// ─── CHARGEMENT ───────────────────────────────────────────────

async function chargerCampagnes() {
  try {
    const res = await fetch(`${API}/Campagnes`, { headers: authHeaders() });
    const data = await res.json();
    afficherCampagnes(data);
  } catch (e) {
    document.getElementById('campagnes-grid').innerHTML =
      `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Erreur de chargement</p></div>`;
  }
}

function afficherCampagnes(campagnes) {
  const grid = document.getElementById('campagnes-grid');
  const count = document.getElementById('campagnes-count');
  count.textContent = `${campagnes.length} campagne${campagnes.length > 1 ? 's' : ''}`;

  if (!campagnes.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-book-skull"></i>
        <h3>Aucune campagne</h3>
        <p>Créez votre première campagne pour commencer l'aventure.</p>
      </div>`;
    return;
  }

  grid.innerHTML = campagnes.map(c => `
    <div class="campagne-card" onclick="ouvrirCampagne('${c._id}')">
      <div class="campagne-card-header">
        <div class="campagne-card-nom">${escHtml(c.nom)}</div>
        <span class="badge-statut badge-${c.statut}">${labelStatut(c.statut)}</span>
      </div>
      ${c.description ? `<div class="campagne-card-desc">${escHtml(c.description)}</div>` : ''}
      <div class="campagne-card-meta">
        <span><i class="fa-solid fa-book-open"></i> ${(c.chapitres_count || 0)} chapitres</span>
        <span><i class="fa-solid fa-calendar-days"></i> ${formatDate(c.derniere_modification)}</span>
      </div>
      <div class="campagne-card-actions">
        <button class="btn-secondary btn-sm" onclick="event.stopPropagation();ouvrirCampagne('${c._id}')">
          <i class="fa-solid fa-pen"></i> Éditer
        </button>
        <button class="btn-danger btn-sm" onclick="event.stopPropagation();supprimerCampagne('${c._id}','${escHtml(c.nom)}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function ouvrirCampagne(id) {
  window.location.href = `campagne-detail.html?id=${id}`;
}

async function supprimerCampagne(id, nom) {
  if (!confirm(`Supprimer la campagne "${nom}" ? Cette action est irréversible.`)) return;
  try {
    await fetch(`${API}/Campagnes/${id}`, { method: 'DELETE', headers: authHeaders() });
    chargerCampagnes();
  } catch (e) {
    alert('Erreur lors de la suppression');
  }
}

// ─── CRÉATION ─────────────────────────────────────────────────

function ouvrirModalCreer() {
  document.getElementById('c-nom').value = '';
  document.getElementById('c-desc').value = '';
  document.getElementById('modal-creer').classList.remove('hidden');
  setTimeout(() => document.getElementById('c-nom').focus(), 50);
}

function fermerModal() {
  document.getElementById('modal-creer').classList.add('hidden');
}

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
  } catch (e) {
    alert('Erreur lors de la création');
  }
}

// ─── UTILITAIRES ──────────────────────────────────────────────

function labelStatut(s) {
  return { preparation: 'Préparation', en_cours: 'En cours', terminee: 'Terminée' }[s] || s;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── CLAVIER ──────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fermerModal();
});

// ─── INIT ─────────────────────────────────────────────────────

waitForAuth(chargerCampagnes);
