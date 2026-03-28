const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('correspondances');
    const docs = await col.find({}, { projection: { _id: 0, _source: 0 } }).toArray();
    // Restitue la structure originale : objet unique ou tableau selon le nombre de docs
    res.status(200).json(docs.length === 1 ? docs[0] : docs);
  } catch (err) {
    console.error('Erreur GetCorrespondances:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
