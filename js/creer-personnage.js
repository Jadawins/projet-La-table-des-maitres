// ═══════════════════════════════════════════════════════════════
//  CREER-PERSONNAGE.JS — Wizard de création D&D 2024
// ═══════════════════════════════════════════════════════════════

const API = 'https://myrpgtable.fr/api';
let token = null;

// ─── CONSTANTES ───────────────────────────────────────────────

const XP_PAR_NIVEAU = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
const BONUS_MAITRISE = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

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
  totalSteps: 13,
  sprite_url: '',
  // Données chargées
  _especes: [], _classes: [], _sousclasses: [], _backgrounds: [],
  _sortsParNiveau: {},    // cache : { 0:[...], 1:[...], 2:[...], ... }
  _competences: [],   // chargées depuis l\'API
  // Sélections
  nom: '', alignement: null, niveau: 1, xp: 0,
  espece: null, espece_data: null, espece_variante: null, espece_variante_data: null, sorts_raciaux: [],
  bg_bonus: { FOR: 0, DEX: 0, CON: 0, INT: 0, SAG: 0, CHA: 0 },
  bg_bonus_mode: null,
  classe: null, classe_data: null, sous_classe: null, sc_data: null,
  background: null, bg_data: null,
  stats: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAG: 10, CHA: 10 },
  stats_method: null,
  stats_assigned: { FOR: null, DEX: null, CON: null, INT: null, SAG: null, CHA: null },
  stats_pointbuy: { FOR: 8, DEX: 8, CON: 8, INT: 8, SAG: 8, CHA: 8 },
  pv_resultats: {},       // { 1: X, 2: Y, ... } — PV gagnés par niveau
  pv_methode: {},         // { 2: 'fixe'|'de', ... }
  competences_choisies: [],
  competences_expertise: [],
  equipement: [],
  equipement_choix_classe: null,
  equipement_or_depart: 0,
  equipement_mode: 'pack',   // 'pack' ou 'achat'
  _catalogue: [],            // cache items boutique
  panier: [],                // { nom, type, categorie, prix_po, quantite }
  sorts_choisis: {},      // { 0:[ids cantrips], 1:[ids niv1], 2:[...], ... }
  traits: '', ideaux: '', liens: '', defauts: '',
  apparence: '', historique_perso: '', notes: ''
};

const STEPS_LABELS = ['Infos', 'Espèce', 'Classe', 'Historique',
  'Stats', 'PV', 'Compétences', 'Équipement', 'Boutique', 'Sorts', 'Traits', 'Récap'];

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

function isCaster(classeData, scData) {
  return !!(classeData?.incantation || scData?.incantation);
}

function getCaracIncantation(classeData, scData) {
  return classeData?.caracteristique_incantation || scData?.caracteristique_incantation || null;
}

// Retourne la cle a utiliser pour les tables de magie (classe ou sous-classe)
function getCasterKey() {
  if (W.classe_data?.incantation) return W.classe;
  if (W.sc_data?.incantation)     return W.sous_classe;
  return W.classe;
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
  // Reset btn-next state (step 5 et 10 gèrent leur propre verrouillage)
  if (W.step !== 5 && W.step !== 10) {
    next.disabled = false;
    next.style.opacity = '';
    next.style.cursor = '';
  }
  info.textContent = `Étape ${W.step} sur ${W.totalSteps}`;
}

const _W_SAVE_KEY = 'wizard_draft';

function saveWizardDraft() {
  // Ne pas sauvegarder les caches volumineux
  const { _especes, _classes, _sousclasses, _backgrounds, _sortsParNiveau, _competences, _catalogue, ...rest } = W;
  try { localStorage.setItem(_W_SAVE_KEY, JSON.stringify(rest)); } catch {}
}

function clearWizardDraft() {
  localStorage.removeItem(_W_SAVE_KEY);
}

function restoreWizardDraft() {
  try {
    const raw = localStorage.getItem(_W_SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    Object.assign(W, saved);
    return true;
  } catch { return false; }
}

function nextStep() {
  if (!validateStep(W.step)) return;
  collectStep(W.step);
  if (W.step === W.totalSteps - 1) buildRecap();
  if (W.step < W.totalSteps) showStep(W.step + 1);
  saveWizardDraft();
}

function prevStep() {
  collectStep(W.step);
  if (W.step > 1) showStep(W.step - 1);
  saveWizardDraft();
}

// ─── ÉTAPE 12 — SPRITE LPC ────────────────────────────────────

function wizardImporterSprite() {
  const dataUrl = localStorage.getItem('lpc_avatar');
  if (!dataUrl) {
    alert('Aucun avatar trouvé.\n\n1. Ouvre le générateur LPC\n2. Crée ton personnage\n3. Clique sur « 🧙 Avatar → Fiche personnage » dans la section Download\n4. Reviens ici et clique Importer');
    return;
  }
  W.sprite_url = dataUrl;
  const img = document.getElementById('wizard-sprite-img');
  const placeholder = document.getElementById('wizard-sprite-placeholder');
  if (img) { img.src = dataUrl; img.style.display = ''; }
  if (placeholder) placeholder.style.display = 'none';
  localStorage.removeItem('lpc_avatar');
}
window.wizardImporterSprite = wizardImporterSprite;

// Rafraîchir la zone sprite quand on arrive à l'étape 12
function onShowStep12() {
  const dataUrl = localStorage.getItem('lpc_avatar');
  const img = document.getElementById('wizard-sprite-img');
  const placeholder = document.getElementById('wizard-sprite-placeholder');
  if (!img) return;
  const url = W.sprite_url || dataUrl || '';
  if (url) {
    img.src = url;
    img.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    if (dataUrl && !W.sprite_url) {
      W.sprite_url = dataUrl;
      localStorage.removeItem('lpc_avatar');
    }
  } else {
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = '';
  }
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
  if (n === 3) {
    if (!W.classe) { alert('Sélectionnez une classe.'); return false; }
    const unlock = getNiveauSousClasse(W.classe_data);
    if ((W.niveau || 1) >= unlock && !W.sous_classe) {
      alert('Sélectionnez une sous-classe (obligatoire à partir du niveau ' + unlock + ').');
      return false;
    }
  }
  if (n === 4) {
    if (!W.background) { alert('Sélectionnez un historique.'); return false; }
    if (!bgBonusIsValid()) { alert('Choisissez comment répartir vos bonus de caractéristiques du background.'); return false; }
  }
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
  if (n === 7) {
    const nSlots = getExpertiseSlots(W.classe, W.niveau);
    if (nSlots > 0 && W.competences_expertise.length < nSlots) {
      alert(`Choisissez ${nSlots} compétence${nSlots > 1 ? 's' : ''} pour l'Expertise. (${W.competences_expertise.length}/${nSlots})`);
      return false;
    }
  }
  // Étape 9 : boutique — toujours valide (achat optionnel)
  if (n === 8) {
    const classeEquip = W.classe_data?.equipement_depart || W.classe_data?.niveaux?.['0']?.equipement_depart || [];
    if (classeEquip.length > 0 && !W.equipement_choix_classe) {
      alert('Choisissez une option d\'équipement pour votre classe.'); return false;
    }
  }
  if (n === 10) {
    if (!isCaster(W.classe_data, W.sc_data)) return true;
    if (typeof getNiveauxSortsDisponibles !== 'function') return true;
    const nbC = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
    if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) {
      alert(`Choisissez ${nbC} sort(s) mineur(s). (${(W.sorts_choisis[0]||[]).length}/${nbC})`);
      return false;
    }
    const niveaux = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
    if (niveaux.length > 0) {
      const mode = MAGIE_MODE[getCasterKey()];
      let cible = 0;
      if (mode === 'connus')   cible = getNbSortsConnus(getCasterKey(), W.niveau);
      if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats()));
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
    // Comps cochées par le joueur (hors auto)
    const bgComps = (W.bg_data?.competences || []).map(normalizeComp);
    const especeComps = getEspeceComps();
    const autoComps = [...new Set([...bgComps, ...especeComps])];
    W.competences_choisies = [...document.querySelectorAll('.comp-check:checked')]
      .filter(el => !autoComps.includes(normalizeComp(el.dataset.nom)))
      .map(el => el.dataset.nom);
  }
  if (n === 8) {
    // W.equipement est maintenu en temps réel par selectEquipChoix()
  }
  if (n === 9) {
    // panier maintenu en temps réel par ajouterPanier/retirerPanier
  }
  if (n === 10) {
    // sorts_choisis est maintenu en temps réel par toggleSortNiveau()
  }
  if (n === 11) {
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
  if (n === 7) { loadCompetences().then(() => renderCompetences()); }
  if (n === 8) renderEquipement();
  if (n === 9) renderBoutiqueStep();
  if (n === 10) await loadSorts();
  if (n === 11) renderTraitsSuggestions();
  if (n === 12) onShowStep12();
}

