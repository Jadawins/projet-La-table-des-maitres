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
  totalSteps: 11,
  // Données chargées
  _especes: [], _classes: [], _sousclasses: [], _backgrounds: [],
  _sortsParNiveau: {},    // cache : { 0:[...], 1:[...], 2:[...], ... }
  // Sélections
  nom: '', alignement: null, niveau: 1, xp: 0,
  espece: null, espece_data: null, espece_variante: null, espece_variante_data: null, sorts_raciaux: [],
  classe: null, classe_data: null, sous_classe: null, sc_data: null,
  background: null, bg_data: null,
  stats: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAG: 10, CHA: 10 },
  stats_method: null,
  stats_assigned: { FOR: null, DEX: null, CON: null, INT: null, SAG: null, CHA: null },
  stats_pointbuy: { FOR: 8, DEX: 8, CON: 8, INT: 8, SAG: 8, CHA: 8 },
  pv_resultats: {},       // { 1: X, 2: Y, ... } — PV gagnés par niveau
  pv_methode: {},         // { 2: 'fixe'|'de', ... }
  competences_choisies: [],
  equipement: [],
  sorts_choisis: {},      // { 0:[ids cantrips], 1:[ids niv1], 2:[...], ... }
  traits: '', ideaux: '', liens: '', defauts: '',
  apparence: '', historique_perso: '', notes: ''
};

