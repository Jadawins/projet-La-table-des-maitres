/* =============================================================
   CREER-SESSION.JS
   ============================================================= */

const API = 'https://myrpgtable.fr/api';

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

function togglePassword() {
  const v = document.getElementById('visibilite').value;
  document.getElementById('mdp-group').style.display = v === 'privee' ? 'block' : 'none';
}

async function creerSession() {
  const nom = document.getElementById('nom').value.trim();
  const description = document.getElementById('description').value.trim();
  const systeme = document.getElementById('systeme').value;
  const statut = document.getElementById('statut').value;
  const visibilite = document.getElementById('visibilite').value;
  const mot_de_passe = document.getElementById('mot_de_passe').value;
  const errEl = document.getElementById('form-error');

  errEl.style.display = 'none';

  if (!nom) {
    errEl.textContent = 'Le nom de la session est requis.';
    errEl.style.display = 'block';
    return;
  }

  if (visibilite === 'privee' && !mot_de_passe) {
    errEl.textContent = 'Un mot de passe est requis pour une session privée.';
    errEl.style.display = 'block';
    return;
  }

  if (!window.SUPABASE_TOKEN) {
    errEl.textContent = 'Non authentifié. Veuillez vous reconnecter.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btn-creer');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création…';

  try {
    const res = await fetch(`${API}/Sessions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        nom, description, visibilite, mot_de_passe: visibilite === 'privee' ? mot_de_passe : undefined,
        statut, systeme, mj_pseudo: window.USER_PSEUDO || 'MJ'
      })
    });

    const data = await res.json();

    if (!res.ok) {
      errEl.textContent = data.error || 'Erreur lors de la création.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-plus"></i> Créer la session';
      return;
    }

    showToast('Session créée avec succès !');
    setTimeout(() => {
      window.location.href = `session-detail.html?id=${data._id}`;
    }, 800);
  } catch (e) {
    errEl.textContent = `Erreur réseau : ${e.message}`;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-plus"></i> Créer la session';
  }
}

// Exposer globalement pour onclick HTML
window.togglePassword = togglePassword;
window.creerSession = creerSession;
