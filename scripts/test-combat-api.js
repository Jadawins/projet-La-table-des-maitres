#!/usr/bin/env node
'use strict';

/**
 * test-combat-api.js
 * Tests d'intégration — flux complet combat via API HTTP.
 *
 * Usage :
 *   SUPABASE_TOKEN="eyJ..." node scripts/test-combat-api.js
 *
 * Variables d'environnement :
 *   SUPABASE_TOKEN  (obligatoire) Token JWT Supabase de l'utilisateur MJ
 *   API_URL         (optionnel)   Défaut : http://localhost:3000
 *   SESSION_ID      (optionnel)   ID d'une session existante dont l'utilisateur est MJ.
 */

const http  = require('http');
const https = require('https');

const API_URL    = process.env.API_URL || 'http://localhost:3000';
const TOKEN      = process.env.SUPABASE_TOKEN || '';
const SESSION_ID = process.env.SESSION_ID || '';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLIENT HTTP LÉGER (aucune dépendance externe)
// ─────────────────────────────────────────────────────────────────────────────

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url    = new URL(path, API_URL);
    const driver = url.protocol === 'https:' ? https : http;
    const data   = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = driver.request(opts, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const get  = (path)        => request('GET',    path);
const post = (path, body)  => request('POST',   path, body);
const put  = (path, body)  => request('PUT',    path, body);

// ─────────────────────────────────────────────────────────────────────────────
// 2. FRAMEWORK DE TEST
// ─────────────────────────────────────────────────────────────────────────────

let total = 0, passes = 0, failures = 0;
const failDetails = [];
let combatId = null;

function check(label, condition, details = '') {
  total++;
  if (condition) {
    passes++;
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    failures++;
    process.stdout.write(`  ✗ ${label}${details ? ' — ' + details : ''}\n`);
    failDetails.push(label + (details ? ` (${details})` : ''));
  }
}

function suite(nom) {
  process.stdout.write(`\n── ${nom} ${'─'.repeat(Math.max(0, 45 - nom.length))}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TESTS
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log(' test-combat-api.js — Intégration API');
  console.log('═══════════════════════════════════════════');

  if (!TOKEN) {
    console.error('\nERREUR : SUPABASE_TOKEN manquant.');
    console.error('Usage : SUPABASE_TOKEN="eyJ..." node scripts/test-combat-api.js\n');
    process.exit(1);
  }

  // ── Vérifier que l'API répond ──────────────────────────────────────────────
  suite('Connexion API');
  try {
    const ping = await get('/health');
    check('API accessible', ping.status < 500, `status ${ping.status}`);
  } catch (e) {
    check('API accessible', false, e.message);
    console.error('\nImpossible de contacter l\'API. Vérifiez que le serveur tourne.');
    process.exit(1);
  }

  // ── Créer une session de test ───────────────────────────────────────────────
  suite('Création d\'une session de test');
  let sessionId = SESSION_ID;
  let sessionCreeePourTest = false;

  if (!sessionId) {
    const sessRes = await post('/Sessions', {
      nom: '[TEST AUTO] Session de test',
      description: 'Créée par test-combat-api.js — supprimable',
      systeme: 'D&D 2024',
      visibilite: 'privee'
    });
    check('POST /Sessions → 201', sessRes.status === 201, `status ${sessRes.status}`);
    check('session._id présent', !!sessRes.body?._id);
    if (!sessRes.body?._id) { printReport(); process.exit(1); }
    sessionId = String(sessRes.body._id);
    sessionCreeePourTest = true;
    console.log(`  → Session de test créée : ${sessionId}`);
  } else {
    check('SESSION_ID fourni', true);
    console.log(`  → Session fournie : ${sessionId}`);
  }

  // ── Créer un combat ─────────────────────────────────────────────────────────
  suite('Création du combat');
  const combatRes = await post('/Combats', { session_id: sessionId });
  check('POST /Combats → 201',    combatRes.status === 201, `status ${combatRes.status}`);
  check('combat._id présent',     !!combatRes.body?._id);
  // statut créé = 'actif' (pas 'en_cours')
  check('statut initial = actif', combatRes.body?.statut === 'actif',
    `statut=${combatRes.body?.statut}`);
  check('round initial = 1',      combatRes.body?.round === 1);
  check('tour_actuel = 0',        combatRes.body?.tour_actuel === 0);

  if (!combatRes.body?._id) { printReport(); process.exit(1); }
  combatId = String(combatRes.body._id);
  console.log(`  → Combat créé : ${combatId}`);

  // ── Ajouter des participants ───────────────────────────────────────────────
  // Route : POST /Combats/:id/participant (singulier) → 201
  // Réponse : { success: true, participant: { id, nom, ... } }
  suite('Ajout des participants');

  const addJ = await post(`/Combats/${combatId}/participant`, {
    nom: '[TEST] Guerrier', type: 'joueur',
    initiative: 18, pv_max: 44, ca: 16,
    visible_joueurs: true
  });
  check('Ajout joueur → 201', addJ.status === 201, `status ${addJ.status}`);
  const joueurId = addJ.body?.participant?.id;
  check('joueur.id présent', !!joueurId);

  const addM = await post(`/Combats/${combatId}/participant`, {
    nom: '[TEST] Gobelin', type: 'monstre',
    initiative: 12, pv_max: 15, ca: 13,
    visible_joueurs: true
  });
  check('Ajout monstre → 201', addM.status === 201, `status ${addM.status}`);
  const monstreId = addM.body?.participant?.id;
  check('monstre.id présent', !!monstreId);

  if (!joueurId || !monstreId) {
    console.error('  IDs participants manquants, abandon.');
    printReport(); process.exit(1);
  }

  // ── Attaques et dégâts ─────────────────────────────────────────────────────
  // Réponse /attaque : { touche, critique, degats_appliques, pv_restants, log }
  suite('Attaques et dégâts');

  let pvMonstre = 15; // suivi manuel du PV du monstre (max=15, CA=13)

  // Attaque normale (d20=15 >= CA=13 → touche, 8 dégâts tranchants)
  const atk1 = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: monstreId,
    d20: 15, degats: 8, type_degats: 'tranchants'
  });
  check('Attaque normale → 200', atk1.status === 200, `status ${atk1.status}`);
  check('touche = true', atk1.body?.touche === true);
  pvMonstre -= 8; // 15 → 7
  check(`PV monstre réduits (15−8=${pvMonstre})`, atk1.body?.pv_restants === pvMonstre,
    `pv_restants=${atk1.body?.pv_restants}`);

  // Raté automatique (d20=1)
  const atkRate = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: monstreId,
    d20: 1, degats: 10, type_degats: 'tranchants'
  });
  check('Raté auto (d20=1) → 200', atkRate.status === 200);
  check('touche = false (raté)', atkRate.body?.touche === false);
  check('Raté auto : pv_restants inchangés', atkRate.body?.pv_restants === pvMonstre,
    `pv_restants=${atkRate.body?.pv_restants} attendu=${pvMonstre}`);

  // Coup critique (d20=20 = auto-touche + critique, 2 dégâts)
  const atkCrit = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: monstreId,
    d20: 20, degats: 2, type_degats: 'tranchants'
  });
  check('Critique (d20=20) → 200', atkCrit.status === 200);
  check('critique = true', atkCrit.body?.critique === true);
  pvMonstre -= 2; // 7 → 5
  check('Critique marqué dans le log', /critique/i.test(atkCrit.body?.log || ''),
    `log=${(atkCrit.body?.log || '').substring(0, 80)}`);

  // Attaque ratée par CA (d20=10 < CA=13)
  const atkMiss = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: monstreId,
    d20: 10, degats: 5, type_degats: 'tranchants'
  });
  check('Raté par CA (d20=10 < CA=13) → 200', atkMiss.status === 200);
  check('touche = false (raté CA)', atkMiss.body?.touche === false);
  check('PV inchangés après raté CA', atkMiss.body?.pv_restants === pvMonstre,
    `pv_restants=${atkMiss.body?.pv_restants} attendu=${pvMonstre}`);

  // ── Soins ──────────────────────────────────────────────────────────────────
  // Réponse /soin : { pv_restants, gain, log }  (paramètre : `pv`, pas `montant`)
  suite('Soins');

  let pvJoueur = 44; // max = 44, CA = 16

  // Endommager le joueur (d20=20 = auto-touche, 20 dégâts)
  await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: monstreId, cible_id: joueurId,
    d20: 20, degats: 20, type_degats: 'tranchants'
  });
  pvJoueur -= 20; // 44 → 24

  // Soin de 6
  const soin = await post(`/Combats/${combatId}/soin`, {
    cible_id: joueurId, pv: 6, soignant_nom: 'Test'
  });
  check('POST /soin → 200', soin.status === 200, `status ${soin.status}`);
  pvJoueur = Math.min(44, pvJoueur + 6); // 24 → 30
  check(`PV joueur soigné +6 (→ ${pvJoueur})`, soin.body?.pv_restants === pvJoueur,
    `pv_restants=${soin.body?.pv_restants}`);

  // Soin excessif → cappé au pv_max
  const soinMax = await post(`/Combats/${combatId}/soin`, {
    cible_id: joueurId, pv: 999
  });
  check('Soin cappé au pv_max (44)', soinMax.body?.pv_restants === 44,
    `pv_restants=${soinMax.body?.pv_restants}`);
  pvJoueur = 44;

  // ── Jets de mort ───────────────────────────────────────────────────────────
  // Réponse /mort : { succes, echecs, stabilise, mort, pv_actuels, log }
  suite('Jets de mort');

  // Amener le joueur à 0 PV (d20=20 = auto-touche, 100 dégâts)
  await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: monstreId, cible_id: joueurId,
    d20: 20, degats: 100, type_degats: 'tranchants'
  });
  pvJoueur = 0;

  const jm1 = await post(`/Combats/${combatId}/mort`, {
    participant_id: joueurId, resultat: 'succes'
  });
  check('1er jet mort succès → 200', jm1.status === 200);
  check('jets_mort.succes = 1', jm1.body?.succes === 1, `succes=${jm1.body?.succes}`);

  await post(`/Combats/${combatId}/mort`, { participant_id: joueurId, resultat: 'succes' });
  const jm3 = await post(`/Combats/${combatId}/mort`, { participant_id: joueurId, resultat: 'succes' });
  check('3 succès → 200', jm3.status === 200);
  check('3 succès → stabilisé', jm3.body?.stabilise === true,
    `stabilise=${jm3.body?.stabilise}`);

  // nat20 : revient à 1 PV (pv_actuels est déjà 0 après stabilisation)
  const jmNat20 = await post(`/Combats/${combatId}/mort`, {
    participant_id: joueurId, resultat: 'nat20'
  });
  check('nat20 → pv_actuels = 1', jmNat20.body?.pv_actuels === 1,
    `pv_actuels=${jmNat20.body?.pv_actuels}`);

  // ── Avancement des tours ───────────────────────────────────────────────────
  // Avec 2 participants : tour 0→1→0 (wrap) + round++
  suite('Tours et rounds');

  const tour1 = await put(`/Combats/${combatId}/tour`, {});
  check('PUT /tour → 200', tour1.status === 200, `status ${tour1.status}`);
  check('tour_actuel avance (→ 1)', tour1.body?.tour_actuel === 1,
    `tour_actuel=${tour1.body?.tour_actuel}`);

  const tour2 = await put(`/Combats/${combatId}/tour`, {});
  check('tour wrap → 0',       tour2.body?.tour_actuel === 0,
    `tour_actuel=${tour2.body?.tour_actuel}`);
  check('round incrémenté → 2', tour2.body?.round === 2,
    `round=${tour2.body?.round}`);

  // ── Conditions ─────────────────────────────────────────────────────────────
  // Route : PUT /Combats/:id/participant/:pid/conditions  { conditions: [...] }
  // Vérification via GET /Combats/:session_id (retourne le combat actif)
  suite('Conditions');

  const cond1 = await put(`/Combats/${combatId}/participant/${monstreId}/conditions`, {
    conditions: ['aveugle']
  });
  check('PUT conditions → 200', cond1.status === 200, `status ${cond1.status}`);

  const etat1 = await get(`/Combats/${sessionId}`);
  const monstreEtat1 = etat1.body?.participants?.find(p => p.id === monstreId);
  check('condition aveugle présente', monstreEtat1?.conditions?.includes('aveugle'),
    `conditions=${JSON.stringify(monstreEtat1?.conditions)}`);

  const cond2 = await put(`/Combats/${combatId}/participant/${monstreId}/conditions`, {
    conditions: []
  });
  check('PUT conditions vide → 200', cond2.status === 200, `status ${cond2.status}`);

  const etat2 = await get(`/Combats/${sessionId}`);
  const monstreEtat2 = etat2.body?.participants?.find(p => p.id === monstreId);
  check('condition aveugle retirée', !monstreEtat2?.conditions?.includes('aveugle'),
    `conditions=${JSON.stringify(monstreEtat2?.conditions)}`);

  // ── GET /Combats/by-id/:id ─────────────────────────────────────────────────
  suite('GET /Combats/by-id/:id');

  const byId = await get(`/Combats/by-id/${combatId}`);
  check('GET /by-id/:id → 200',          byId.status === 200, `status ${byId.status}`);
  check('_id correspond au combatId',    String(byId.body?._id) === combatId);
  check('est_mj = true',                 byId.body?.est_mj === true);
  check('notes_mj présentes (champ MJ)', byId.body?.notes_mj !== undefined);

  // ── Résistances et immunités ───────────────────────────────────────────────
  suite('Résistances et immunités');

  const addR = await post(`/Combats/${combatId}/participant`, {
    nom: '[TEST] Élémentaire du Feu', type: 'monstre',
    initiative: 8, pv_max: 30, ca: 12,
    resistances: ['tranchants', 'contondants'],
    immunites: ['feu'],
    visible_joueurs: true
  });
  check('Ajout participant avec résistances/immunités → 201', addR.status === 201,
    `status ${addR.status}`);
  const elemId = addR.body?.participant?.id;
  check('résistances sauvegardées', JSON.stringify(addR.body?.participant?.resistances) === '["tranchants","contondants"]',
    `got ${JSON.stringify(addR.body?.participant?.resistances)}`);
  check('immunites sauvegardées',   JSON.stringify(addR.body?.participant?.immunites) === '["feu"]',
    `got ${JSON.stringify(addR.body?.participant?.immunites)}`);

  let pvElem = 30;

  // Attaque avec dégâts tranchants → résistance → dégâts divisés par 2
  const atkResist = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: elemId,
    d20: 20, degats: 10, type_degats: 'tranchants'
  });
  check('Attaque (résistance tranchants) → 200', atkResist.status === 200);
  check('Dégâts divisés par 2 (10 → 5)', atkResist.body?.degats_appliques === 5,
    `degats_appliques=${atkResist.body?.degats_appliques}`);
  pvElem -= 5;
  check('PV réduits de 5', atkResist.body?.pv_restants === pvElem,
    `pv_restants=${atkResist.body?.pv_restants}`);

  // Attaque avec dégâts feu → immunité → 0 dégâts
  const atkImmun = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: elemId,
    d20: 20, degats: 50, type_degats: 'feu'
  });
  check('Attaque (immunité feu) → 200', atkImmun.status === 200);
  check('Dégâts = 0 (immunité)',        atkImmun.body?.degats_appliques === 0,
    `degats_appliques=${atkImmun.body?.degats_appliques}`);
  check('PV inchangés',                 atkImmun.body?.pv_restants === pvElem,
    `pv_restants=${atkImmun.body?.pv_restants}`);

  // Attaque type non résisté → dégâts normaux
  const atkNormal = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: elemId,
    d20: 20, degats: 6, type_degats: 'acide'
  });
  check('Attaque (type non résisté) → dégâts normaux', atkNormal.body?.degats_appliques === 6,
    `degats_appliques=${atkNormal.body?.degats_appliques}`);

  // ── Jets de sauvegarde ─────────────────────────────────────────────────────
  suite('Jets de sauvegarde');

  const jsReussi = await post(`/Combats/${combatId}/sauvegarde`, {
    participant_id: joueurId, caracteristique: 'DEX',
    d20: 18, modificateur: 3, dd: 14
  });
  check('JS réussi → 200',     jsReussi.status === 200, `status ${jsReussi.status}`);
  check('reussi = true',        jsReussi.body?.reussi === true,
    `reussi=${jsReussi.body?.reussi}`);
  check('total = 21 (18+3)',    jsReussi.body?.total === 21,
    `total=${jsReussi.body?.total}`);
  check('concentration_brisee = false', jsReussi.body?.concentration_brisee === false,
    `concentration_brisee=${jsReussi.body?.concentration_brisee}`);

  const jsRate = await post(`/Combats/${combatId}/sauvegarde`, {
    participant_id: joueurId, caracteristique: 'STR',
    d20: 4, modificateur: -1, dd: 12
  });
  check('JS raté → 200',  jsRate.status === 200, `status ${jsRate.status}`);
  check('reussi = false', jsRate.body?.reussi === false,
    `reussi=${jsRate.body?.reussi}`);
  check('total = 3 (4-1)', jsRate.body?.total === 3,
    `total=${jsRate.body?.total}`);

  // ── Concentration ──────────────────────────────────────────────────────────
  suite('Concentration');

  // Poser la condition 'concentre' sur le monstre
  await put(`/Combats/${combatId}/participant/${monstreId}/conditions`, {
    conditions: ['concentre']
  });

  // Vérifier que 'concentre' est bien là
  const etatConc = await get(`/Combats/${sessionId}`);
  const monstreConc = etatConc.body?.participants?.find(p => p.id === monstreId);
  check("Condition 'concentre' posée", monstreConc?.conditions?.includes('concentre'),
    `conditions=${JSON.stringify(monstreConc?.conditions)}`);

  // JS CON raté → concentration brisée
  const jsConc = await post(`/Combats/${combatId}/sauvegarde`, {
    participant_id: monstreId, caracteristique: 'CON',
    d20: 1, modificateur: 0, dd: 10
  });
  check('JS CON raté → 200',              jsConc.status === 200, `status ${jsConc.status}`);
  check('concentration_brisee = true',     jsConc.body?.concentration_brisee === true,
    `concentration_brisee=${jsConc.body?.concentration_brisee}`);

  // Vérifier que 'concentre' a bien été retiré
  const etatApresConc = await get(`/Combats/${sessionId}`);
  const monstreApres  = etatApresConc.body?.participants?.find(p => p.id === monstreId);
  check("Condition 'concentre' retirée après JS CON raté",
    !monstreApres?.conditions?.includes('concentre'),
    `conditions=${JSON.stringify(monstreApres?.conditions)}`);

  // JS CON réussi → concentration préservée
  await put(`/Combats/${combatId}/participant/${monstreId}/conditions`, { conditions: ['concentre'] });
  const jsConcReussi = await post(`/Combats/${combatId}/sauvegarde`, {
    participant_id: monstreId, caracteristique: 'CON',
    d20: 20, modificateur: 0, dd: 10
  });
  check('JS CON réussi → concentration_brisee = false', jsConcReussi.body?.concentration_brisee === false,
    `concentration_brisee=${jsConcReussi.body?.concentration_brisee}`);

  // ── Fin de combat ──────────────────────────────────────────────────────────
  suite('Fin de combat (PUT statut=termine)');

  const fin = await put(`/Combats/${combatId}`, { statut: 'termine' });
  check('PUT /Combats/:id → 200 (fin)', fin.status === 200, `status ${fin.status}`);
  check('fin indique succès', fin.body?.success === true,
    `body=${JSON.stringify(fin.body)}`);

  // Vérifier qu'il n'y a plus de combat actif pour la session
  const lectureApres = await get(`/Combats/${sessionId}`);
  check('Plus de combat actif → 404', lectureApres.status === 404,
    `status ${lectureApres.status}`);

  // ── Immuabilité combat terminé ─────────────────────────────────────────────
  suite('Immuabilité combat terminé');

  const atkApresFin = await post(`/Combats/${combatId}/attaque`, {
    attaquant_id: joueurId, cible_id: monstreId,
    d20: 20, degats: 10, type_degats: 'tranchants'
  });
  check('Attaque sur combat terminé → 409', atkApresFin.status === 409,
    `status ${atkApresFin.status}`);

  const addApresFin = await post(`/Combats/${combatId}/participant`, {
    nom: '[TEST] Fantôme', type: 'monstre', initiative: 5, pv_max: 20, ca: 10
  });
  check('Ajout participant sur combat terminé → 409', addApresFin.status === 409,
    `status ${addApresFin.status}`);

  const soinApresFin = await post(`/Combats/${combatId}/soin`, {
    cible_id: joueurId, pv: 10
  });
  check('Soin sur combat terminé → 409', soinApresFin.status === 409,
    `status ${soinApresFin.status}`);

  // ── Route /fin avec calcul XP ──────────────────────────────────────────────
  suite('Route /fin avec calcul XP');

  // Créer un combat dédié pour /fin
  let combatXpId = null;
  const combatXpRes = await post('/Combats', { session_id: sessionId });
  check('Création combat XP → 201', combatXpRes.status === 201, `status ${combatXpRes.status}`);
  combatXpId = combatXpRes.body?._id ? String(combatXpRes.body._id) : null;

  if (combatXpId) {
    // Ajouter un monstre avec 100 XP
    const addXpM = await post(`/Combats/${combatXpId}/participant`, {
      nom: '[TEST] Dragon XP', type: 'monstre',
      initiative: 5, pv_max: 10, ca: 10, xp: 100
    });
    const monstreXpId = addXpM.body?.participant?.id;
    check('xp: 100 sauvegardé', addXpM.body?.participant?.xp === 100,
      `xp=${addXpM.body?.participant?.xp}`);

    // Tuer le monstre
    await post(`/Combats/${combatXpId}/attaque`, {
      attaquant_id: monstreXpId, cible_id: monstreXpId,
      d20: 20, degats: 9999, type_degats: 'tranchants'
    });

    // Appeler /fin → calcul XP auto
    const finXp = await post(`/Combats/${combatXpId}/fin`, {});
    check('POST /fin → 200',           finXp.status === 200, `status ${finXp.status}`);
    check('xp_total = 100',            finXp.body?.xp_total === 100,
      `xp_total=${finXp.body?.xp_total}`);
    check('xp_par_joueur présent',     finXp.body?.xp_par_joueur !== undefined,
      `xp_par_joueur=${finXp.body?.xp_par_joueur}`);
    check('combat marqué termine',     finXp.body?.success === true,
      `success=${finXp.body?.success}`);

    // Vérifier que /fin sur combat déjà terminé → 409
    const finBis = await post(`/Combats/${combatXpId}/fin`, {});
    check('POST /fin sur combat terminé → 409', finBis.status === 409,
      `status ${finBis.status}`);
  } else {
    check('Création combat XP', false, 'combatXpId manquant — tests /fin ignorés');
    check('xp_total = 100', false, 'skipped');
    check('xp_par_joueur présent', false, 'skipped');
    check('combat marqué termine', false, 'skipped');
    check('POST /fin sur combat terminé → 409', false, 'skipped');
  }

  // ── Nettoyage ──────────────────────────────────────────────────────────────
  if (sessionCreeePourTest) {
    suite('Nettoyage');
    const delSess = await request('DELETE', `/Sessions/${sessionId}`);
    check('Suppression session de test', delSess.status === 200 || delSess.status === 204,
      `status ${delSess.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  printReport();
  process.exit(failures > 0 ? 1 : 0);
}

function printReport() {
  process.stdout.write('\n' + '═'.repeat(50) + '\n');
  process.stdout.write(` RÉSULTAT : ${passes}/${total} tests passés`);
  if (combatId) process.stdout.write(`  |  Combat ID : ${combatId}`);
  process.stdout.write('\n');
  if (failures > 0) {
    process.stdout.write(` ✗ ${failures} ÉCHEC(S) :\n`);
    failDetails.forEach(f => process.stdout.write(`   · ${f}\n`));
  } else {
    process.stdout.write(` ✓ Tous les tests sont passés !\n`);
  }
  process.stdout.write('═'.repeat(50) + '\n');
  if (combatId) {
    process.stdout.write(`\n Note : Le combat de test ${combatId} reste en base (pas de DELETE /Combats).\n`);
  }
}

main().catch(err => {
  console.error('\nErreur inattendue :', err.message);
  process.exit(1);
});
