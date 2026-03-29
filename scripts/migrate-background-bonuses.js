// Script de migration : ajoute bonus_caracteristiques aux backgrounds MongoDB
// Usage : node scripts/migrate-background-bonuses.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

// PHB 2024 — 3 caractéristiques par background
const BONUSES = {
  acolyte:   { suggerees: ['INT', 'SAG', 'CHA'] },
  artisan:   { suggerees: ['STR', 'DEX', 'INT'] },
  artiste:   { suggerees: ['STR', 'DEX', 'CHA'] },
  charlatan: { suggerees: ['DEX', 'CON', 'CHA'] },
  criminel:  { suggerees: ['DEX', 'INT', 'CHA'] },
  ermite:    { suggerees: ['CON', 'INT', 'SAG'] },
  fermier:   { suggerees: ['STR', 'CON', 'SAG'] },
  garde:     { suggerees: ['STR', 'DEX', 'INT'] },
  guide:     { suggerees: ['STR', 'DEX', 'SAG'] },
  marchand:  { suggerees: ['CON', 'INT', 'CHA'] },
  marin:     { suggerees: ['STR', 'DEX', 'SAG'] },
  noble:     { suggerees: ['STR', 'INT', 'CHA'] },
  sage:      { suggerees: ['CON', 'INT', 'SAG'] },
  scribe:    { suggerees: ['DEX', 'INT', 'CHA'] },
  soldat:    { suggerees: ['STR', 'DEX', 'CON'] },
  voyageur:  { suggerees: ['DEX', 'INT', 'CHA'] },
};

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('backgrounds');
    let updated = 0;
    for (const [id, bonus] of Object.entries(BONUSES)) {
      const result = await col.updateOne(
        { id },
        { $set: { bonus_caracteristiques: bonus } }
      );
      if (result.modifiedCount > 0) {
        console.log(`✓ ${id} mis à jour`);
        updated++;
      } else {
        console.log(`⚠ ${id} non trouvé ou déjà à jour`);
      }
    }
    console.log(`\nMigration terminée : ${updated}/${Object.keys(BONUSES).length} backgrounds mis à jour`);
  } catch (err) {
    console.error('Erreur :', err.message);
  } finally {
    await client.close();
  }
}

run();
