const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('sous_classes');
    const query = {};
    const { classe, recherche } = req.query;

    if (classe) query.classe_parente = { $regex: new RegExp(`^${classe}$`, 'i') };
    if (recherche) query.nom = { $regex: recherche, $options: 'i' };

    const docs = await col.find(query).toArray();
    const sousClasses = docs.map(({ _id, _source, ...rest }) => ({ id: _source, ...rest }));
    res.status(200).json(sousClasses);
  } catch (err) {
    console.error('Erreur GetSousClasses2024:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
