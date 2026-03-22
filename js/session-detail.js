/* =============================================================
   SESSION-DETAIL.JS
   ============================================================= */

const API = 'https://myrpgtable.fr/api';
let SESSION_ID = null;
let sessionData = null;
let selectedPersoId = null;
let selectedPersoNom = null;

window.SESSION_ID = null;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${window.SUPABASE_TOKEN || ''}`
  };
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3500);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statutLabel(s) {
  return { recrutement: 'Recrutement', en_cours: 'En cours', pausee: 'En pause', terminee: 'Terminée' }[s] || s;
}

function fermerModal(id) {
  document.getElementById(id).classList.add('hidden');
}
window.fermerModal = fermerModal;

// ─── CHARGEMENT SESSION ───────────────────────────────────────
async function chargerSession() {
  const params = new URLSearchParams(window.location.search);
  SESSION_ID = params.get('id');
  window.SESSION_ID = SESSION_ID;

  if (!SESSION_ID) {
    window.location.href = 'sessions.html';
    return;
  }

  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}`, { headers: authHeaders() });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    if (res.status === 404) { window.location.href = 'sessions.html'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    sessionData = await res.json();
    renderSession();
  } catch (e) {
    document.getElementById('loading-state').innerHTML =
      `<i class="fa-solid fa-triangle-exclamation" style="color:#ff8888;font-size:2rem;"></i><p style="color:#ff8888;">Erreur : ${e.message}</p>`;
  }
}

// ─── RENDU SESSION ────────────────────────────────────────────
function renderSession() {
  const s = sessionData;

  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('detail-content').style.display = 'block';
  document.getElementById('breadcrumb-nom').textContent = s.nom;
  document.title = `${s.nom} — La Table du Maître`;

  document.getElementById('detail-nom').textContent = s.nom;
  document.getElementById('detail-mj').innerHTML = `<i class="fa-solid fa-crown"></i> MJ : ${s.mj_pseudo}`;
  document.getElementById('detail-desc').textContent = s.description || 'Aucune description.';
  document.getElementById('info-systeme').textContent = s.systeme || 'D&D 2024';
  document.getElementById('info-date').textContent = formatDate(s.date_creation);
  document.getElementById('info-activite').textContent = formatDate(s.date_derniere_activite);

  // Tags
  const tags = [
    `<span class="session-tag tag-${s.statut}">${statutLabel(s.statut)}</span>`,
    `<span class="session-tag tag-systeme">${s.systeme || 'D&D 2024'}</span>`,
    s.est_privee ? '<span class="session-tag tag-privee"><i class="fa-solid fa-lock"></i> Privée</span>' : ''
  ].join('');
  document.getElementById('detail-tags').innerHTML = tags;

  // Joueurs
  const joueurs = s.joueurs || [];
  document.getElementById('nb-joueurs').textContent = joueurs.length;
  renderJoueurs(joueurs, s.est_mj);

  // Blocs d'action selon le rôle
  document.getElementById('block-mj').style.display = s.est_mj ? 'block' : 'none';
  document.getElementById('block-rejoindre').style.display = (!s.est_mj && !s.est_joueur) ? 'block' : 'none';
  document.getElementById('block-mon-perso').style.display = s.est_joueur ? 'block' : 'none';

  if (s.est_mj) {
    document.getElementById('mj-statut-select').value = s.statut;
  }

  if (s.est_joueur) {
    const monEntree = joueurs.find(j => j.user_id === window.USER_ID);
    const persoNom = monEntree?.personnage_nom;
    document.getElementById('mon-perso-nom').textContent = persoNom
      ? `Personnage : ${persoNom}`
      : 'Aucun personnage associé.';
  }
}

