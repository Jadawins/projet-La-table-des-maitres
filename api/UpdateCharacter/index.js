const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!id || !updates) {
    return res.status(400).json({ error: 'id et données requis' });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');

    const result = await db.collection('characters').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Personnage non trouvé' });
    }

    res.status(200).json({ message: 'Personnage mis à jour' });
  } catch (err) {
    console.error('Erreur UpdateCharacter:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
