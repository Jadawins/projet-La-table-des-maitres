#!/usr/bin/env node
'use strict';

/**
 * test-combat-logique.js
 * Tests de la logique pure de combat — aucun serveur requis.
 * Réplique les fonctions de ecran-mj.js et api/Combats/index.js
 *
 * Usage : node scripts/test-combat-logique.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOGIQUE EXTRAITE DU CODE SOURCE
// ─────────────────────────────────────────────────────────────────────────────

const XP_PAR_NIVEAU = {
  1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000,
  9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000,
  15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000
};

// Parsing de formule de dés : "2d6+3" → { nb, faces, modif }
function parseFormule(formule) {
  if (!formule) return null;
  const match = String(formule).match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  return {
    nb:    parseInt(match[1]) || 1,
    faces: parseInt(match[2]),
    modif: parseInt(match[3]) || 0
  };
}

// Calcul dégâts avec résistances/immunités (extrait de api/Combats/index.js)
function calculerDegats(degats, typeDegats, resistances, immunites) {
  let dmg = parseInt(degats) || 0;
  const type = (typeDegats || '').toLowerCase();
  const imm  = (immunites   || []).map(s => s.toLowerCase());
  const res  = (resistances || []).map(s => s.toLowerCase());
  if (imm.includes(type))      dmg = 0;
  else if (res.includes(type)) dmg = Math.floor(dmg / 2);
  return Math.max(0, dmg);
}

// Appliquer dégâts : PV temporaires absorbent en premier
function appliquerDegats(participant, degats) {
  let dmg = Math.max(0, degats);
  const p = { ...participant };
  if ((p.pv_temporaires || 0) > 0) {
    const absorbe   = Math.min(p.pv_temporaires, dmg);
    p.pv_temporaires -= absorbe;
    dmg             -= absorbe;
  }
  p.pv_actuels = Math.max(0, p.pv_actuels - dmg);
  return p;
}

// Jets de mort (extrait de api/Combats/index.js)
function jetMort(participant, resultat) {
  const p = { ...participant, jets_mort: { ...participant.jets_mort } };
  let { succes, echecs } = p.jets_mort;
  let stabilise = false, mort = false;

  if (resultat === 'nat20') {
    p.pv_actuels    = 1;
    p.jets_mort     = { succes: 0, echecs: 0 };
    stabilise       = true;
  } else if (resultat === 'nat1') {
    echecs           = Math.min(3, echecs + 2);
    p.jets_mort.echecs = echecs;
    if (echecs >= 3) mort = true;
  } else if (resultat === 'succes') {
    succes           = Math.min(3, succes + 1);
    p.jets_mort.succes = succes;
    if (succes >= 3) stabilise = true;
  } else if (resultat === 'echec') {
    echecs           = Math.min(3, echecs + 1);
    p.jets_mort.echecs = echecs;
    if (echecs >= 3) mort = true;
  }
  return { participant: p, stabilise, mort };
}

// Tri des participants par initiative (décroissant, NaN en dernier)
function trierInitiative(participants) {
  return [...participants].sort((a, b) => {
    const ia = isNaN(a.initiative) ? -Infinity : a.initiative;
    const ib = isNaN(b.initiative) ? -Infinity : b.initiative;
    return ib - ia;
  });
}

// Avancement du tour (extrait de api/Combats/index.js)
function avancerTour(combat) {
  const c = { ...combat };
  c.tour_actuel = (c.tour_actuel + 1) % c.participants.length;
  if (c.tour_actuel === 0) c.round++;
  return c;
}

// DD jet de sauvegarde de concentration
function ddConcentration(degatsSubis) {
  return Math.max(10, Math.floor(degatsSubis / 2));
}

// Distribution XP après combat (monstres morts uniquement, joueurs vivants)
function distribuerXP(participants, joueurs) {
  const xpTotal = participants
    .filter(p => p.type === 'monstre' && p.pv_actuels <= 0)
    .reduce((s, m) => s + (m.xp || 0), 0);

  const joueursVivants = joueurs.filter(j => j.pv_actuels > 0);
  if (joueursVivants.length === 0) return { xpTotal, xpParJoueur: 0, nouveauxNiveaux: [] };

  const xpParJoueur = Math.floor(xpTotal / joueursVivants.length);

  const nouveauxNiveaux = joueursVivants.map(j => {
    const xpAvant  = j.experience || 0;
    const xpApres  = xpAvant + xpParJoueur;
    let niveauApres = j.niveau || 1;
    while (niveauApres < 20 && xpApres >= (XP_PAR_NIVEAU[niveauApres + 1] || Infinity)) {
      niveauApres++;
    }
    return {
      id: j.id || j.nom,
      xpAvant, xpApres, xpGagne: xpParJoueur,
      niveauAvant: j.niveau, niveauApres,
      monteDeNiveau: niveauApres > j.niveau
    };
  });

  return { xpTotal, xpParJoueur, nouveauxNiveaux };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FRAMEWORK DE TEST LÉGER
// ─────────────────────────────────────────────────────────────────────────────

let total = 0, passes = 0, failures = 0;
const failDetails = [];

function expect(label, valeur, attendu) {
  total++;
  const vStr = JSON.stringify(valeur);
  const aStr = JSON.stringify(attendu);
  if (vStr === aStr) {
    passes++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failures++;
    process.stdout.write(`  ✗ ${label}\n`);
    process.stdout.write(`    Attendu : ${aStr}\n`);
    process.stdout.write(`    Obtenu  : ${vStr}\n`);
    failDetails.push({ label, attendu, obtenu: valeur });
  }
}

function suite(nom, fn) {
  process.stdout.write(`\n── ${nom} ${'─'.repeat(Math.max(0, 45 - nom.length))}\n`);
  fn();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TESTS
// ─────────────────────────────────────────────────────────────────────────────

suite('Parsing de formule de dés', () => {
  expect('1d6',          parseFormule('1d6'),    { nb:1,  faces:6,  modif:0  });
  expect('2d6+3',        parseFormule('2d6+3'),  { nb:2,  faces:6,  modif:3  });
  expect('1d8-1',        parseFormule('1d8-1'),  { nb:1,  faces:8,  modif:-1 });
  expect('d20 (sans nb)',parseFormule('d20'),    { nb:1,  faces:20, modif:0  });
  expect('10d4+5',       parseFormule('10d4+5'),  { nb:10, faces:4,  modif:5  });
  expect('chaîne vide',  parseFormule(''),        null);
  expect('texte libre',  parseFormule('épée+2'),  null);
  expect('undefined',    parseFormule(undefined), null);
});

suite('Dégâts — sans résistance ni immunité', () => {
  expect('10 dégâts nets',         calculerDegats(10, 'feu',    [], []), 10);
  expect('0 dégâts',               calculerDegats(0,  'feu',    [], []), 0);
  expect('dégâts négatifs → 0',    calculerDegats(-5, 'feu',    [], []), 0);
  expect('type absent → normal',   calculerDegats(8,  '',       [], []), 8);
});

suite('Dégâts — résistances', () => {
  expect('feu résisté (10 → 5)',   calculerDegats(10, 'feu',    ['feu'],  []),  5);
  expect('floor : 7 → 3',         calculerDegats(7,  'feu',    ['feu'],  []),  3);
  expect('floor : 1 → 0',         calculerDegats(1,  'feu',    ['feu'],  []),  0);
  expect('autre type non résisté', calculerDegats(10, 'froid',  ['feu'],  []),  10);
  expect('case-insensitive',       calculerDegats(10, 'FEU',    ['feu'],  []),  5);
});

suite('Dégâts — immunités', () => {
  expect('poison immunisé → 0',    calculerDegats(15, 'poison', [], ['poison']),   0);
  expect('immunité > résistance',  calculerDegats(10, 'feu',    ['feu'], ['feu']), 0);
  expect('autre type non immunisé',calculerDegats(10, 'froid',  [], ['feu']),      10);
  expect('case-insensitive imm',   calculerDegats(10, 'FEU',    [], ['FEU']),      0);
});

suite('PV temporaires', () => {
  const base = { pv_actuels: 20, pv_max: 20, pv_temporaires: 5 };

  const r1 = appliquerDegats(base, 3);
  expect('3 dégâts < 5 PVT : PVT réduits', r1.pv_temporaires, 2);
  expect('3 dégâts < 5 PVT : PV réels intacts', r1.pv_actuels, 20);

  const r2 = appliquerDegats(base, 5);
  expect('5 dégâts = 5 PVT : PVT à 0', r2.pv_temporaires, 0);
  expect('5 dégâts = 5 PVT : PV réels intacts', r2.pv_actuels, 20);

  const r3 = appliquerDegats(base, 8);
  expect('8 dégâts > 5 PVT : PVT à 0', r3.pv_temporaires, 0);
  expect('8 dégâts > 5 PVT : PV réels -3', r3.pv_actuels, 17);

  const r4 = appliquerDegats({ pv_actuels: 3, pv_max: 20, pv_temporaires: 2 }, 100);
  expect('dégâts massifs : PV minimum 0', r4.pv_actuels, 0);
  expect('dégâts massifs : PVT à 0', r4.pv_temporaires, 0);
});

suite('PV — sans PV temporaires', () => {
  const base = { pv_actuels: 20, pv_max: 20, pv_temporaires: 0 };

  expect('5 dégâts',                appliquerDegats(base, 5).pv_actuels,  15);
  expect('20 dégâts = exactement 0',appliquerDegats(base, 20).pv_actuels, 0);
  expect('99 dégâts → min 0',       appliquerDegats(base, 99).pv_actuels, 0);
  expect('0 dégâts → inchangé',     appliquerDegats(base, 0).pv_actuels,  20);
});

suite('Jets de mort', () => {
  const p0 = { pv_actuels: 0, jets_mort: { succes: 0, echecs: 0 } };

  // Succès progressifs
  const r1 = jetMort(p0, 'succes');
  expect('1 succès → pas stable', r1.stabilise, false);
  expect('compteur succès = 1',   r1.participant.jets_mort.succes, 1);

  const r2 = jetMort({ ...p0, jets_mort: { succes: 2, echecs: 0 } }, 'succes');
  expect('3 succès → stable',     r2.stabilise, true);

  // Échecs progressifs
  const r3 = jetMort(p0, 'echec');
  expect('1 échec → pas mort',    r3.mort, false);

  const r4 = jetMort({ ...p0, jets_mort: { succes: 0, echecs: 2 } }, 'echec');
  expect('3 échecs → mort',       r4.mort, true);

  // NAT1 = 2 échecs
  const r5 = jetMort(p0, 'nat1');
  expect('nat1 = 2 échecs',       r5.participant.jets_mort.echecs, 2);
  expect('nat1 pas encore mort',  r5.mort, false);

  const r6 = jetMort({ ...p0, jets_mort: { succes: 0, echecs: 2 } }, 'nat1');
  expect('nat1 sur 2 échecs → mort', r6.mort, true);

  // NAT20 = 1 PV + reset
  const r7 = jetMort({ ...p0, jets_mort: { succes: 1, echecs: 2 } }, 'nat20');
  expect('nat20 → 1 PV',          r7.participant.pv_actuels, 1);
  expect('nat20 → stable',        r7.stabilise, true);
  expect('nat20 → reset jets',    r7.participant.jets_mort, { succes: 0, echecs: 0 });

  // Caps à 3
  const r8 = jetMort({ ...p0, jets_mort: { succes: 3, echecs: 0 } }, 'succes');
  expect('succès cappé à 3',      r8.participant.jets_mort.succes, 3);

  const r9 = jetMort({ ...p0, jets_mort: { succes: 0, echecs: 3 } }, 'echec');
  expect('échecs cappés à 3',     r9.participant.jets_mort.echecs, 3);
});

suite('Tri par initiative', () => {
  const participants = [
    { nom: 'C', initiative: 5  },
    { nom: 'A', initiative: 12 },
    { nom: 'B', initiative: 18 },
    { nom: 'D', initiative: 18 },  // ex-æquo
    { nom: 'E', initiative: NaN }  // invalide → en dernier
  ];
  const trie = trierInitiative(participants);
  expect('1er = 18',              trie[0].initiative, 18);
  expect('2e = 18 (ex-æquo)',     trie[1].initiative, 18);
  expect('3e = 12',               trie[2].initiative, 12);
  expect('4e = 5',                trie[3].initiative, 5);
  expect('NaN en dernier',        isNaN(trie[4].initiative), true);

  // Liste déjà triée reste stable
  const deja = [{ nom: 'X', initiative: 20 }, { nom: 'Y', initiative: 1 }];
  const reDeja = trierInitiative(deja);
  expect('liste déjà triée OK',   reDeja[0].nom, 'X');
});

suite('Avancement des tours et rounds', () => {
  const c = { tour_actuel: 0, round: 1, participants: [{}, {}, {}] }; // 3 participants

  const c1 = avancerTour(c);
  expect('tour 0→1',              c1.tour_actuel, 1);
  expect('round inchangé',        c1.round, 1);

  const c2 = avancerTour(c1);
  expect('tour 1→2',              c2.tour_actuel, 2);

  const c3 = avancerTour(c2);
  expect('tour 2→0 (wrap)',       c3.tour_actuel, 0);
  expect('round incrémenté',      c3.round, 2);
});

suite('DD de sauvegarde de concentration', () => {
  expect('1 dégât → DD 10 (min)', ddConcentration(1),  10);
  expect('10 dégâts → DD 10',     ddConcentration(10), 10);
  expect('19 dégâts → DD 10 (min)',ddConcentration(19), 10); // floor(19/2)=9 < min 10 → 10
  expect('20 dégâts → DD 10',     ddConcentration(20), 10);
  expect('22 dégâts → DD 11',     ddConcentration(22), 11);
  expect('50 dégâts → DD 25',     ddConcentration(50), 25);
  expect('100 dégâts → DD 50',    ddConcentration(100), 50);
});

suite('Distribution XP — calcul de base', () => {
  const participants = [
    { type: 'monstre', pv_actuels: 0, xp: 200 },
    { type: 'monstre', pv_actuels: 0, xp: 100 },
    { type: 'monstre', pv_actuels: 10, xp: 500 }, // vivant → ne compte pas
  ];
  const joueurs = [
    { id: 'j1', nom: 'Arya',  pv_actuels: 15, experience: 0, niveau: 1 },
    { id: 'j2', nom: 'Bard',  pv_actuels: 8,  experience: 0, niveau: 1 },
    { id: 'j3', nom: 'Clerc', pv_actuels: 0,  experience: 100, niveau: 1 }, // mort → pas d'XP
  ];
  const r = distribuerXP(participants, joueurs);
  expect('XP total monstres morts', r.xpTotal,        300);
  expect('XP par joueur vivant',    r.xpParJoueur,    150);
  expect('2 joueurs vivants',       r.nouveauxNiveaux.length, 2);
  expect('j1 : XP après = 150',     r.nouveauxNiveaux[0].xpApres, 150);
  expect('j1 : pas de niveau up',   r.nouveauxNiveaux[0].monteDeNiveau, false);
});

suite('Distribution XP — montée de niveau', () => {
  const part = [{ type: 'monstre', pv_actuels: 0, xp: 100 }];

  // Niv 1 → 2 (besoin 300 XP, déjà 250)
  const j1 = [{ id:'j1', pv_actuels:10, experience:250, niveau:1 }];
  const r1 = distribuerXP(part, j1);
  expect('250+100=350 ≥ 300 → niv 2', r1.nouveauxNiveaux[0].monteDeNiveau, true);
  expect('nouveau niveau = 2',         r1.nouveauxNiveaux[0].niveauApres, 2);

  // Niv 19 → 20 (besoin 355000, déjà 354950)
  const j2 = [{ id:'j2', pv_actuels:10, experience:354950, niveau:19 }];
  const part2 = [{ type:'monstre', pv_actuels:0, xp:100 }];
  const r2 = distribuerXP(part2, j2);
  expect('354950+100 ≥ 355000 → niv 20', r2.nouveauxNiveaux[0].monteDeNiveau, true);
  expect('cap niv 20',                    r2.nouveauxNiveaux[0].niveauApres, 20);

  // Déjà niv 20 → pas de niv 21
  const j3 = [{ id:'j3', pv_actuels:10, experience:999999, niveau:20 }];
  const r3 = distribuerXP(part2, j3);
  expect('niv 20 = cap, pas de niv 21', r3.nouveauxNiveaux[0].niveauApres, 20);
});

suite('Distribution XP — cas limites', () => {
  // Tous les joueurs sont morts
  const part = [{ type:'monstre', pv_actuels:0, xp:500 }];
  const morts = [{ id:'j1', pv_actuels:0, experience:0, niveau:1 }];
  const r1 = distribuerXP(part, morts);
  expect('tous morts → xpParJoueur=0', r1.xpParJoueur, 0);
  expect('tous morts → pas de résultat', r1.nouveauxNiveaux.length, 0);

  // Aucun monstre mort
  const partVivants = [{ type:'monstre', pv_actuels:10, xp:500 }];
  const joueurs = [{ id:'j1', pv_actuels:10, experience:0, niveau:1 }];
  const r2 = distribuerXP(partVivants, joueurs);
  expect('aucun monstre mort → xpTotal=0', r2.xpTotal, 0);
  expect('xpParJoueur=0', r2.xpParJoueur, 0);

  // XP divisé par entier (floor)
  const part3 = [{ type:'monstre', pv_actuels:0, xp:100 }];
  const j3 = [
    { id:'j1', pv_actuels:10, experience:0, niveau:1 },
    { id:'j2', pv_actuels:10, experience:0, niveau:1 },
    { id:'j3', pv_actuels:10, experience:0, niveau:1 },
  ];
  const r3 = distribuerXP(part3, j3);
  expect('100 XP / 3 = floor(33)', r3.xpParJoueur, 33);
});

suite('Seuils XP exacts', () => {
  const cas = [
    [0,      1, 1],   [299,   1, 1],   [300,   1, 2],
    [899,    2, 2],   [900,   2, 3],   [2699,  3, 3],
    [2700,   3, 4],   [6499,  4, 4],   [6500,  4, 5],
    [354999, 19, 19], [355000, 19, 20], [999999, 20, 20],
  ];
  cas.forEach(([xp, niv, attendu]) => {
    let n = niv;
    while (n < 20 && xp >= (XP_PAR_NIVEAU[n + 1] || Infinity)) n++;
    expect(`xp=${xp} niv=${niv} → ${attendu}`, n, attendu);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. RAPPORT
// ─────────────────────────────────────────────────────────────────────────────

process.stdout.write('\n' + '═'.repeat(50) + '\n');
process.stdout.write(` RÉSULTAT : ${passes}/${total} tests passés`);
if (failures > 0) {
  process.stdout.write(`  —  ✗ ${failures} ÉCHEC(S)\n`);
  failDetails.forEach(f => process.stdout.write(`   · ${f.label}\n`));
} else {
  process.stdout.write('  —  ✓ Tout est passé !\n');
}
process.stdout.write('═'.repeat(50) + '\n');
process.exit(failures > 0 ? 1 : 0);
