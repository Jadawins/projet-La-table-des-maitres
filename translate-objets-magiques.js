#!/usr/bin/env node
/**
 * Traduit + restructure les objets magiques pour le système de combat
 * - Traduit le nom (FR officiel D&D)
 * - Génère un résumé 1-2 phrases FR (remplace description + description_fr)
 * - Extrait les données de combat structurées
 * - Supprime description et description_fr
 *
 * Usage: ANTHROPIC_API_KEY=sk-ant-... node translate-objets-magiques.js
 */
require('./api/node_modules/dotenv/lib/main.js').config({ path: './api/.env' });
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const JSON_DIR   = path.join(__dirname, 'Json/2024/Objets-magiques');
const BATCH_SIZE = 5;
const client     = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es un expert D&D 5e (version française officielle Wizards of the Coast).
Pour chaque objet magique fourni, génère :
- "nom_fr" : nom en français (traduction officielle D&D 5e si elle existe, sinon traduction littérale soignée)
- "resume" : description courte en 1-2 phrases maximum en français, résumant l'effet principal
- "combat" : objet JSON avec les données mécaniques :
  - "bonus" (number) : bonus global +1/+2/+3 (attaque+dégâts pour armes, CA pour armures), 0 si aucun
  - "bonus_ca" (number) : bonus CA spécifique (armures magiques), 0 si aucun
  - "degats_bonus" (string) : formule de dégâts bonus ex "1d6", "" si aucun
  - "type_degats_bonus" (string) : type des dégâts bonus ex "feu", "acide", "foudre"..., "" si aucun
  - "pv_soins" (string) : formule PV soignés ex "2d4+2", "" si non applicable
  - "charges" (number|null) : charges max si l'objet en a, null sinon
  - "effets" (array of string) : liste des effets spéciaux en français, max 3 éléments courts
  - "avantage" (array of string) : liste des types de jets pour lesquels l'objet accorde l'avantage, parmi : "attaque", "force", "dexterite", "constitution", "intelligence", "sagesse", "charisme", "sauvegarde", "initiative", "perception", "discrétion" — tableau vide si aucun
  - "resistances" (array of string) : types de dégâts auxquels l'objet confère une résistance, ex ["feu","froid"] — tableau vide si aucun
  - "immunites" (array of string) : types de dégâts auxquels l'objet confère une immunité — tableau vide si aucun

Réponds UNIQUEMENT par un objet JSON valide de la forme :
{ "slug1": { "nom_fr": "...", "resume": "...", "combat": { ... } }, "slug2": { ... } }
Aucun texte avant ou après le JSON.`;

async function processBatch(items) {
  const input = items.map(({ slug, nom, description_fr, description }) => {
    const desc = (description_fr && description_fr.trim()) ? description_fr : description;
    return `slug: ${slug}\nnom actuel: ${nom}\ndescription: ${desc}`;
  }).join('\n\n---\n\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: input }]
  });

  const text = msg.content[0].text.trim();
  const match = text.match(/\{[\s\S]+\}/);
  if (!match) throw new Error('Réponse invalide : ' + text.slice(0, 100));
  return JSON.parse(match[0]);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquant');
    process.exit(1);
  }

  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  console.log(`📂 ${files.length} fichiers JSON\n`);

  // Charger tous les objets valides
  const items = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf-8'));
      if (!data.slug) data.slug = f.replace('.json', '');
      items.push({ file: f, data });
    } catch (e) { console.warn(`⚠ ${f} ignoré (JSON invalide)`); }
  }

  const totalBatches = Math.ceil(items.length / BATCH_SIZE);
  console.log(`🔄 ${items.length} objets → ${totalBatches} batches de ${BATCH_SIZE}\n`);

  let updated = 0, errors = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`  [${batchNum}/${totalBatches}] ${batch[0].data.nom.slice(0,30).padEnd(30)} … `);

    try {
      const results = await processBatch(batch.map(b => b.data));

      for (const { file, data } of batch) {
        const r = results[data.slug];
        if (!r) continue;

        // Appliquer les traductions
        if (r.nom_fr && r.nom_fr.trim()) data.nom = r.nom_fr.trim();
        if (r.resume && r.resume.trim()) data.resume = r.resume.trim();
        if (r.combat && typeof r.combat === 'object') {
          data.combat = {
            bonus:             parseInt(r.combat.bonus)      || 0,
            bonus_ca:          parseInt(r.combat.bonus_ca)   || 0,
            degats_bonus:      r.combat.degats_bonus         || '',
            type_degats_bonus: r.combat.type_degats_bonus    || '',
            pv_soins:          r.combat.pv_soins             || '',
            charges:           r.combat.charges != null ? parseInt(r.combat.charges) || null : null,
            effets:            Array.isArray(r.combat.effets)      ? r.combat.effets.slice(0, 3)  : [],
            avantage:          Array.isArray(r.combat.avantage)    ? r.combat.avantage             : [],
            resistances:       Array.isArray(r.combat.resistances) ? r.combat.resistances          : [],
            immunites:         Array.isArray(r.combat.immunites)   ? r.combat.immunites            : [],
          };
        }

        // Supprimer les longues descriptions (remplacées par resume)
        delete data.description;
        delete data.description_fr;

        fs.writeFileSync(path.join(JSON_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
        updated++;
      }
      console.log('✓');
    } catch (e) {
      console.log('✗', e.message.slice(0, 60));
      errors++;
    }

    // Pause anti rate-limit
    if (i + BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n✅ ${updated} objets mis à jour, ${errors} erreurs`);
  console.log('→ Relance le script d\'import objets-magiques sur le VPS');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
