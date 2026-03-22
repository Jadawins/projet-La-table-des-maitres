// ═══════════════════════════════════════════════════════════════
//  CREER-PERSONNAGE.JS — Wizard de création D&D 2024
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;

// ─── CONSTANTES ───────────────────────────────────────────────

const XP_PAR_NIVEAU = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
const BONUS_MAITRISE = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

const TOUTES_COMPETENCES = [
  { nom: 'Acrobaties',       car: 'DEX' },
  { nom: 'Arcanes',          car: 'INT' },
  { nom: 'Athlétisme',       car: 'FOR' },
  { nom: 'Discrétion',       car: 'DEX' },
  { nom: 'Dressage',         car: 'SAG' },
  { nom: 'Escamotage',       car: 'DEX' },
  { nom: 'Histoire',         car: 'INT' },
  { nom: 'Intimidation',     car: 'CHA' },
  { nom: 'Investigation',    car: 'INT' },
  { nom: 'Médecine',         car: 'SAG' },
  { nom: 'Nature',           car: 'INT' },
  { nom: 'Perception',       car: 'SAG' },
  { nom: 'Perspicacité',     car: 'SAG' },
  { nom: 'Persuasion',       car: 'CHA' },
  { nom: 'Religion',         car: 'INT' },
  { nom: 'Représentation',   car: 'CHA' },
  { nom: 'Survie',           car: 'SAG' },
  { nom: 'Tromperie',        car: 'CHA' },
];

// Normalise les noms de compétences (accents)
function normalizeComp(s) {
  return String(s).toLowerCase()
    .replace(/é|è|ê|ë/g, 'e')
    .replace(/à|â/g, 'a')
    .replace(/î|ï/g, 'i')
    .replace(/ô/g, 'o')
    .replace(/û|ü/g, 'u')
    .replace(/ç/g, 'c');
}

// ─── ÉTAT DU WIZARD ───────────────────────────────────────────

const W = {
  step: 1,
  totalSteps: 10,
  // Données chargées
  _especes: [], _classes: [], _sousclasses: [], _backgrounds: [],
  _sortsMineurs: [], _sortsNiv1: [],
  // Sélections
  nom: '', alignement: null, niveau: 1, xp: 0,
  espece: null, espece_data: null,
  classe: null, classe_data: null, sous_classe: null, sc_data: null,
  background: null, bg_data: null,
  stats: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAG: 10, CHA: 10 },
  stats_method: null,
  stats_assigned: { FOR: null, DEX: null, CON: null, INT: null, SAG: null, CHA: null },
  competences_choisies: [],
  equipement: [],
  sorts_mineurs: [], sorts_niv1: [],
  traits: '', ideaux: '', liens: '', defauts: '',
  apparence: '', historique_perso: '', notes: ''
};

const STEPS_LABELS = ['Infos', 'Espèce', 'Classe', 'Historique',
  'Stats', 'Compétences', 'Équipement', 'Sorts', 'Traits', 'Récap'];

// ─── UTILITAIRES ──────────────────────────────────────────────

