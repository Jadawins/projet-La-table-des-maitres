// ═══════════════════════════════════════════════════════════════
//  MAGIE-TABLES.JS — Tables d'emplacements de sorts PHB 2024
//  À inclure avant creer-personnage.js, fiche-personnage.js et niveau.js
// ═══════════════════════════════════════════════════════════════

// ─── TABLE LANCEURS COMPLETS (Barde/Clerc/Druide/Ensorceleur/Magicien) ───────
// Index 0 = sorts de niveau 1, index 8 = sorts de niveau 9
const _TABLE_COMPLET = {
   1:[2,0,0,0,0,0,0,0,0],  2:[3,0,0,0,0,0,0,0,0],  3:[4,2,0,0,0,0,0,0,0],
   4:[4,3,0,0,0,0,0,0,0],  5:[4,3,2,0,0,0,0,0,0],  6:[4,3,3,0,0,0,0,0,0],
   7:[4,3,3,1,0,0,0,0,0],  8:[4,3,3,2,0,0,0,0,0],  9:[4,3,3,3,1,0,0,0,0],
  10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0],
  13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0],
  16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1],
  19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1]
};

// ─── TABLE DEMI-LANCEURS (Paladin/Rôdeur) ─────────────────────────────────────
// PHB 2024 : Paladin a 2 emplacements niv1 dès le niveau 1
// Rôdeur commence à niv 2 (géré dans getSlotsEmplacements)
// Index 0 = sorts de niveau 1, index 4 = sorts de niveau 5
const _TABLE_DEMI = {
   1:[2,0,0,0,0],  2:[2,0,0,0,0],  3:[3,0,0,0,0],  4:[3,0,0,0,0],
   5:[4,2,0,0,0],  6:[4,2,0,0,0],  7:[4,3,0,0,0],  8:[4,3,0,0,0],
   9:[4,3,2,0,0], 10:[4,3,2,0,0], 11:[4,3,3,0,0], 12:[4,3,3,0,0],
  13:[4,3,3,1,0], 14:[4,3,3,1,0], 15:[4,3,3,2,0], 16:[4,3,3,2,0],
  17:[4,3,3,3,1], 18:[4,3,3,3,1], 19:[4,3,3,3,2], 20:[4,3,3,3,2]
};

// ─── TABLE EMPLACEMENTS DE PACTE (Occultiste) ─────────────────────────────────
// Propriétés : nombre (d'emplacements), niveau (niveau des emplacements)
const _TABLE_PACTE = {
   1:{nombre:1,niveau:1},  2:{nombre:2,niveau:1},  3:{nombre:2,niveau:2},
   4:{nombre:2,niveau:2},  5:{nombre:2,niveau:3},  6:{nombre:2,niveau:3},
   7:{nombre:2,niveau:4},  8:{nombre:2,niveau:4},  9:{nombre:2,niveau:5},
  10:{nombre:2,niveau:5}, 11:{nombre:3,niveau:5}, 12:{nombre:3,niveau:5},
  13:{nombre:3,niveau:5}, 14:{nombre:3,niveau:5}, 15:{nombre:3,niveau:5},
  16:{nombre:3,niveau:5}, 17:{nombre:4,niveau:5}, 18:{nombre:4,niveau:5},
  19:{nombre:4,niveau:5}, 20:{nombre:4,niveau:5}
};

// ─── TABLE LANCEURS TIERS (Chevalier occulte / Arnaqueur arcanique) ───────────
// Débloqué au niveau 3 de la classe. Index 0 = sorts de niveau 1.
const _TABLE_TIERS = {
   1:[0,0,0,0],  2:[0,0,0,0],  3:[2,0,0,0],  4:[3,0,0,0],
   5:[3,0,0,0],  6:[3,0,0,0],  7:[4,2,0,0],  8:[4,2,0,0],
   9:[4,2,0,0], 10:[4,3,0,0], 11:[4,3,0,0], 12:[4,3,0,0],
  13:[4,3,2,0], 14:[4,3,2,0], 15:[4,3,2,0], 16:[4,3,3,0],
  17:[4,3,3,0], 18:[4,3,3,0], 19:[4,3,3,1], 20:[4,3,3,1]
};

// ─── TYPE DE LANCEUR PAR CLASSE OU SOUS-CLASSE ────────────────────────────────
const MAGIE_TYPE_LANCEUR = {
  barde:      'complet',
  clerc:      'complet',
  druide:     'complet',
  ensorceleur:'complet',
  magicien:   'complet',
  paladin:    'demi',
  rodeur:     'demi',
  occultiste: 'pacte',
  barbare:    'aucun',
  guerrier:   'aucun',
  moine:      'aucun',
  roublard:   'aucun',
  // Lanceurs via sous-classe (1/3)
  guerrier_chevalier_occulte:    'tiers',
  roublard_arnaqueur_arcanique:  'tiers',
};

