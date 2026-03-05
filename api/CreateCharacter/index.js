const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.post('/', async (req, res) => {
  const { userId, character } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Le champ userId est requis.' });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');

    const newCharacter = {
      userId,
      ...character,
      created_at: new Date()
    };

    const result = await db.collection('characters').insertOne(newCharacter);
    res.status(201).json({ message: 'Personnage créé', characterId: result.insertedId });
  } catch (err) {
    console.error('Erreur CreateCharacter:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
