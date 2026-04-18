#!/usr/bin/env node
'use strict';

/**
 * test-personnages.js
 * Génère toutes les combinaisons race/historique/classe/sous-classe niveaux 1-20
 * et vérifie que chaque fiche de personnage est valide.
 *
 * Usage : node scripts/test-personnages.js
 * Exit  : 0 si aucun échec, 1 si au moins un échec
 */

const fs   = require('fs');
const path = require('path');

const BASE     = path.resolve(__dirname, '..');
const JSON_DIR = path.join(BASE, 'Json/2024');
const OUT_DIR  = __dirname;

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const STAT_KEYS = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];

// Mapping abréviations anglaises → françaises (certains backgrounds utilisent STR, WIS…)
const STAT_ALIAS = {
  STR: 'FOR', FOR: 'FOR',
  DEX: 'DEX',
  CON: 'CON',
  INT: 'INT',
  WIS: 'SAG', SAG: 'SAG',
  CHA: 'CHA'
};

const BONUS_MAITRISE = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

// Valeur max du dé de vie par classe
const DV_MAX = {
  barbare: 12,
  barde: 8, clerc: 8, druide: 8, moine: 8, occultiste: 8, roublard: 8,
  ensorceleur: 6, magicien: 6,
  guerrier: 10, paladin: 10, rodeur: 10
};

// Niveaux où une ASI (+2 à une stat) est accordée
const NIVEAUX_AMELIORATION = {
  barbare:     [4, 8, 12, 16, 19],
  barde:       [4, 8, 12, 16, 19],
  clerc:       [4, 8, 12, 16, 19],
  druide:      [4, 8, 12, 16, 19],
  ensorceleur: [4, 8, 12, 16, 19],
  guerrier:    [4, 6, 8, 12, 14, 16, 19],
  magicien:    [4, 8, 12, 16, 19],
  moine:       [4, 8, 12, 16, 19],
  occultiste:  [4, 8, 12, 16, 19],
  paladin:     [4, 8, 12, 16, 19],
  rodeur:      [4, 8, 12, 16, 19],
  roublard:    [4, 8, 10, 12, 16, 19]
};

// Stat principale par classe (pour ASI déterministe)
const STAT_PRINCIPALE = {
  barbare: 'FOR', barde: 'CHA', clerc: 'SAG', druide: 'SAG',
  ensorceleur: 'CHA', guerrier: 'FOR', magicien: 'INT',
  moine: 'DEX', occultiste: 'CHA', paladin: 'CHA',
  rodeur: 'DEX', roublard: 'DEX'
};

// Ordre optimal d'assignation du tableau standard [15,14,13,12,10,8]
const STAT_PRIORITE = {
  barbare:     ['FOR', 'CON', 'DEX', 'SAG', 'INT', 'CHA'],
  barde:       ['CHA', 'DEX', 'CON', 'SAG', 'INT', 'FOR'],
  clerc:       ['SAG', 'CON', 'FOR', 'CHA', 'INT', 'DEX'],
  druide:      ['SAG', 'CON', 'DEX', 'INT', 'CHA', 'FOR'],
  ensorceleur: ['CHA', 'CON', 'DEX', 'INT', 'SAG', 'FOR'],
  guerrier:    ['FOR', 'CON', 'DEX', 'SAG', 'CHA', 'INT'],
  magicien:    ['INT', 'DEX', 'CON', 'SAG', 'CHA', 'FOR'],
  moine:       ['DEX', 'SAG', 'CON', 'INT', 'CHA', 'FOR'],
  occultiste:  ['CHA', 'CON', 'DEX', 'INT', 'SAG', 'FOR'],
  paladin:     ['CHA', 'FOR', 'CON', 'SAG', 'DEX', 'INT'],
  rodeur:      ['DEX', 'SAG', 'CON', 'FOR', 'INT', 'CHA'],
  roublard:    ['DEX', 'INT', 'CON', 'CHA', 'SAG', 'FOR']
};

// ── Tables de sorts ───────────────────────────────────────────────────────────

// Format : niveau_perso → [slots_rang1, slots_rang2, ..., slots_rang9]
const FULL_CASTER_SLOTS = {
  1:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  6:  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  8:  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  9:  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
  13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
  15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
};

