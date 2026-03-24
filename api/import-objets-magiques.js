#!/usr/bin/env node
/**
 * Import des objets magiques SRD dans MongoDB
 * Usage: node import-objets-magiques.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const JSON_DIR = path.join(__dirname, '../Json/2024/Objets-magiques');
const MONGO_URI = process.env.MONGO_URI;

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('myrpgtable');
  const col = db.collection('objets_magiques');

  console.log('🗑  Vidage de la collection objets_magiques…');
  await col.deleteMany({});

  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  console.log(`📂 ${files.length} fichiers JSON trouvés`);

  const docs = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf-8'));
      if (Array.isArray(data)) {
        // Fichier d'index ou tableau — on ignore (pas des objets individuels)
        continue;
      }
      // Normalise le slug à partir du nom de fichier si absent
      if (!data.slug) data.slug = file.replace('.json', '');
      docs.push(data);
    } catch (e) {
      console.warn(`  ⚠ Fichier invalide ignoré : ${file}`);
    }
  }

  if (docs.length) {
    await col.insertMany(docs, { ordered: false });
  }

  // Création des index
  console.log('🔧 Création des index…');
  await col.createIndex({ categorie: 1 });
  await col.createIndex({ rarete: 1 });
  await col.createIndex({ harmonisation: 1 });
  await col.createIndex({ nom: 1 });
  await col.createIndex({ slug: 1 }, { unique: true });
  await col.createIndex({ source: 1 });
  await col.createIndex({ mj_id: 1 });

  // Rapport par catégorie
  const stats = await col.aggregate([
    { $group: { _id: '$categorie', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const total = await col.countDocuments();
  console.log(`\n✅ ${total} objets importés\n`);
  console.log('📊 Répartition par catégorie :');
  for (const s of stats) {
    console.log(`   ${(s._id || 'inconnu').padEnd(25)} : ${s.count}`);
  }

  await client.close();
}

main().catch(e => { console.error('❌ Erreur :', e.message); process.exit(1); });
