/* =============================================================
   API /Notifications
   ============================================================= */
const express = require('express');
const router  = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

function getUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
    return payload.sub || null;
  } catch { return null; }
}

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// ─── GET / — liste des notifications ─────────────────────────
// params: user_id, lu (bool), limit
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { lu, limit = 20 } = req.query;
  const filter = { user_id: userId };
  if (lu !== undefined) filter.lu = lu === 'true';

  try {
    const notifs = await withDb(db =>
      db.collection('notifications')
        .find(filter)
        .sort({ date: -1 })
        .limit(parseInt(limit) || 20)
        .toArray()
    );
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST / — créer une notification ─────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { user_id, session_id, type, titre, message, lien } = req.body;
  if (!user_id || !type || !titre) return res.status(400).json({ error: 'user_id, type, titre requis' });

  try {
    const notif = {
      user_id,
      session_id: session_id ? (() => { try { return new ObjectId(session_id); } catch { return session_id; } })() : null,
      type,
      titre,
      message: message || '',
      lu: false,
      date: new Date(),
      lien: lien || null
    };
    const r = await withDb(db => db.collection('notifications').insertOne(notif));
    res.json({ ok: true, _id: r.insertedId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT /:id/lu — marquer comme lu ──────────────────────────
router.put('/:id/lu', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  // id peut être 'lu-tout' — traité par la route PUT /lu-tout en dessous
  try {
    let oid;
    try { oid = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: 'ID invalide' }); }
    await withDb(db =>
      db.collection('notifications').updateOne(
        { _id: oid, user_id: userId },
        { $set: { lu: true } }
      )
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT /lu-tout — tout marquer lu ──────────────────────────
router.put('/lu-tout', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { user_id } = req.body;
  const target = user_id || userId;
  // Vérifier que l'appelant est le propriétaire
  if (target !== userId) return res.status(403).json({ error: 'Non autorisé' });

  try {
    await withDb(db =>
      db.collection('notifications').updateMany(
        { user_id: target, lu: false },
        { $set: { lu: true } }
      )
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE /vieilles — purger > 7 jours ─────────────────────
router.delete('/vieilles', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const r = await withDb(db =>
      db.collection('notifications').deleteMany({
        user_id: userId,
        date: { $lt: cutoff }
      })
    );
    res.json({ ok: true, supprimees: r.deletedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
