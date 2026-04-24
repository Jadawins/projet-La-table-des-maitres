#!/usr/bin/env node
/**
 * Import + conversion des monstres SRD dans MongoDB
 * Convertit le format source (open5e) vers le format attendu par le moteur de combat.
 *
 * Usage: node import-monstres.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const JSON_DIR  = path.join(__dirname, '../Json/2024/Monstres');
const MONGO_URI = process.env.MONGO_URI;

// ─── MAPPINGS ────────────────────────────────────────────────────────────────

const DMG_TYPE_FR = {
  'acid':        'acide',
  'bludgeoning': 'contondant',
  'cold':        'froid',
  'fire':        'feu',
  'force':       'force',
  'lightning':   'foudre',
  'necrotic':    'nécrotique',
  'piercing':    'perforant',
  'poison':      'poison',
  'psychic':     'psychique',
  'radiant':     'radieux',
  'slashing':    'tranchant',
  'thunder':     'tonnerre',
};

const COND_FR = {
  'blinded':       'aveuglé',
  'charmed':       'charmé',
  'deafened':      'assourdi',
  'exhaustion':    'épuisement',
  'frightened':    'effrayé',
  'grappled':      'agrippé',
  'incapacitated': 'incapacité d\'agir',
  'invisible':     'invisible',
  'paralyzed':     'paralysé',
  'petrified':     'pétrifié',
  'poisoned':      'empoisonné',
  'prone':         'à terre',
  'restrained':    'entravé',
  'stunned':       'étourdi',
  'unconscious':   'inconscient',
};

const ALIGN_FR = {
  'lawful good':     'loyal bon',
  'neutral good':    'neutre bon',
  'chaotic good':    'chaotique bon',
  'lawful neutral':  'loyal neutre',
  'true neutral':    'neutre',
  'neutral':         'neutre',
  'chaotic neutral': 'chaotique neutre',
  'lawful evil':     'loyal mauvais',
  'neutral evil':    'neutre mauvais',
  'chaotic evil':    'chaotique mauvais',
  'unaligned':       'sans alignement',
  'any alignment':   'tout alignement',
  'any evil':        'tout mauvais',
  'any non-good':    'tout non-bon',
  'any non-lawful':  'tout non-loyal',
  'any chaotic':     'tout chaotique',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function translateList(arr, map) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(v => map[v.toLowerCase()] || v);
}

function extractDmgType(desc) {
  if (!desc) return '';
  for (const [en, fr] of Object.entries(DMG_TYPE_FR)) {
    if (new RegExp(`\\b${en}\\b`, 'i').test(desc)) return fr;
  }
  return '';
}

function extractPortee(desc) {
  if (!desc) return '';
  // "reach 10 ft." → "3 m" | "range 60/240 ft." → "18/72 m"
  const reachM = desc.match(/reach\s+(\d+)\s*ft/i);
  if (reachM) return `${Math.round(parseInt(reachM[1]) * 0.3)} m`;
  const rangeM = desc.match(/range\s+([\d/]+)\s*ft/i);
  if (rangeM) return rangeM[1].split('/').map(v => Math.round(parseInt(v) * 0.3)).join('/') + ' m';
  return '';
}

function buildDegats(degats_de, degats_bonus) {
  if (!degats_de) return '';
  if (!degats_bonus && degats_bonus !== 0) return degats_de;
  if (degats_bonus === 0) return degats_de;
  return degats_bonus > 0 ? `${degats_de}+${degats_bonus}` : `${degats_de}${degats_bonus}`;
}

function extractCout(nom) {
  // "Wing Attack (Costs 2 Actions)" → 2
  const m = String(nom).match(/costs\s+(\d+)\s+action/i);
  return m ? parseInt(m[1]) : 1;
}

function extractLegRes(traits) {
  if (!Array.isArray(traits)) return 0;
  for (const t of traits) {
    const m = String(t.nom || '').match(/legendary resistance\s+\((\d+)/i);
    if (m) return parseInt(m[1]);
  }
  return 0;
}

function normalizeAction(a, withCout = false) {
  const isAtk = a.bonus_attaque != null;
  const obj = {
    nom:         a.nom,
    type_action: isAtk ? 'attaque' : 'texte',
    bonus_atk:   a.bonus_attaque || 0,
    degats:      buildDegats(a.degats_de, a.degats_bonus),
    type_degats: extractDmgType(a.description),
    portee:      extractPortee(a.description),
    desc:        a.description || '',
  };
  if (withCout) obj.cout = extractCout(a.nom);
  return obj;
}

// ─── CONVERSION PRINCIPALE ───────────────────────────────────────────────────

function convertMonster(src) {
  const m = { ...src };

  // 1. XP
  m.xp = src.experience || 0;

  // 2. Alignement FR
  if (m.alignement) {
    m.alignement = ALIGN_FR[m.alignement.toLowerCase()] || m.alignement;
  }

  // 3. Immunités / résistances / vulnérabilités → FR
  m.immunites_degats  = translateList(src.immunites_degats,  DMG_TYPE_FR);
  m.resistances       = translateList(src.resistances,       DMG_TYPE_FR);
  m.vulnerabilites    = translateList(src.vulnerabilites,    DMG_TYPE_FR);
  m.immunites_etats   = translateList(src.immunites_etats,   COND_FR);

  // 4. Extraire attaques (actions avec bonus_attaque != null)
  const actions = src.actions || [];
  m.attaques = actions
    .filter(a => a.bonus_attaque != null)
    .map(a => ({
      nom:    a.nom,
      bonus:  a.bonus_attaque,
      degats: buildDegats(a.degats_de, a.degats_bonus),
      type:   extractDmgType(a.description),
      portee: extractPortee(a.description),
      desc:   a.description || '',
    }));

  // 5. actions → garder uniquement les actions texte (non-attaques)
  m.actions = actions
    .filter(a => a.bonus_attaque == null)
    .map(a => ({ nom: a.nom, desc: a.description || '' }));

  // 6. Normaliser actions_bonus, réactions, légendaires
  m.actions_bonus       = (src.actions_bonus       || []).map(a => normalizeAction(a));
  m.reactions           = (src.reactions           || []).map(a => normalizeAction(a));
  m.actions_legendaires = (src.actions_legendaires || []).map(a => normalizeAction(a, true));

  // 7. Pool légendaire et résistances légendaires
  m.actions_leg_nb     = m.actions_legendaires.length > 0 ? 3 : 0;
  m.resistances_leg_nb = extractLegRes(src.traits || []);

  return m;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  if (!MONGO_URI) { console.error('❌ MONGO_URI manquant dans .env'); process.exit(1); }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const col = client.db('myrpgtable').collection('monstres');

  console.log('🗑  Vidage de la collection monstres…');
  await col.deleteMany({});

  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  console.log(`📂 ${files.length} fichiers JSON trouvés`);

  const docs = [];
  let errors = 0;
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
      if (Array.isArray(raw)) continue;
      if (!raw.slug) raw.slug = file.replace('.json', '');
      docs.push(convertMonster(raw));
    } catch (e) {
      console.warn(`  ⚠ ${file} : ${e.message}`);
      errors++;
    }
  }

  if (docs.length) {
    await col.insertMany(docs, { ordered: false });
  }

  console.log('🔧 Création des index…');
  await col.createIndex({ slug: 1 }, { unique: true });
  await col.createIndex({ nom: 1 });
  await col.createIndex({ type: 1 });
  await col.createIndex({ taille: 1 });
  await col.createIndex({ fp_numerique: 1 });
  await col.createIndex({ source: 1 });

  const total = await col.countDocuments();
  console.log(`\n✅ ${total} monstres importés${errors ? ` (${errors} erreurs ignorées)` : ''}\n`);

  // Stats FP
  const fpStats = await col.aggregate([
    { $group: { _id: '$fp', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();
  console.log('📊 Répartition par FP :');
  for (const s of fpStats) {
    console.log(`   FP ${String(s._id || '?').padEnd(6)} : ${s.count}`);
  }

  await client.close();
}

main().catch(e => { console.error('❌ Erreur :', e.message); process.exit(1); });
