#!/usr/bin/env node
/**
 * Traduit tous les champs texte anglais des monstres via Claude Haiku
 * Usage: ANTHROPIC_API_KEY=sk-ant-... node translate-monstres.js
 */
require('./api/node_modules/dotenv/lib/main.js').config({ path: './api/.env' });
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const JSON_DIR = path.join(__dirname, 'Json/2024/Monstres');
const client   = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 40;

// ─── MAPPINGS FIXES (vocabulaire D&D connu) ──────────────────────────────────

const SKILL_FR = {
  'acrobatics': 'acrobaties', 'animal handling': 'dressage', 'arcana': 'arcanes',
  'athletics': 'athlétisme', 'deception': 'tromperie', 'history': 'histoire',
  'insight': 'perspicacité', 'intimidation': 'intimidation', 'investigation': 'investigation',
  'medicine': 'médecine', 'nature': 'nature', 'perception': 'perception',
  'performance': 'représentation', 'persuasion': 'persuasion', 'religion': 'religion',
  'sleight of hand': 'escamotage', 'stealth': 'discrétion', 'survival': 'survie',
};

const LANG_FR = {
  'common': 'commun', 'draconic': 'draconique', 'deep speech': 'langue des profondeurs',
  'elvish': 'elfique', 'dwarvish': 'nain', 'gnomish': 'gnome', 'halfling': 'halfelin',
  'orc': 'orque', 'orcish': 'orque', 'abyssal': 'abyssal', 'celestial': 'céleste',
  'infernal': 'infernal', 'primordial': 'primordial', 'sylvan': 'sylvestre',
  'undercommon': 'commun des profondeurs', 'giant': 'géant', 'goblin': 'gobelin',
  'gnoll': 'gnoll', "thieves' cant": 'argot des voleurs', 'terran': 'terreux',
  'aquan': 'aquatique', 'auran': 'aérien', 'ignan': 'igné', 'darakhul': 'darakhul',
  'giant eagle': 'aigle géant', 'winter wolf': 'loup des neiges',
  'worg': 'worg', 'sahuagin': 'sahuagin', 'troglodyte': 'troglodyte',
  'blink dog': 'chien clignotant', 'hook horror': 'horreur crochue',
  'ice toad': 'crapaud de glace', 'kruthik': 'kruthik', 'slaad': 'slaadi',
};

const CA_FR = {
  'natural armor': 'armure naturelle',
  'plate armor': 'armure en plaques',
  'chain mail': 'cotte de mailles',
  'leather armor': 'armure de cuir',
  'hide armor': 'armure en peau',
  'scale mail': 'cotte à écailles',
  'ring mail': 'cotte de mailles à anneaux',
  'half plate': 'demi-plaques',
  'splint armor': 'armure à éclisses',
  'breastplate': 'cuirasse',
  'studded leather': 'armure de cuir clouté',
  'shield': 'bouclier',
  'mage armor': 'armure du mage',
  'unarmored defense': 'défense sans armure',
  'patchwork armor': 'armure de fortune',
  'padded armor': 'armure matelassée',
};

function translateCa(val) {
  if (!val) return val;
  let result = val.toLowerCase();
  // Chercher un match exact d'abord
  if (CA_FR[result]) return CA_FR[result];
  // Chercher les composants ("natural armor, shield" → "armure naturelle, bouclier")
  for (const [en, fr] of Object.entries(CA_FR)) {
    result = result.replace(new RegExp(en, 'gi'), fr);
  }
  return result !== val.toLowerCase() ? result : val;
}

function translateLang(lang) {
  if (!lang) return lang;
  // Garder "telepathy X ft." mais traduire le reste
  const tele = lang.match(/telepathy\s+(\d+)\s*ft/i);
  if (tele) return `télépathie ${Math.round(parseInt(tele[1]) * 0.3)} m`;
  return LANG_FR[lang.toLowerCase()] || lang;
}

function translateSkills(competences) {
  if (!competences || typeof competences !== 'object') return competences;
  const result = {};
  for (const [key, val] of Object.entries(competences)) {
    result[SKILL_FR[key.toLowerCase()] || key] = val;
  }
  return result;
}

