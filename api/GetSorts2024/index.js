const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('sorts');
    const query = {};
    const { niveau, ecole, classe, concentration, rituel, recherche } = req.query;

    if (niveau !== undefined && niveau !== '') query.niveau = parseInt(niveau);
    if (ecole) query.ecole = { $regex: new RegExp(`^${ecole}$`, 'i') };
    if (classe) query.classes = { $elemMatch: { $regex: new RegExp(`^${classe}$`, 'i') } };
    if (concentration !== undefined && concentration !== '') query.concentration = concentration === 'true';
    if (rituel !== undefined && rituel !== '') query.rituel = rituel === 'true';
    if (recherche) {
      query.$or = [
        { nom: { $regex: recherche, $options: 'i' } },
        { description: { $regex: recherche, $options: 'i' } }
      ];
    }

    const sorts = await col.find(query, { projection: { _id: 0, _source: 0 } }).toArray();
    res.status(200).json(sorts);
  } catch (err) {
    console.error('Erreur GetSorts2024:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
