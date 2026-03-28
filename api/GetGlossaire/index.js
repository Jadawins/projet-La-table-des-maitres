const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('glossaire');
    const query = {};
    const { categorie, recherche } = req.query;

    if (categorie) query.categorie = { $regex: new RegExp(`^${categorie}$`, 'i') };
    if (recherche) {
      query.$or = [
        { nom: { $regex: recherche, $options: 'i' } },
        { description: { $regex: recherche, $options: 'i' } }
      ];
    }

    const entrees = await col.find(query, { projection: { _id: 0, _source: 0 } }).toArray();
    res.status(200).json(entrees);
  } catch (err) {
    console.error('Erreur GetGlossaire:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
