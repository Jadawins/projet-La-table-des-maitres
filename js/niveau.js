/* =============================================================
   NIVEAU.JS — Système de montée en niveau
   ============================================================= */

const XP_PAR_NIVEAU = {
  1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000,
  9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000,
  15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000
};

const DV_PAR_CLASSE = {
  barbare:6, barde:4, clerc:4, druide:4, ensorceleur:3,
  guerrier:5, magicien:3, moine:4, occultiste:4, paladin:5,
  rodeur:5, roublard:4
};

const DV_VALEUR_PAR_CLASSE = {
  barbare:'d12', barde:'d8', clerc:'d8', druide:'d8', ensorceleur:'d6',
  guerrier:'d10', magicien:'d6', moine:'d8', occultiste:'d8', paladin:'d10',
  rodeur:'d10', roublard:'d8'
};

// Niveaux où on gagne une Amélioration (carac ou don)
const NIVEAUX_AMELIORATION = {
  barbare:[4,8,12,16,19], barde:[4,8,12,16,19], clerc:[4,8,12,16,19],
  druide:[4,8,12,16,19], ensorceleur:[4,8,12,16,19], guerrier:[4,6,8,12,14,16,19],
  magicien:[4,8,12,16,19], moine:[4,8,12,16,19], occultiste:[4,8,12,16,19],
  paladin:[4,8,12,16,19], rodeur:[4,8,12,16,19], roublard:[4,8,10,12,16,19]
};

// Classes lanceuses de sorts
const CLASSES_SORTS = ['barde','clerc','druide','ensorceleur','magicien','occultiste','paladin','rodeur'];

// Emplacements de sorts par classe/niveau (simplifié — slots total par niveau de sort)
const SLOTS_PAR_CLASSE_NIVEAU = {
  magicien: {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  },
  clerc: {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  },
  druide: {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  },
  barde: {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  },
  paladin: {
    1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0],
    4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0],
    7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0],
    10:[4,3,2,0,0,0,0,0,0],11:[4,3,3,0,0,0,0,0,0],12:[4,3,3,0,0,0,0,0,0],
    13:[4,3,3,1,0,0,0,0,0],14:[4,3,3,1,0,0,0,0,0],15:[4,3,3,2,0,0,0,0,0],
    16:[4,3,3,2,0,0,0,0,0],17:[4,3,3,3,1,0,0,0,0],18:[4,3,3,3,1,0,0,0,0],
    19:[4,3,3,3,2,0,0,0,0],20:[4,3,3,3,2,0,0,0,0]
  },
  rodeur: {
    1:[0,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[3,0,0,0,0,0,0,0,0],
    4:[3,0,0,0,0,0,0,0,0], 5:[4,2,0,0,0,0,0,0,0], 6:[4,2,0,0,0,0,0,0,0],
    7:[4,3,0,0,0,0,0,0,0], 8:[4,3,0,0,0,0,0,0,0], 9:[4,3,2,0,0,0,0,0,0],
    10:[4,3,2,0,0,0,0,0,0],11:[4,3,3,0,0,0,0,0,0],12:[4,3,3,0,0,0,0,0,0],
    13:[4,3,3,1,0,0,0,0,0],14:[4,3,3,1,0,0,0,0,0],15:[4,3,3,2,0,0,0,0,0],
    16:[4,3,3,2,0,0,0,0,0],17:[4,3,3,3,1,0,0,0,0],18:[4,3,3,3,1,0,0,0,0],
    19:[4,3,3,3,2,0,0,0,0],20:[4,3,3,3,2,0,0,0,0]
  },
  ensorceleur: {
    1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
    4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
    7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
    10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
    13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
    16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
    19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
  },
  occultiste: {
    1:[1,0,0,0,0,0,0,0,0], 2:[2,0,0,0,0,0,0,0,0], 3:[0,2,0,0,0,0,0,0,0],
    4:[0,2,0,0,0,0,0,0,0], 5:[0,0,2,0,0,0,0,0,0], 6:[0,0,2,0,0,0,0,0,0],
    7:[0,0,0,2,0,0,0,0,0], 8:[0,0,0,2,0,0,0,0,0], 9:[0,0,0,0,2,0,0,0,0],
    10:[0,0,0,0,2,0,0,0,0],11:[0,0,0,0,3,0,0,0,0],12:[0,0,0,0,3,0,0,0,0],
    13:[0,0,0,0,3,0,0,0,0],14:[0,0,0,0,3,0,0,0,0],15:[0,0,0,0,3,0,0,0,0],
    16:[0,0,0,0,3,0,0,0,0],17:[0,0,0,0,4,0,0,0,0],18:[0,0,0,0,4,0,0,0,0],
    19:[0,0,0,0,4,0,0,0,0],20:[0,0,0,0,4,0,0,0,0]
  }
};