// Demi-lanceurs : paladin, rodeur (sorts à partir du niveau 2)
const HALF_CASTER_SLOTS = {
  1:  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  4:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  6:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  7:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  8:  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  9:  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
  19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
  20: [4, 3, 3, 3, 2, 0, 0, 0, 0]
};

// Occultiste : emplacements de pacte (tous du même rang, rechargeables sur repos court)
const OCCULTISTE_SLOTS = {
  1:  [1, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [0, 2, 0, 0, 0, 0, 0, 0, 0],
  4:  [0, 2, 0, 0, 0, 0, 0, 0, 0],
  5:  [0, 0, 2, 0, 0, 0, 0, 0, 0],
  6:  [0, 0, 2, 0, 0, 0, 0, 0, 0],
  7:  [0, 0, 0, 2, 0, 0, 0, 0, 0],
  8:  [0, 0, 0, 2, 0, 0, 0, 0, 0],
  9:  [0, 0, 0, 0, 2, 0, 0, 0, 0],
  10: [0, 0, 0, 0, 2, 0, 0, 0, 0],
  11: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  12: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  13: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  14: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  15: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  16: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  17: [0, 0, 0, 0, 4, 0, 0, 0, 0],
  18: [0, 0, 0, 0, 4, 0, 0, 0, 0],
  19: [0, 0, 0, 0, 4, 0, 0, 0, 0],
  20: [0, 0, 0, 0, 4, 0, 0, 0, 0]
};

// Tiers-lanceurs : guerrier_chevalier_occulte, roublard_arnaqueur_arcanique (sorts à partir du niveau 3)
const THIRD_CASTER_SLOTS = {
  1:  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  2:  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  3:  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  4:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  5:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  6:  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  7:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  8:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  9:  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  10: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  11: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  12: [4, 3, 0, 0, 0, 0, 0, 0, 0],
  13: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  14: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  15: [4, 3, 2, 0, 0, 0, 0, 0, 0],
  16: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  17: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  18: [4, 3, 3, 0, 0, 0, 0, 0, 0],
  19: [4, 3, 3, 1, 0, 0, 0, 0, 0],
  20: [4, 3, 3, 1, 0, 0, 0, 0, 0]
};

// Cantrips connus par classe/niveau (index = niveau - 1)
const MAGIE_CANTRIPS = {
  barde:       [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  clerc:       [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  druide:      [2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  ensorceleur: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  magicien:    [3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  occultiste:  [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  guerrier_chevalier_occulte:   [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  roublard_arnaqueur_arcanique: [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
};

// Sorts connus (classes à sorts connus, pas préparés)
const MAGIE_SORTS_CONNUS = {
  barde:       [4,  5,  6,  7,  9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  ensorceleur: [2,  4,  6,  7,  9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  occultiste:  [2,  3,  4,  5,  6,  7,  8,  9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  guerrier_chevalier_occulte:   [0, 0, 3, 4, 4, 4, 5, 6, 6, 7,  8,  8,  9, 10, 10, 11, 11, 11, 12, 13],
  roublard_arnaqueur_arcanique: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7,  8,  8,  9, 10, 10, 11, 11, 11, 12, 13]
};

// Sorts préparés pour paladin et rodeur (tables fixes, index = niveau - 1)
const SORTS_PREPARES_PALADIN = [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];
const SORTS_PREPARES_RODEUR  = [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11];

// Sous-classes qui donnent accès aux sorts
const SC_CASTERS = new Set([
  'guerrier_chevalier_occulte',
  'roublard_arnaqueur_arcanique'
]);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHARGEMENT DES DONNÉES
// ─────────────────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    process.stderr.write(`[ERREUR] ${filePath}: ${e.message}\n`);
    return null;
  }
}

function loadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ id: f.replace('.json', ''), data: readJson(path.join(dirPath, f)) }))
      .filter(x => x.data !== null);
  } catch (e) {
    process.stderr.write(`[ERREUR] dossier ${dirPath}: ${e.message}\n`);
    return [];
  }
}

function loadData() {
  const classesRaw     = loadDir(path.join(JSON_DIR, 'Classe'));
  const sousClassesRaw = loadDir(path.join(JSON_DIR, 'SousClasse'));
  const especesRaw     = loadDir(path.join(JSON_DIR, 'Espece'));
  const backgroundsRaw = loadDir(path.join(JSON_DIR, 'Background'));

  const classesMap     = {};
  const sousClassesMap = {}; // classeId → [{ id, data }]
  const especesMap     = {};
  const backgroundsMap = {};

  classesRaw.forEach(({ id, data }) => {
    classesMap[id] = data;
    sousClassesMap[id] = [];
  });

  sousClassesRaw.forEach(({ id, data }) => {
    // classe_parente est défini dans chaque JSON de sous-classe
    const classeId = data.classe_parente || id.split('_')[0];
    if (!sousClassesMap[classeId]) sousClassesMap[classeId] = [];
    sousClassesMap[classeId].push({ id, data });
  });

  especesRaw.forEach(({ id, data }) => {
    especesMap[data.id || id] = data;
  });

  backgroundsRaw.forEach(({ id, data }) => {
    backgroundsMap[data.id || id] = data;
  });

  return { classesMap, sousClassesMap, especesMap, backgroundsMap };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. FONCTIONS DE CALCUL PURES
// ─────────────────────────────────────────────────────────────────────────────

function statMod(v) {
  return Math.floor(((Number(v) || 10) - 10) / 2);
}

function getBonusMaitrise(niveau) {
  return BONUS_MAITRISE[Math.min(Math.max(niveau, 1), 20) - 1];
}

function getDvMax(classeId) {
  return DV_MAX[classeId] || 8;
}

function isCaster(classeId, scId) {
  const fullCasters = ['magicien', 'clerc', 'druide', 'barde', 'ensorceleur', 'paladin', 'rodeur', 'occultiste'];
  return fullCasters.includes(classeId) || SC_CASTERS.has(scId);
}

function getSlotsDeSort(classeId, scId, niveau) {
  const n = Math.min(Math.max(niveau, 1), 20);
  if (['magicien', 'clerc', 'druide', 'barde', 'ensorceleur'].includes(classeId)) {
    return FULL_CASTER_SLOTS[n] || Array(9).fill(0);
  }
  if (['paladin', 'rodeur'].includes(classeId)) {
    return HALF_CASTER_SLOTS[n] || Array(9).fill(0);
  }
  if (classeId === 'occultiste') {
    return OCCULTISTE_SLOTS[n] || Array(9).fill(0);
  }
  if (SC_CASTERS.has(scId)) {
    return THIRD_CASTER_SLOTS[n] || Array(9).fill(0);
  }
  return Array(9).fill(0);
}

function getCaracIncantation(classeId, scId) {
  const map = {
    magicien: 'INT', barde: 'CHA', clerc: 'SAG', druide: 'SAG',
    ensorceleur: 'CHA', paladin: 'CHA', rodeur: 'SAG', occultiste: 'CHA',
    guerrier_chevalier_occulte: 'INT',
    roublard_arnaqueur_arcanique: 'INT'
  };
  return map[scId] || map[classeId] || null;
}

function getNbCantrips(classeId, scId, niveau) {
  const n   = Math.min(Math.max(niveau, 1), 20);
  const key = MAGIE_CANTRIPS[scId] ? scId : classeId;
  return (MAGIE_CANTRIPS[key] || [])[n - 1] || 0;
}

function getNbSorts(classeId, scId, niveau, stats) {
  const n = Math.min(Math.max(niveau, 1), 20);
  if (!isCaster(classeId, scId)) return 0;

  // Sorts connus (barde, ensorceleur, occultiste, tiers-lanceurs sous-classe)
  if (MAGIE_SORTS_CONNUS[scId])      return MAGIE_SORTS_CONNUS[scId][n - 1] || 0;
  if (MAGIE_SORTS_CONNUS[classeId])  return MAGIE_SORTS_CONNUS[classeId][n - 1] || 0;

  // Tables fixes demi-lanceurs
  if (classeId === 'paladin') return SORTS_PREPARES_PALADIN[n - 1] || 0;
  if (classeId === 'rodeur')  return SORTS_PREPARES_RODEUR[n - 1]  || 0;

  // Sorts préparés : niveau + mod(stat incantation)
  if (classeId === 'clerc' || classeId === 'druide') {
    return Math.max(1, n + statMod(stats.SAG));
  }
  if (classeId === 'magicien') {
    return Math.max(1, n + statMod(stats.INT));
  }
  return 1;
}

function normalizeStatKey(k) {
  return STAT_ALIAS[String(k).toUpperCase()] || k;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONSTRUCTION DU PERSONNAGE
// ─────────────────────────────────────────────────────────────────────────────

function buildBaseStats(classeId) {
  const standard = [15, 14, 13, 12, 10, 8];
  const ordre    = STAT_PRIORITE[classeId] || STAT_KEYS;
  const stats    = {};
  ordre.forEach((stat, i) => { stats[stat] = standard[i]; });
  return stats;
}

function applyBgBonus(stats, bgData, mode) {
  const result    = { ...stats };
  const suggerees = (bgData.bonus_caracteristiques?.suggerees || [])
    .map(k => normalizeStatKey(k))
    .filter(k => STAT_KEYS.includes(k));

  if (mode === 'A') {
    const s0 = suggerees[0] || 'FOR';
    const s1 = suggerees[1] || 'DEX';
    result[s0] = Math.min(20, (result[s0] || 10) + 2);
    result[s1] = Math.min(20, (result[s1] || 10) + 1);
  } else {
    const keys = suggerees.length >= 3
      ? [suggerees[0], suggerees[1], suggerees[2]]
      : ['FOR', 'DEX', 'CON'];
    keys.forEach(k => {
      result[k] = Math.min(20, (result[k] || 10) + 1);
    });
  }
  return result;
}

function applyASI(stats, classeId, niveau) {
  const result     = { ...stats };
  const niveauxASI = NIVEAUX_AMELIORATION[classeId] || [];
  const statPrinc  = STAT_PRINCIPALE[classeId] || 'FOR';

  niveauxASI.forEach(nivASI => {
    if (niveau >= nivASI) {
      if ((result[statPrinc] || 10) < 20) {
        result[statPrinc] = Math.min(20, (result[statPrinc] || 10) + 2);
      } else {
        // Débordement sur CON si stat principale déjà à 20
        result['CON'] = Math.min(20, (result['CON'] || 10) + 2);
      }
    }
  });
  return result;
}

function buildPvParNiveau(classeId, stats, niveau) {
  const dv     = getDvMax(classeId);
  const conMod = statMod(stats.CON);
  const pvNiv1 = Math.max(1, dv + conMod);
  const pvFixe = Math.max(1, Math.ceil(dv / 2) + 1 + conMod);

  const pvParNiveau = { 1: pvNiv1 };
  for (let lv = 2; lv <= niveau; lv++) {
    pvParNiveau[lv] = pvParNiveau[lv - 1] + pvFixe;
  }
  return pvParNiveau;
}

function buildCharacter(classeId, scId, especeId, bgId, niveau, bgMode, data) {
  const classeData = data.classesMap[classeId];
  const bgData     = data.backgroundsMap[bgId];
  const especeData = data.especesMap[especeId];

  if (!classeData || !bgData || !especeData) {
    return {
      _error: `données manquantes — classe:${!!classeData} bg:${!!bgData} espece:${!!especeData}`
    };
  }

  // Construction des stats
  let stats = buildBaseStats(classeId);
  stats = applyBgBonus(stats, bgData, bgMode);
  stats = applyASI(stats, classeId, niveau);

  // PV
  const pvParNiveau = buildPvParNiveau(classeId, stats, niveau);
  const pvTotal     = pvParNiveau[niveau];
  const pvNiv1      = pvParNiveau[1];
  const pvFixe      = Math.max(1, Math.ceil(getDvMax(classeId) / 2) + 1 + statMod(stats.CON));

  // Sorts
  const slots        = getSlotsDeSort(classeId, scId, niveau);
  const nbCantrips   = getNbCantrips(classeId, scId, niveau);
  const nbSorts      = getNbSorts(classeId, scId, niveau, stats);
  const bm           = getBonusMaitrise(niveau);
  const carInc       = isCaster(classeId, scId) ? getCaracIncantation(classeId, scId) : null;
  const ddSorts      = carInc ? 8 + bm + statMod(stats[carInc] || 10) : null;
  const bonusAtkSort = carInc ? bm + statMod(stats[carInc] || 10) : null;

  return {
    classeId, scId, especeId, bgId, niveau, bgMode,
    stats, pvTotal, pvNiv1, pvFixe, pvParNiveau,
    bonusMaitrise: bm,
    slots, nbCantrips, nbSorts,
    carInc, ddSorts, bonusAtkSort
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateFiche(fiche, classeId, scId, niveau) {
  if (fiche._error) {
    return { pass: false, errors: [fiche._error], warnings: [] };
  }

  const errors   = [];
  const warnings = [];
  const bm       = getBonusMaitrise(niveau);

  // ── Stats ────────────────────────────────────────────────────────────────
  STAT_KEYS.forEach(k => {
    const v = fiche.stats[k];
    if (v === undefined || v === null || isNaN(v)) {
      errors.push(`stat_${k}: undefined/NaN`);
    } else if (v < 3 || v > 30) {
      errors.push(`stat_${k}: ${v} hors plage [3-30]`);
    }
  });

  // ── Bonus de maîtrise ────────────────────────────────────────────────────
  if (fiche.bonusMaitrise !== bm) {
    errors.push(`bonusMaitrise: attendu ${bm}, obtenu ${fiche.bonusMaitrise}`);
  }

  // ── PV ──────────────────────────────────────────────────────────────────
  if (!fiche.pvTotal || isNaN(fiche.pvTotal) || fiche.pvTotal <= 0) {
    errors.push(`pvTotal: ${fiche.pvTotal} (invalide)`);
  }
  if (!fiche.pvNiv1 || fiche.pvNiv1 < 1) {
    errors.push(`pvNiv1: ${fiche.pvNiv1} < 1`);
  }
  if (!fiche.pvFixe || fiche.pvFixe < 1) {
    errors.push(`pvFixe: ${fiche.pvFixe} < 1`);
  }
  if (niveau === 1 && fiche.pvNiv1 < 5) {
    warnings.push(`pvNiv1: ${fiche.pvNiv1} < 5 (légal mais inhabituel)`);
  }

  // PV monotones croissants
  for (let lv = 2; lv <= niveau; lv++) {
    const prev = fiche.pvParNiveau[lv - 1];
    const curr = fiche.pvParNiveau[lv];
    if (curr < prev) {
      errors.push(`pvParNiveau: niv${lv} (${curr}) < niv${lv - 1} (${prev}) — PV décroissants`);
    }
  }

  // ── Slots de sort ────────────────────────────────────────────────────────
  if (!Array.isArray(fiche.slots) || fiche.slots.length !== 9) {
    errors.push(`slots: format invalide (${typeof fiche.slots})`);
  } else {
    fiche.slots.forEach((s, i) => {
      if (isNaN(s) || s < 0) {
        errors.push(`slots[rang${i + 1}]: ${s} invalide`);
      }
    });

    const totalSlots  = fiche.slots.reduce((a, b) => a + b, 0);
    const estCaster   = isCaster(classeId, scId);

    // Classe non-lanceur ne doit pas avoir de slots
    if (!estCaster && totalSlots > 0) {
      errors.push(`slots: non-lanceur (${classeId}/${scId}) possède ${totalSlots} emplacements`);
    }

    // Lanceur à partir du niveau où les sorts débloquent
    if (estCaster && totalSlots === 0) {
      // Paladin/rodeur n'ont pas de slots au niv 1, c'est normal
      const excuses = ['paladin', 'rodeur'].includes(classeId) && niveau === 1;
      // Tiers-lanceurs n'ont pas de slots avant niv 3
      const excuseSC = SC_CASTERS.has(scId) && niveau < 3;
      if (!excuses && !excuseSC) {
        warnings.push(`slots: lanceur (${classeId}) sans emplacements au niveau ${niveau}`);
      }
    }
  }

  // ── Sorts préparés/connus ────────────────────────────────────────────────
  if (isCaster(classeId, scId)) {
    if (isNaN(fiche.nbSorts) || fiche.nbSorts < 0) {
      errors.push(`nbSorts: ${fiche.nbSorts} invalide`);
    }
    if (fiche.ddSorts === null || isNaN(fiche.ddSorts)) {
      errors.push(`ddSorts: null/NaN pour un lanceur de sorts`);
    } else if (fiche.ddSorts < 8 || fiche.ddSorts > 30) {
      errors.push(`ddSorts: ${fiche.ddSorts} hors plage [8-30]`);
    }
  }

  return { pass: errors.length === 0, errors, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RAPPORT
// ─────────────────────────────────────────────────────────────────────────────

function writeReport(results, dureeMs) {
  const failures  = results.filter(r => !r.pass);
  const withWarns = results.filter(r => r.warnings.length > 0);
  const nbWarns   = withWarns.reduce((s, r) => s + r.warnings.length, 0);

  const meta = {
    date:      new Date().toISOString(),
    total:     results.length,
    passes:    results.filter(r => r.pass).length,
    failures:  failures.length,
    warnings:  nbWarns,
    duree_ms:  dureeMs
  };

  // JSON complet
  const rapport = {
    meta,
    failures: failures.map(r => ({
      classe:       r.classeId,
      sous_classe:  r.scId,
      espece:       r.especeId,
      background:   r.bgId,
      bg_mode:      r.bgMode,
      niveau:       r.niveau,
      errors:       r.errors
    })),
    warnings: withWarns.map(r => ({
      classe:      r.classeId,
      sous_classe: r.scId,
      espece:      r.especeId,
      background:  r.bgId,
      bg_mode:     r.bgMode,
      niveau:      r.niveau,
      warnings:    r.warnings
    })),
    couverture: {
      niveaux:           '1-20',
      bg_modes:          ['A (+2/+1)', 'B (+1/+1/+1)'],
      asi_avec_don:      false,
      competences_spec:  false,
      sorts_specifiques: false,
      note: 'Les dons ASI, les compétences spécifiques choisies et les sorts individuels ne sont pas testés.'
    }
  };

  const jsonPath = path.join(OUT_DIR, 'rapport-test.json');
  fs.writeFileSync(jsonPath, JSON.stringify(rapport, null, 2), 'utf8');

  // Texte lisible
  const pct  = ((meta.passes / meta.total) * 100).toFixed(2);
  const dur  = (dureeMs / 1000).toFixed(2);
  const lines = [
    '╔══════════════════════════════════════════╗',
    '║     RAPPORT TEST PERSONNAGES — D&D 2024  ║',
    '╚══════════════════════════════════════════╝',
    '',
    `Date       : ${new Date().toLocaleString('fr-FR')}`,
    `Durée      : ${dur}s`,
    `Total      : ${meta.total.toLocaleString('fr-FR')} combinaisons`,
    `✓ Passés   : ${meta.passes.toLocaleString('fr-FR')} (${pct}%)`,
    `✗ Échecs   : ${meta.failures}`,
    `⚠ Warnings : ${meta.warnings}`,
    ''
  ];

  if (failures.length > 0) {
    lines.push('── ÉCHECS PAR CLASSE/SOUS-CLASSE ──────────────');
    const byKey = {};
    failures.forEach(r => {
      const key = r.scId ? `${r.classeId}/${r.scId}` : r.classeId;
      if (!byKey[key]) byKey[key] = { count: 0, exemples: [] };
      byKey[key].count++;
      if (byKey[key].exemples.length < 2) {
        byKey[key].exemples.push(
          `    niv${r.niveau} espece:${r.especeId} bg:${r.bgId} mode:${r.bgMode} → ${r.errors[0]}`
        );
      }
    });
    Object.entries(byKey).sort((a, b) => b[1].count - a[1].count).forEach(([key, { count, exemples }]) => {
      lines.push(`  ${key} : ${count} échec(s)`);
      exemples.forEach(e => lines.push(e));
    });
    lines.push('');
  } else {
    lines.push('✓ Aucun échec — toutes les combinaisons sont valides !');
    lines.push('');
  }

  if (nbWarns > 0) {
    lines.push(`── WARNINGS (${nbWarns} au total) ──────────────────`);
    const byWarn = {};
    withWarns.forEach(r => {
      r.warnings.forEach(w => {
        const k = w.split(':')[0];
        byWarn[k] = (byWarn[k] || 0) + 1;
      });
    });
    Object.entries(byWarn).forEach(([k, n]) => lines.push(`  ${k} : ${n}×`));
    lines.push('');
  }

  lines.push('── COUVERTURE ──────────────────────────────────');
  lines.push('  Niveaux testés     : 1-20');
  lines.push('  Modes background   : A (+2/+1) et B (+1/+1/+1)');
  lines.push('  ASI avec don       : ✗ non couvert');
  lines.push('  Compétences préc.  : ✗ non couvert');
  lines.push('  Sorts individuels  : ✗ non couvert (compte uniquement)');

  const txtPath = path.join(OUT_DIR, 'rapport-test.txt');
  fs.writeFileSync(txtPath, lines.join('\n') + '\n', 'utf8');

  return { jsonPath, txtPath, meta };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. MAIN
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════');
  console.log(' test-personnages.js — D&D 2024');
  console.log('═══════════════════════════════════════════');
  console.log('Chargement des données JSON...');

  const data = loadData();

  const classes    = Object.keys(data.classesMap);
  const especes    = Object.keys(data.especesMap);
  const backgrounds = Object.keys(data.backgroundsMap);
  const bgModes    = ['A', 'B'];

  if (classes.length === 0)    { console.error('ERREUR: aucune classe chargée'); process.exit(1); }
  if (especes.length === 0)    { console.error('ERREUR: aucune espèce chargée'); process.exit(1); }
  if (backgrounds.length === 0){ console.error('ERREUR: aucun background chargé'); process.exit(1); }

  console.log(`Classes : ${classes.length} | Espèces : ${especes.length} | Backgrounds : ${backgrounds.length}`);

  // Calculer le total
  let total = 0;
  const combos = []; // [classeId, scId]

  classes.forEach(classeId => {
    const scs = data.sousClassesMap[classeId] || [];
    if (scs.length === 0) {
      combos.push([classeId, null]);
    } else {
      scs.forEach(sc => combos.push([classeId, sc.id]));
    }
  });

  total = combos.length * especes.length * backgrounds.length * bgModes.length * 20;
  console.log(`Combinaisons : ${combos.length} (classe×sc) × ${especes.length} × ${backgrounds.length} × ${bgModes.length} modes × 20 niveaux = ${total.toLocaleString('fr-FR')}`);
  console.log('');

  const results = [];
  const startMs = Date.now();
  let done      = 0;
  let lastPct   = -1;

  combos.forEach(([classeId, scId]) => {
    especes.forEach(especeId => {
      backgrounds.forEach(bgId => {
        bgModes.forEach(bgMode => {
          for (let niveau = 1; niveau <= 20; niveau++) {
            // Sous-classe effective : null avant le niveau 3
            const scEffectif = (scId && niveau >= 3) ? scId : null;

            const fiche = buildCharacter(classeId, scEffectif, especeId, bgId, niveau, bgMode, data);
            const { pass, errors, warnings } = validateFiche(fiche, classeId, scEffectif, niveau);

            results.push({ pass, classeId, scId: scEffectif, especeId, bgId, bgMode, niveau, errors, warnings });

            done++;
            const pct = Math.floor((done / total) * 100);
            if (pct !== lastPct && (pct % 5 === 0 || done === total)) {
              const filled  = Math.floor(pct / 5);
              const bar     = '█'.repeat(filled) + '░'.repeat(20 - filled);
              const nbFail  = results.filter(r => !r.pass).length;
              process.stdout.write(`\r[${bar}] ${pct}% — ${done.toLocaleString()}/${total.toLocaleString()} (${nbFail} ✗)`);
              lastPct = pct;
            }
          }
        });
      });
    });
  });

  const dureeMs = Date.now() - startMs;
  const nbFail  = results.filter(r => !r.pass).length;
  const nbWarn  = results.reduce((s, r) => s + r.warnings.length, 0);

  console.log(`\n\nTerminé en ${(dureeMs / 1000).toFixed(2)}s`);
  console.log(`Résultat : ${nbFail === 0 ? '✓ TOUT PASSÉ' : `✗ ${nbFail} ÉCHEC(S)`} | ${nbWarn} warning(s)`);
  console.log('');

  const { jsonPath, txtPath } = writeReport(results, dureeMs);
  console.log(`Rapport JSON : ${jsonPath}`);
  console.log(`Rapport TXT  : ${txtPath}`);

  process.exit(nbFail > 0 ? 1 : 0);
}

main();
