/* =============================================================
   SESSIONS.JS — Liste des sessions
   ============================================================= */

const API = 'https://myrpgtable.fr/api';

let currentStatut = 'toutes';
let searchTimeout = null;

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
  setTimeout(() => t.classList.remove('visible'), 3000);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statutLabel(s) {
  const labels = { recrutement: 'Recrutement', en_cours: 'En cours', terminee: 'Terminée' };
  return labels[s] || s;
}

function renderCard(session) {
  const badge = session.est_mj
    ? '<span class="session-card-badge badge-mj">MJ</span>'
    : session.est_joueur
      ? '<span class="session-card-badge badge-joueur">Joueur</span>'
      : '';

  const tags = [
    `<span class="session-tag tag-${session.statut}">${statutLabel(session.statut)}</span>`,
    `<span class="session-tag tag-systeme">${session.systeme || 'D&D 2024'}</span>`,
    session.est_privee ? '<span class="session-tag tag-privee"><i class="fa-solid fa-lock"></i> Privée</span>' : ''
  ].join('');

  return `
    <a class="session-card ${(session.est_mj || session.est_joueur) ? 'ma-session' : ''}"
       href="session-detail.html?id=${session._id}"
       style="color:inherit;text-decoration:none;">
      ${badge}
      <p class="session-card-title">${session.nom}</p>
      <p class="session-card-mj"><i class="fa-solid fa-crown"></i> ${session.mj_pseudo}</p>
      <p class="session-card-desc">${session.description || 'Aucune description.'}</p>
      <div class="session-card-meta">
        ${tags}
        <span class="session-card-joueurs"><i class="fa-solid fa-users"></i> ${session.nb_joueurs || 0} joueur${session.nb_joueurs !== 1 ? 's' : ''}</span>
      </div>
    </a>`;
}

async function chargerSessions() {
  const recherche = document.getElementById('recherche').value.trim();
  const params = new URLSearchParams();
  if (currentStatut !== 'toutes') params.set('statut', currentStatut);
  if (recherche) params.set('recherche', recherche);

  const grille = document.getElementById('sessions-grid');
  const mesGrille = document.getElementById('mes-sessions-grid');
  const mesSection = document.getElementById('mes-sessions-section');

  grille.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:#c9a84c;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

  try {
    const res = await fetch(`${API}/Sessions?${params}`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) { window.location.href = 'login.html'; return; }
      throw new Error(`HTTP ${res.status}`);
    }
    const sessions = await res.json();

    const mesSessions = sessions.filter(s => s.est_mj || s.est_joueur);
    const autresSessions = sessions.filter(s => !s.est_mj && !s.est_joueur);

    if (mesSessions.length) {
      mesSection.style.display = 'block';
      mesGrille.innerHTML = mesSessions.map(renderCard).join('');
    } else {
      mesSection.style.display = 'none';
    }

    if (!autresSessions.length && !mesSessions.length) {
      grille.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-dice-d20"></i>
          <p>Aucune session trouvée.</p>
          <p><a href="creer-session.html" style="color:#865dff;">Créer la première session</a></p>
        </div>`;
    } else if (!autresSessions.length) {
      grille.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-check"></i><p>Pas d'autres sessions disponibles.</p></div>`;
    } else {
      grille.innerHTML = autresSessions.map(renderCard).join('');
    }

    document.getElementById('autres-title').textContent = autresSessions.length
      ? `Sessions disponibles (${autresSessions.length})`
      : 'Sessions disponibles';

  } catch (e) {
    grille.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><p>Erreur : ${e.message}</p></div>`;
  }
}

function waitForAuth(callback, tries = 0) {
  if (window.SUPABASE_TOKEN) return callback();
  if (tries > 30) return;
  setTimeout(() => waitForAuth(callback, tries + 1), 100);
}

document.addEventListener('DOMContentLoaded', () => {
  // Lire le statut initial depuis l'URL (?statut=terminee)
  const urlStatut = new URLSearchParams(window.location.search).get('statut');
  if (urlStatut) {
    currentStatut = urlStatut;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.statut === urlStatut);
    });
  }

  // Filtres statut
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentStatut = pill.dataset.statut;
      waitForAuth(chargerSessions);
    });
  });

  // Recherche debounce
  document.getElementById('recherche').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => waitForAuth(chargerSessions), 300);
  });

  // Charger au démarrage
  waitForAuth(chargerSessions);
});