// ─── TRADUCTION VIA API ───────────────────────────────────────────────────────

async function translateBatch(strings) {
  const unique = [...new Set(strings)];
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Tu es un expert D&D 5e (version française officielle). Traduis ces termes en français en utilisant la terminologie officielle du Manuel des Monstres et du Livre du Joueur D&D 5e FR. Les noms propres de monstres, sorts et lieux peuvent rester en français D&D officiel. Réponds UNIQUEMENT par un objet JSON valide { "terme_anglais": "terme_français" } sans texte avant ou après.

Termes à traduire :
${unique.join('\n')}`
    }]
  });

  const text = msg.content[0].text.trim();
  const match = text.match(/\{[\s\S]+\}/);
  if (!match) throw new Error('Réponse invalide');
  return JSON.parse(match[0]);
}

// ─── COLLECTE DE TOUS LES TERMES UNIQUES ─────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquant');
    process.exit(1);
  }

  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  const monsters = [];
  for (const f of files) {
    try {
      monsters.push({ file: f, data: JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf-8')) });
    } catch (e) { console.warn(`⚠ ${f}`); }
  }

  // Collecter tous les termes uniques à traduire via API
  const toApiTranslate = new Set();

  monsters.forEach(({ data: m }) => {
    // Noms de monstres anglais
    if (m.nom === m.nom_original) toApiTranslate.add(m.nom);
    // Noms de traits / actions / légendaires
    ['traits', 'actions', 'actions_bonus', 'reactions', 'actions_legendaires'].forEach(arr => {
      (m[arr] || []).forEach(a => { if (a.nom) toApiTranslate.add(a.nom); });
    });
  });

  const allTerms = [...toApiTranslate];
  console.log(`📋 ${allTerms.length} termes uniques à traduire via API\n`);

  // Traduire par batches
  const translations = {};
  for (let i = 0; i < allTerms.length; i += BATCH_SIZE) {
    const batch = allTerms.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(allTerms.length/BATCH_SIZE)} … `);
    try {
      const result = await translateBatch(batch);
      Object.assign(translations, result);
      console.log('✓');
    } catch (e) {
      console.log('✗', e.message);
    }
    if (i + BATCH_SIZE < allTerms.length) await new Promise(r => setTimeout(r, 400));
  }

  // Appliquer toutes les traductions
  let updated = 0;
  for (const { file, data: m } of monsters) {
    let changed = false;

    // Nom du monstre
    if (m.nom === m.nom_original && translations[m.nom] && translations[m.nom] !== m.nom) {
      m.nom = translations[m.nom];
      changed = true;
    }

    // Noms traits / actions
    ['traits', 'actions', 'actions_bonus', 'reactions', 'actions_legendaires'].forEach(arr => {
      (m[arr] || []).forEach(a => {
        if (a.nom && translations[a.nom] && translations[a.nom] !== a.nom) {
          a.nom = translations[a.nom];
          changed = true;
        }
      });
    });

    // Langues (mapping fixe)
    if (Array.isArray(m.langues)) {
      const newLangues = m.langues.map(translateLang);
      if (JSON.stringify(newLangues) !== JSON.stringify(m.langues)) {
        m.langues = newLangues;
        changed = true;
      }
    }

    // CA detail (mapping fixe)
    if (m.ca_detail) {
      const newCa = translateCa(m.ca_detail);
      if (newCa !== m.ca_detail) { m.ca_detail = newCa; changed = true; }
    }

    // Compétences (mapping fixe)
    if (m.competences) {
      const newComp = translateSkills(m.competences);
      if (JSON.stringify(newComp) !== JSON.stringify(m.competences)) {
        m.competences = newComp;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(path.join(JSON_DIR, file), JSON.stringify(m, null, 2), 'utf-8');
      updated++;
    }
  }

  console.log(`\n✅ ${updated}/${monsters.length} fichiers mis à jour`);
  console.log('→ Relance : node api/import-monstres.js');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