const STEPS_LABELS = ['Infos', 'Espèce', 'Classe', 'Historique',
  'Stats', 'PV', 'Compétences', 'Équipement', 'Sorts', 'Traits', 'Récap'];

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
  if (n === 2) {
    if (!W.espece) { alert('Sélectionnez une espèce.'); return false; }
    if ((W.espece_data?.variantes || []).length > 0 && !W.espece_variante) {
      alert('Sélectionnez un lignage / héritage pour votre espèce.'); return false;
    }
  }
  if (n === 3 && !W.classe) { alert('Sélectionnez une classe.'); return false; }
  if (n === 4 && !W.background) { alert('Sélectionnez un historique.'); return false; }
  if (n === 5) {
    if (!W.stats_method) { alert('Choisissez une méthode d\'attribution des caractéristiques.'); return false; }
    if (W.stats_method === 'standard') {
      const allAssigned = STAT_KEYS.every(k => W.stats_assigned[k] !== null);
      if (!allAssigned) { alert('Distribuez toutes les valeurs standard avant de continuer.'); return false; }
    }
    if (W.stats_method === 'pointbuy') {
      if (pbTotalSpent() !== PB_BUDGET) {
        alert(`Dépensez exactement ${PB_BUDGET} points. (${pbTotalSpent()}/${PB_BUDGET} utilisés)`);
        return false;
      }
    }
  }
  if (n === 6) {
    if (!pvAllSet()) {
      alert('Choisissez les points de vie pour chaque niveau avant de continuer.');
      return false;
    }
  }
  if (n === 9) {
    if (!isCaster(W.classe_data)) return true;
    if (typeof getNiveauxSortsDisponibles !== 'function') return true; // magie-tables absent
    const nbC = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
    if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) {
      alert(`Choisissez ${nbC} sort(s) mineur(s). (${(W.sorts_choisis[0]||[]).length}/${nbC})`);
      return false;
    }
    const niveaux = getNiveauxSortsDisponibles(W.classe, W.niveau);
    if (niveaux.length > 0) {
      const mode = MAGIE_MODE[W.classe];
      let cible = 0;
      if (mode === 'connus')   cible = getNbSortsConnus(W.classe, W.niveau);
      if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats));
      if (cible > 0) {
        const total = niveaux.reduce((acc, nv) => acc + (W.sorts_choisis[nv]?.length || 0), 0);
        if (total < cible) {
          const label = mode === 'connus' ? 'connus' : 'préparés';
          alert(`Choisissez ${cible} sort(s) ${label}. (${total}/${cible})`);
          return false;
        }
      }
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
      STAT_KEYS.forEach(k => { if (W.stats_assigned[k] !== null) W.stats[k] = W.stats_assigned[k]; });
    } else if (W.stats_method === 'pointbuy') {
      STAT_KEYS.forEach(k => { W.stats[k] = W.stats_pointbuy[k]; });
    }
  }
  if (n === 7) {
    W.competences_choisies = [...document.querySelectorAll('.comp-check:checked')].map(el => el.dataset.nom);
  }
  if (n === 8) {
    W.equipement = [...document.querySelectorAll('.equip-check:checked')].map(el => ({
      nom: el.dataset.nom, quantite: parseInt(el.dataset.qte) || 1
    }));
  }
  if (n === 9) {
    // sorts_choisis est maintenu en temps réel par toggleSortNiveau()
    // On ne lit rien depuis le DOM ici
  }
  if (n === 10) {
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
  if (n === 6) initPVStep();
  if (n === 7) renderCompetences();
  if (n === 8) renderEquipement();
  if (n === 9) await loadSorts();
  if (n === 10) renderTraitsSuggestions();
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
  // Reset variant when species changes
  W.espece_variante = null;
  W.espece_variante_data = null;
  W.sorts_raciaux = [];
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
    ${(e.resistances||[]).filter(r => !r.startsWith('variable')).length ? `<div style="margin-top:0.4rem;font-size:0.78rem;color:#88c0a0;">Résistances : ${e.resistances.filter(r=>!r.startsWith('variable')).join(', ')}</div>` : ''}`;

  // Show/hide variant panel
  const varPanel = document.getElementById('variante-panel');
  const variantes = e.variantes || [];
  if (variantes.length > 0) {
    varPanel.style.display = 'block';
    renderVariantesGrid(variantes);
    document.getElementById('variante-detail').classList.remove('visible');
    document.getElementById('variante-detail').innerHTML = '';
  } else {
    varPanel.style.display = 'none';
    document.getElementById('variantes-grid').innerHTML = '';
  }
}

function renderVariantesGrid(variantes) {
  const grid = document.getElementById('variantes-grid');
  grid.innerHTML = variantes.map(v => `
    <div class="select-card ${W.espece_variante === v.id ? 'selected' : ''}" onclick="selectVariante('${v.id}')">
      <div class="card-name">${esc(v.nom)}</div>
      <div class="card-sub">
        ${(v.resistances||[]).map(r => `<span class="card-tag">${esc(r)}</span>`).join('')}
        ${v.vitesse_bonus ? `<span class="card-tag">+${v.vitesse_bonus}m</span>` : ''}
        ${v.vision_dans_le_noir > 18 ? `<span class="card-tag">Vision ${v.vision_dans_le_noir}m</span>` : ''}
      </div>
      <div style="font-size:0.72rem;color:#999;margin-top:0.3rem;line-height:1.4;">${esc((v.description||'').slice(0,80))}…</div>
    </div>`).join('');
}

function selectVariante(id) {
  const variantes = W.espece_data?.variantes || [];
  W.espece_variante = id;
  W.espece_variante_data = variantes.find(v => v.id === id);
  // Store racial spells filtered by character level
  W.sorts_raciaux = (W.espece_variante_data?.sorts_raciaux || [])
    .filter(s => s.niveau_personnage_requis <= (W.niveau || 1));

  renderVariantesGrid(variantes);

  const v = W.espece_variante_data;
  const d = document.getElementById('variante-detail');
  d.classList.add('visible');
  d.innerHTML = `
    <h3>${esc(v.nom)}</h3>
    <p style="font-size:0.8rem;color:#aaa;margin-bottom:0.6rem;">${esc(v.description||'')}</p>
    ${(v.traits_speciaux||[]).map(t => `
      <div class="trait-item">
        <div class="trait-item-name">${esc(t.nom)}</div>
        <div class="trait-item-desc">${esc(t.description)}</div>
      </div>`).join('')}
    ${(v.sorts_raciaux||[]).length ? `
      <div style="margin-top:0.6rem;font-size:0.78rem;color:#a090e0;">
        <strong>Sorts raciaux :</strong><br>
        ${v.sorts_raciaux.map(s => {
          const util = s.utilisation === 'a_volonte' ? 'à volonté' : s.utilisation.replace(/_/g,' ');
          const req = s.niveau_personnage_requis > 1 ? ` (dès niv ${s.niveau_personnage_requis})` : '';
          return `<span style="display:inline-block;margin:0.15rem 0.4rem 0.15rem 0;">${esc(s.nom)} — ${util}${req}</span>`;
        }).join('')}
      </div>` : ''}`;
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
const PB_BUDGET = 27;
const PB_COSTS = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
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
  const pbEl  = document.getElementById('stats-method-pointbuy');
  if (stdEl)  stdEl.style.display  = method === 'standard'  ? 'block' : 'none';
  if (diceEl) diceEl.style.display = method === 'dice'      ? 'block' : 'none';
  if (pbEl)   pbEl.style.display   = method === 'pointbuy'  ? 'block' : 'none';
  if (method === 'standard')  renderStatsDnD();
  if (method === 'pointbuy')  renderPointBuy();
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
  let ok = true;
  if (W.stats_method === 'standard') {
    ok = STAT_KEYS.every(k => W.stats_assigned[k] !== null);
  } else if (W.stats_method === 'pointbuy') {
    ok = pbTotalSpent() === PB_BUDGET;
  }
  btn.disabled = !ok;
  btn.style.opacity = ok ? '' : '0.4';
  btn.style.cursor = ok ? '' : 'not-allowed';
}

// ─── POINT BUY ────────────────────────────────────────────────

function pbCost(v) { return PB_COSTS[v] ?? 0; }
function pbTotalSpent() { return STAT_KEYS.reduce((s, k) => s + pbCost(W.stats_pointbuy[k]), 0); }
function pbRemaining() { return PB_BUDGET - pbTotalSpent(); }

function renderPointBuy() {
  const remaining = pbRemaining();
  const counterEl = document.getElementById('pb-counter');
  if (counterEl) {
    counterEl.textContent = `Points restants : ${remaining} / ${PB_BUDGET}`;
    counterEl.style.color = remaining === 0 ? '#4ade80' : remaining > 0 ? '#c9a84c' : '#f87171';
  }
  const grid = document.getElementById('pb-grid');
  if (!grid) return;
  grid.innerHTML = STAT_KEYS.map(k => {
    const val = W.stats_pointbuy[k];
    const cost = pbCost(val);
    const nextCost = pbCost(val + 1) - cost;
    const canInc = val < 15 && remaining >= nextCost;
    const canDec = val > 8;
    return `<div class="pb-stat-row">
      <div class="pb-stat-name">${k}</div>
      <button class="pb-btn${canDec ? '' : ' pb-btn-off'}" onclick="pbDecrement('${k}')" ${canDec ? '' : 'disabled'}>−</button>
      <div class="pb-stat-val">${val}</div>
      <button class="pb-btn${canInc ? '' : ' pb-btn-off'}" onclick="pbIncrement('${k}')" ${canInc ? '' : 'disabled'}>+</button>
      <div class="pb-cost">(coût : ${cost})</div>
      <div class="pb-modifier">${fmtMod(mod(val))}</div>
    </div>`;
  }).join('');
  updateNextBtn();
}

function pbIncrement(k) {
  const val = W.stats_pointbuy[k];
  if (val >= 15) return;
  if (pbRemaining() < pbCost(val + 1) - pbCost(val)) return;
  W.stats_pointbuy[k]++;
  renderPointBuy();
}

function pbDecrement(k) {
  if (W.stats_pointbuy[k] <= 8) return;
  W.stats_pointbuy[k]--;
  renderPointBuy();
}

// ─── ÉTAPE 6 — Points de vie ──────────────────────────────────

function initPVStep() {
  // Réinitialise le niveau 1 (toujours auto)
  const niv = W.niveau;
  const dvMax = isDvMax(getDv(W.classe_data));
  const conMod = mod(W.stats.CON);
  W.pv_resultats[1] = Math.max(1, dvMax + conMod);
  renderPVStep();
}

function renderPVStep() {
  const niv = W.niveau;
  const dvMax = isDvMax(getDv(W.classe_data));
  const dvType = getDv(W.classe_data);
  const conMod = mod(W.stats.CON);
  const fixed = Math.max(1, Math.floor(dvMax / 2) + 1 + conMod);
  let html = '<div class="pv-list">';
  // Niveau 1 — auto
  const pv1 = W.pv_resultats[1] || Math.max(1, dvMax + conMod);
  html += `
    <div class="pv-row pv-row-auto">
      <span class="pv-lvl-badge">Niv 1</span>
      <span class="pv-auto-label"><i class="fa-solid fa-lock" style="font-size:0.7rem;opacity:0.5;"></i> Automatique — ${dvType} max (${dvMax}) + CON (${fmtMod(conMod)})</span>
      <span class="pv-val-badge pv-val-set">+${pv1} PV</span>
    </div>`;
  // Niveaux 2+
  for (let lv = 2; lv <= niv; lv++) {
    const val = W.pv_resultats[lv];
    const hasVal = val !== undefined && val !== null;
    html += `<div class="pv-row" id="pv-row-${lv}">
      <span class="pv-lvl-badge">Niv ${lv}</span>
      <div class="pv-actions">
        <button class="pv-btn-choice${W.pv_methode[lv]==='fixe'?' pv-btn-active':''}" onclick="pvSetMethode(${lv},'fixe')">
          <i class="fa-solid fa-equals"></i> Fixe <span class="pv-fixed-val">${fixed > 0 ? '+' : ''}${fixed}</span>
        </button>
        <button class="pv-btn-choice${W.pv_methode[lv]==='de'?' pv-btn-active':''}" onclick="lancerDePV(${lv})">
          <i class="fa-solid fa-dice-d${dvMax}"></i> Lancer ${dvType}
        </button>
        <input class="pv-manual-input" type="number" min="1" max="${dvMax}" placeholder="Saisir…"
          value="${hasVal && W.pv_methode[lv]==='de' ? val - conMod : ''}"
          oninput="pvSaisir(${lv}, this.value)" title="Résultat du dé (sans le modificateur de CON)" />
      </div>
      <span class="pv-val-badge ${hasVal ? 'pv-val-set' : 'pv-val-empty'}" id="pv-val-${lv}">
        ${hasVal ? (val >= 0 ? '+' : '') + val + ' PV' : '—'}
      </span>
    </div>`;
  }
  html += '</div>';
  // Récap
  html += `<div class="pv-recap-section">
    <span class="pv-recap-label"><i class="fa-solid fa-heart"></i> Total PV max :</span>
    <span class="pv-recap-total" id="pv-recap-total">${pvAllSet() ? pvTotalCalc() : '—'}</span>
    ${!pvAllSet() ? '<span class="pv-recap-hint">Remplissez tous les niveaux pour continuer</span>' : ''}
  </div>`;
  document.getElementById('pv-step-content').innerHTML = html;
  updateNextBtnPV();
}

function pvTotalCalc() {
  return Object.values(W.pv_resultats).reduce((s, v) => s + (v || 0), 0);
}

function pvAllSet() {
  for (let lv = 1; lv <= W.niveau; lv++) {
    if (W.pv_resultats[lv] === undefined || W.pv_resultats[lv] === null) return false;
  }
  return true;
}

function pvSetMethode(lv, methode) {
  W.pv_methode[lv] = methode;
  if (methode === 'fixe') {
    const dvMax = isDvMax(getDv(W.classe_data));
    const conMod = mod(W.stats.CON);
    W.pv_resultats[lv] = Math.max(1, Math.floor(dvMax / 2) + 1 + conMod);
  }
  renderPVStep();
}

function lancerDePV(lv) {
  W.pv_methode[lv] = 'de';
  const dvMax = isDvMax(getDv(W.classe_data));
  const conMod = mod(W.stats.CON);
  const roll = Math.floor(Math.random() * dvMax) + 1;
  W.pv_resultats[lv] = Math.max(1, roll + conMod);
  renderPVStep();
}

function pvSaisir(lv, rawVal) {
  const dvMax = isDvMax(getDv(W.classe_data));
  const conMod = mod(W.stats.CON);
  const roll = Math.max(1, Math.min(dvMax, parseInt(rawVal) || 1));
  W.pv_methode[lv] = 'de';
  W.pv_resultats[lv] = Math.max(1, roll + conMod);
  const badge = document.getElementById(`pv-val-${lv}`);
  if (badge) {
    const val = W.pv_resultats[lv];
    badge.className = 'pv-val-badge pv-val-set';
    badge.textContent = (val >= 0 ? '+' : '') + val + ' PV';
  }
  const recap = document.getElementById('pv-recap-total');
  if (recap) recap.textContent = pvAllSet() ? pvTotalCalc() : '—';
  updateNextBtnPV();
}

function updateNextBtnPV() {
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  btn.disabled = !pvAllSet();
  btn.style.opacity = pvAllSet() ? '1' : '0.4';
}

// ─── ÉTAPE 7 — Compétences ────────────────────────────────────

function renderCompetences() {
  const classe = W.classe_data;
  const bg = W.bg_data;
  const bm = BONUS_MAITRISE[Math.min(W.niveau-1,19)];
  const nbChoix = classe?.competences_choisies?.nombre || 2;
  const rawOpts = classe?.competences_choisies?.options;
  const optionsClasse = rawOpts === 'toutes'
    ? TOUTES_COMPETENCES.map(c => normalizeComp(c.nom))
    : [].concat(rawOpts || []).map(normalizeComp);
  const bgComps = [].concat(bg?.competences || []).map(normalizeComp);
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
    const rawOpts2 = classe?.competences_choisies?.options;
    const optionsClasse = rawOpts2 === 'toutes'
      ? TOUTES_COMPETENCES.map(c => normalizeComp(c.nom))
      : [].concat(rawOpts2 || []).map(normalizeComp);
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

// ─── ÉTAPE 8 — Sorts (refactorisé multi-niveaux) ──────────────

async function loadSorts() {
  const section    = document.getElementById('sorts-section');
  const nonLanceur = document.getElementById('sorts-non-lanceur');
  const container  = document.getElementById('sorts-dynamic-sections');

  if (!isCaster(W.classe_data)) {
    section.style.display = 'none';
    nonLanceur.style.display = 'block';
    return;
  }
  section.style.display = 'block';
  nonLanceur.style.display = 'none';

  if (!W.sorts_choisis) W.sorts_choisis = {};

  const nomClasse = W.classe_data?.nom || '';
  const nbCantrips = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
  const niveaux    = getNiveauxSortsDisponibles(W.classe, W.niveau);
  const mode       = MAGIE_MODE[W.classe] || '';

  // Sous-titre
  let parts = [];
  if (nbCantrips > 0) parts.push(`${nbCantrips} sort(s) mineur(s)`);
  if (niveaux.length > 0) {
    if (mode === 'connus') {
      const nb = getNbSortsConnus(W.classe, W.niveau);
      parts.push(`${nb} sort(s) connu(s)`);
    } else if (mode === 'prepares') {
      const nb = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats));
      const carKey = W.classe_data?.caracteristique_incantation || 'INT';
      parts.push(`${nb} sort(s) préparé(s) (niv.+mod.${carKey})`);
    }
  } else if (nbCantrips === 0) {
    parts.push('Aucun sort disponible à ce niveau');
  }
  document.getElementById('sorts-subtitle').textContent =
    `${nomClasse} niv.${W.niveau} — ` + parts.join(' + ');

  // Niveaux à charger
  const tousNiveaux = nbCantrips > 0 ? [0, ...niveaux] : niveaux;
  const aFetcher    = tousNiveaux.filter(n => !W._sortsParNiveau[n]);

  if (aFetcher.length) {
    container.innerHTML = '<div style="color:#888;padding:1rem;text-align:center;">Chargement des sorts…</div>';
    try {
      const results = await Promise.all(
        aFetcher.map(n => fetch(`${API}/GetSorts2024?niveau=${n}`).then(r => r.json()).then(s => [n, s]))
      );
      results.forEach(([n, spells]) => { W._sortsParNiveau[n] = spells; });
    } catch {
      container.innerHTML = '<div style="color:#f66;padding:1rem;">Erreur de chargement des sorts.</div>';
      return;
    }
  }

  _renderSortsStep8();
  _updateBtnSuivant8();
}

function _renderSortsStep8() {
  const container  = document.getElementById('sorts-dynamic-sections');
  const nomClasse  = W.classe_data?.nom || '';
  const nbCantrips = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
  const niveaux    = getNiveauxSortsDisponibles(W.classe, W.niveau);
  const mode       = MAGIE_MODE[W.classe] || '';
  let html = '';

  // Bandeau global sorts niv 1+
  if (niveaux.length > 0) {
    let cible = 0, modeLabel = '';
    if (mode === 'connus')   { cible = getNbSortsConnus(W.classe, W.niveau);   modeLabel = 'connus'; }
    if (mode === 'prepares') { cible = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats)); modeLabel = 'préparés'; }
    const total = niveaux.reduce((acc, n) => acc + (W.sorts_choisis[n]?.length || 0), 0);
    if (cible > 0) {
      const done = total >= cible;
      html += `<div class="sorts-global-row">
        <span style="font-size:0.8rem;color:#aaa;">Sorts ${modeLabel} :</span>
        <span class="sorts-counter-badge${done ? ' done' : ''}" id="sorts-total-badge">${total}/${cible}</span>
        <span style="font-size:0.75rem;color:#666;"> — distribuez librement entre les niveaux ci-dessous</span>
      </div>`;
    }
  }

  // Section cantrips
  if (nbCantrips > 0) {
    html += _htmlSortsNiveauSection(nomClasse, 0, nbCantrips);
  }

  // Sections sorts niv 1+
  if (niveaux.length === 0 && nbCantrips === 0) {
    html += '<div style="color:#666;font-size:0.82rem;text-align:center;padding:1.5rem 0;">Aucun sort disponible à ce niveau.</div>';
  } else {
    for (const n of niveaux) {
      html += _htmlSortsNiveauSection(nomClasse, n, null);
    }
  }

  container.innerHTML = html;
  const tousNiveaux = nbCantrips > 0 ? [0, ...niveaux] : niveaux;
  tousNiveaux.forEach(n => _renderListeNiveau(n));
}

function _htmlSortsNiveauSection(nomClasse, niveauSort, maxCantrips) {
  const spells = (W._sortsParNiveau[niveauSort] || [])
    .filter(s => (s.classes||[]).some(c => c.toLowerCase() === nomClasse.toLowerCase()));
  const ecoles = [...new Set(spells.map(s => s.ecole).filter(Boolean))].sort();
  const titre  = niveauSort === 0 ? 'Sorts mineurs' : `Sorts de niveau ${niveauSort}`;
  const nb     = (W.sorts_choisis[niveauSort] || []).length;
  const badge  = maxCantrips !== null
    ? `<span class="sorts-counter-badge${nb >= maxCantrips ? ' done' : ''}" id="sorts-counter-${niveauSort}">${nb}/${maxCantrips}</span>`
    : `<span class="sorts-counter-badge-sm" id="sorts-counter-${niveauSort}">${nb}</span>`;

  return `
  <div class="sorts-niveau-block" id="sorts-block-${niveauSort}" style="margin-top:1.2rem;">
    <div class="sorts-niveau-header">
      <span style="font-size:0.82rem;color:#c9a84c;font-weight:600;">${titre}</span>
      ${badge}
    </div>
    <div class="sorts-search">
      <input type="text" id="search-sort-${niveauSort}" placeholder="Rechercher…"
             oninput="filtrerSortsNiveau(${niveauSort})" />
      <select id="ecole-sort-${niveauSort}" onchange="filtrerSortsNiveau(${niveauSort})">
        <option value="">Toutes les écoles</option>
        ${ecoles.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
      </select>
    </div>
    <div class="sorts-list" id="sorts-list-${niveauSort}"></div>
  </div>`;
}

function filtrerSortsNiveau(niveauSort) {
  _renderListeNiveau(niveauSort);
}

function _renderListeNiveau(niveauSort, _unused) {
  const listEl = document.getElementById(`sorts-list-${niveauSort}`);
  if (!listEl) return;

  const search = document.getElementById(`search-sort-${niveauSort}`)?.value || '';
  const ecole  = document.getElementById(`ecole-sort-${niveauSort}`)?.value  || '';
  const nomClasse = W.classe_data?.nom || '';
  const nbCantrips = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;

  const pool = (W._sortsParNiveau[niveauSort] || [])
    .filter(s => (s.classes||[]).some(c => c.toLowerCase() === nomClasse.toLowerCase()))
    .filter(s => {
      if (search && !s.nom.toLowerCase().includes(search.toLowerCase())) return false;
      if (ecole  && s.ecole !== ecole) return false;
      return true;
    });

  const choisis   = W.sorts_choisis[niveauSort] || [];
  const isCantrip = niveauSort === 0;
  const atMaxC    = isCantrip && choisis.length >= nbCantrips;
  const atMaxS    = !isCantrip && _isAtMaxSorts();

  listEl.innerHTML = pool.map(s => {
    const sel      = choisis.includes(s.id);
    const bloque   = !sel && (isCantrip ? atMaxC : atMaxS);
    return `
    <div class="sort-row${sel ? ' selected' : ''}${bloque ? ' sort-disabled' : ''}"
         onclick="toggleSortNiveau(${niveauSort},'${s.id}')">
      <input type="checkbox" class="sort-check" data-niveau="${niveauSort}" data-id="${s.id}"
             ${sel ? 'checked' : ''} ${bloque ? 'disabled' : ''}
             onclick="event.stopPropagation();toggleSortNiveau(${niveauSort},'${s.id}')" />
      <span class="sort-nom">${esc(s.nom)}</span>
      <span class="sort-ecole">${esc(s.ecole||'')}</span>
      ${s.concentration ? '<span class="sort-conc">Conc.</span>' : ''}
      ${s.rituel        ? '<span class="sort-ritual">Rit.</span>'  : ''}
    </div>`;
  }).join('') || '<div style="color:#555;padding:0.5rem;font-size:0.8rem;">Aucun sort trouvé.</div>';
}

function _isAtMaxSorts() {
  const niveaux = getNiveauxSortsDisponibles(W.classe, W.niveau);
  if (!niveaux.length) return false;
  const mode = MAGIE_MODE[W.classe];
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(W.classe, W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats));
  const total = niveaux.reduce((acc, n) => acc + (W.sorts_choisis[n]?.length || 0), 0);
  return total >= cible;
}

function toggleSortNiveau(niveauSort, spellId) {
  if (!W.sorts_choisis) W.sorts_choisis = {};
  if (!W.sorts_choisis[niveauSort]) W.sorts_choisis[niveauSort] = [];

  const arr = W.sorts_choisis[niveauSort];
  const idx = arr.indexOf(spellId);

  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    // Vérifier limites avant d'ajouter
    const nbCantrips = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
    if (niveauSort === 0 && arr.length >= nbCantrips) return;
    if (niveauSort > 0  && _isAtMaxSorts())           return;
    arr.push(spellId);
  }

  _refreshSortsCounters();

  // Re-rendre toutes les listes (mise à jour disabled)
  const tousNiveaux = [0, ...getNiveauxSortsDisponibles(W.classe, W.niveau)];
  tousNiveaux.forEach(n => _renderListeNiveau(n));
  _updateBtnSuivant8();
}

function _refreshSortsCounters() {
  const nbCantrips = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
  // Cantrips
  const bc = document.getElementById('sorts-counter-0');
  if (bc && nbCantrips > 0) {
    const nb = (W.sorts_choisis[0] || []).length;
    bc.textContent  = `${nb}/${nbCantrips}`;
    bc.className    = `sorts-counter-badge${nb >= nbCantrips ? ' done' : ''}`;
  }
  // Niveaux 1+
  const niveaux = getNiveauxSortsDisponibles(W.classe, W.niveau);
  niveaux.forEach(n => {
    const b = document.getElementById(`sorts-counter-${n}`);
    if (b) b.textContent = (W.sorts_choisis[n] || []).length;
  });
  // Global
  const mode  = MAGIE_MODE[W.classe] || '';
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(W.classe, W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats));
  const bg = document.getElementById('sorts-total-badge');
  if (bg && cible > 0) {
    const total = niveaux.reduce((acc, n) => acc + (W.sorts_choisis[n]?.length || 0), 0);
    bg.textContent = `${total}/${cible}`;
    bg.className   = `sorts-counter-badge${total >= cible ? ' done' : ''}`;
  }
}

function _updateBtnSuivant8() {
  if (W.step !== 8) return;
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  const ok = _validateSorts8Silent();
  btn.disabled      = !ok;
  btn.style.opacity = ok ? '' : '0.4';
  btn.style.cursor  = ok ? '' : 'not-allowed';
}

function _validateSorts8Silent() {
  if (!isCaster(W.classe_data)) return true;
  const nbC = (MAGIE_CANTRIPS[W.classe] !== undefined) ? getNbCantrips(W.classe, W.niveau) : 0;
  if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) return false;
  const niveaux = getNiveauxSortsDisponibles(W.classe, W.niveau);
  if (!niveaux.length) return true;
  const mode  = MAGIE_MODE[W.classe] || '';
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(W.classe, W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(W.classe, W.niveau, W.stats));
  if (cible === 0) return true;
  const total = niveaux.reduce((acc, n) => acc + (W.sorts_choisis[n]?.length || 0), 0);
  return total >= cible;
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

// ─── ÉTAPE 11 — Récapitulatif ─────────────────────────────────

function buildRecap() {
  collectStep(10);
  const niv = W.niveau;
  const bm = BONUS_MAITRISE[Math.min(niv-1,19)];
  const dexMod = mod(W.stats.DEX);
  const pvMax = pvTotalCalc();
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
      <div class="recap-row"><span class="recap-label">Espèce</span><span class="recap-val">${esc(W.espece_data?.nom||W.espece)}${W.espece_variante_data ? ` — ${esc(W.espece_variante_data.nom)}` : ''}</span></div>
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

    ${(() => {
      const lignes = [];
      const tousNiv = [0, ...getNiveauxSortsDisponibles(W.classe, W.niveau)];
      for (const nv of tousNiv) {
        const ids  = W.sorts_choisis?.[nv] || [];
        const pool = W._sortsParNiveau?.[nv] || [];
        const label = nv === 0 ? 'Mineur' : `Niv.${nv}`;
        ids.forEach(id => {
          const s = pool.find(x => x.id === id);
          lignes.push(`<div class="recap-row"><span class="recap-label">${label}</span><span class="recap-val">${esc(s?.nom||id)}</span></div>`);
        });
      }
      return lignes.length ? `<div class="recap-block" style="grid-column:1/-1;"><h3><i class="fa-solid fa-hat-wizard"></i> Sorts</h3>${lignes.join('')}</div>` : '';
    })()}
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

  const pvMax = pvTotalCalc();
  const ca = 10 + mod(stats.DEX);

  // Sorts — flatten sorts_choisis par niveau
  const tousNiveauxSorts = [0, ...getNiveauxSortsDisponibles(W.classe, niv)];
  const sortsConnus = [];
  for (const nv of tousNiveauxSorts) {
    const ids    = W.sorts_choisis?.[nv] || [];
    const pool   = W._sortsParNiveau?.[nv] || [];
    ids.forEach(id => {
      const s = pool.find(x => x.id === id);
      if (s) sortsConnus.push({ id: s.id, nom: s.nom, niveau: nv });
    });
  }
  const carIncant = getCaracIncantation(W.classe_data);

  const corps = {
    nom: W.nom,
    niveau: niv,
    experience: W.xp,
    espece: W.espece,
    espece_variante: W.espece_variante || null,
    classe: W.classe,
    sous_classe: W.sous_classe,
    background: W.background,
    alignement: W.alignement,
    caracteristiques,
    bonus_maitrise: bm,
    combat: {
      pv_max: pvMax, pv_actuels: pvMax, pv_temporaires: 0,
      pv_par_niveau: { ...W.pv_resultats },
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
      emplacements: (typeof getSlotsEmplacements === 'function')
        ? getSlotsEmplacements(W.classe, niv)
        : [],
      sorts_connus: sortsConnus,
      sorts_raciaux: W.sorts_raciaux || []
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
