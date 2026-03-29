// Migration : ajoute les champs incantation aux sous-classes Chevalier occulte et Arnaqueur arcanique
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const UPDATES = [
  {
    _source: 'guerrier_chevalier_occulte',
    fields: {
      incantation: true,
      caracteristique_incantation: 'INT',
      type_lanceur: 'tiers',
      filtre_sorts_classe: 'magicien',
      ecoles_sorts_preferees: ['Abjuration', '\u00c9vocation']
    }
  },
  {
    _source: 'roublard_arnaqueur_arcanique',
    fields: {
      incantation: true,
      caracteristique_incantation: 'INT',
      type_lanceur: 'tiers',
      filtre_sorts_classe: 'magicien',
      ecoles_sorts_preferees: ['Enchantement', 'Illusion']
    }
  }
];

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('sous_classes');
    for (const { _source, fields } of UPDATES) {
      const result = await col.updateOne({ _source }, { $set: fields });
      if (result.modifiedCount > 0) console.log(`\u2713 ${_source} mis \u00e0 jour`);
      else console.log(`\u26a0 ${_source} non trouv\u00e9 ou d\u00e9j\u00e0 \u00e0 jour`);
    }
    console.log('Migration termin\u00e9e');
  } catch (err) {
    console.error('Erreur :', err.message);
  } finally {
    await client.close();
  }
}

run();