// ─── CANTRIPS PAR CLASSE/NIVEAU (PHB 2024) ────────────────────────────────────
const MAGIE_CANTRIPS = {
  //           niv: 1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
  barde:      [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  clerc:      [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  druide:     [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  ensorceleur:[4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  magicien:   [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  occultiste: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // Paladin et Rodeur n'ont pas de cantrips
  // Lanceurs tiers (sous-classe) : 0 avant niveau 3, puis 3, puis 4 a partir de niv 10
  guerrier_chevalier_occulte:   [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  roublard_arnaqueur_arcanique: [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};

// ─── SORTS CONNUS/PRÉPARÉS PAR CLASSE (PHB 2024) ──────────────────────────────
// Pour les classes « connus » : nombre de sorts niv1+ connus
// Pour les classes « préparés » : nombre max de sorts préparés (base, sans mod)
//   Clerc, Druide, Magicien : formule (niveau + mod), voir getNbSortsPrepares()
//   Paladin, Rôdeur : table fixe PHB 2024 ci-dessous
const _SORTS_PREPARES_PALADIN = [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15];
const _SORTS_PREPARES_RODEUR  = [2,3,4,5,6,6,7,7,9,9,10,10,11,11,12,12,14,14,15,15];

const MAGIE_SORTS_CONNUS = {
  //           niv: 1  2  3  4   5  6  7   8   9  10  11  12  13  14  15  16  17  18  19  20
  barde:      [4, 5, 6, 7,  9,10,11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  ensorceleur:[2, 4, 6, 7,  9,10,11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  occultiste: [2, 3, 4, 5,  6, 7, 8,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  // Lanceurs tiers (PHB 2024) : sorts connus par niveau de classe
  guerrier_chevalier_occulte:   [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9,10,10,11,11,11,12,13],
  roublard_arnaqueur_arcanique: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9,10,10,11,11,11,12,13],
};

// ─── SORTS CONNUS/PRÉPARÉS — MODE PAR CLASSE ──────────────────────────────────
const MAGIE_MODE = {
  barde:      'connus',
  ensorceleur:'connus',
  occultiste: 'prepares',
  clerc:      'prepares',
  druide:     'prepares',
  magicien:   'prepares',
  paladin:    'prepares',
  rodeur:     'prepares',
  // Lanceurs tiers (sous-classe)
  guerrier_chevalier_occulte:   'connus',
  roublard_arnaqueur_arcanique: 'connus',
};

// ─── API PUBLIQUE ─────────────────────────────────────────────────────────────

/**
 * Retourne le type de lanceur d'une classe.
 * @param {string} classeId
 * @returns {'complet'|'demi'|'pacte'|'aucun'}
 */
function getTypeLanceur(classeId) {
  return MAGIE_TYPE_LANCEUR[String(classeId || '').toLowerCase()] || 'aucun';
}

/**
 * Retourne le tableau d'emplacements de sorts pour une classe/niveau.
 * Chaque entrée : { niveau: N, total: T, utilises: 0 }
 * Pour le pacte occultiste : { niveau: N, total: T, utilises: 0, type: 'pacte' }
 *
 * @param {string} classeId
 * @param {number} niveau
 * @returns {Array<{niveau:number, total:number, utilises:number, type?:string}>}
 */
function getSlotsEmplacements(classeId, niveau) {
  const id = String(classeId || '').toLowerCase();
  const n  = Math.max(1, Math.min(20, parseInt(niveau) || 1));
  const type = MAGIE_TYPE_LANCEUR[id] || 'aucun';

  if (type === 'aucun') return [];

  if (type === 'pacte') {
    const p = _TABLE_PACTE[n];
    if (!p || p.nombre === 0) return [];
    return [{ niveau: p.niveau, total: p.nombre, utilises: 0, type: 'pacte' }];
  }

  // Rodeur : pas d'emplacements au niveau 1 (PHB 2024)
  if (id === 'rodeur' && n === 1) return [];

  if (type === 'tiers') {
    const slots = _TABLE_TIERS[n] || [];
    const result = [];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > 0) result.push({ niveau: i + 1, total: slots[i], utilises: 0 });
    }
    return result;
  }

  const table = type === 'complet' ? _TABLE_COMPLET : _TABLE_DEMI;
  const slots = table[n] || [];
  const result = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] > 0) {
      result.push({ niveau: i + 1, total: slots[i], utilises: 0 });
    }
  }
  return result;
}

/**
 * Calcule le nombre de cantrips pour une classe à un niveau donné.
 * @param {string} classeId
 * @param {number} niveau
 * @returns {number}
 */
function getNbCantrips(classeId, niveau) {
  const id = String(classeId || '').toLowerCase();
  const n  = Math.max(1, Math.min(20, parseInt(niveau) || 1));
  return (MAGIE_CANTRIPS[id] || [])[n - 1] || 0;
}

/**
 * Retourne les niveaux de sorts disponibles (1 à N) pour une classe et un niveau.
 * Ne comprend PAS les cantrips (0).
 * Occultiste : progression spéciale selon la spec.
 */
function getNiveauxSortsDisponibles(classeId, niveau) {
  const id  = String(classeId || '').toLowerCase();
  const n   = Math.max(1, Math.min(20, parseInt(niveau) || 1));
  const type = MAGIE_TYPE_LANCEUR[id] || 'aucun';
  if (type === 'aucun') return [];

  if (type === 'complet') {
    let max;
    if      (n <= 2)  max = 1;
    else if (n <= 4)  max = 2;
    else if (n <= 6)  max = 3;
    else if (n <= 8)  max = 4;
    else if (n <= 10) max = 5;
    else if (n <= 12) max = 6;
    else if (n <= 14) max = 7;
    else if (n <= 16) max = 8;
    else              max = 9;
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  if (type === 'demi') {
    // PHB 2024 : Paladin a des sorts dès niv 1, Rôdeur dès niv 2
    if (id === 'rodeur' && n < 2) return [];
    let max;
    if      (n <= 4)  max = 1;
    else if (n <= 8)  max = 2;
    else if (n <= 12) max = 3;
    else if (n <= 16) max = 4;
    else              max = 5;
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  if (type === 'pacte') {
    if (n <= 2) return [1];
    if (n <= 4) return [1, 2];
    if (n <= 6) return [1, 2, 3];
    if (n <= 8) return [1, 2, 3, 4];
    return [1, 2, 3, 4, 5];
  }

  if (type === 'tiers') {
    // Sorts disponibles a partir du niveau 3 de classe
    if (n < 3)  return [];
    if (n <= 6)  return [1];
    if (n <= 12) return [1, 2];
    if (n <= 18) return [1, 2, 3];
    return [1, 2, 3, 4];
  }

  return [];
}

/**
 * Nombre de sorts connus (niv 1+) pour les classes « connus ».
 */
function getNbSortsConnus(classeId, niveau) {
  const id = String(classeId || '').toLowerCase();
  const n  = Math.max(1, Math.min(20, parseInt(niveau) || 1));
  return (MAGIE_SORTS_CONNUS[id] || [])[n - 1] || 0;
}

/**
 * Nombre de sorts préparés pour les classes « prepares ».
 * Paladin et Rôdeur : table fixe PHB 2024.
 * Clerc, Druide, Magicien : niveau + modificateur de caractéristique.
 * @param {string} classeId
 * @param {number} niveau
 * @param {{ FOR,DEX,CON,INT,SAG,CHA }} stats  valeurs brutes (ex: 14, pas le mod)
 */
function getNbSortsPrepares(classeId, niveau, stats) {
  const id  = String(classeId || '').toLowerCase();
  const n   = Math.max(1, Math.min(20, parseInt(niveau) || 1));

  // Table fixe PHB 2024 pour paladin et rôdeur
  if (id === 'paladin') return _SORTS_PREPARES_PALADIN[n - 1] || 1;
  if (id === 'rodeur')  return _SORTS_PREPARES_RODEUR[n - 1]  || 1;

  // Occultiste : table fixe (mode préparés en PHB 2024)
  if (id === 'occultiste') return (MAGIE_SORTS_CONNUS.occultiste || [])[n - 1] || 1;

  // Clerc, Druide, Magicien : formule (niveau + mod caractéristique)
  const s   = stats || {};
  const modSAG = Math.floor(((s.SAG || 10) - 10) / 2);
  const modINT = Math.floor(((s.INT || 10) - 10) / 2);
  switch (id) {
    case 'clerc':    return Math.max(1, n + modSAG);
    case 'druide':   return Math.max(1, n + modSAG);
    case 'magicien': return Math.max(1, n + modINT);
    default:         return 1;
  }
}

/**
 * Met à jour les emplacements existants pour un nouveau niveau,
 * en conservant les utilisations actuelles (sans dépasser le nouveau total).
 * @param {Array} emplacementsActuels
 * @param {string} classeId
 * @param {number} nouveauNiveau
 * @returns {Array}
 */
function mettreAJourSlots(emplacementsActuels, classeId, nouveauNiveau) {
  const nouveaux = getSlotsEmplacements(classeId, nouveauNiveau);
  return nouveaux.map(nouv => {
    const ancien = (emplacementsActuels || []).find(e =>
      e.niveau === nouv.niveau && e.type === nouv.type
    );
    const utilises = ancien ? Math.min(ancien.utilises || 0, nouv.total) : 0;
    return { ...nouv, utilises };
  });
}
