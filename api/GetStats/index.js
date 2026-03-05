const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');
    const data = await db.collection('caracteristiques').find().toArray();
    const stats = data.map(c => ({
      index: c.index,
      name: c.name?.full_name || c.index
    }));
    res.status(200).json(stats);
  } catch (err) {
    console.error('Erreur GetStats:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