function waitForAuth(cb, t = 0) {
  if (window.SUPABASE_TOKEN) { token = window.SUPABASE_TOKEN; cb(); return; }
  if (t > 40) return;
  setTimeout(() => waitForAuth(cb, t + 1), 100);
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function mod(val) { return Math.floor((val - 10) / 2); }
function fmtMod(v) { return v >= 0 ? `+${v}` : `${v}`; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getDv(classeData) {
  const dv = classeData?._full?.niveaux?.['0']?.de_vie?.type || classeData?.de_vie?.type || 'd8';
  return dv.replace('1d', 'd');
}

function isDvMax(dv) {
  return parseInt(dv.replace('d',''));
}

function isCaster(classeData) {
  return !!(classeData?.incantation);
}

function getCaracIncantation(classeData) {
  return classeData?.caracteristique_incantation || null;
}

function getNombreMineurs(classeId, niveau) {
  const table = {
    barde: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    clerc: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    druide: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    ensorceleur: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
    magicien: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    occultiste: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  };
  return (table[classeId] || [2])[Math.min(niveau-1, 19)];
}

function getNombreNiv1(classeId, niveau) {
  const table = {
    barde: [2,3,4,4,4,4,4,4,4,5,6,6,6,6,6,6,6,6,6,6],
    clerc: [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    druide: [2,3,4,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    ensorceleur: [2,3,4,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6],
    magicien: [6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44],
    occultiste: [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
    paladin: [0,2,3,3,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
    rodeur: [0,0,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  };
  return (table[classeId] || [0])[Math.min(niveau-1, 19)];
}

// ─── BARRE DE PROGRESSION ─────────────────────────────────────

function renderProgress() {
  const bar = document.getElementById('wizard-progress');
  bar.innerHTML = STEPS_LABELS.map((l, i) => {
    const sn = i + 1;
    let cls = sn < W.step ? 'done' : sn === W.step ? 'active' : '';
    const icon = sn < W.step ? '<i class="fa-solid fa-check" style="font-size:0.6rem;"></i>' : sn;
    return `<div class="wizard-step-dot ${cls}">
      <div class="step-circle">${icon}</div>
      <div class="step-label">${l}</div>
    </div>`;
  }).join('');
}

// ─── NAVIGATION ───────────────────────────────────────────────

function showStep(n) {
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  const panel = document.querySelector(`.wizard-panel[data-step="${n}"]`);
  if (panel) panel.classList.add('active');
  W.step = n;
  renderProgress();
  updateNav();
  onStepEnter(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNav() {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  const submit = document.getElementById('btn-submit');
  const info = document.getElementById('nav-info');
  prev.style.visibility = W.step === 1 ? 'hidden' : 'visible';
  if (W.step === W.totalSteps) {
    next.classList.add('hidden');
    submit.classList.remove('hidden');
  } else {
    next.classList.remove('hidden');
    submit.classList.add('hidden');
  }
  // Reset btn-next state (step 5 may have disabled it)
  if (W.step !== 5) {
    next.disabled = false;
    next.style.opacity = '';
    next.style.cursor = '';
  }
  info.textContent = `Étape ${W.step} sur ${W.totalSteps}`;
}

function nextStep() {
  if (!validateStep(W.step)) return;
  collectStep(W.step);
  if (W.step === W.totalSteps - 1) buildRecap();
  if (W.step < W.totalSteps) showStep(W.step + 1);
}

function prevStep() {
  collectStep(W.step);
  if (W.step > 1) showStep(W.step - 1);
}

function validateStep(n) {
  if (n === 1) {
    const nom = document.getElementById('p-nom').value.trim();
    if (!nom) { alert('Le nom du personnage est obligatoire.'); document.getElementById('p-nom').focus(); return false; }
  }
  if (n === 2 && !W.espece) { alert('Sélectionnez une espèce.'); return false; }
  if (n === 3 && !W.classe) { alert('Sélectionnez une classe.'); return false; }
  if (n === 4 && !W.background) { alert('Sélectionnez un historique.'); return false; }
  if (n === 5) {
    if (!W.stats_method) { alert('Choisissez une méthode d\'attribution des caractéristiques.'); return false; }
    if (W.stats_method === 'standard') {
      const allAssigned = ['FOR','DEX','CON','INT','SAG','CHA'].every(k => W.stats_assigned[k] !== null);
      if (!allAssigned) { alert('Distribuez toutes les valeurs standard avant de continuer.'); return false; }
    }
  }
  return true;
}

function collectStep(n) {
  if (n === 1) {
    W.nom = document.getElementById('p-nom').value.trim();
    W.niveau = parseInt(document.getElementById('p-niveau').value) || 1;
    W.xp = XP_PAR_NIVEAU[W.niveau - 1] || 0;
  }
  if (n === 5) {
    if (W.stats_method === 'dice') {
      ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
        W.stats[k] = parseInt(document.getElementById(`stat-${k}`).value) || 10;
      });
    } else if (W.stats_method === 'standard') {
      ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
        if (W.stats_assigned[k] !== null) W.stats[k] = W.stats_assigned[k];
      });
    }
  }
  if (n === 6) {
    W.competences_choisies = [...document.querySelectorAll('.comp-check:checked')].map(el => el.dataset.nom);
  }
  if (n === 7) {
    W.equipement = [...document.querySelectorAll('.equip-check:checked')].map(el => ({
      nom: el.dataset.nom, quantite: parseInt(el.dataset.qte) || 1
    }));
  }
  if (n === 8) {
    W.sorts_mineurs = [...document.querySelectorAll('.sort-check-mineur:checked')].map(el => el.dataset.id);
    W.sorts_niv1 = [...document.querySelectorAll('.sort-check-niv1:checked')].map(el => el.dataset.id);
  }
  if (n === 9) {
    W.traits = document.getElementById('p-traits').value.trim();
    W.ideaux = document.getElementById('p-ideaux').value.trim();
    W.liens = document.getElementById('p-liens').value.trim();
    W.defauts = document.getElementById('p-defauts').value.trim();
    W.apparence = document.getElementById('p-apparence').value.trim();
    W.historique_perso = document.getElementById('p-historique').value.trim();
    W.notes = document.getElementById('p-notes').value.trim();
  }
}

// ─── ENTRÉE DANS UNE ÉTAPE ────────────────────────────────────

async function onStepEnter(n) {
  if (n === 2) await loadEspeces();
  if (n === 3) await loadClasses();
  if (n === 4) await loadBackgrounds();
  if (n === 5) initStatsStep();
  if (n === 6) renderCompetences();
  if (n === 7) renderEquipement();
  if (n === 8) await loadSorts();
  if (n === 9) renderTraitsSuggestions();
}

// ─── ÉTAPE 1 — Alignement & Niveau ───────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Alignement
  document.getElementById('alignement-grid').addEventListener('click', e => {
    const btn = e.target.closest('.align-btn');
    if (!btn) return;
    document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    W.alignement = btn.dataset.align;
  });

  // Niveau → XP + maîtrise
  document.getElementById('p-niveau').addEventListener('input', function() {
    const niv = parseInt(this.value) || 1;
    document.getElementById('p-xp').value = XP_PAR_NIVEAU[Math.min(niv-1,19)] || 0;
    document.getElementById('p-maitrise').value = '+' + (BONUS_MAITRISE[Math.min(niv-1,19)] || 2);
  });

  // Stats → modificateurs
  ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
    document.getElementById(`stat-${k}`).addEventListener('input', function() {
      const v = parseInt(this.value) || 10;
      W.stats[k] = v;
      document.getElementById(`mod-${k}`).textContent = fmtMod(mod(v));
    });
  });

  renderProgress();
  updateNav();
});

// ─── ÉTAPE 2 — Espèces ────────────────────────────────────────

async function loadEspeces() {
  if (W._especes.length) { renderEspecesGrid(); return; }
  try {
    const r = await fetch(`${API}/GetEspeces2024`);
    W._especes = await r.json();
    renderEspecesGrid();
  } catch { document.getElementById('especes-grid').innerHTML = '<p style="color:#f00">Erreur de chargement</p>'; }
}

function renderEspecesGrid() {
  const grid = document.getElementById('especes-grid');
  grid.innerHTML = W._especes.map(e => `
    <div class="select-card ${W.espece === e.id ? 'selected' : ''}" onclick="selectEspece('${e.id}')">
      <div class="card-name">${esc(e.nom)}</div>
      <div class="card-sub">
        <span class="card-tag">Vitesse ${e.vitesse || 9}m</span>
        ${(e.resistances||[]).map(r => `<span class="card-tag">${esc(r)}</span>`).join('')}
      </div>
      <div style="font-size:0.72rem;color:#888;line-height:1.4;margin-top:0.3rem;">${esc((e.description||'').slice(0,80))}…</div>
    </div>`).join('');
}

function selectEspece(id) {
  W.espece = id;
  W.espece_data = W._especes.find(e => e.id === id);
  renderEspecesGrid();
  const d = document.getElementById('espece-detail');
  const e = W.espece_data;
  d.classList.add('visible');
  d.innerHTML = `
    <h3>${esc(e.nom)} <small style="font-size:0.7rem;color:#888;">Vitesse ${e.vitesse||9}m · Taille ${e.taille?.categorie||'M'}</small></h3>
    <div class="trait-list">
      ${(e.traits||[]).map(t => `
        <div class="trait-item">
          <div class="trait-item-name">${esc(t.nom)}</div>
          <div class="trait-item-desc">${esc(t.description)}</div>
        </div>`).join('')}
    </div>
    ${(e.sorts_innes||[]).length ? `<div style="margin-top:0.6rem;font-size:0.78rem;color:#a090e0;">Sorts innés : ${e.sorts_innes.join(', ')}</div>` : ''}`;
}

// ─── ÉTAPE 3 — Classes ────────────────────────────────────────

async function loadClasses() {
  if (W._classes.length) { renderClassesGrid(); return; }
  try {
    const r = await fetch(`${API}/GetClasses2024`);
    W._classes = await r.json();
    renderClassesGrid();
  } catch (err) {
    document.getElementById('classes-grid').innerHTML = '<p style="color:#f00">Erreur de chargement des classes</p>';
  }
}

function renderClassesGrid() {
  const grid = document.getElementById('classes-grid');
  grid.innerHTML = W._classes.map(c => {
    const dv = c.de_vie?.type || 'd8';
    const car = [].concat(c.caracteristique_principale||[]).join('/');
    return `
    <div class="select-card ${W.classe === c.id ? 'selected' : ''}" onclick="selectClasse('${c.id}')">
      <div class="card-name">${esc(c.nom)}</div>
      <div class="card-sub">
        <span class="card-tag">${esc(dv)}</span>
        <span class="card-tag">${esc(car)}</span>
        ${isCaster(c) ? '<span class="card-tag" style="background:rgba(100,50,180,0.2);color:#b090ff;border-color:rgba(100,50,180,0.4);">Incantation</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

async function selectClasse(id) {
  W.classe = id;
  W.classe_data = W._classes.find(c => c.id === id);
  W.sous_classe = null; W.sc_data = null;
  renderClassesGrid();

  // Détail de la classe
  const d = document.getElementById('classe-detail');
  const c = W.classe_data;
  const dv = c.de_vie?.type || 'd8';
  const sauves = (c.sauvegardes_maitrise||[]).join(', ');
  const nbComp = c.competences_choisies?.nombre || 2;
  d.classList.add('visible');
  d.innerHTML = `
    <h3>${esc(c.nom)} — Niveau ${W.niveau || 1}</h3>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;font-size:0.78rem;color:#aaa;margin-bottom:0.6rem;">
      <span><i class="fa-solid fa-dice"></i> Dé de vie : ${esc(dv)}</span>
      <span><i class="fa-solid fa-shield"></i> Sauvegardes : ${esc(sauves)}</span>
      <span><i class="fa-solid fa-list-check"></i> ${nbComp} compétences au choix</span>
    </div>`;

  // Sous-classes si niveau ≥ 3
  const scSection = document.getElementById('sousclasse-section');
  if ((W.niveau || 1) >= 3) {
    scSection.style.display = 'block';
    await loadSousClasses(id);
  } else {
    scSection.style.display = 'none';
  }
}

async function loadSousClasses(classeId) {
  if (!W._sousclasses.length) {
    try {
      const r = await fetch(`${API}/GetSousClasses2024`);
      W._sousclasses = await r.json();
    } catch { return; }
  }
  const filtered = W._sousclasses.filter(sc => sc.classe_parente === classeId);
  const grid = document.getElementById('sousclasses-grid');
  grid.innerHTML = filtered.map(sc => `
    <div class="select-card ${W.sous_classe === sc.id ? 'selected' : ''}" onclick="selectSousClasse('${sc.id}')">
      <div class="card-name">${esc(sc.nom)}</div>
    </div>`).join('');
}

function selectSousClasse(id) {
  W.sous_classe = id;
  W.sc_data = W._sousclasses.find(s => s.id === id);
  document.querySelectorAll('#sousclasses-grid .select-card').forEach(el => el.classList.remove('selected'));
  document.querySelector(`#sousclasses-grid .select-card[onclick*="${id}"]`)?.classList.add('selected');
}

// ─── ÉTAPE 4 — Backgrounds ────────────────────────────────────

async function loadBackgrounds() {
  if (W._backgrounds.length) { renderBgGrid(); return; }
  try {
    const r = await fetch(`${API}/GetBackgrounds2024`);
    W._backgrounds = await r.json();
    renderBgGrid();
  } catch {}
}

function renderBgGrid() {
  const grid = document.getElementById('backgrounds-grid');
  grid.innerHTML = W._backgrounds.map(b => `
    <div class="select-card ${W.background === b.id ? 'selected' : ''}" onclick="selectBackground('${b.id}')">
      <div class="card-name">${esc(b.nom)}</div>
      <div class="card-sub">
        ${(b.competences||[]).map(c => `<span class="card-tag">${esc(c)}</span>`).join('')}
        ${b.don ? `<span class="card-tag" style="background:rgba(201,168,76,0.1);color:#c9a84c;border-color:rgba(201,168,76,0.3);">Don</span>` : ''}
      </div>
    </div>`).join('');
}

function selectBackground(id) {
  W.background = id;
  W.bg_data = W._backgrounds.find(b => b.id === id);
  renderBgGrid();
  const d = document.getElementById('background-detail');
  const b = W.bg_data;
  d.classList.add('visible');
  d.innerHTML = `
    <h3>${esc(b.nom)}</h3>
    <p style="font-size:0.8rem;color:#999;margin-bottom:0.75rem;">${esc(b.description||'')}</p>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.78rem;color:#aaa;">
      ${(b.competences||[]).length ? `<div><strong style="color:#c8b8ff;">Compétences :</strong> ${b.competences.join(', ')}</div>` : ''}
      ${(b.outils||[]).length ? `<div><strong style="color:#c8b8ff;">Outils :</strong> ${b.outils.join(', ')}</div>` : ''}
      ${b.don ? `<div><strong style="color:#c9a84c;">Don :</strong> ${esc(b.don)}</div>` : ''}
    </div>
    ${b.aptitude ? `<div class="trait-item" style="margin-top:0.6rem;">
      <div class="trait-item-name">${esc(b.aptitude.nom)}</div>
      <div class="trait-item-desc">${esc(b.aptitude.description)}</div>
    </div>` : ''}`;
}

// ─── ÉTAPE 5 — Caractéristiques ───────────────────────────────

const STANDARD_VALUES = [15, 14, 13, 12, 10, 8];
const STAT_KEYS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];
let _dragData = null, _dragClone = null, _dragStartX = 0, _dragStartY = 0;

function initStatsStep() {
  if (W.stats_method) selectStatsMethod(W.stats_method);
  updateNextBtn();
}

function selectStatsMethod(method) {
  W.stats_method = method;
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById('method-' + method);
  if (card) card.classList.add('selected');
  const stdEl = document.getElementById('stats-method-standard');
  const diceEl = document.getElementById('stats-method-dice');
  if (stdEl) stdEl.style.display = method === 'standard' ? 'block' : 'none';
  if (diceEl) diceEl.style.display = method === 'dice' ? 'block' : 'none';
  if (method === 'standard') renderStatsDnD();
  updateNextBtn();
}

function getRemainingPool() {
  const assigned = Object.values(W.stats_assigned).filter(v => v !== null);
  const remaining = [...STANDARD_VALUES];
  assigned.forEach(v => { const i = remaining.indexOf(v); if (i >= 0) remaining.splice(i, 1); });
  return remaining;
}

function renderStatsDnD() {
  const pool = getRemainingPool();
  const poolEl = document.getElementById('stat-pool');
  if (!poolEl) return;
  poolEl.innerHTML = pool.map(v =>
    `<div class="stat-badge" data-value="${v}" data-from="pool">${v}</div>`
  ).join('');

  const gridEl = document.getElementById('stats-grid-dnd');
  if (!gridEl) return;
  gridEl.innerHTML = STAT_KEYS.map(k => {
    const val = W.stats_assigned[k];
    const modVal = val !== null ? fmtMod(mod(val)) : '';
    return `<div class="stat-drop-box${val !== null ? ' filled' : ''}" data-stat="${k}">
      <div class="stat-name">${k}</div>
      <div class="drop-value">${val !== null ? `<span class="stat-badge-sm" data-value="${val}" data-from="${k}">${val}</span>` : ''}</div>
      <div class="drop-modifier">${modVal}</div>
    </div>`;
  }).join('');

  setupStatsDnD();
}

function setupStatsDnD() {
  document.querySelectorAll('#stat-pool .stat-badge, #stats-grid-dnd .stat-badge-sm').forEach(el => {
    el.addEventListener('pointerdown', onStatPointerDown);
  });
}

function onStatPointerDown(e) {
  e.preventDefault();
  const el = e.currentTarget;
  _dragData = { value: parseInt(el.dataset.value), from: el.dataset.from };
  _dragStartX = e.clientX;
  _dragStartY = e.clientY;
  _dragClone = null;
  document.addEventListener('pointermove', onStatPointerMove);
  document.addEventListener('pointerup', onStatPointerUp);
}

function onStatPointerMove(e) {
  const dist = Math.hypot(e.clientX - _dragStartX, e.clientY - _dragStartY);
  if (dist > 5 && !_dragClone) {
    _dragClone = document.createElement('div');
    _dragClone.className = 'stat-badge drag-clone';
    _dragClone.textContent = _dragData.value;
    document.body.appendChild(_dragClone);
  }
  if (_dragClone) {
    _dragClone.style.left = (e.clientX - 22) + 'px';
    _dragClone.style.top = (e.clientY - 22) + 'px';
    document.querySelectorAll('.stat-drop-box').forEach(z => {
      const r = z.getBoundingClientRect();
      const over = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      z.classList.toggle('drag-over', over);
    });
  }
}

function onStatPointerUp(e) {
  document.removeEventListener('pointermove', onStatPointerMove);
  document.removeEventListener('pointerup', onStatPointerUp);
  if (_dragClone) { _dragClone.remove(); _dragClone = null; }
  document.querySelectorAll('.stat-drop-box').forEach(z => z.classList.remove('drag-over'));
  if (!_dragData) return;

  const dist = Math.hypot(e.clientX - _dragStartX, e.clientY - _dragStartY);
  if (dist < 5) {
    // Click : si valeur dans une zone, la retirer
    if (_dragData.from !== 'pool') {
      W.stats_assigned[_dragData.from] = null;
      renderStatsDnD();
      updateNextBtn();
    }
  } else {
    // Drag : déposer sur une zone
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.stat-drop-box');
    if (target) {
      const toStat = target.dataset.stat;
      if (toStat !== _dragData.from) {
        const existing = W.stats_assigned[toStat];
        W.stats_assigned[toStat] = _dragData.value;
        if (_dragData.from !== 'pool') {
          W.stats_assigned[_dragData.from] = existing; // swap
        }
        renderStatsDnD();
        updateNextBtn();
      }
    }
  }
  _dragData = null;
}

function updateNextBtn() {
  if (W.step !== 5) return;
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  if (W.stats_method === 'standard') {
    const allAssigned = STAT_KEYS.every(k => W.stats_assigned[k] !== null);
    btn.disabled = !allAssigned;
    btn.style.opacity = allAssigned ? '' : '0.4';
    btn.style.cursor = allAssigned ? '' : 'not-allowed';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}

// ─── ÉTAPE 6 — Compétences ────────────────────────────────────

function renderCompetences() {
  const classe = W.classe_data;
  const bg = W.bg_data;
  const bm = BONUS_MAITRISE[Math.min(W.niveau-1,19)];
  const nbChoix = classe?.competences_choisies?.nombre || 2;
  const optionsClasse = (classe?.competences_choisies?.options || []).map(normalizeComp);
  const bgComps = (bg?.competences || []).map(normalizeComp);
  const choisies = W.competences_choisies.map(normalizeComp);

  document.getElementById('comp-counter').textContent =
    `Choisissez ${nbChoix} compétences parmi celles de votre classe (en blanc). Les compétences de votre historique sont automatiquement acquises (en vert).`;

  const grid = document.getElementById('competences-grid');
  grid.innerHTML = TOUTES_COMPETENCES.map(comp => {
    const nc = normalizeComp(comp.nom);
    const inBg = bgComps.includes(nc);
    const inClasse = optionsClasse.includes(nc);
    const isChecked = inBg || choisies.includes(nc);
    const mod_val = fmtMod(mod(W.stats[comp.car] || 10) + (isChecked ? bm : 0));
    const disabled = inBg || (!inClasse && !isChecked);
    return `
    <div class="comp-row">
      <input type="checkbox" class="comp-check" data-nom="${comp.nom}"
             ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
             onchange="updateCompCounter(${nbChoix})" />
      <span class="comp-label ${inClasse ? 'from-class' : inBg ? 'from-bg' : ''}">${comp.nom}</span>
      <span class="comp-char">${comp.car}</span>
      <span class="comp-bonus">${mod_val}</span>
    </div>`;
  }).join('');
  updateCompCounter(nbChoix);
}

function updateCompCounter(max) {
  const classe = W.classe_data;
  const bg = W.bg_data;
  const bgComps = (bg?.competences || []).map(normalizeComp);
  const boxes = [...document.querySelectorAll('.comp-check:not(:disabled)')];
  const checked = boxes.filter(b => b.checked).length;
  if (checked >= max) {
    boxes.filter(b => !b.checked).forEach(b => b.disabled = true);
  } else {
    const optionsClasse = (classe?.competences_choisies?.options || []).map(normalizeComp);
    boxes.forEach(b => {
      if (!bgComps.includes(normalizeComp(b.dataset.nom)))
        b.disabled = !optionsClasse.includes(normalizeComp(b.dataset.nom));
    });
  }
}

// ─── ÉTAPE 7 — Équipement ─────────────────────────────────────

function renderEquipement() {
  const list = document.getElementById('equip-list');
  const classeEquip = W.classe_data?.equipement_depart || [];
  const bgEquip = W.bg_data?.equipement || [];
  const items = [];

  // Équipement de la classe (premier choix A)
  const choixA = classeEquip.find(c => c.choix === 'A');
  if (choixA) {
    (choixA.contenu || []).forEach(nom => {
      items.push({ nom, qte: 1, source: 'classe' });
    });
  }
  // Équipement du background
  bgEquip.forEach(e => {
    items.push({ nom: e.nom, qte: e.quantite || 1, source: 'bg' });
  });

  const checkedNoms = W.equipement.map(e => e.nom);
  list.innerHTML = items.map((it, i) => `
    <div class="equip-row">
      <input type="checkbox" class="equip-check" data-nom="${esc(it.nom)}" data-qte="${it.qte}"
             ${checkedNoms.includes(it.nom) || checkedNoms.length === 0 ? 'checked' : ''} />
      <span class="equip-nom">${esc(it.nom)}</span>
      <span class="equip-qte">×${it.qte}</span>
      <span class="equip-source ${it.source}">${it.source === 'classe' ? 'Classe' : 'Historique'}</span>
    </div>`).join('');

  // Items déjà ajoutés manuellement
  W.equipement.filter(e => !items.some(i => i.nom === e.nom)).forEach(e => {
    const row = document.createElement('div');
    row.className = 'equip-row';
    row.innerHTML = `
      <input type="checkbox" class="equip-check" data-nom="${esc(e.nom)}" data-qte="${e.quantite||1}" checked />
      <span class="equip-nom">${esc(e.nom)}</span>
      <span class="equip-qte">×${e.quantite||1}</span>
      <span class="equip-source" style="color:#888;">Manuel</span>`;
    list.appendChild(row);
  });
}

function ajouterEquipCustom() {
  const nomEl = document.getElementById('equip-custom-nom');
  const qteEl = document.getElementById('equip-custom-qte');
  const nom = nomEl.value.trim();
  if (!nom) return;
  const qte = parseInt(qteEl.value) || 1;
  const list = document.getElementById('equip-list');
  const row = document.createElement('div');
  row.className = 'equip-row';
  row.innerHTML = `
    <input type="checkbox" class="equip-check" data-nom="${esc(nom)}" data-qte="${qte}" checked />
    <span class="equip-nom">${esc(nom)}</span>
    <span class="equip-qte">×${qte}</span>
    <span class="equip-source" style="color:#888;">Manuel</span>`;
  list.appendChild(row);
  nomEl.value = '';
  qteEl.value = '1';
}

// ─── ÉTAPE 8 — Sorts ──────────────────────────────────────────

async function loadSorts() {
  const section = document.getElementById('sorts-section');
  const nonLanceur = document.getElementById('sorts-non-lanceur');

  if (!isCaster(W.classe_data)) {
    section.style.display = 'none';
    nonLanceur.style.display = 'block';
    return;
  }
  section.style.display = 'block';
  nonLanceur.style.display = 'none';

  const nomClasse = W.classe_data?.nom || '';
  const nbMin = getNombreMineurs(W.classe, W.niveau);
  const nbNiv1 = getNombreNiv1(W.classe, W.niveau);
  document.getElementById('sorts-subtitle').textContent =
    `${nomClasse} niveau ${W.niveau} : choisissez ${nbMin} sort(s) mineur(s) et ${nbNiv1} sort(s) de niveau 1.`;

  if (!W._sortsMineurs.length) {
    try {
      const [r0, r1] = await Promise.all([
        fetch(`${API}/GetSorts2024?niveau=0`),
        fetch(`${API}/GetSorts2024?niveau=1`)
      ]);
      W._sortsMineurs = await r0.json();
      W._sortsNiv1 = await r1.json();
    } catch {}
  }

  const filtreClasse = nomClasse;
  const mineurs = W._sortsMineurs.filter(s => (s.classes||[]).some(c => c.toLowerCase() === filtreClasse.toLowerCase()));
  const niv1 = W._sortsNiv1.filter(s => (s.classes||[]).some(c => c.toLowerCase() === filtreClasse.toLowerCase()));

  // Écoles uniques
  const ecolesMin = [...new Set(mineurs.map(s => s.ecole))].sort();
  const ecolesNiv1 = [...new Set(niv1.map(s => s.ecole))].sort();
  document.getElementById('ecole-mineurs').innerHTML = `<option value="">Toutes</option>` + ecolesMin.map(e => `<option>${esc(e)}</option>`).join('');
  document.getElementById('ecole-niv1').innerHTML = `<option value="">Toutes</option>` + ecolesNiv1.map(e => `<option>${esc(e)}</option>`).join('');

  updateSortsCounter('mineurs', nbMin);
  updateSortsCounter('niv1', nbNiv1);

  renderSortsList('mineurs', mineurs, nbMin);
  renderSortsList('niv1', niv1, nbNiv1);
}

function renderSortsList(type, sorts, max, rechercheVal = '', ecoleVal = '') {
  const listEl = document.getElementById(`sorts-${type}-list`);
  const filtres = sorts.filter(s => {
    if (rechercheVal && !s.nom.toLowerCase().includes(rechercheVal.toLowerCase())) return false;
    if (ecoleVal && s.ecole !== ecoleVal) return false;
    return true;
  });
  const selKey = type === 'mineurs' ? 'sorts_mineurs' : 'sorts_niv1';
  const checkClass = type === 'mineurs' ? 'sort-check-mineur' : 'sort-check-niv1';
  listEl.innerHTML = filtres.map(s => `
    <div class="sort-row ${W[selKey].includes(s.id) ? 'selected' : ''}" onclick="toggleSort('${s.id}','${type}',${max})">
      <input type="checkbox" class="${checkClass}" data-id="${s.id}"
             ${W[selKey].includes(s.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleSort('${s.id}','${type}',${max})" />
      <span class="sort-nom">${esc(s.nom)}</span>
      <span class="sort-ecole">${esc(s.ecole)}</span>
      ${s.concentration ? '<span class="sort-conc">Conc.</span>' : ''}
    </div>`).join('') || '<div style="color:#555;padding:0.5rem;font-size:0.8rem;">Aucun sort trouvé.</div>';
}

function filtrerSorts(type) {
  const rechercheEl = document.getElementById(`search-${type}`);
  const ecoleEl = document.getElementById(`ecole-${type}`);
  const nomClasse = W.classe_data?.nom || '';
  const pool = type === 'mineurs' ? W._sortsMineurs : W._sortsNiv1;
  const sorts = pool.filter(s => (s.classes||[]).some(c => c.toLowerCase() === nomClasse.toLowerCase()));
  const max = type === 'mineurs' ? getNombreMineurs(W.classe, W.niveau) : getNombreNiv1(W.classe, W.niveau);
  renderSortsList(type, sorts, max, rechercheEl?.value || '', ecoleEl?.value || '');
}

function toggleSort(id, type, max) {
  const selKey = type === 'mineurs' ? 'sorts_mineurs' : 'sorts_niv1';
  const idx = W[selKey].indexOf(id);
  if (idx >= 0) {
    W[selKey].splice(idx, 1);
  } else {
    if (W[selKey].length >= max) return;
    W[selKey].push(id);
  }
  updateSortsCounter(type, max);
  filtrerSorts(type);
}

function updateSortsCounter(type, max) {
  const selKey = type === 'mineurs' ? 'sorts_mineurs' : 'sorts_niv1';
  const count = W[selKey].length;
  const label = type === 'mineurs' ? 'sort(s) mineur(s)' : 'sort(s) de niveau 1';
  const el = document.getElementById(`sorts-${type}-counter`);
  if (!el) return;
  const done = count >= max;
  el.innerHTML = `<span class="sorts-counter-badge${done ? ' done' : ''}">${count} / ${max}</span> ${label} choisi${count > 1 ? 's' : ''}`;
}

// ─── ÉTAPE 9 — Traits & Suggestions ──────────────────────────

function renderTraitsSuggestions() {
  const bg = W.bg_data;
  if (!bg?.caracteristiques_suggerees) { document.getElementById('suggestions-section').style.display = 'none'; return; }
  const s = bg.caracteristiques_suggerees;
  const section = document.getElementById('suggestions-section');
  section.style.display = 'block';
  document.getElementById('suggestions-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
      ${['traits','ideaux','liens','defauts'].map(k => {
        const items = s[k] || [];
        if (!items.length) return '';
        return `<div style="background:rgba(255,255,255,0.02);border-radius:6px;padding:0.5rem 0.7rem;">
          <div style="font-size:0.65rem;color:#c9a84c;text-transform:uppercase;margin-bottom:0.3rem;">${k}</div>
          ${items.slice(0,2).map(t => `<div style="font-size:0.73rem;color:#999;padding:0.15rem 0;cursor:pointer;"
            onclick="copierSuggestion('${k}','${esc(t.replace(/'/g,'\\\''))}')">${esc(t)}</div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
}

function copierSuggestion(champ, texte) {
  const map = { traits: 'p-traits', ideaux: 'p-ideaux', liens: 'p-liens', defauts: 'p-defauts' };
  const el = document.getElementById(map[champ]);
  if (el) el.value = el.value ? el.value + '\n' + texte : texte;
}

// ─── ÉTAPE 10 — Récapitulatif ─────────────────────────────────

function buildRecap() {
  collectStep(9);
  const niv = W.niveau;
  const bm = BONUS_MAITRISE[Math.min(niv-1,19)];
  const conMod = mod(W.stats.CON);
  const dexMod = mod(W.stats.DEX);
  const dvMax = isDvMax(getDv(W.classe_data));
  const pvMax = dvMax + conMod * niv;
  const ca = 10 + dexMod;
  const init = dexMod;

  // Jets de sauvegarde
  const saves = W.classe_data?.sauvegardes_maitrise || [];
  const savesHtml = ['FOR','DEX','CON','INT','SAG','CHA'].map(k => {
    const hasMaitrise = saves.map(s => s.toUpperCase()).includes(k);
    const val = mod(W.stats[k]) + (hasMaitrise ? bm : 0);
    return `<div class="recap-row"><span class="recap-label">${k}</span><span class="recap-val">${fmtMod(val)} ${hasMaitrise?'✓':''}</span></div>`;
  }).join('');

  // Compétences choisies
  const allComps = [...(W.bg_data?.competences||[]), ...W.competences_choisies];
  const compsHtml = TOUTES_COMPETENCES
    .filter(c => allComps.some(ac => normalizeComp(ac) === normalizeComp(c.nom)))
    .map(c => {
      const val = mod(W.stats[c.car]) + bm;
      return `<div class="recap-row"><span class="recap-label">${c.nom}</span><span class="recap-val">${fmtMod(val)}</span></div>`;
    }).join('');

  const rc = document.getElementById('recap-content');
  rc.innerHTML = `
  <div class="recap-grid">
    <div class="recap-block">
      <h3><i class="fa-solid fa-user"></i> Identité</h3>
      <div class="recap-row"><span class="recap-label">Nom</span><span class="recap-val">${esc(W.nom)}</span></div>
      <div class="recap-row"><span class="recap-label">Niveau</span><span class="recap-val">${niv}</span></div>
      <div class="recap-row"><span class="recap-label">Espèce</span><span class="recap-val">${esc(W.espece_data?.nom||W.espece)}</span></div>
      <div class="recap-row"><span class="recap-label">Classe</span><span class="recap-val">${esc(W.classe_data?.nom||W.classe)}${W.sc_data?` / ${esc(W.sc_data.nom)}`:''}</span></div>
      <div class="recap-row"><span class="recap-label">Historique</span><span class="recap-val">${esc(W.bg_data?.nom||W.background)}</span></div>
      <div class="recap-row"><span class="recap-label">Alignement</span><span class="recap-val">${esc((W.alignement||'—').replace(/_/g,' '))}</span></div>
      <div class="recap-row"><span class="recap-label">Bonus maîtrise</span><span class="recap-val">+${bm}</span></div>
    </div>

    <div class="recap-block">
      <h3><i class="fa-solid fa-fist-raised"></i> Caractéristiques</h3>
      ${['FOR','DEX','CON','INT','SAG','CHA'].map(k =>
        `<div class="recap-row"><span class="recap-label">${k}</span><span class="recap-val">${W.stats[k]} (${fmtMod(mod(W.stats[k]))})</span></div>`
      ).join('')}
    </div>

    <div class="recap-block">
      <h3><i class="fa-solid fa-heart"></i> Combat</h3>
      <div class="recap-row"><span class="recap-label">PV max</span><span class="recap-val">${pvMax}</span></div>
      <div class="recap-row"><span class="recap-label">CA de base</span><span class="recap-val">${ca}</span></div>
      <div class="recap-row"><span class="recap-label">Initiative</span><span class="recap-val">${fmtMod(init)}</span></div>
      <div class="recap-row"><span class="recap-label">Dé de vie</span><span class="recap-val">${niv}${getDv(W.classe_data)}</span></div>
      <div class="recap-row"><span class="recap-label">Vitesse</span><span class="recap-val">${W.espece_data?.vitesse||9}m</span></div>
    </div>

    <div class="recap-block">
      <h3><i class="fa-solid fa-shield"></i> Jets de sauvegarde</h3>
      ${savesHtml}
    </div>

    <div class="recap-block" style="grid-column:1/-1;">
      <h3><i class="fa-solid fa-list-check"></i> Compétences maîtrisées</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;">
        ${compsHtml}
      </div>
    </div>

    ${W.equipement.length ? `
    <div class="recap-block">
      <h3><i class="fa-solid fa-backpack"></i> Équipement</h3>
      ${W.equipement.map(e => `<div class="recap-row"><span class="recap-label">${esc(e.nom)}</span><span class="recap-val">×${e.quantite||1}</span></div>`).join('')}
    </div>` : ''}

    ${(W.sorts_mineurs.length || W.sorts_niv1.length) ? `
    <div class="recap-block">
      <h3><i class="fa-solid fa-hat-wizard"></i> Sorts</h3>
      ${W.sorts_mineurs.map(id => { const s = W._sortsMineurs.find(x => x.id===id); return `<div class="recap-row"><span class="recap-label">Mineur</span><span class="recap-val">${esc(s?.nom||id)}</span></div>`; }).join('')}
      ${W.sorts_niv1.map(id => { const s = W._sortsNiv1.find(x => x.id===id); return `<div class="recap-row"><span class="recap-label">Niv. 1</span><span class="recap-val">${esc(s?.nom||id)}</span></div>`; }).join('')}
    </div>` : ''}
  </div>`;
}

// ─── SOUMISSION ───────────────────────────────────────────────

async function creerPersonnage() {
  collectStep(W.step);
  const niv = W.niveau;
  const bm = BONUS_MAITRISE[Math.min(niv-1,19)];
  const stats = W.stats;
  const saves = (W.classe_data?.sauvegardes_maitrise || []).map(s => s.toUpperCase());

  const caracteristiques = {};
  ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
    caracteristiques[k] = { valeur: stats[k], modificateur: mod(stats[k]) };
  });

  const jets_sauvegarde = {};
  ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
    const hasMaitrise = saves.includes(k);
    jets_sauvegarde[k] = { maitrise: hasMaitrise, valeur: mod(stats[k]) + (hasMaitrise ? bm : 0) };
  });

  const allComps = [...new Set([...(W.bg_data?.competences||[]), ...W.competences_choisies])];
  const competences = TOUTES_COMPETENCES.filter(c =>
    allComps.some(ac => normalizeComp(ac) === normalizeComp(c.nom))
  ).map(c => ({
    nom: c.nom, caracteristique: c.car, maitrise: true, expertise: false,
    valeur: mod(stats[c.car]) + bm
  }));

  const dvMax = isDvMax(getDv(W.classe_data));
  const pvMax = dvMax + mod(stats.CON) * niv;
  const ca = 10 + mod(stats.DEX);

  // Sorts
  const sortsMineurs = W._sortsMineurs.filter(s => W.sorts_mineurs.includes(s.id)).map(s => ({ id: s.id, nom: s.nom, niveau: 0 }));
  const sortsNiv1 = W._sortsNiv1.filter(s => W.sorts_niv1.includes(s.id)).map(s => ({ id: s.id, nom: s.nom, niveau: 1 }));
  const carIncant = getCaracIncantation(W.classe_data);

  const corps = {
    nom: W.nom,
    niveau: niv,
    experience: W.xp,
    espece: W.espece,
    classe: W.classe,
    sous_classe: W.sous_classe,
    background: W.background,
    alignement: W.alignement,
    caracteristiques,
    bonus_maitrise: bm,
    combat: {
      pv_max: pvMax, pv_actuels: pvMax, pv_temporaires: 0,
      ca, initiative: mod(stats.DEX), vitesse: W.espece_data?.vitesse || 9,
      des_vie: { total: niv, restants: niv, type: getDv(W.classe_data) }
    },
    jets_sauvegarde,
    competences,
    attaques: [],
    sorts: {
      caracteristique_incantation: carIncant,
      dd_sorts: carIncant ? (8 + bm + mod(stats[carIncant])) : null,
      bonus_attaque_sort: carIncant ? (bm + mod(stats[carIncant])) : null,
      emplacements: [],
      sorts_connus: [...sortsMineurs, ...sortsNiv1]
    },
    equipement: W.equipement,
    monnaie: { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 },
    traits: {
      traits_personnalite: W.traits ? [W.traits] : [],
      ideaux: W.ideaux ? [W.ideaux] : [],
      liens: W.liens ? [W.liens] : [],
      defauts: W.defauts ? [W.defauts] : []
    },
    langues: (W.espece_data?.langues || ['commun']),
    maitrise_armes: W.classe_data?.maitrises_armes || [],
    maitrise_armures: W.classe_data?.maitrises_armures || [],
    notes: W.notes,
    apparence: W.apparence,
    historique_perso: W.historique_perso
  };

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Création…';

  try {
    const res = await fetch(`${API}/Personnages`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(corps)
    });
    const data = await res.json();
    if (data._id) {
      window.location.href = `fiche-personnage.html?id=${data._id}`;
    } else {
      alert('Erreur : ' + (data.error || 'inconnue'));
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Créer le personnage !';
    }
  } catch (e) {
    alert('Erreur réseau : ' + e.message);
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Créer le personnage !';
  }
}

// ─── DÉMARRAGE ────────────────────────────────────────────────

waitForAuth(() => {});