// ─── État wizard ──────────────────────────────────────────────
let _wizardPerso     = null;
let _wizardNouveauNiv = 0;
let _wizardEtapes    = [];
let _wizardEtapeIdx  = 0;
let _wizardChoix     = { pv_gagne: 0, sous_classe: null, don: null, amelioration_carac: null };
let _classeData      = null;
let _donsData        = [];
let _sousClassesData = [];

function niveauDepuisXP(xp) {
  for (let i = 20; i >= 2; i--) { if ((xp || 0) >= XP_PAR_NIVEAU[i]) return i; }
  return 1;
}

function bonusMaitriseDepuisNiveau(n) {
  if (n >= 17) return 6; if (n >= 13) return 5;
  if (n >= 9)  return 4; if (n >= 5)  return 3; return 2;
}

// ─── RENDU BARRE XP ───────────────────────────────────────────
function renderBarreXP(perso) {
  const container = document.getElementById('xp-section');
  if (!container) return;

  const xp        = perso.experience || 0;
  const niveau    = perso.niveau || 1;
  const estJalon  = perso.progression === 'jalon';

  if (estJalon) {
    container.innerHTML = `
      <div class="xp-section">
        <div class="xp-label-row">
          <span>Niveau <strong style="color:#c9a84c;">${niveau}</strong></span>
          <span class="xp-next">Progression par jalon</span>
        </div>
        <div class="xp-jalon-label">⚑ Système de jalon — XP non utilisé</div>
      </div>`;
    return;
  }

  const xpNext = niveau < 20 ? XP_PAR_NIVEAU[niveau + 1] : null;
  const xpPrev = XP_PAR_NIVEAU[niveau] || 0;
  const pct = xpNext ? Math.min(100, Math.round(((xp - xpPrev) / (xpNext - xpPrev)) * 100)) : 100;
  const levelUpDisponible = xpNext && xp >= xpNext;

  container.innerHTML = `
    <div class="xp-section">
      <div class="xp-label-row">
        <span>Niveau <strong style="color:#c9a84c;">${niveau}</strong></span>
        <span class="xp-total">🌟 ${xp.toLocaleString('fr')} XP</span>
        <span class="xp-next">${xpNext ? `/ ${xpNext.toLocaleString('fr')} (${pct}%)` : 'Niveau max'}</span>
      </div>
      <div class="xp-bar-track">
        <div class="xp-bar-fill" style="width:${pct}%"></div>
      </div>
    </div>`;

  // Badge level-up
  const badge = document.getElementById('levelup-badge');
  if (badge) {
    const dejaVisible = badge.classList.contains('visible');
    if (levelUpDisponible) {
      badge.textContent = `⬆️ Niveau ${niveau + 1} disponible !`;
      badge.classList.add('visible');
      badge.onclick = () => lancerWizardNiveau(window._perso);
      // Toast notification si le badge vient d'apparaître
      if (!dejaVisible && typeof toastLocal === 'function') {
        toastLocal('level_up', `⬆️ Niveau ${niveau + 1} disponible !`, `${perso.nom || 'Votre personnage'} peut monter en niveau.`);
      }
    } else {
      badge.classList.remove('visible');
    }
  }
}

// ─── CONFETTIS ────────────────────────────────────────────────
function lancerConfettis() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['#f5c842','#7c3aed','#4ade80','#f87171','#60a5fa','#fb923c'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left   = Math.random() * 100 + 'vw';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width  = (6 + Math.random() * 6) + 'px';
    piece.style.height = (6 + Math.random() * 6) + 'px';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.animationDelay    = (Math.random() * 1) + 's';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 5000);
}

