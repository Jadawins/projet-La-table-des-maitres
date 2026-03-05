const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');
    const spells = await db.collection('2014_spells').find({}, { projection: { _id: 0 } }).toArray();
    res.status(200).json(spells);
  } catch (err) {
    console.error('Erreur GetSpells2014:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
