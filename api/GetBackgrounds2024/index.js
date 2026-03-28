const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('backgrounds');
    const query = {};
    const { recherche } = req.query;

    if (recherche) {
      query.$or = [
        { nom: { $regex: recherche, $options: 'i' } },
        { description: { $regex: recherche, $options: 'i' } }
      ];
    }

    const backgrounds = await col.find(query, { projection: { _id: 0, _source: 0 } }).toArray();
    res.status(200).json(backgrounds);
  } catch (err) {
    console.error('Erreur GetBackgrounds2024:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
