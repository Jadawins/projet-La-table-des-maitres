const API = 'https://myrpgtable.fr/api';
let token = null;
let _allPersos = [];
let _filtre = 'tous';
let _tri = 'recent';

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

function authH() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }; }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function capitalize(s) { return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1); }

const CLASS_COLORS = {
  barbare: '#d97706', barde: '#d946ef', clerc: '#facc15', druide: '#65a30d',
  guerrier: '#b91c1c', moine: '#06b6d4', paladin: '#fbbf24', rodeur: '#15803d',
  roublard: '#6b7280', ensorceleur: '#f43f5e', occultiste: '#7c3aed', magicien: '#2563eb',
};

function classColor(classe) {
  if (!classe) return '#865dff';
  const k = classe.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return CLASS_COLORS[k] || '#865dff';
}

function hpColor(pct) {
  if (pct > 60) return '#4ade80';
  if (pct > 30) return '#fbbf24';
  return '#f87171';
}

async function charger() {
  try {
    const r = await fetch(`${API}/Personnages`, { headers: authH() });
    _allPersos = await r.json();
    updateCounts();
    renderGrid();
    initToolbar();
  } catch {
    document.getElementById('perso-grid').innerHTML =
      '<div class="mp-empty"><div class="mp-empty__icon">⚠️</div><p class="mp-empty__text">Erreur de chargement</p></div>';
  }
}

function updateCounts() {
  const vivants = _allPersos.filter(p => pvActuels(p) > 0 || pvMax(p) === 0);
  const morts   = _allPersos.filter(p => pvActuels(p) === 0 && pvMax(p) > 0);
  document.getElementById('count-tous').textContent    = _allPersos.length;
  document.getElementById('count-vivants').textContent = vivants.length;
  document.getElementById('count-morts').textContent   = morts.length;
  document.getElementById('perso-count').textContent   =
    `${_allPersos.length} personnage${_allPersos.length > 1 ? 's' : ''} · ${vivants.length} en vie`;
}

function pvActuels(p) { return parseInt(p.pv_actuels ?? p.combat?.pv_actuels ?? 0) || 0; }
function pvMax(p)     { return parseInt(p.pv_max     ?? p.combat?.pv_max     ?? 0) || 0; }

function filteredAndSorted() {
  let list = [..._allPersos];

  if (_filtre === 'vivants') list = list.filter(p => pvActuels(p) > 0 || pvMax(p) === 0);
  if (_filtre === 'morts')   list = list.filter(p => pvActuels(p) === 0 && pvMax(p) > 0);

  if (_tri === 'niveau') list.sort((a, b) => (b.niveau || 1) - (a.niveau || 1));
  else if (_tri === 'nom') list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));

  return list;
}

function renderGrid() {
  const grid = document.getElementById('perso-grid');
  const list = filteredAndSorted();

  const createCard = `
    <a href="creer-personnage.html" class="mp-card-create">
      <div class="mp-card-create__plus">+</div>
      <div>
        <div class="mp-card-create__title">Créer un héros</div>
        <div class="mp-card-create__desc">Wizard 13 étapes — espèce, classe, caracs, équipement, historique.</div>
      </div>
    </a>`;

  if (!list.length) {
    grid.innerHTML = createCard + `
      <div class="mp-empty">
        <div class="mp-empty__icon"><i class="fa-solid fa-user-slash"></i></div>
        <div class="mp-empty__title">Aucun personnage ici</div>
        <p class="mp-empty__text">Change les filtres ou crée ton premier héros.</p>
      </div>`;
    return;
  }

  grid.innerHTML = createCard + list.map(p => buildCard(p)).join('');
}

function buildCard(p) {
  const hp    = pvActuels(p);
  const hpMax = pvMax(p);
  const pct   = hpMax > 0 ? Math.min(100, Math.max(0, Math.round(hp / hpMax * 100))) : 100;
  const mort  = hp === 0 && hpMax > 0;
  const color = classColor(p.classe);
  const initial = (p.nom || '?')[0].toUpperCase();
  const niv   = p.niveau || 1;

  const avatarHtml = p.sprite_url
    ? `<img class="mp-card-avatar" src="${esc(p.sprite_url)}" style="border-color:${color}" alt="${esc(p.nom)}">`
    : `<div class="mp-card-avatar" style="background:${color}22;border-color:${color};color:${color}">${initial}</div>`;

  const badgeHtml = mort
    ? `<span class="mp-card-badge mp-card-badge--mort">† DÉCÉDÉ</span>`
    : `<span class="mp-card-badge mp-card-badge--actif">● ACTIF</span>`;

  const hpHtml = !mort ? `
    <div class="mp-hp-header">
      <span class="mp-hp-label">PV</span>
      <span style="color:${hpColor(pct)};font-weight:700">${hp} / ${hpMax}</span>
    </div>
    <div class="mp-hp-bar-bg">
      <div class="mp-hp-bar" style="width:${pct}%;background:${hpColor(pct)}"></div>
    </div>` : '';

  const classeLabel = `<span style="color:${color}">${esc(capitalize(p.classe || '—'))}</span>`;
  const bgLabel = p.background ? ` · ${esc(capitalize(p.background))}` : '';

  return `
    <div class="mp-card ${mort ? 'mp-card--mort' : 'mp-card--active'}" onclick="ouvrirFiche('${p._id}')">
      ${badgeHtml}
      <div class="mp-card-portrait" style="background:radial-gradient(ellipse at 50% 80%,${color}22 0%,transparent 60%)">
        ${avatarHtml}
      </div>
      <div class="mp-card-body">
        <div class="mp-card-meta-top">NIV ${niv} · ${esc((p.alignement || '').toUpperCase())}</div>
        <div class="mp-card-name">${esc(p.nom || '—')}</div>
        <div class="mp-card-sub">${esc(capitalize(p.espece || '—'))} · ${classeLabel}${bgLabel}</div>
        ${hpHtml}
        <div class="mp-card-footer">
          <span>📖 ${esc(p.campagne_nom || '—')}</span>
        </div>
        <div class="mp-card-actions">
          <button class="mp-btn mp-btn--primary" onclick="event.stopPropagation();ouvrirFiche('${p._id}')">
            <i class="fa-solid fa-scroll"></i> Fiche
          </button>
          <button class="mp-btn mp-btn--danger" onclick="event.stopPropagation();supprimer('${p._id}','${esc(p.nom)}')" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function initToolbar() {
  document.querySelectorAll('.mp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _filtre = btn.dataset.filter;
      document.querySelectorAll('.mp-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });

  const sortSel = document.getElementById('mp-sort');
  if (sortSel) {
    sortSel.addEventListener('change', () => {
      _tri = sortSel.value;
      renderGrid();
    });
  }
}

function ouvrirFiche(id) { window.location.href = `fiche-personnage.html?id=${id}`; }
window.ouvrirFiche = ouvrirFiche;

async function supprimer(id, nom) {
  if (!confirm(`Supprimer "${nom}" ?`)) return;
  await fetch(`${API}/Personnages/${id}`, { method: 'DELETE', headers: authH() });
  charger();
}
window.supprimer = supprimer;

waitForAuth(charger);