// ─── OUVRIR WIZARD ────────────────────────────────────────────
async function lancerWizardNiveau(perso) {
  _wizardPerso      = perso;
  _wizardNouveauNiv = (perso.niveau || 1) + 1;
  _wizardChoix      = { pv_gagne: 0, sous_classe: null, don: null, amelioration_carac: null };

  // Charger données classe
  const classe = (perso.classe || 'guerrier').toLowerCase();
  try {
    const r = await fetch(`/Json/2024/Classe/${classe}.json`);
    _classeData = r.ok ? await r.json() : null;
  } catch { _classeData = null; }

  // Charger dons si niveau amélioration
  const niveauxAmel = NIVEAUX_AMELIORATION[classe] || [];
  if (niveauxAmel.includes(_wizardNouveauNiv)) {
    try {
      const r = await fetch('/Json/2024/Don/dons.json');
      _donsData = r.ok ? await r.json() : [];
    } catch { _donsData = []; }
  }

  // Charger sous-classes si niveau 3
  if (_wizardNouveauNiv === 3) {
    _sousClassesData = await _chargerSousClasses(classe);
  }

  _construireEtapes(perso, classe);
  _wizardEtapeIdx = 0;
  _renderWizard();
  document.getElementById('modal-levelup').classList.remove('hidden');
}

async function _chargerSousClasses(classe) {
  // On connait les fichiers par convention : classe_*.json
  const suffixes = {
    barbare: ['berserker','voie_arbre_monde','voie_coeur_sauvage','voie_zelateur'],
    barde:   ['college_danse','college_savoir','college_seduction','college_vaillance'],
    clerc:   ['domaine_guerre','domaine_lumiere','domaine_ruse','domaine_vie'],
    druide:  ['cercle_astres','cercle_lune','cercle_mers','cercle_terre'],
    ensorceleur:['sorcellerie_aberrante','sorcellerie_draconique','sorcellerie_mecanique','sorcellerie_sauvage'],
    guerrier:['champion','chevalier_occulte','maitre_guerre','soldat_psi'],
    magicien:['abjurateur','devin','evocateur','illusionniste'],
    moine:   ['credo_elements','credo_misericorde','credo_ombre','credo_paume'],
    occultiste:['protecteur_archifee','protecteur_celeste','protecteur_fielon','protecteur_grand_ancien'],
    paladin: ['serment_anciens','serment_devotion','serment_vengeance','serment_gloire'],
    rodeur:  ['belluaire','chasseur','traqueur_tenebres','vagabond_feerique'],
    roublard:['ame_aceree','arnaqueur_arcanique','assassin','voleur']
  };
  const noms = suffixes[classe] || [];
  const resultats = [];
  for (const s of noms) {
    try {
      const r = await fetch(`/Json/2024/SousClasse/${classe}_${s}.json`);
      if (r.ok) { const d = await r.json(); resultats.push({ id: s, ...d }); }
    } catch {}
  }
  return resultats;
}

function _construireEtapes(perso, classe) {
  const niv = _wizardNouveauNiv;
  _wizardEtapes = ['pv', 'capacites'];
  if (niv === 3) _wizardEtapes.push('sous_classe');
  const niveauxAmel = NIVEAUX_AMELIORATION[classe] || [];
  if (niveauxAmel.includes(niv)) _wizardEtapes.push('don_carac');
  const estLanceur = (typeof getTypeLanceur === 'function')
    ? getTypeLanceur(classe) !== 'aucun'
    : CLASSES_SORTS.includes(classe) && !!SLOTS_PAR_CLASSE_NIVEAU[classe]?.[niv];
  if (estLanceur) _wizardEtapes.push('sorts');
  _wizardEtapes.push('recap');
}

