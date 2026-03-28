const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('competences');
    const competences = await col.find({}, { projection: { _id: 0 } }).toArray();
    res.status(200).json(competences);
  } catch (err) {
    console.error('Erreur GetCompetences2024:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
