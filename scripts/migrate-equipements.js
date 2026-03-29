// Migration : importe armes + armures + équipements aventurier dans collection 'equipements'
// Usage : node scripts/migrate-equipements.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const fs   = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '../Json/2024/Equipement');

function prixEnPo(prix) {
  if (!prix) return 0;
  const { quantite, monnaie } = prix;
  switch (monnaie) {
    case 'po': return quantite;
    case 'pa': return quantite / 10;
    case 'pc': return quantite / 100;
    case 'pp': return quantite * 10;
    default:   return quantite;
  }
}

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('equipements');
    await col.drop().catch(() => {}); // reset propre

    const armes     = JSON.parse(fs.readFileSync(path.join(BASE, 'armes.json'), 'utf8'));
    const armures   = JSON.parse(fs.readFileSync(path.join(BASE, 'armures.json'), 'utf8'));
    const aventurier = JSON.parse(fs.readFileSync(path.join(BASE, 'equipements_aventurier.json'), 'utf8'));
    const outils    = JSON.parse(fs.readFileSync(path.join(BASE, 'outils.json'), 'utf8'));

    const docs = [
      ...armes.map(i => ({ ...i, type: 'arme', prix_po: prixEnPo(i.prix) })),
      ...armures.map(i => ({ ...i, type: 'armure', prix_po: prixEnPo(i.prix) })),
      ...aventurier.map(i => ({ ...i, type: 'equipement', categorie: i.categorie || 'aventurier', prix_po: prixEnPo(i.prix) })),
      ...outils.map(i => ({ ...i, type: 'outil', categorie: i.categorie || 'outil', prix_po: prixEnPo(i.prix) })),
    ];

    await col.insertMany(docs);
    await col.createIndex({ nom: 1 });
    await col.createIndex({ type: 1 });
    await col.createIndex({ categorie: 1 });

    console.log(`✓ ${docs.length} items insérés (${armes.length} armes, ${armures.length} armures, ${aventurier.length} équipements, ${outils.length} outils)`);
  } catch (err) {
    console.error('Erreur :', err.message);
  } finally {
    await client.close();
  }
}

run();
