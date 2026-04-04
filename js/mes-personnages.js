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

function authH() { return { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function capitalize(s) { return String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1); }

async function charger() {
  try {
    const r = await fetch(`${API}/Personnages`, { headers: authH() });
    const data = await r.json();
    afficher(data);
  } catch { document.getElementById('perso-grid').innerHTML = '<p style="color:#f00">Erreur de chargement</p>'; }
}

function afficher(personnages) {
  const grid = document.getElementById('perso-grid');
  const count = document.getElementById('perso-count');
  count.textContent = `${personnages.length} personnage${personnages.length > 1 ? 's' : ''}`;
  if (!personnages.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-user-plus"></i>
      <h3>Aucun personnage</h3>
      <p>Créez votre premier personnage pour commencer l'aventure.</p>
    </div>`;
    return;
  }
  grid.innerHTML = personnages.map(p => `
    <div class="perso-card" onclick="ouvrirFiche('${p._id}')">
      <div class="perso-card-name">${esc(p.nom)}</div>
      <div class="perso-card-sub">${capitalize(p.classe||'—')} · Niveau ${p.niveau||1} · ${capitalize(p.espece||'—')}</div>
      <div class="perso-card-meta">
        <span><i class="fa-solid fa-heart"></i> ${p.combat?.pv_actuels||0}/${p.combat?.pv_max||0} PV</span>
        <span><i class="fa-solid fa-scroll"></i> ${capitalize(p.background||'—')}</span>
      </div>
      <div class="perso-card-actions">
        <button class="btn-secondary" onclick="event.stopPropagation();ouvrirFiche('${p._id}')">
          <i class="fa-solid fa-pen"></i> Fiche
        </button>
        <button class="btn-danger" onclick="event.stopPropagation();supprimer('${p._id}','${esc(p.nom)}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function ouvrirFiche(id) { window.location.href = `fiche-personnage.html?id=${id}`; }
window.ouvrirFiche = ouvrirFiche;

async function supprimer(id, nom) {
  if (!confirm(`Supprimer "${nom}" ?`)) return;
  await fetch(`${API}/Personnages/${id}`, { method:'DELETE', headers: authH() });
  charger();
}
window.supprimer = supprimer;

waitForAuth(charger);
