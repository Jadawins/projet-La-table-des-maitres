// ═══════════════════════════════════════════════════════════════
//  fetch-monstres.js — Récupère tous les monstres SRD 2024 depuis Open5e
//  Usage : node scripts/fetch-monstres.js
// ═══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const START_URL      = 'https://api.open5e.com/v1/monsters/?document__slug=wotc-srd&limit=100';
const OUTPUT_DIR     = path.join(__dirname, '..', 'Json', '2024', 'Monstres');
const CHECKPOINT     = path.join(__dirname, 'checkpoint_fetch_monstres.json');
const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 2000;

// ─── DICTIONNAIRE DE TRADUCTION ──────────────────────────────

const TRADUCTIONS = {
  // Humanoïdes communs
  'Goblin': 'Gobelin',
  'Orc': 'Orque',
  'Ogre': 'Ogre',
  'Troll': 'Troll',
  'Gnoll': 'Gnoll',
  'Kobold': 'Kobold',
  'Hobgoblin': 'Hobgobelin',
  'Bugbear': 'Bugbear',
  'Lizardfolk': 'Homme-lézard',
  'Merfolk': 'Homme-poisson',
  'Sahuagin': 'Sahuagin',
  'Aarakocra': 'Aarakocra',
  'Githyanki': 'Githyanki',
  'Githzerai': 'Githzéraï',
  'Drow': 'Drow',
  // Morts-vivants
  'Zombie': 'Zombie',
  'Skeleton': 'Squelette',
  'Vampire': 'Vampire',
  'Ghoul': 'Goule',
  'Ghast': 'Ghast',
  'Wight': 'Spectre',
  'Wraith': 'Revenant',
  'Specter': 'Spectre',
  'Banshee': 'Banshee',
  'Lich': 'Liche',
  'Mummy': 'Momie',
  'Shadow': 'Ombre',
  'Poltergeist': 'Poltergeist',
  // Bêtes
  'Wolf': 'Loup',
  'Bear': 'Ours',
  'Lion': 'Lion',
  'Tiger': 'Tigre',
  'Panther': 'Panthère',
  'Boar': 'Sanglier',
  'Deer': 'Cerf',
  'Elk': 'Élan',
  'Rat': 'Rat',
  'Bat': 'Chauve-souris',
  'Spider': 'Araignée',
  'Scorpion': 'Scorpion',
  'Snake': 'Serpent',
  'Crocodile': 'Crocodile',
  'Shark': 'Requin',
  'Eagle': 'Aigle',
  'Hawk': 'Faucon',
  'Owl': 'Hibou',
  'Raven': 'Corbeau',
  'Cat': 'Chat',
  'Dog': 'Chien',
  'Horse': 'Cheval',
  'Pony': 'Poney',
  'Mule': 'Mule',
  'Donkey': 'Âne',
  'Ox': 'Bœuf',
  'Camel': 'Chameau',
  'Elephant': 'Éléphant',
  'Mammoth': 'Mammouth',
  'Rhinoceros': 'Rhinocéros',
  'Hippogriff': 'Hippogriffe',
  'Pegasus': 'Pégase',
  'Unicorn': 'Licorne',
  'Griffon': 'Griffon',
  'Wyvern': 'Wyverne',
  'Roc': 'Roc',
  'Kraken': 'Kraken',
  // Dragons
  'Dragon': 'Dragon',
  'Drake': 'Drakôn',
  // Démons & Diables
  'Demon': 'Démon',
  'Devil': 'Diable',
  'Imp': 'Diablotin',
  'Succubus': 'Succube',
  'Incubus': 'Incube',
  'Balor': 'Balor',
  'Marilith': 'Marilith',
  'Pit Fiend': 'Fiend des fosses',
  'Erinyes': 'Érinye',
  // Géants
  'Giant': 'Géant',
  'Ogre': 'Ogre',
  'Cyclops': 'Cyclope',
  // Élémentaires
  'Elemental': 'Élémentaire',
  'Djinni': 'Djinn',
  'Efreeti': 'Éfrit',
  'Dao': 'Dao',
  'Marid': 'Marid',
  // Divers
  'Golem': '  Golem',
  'Gargoyle': 'Gargouille',
  'Mimic': 'Mimic',
  'Beholder': 'Contemplateur',
  'Mind Flayer': 'Flagelleur mental',
  'Mindflayer': 'Flagelleur mental',
  'Aboleth': 'Aboleth',
  'Medusa': 'Méduse',
  'Harpy': 'Harpie',
  'Centaur': 'Centaure',
  'Minotaur': 'Minotaure',
  'Chimera': 'Chimère',
  'Basilisk': 'Basilic',
  'Hydra': 'Hydre',
  'Manticore': 'Manticore',
  'Lamia': 'Lamie',
  'Naga': 'Naga',
  'Mephit': 'Méphite',
  'Merrow': 'Merrow',
  'Werewolf': 'Loup-garou',
  'Werebear': 'Ours-garou',
  'Wererat': 'Rat-garou',
  'Weretiger': 'Tigre-garou',
  'Wereboar': 'Sanglier-garou',
  'Dryad': 'Dryade',
  'Nymph': 'Nymphe',
  'Satyr': 'Satyre',
  'Pixie': 'Pixie',
  'Sprite': 'Sprite',
  'Treant': 'Sylvanien',
  'Cloaker': 'Enveloppeur',
  'Behir': 'Béhir',
  'Bulette': 'Bulette',
  'Carrion Crawler': 'Ver charognard',
  'Darkmantle': 'Sombre manteau',
  'Ettercap': 'Ettercap',
  'Flumph': 'Flumph',
  'Grick': 'Grick',
  'Displacer Beast': 'Bête déplacante',
  'Peryton': 'Pérityon',
  'Phase Spider': 'Araignée de phase',
  'Roper': 'Roper',
  'Rust Monster': 'Monstre de rouille',
  'Stirge': 'Stirge',
  'Troglodyte': 'Troglodyte',
  'Umber Hulk': 'Hulk des ombres',
  'Xorn': 'Xorn',
  'Quasit': 'Quasi-démon',
  'Hell Hound': 'Chien de l\'enfer',
  'Nightmare': 'Cauchemar',
  'Cambion': 'Cambion',
  'Gladiator': 'Gladiateur',
  'Knight': 'Chevalier',
  'Guard': 'Garde',
  'Spy': 'Espion',
  'Thug': 'Brigand',
  'Bandit': 'Bandit',
  'Assassin': 'Assassin',
  'Priest': 'Prêtre',
  'Mage': 'Mage',
  'Archmage': 'Archimage',
  'Druid': 'Druide',
  'Berserker': 'Berserker',
  'Acolyte': 'Acolyte',
  'Scout': 'Éclaireur',
  'Commoner': 'Roturier',
  'Noble': 'Noble',
  'Veteran': 'Vétéran',
};