// ─── RENDER WIZARD ───────────────────────────────────────────
function _renderWizard() {
  const ancienNiv = _wizardPerso.niveau || 1;
  const modal = document.getElementById('modal-levelup');

  // En-tête
  modal.querySelector('.niv-wizard-title').textContent =
    `🎉 ${_wizardPerso.nom} passe niveau ${ancienNiv} → ${_wizardNouveauNiv} !`;
  modal.querySelector('.niv-wizard-subtitle').textContent =
    `${capitalize(_wizardPerso.classe || '')} — Niv. ${_wizardNouveauNiv}`;

  // Stepper
  const stepper = modal.querySelector('.niv-stepper');
  const LABELS = { pv:'PV', capacites:'Capacités', sous_classe:'Sous-classe',
                   don_carac:'Don/Carac', sorts:'Sorts', recap:'Récap' };
  stepper.innerHTML = _wizardEtapes.map((e, i) => {
    let cls = '';
    if (i < _wizardEtapeIdx) cls = 'done';
    else if (i === _wizardEtapeIdx) cls = 'active';
    return `<div class="niv-step-dot ${cls}" title="${LABELS[e]}">${i < _wizardEtapeIdx ? '✓' : (i + 1)}</div>`;
  }).join('');

  // Afficher la bonne étape
  modal.querySelectorAll('.niv-step').forEach(s => s.classList.remove('active'));
  const etape = _wizardEtapes[_wizardEtapeIdx];
  const stepEl = modal.querySelector(`.niv-step[data-step="${etape}"]`);
  if (stepEl) stepEl.classList.add('active');

  // Remplir le contenu
  if (etape === 'pv')         _renderEtapePV(stepEl);
  if (etape === 'capacites')  _renderEtapeCapacites(stepEl);
  if (etape === 'sous_classe')_renderEtapeSousClasse(stepEl);
  if (etape === 'don_carac')  _renderEtapeDonCarac(stepEl);
  if (etape === 'sorts')      _renderEtapeSorts(stepEl);
  if (etape === 'recap')      _renderEtapeRecap(stepEl);

  // Navigation
  const btnPrev = modal.querySelector('.niv-btn-prev');
  const btnNext = modal.querySelector('.niv-btn-next');
  btnPrev.style.visibility = _wizardEtapeIdx === 0 ? 'hidden' : 'visible';
  if (etape === 'recap') {
    btnNext.style.display = 'none';
    modal.querySelector('.niv-btn-confirm').style.display = 'inline-flex';
  } else {
    btnNext.style.display = 'inline-flex';
    modal.querySelector('.niv-btn-confirm').style.display = 'none';
  }
}

function capitalize(s) { return String(s||'').charAt(0).toUpperCase() + s.slice(1); }

// ─── ÉTAPES ──────────────────────────────────────────────────

function _renderEtapePV(el) {
  const classe = (_wizardPerso.classe || 'guerrier').toLowerCase();
  const dvType = DV_VALEUR_PAR_CLASSE[classe] || 'd8';
  const dvMax  = DV_PAR_CLASSE[classe] || 4;
  const conMod = Math.floor((((_wizardPerso.caracteristiques?.CON?.valeur) || 10) - 10) / 2);
  const conStr = conMod >= 0 ? `+${conMod}` : `${conMod}`;
  const valeurFixe = Math.ceil(dvMax / 2) + 1 + conMod; // moyenne arrondie sup

  el.querySelector('.niv-pv-hint').textContent = `Lancez 1${dvType} + mod. CON (${conStr})`;

  // Options
  el.querySelectorAll('.niv-pv-option').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.niv-pv-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const isLancer = opt.dataset.mode === 'lancer';
      el.querySelector('.niv-pv-lancer-row').style.display = isLancer ? 'flex' : 'none';
      el.querySelector('.niv-pv-fixe-row').style.display   = isLancer ? 'none' : 'flex';
      if (!isLancer) {
        _wizardChoix.pv_gagne = Math.max(1, valeurFixe);
        el.querySelector('.niv-pv-fixe-val').textContent = `+${Math.max(1, valeurFixe)} PV max`;
        _updatePVTotal(el, conMod);
      }
    });
  });

  el.querySelector('.niv-pv-fixe-val').textContent = `+${Math.max(1, valeurFixe)} PV max`;

  const inputDV = el.querySelector('#niv-pv-lancé');
  if (inputDV) {
    inputDV.oninput = () => {
      const val = parseInt(inputDV.value) || 0;
      _wizardChoix.pv_gagne = Math.max(1, val + conMod);
      _updatePVTotal(el, conMod);
    };
  }

  // Sélectionner "fixe" par défaut
  el.querySelectorAll('.niv-pv-option')[1]?.click();
}

