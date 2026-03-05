const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.post('/', async (req, res) => {
  const { supabase_id, email, username, avatar_url, provider, discord_username } = req.body;

  if (!supabase_id) {
    return res.status(400).json({ error: 'supabase_id requis' });
  }

  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db('myrpgtable');
    const users = db.collection('users');

    const now = new Date();

    await users.updateOne(
      { supabase_id },
      {
        $set: {
          email,
          username,
          avatar_url: avatar_url || null,
          provider,
          discord_username: discord_username || null,
          last_login: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erreur SyncUser:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
