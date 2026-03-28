// Script de migration : ajoute bonus_caracteristiques aux backgrounds MongoDB
// Usage : node scripts/migrate-background-bonuses.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const BONUSES = {
  acolyte:   { suggerees: ['INT', 'SAG'] },
  artisan:   { suggerees: ['STR', 'INT'] },
  artiste:   { suggerees: ['DEX', 'CHA'] },
  charlatan: { suggerees: ['DEX', 'CHA'] },
  criminel:  { suggerees: ['DEX', 'INT'] },
  ermite:    { suggerees: ['CON', 'SAG'] },
  fermier:   { suggerees: ['STR', 'CON'] },
  garde:     { suggerees: ['STR', 'INT'] },
  guide:     { suggerees: ['DEX', 'SAG'] },
  marchand:  { suggerees: ['CON', 'CHA'] },
  marin:     { suggerees: ['STR', 'DEX'] },
  noble:     { suggerees: ['INT', 'CHA'] },
  sage:      { suggerees: ['INT', 'SAG'] },
  scribe:    { suggerees: ['DEX', 'INT'] },
  soldat:    { suggerees: ['STR', 'CON'] },
  voyageur:  { suggerees: ['DEX', 'SAG'] },
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