function _updatePVTotal(el, conMod) {
  const pvActuel = _wizardPerso.combat?.pv_max || 0;
  const gain = _wizardChoix.pv_gagne || 0;
  el.querySelector('.niv-pv-total').textContent = `PV max : ${pvActuel} → ${pvActuel + gain} (+${gain})`;
}

function _renderEtapeCapacites(el) {
  const liste = el.querySelector('.niv-capacite-list');
  const capacites = _classeData?.niveaux?.[String(_wizardNouveauNiv)]?.capacites || [];

  if (!capacites.length) {
    liste.innerHTML = '<p style="font-size:0.82rem;color:#888;text-align:center;padding:1rem;">Aucune nouvelle capacité à ce niveau.</p>';
    return;
  }
  liste.innerHTML = capacites.map(c => `
    <div class="niv-capacite-card">
      <span class="badge-new">NOUVEAU</span>
      <div class="niv-cap-nom">${c.nom || ''}</div>
      <div class="niv-cap-desc">${c.description || ''}</div>
    </div>`).join('');
}

function _renderEtapeSousClasse(el) {
  const grid = el.querySelector('.niv-sousclasse-grid');
  if (!_sousClassesData.length) {
    grid.innerHTML = '<p style="font-size:0.82rem;color:#888;">Aucune sous-classe chargée.</p>';
    return;
  }
  grid.innerHTML = _sousClassesData.map(sc => `
    <div class="niv-sc-card ${_wizardChoix.sous_classe === sc.id ? 'selected' : ''}"
         onclick="selectionnerSousClasse('${sc.id}',this)">
      <div class="niv-sc-nom">${sc.nom || sc.id}</div>
      <div class="niv-sc-desc">${sc.description?.substring?.(0,80) || ''}…</div>
    </div>`).join('');
}

