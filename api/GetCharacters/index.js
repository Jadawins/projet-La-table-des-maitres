const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Paramètre userId requis' });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');
    const characters = await db.collection('characters').find({ userId }).toArray();
    res.status(200).json(characters);
  } catch (err) {
    console.error('Erreur GetCharacters:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
