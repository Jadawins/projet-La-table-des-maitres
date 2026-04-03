const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;

function getUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
    return payload.sub || null;
  } catch { return null; }
}

async function withDb(fn) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// GET / — liste des monstres du MJ (+ recherche pour les modals)
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { q, type, taille, fp_min, fp_max } = req.query;

    const filter = { mj_id: userId };

    if (q) filter.nom = { $regex: q.trim(), $options: 'i' };
    if (type) filter.type = { $regex: type.trim(), $options: 'i' };
    if (taille) filter.taille = taille.trim();

    // FP filtering (convert fractions to numeric for comparison)
    const FP_NUM = { '0':0,'1/8':0.125,'1/4':0.25,'1/2':0.5 };
    function fpToNum(v) { return FP_NUM[v] !== undefined ? FP_NUM[v] : parseFloat(v) || 0; }

    const docs = await withDb(async db => {
      let results = await db.collection('monstres_custom').find(filter).sort({ nom: 1 }).toArray();
      if (fp_min !== undefined || fp_max !== undefined) {
        const min = fp_min !== undefined ? fpToNum(fp_min) : -Infinity;
        const max = fp_max !== undefined ? fpToNum(fp_max) : Infinity;
        results = results.filter(m => {
          const n = fpToNum(m.fp || '0');
          return n >= min && n <= max;
        });
      }
      return results;
    });

    res.json(docs);
  } catch (e) {
    console.error('MonstresCustom GET /', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /:id — détail d'un monstre
router.get('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const doc = await withDb(db =>
      db.collection('monstres_custom').findOne({ _id: new ObjectId(req.params.id), mj_id: userId })
    );
    if (!doc) return res.status(404).json({ error: 'Non trouvé' });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / — créer un monstre
router.post('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    if (!req.body.nom?.trim()) return res.status(400).json({ error: 'Nom requis' });

    const doc = { ...req.body, mj_id: userId, created_at: new Date() };
    const result = await withDb(db => db.collection('monstres_custom').insertOne(doc));
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id — modifier un monstre
router.put('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const update = { ...req.body, updated_at: new Date() };
    delete update._id;
    delete update.mj_id;

    const result = await withDb(db =>
      db.collection('monstres_custom').findOneAndUpdate(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: update },
        { returnDocument: 'after' }
      )
    );
    if (!result) return res.status(404).json({ error: 'Non trouvé' });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    await withDb(db =>
      db.collection('monstres_custom').deleteOne({ _id: new ObjectId(req.params.id), mj_id: userId })
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