function selectionnerSousClasse(id, el) {
  _wizardChoix.sous_classe = id;
  document.querySelectorAll('.niv-sc-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const sc = _sousClassesData.find(s => s.id === id);
  const detail = document.getElementById('niv-sc-detail');
  if (detail && sc) {
    detail.innerHTML = `<strong style="color:#c4b5fd;">${sc.nom}</strong><br><span style="font-size:0.78rem;color:#aaa;">${sc.description || ''}</span>`;
    detail.style.display = 'block';
  }
}
window.selectionnerSousClasse = selectionnerSousClasse;

function _renderEtapeDonCarac(el) {
  const classe = (_wizardPerso.classe || '').toLowerCase();
  const conStr = `+2 à une carac OU +1/+1 à deux caracs différentes`;
  el.querySelector('#niv-carac-info').textContent = conStr;

  // Grille caractéristiques
  const caracGrid = el.querySelector('.niv-carac-grid');
  const CARACS = ['FOR','DEX','CON','INT','SAG','CHA'];
  const caracs = _wizardPerso.caracteristiques || {};
  caracGrid.innerHTML = CARACS.map(k => {
    const val = caracs[k]?.valeur || 10;
    const maxed = val >= 20;
    return `<div class="niv-carac-item ${maxed ? 'maxed' : ''}">
      <label><input type="checkbox" class="niv-carac-check" data-car="${k}" ${maxed ? 'disabled' : ''} onchange="toggleCaracCheck(this)"> ${k}</label>
      <div class="niv-carac-val" id="niv-val-${k}">${val}</div>
    </div>`;
  }).join('');

  // Liste dons
  const donList = el.querySelector('.niv-don-list');
  const niveau  = _wizardNouveauNiv;
  const eligibles = _donsData.filter(d => !d.prerequis?.niveau || d.prerequis.niveau <= niveau);
  donList.innerHTML = eligibles.length
    ? eligibles.map(d => `
        <div class="niv-don-item ${_wizardChoix.don?.id === d.id ? 'selected' : ''}"
             onclick="selectionnerDon('${d.id}',this)">
          <div class="don-nom">${d.nom}</div>
          <div class="don-desc">${(d.description || '').substring(0,120)}…</div>
        </div>`).join('')
    : '<p style="font-size:0.8rem;color:#888;">Aucun don disponible.</p>';

  // Sélectionner mode par défaut
  el.querySelectorAll('.niv-don-option').forEach(opt => {
    opt.addEventListener('click', () => {
      el.querySelectorAll('.niv-don-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const mode = opt.dataset.mode;
      el.querySelector('#niv-carac-block').style.display = mode === 'carac' ? 'block' : 'none';
      el.querySelector('#niv-don-block').style.display   = mode === 'don'   ? 'block' : 'none';
      if (mode === 'don') { _wizardChoix.amelioration_carac = null; }
      else { _wizardChoix.don = null; }
    });
  });
  el.querySelectorAll('.niv-don-option')[0]?.click();
}

let _caraChecked = [];
function toggleCaracCheck(checkbox) {
  const car = checkbox.dataset.car;
  if (checkbox.checked) {
    _caraChecked.push(car);
    if (_caraChecked.length > 2) {
      const old = _caraChecked.shift();
      document.querySelector(`.niv-carac-check[data-car="${old}"]`).checked = false;
    }
  } else {
    _caraChecked = _caraChecked.filter(c => c !== car);
  }
  // Appliquer +2 ou +1/+1
  _wizardChoix.amelioration_carac = {};
  if (_caraChecked.length === 1) {
    _wizardChoix.amelioration_carac[_caraChecked[0]] = 2;
  } else if (_caraChecked.length === 2) {
    _wizardChoix.amelioration_carac[_caraChecked[0]] = 1;
    _wizardChoix.amelioration_carac[_caraChecked[1]] = 1;
  }
  // Mettre à jour affichage valeurs
  const caracs = _wizardPerso.caracteristiques || {};
  for (const [k, delta] of Object.entries(_wizardChoix.amelioration_carac)) {
    const el = document.getElementById(`niv-val-${k}`);
    if (el) el.textContent = Math.min(20, (caracs[k]?.valeur || 10) + delta);
  }
}
window.toggleCaracCheck = toggleCaracCheck;

function selectionnerDon(id, el) {
  _wizardChoix.don = _donsData.find(d => d.id === id) || { id };
  document.querySelectorAll('.niv-don-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}
window.selectionnerDon = selectionnerDon;

function _renderEtapeSorts(el) {
  const classe = (_wizardPerso.classe || '').toLowerCase();
  const content = el.querySelector('.niv-sorts-content');

  // Utiliser magie-tables si disponible
  if (typeof getSlotsEmplacements === 'function') {
    const type = getTypeLanceur(classe);
    if (type === 'aucun') { content.innerHTML = '<p style="color:#888;">Cette classe ne lance pas de sorts.</p>'; return; }

    if (type === 'pacte') {
      const ancPacte = _TABLE_PACTE[_wizardNouveauNiv - 1] || {nombre:0,niveau:1};
      const nouvPacte = _TABLE_PACTE[_wizardNouveauNiv] || {nombre:0,niveau:1};
      const niveauChange = nouvPacte.niveau !== ancPacte.niveau ? ` (niveau ${ancPacte.niveau} → ${nouvPacte.niveau})` : '';
      const nbChange = nouvPacte.nombre !== ancPacte.nombre ? ` (+${nouvPacte.nombre - ancPacte.nombre})` : '';
      content.innerHTML = `
        <p style="font-size:0.82rem;color:#aaa;margin-bottom:0.5rem;">Emplacements de Pacte (reset repos court)</p>
        <table class="niv-slots-table"><thead><tr><th>Nb emplacements</th><th>Niveau emplacement</th></tr></thead>
        <tbody><tr>
          <td class="${nouvPacte.nombre > ancPacte.nombre ? 'niv-slot-new' : ''}">${nouvPacte.nombre}${nbChange}</td>
          <td class="${nouvPacte.niveau > ancPacte.niveau ? 'niv-slot-new' : ''}">${nouvPacte.niveau}${niveauChange}</td>
        </tr></tbody></table>`;
      return;
    }

    const slotsAnc  = getSlotsEmplacements(classe, _wizardNouveauNiv - 1);
    const slotsNouv = getSlotsEmplacements(classe, _wizardNouveauNiv);

    const ancMap  = {};
    slotsAnc.forEach(s => { ancMap[s.niveau] = s.total; });
    const nouvMap = {};
    slotsNouv.forEach(s => { nouvMap[s.niveau] = s.total; });

    const tousNiveaux = [...new Set([...Object.keys(ancMap), ...Object.keys(nouvMap)].map(Number))].sort((a,b)=>a-b);
    let rows = '';
    for (const niv of tousNiveaux) {
      const anc  = ancMap[niv]  || 0;
      const nouv = nouvMap[niv] || 0;
      if (nouv === 0 && anc === 0) continue;
      const diff = nouv - anc;
      rows += `<tr><td>Niveau ${niv}</td><td>${anc}</td><td class="${diff > 0 ? 'niv-slot-new' : ''}">${nouv} ${diff > 0 ? `(+${diff})` : ''}</td></tr>`;
    }
    content.innerHTML = rows
      ? `<table class="niv-slots-table"><thead><tr><th>Niveau sort</th><th>Avant</th><th>Après</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p style="font-size:0.82rem;color:#888;">Aucun changement d\'emplacement.</p>';
    return;
  }

  // Fallback legacy
  const slots = SLOTS_PAR_CLASSE_NIVEAU[classe];
  if (!slots) { content.innerHTML = '<p style="color:#888;">Pas d\'emplacements pour cette classe.</p>'; return; }

  const slotsAnc = slots[_wizardNouveauNiv - 1] || [0,0,0,0,0,0,0,0,0];
  const slotsNouv = slots[_wizardNouveauNiv] || [0,0,0,0,0,0,0,0,0];

  let rows = '';
  for (let i = 0; i < 9; i++) {
    if (slotsNouv[i] === 0 && slotsAnc[i] === 0) continue;
    const diff = slotsNouv[i] - slotsAnc[i];
    rows += `<tr>
      <td>Niveau ${i+1}</td>
      <td>${slotsAnc[i]}</td>
      <td class="${diff > 0 ? 'niv-slot-new' : ''}">${slotsNouv[i]} ${diff > 0 ? `(+${diff})` : ''}</td>
    </tr>`;
  }

  el.querySelector('.niv-sorts-content').innerHTML = rows
    ? `<table class="niv-slots-table"><thead><tr><th>Niveau sort</th><th>Avant</th><th>Après</th></tr></thead><tbody>${rows}</tbody></table>`
    : '<p style="font-size:0.82rem;color:#888;">Aucun changement d\'emplacement.</p>';
}

function _renderEtapeRecap(el) {
  const liste = el.querySelector('.niv-recap-list');
  const items = [];

  const pvGagne = _wizardChoix.pv_gagne || 0;
  if (pvGagne) items.push({ icon: '❤️', text: `<strong>+${pvGagne} PV max</strong> (${(_wizardPerso.combat?.pv_max||0)} → ${(_wizardPerso.combat?.pv_max||0)+pvGagne})` });

  const bm = bonusMaitriseDepuisNiveau(_wizardNouveauNiv);
  const ancienBM = bonusMaitriseDepuisNiveau(_wizardNouveauNiv - 1);
  if (bm !== ancienBM) items.push({ icon: '🎯', text: `<strong>Bonus de maîtrise</strong> : +${ancienBM} → +${bm}` });

  if (_wizardChoix.sous_classe) {
    const sc = _sousClassesData.find(s => s.id === _wizardChoix.sous_classe);
    items.push({ icon: '⭐', text: `<strong>Sous-classe</strong> : ${sc?.nom || _wizardChoix.sous_classe}` });
  }
  if (_wizardChoix.don) items.push({ icon: '📜', text: `<strong>Don</strong> : ${_wizardChoix.don.nom || _wizardChoix.don.id}` });
  if (_wizardChoix.amelioration_carac) {
    const detailsCarac = Object.entries(_wizardChoix.amelioration_carac).map(([k,v]) => `${k} +${v}`).join(', ');
    items.push({ icon: '💪', text: `<strong>Amélioration</strong> : ${detailsCarac}` });
  }

  const classe = (_wizardPerso.classe || '').toLowerCase();
  const capacites = _classeData?.niveaux?.[String(_wizardNouveauNiv)]?.capacites || [];
  capacites.forEach(c => items.push({ icon: '✨', text: `<strong>${c.nom}</strong>` }));

  if (!items.length) items.push({ icon: '✅', text: 'Niveau appliqué.' });

  liste.innerHTML = items.map(it =>
    `<div class="niv-recap-item"><span class="recap-icon">${it.icon}</span><span class="recap-text">${it.text}</span></div>`
  ).join('');
}

// ─── NAVIGATION ───────────────────────────────────────────────
function wizardPrev() {
  if (_wizardEtapeIdx > 0) { _wizardEtapeIdx--; _renderWizard(); }
}

function wizardNext() {
  if (_wizardEtapeIdx < _wizardEtapes.length - 1) {
    _wizardEtapeIdx++;
    _renderWizard();
  }
}

async function confirmerNiveau() {
  const btn = document.querySelector('.niv-btn-confirm');
  btn.disabled = true;
  btn.textContent = '⏳ Sauvegarde…';

  try {
    const token = window.SUPABASE_TOKEN;
    const id    = _wizardPerso._id || _wizardPerso.id;
    const r = await fetch(`https://myrpgtable.fr/api/Personnages/${id}/niveau`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nouveau_niveau: _wizardNouveauNiv, choix: _wizardChoix })
    });
    if (!r.ok) throw new Error(await r.text());

    // Mettre à jour perso local
    _wizardPerso.niveau = _wizardNouveauNiv;
    _wizardPerso.bonus_maitrise = bonusMaitriseDepuisNiveau(_wizardNouveauNiv);
    if (_wizardChoix.pv_gagne) {
      _wizardPerso.combat = _wizardPerso.combat || {};
      _wizardPerso.combat.pv_max = (_wizardPerso.combat.pv_max || 0) + _wizardChoix.pv_gagne;
      _wizardPerso.combat.pv_actuels = (_wizardPerso.combat.pv_actuels || 0) + _wizardChoix.pv_gagne;
    }
    if (_wizardChoix.sous_classe) _wizardPerso.sous_classe = _wizardChoix.sous_classe;
    if (_wizardChoix.amelioration_carac) {
      for (const [k, delta] of Object.entries(_wizardChoix.amelioration_carac)) {
        _wizardPerso.caracteristiques = _wizardPerso.caracteristiques || {};
        _wizardPerso.caracteristiques[k] = _wizardPerso.caracteristiques[k] || { valeur: 10 };
        _wizardPerso.caracteristiques[k].valeur = Math.min(20, (_wizardPerso.caracteristiques[k].valeur || 10) + delta);
      }
    }
    if (_wizardChoix.don) {
      _wizardPerso.aptitudes = _wizardPerso.aptitudes || [];
      _wizardPerso.aptitudes.push({ type: 'don', id: _wizardChoix.don.id, nom: _wizardChoix.don.nom });
    }

    // Mettre à jour les emplacements de sorts
    if (typeof mettreAJourSlots === 'function') {
      const classe = (_wizardPerso.classe || '').toLowerCase();
      _wizardPerso.sorts = _wizardPerso.sorts || {};
      _wizardPerso.sorts.emplacements = mettreAJourSlots(
        _wizardPerso.sorts.emplacements || [],
        classe,
        _wizardNouveauNiv
      );
    }

    document.getElementById('modal-levelup').classList.add('hidden');
    lancerConfettis();

    // Rafraîchir l'interface si renderAll existe
    if (typeof renderAll === 'function') renderAll();
    if (typeof renderBarreXP === 'function') renderBarreXP(_wizardPerso);

    // Badge disparu
    document.getElementById('levelup-badge')?.classList.remove('visible');

  } catch (e) {
    btn.disabled = false;
    btn.textContent = '✅ Confirmer la montée en niveau';
    alert('Erreur : ' + e.message);
  }
}

window.lancerWizardNiveau  = lancerWizardNiveau;
window.wizardPrev           = wizardPrev;
window.wizardNext           = wizardNext;
window.confirmerNiveau      = confirmerNiveau;
window.renderBarreXP        = renderBarreXP;