// ─── ÉTAPE 1 — Alignement & Niveau ───────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Restaurer le brouillon si présent
  if (restoreWizardDraft() && W.step > 1) {
    const banner = document.createElement('div');
    banner.id = 'draft-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1a1a2e;border-bottom:1px solid rgba(201,168,76,0.4);padding:0.5rem 1rem;display:flex;align-items:center;justify-content:space-between;font-size:0.82rem;color:#c9a84c;';
    banner.innerHTML = `<span><i class="fa-solid fa-floppy-disk"></i> Brouillon restauré — vous étiez à l'étape ${W.step}</span>
      <div style="display:flex;gap:0.75rem;">
        <button onclick="clearWizardDraft();document.getElementById('draft-banner').remove();showStep(1);" style="background:none;border:1px solid #555;border-radius:5px;color:#aaa;padding:0.2rem 0.6rem;cursor:pointer;font-size:0.78rem;">Recommencer</button>
        <button onclick="document.getElementById('draft-banner').remove();" style="background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);border-radius:5px;color:#c9a84c;padding:0.2rem 0.6rem;cursor:pointer;font-size:0.78rem;">Continuer →</button>
      </div>`;
    document.body.prepend(banner);
    showStep(W.step);
  }

  // Alignement
  const alignGrid = document.getElementById('alignement-grid');
  if (alignGrid) {
    alignGrid.addEventListener('click', e => {
      const btn = e.target.closest('.align-btn');
      if (!btn) return;
      document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      W.alignement = btn.dataset.align;
    });
  }

  // Niveau → XP + maîtrise
  const niveauEl = document.getElementById('p-niveau');
  if (niveauEl) {
    niveauEl.addEventListener('input', function() {
      const niv = parseInt(this.value) || 1;
      const xpEl = document.getElementById('p-xp');
      const maiEl = document.getElementById('p-maitrise');
      if (xpEl) xpEl.value = XP_PAR_NIVEAU[Math.min(niv-1,19)] || 0;
      if (maiEl) maiEl.value = '+' + (BONUS_MAITRISE[Math.min(niv-1,19)] || 2);
    });
  }

  // Stats → modificateurs
  ['FOR','DEX','CON','INT','SAG','CHA'].forEach(k => {
    const el = document.getElementById(`stat-${k}`);
    if (el) el.addEventListener('input', function() {
      const v = parseInt(this.value) || 10;
      W.stats[k] = v;
      const modEl = document.getElementById(`mod-${k}`);
      if (modEl) modEl.textContent = fmtMod(mod(v));
    });
  });

  renderProgress();
  updateNav();
});

// ─── ÉTAPE 2 — Espèces ────────────────────────────────────────

async function loadEspeces() {
  if (W._especes.length) { renderEspecesGrid(); return; }
  try {
    const [rOff, rHB] = await Promise.allSettled([
      fetch(`${API}/GetEspeces2024`).then(r => r.json()),
      fetch(`${API}/Races`).then(r => r.json()),
    ]);
    const officielles = rOff.status === 'fulfilled' ? rOff.value : [];
    const homebrew = rHB.status === 'fulfilled' ? rHB.value.map(hb => ({
      id: String(hb._id),
      nom: hb.nom,
      vitesse: hb.vitesse || 9,
      taille: hb.taille || { categorie: 'M' },
      resistances: (hb.resistances_degats || []).map(r => r.type),
      description: `Race homebrew — ${hb.type_creature || 'Humanoïde'}`,
      traits: [],
      variantes: [],
      _homebrew: true,
      _statut: hb.statut,
      _race_id: String(hb._id),
    })) : [];
    W._especes = [...officielles, ...homebrew];
    renderEspecesGrid();
  } catch { document.getElementById('especes-grid').innerHTML = '<p style="color:#f00">Erreur de chargement</p>'; }
}