function renderJoueurs(joueurs, estMj) {
  const list = document.getElementById('joueurs-list');
  if (!joueurs.length) {
    list.innerHTML = '<li style="color:#666;font-size:0.85rem;padding:0.5rem 0;">Aucun joueur pour l\'instant.</li>';
    return;
  }
  list.innerHTML = joueurs.map(j => `
    <li class="joueur-item">
      <div>
        <span class="joueur-pseudo"><i class="fa-solid fa-user"></i> ${j.pseudo}</span>
        ${j.personnage_nom ? `<br><span class="joueur-perso">${j.personnage_nom}</span>` : ''}
      </div>
      ${estMj && j.user_id !== sessionData.mj_id ? `<button class="btn-expulser" onclick="expulserJoueur('${j.user_id}', '${j.pseudo}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
    </li>`).join('');
}

// ─── REJOINDRE ────────────────────────────────────────────────
function ouvrirModalRejoindre() {
  if (sessionData.est_privee) {
    document.getElementById('mdp-rejoindre').value = '';
    document.getElementById('rejoindre-error').style.display = 'none';
    document.getElementById('modal-rejoindre').classList.remove('hidden');
  } else {
    document.getElementById('nom-session-confirm').textContent = sessionData.nom;
    document.getElementById('modal-rejoindre-public').classList.remove('hidden');
  }
}
window.ouvrirModalRejoindre = ouvrirModalRejoindre;

async function rejoindreSession() {
  const mot_de_passe = sessionData.est_privee ? document.getElementById('mdp-rejoindre').value : undefined;
  const errEl = document.getElementById(sessionData.est_privee ? 'rejoindre-error' : 'rejoindre-error');

  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}/rejoindre`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mot_de_passe, pseudo: window.USER_PSEUDO || 'Joueur' })
    });
    const data = await res.json();

    if (!res.ok) {
      const el = sessionData.est_privee ? document.getElementById('rejoindre-error') : null;
      if (el) { el.textContent = data.error; el.style.display = 'block'; }
      else showToast(data.error, 'error');
      return;
    }

    fermerModal(sessionData.est_privee ? 'modal-rejoindre' : 'modal-rejoindre-public');
    showToast('Vous avez rejoint la session !');
    setTimeout(async () => {
      await chargerSession();
      ouvrirModalPerso();
    }, 600);
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.rejoindreSession = rejoindreSession;

// ─── QUITTER ──────────────────────────────────────────────────
async function quitterSession() {
  if (!confirm('Êtes-vous sûr de vouloir quitter cette session ?')) return;
  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}/quitter`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast('Vous avez quitté la session.');
    setTimeout(() => window.location.href = 'sessions.html', 1000);
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.quitterSession = quitterSession;

// ─── EXPULSER (MJ) ────────────────────────────────────────────
async function expulserJoueur(joueurId, pseudo) {
  if (!confirm(`Expulser ${pseudo} de la session ?`)) return;
  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}/expulser`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ joueur_id: joueurId })
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast(`${pseudo} a été expulsé.`);
    await chargerSession();
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.expulserJoueur = expulserJoueur;

// ─── CHANGER STATUT (MJ) ─────────────────────────────────────
async function changerStatut() {
  const statut = document.getElementById('mj-statut-select').value;
  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ statut })
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast('Statut mis à jour.');
    sessionData.statut = statut;
    // Mettre à jour le tag affiché
    const tags = [
      `<span class="session-tag tag-${statut}">${statutLabel(statut)}</span>`,
      `<span class="session-tag tag-systeme">${sessionData.systeme || 'D&D 2024'}</span>`,
      sessionData.est_privee ? '<span class="session-tag tag-privee"><i class="fa-solid fa-lock"></i> Privée</span>' : ''
    ].join('');
    document.getElementById('detail-tags').innerHTML = tags;
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.changerStatut = changerStatut;