function traduireNom(name) {
  if (TRADUCTIONS[name]) return TRADUCTIONS[name];
  // Chercher si un mot-clé connu est dans le nom (ex: "Adult Red Dragon" → contient "Dragon")
  // Pour les noms complexes : garder l'anglais
  return name;
}

// ─── CONVERSIONS ──────────────────────────────────────────────

const TAILLES = {
  Tiny: 'TP', Small: 'P', Medium: 'M',
  Large: 'G', Huge: 'TG', Gargantuan: 'Gig'
};

function feetToMeters(feet) {
  if (!feet || feet === 0) return null;
  const m = feet / 3.281;
  return Math.round(m / 1.5) * 1.5;
}

function parseFP(cr) {
  if (cr === '1/8') return 0.125;
  if (cr === '1/4') return 0.25;
  if (cr === '1/2') return 0.5;
  const n = parseFloat(cr);
  return isNaN(n) ? 0 : n;
}

function fpToXP(fp) {
  const table = {
    0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
  };
  return table[fp] ?? null;
}

function fpToBonusMaitrise(fp) {
  if (fp <= 4) return 2;
  if (fp <= 8) return 3;
  if (fp <= 12) return 4;
  if (fp <= 16) return 5;
  if (fp <= 20) return 6;
  if (fp <= 24) return 7;
  if (fp <= 28) return 8;
  return 9;
}