function renderEspecesGrid() {
  const grid = document.getElementById('especes-grid');
  grid.innerHTML = W._especes.map(e => `
    <div class="select-card ${W.espece === e.id ? 'selected' : ''}" onclick="selectEspece('${e.id}')">
      <div class="card-name">${esc(e.nom)}${e._homebrew ? ' <span style="font-size:0.6rem;background:rgba(201,168,76,0.2);border:1px solid rgba(201,168,76,0.4);color:#c9a84c;border-radius:4px;padding:0.1rem 0.35rem;vertical-align:middle;">Bêta</span>' : ''}</div>
      <div class="card-sub">
        <span class="card-tag">Vitesse ${e.vitesse || 9}m</span>
        ${(e.resistances||[]).map(r => `<span class="card-tag">${esc(r)}</span>`).join('')}
      </div>
      <div style="font-size:0.72rem;color:#aaa;line-height:1.4;margin-top:0.3rem;">${esc((e.description||'').slice(0,80))}…</div>
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

function getNiveauSousClasse(classeData) {
  if (!classeData?.niveaux) return 3;
  const niveaux = classeData.niveaux;
  const found = Object.keys(niveaux)
    .map(Number)
    .sort((a, b) => a - b)
    .find(n => niveaux[String(n)]?.verifier_sous_classe === true);
  return found ?? 3;
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

  // Sous-classes si niveau >= unlock level
  const scSection = document.getElementById('sousclasse-section');
  const unlockNiveau = getNiveauSousClasse(W.classe_data);
  const subtitle = document.getElementById('sousclasse-subtitle');
  if (subtitle) subtitle.innerHTML = '<i class="fa-solid fa-star"></i> Sous-classe (niveau ' + unlockNiveau + ')';
  if ((W.niveau || 1) >= unlockNiveau) {
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

async function loadCompetences() {
  if (W._competences.length) return;
  try {
    const r = await fetch(`${API}/GetCompetences2024`);
    const data = await r.json();
    // Normalise le champ "caracteristique" → "car" pour compatibilité interne
    W._competences = data.map(c => ({ nom: c.nom, car: c.caracteristique }));
  } catch {
    // Fallback hardcodé minimal si l\'API est indisponible
    W._competences = [
      { nom: 'Acrobaties', car: 'DEX' }, { nom: 'Arcanes', car: 'INT' },
      { nom: 'Athlétisme', car: 'FOR' }, { nom: 'Discrétion', car: 'DEX' },
      { nom: 'Dressage', car: 'SAG' },   { nom: 'Escamotage', car: 'DEX' },
      { nom: 'Histoire', car: 'INT' },   { nom: 'Intimidation', car: 'CHA' },
      { nom: 'Investigation', car: 'INT' }, { nom: 'Médecine', car: 'SAG' },
      { nom: 'Nature', car: 'INT' },     { nom: 'Perception', car: 'SAG' },
      { nom: 'Perspicacité', car: 'SAG' }, { nom: 'Persuasion', car: 'CHA' },
      { nom: 'Religion', car: 'INT' },   { nom: 'Représentation', car: 'CHA' },
      { nom: 'Survie', car: 'SAG' },     { nom: 'Tromperie', car: 'CHA' }
    ];
  }
}

// Retourne les compétences fixes données par l\'espèce (hors "au_choix")
function getEspeceComps() {
  const maitrises = W.espece_data?.competences_maitrises || [];
  return maitrises
    .filter(m => !String(m).startsWith('au_choix'))
    .map(normalizeComp);
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
  // Reset bonus si on change de background
  W.bg_bonus = { FOR:0, DEX:0, CON:0, INT:0, SAG:0, CHA:0 };
  W.bg_bonus_mode = null;
  const panel = document.getElementById('bg-bonus-panel');
  if (panel) panel.style.display = 'block';
  const inputsEl = document.getElementById('bg-bonus-inputs');
  if (inputsEl) inputsEl.innerHTML = '';
  const previewEl = document.getElementById('bg-bonus-preview');
  if (previewEl) previewEl.textContent = '';
  document.querySelectorAll('.bg-bonus-mode-btn').forEach(b => b.classList.remove('active'));
}

function setBgBonusMode(mode) {
  W.bg_bonus_mode = mode;
  W.bg_bonus = { FOR:0, DEX:0, CON:0, INT:0, SAG:0, CHA:0 };
  document.querySelectorAll('.bg-bonus-mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('bg-mode-' + mode)?.classList.add('active');
  renderBgBonusInputs();
}

function renderBgBonusInputs() {
  const el = document.getElementById('bg-bonus-inputs');
  if (!el) return;
  const sug = W.bg_data?.bonus_caracteristiques?.suggerees || [];

  if (W.bg_bonus_mode === '2plus1') {
    // PHB 2024 : choisir laquelle des 3 stats reçoit +2, laquelle reçoit +1
    if (sug.length < 2) {
      el.innerHTML = '<div style="font-size:0.78rem;color:#f87171;">Données manquantes pour ce background.</div>';
      return;
    }
    const opts2 = sug.map(k => '<option value="' + k + '">' + k + '</option>').join('');
    el.innerHTML =
      '<div style="font-size:0.78rem;color:#aaa;margin-bottom:0.75rem;">Choisissez la répartition parmi : ' +
      '<strong style="color:#e0e0e0;">' + sug.join(', ') + '</strong></div>' +
      '<div style="display:flex;gap:1.25rem;align-items:flex-start;flex-wrap:wrap;">' +
        '<div>' +
          '<div style="font-size:0.72rem;color:#c8b8ff;margin-bottom:0.3rem;"><span class="bg-bonus-tag bg-bonus-tag-2">+2</span> à :</div>' +
          '<select class="bg-bonus-select" id="bg-sel-2" onchange="applyBgBonus2plus1()">' +
            '<option value="">— choisir —</option>' + opts2 +
          '</select>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:0.72rem;color:#e8c96a;margin-bottom:0.3rem;"><span class="bg-bonus-tag bg-bonus-tag-1">+1</span> à :</div>' +
          '<select class="bg-bonus-select" id="bg-sel-1" onchange="applyBgBonus2plus1()">' +
            '<option value="">— choisir —</option>' + opts2 +
          '</select>' +
        '</div>' +
      '</div>';
  } else if (W.bg_bonus_mode === '3fois1') {
    // PHB 2024 : +1 automatique aux 3 stats du background, pas de choix
    W.bg_bonus = { FOR:0, DEX:0, CON:0, INT:0, SAG:0, CHA:0 };
    sug.forEach(k => { W.bg_bonus[k] = 1; });
    el.innerHTML =
      '<div style="font-size:0.78rem;color:#aaa;margin-bottom:0.4rem;">Bonus appliqués automatiquement :</div>' +
      '<div style="display:flex;gap:0.75rem;">' +
      sug.map(k =>
        '<div style="background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:6px;padding:0.3rem 0.75rem;text-align:center;">' +
          '<div style="font-size:0.72rem;color:#e8c96a;font-weight:700;">+1</div>' +
          '<div style="font-size:0.82rem;color:#e0e0e0;">' + k + '</div>' +
        '</div>'
      ).join('') +
      '</div>';
    renderBgBonusPreview();
  }
}

function applyBgBonus2plus1() {
  const sug = W.bg_data?.bonus_caracteristiques?.suggerees || [];
  const k2 = document.getElementById('bg-sel-2')?.value;
  const k1 = document.getElementById('bg-sel-1')?.value;
  W.bg_bonus = { FOR:0, DEX:0, CON:0, INT:0, SAG:0, CHA:0 };
  if (k2 && sug.includes(k2)) W.bg_bonus[k2] = 2;
  if (k1 && sug.includes(k1) && k1 !== k2) W.bg_bonus[k1] = 1;
  renderBgBonusPreview();
}

function bgBonusIsValid() {
  if (!W.bg_bonus_mode) return false;
  const total = Object.values(W.bg_bonus).reduce((s, v) => s + v, 0);
  if (W.bg_bonus_mode === '2plus1') {
    return total === 3 && Object.values(W.bg_bonus).some(v => v === 2);
  }
  if (W.bg_bonus_mode === '3fois1') {
    return total === 3 && Object.values(W.bg_bonus).filter(v => v > 0).length === 3;
  }
  return false;
}

function renderBgBonusPreview() {
  const el = document.getElementById('bg-bonus-preview');
  if (!el) return;
  const parts = STAT_KEYS.filter(k => W.bg_bonus[k] > 0)
    .map(k => `<span style="color:#4ade80;">${k} +${W.bg_bonus[k]}</span>`);
  el.innerHTML = parts.length ? `Bonus appliqués : ${parts.join(' · ')}` : '';
}

// ─── STATS FINALES (base + bonus background) ──────────────────
function finalStats() {
  const fs = {};
  STAT_KEYS.forEach(k => {
    fs[k] = Math.min(20, (W.stats[k] || 10) + (W.bg_bonus[k] || 0));
  });
  return fs;
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
  const conMod = mod(finalStats().CON);
  W.pv_resultats[1] = Math.max(1, dvMax + conMod);
  renderPVStep();
}

function renderPVStep() {
  const niv = W.niveau;
  const dvMax = isDvMax(getDv(W.classe_data));
  const dvType = getDv(W.classe_data);
  const conMod = mod(W.stats.CON ?? 10);
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
    const conMod = mod(W.stats.CON ?? 10);
    W.pv_resultats[lv] = Math.max(1, Math.floor(dvMax / 2) + 1 + conMod);
  }
  renderPVStep();
}

function lancerDePV(lv) {
  W.pv_methode[lv] = 'de';
  const dvMax = isDvMax(getDv(W.classe_data));
  const conMod = mod(W.stats.CON ?? 10);
  const roll = Math.floor(Math.random() * dvMax) + 1;
  W.pv_resultats[lv] = Math.max(1, roll + conMod);
  renderPVStep();
}

function pvSaisir(lv, rawVal) {
  const dvMax = isDvMax(getDv(W.classe_data));
  const conMod = mod(W.stats.CON ?? 10);
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
  const competences = W._competences;
  if (!competences.length) { loadCompetences().then(() => renderCompetences()); return; }

  const classe = W.classe_data;
  const bg = W.bg_data;
  const stats = finalStats();
  const bm = BONUS_MAITRISE[Math.min(W.niveau - 1, 19)];
  const nbChoix = classe?.competences_choisies?.nombre || 2;
  const rawOpts = classe?.competences_choisies?.options;
  const optionsClasse = rawOpts === 'toutes'
    ? competences.map(c => normalizeComp(c.nom))
    : [].concat(rawOpts || []).map(normalizeComp);

  const bgComps = [].concat(bg?.competences || []).map(normalizeComp);
  const especeComps = getEspeceComps();
  // Toutes les comps acquises automatiquement (bg + espèce fixe)
  const autoComps = [...new Set([...bgComps, ...especeComps])];
  const choisies = W.competences_choisies.map(normalizeComp);

  document.getElementById('comp-counter').textContent =
    `Choisissez ${nbChoix} compétence(s) parmi celles de votre classe (blanc). ` +
    `Background (vert) et espèce (bleu) sont automatiques.`;

  const grid = document.getElementById('competences-grid');
  grid.innerHTML = competences.map(comp => {
    const nc = normalizeComp(comp.nom);
    const inBg = bgComps.includes(nc);
    const inEspece = especeComps.includes(nc);
    const inClasse = optionsClasse.includes(nc);
    const isAuto = autoComps.includes(nc);
    const isChecked = isAuto || choisies.includes(nc);
    const mod_val = fmtMod(mod(stats[comp.car] || 10) + (isChecked ? bm : 0));
    const disabled = isAuto || (!inClasse && !choisies.includes(nc));

    const labelClass = inBg ? 'from-bg' : inEspece ? 'from-espece' : inClasse ? 'from-class' : '';
    const badge = inBg ? '<span class="comp-badge comp-badge-bg">BG</span>'
                : inEspece ? '<span class="comp-badge comp-badge-espece">ESP</span>'
                : '';

    return `
    <div class="comp-row">
      <input type="checkbox" class="comp-check" data-nom="${comp.nom}"
             ${isChecked ? 'checked' : ''} ${disabled ? 'disabled' : ''}
             onchange="updateCompCounter(${nbChoix})" />
      <span class="comp-label ${labelClass}">${comp.nom}${badge}</span>
      <span class="comp-char">${comp.car}</span>
      <span class="comp-bonus">${mod_val}</span>
    </div>`;
  }).join('');
  updateCompCounter(nbChoix);
}

function updateCompCounter(max) {
  const bg = W.bg_data;
  const bgComps = (bg?.competences || []).map(normalizeComp);
  const especeComps = getEspeceComps();
  const autoComps = [...new Set([...bgComps, ...especeComps])];

  const rawOpts2 = W.classe_data?.competences_choisies?.options;
  const competences = W._competences;
  const optionsClasse = rawOpts2 === 'toutes'
    ? competences.map(c => normalizeComp(c.nom))
    : [].concat(rawOpts2 || []).map(normalizeComp);

  // Cases cochables : options de classe, hors comps automatiques
  const optionBoxes = [...document.querySelectorAll('.comp-check')]
    .filter(b => {
      const nc = normalizeComp(b.dataset.nom);
      return optionsClasse.includes(nc) && !autoComps.includes(nc);
    });
  const checked = optionBoxes.filter(b => b.checked).length;

  optionBoxes.forEach(b => {
    if (!b.checked) b.disabled = checked >= max;
  });
  if (typeof updateExpertiseSection === 'function') updateExpertiseSection();
}

function getExpertiseSlots(classe, niveau) {
  const table = {
    barde:    [[2, 2], [9, 2]],
    roublard: [[1, 2], [6, 2]]
  };
  const entries = table[String(classe || '').toLowerCase()] || [];
  return entries.reduce((total, [minNiv, nb]) => niveau >= minNiv ? total + nb : total, 0);
}

function updateExpertiseSection() {
  const section = document.getElementById('expertise-section');
  if (!section) return;

  const nSlots = getExpertiseSlots(W.classe, W.niveau);
  if (nSlots === 0) { section.innerHTML = ''; return; }

  const bgComps = (W.bg_data?.competences || []).map(normalizeComp);
  const proficientNorm = new Set([
    ...bgComps,
    ...[...document.querySelectorAll('.comp-check:checked')].map(b => normalizeComp(b.dataset.nom))
  ]);

  // Nettoyer les choix invalides si une comp a ete decochee
  W.competences_expertise = W.competences_expertise.filter(e => proficientNorm.has(normalizeComp(e)));

  const chosen = W.competences_expertise.map(normalizeComp);
  const proficientComps = W._competences.filter(c => proficientNorm.has(normalizeComp(c.nom)));

  section.innerHTML = `
    <div class="expertise-header">
      <i class="fa-solid fa-star"></i> Expertise
      <span class="expertise-counter ${chosen.length >= nSlots ? 'expertise-counter-done' : ''}">${chosen.length} / ${nSlots}</span>
    </div>
    <div class="expertise-hint">Choisissez ${nSlots} compétence${nSlots > 1 ? 's' : ''} pour lesquelles doubler votre bonus de maîtrise.</div>
    <div class="expertise-grid">
      ${proficientComps.map(c => {
        const nc = normalizeComp(c.nom);
        const isChosen = chosen.includes(nc);
        const disabled = !isChosen && chosen.length >= nSlots;
        return `<label class="expertise-row${isChosen ? ' expertise-active' : ''}${disabled ? ' expertise-disabled' : ''}">
          <input type="checkbox" class="expertise-check" data-nom="${c.nom}"
            ${isChosen ? 'checked' : ''} ${disabled ? 'disabled' : ''}
            onchange="toggleExpertise('${c.nom}')" />
          <span class="expertise-nom">${c.nom}</span>
          <span class="comp-char">${c.car}</span>
        </label>`;
      }).join('')}
    </div>`;
}

function toggleExpertise(nom) {
  const nc = normalizeComp(nom);
  const idx = W.competences_expertise.findIndex(e => normalizeComp(e) === nc);
  if (idx >= 0) {
    W.competences_expertise.splice(idx, 1);
  } else {
    W.competences_expertise.push(nom);
  }
  updateExpertiseSection();
}

// ─── ÉTAPE 7 — Équipement ─────────────────────────────────────

function renderEquipement() {
  const classeEquip = W.classe_data?.equipement_depart || W.classe_data?.niveaux?.['0']?.equipement_depart || [];
  const bgEquip = W.bg_data?.equipement || [];

  // ── 1. Choix d\'option classe (toujours visible au-dessus des onglets) ──
  const optContainer = document.getElementById('equip-options-classe');
  if (optContainer) {
    let optHtml = '';
    if (classeEquip.length > 0) {
      optHtml += '<div style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin-bottom:0.5rem;">Équipement de classe — choisissez une option :</div>';
      classeEquip.forEach(opt => {
        const selected = W.equipement_choix_classe === opt.choix;
        optHtml += `<label class="equip-choix-row${selected ? ' selected' : ''}" onclick="selectEquipChoix('${opt.choix}')">
          <input type="radio" name="equip-classe" value="${opt.choix}" ${selected ? 'checked' : ''}
                 onchange="selectEquipChoix('${opt.choix}')" style="margin-right:0.5rem;" />
          <span style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin-right:0.5rem;">Option ${opt.choix}</span>
          <span style="font-size:0.78rem;color:#ddd;">${(opt.contenu || []).join(', ')}</span>
        </label>`;
      });
    }
    optContainer.innerHTML = optHtml;
  }

  // ── 2. Équipement du background dans le panel Pack ──
  const bgContainer = document.getElementById('equip-list-bg');
  if (bgContainer) {
    let bgHtml = '';
    if (bgEquip.length > 0) {
      bgHtml += '<div style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin:0.75rem 0 0.4rem;">\u00c9quipement d\'historique :</div>';
      bgEquip.forEach(e => {
        bgHtml += `<div class="equip-row">
          <span class="equip-nom">${esc(e.nom)}</span>
          <span class="equip-qte">×${e.quantite || 1}</span>
          <span class="equip-source bg">Historique</span>
        </div>`;
      });
    }
    bgContainer.innerHTML = bgHtml;
  }

  // Sélectionner le premier choix par défaut si rien choisi
  if (!W.equipement_choix_classe && classeEquip.length > 0) {
    selectEquipChoix(classeEquip[0].choix);
  } else {
    _updateAchatTab();
  }

  // Afficher le bon panel selon le mode
  if (document.getElementById('equip-panel-pack')) {
    switchEquipTab(W.equipement_mode || 'pack', false);
  }
}

function renderBoutiqueStep() {
  const budget = getBudgetAchat();
  _refreshBudgetDisplay();

  if (!budget) {
    const msg = '<div style="color:#888;font-size:0.85rem;text-align:center;padding:2rem;">Vous avez choisi un pack d\'équipement — pas d\'or disponible pour la boutique.</div>';
    const listEl = document.getElementById('boutique-generale-list');
    const magieEl = document.getElementById('boutique-magie-list');
    if (listEl) listEl.innerHTML = msg;
    if (magieEl) magieEl.innerHTML = '';
    return;
  }

  loadCatalogueStep();
}

function _refreshBudgetDisplay() {
  const budget = getBudgetAchat();
  const restant = budgetRestant();
  const totalEl = document.getElementById('boutique-budget-total');
  const restantEl = document.getElementById('boutique-budget-restant');
  if (totalEl) totalEl.textContent = Math.round(budget * 100) / 100;
  if (restantEl) {
    restantEl.textContent = Math.round(restant * 100) / 100;
    restantEl.style.color = restant < 0 ? '#f87171' : restant === 0 ? '#4ade80' : '#c9a84c';
  }
}

async function loadCatalogueStep() {
  if (W._catalogue.length > 0) { renderBoutiqueGenerale(); renderBoutiqueMagie(); return; }
  const listEl = document.getElementById('boutique-generale-list');
  if (listEl) listEl.innerHTML = '<div style="color:#888;text-align:center;padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>';
  try {
    const [armes, armures, equips] = await Promise.all([
      fetch(`${API}/GetArmes2024`).then(r => r.json()),
      fetch(`${API}/GetArmures2024`).then(r => r.json()),
      fetch(`${API}/GetEquipements2024`).then(r => r.json()),
    ]);
    W._catalogue = [
      ...armes.map(i => ({ ...i, type: 'arme' })),
      ...armures.map(i => ({ ...i, type: 'armure' })),
      ...equips,
    ].filter(i => i.prix);
    renderBoutiqueGenerale();
    renderBoutiqueMagie();
  } catch {
    if (listEl) listEl.innerHTML = '<div style="color:#f66;text-align:center;padding:1rem;">Erreur de chargement.</div>';
  }
}

const MAGIE_CATS = ['focus_arcanique', 'focus_druidique', 'symbole_sacre', 'composante', 'grimoire', 'baguette', 'baton', 'orbe', 'cristal', 'amulette', 'sacoche_composantes'];
const MAGIE_NOMS_KEYS = ['focus', 'druid', 'sacré', 'sacre', 'componente', 'grimoire', 'baguette', 'cristal', 'orbe', 'bâton', 'baton', 'amulette', 'sacoche', 'encens', 'parchemin'];

function _isMagicItem(item) {
  const cat = (item.categorie || '').toLowerCase();
  const nom = (item.nom || '').toLowerCase();
  if (MAGIE_CATS.some(c => cat.includes(c))) return true;
  if (MAGIE_NOMS_KEYS.some(k => nom.includes(k))) return true;
  return false;
}

function renderBoutiqueGenerale() {
  const search = (document.getElementById('boutique-search')?.value || '').toLowerCase();
  const type   = document.getElementById('boutique-filtre-type')?.value || '';
  const budget = getBudgetAchat();
  const pool = W._catalogue.filter(i => {
    if (_isMagicItem(i)) return false; // séparé dans la section magie
    if (type && i.type !== type) return false;
    if (search && !i.nom.toLowerCase().includes(search)) return false;
    return true;
  });
  _renderBoutiqueList('boutique-generale-list', pool, budget);
}

function renderBoutiqueMagie() {
  const budget = getBudgetAchat();
  const pool = W._catalogue.filter(i => _isMagicItem(i));
  _renderBoutiqueList('boutique-magie-list', pool, budget);
}

function _renderBoutiqueList(containerId, pool, budget) {
  const list = document.getElementById(containerId);
  if (!list) return;
  if (!pool.length) {
    list.innerHTML = '<div style="color:#555;font-size:0.78rem;text-align:center;padding:1rem;">Aucun article trouvé.</div>';
    return;
  }
  list.innerHTML = pool.map(item => {
    const prixPo = prixEnPoItem(item.prix);
    const inPanier = (W.panier || []).find(p => p.nom === item.nom);
    const qte = inPanier?.quantite || 0;
    const tooExpensive = prixPo > budgetRestant() + (inPanier ? inPanier.prix_po * inPanier.quantite : 0);
    const prixStr = formatPrix(item.prix);
    let detail = '';
    if (item.type === 'arme' && item.degats) detail = item.degats.de + ' ' + item.degats.type;
    if (item.type === 'armure' && item.classe_armure) detail = 'CA ' + item.classe_armure.base + (item.classe_armure.modificateur_dex ? '+DEX' : '');
    return `<div class="boutique-row${tooExpensive && qte === 0 ? ' boutique-disabled' : ''}">
      <div class="boutique-row-info">
        <span class="boutique-nom">${esc(item.nom)}</span>
        ${detail ? `<span class="boutique-detail">${esc(detail)}</span>` : ''}
        <span class="boutique-type boutique-type-${item.type}">${item.type}</span>
      </div>
      <div class="boutique-row-actions">
        <span class="boutique-prix">${prixStr}</span>
        <div class="boutique-qty">
          <button class="boutique-btn-qty" onclick="retirerPanier('${esc(item.nom)}')" ${qte === 0 ? 'disabled' : ''}>−</button>
          <span class="boutique-qty-val">${qte}</span>
          <button class="boutique-btn-qty" data-item-nom="${esc(item.nom)}" onclick="ajouterPanierParNom(this)" ${tooExpensive ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function _updatePanierStep() {
  _refreshBudgetDisplay();
  renderBoutiqueGenerale();
  renderBoutiqueMagie();
  renderPanierStep();
}

function renderPanierStep() {
  const el = document.getElementById('boutique-panier');
  if (!el) return;
  if (!W.panier?.length) {
    el.innerHTML = '<div style="color:#555;font-size:0.78rem;font-style:italic;">Aucun item acheté.</div>';
    return;
  }
  el.innerHTML = W.panier.map(p => `
    <div class="panier-row">
      <span class="panier-nom">${esc(p.nom)}</span>
      <span class="panier-qte">×${p.quantite}</span>
      <span class="panier-prix">${Math.round(p.prix_po * p.quantite * 100) / 100} po</span>
      <button class="panier-remove" onclick="retirerPanier('${esc(p.nom)}')" title="Retirer un">−</button>
    </div>`).join('');
}

function selectEquipChoix(choix) {
  W.equipement_choix_classe = choix;
  const classeEquip = W.classe_data?.equipement_depart || W.classe_data?.niveaux?.['0']?.equipement_depart || [];
  const opt = classeEquip.find(o => o.choix === choix);

  // Mettre à jour visuellement les labels
  document.querySelectorAll('.equip-choix-row').forEach(el => {
    el.classList.toggle('selected', el.querySelector('input')?.value === choix);
  });
  const radio = document.querySelector(`input[name="equip-classe"][value="${choix}"]`);
  if (radio) radio.checked = true;

  // Mettre à jour W.equipement avec le contenu du choix sélectionné
  const bgEquip = W.bg_data?.equipement || [];
  W.equipement = [];

  // Vérifier si c\'est un choix "or uniquement" (contient uniquement des entrées en "po")
  const contenu = opt?.contenu || [];
  contenu.forEach(nom => {
    const poMatch = String(nom).match(/^(\d+)\s*po$/i);
    if (poMatch) {
      // C\'est de l\'or — stocker séparément
      W.equipement_or_depart = parseInt(poMatch[1]);
    } else {
      W.equipement.push({ nom, quantite: 1, source: 'classe' });
    }
  });

  // Ajouter l\'équipement du background
  bgEquip.forEach(e => {
    W.equipement.push({ nom: e.nom, quantite: e.quantite || 1, source: 'bg' });
  });

  // Activer/désactiver l\'onglet achat selon budget disponible
  _updateAchatTab();
  // Si on choisit une option sans or et qu\'on est en mode achat, repasser en pack
  if (W.equipement_mode === 'achat' && getBudgetAchat() === 0) {
    switchEquipTab('pack', false);
  }
}

// ─── BOUTIQUE D\'ACHAT LIBRE ──────────────────────────────────

function switchEquipTab(mode, doLoad) {
  W.equipement_mode = mode;
  document.getElementById('equip-panel-pack').style.display  = mode === 'pack'  ? '' : 'none';
  document.getElementById('equip-panel-achat').style.display = mode === 'achat' ? '' : 'none';
  document.getElementById('equip-tab-pack').classList.toggle('active',  mode === 'pack');
  document.getElementById('equip-tab-achat').classList.toggle('active', mode === 'achat');

  if (mode === 'achat') {
    // Calculer le budget disponible
    const budget = getBudgetAchat();
    document.getElementById('equip-budget-total').textContent   = budget;
    document.getElementById('equip-budget-restant').textContent = budget - depenseePanier();
    updateBudgetDisplay();
    if (doLoad !== false) loadCatalogue();
  }
}

function getBudgetAchat() {
  // Budget = or de départ du choix classe + or du background
  let total = 0;
  // Or du choix de classe (option "X po" uniquement)
  if (W.equipement_choix_classe) {
    const opt = (W.classe_data?.equipement_depart || W.classe_data?.niveaux?.['0']?.equipement_depart || []).find(o => o.choix === W.equipement_choix_classe);
    (opt?.contenu || []).forEach(nom => {
      const m = String(nom).match(/^(\d+)\s*po$/i);
      if (m) total += parseInt(m[1]);
    });
  }
  // Or du background (si champ or_depart présent)
  if (W.bg_data?.or_depart) total += W.bg_data.or_depart;
  return total;
}

function depenseePanier() {
  return (W.panier || []).reduce((s, i) => s + i.prix_po * (i.quantite || 1), 0);
}

function budgetRestant() {
  return getBudgetAchat() - depenseePanier();
}

function updateBudgetDisplay() {
  const restant = budgetRestant();
  const el = document.getElementById('equip-budget-restant');
  if (el) {
    el.textContent = Math.round(restant * 100) / 100;
    el.style.color = restant < 0 ? '#f87171' : restant === 0 ? '#4ade80' : '#e0e0e0';
  }
  const display = document.getElementById('equip-budget-display');
  if (display) display.classList.toggle('over-budget', restant < 0);
}

async function loadCatalogue() {
  if (W._catalogue.length > 0) { renderBoutique(); return; }
  document.getElementById('equip-boutique-list').innerHTML =
    '<div style="color:#888;text-align:center;padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>';
  try {
    const [armes, armures, equips] = await Promise.all([
      fetch(`${API}/GetArmes2024`).then(r => r.json()),
      fetch(`${API}/GetArmures2024`).then(r => r.json()),
      fetch(`${API}/GetEquipements2024`).then(r => r.json()),
    ]);
    W._catalogue = [
      ...armes.map(i => ({ ...i, type: 'arme' })),
      ...armures.map(i => ({ ...i, type: 'armure' })),
      ...equips,
    ].filter(i => i.prix);
    renderBoutique();
  } catch (e) {
    document.getElementById('equip-boutique-list').innerHTML =
      '<div style="color:#f66;text-align:center;padding:1rem;">Erreur de chargement.</div>';
  }
}

function filtrerBoutique() { renderBoutique(); }

function renderBoutique() {
  const search = (document.getElementById('equip-search')?.value || '').toLowerCase();
  const type   = document.getElementById('equip-filtre-type')?.value || '';

  const pool = W._catalogue.filter(i => {
    if (type && i.type !== type) return false;
    if (search && !i.nom.toLowerCase().includes(search)) return false;
    return true;
  });

  const budget = getBudgetAchat();
  const list   = document.getElementById('equip-boutique-list');
  if (!list) return;

  if (!budget) {
    list.innerHTML = '<div style="color:#888;font-size:0.8rem;text-align:center;padding:1.5rem;">Aucun budget disponible.<br>Choisissez une option de classe avec de l\'or (ex : "90 po").</div>';
    return;
  }

  if (!pool.length) {
    list.innerHTML = '<div style="color:#555;font-size:0.78rem;text-align:center;padding:1rem;">Aucun article trouvé.</div>';
    return;
  }

  list.innerHTML = pool.map(item => {
    const prixPo = prixEnPoItem(item.prix);
    const inPanier = (W.panier || []).find(p => p.nom === item.nom);
    const qte = inPanier?.quantite || 0;
    const tooExpensive = prixPo > budgetRestant() + (inPanier ? inPanier.prix_po * inPanier.quantite : 0);
    const prixStr = formatPrix(item.prix);
    let detail = '';
    if (item.type === 'arme' && item.degats) detail = item.degats.de + ' ' + item.degats.type;
    if (item.type === 'armure' && item.classe_armure) detail = 'CA ' + item.classe_armure.base + (item.classe_armure.modificateur_dex ? '+DEX' : '');
    return `<div class="boutique-row${tooExpensive && qte === 0 ? ' boutique-disabled' : ''}">
      <div class="boutique-row-info">
        <span class="boutique-nom">${esc(item.nom)}</span>
        ${detail ? `<span class="boutique-detail">${esc(detail)}</span>` : ''}
        <span class="boutique-type boutique-type-${item.type}">${item.type}</span>
      </div>
      <div class="boutique-row-actions">
        <span class="boutique-prix">${prixStr}</span>
        <div class="boutique-qty">
          <button class="boutique-btn-qty" onclick="retirerPanier('${esc(item.nom)}')" ${qte === 0 ? 'disabled' : ''}>−</button>
          <span class="boutique-qty-val">${qte}</span>
          <button class="boutique-btn-qty" data-item-nom="${esc(item.nom)}" onclick="ajouterPanierParNom(this)" ${tooExpensive ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPanier();
}

function prixEnPoItem(prix) {
  if (!prix) return 0;
  const { quantite, monnaie } = prix;
  switch (monnaie) {
    case 'po': return quantite;
    case 'pa': return Math.round(quantite / 10 * 100) / 100;
    case 'pc': return Math.round(quantite / 100 * 100) / 100;
    case 'pp': return quantite * 10;
    default:   return quantite;
  }
}

function formatPrix(prix) {
  if (!prix) return '—';
  return `${prix.quantite} ${prix.monnaie}`;
}

function ajouterPanierParNom(btn) {
  const nom = btn.dataset.itemNom;
  const found = W._catalogue.find(i => i.nom === nom);
  if (!found) return;
  ajouterPanier({ nom: found.nom, type: found.type, categorie: found.categorie || found.type, prix_po: prixEnPoItem(found.prix) });
}

function ajouterPanier(item) {
  if (budgetRestant() < item.prix_po) return;
  if (!W.panier) W.panier = [];
  const existing = W.panier.find(p => p.nom === item.nom);
  if (existing) { existing.quantite = (existing.quantite || 1) + 1; }
  else { W.panier.push({ ...item, quantite: 1 }); }
  // Sync W.equipement
  syncEquipementFromPanier();
  _updatePanierStep();
}

function retirerPanier(nom) {
  if (!W.panier) return;
  const idx = W.panier.findIndex(p => p.nom === nom);
  if (idx === -1) return;
  if (W.panier[idx].quantite > 1) { W.panier[idx].quantite--; }
  else { W.panier.splice(idx, 1); }
  syncEquipementFromPanier();
  _updatePanierStep();
}

function syncEquipementFromPanier() {
  // En mode achat, W.equipement = panier + équipement background
  const bgEquip = (W.bg_data?.equipement || []).map(e => ({ nom: e.nom, quantite: e.quantite || 1, source: 'bg' }));
  const panierItems = (W.panier || []).map(p => ({ nom: p.nom, quantite: p.quantite || 1, source: 'achat' }));
  W.equipement = [...panierItems, ...bgEquip];
  W.equipement_or_depart = Math.round(budgetRestant() * 100) / 100; // or restant = monnaie du perso
}

function renderPanier() {
  const el = document.getElementById('equip-panier');
  if (!el) return;
  if (!W.panier?.length) {
    el.innerHTML = '<div style="color:#555;font-size:0.78rem;font-style:italic;">Aucun item acheté.</div>';
    return;
  }
  el.innerHTML = W.panier.map(p => `
    <div class="panier-row">
      <span class="panier-nom">${esc(p.nom)}</span>
      <span class="panier-qte">×${p.quantite}</span>
      <span class="panier-prix">${Math.round(p.prix_po * p.quantite * 100) / 100} po</span>
      <button class="panier-remove" onclick="retirerPanier('${esc(p.nom)}')" title="Retirer un">−</button>
    </div>`).join('');
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

  if (!isCaster(W.classe_data, W.sc_data)) {
    section.style.display = 'none';
    nonLanceur.style.display = 'block';
    return;
  }
  section.style.display = 'block';
  nonLanceur.style.display = 'none';

  if (!W.sorts_choisis) W.sorts_choisis = {};

  // Pour les lanceurs tiers (sous-classe), les sorts viennent d\'une autre classe
  const _filtreSortsClasse = W.sc_data?.filtre_sorts_classe;
  const nomClasse = _filtreSortsClasse
    ? (_filtreSortsClasse.charAt(0).toUpperCase() + _filtreSortsClasse.slice(1))
    : (W.classe_data?.nom || '');
  const nbCantrips = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
  const niveaux    = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
  const mode       = MAGIE_MODE[getCasterKey()] || '';

  // Sous-titre
  let parts = [];
  if (nbCantrips > 0) parts.push(`${nbCantrips} sort(s) mineur(s)`);
  if (niveaux.length > 0) {
    if (mode === 'connus') {
      const nb = getNbSortsConnus(getCasterKey(), W.niveau);
      parts.push(`${nb} sort(s) connu(s)`);
    } else if (mode === 'prepares') {
      const nb = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats()));
      const carKey = getCaracIncantation(W.classe_data, W.sc_data) || 'INT';
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
  _updateBtnSuivant10();
}

function _renderSortsStep8() {
  const container  = document.getElementById('sorts-dynamic-sections');
  const nomClasse  = W.classe_data?.nom || '';
  const nbCantrips = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
  const niveaux    = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
  const mode       = MAGIE_MODE[getCasterKey()] || '';
  let html = '';

  // Bandeau global sorts niv 1+
  if (niveaux.length > 0) {
    let cible = 0, modeLabel = '';
    if (mode === 'connus')   { cible = getNbSortsConnus(getCasterKey(), W.niveau);   modeLabel = 'connus'; }
    if (mode === 'prepares') { cible = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats())); modeLabel = 'préparés'; }
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
  // Pour les lanceurs tiers (sous-classe), les sorts viennent d\'une autre classe
  const _filtreSortsClasse = W.sc_data?.filtre_sorts_classe;
  const nomClasse = _filtreSortsClasse
    ? (_filtreSortsClasse.charAt(0).toUpperCase() + _filtreSortsClasse.slice(1))
    : (W.classe_data?.nom || '');
  const nbCantrips = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;

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
  const niveaux = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
  if (!niveaux.length) return false;
  const mode = MAGIE_MODE[getCasterKey()];
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(getCasterKey(), W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats()));
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
    // Vérifier limites avant d\'ajouter
    const nbCantrips = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
    if (niveauSort === 0 && arr.length >= nbCantrips) return;
    if (niveauSort > 0  && _isAtMaxSorts())           return;
    arr.push(spellId);
  }

  _refreshSortsCounters();

  // Re-rendre toutes les listes (mise à jour disabled)
  const tousNiveaux = [0, ...getNiveauxSortsDisponibles(getCasterKey(), W.niveau)];
  tousNiveaux.forEach(n => _renderListeNiveau(n));
  _updateBtnSuivant10();
}

function _refreshSortsCounters() {
  const nbCantrips = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
  // Cantrips
  const bc = document.getElementById('sorts-counter-0');
  if (bc && nbCantrips > 0) {
    const nb = (W.sorts_choisis[0] || []).length;
    bc.textContent  = `${nb}/${nbCantrips}`;
    bc.className    = `sorts-counter-badge${nb >= nbCantrips ? ' done' : ''}`;
  }
  // Niveaux 1+
  const niveaux = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
  niveaux.forEach(n => {
    const b = document.getElementById(`sorts-counter-${n}`);
    if (b) b.textContent = (W.sorts_choisis[n] || []).length;
  });
  // Global
  const mode  = MAGIE_MODE[getCasterKey()] || '';
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(getCasterKey(), W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats()));
  const bg = document.getElementById('sorts-total-badge');
  if (bg && cible > 0) {
    const total = niveaux.reduce((acc, n) => acc + (W.sorts_choisis[n]?.length || 0), 0);
    bg.textContent = `${total}/${cible}`;
    bg.className   = `sorts-counter-badge${total >= cible ? ' done' : ''}`;
  }
}

function _updateBtnSuivant10() {
  if (W.step !== 10) return;
  const btn = document.getElementById('btn-next');
  if (!btn) return;
  const ok = _validateSorts8Silent();
  btn.disabled      = !ok;
  btn.style.opacity = ok ? '' : '0.4';
  btn.style.cursor  = ok ? '' : 'not-allowed';
}

function _validateSorts8Silent() {
  if (!isCaster(W.classe_data, W.sc_data)) return true;
  const nbC = (MAGIE_CANTRIPS[getCasterKey()] !== undefined) ? getNbCantrips(getCasterKey(), W.niveau) : 0;
  if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) return false;
  const niveaux = getNiveauxSortsDisponibles(getCasterKey(), W.niveau);
  if (!niveaux.length) return true;
  const mode  = MAGIE_MODE[getCasterKey()] || '';
  let cible = 0;
  if (mode === 'connus')   cible = getNbSortsConnus(getCasterKey(), W.niveau);
  if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(getCasterKey(), W.niveau, finalStats()));
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
  collectStep(11);
  const niv = W.niveau;
  const stats = finalStats();
  const bm = BONUS_MAITRISE[Math.min(niv-1,19)];
  const dexMod = mod(stats.DEX);
  const pvMax = pvTotalCalc();
  const ca = 10 + dexMod;
  const init = dexMod;

  // Jets de sauvegarde
  const saves = W.classe_data?.sauvegardes_maitrise || [];
  const savesHtml = ['FOR','DEX','CON','INT','SAG','CHA'].map(k => {
    const hasMaitrise = saves.map(s => s.toUpperCase()).includes(k);
    const val = mod(stats[k]) + (hasMaitrise ? bm : 0);
    return `<div class="recap-row"><span class="recap-label">${k}</span><span class="recap-val">${fmtMod(val)} ${hasMaitrise?'✓':''}</span></div>`;
  }).join('');

  // Compétences choisies
  const especeCompsFixedRecap = (W.espece_data?.competences_maitrises || [])
    .filter(m => !String(m).startsWith('au_choix'));
  const allComps = [...new Set([
    ...(W.bg_data?.competences || []),
    ...especeCompsFixedRecap,
    ...W.competences_choisies
  ])];
  const compsHtml = W._competences
    .filter(c => allComps.some(ac => normalizeComp(ac) === normalizeComp(c.nom)))
    .map(c => {
      const val = mod(stats[c.car]) + bm;
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
        `<div class="recap-row"><span class="recap-label">${k}</span><span class="recap-val">${stats[k]} (${fmtMod(mod(stats[k]))})</span></div>`
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
      const tousNiv = [0, ...getNiveauxSortsDisponibles(getCasterKey(), W.niveau)];
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

function validateCharacter() {
  // 1. Nom
  if (!W.nom?.trim()) { alert('Le nom du personnage est obligatoire.'); return false; }
  // 2. Espèce
  if (!W.espece) { alert('Sélectionnez une espèce.'); return false; }
  if ((W.espece_data?.variantes || []).length > 0 && !W.espece_variante) {
    alert('Sélectionnez un lignage pour votre espèce.'); return false;
  }
  // 3. Classe
  if (!W.classe) { alert('Sélectionnez une classe.'); return false; }
  // 4. Sous-classe obligatoire si niveau requis
  const unlock = getNiveauSousClasse(W.classe_data);
  if ((W.niveau || 1) >= unlock && !W.sous_classe) {
    alert('Sélectionnez une sous-classe (obligatoire à partir du niveau ' + unlock + ').'); return false;
  }
  // 5. Background
  if (!W.background) { alert('Sélectionnez un historique.'); return false; }
  if (!bgBonusIsValid()) { alert('Répartissez les bonus de caractéristiques du background.'); return false; }
  // 6. Stats
  if (W.stats_method === 'standard') {
    if (!STAT_KEYS.every(k => W.stats_assigned[k] !== null)) {
      alert('Distribuez toutes les valeurs standard.'); return false;
    }
  } else if (W.stats_method === 'pointbuy') {
    if (pbTotalSpent() !== PB_BUDGET) {
      alert('Dépensez exactement ' + PB_BUDGET + ' points.'); return false;
    }
  } else if (!W.stats_method) {
    alert('Choisissez une méthode d\'attribution des caractéristiques.'); return false;
  }
  // 7. PV
  if (!pvAllSet()) { alert('Choisissez les points de vie pour chaque niveau.'); return false; }
  // 8. Compétences
  const nSlots = getExpertiseSlots(W.classe, W.niveau);
  if (nSlots > 0 && W.competences_expertise.length < nSlots) {
    alert('Choisissez ' + nSlots + ' compétence(s) pour l\'Expertise.'); return false;
  }
  // 9. Sorts (si lanceur)
  if (isCaster(W.classe_data, W.sc_data)) {
    const _ck = getCasterKey();
    const nbC = (MAGIE_CANTRIPS[_ck] !== undefined) ? getNbCantrips(_ck, W.niveau) : 0;
    if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) {
      alert('Choisissez ' + nbC + ' sort(s) mineur(s).'); return false;
    }
    const niveauxS = getNiveauxSortsDisponibles(_ck, W.niveau);
    if (niveauxS.length > 0) {
      const mode = MAGIE_MODE[_ck] || '';
      let cible = 0;
      if (mode === 'connus')   cible = getNbSortsConnus(_ck, W.niveau);
      if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(_ck, W.niveau, finalStats()));
      if (cible > 0) {
        const total = niveauxS.reduce((acc, nv) => acc + (W.sorts_choisis[nv]?.length || 0), 0);
        if (total < cible) {
          const label = mode === 'connus' ? 'connus' : 'préparés';
          alert('Choisissez ' + cible + ' sort(s) ' + label + '. (' + total + '/' + cible + ')'); return false;
        }
      }
    }
  }
  // 10. Équipement : un choix de classe doit être fait
  if ((W.classe_data?.equipement_depart || W.classe_data?.niveaux?.['0']?.equipement_depart || []).length > 0 && !W.equipement_choix_classe) {
    alert('Choisissez une option d\'équipement pour votre classe.'); return false;
  }
  return true;
}

async function creerPersonnage() {
  collectStep(W.step);
  if (!validateCharacter()) return;
  const niv = W.niveau;
  const bm = BONUS_MAITRISE[Math.min(niv-1,19)];
  const stats = finalStats();
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

  const especeCompsFixed = (W.espece_data?.competences_maitrises || [])
    .filter(m => !String(m).startsWith('au_choix'));
  const allComps = [...new Set([
    ...(W.bg_data?.competences || []),
    ...especeCompsFixed,
    ...W.competences_choisies
  ])];
  const competences = W._competences.filter(c =>
    allComps.some(ac => normalizeComp(ac) === normalizeComp(c.nom))
  ).map(c => ({
    nom: c.nom, caracteristique: c.car, maitrise: true,
    expertise: W.competences_expertise.some(e => normalizeComp(e) === normalizeComp(c.nom)),
    valeur: mod(stats[c.car]) + bm * (W.competences_expertise.some(e => normalizeComp(e) === normalizeComp(c.nom)) ? 2 : 1)
  }));

  const pvMax = pvTotalCalc();
  const ca = 10 + mod(stats.DEX);

  // Sorts — flatten sorts_choisis par niveau
  const _casterKey = getCasterKey();
  const tousNiveauxSorts = [0, ...getNiveauxSortsDisponibles(_casterKey, niv)];
  const sortsConnus = [];
  for (const nv of tousNiveauxSorts) {
    const ids    = W.sorts_choisis?.[nv] || [];
    const pool   = W._sortsParNiveau?.[nv] || [];
    ids.forEach(id => {
      const s = pool.find(x => x.id === id);
      if (s) sortsConnus.push({ id: s.id, nom: s.nom, niveau: nv, ecole: s.ecole||'', portee: s.portee||'', duree: s.duree||'', temps_incantation: s.temps_incantation||'', concentration: !!s.concentration, rituel: !!s.rituel, description: (s.description||'').slice(0,300) });
    });
  }
  const carIncant = getCaracIncantation(W.classe_data, W.sc_data);

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
    bonus_background: { ...W.bg_bonus },
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
        ? getSlotsEmplacements(_casterKey, niv)
        : [],
      sorts_connus: sortsConnus,
      sorts_raciaux: W.sorts_raciaux || []
    },
    equipement: W.equipement,
    monnaie: { pp: 0, po: W.equipement_or_depart || 0, pe: 0, pa: 0, pc: 0 },
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
    historique_perso: W.historique_perso,
    sprite_url: W.sprite_url || ''
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
      clearWizardDraft();
      // Si race homebrew en draft → demander un rapport avant de rediriger
      if (W.espece_data?._homebrew && W.espece_data?._statut === 'draft') {
        montrerModalRapport(W.espece_data._race_id, data._id);
      } else {
        window.location.href = `fiche-personnage.html?id=${data._id}`;
      }
    } else {
      alert('Erreur : ' + (data.error || 'inconnue'));
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Créer le personnage !';
    }
  } catch (e) {
    alert('Erreur réseau : ' + e.message);
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Créer le personnage !';
  }
}

// ─── RAPPORT RACE HOMEBREW ────────────────────────────────────

function montrerModalRapport(raceId, persoId) {
  const modal = document.getElementById('modal-rapport-race');
  if (!modal) { window.location.href = `fiche-personnage.html?id=${persoId}`; return; }
  modal.dataset.raceId = raceId;
  modal.dataset.persoId = persoId;
  modal.classList.remove('hidden');
}

window.soumettreRapport = async function(approbation) {
  const modal = document.getElementById('modal-rapport-race');
  const raceId = modal.dataset.raceId;
  const persoId = modal.dataset.persoId;
  const commentaire = document.getElementById('rapport-commentaire')?.value.trim() || '';

  try {
    await fetch(`${API}/Races/${raceId}/rapport`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ approbation, commentaire }),
    });
  } catch { /* non bloquant */ }

  window.location.href = `fiche-personnage.html?id=${persoId}`;
};

window.passerRapport = function() {
  const modal = document.getElementById('modal-rapport-race');
  const persoId = modal.dataset.persoId;
  window.location.href = `fiche-personnage.html?id=${persoId}`;
};

// ─── DÉMARRAGE ────────────────────────────────────────────────

waitForAuth(() => {});
