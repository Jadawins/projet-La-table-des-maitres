require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const COMPETENCES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../Json/2024/Régles/competences.json'), 'utf8')
);

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('competences');
    await col.deleteMany({});
    await col.insertMany(COMPETENCES);
    console.log(`✓ ${COMPETENCES.length} compétences importées dans MongoDB`);
  } catch (err) {
    console.error('Erreur :', err.message);
  } finally {
    await client.close();
  }
}

run();