function mod(val) {
  return Math.floor((val - 10) / 2);
}

function splitList(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── PARSING SENS ─────────────────────────────────────────────

function parseSens(sensStr) {
  const result = {
    vision_dans_le_noir: null,
    vision_aveugle: null,
    vision_vraie: null,
    perception_passive: null,
    tremblements: null,
  };
  if (!sensStr) return result;
  const dvMatch = sensStr.match(/darkvision\s+(\d+)\s*ft/i);
  if (dvMatch) result.vision_dans_le_noir = feetToMeters(parseInt(dvMatch[1]));
  const bsMatch = sensStr.match(/blindsight\s+(\d+)\s*ft/i);
  if (bsMatch) result.vision_aveugle = feetToMeters(parseInt(bsMatch[1]));
  const tvMatch = sensStr.match(/truesight\s+(\d+)\s*ft/i);
  if (tvMatch) result.vision_vraie = feetToMeters(parseInt(tvMatch[1]));
  const tsMatch = sensStr.match(/tremorsense\s+(\d+)\s*ft/i);
  if (tsMatch) result.tremblements = feetToMeters(parseInt(tsMatch[1]));
  const ppMatch = sensStr.match(/passive\s+Perception\s+(\d+)/i);
  if (ppMatch) result.perception_passive = parseInt(ppMatch[1]);
  return result;
}

// ─── PARSING VITESSE ──────────────────────────────────────────

function parseVitesse(speed) {
  if (!speed) return { marche: null, nage: null, vol: null, fouissement: null, escalade: null };
  return {
    marche:      feetToMeters(speed.walk      || 0) || null,
    nage:        feetToMeters(speed.swim      || 0) || null,
    vol:         feetToMeters(speed.fly       || 0) || null,
    fouissement: feetToMeters(speed.burrow    || 0) || null,
    escalade:    feetToMeters(speed.climb     || 0) || null,
  };
}

// ─── PARSING ACTIONS ──────────────────────────────────────────

function parseActions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(a => ({
    nom: a.name || '',
    description: a.desc || '',
    bonus_attaque: a.attack_bonus ?? null,
    degats_de: a.damage_dice || null,
    degats_bonus: a.damage_bonus ?? null,
  }));
}

// ─── TRANSFORMATION D'UN MONSTRE ─────────────────────────────

function transformMonster(m) {
  const fpNum = parseFP(m.challenge_rating);
  const nomTraduit = traduireNom(m.name);

  return {
    slug: m.slug,
    nom: nomTraduit,
    nom_original: m.name,
    taille: TAILLES[m.size] || m.size || null,
    type: m.type || null,
    sous_type: m.subtype || null,
    alignement: m.alignment || null,
    ca: m.armor_class ?? null,
    ca_detail: m.armor_desc || null,
    pv: m.hit_points ?? null,
    pv_formule: m.hit_dice || null,
    vitesse: parseVitesse(m.speed),
    caracteristiques: {
      FOR: m.strength ?? null,     FOR_mod: m.strength    != null ? mod(m.strength)    : null,
      DEX: m.dexterity ?? null,    DEX_mod: m.dexterity   != null ? mod(m.dexterity)   : null,
      CON: m.constitution ?? null, CON_mod: m.constitution != null ? mod(m.constitution) : null,
      INT: m.intelligence ?? null, INT_mod: m.intelligence != null ? mod(m.intelligence) : null,
      SAG: m.wisdom ?? null,       SAG_mod: m.wisdom      != null ? mod(m.wisdom)      : null,
      CHA: m.charisma ?? null,     CHA_mod: m.charisma    != null ? mod(m.charisma)    : null,
    },
    jets_sauvegarde: {
      FOR: m.strength_save     ?? null,
      DEX: m.dexterity_save    ?? null,
      CON: m.constitution_save ?? null,
      INT: m.intelligence_save ?? null,
      SAG: m.wisdom_save       ?? null,
      CHA: m.charisma_save     ?? null,
    },
    competences: m.skills || {},
    resistances:      splitList(m.damage_resistances),
    immunites_degats: splitList(m.damage_immunities),
    vulnerabilites:   splitList(m.damage_vulnerabilities),
    immunites_etats:  splitList(m.condition_immunities),
    sens: parseSens(m.senses),
    langues: splitList(m.languages),
    fp: m.challenge_rating || '0',
    fp_numerique: fpNum,
    bonus_maitrise: fpToBonusMaitrise(fpNum),
    experience: fpToXP(fpNum),
    traits:              parseActions(m.special_abilities),
    actions:             parseActions(m.actions),
    actions_bonus:       parseActions(m.bonus_actions),
    reactions:           parseActions(m.reactions),
    actions_legendaires: parseActions(m.legendary_actions),
    source: 'SRD-2024',
    image: m.img_main || null,
  };
}