// ─── SUPPRIMER (MJ) ──────────────────────────────────────────
async function supprimerSession() {
  if (!confirm('Supprimer définitivement cette session ? Cette action est irréversible.')) return;
  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast('Session supprimée.');
    setTimeout(() => window.location.href = 'sessions.html', 1000);
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.supprimerSession = supprimerSession;

// ─── MODALE PERSONNAGE ────────────────────────────────────────
async function ouvrirModalPerso() {
  document.getElementById('perso-error').style.display = 'none';
  document.getElementById('perso-list-modal').innerHTML =
    '<p style="text-align:center;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</p>';
  document.getElementById('modal-perso').classList.remove('hidden');
  selectedPersoId = null;
  selectedPersoNom = null;

  try {
    const res = await fetch(`${API}/GetCharacters?userId=${window.USER_ID}`, { headers: authHeaders() });
    const personnages = await res.json();

    if (!personnages.length) {
      document.getElementById('perso-list-modal').innerHTML =
        `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>Aucun personnage créé.</p></div>`;
      return;
    }

    // Trouver le personnage actuel
    const monEntree = (sessionData.joueurs || []).find(j => j.user_id === window.USER_ID);
    const persoActuelId = monEntree?.personnage_id?.toString();

    document.getElementById('perso-list-modal').innerHTML = personnages.map(p => `
      <div class="perso-card ${persoActuelId && p._id.toString() === persoActuelId ? 'selected' : ''}"
           onclick="selectionnerPerso('${p._id}', '${(p.name || p.nom || 'Personnage').replace(/'/g, "\\'")}')">
        <div>
          <p class="perso-card-name">${p.name || p.nom || 'Sans nom'}</p>
          <p class="perso-card-class">${p.class || p.classe || '—'} · Niv. ${p.level || p.niveau || 1}</p>
        </div>
        <i class="fa-solid fa-check" style="color:#865dff;display:${persoActuelId && p._id.toString() === persoActuelId ? 'block' : 'none'}"></i>
      </div>`).join('');

    // Bouton confirmer
    document.getElementById('perso-list-modal').insertAdjacentHTML('beforeend', `
      <div style="margin-top:1rem;display:flex;gap:0.5rem;justify-content:flex-end;">
        <button class="btn-secondary" onclick="fermerModal('modal-perso')">Annuler</button>
        <button class="btn-primary" id="btn-confirmer-perso" onclick="confirmerPerso()" disabled>
          <i class="fa-solid fa-check"></i> Confirmer
        </button>
      </div>`);

  } catch (e) {
    document.getElementById('perso-error').textContent = `Erreur : ${e.message}`;
    document.getElementById('perso-error').style.display = 'block';
  }
}
window.ouvrirModalPerso = ouvrirModalPerso;

function selectionnerPerso(id, nom) {
  selectedPersoId = id;
  selectedPersoNom = nom;
  document.querySelectorAll('.perso-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('i')?.setAttribute('style', 'color:#865dff;display:none');
  });
  const clicked = event.currentTarget;
  clicked.classList.add('selected');
  clicked.querySelector('i')?.setAttribute('style', 'color:#865dff;display:block');
  const btn = document.getElementById('btn-confirmer-perso');
  if (btn) btn.disabled = false;
}
window.selectionnerPerso = selectionnerPerso;

async function confirmerPerso() {
  if (!selectedPersoId) return;
  try {
    const res = await fetch(`${API}/Sessions/${SESSION_ID}/personnage`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ personnage_id: selectedPersoId, personnage_nom: selectedPersoNom })
    });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    fermerModal('modal-perso');
    showToast(`Personnage "${selectedPersoNom}" associé.`);
    document.getElementById('mon-perso-nom').textContent = `Personnage : ${selectedPersoNom}`;
    await chargerSession();
  } catch (e) {
    showToast(`Erreur : ${e.message}`, 'error');
  }
}
window.confirmerPerso = confirmerPerso;

// ─── INIT ─────────────────────────────────────────────────────
function waitForAuth(callback, tries = 0) {
  if (window.SUPABASE_TOKEN) return callback();
  if (tries > 30) return;
  setTimeout(() => waitForAuth(callback, tries + 1), 100);
}

document.addEventListener('DOMContentLoaded', () => {
  waitForAuth(chargerSession);

  // Fermer modales avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['modal-rejoindre', 'modal-rejoindre-public', 'modal-perso'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
      });
    }
  });

  // Fermer modales en cliquant en dehors
  ['modal-rejoindre', 'modal-rejoindre-public', 'modal-perso'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('click', e => { if (e.target === el) fermerModal(id); });
  });
});