// ─── FETCH AVEC RETRY ─────────────────────────────────────────

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i < retries - 1) {
        console.warn(`  ⚠ Erreur (${err.message}), retry ${i + 1}/${retries - 1}...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      } else {
        throw err;
      }
    }
  }
}

// ─── CHECKPOINT ───────────────────────────────────────────────

function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  }
  return { derniere_page_url: null, monstres_sauvegardes: 0, statut: 'en_cours' };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const cp = loadCheckpoint();
  let url = cp.derniere_page_url || START_URL;
  let total = cp.monstres_sauvegardes;

  if (cp.statut === 'terminé') {
    console.log(`✅ Déjà terminé (${total} monstres). Supprimez ${CHECKPOINT} pour recommencer.`);
    return;
  }

  console.log(`🐉 Début du fetch — reprise depuis : ${url}`);
  console.log(`   Monstres déjà sauvegardés : ${total}\n`);

  let page = 1;
  while (url) {
    console.log(`📄 Page ${page} : ${url}`);
    const data = await fetchWithRetry(url);
    const results = data.results || [];

    for (const raw of results) {
      const monster = transformMonster(raw);
      const filePath = path.join(OUTPUT_DIR, `${monster.slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(monster, null, 2));
      total++;
      process.stdout.write(`  ✓ [${total}] ${monster.slug} (${monster.nom})\n`);
    }

    url = data.next || null;
    cp.derniere_page_url = url;
    cp.monstres_sauvegardes = total;
    saveCheckpoint(cp);

    page++;
  }

  // ─── INDEX ────────────────────────────────────────────────

  console.log('\n📋 Génération de index.json...');
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const index = files.map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
    return { slug: d.slug, nom: d.nom, nom_original: d.nom_original, fp: d.fp, fp_numerique: d.fp_numerique, type: d.type, taille: d.taille };
  }).sort((a, b) => a.slug.localeCompare(b.slug));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  // ─── STATS ────────────────────────────────────────────────

  const parType = {};
  const parFP = {};
  for (const m of index) {
    parType[m.type] = (parType[m.type] || 0) + 1;
    parFP[m.fp]     = (parFP[m.fp]     || 0) + 1;
  }

  console.log(`\n✅ Fetch terminé — ${total} monstres sauvegardés\n`);
  console.log('📊 Répartition par type :');
  Object.entries(parType).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`   ${k.padEnd(20)} ${v}`));
  console.log('\n📊 Répartition par FP :');
  Object.entries(parFP).sort((a,b) => parseFP(a[0])-parseFP(b[0])).forEach(([k,v]) => console.log(`   FP ${k.padEnd(6)} ${v}`));

  // ─── CHECKPOINT FINAL ────────────────────────────────────

  cp.statut = 'terminé';
  saveCheckpoint(cp);
  console.log('\n🏁 Checkpoint marqué comme terminé.');
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err.message);
  process.exit(1);
});
