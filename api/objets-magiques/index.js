const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const PER_PAGE = 24;

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

// ─── GET / — liste avec filtres + pagination ─────────────────
router.get('/', async (req, res) => {
  try {
    const { categorie, rarete, harmonisation, recherche, page = 1, homebrew_only } = req.query;
    const userId = getUserId(req);

    const filter = {};

    // Filtres visibilité
    if (homebrew_only === 'true') {
      if (!userId) return res.status(401).json({ error: 'Non authentifié' });
      filter.source = 'homebrew';
      filter.mj_id = userId;
    } else {
      const orClauses = [{ source: 'SRD' }];
      if (userId) orClauses.push({ mj_id: userId });
      filter.$or = orClauses;
    }

    if (categorie) filter.categorie = categorie;
    if (rarete)    filter.rarete = rarete;
    if (harmonisation !== undefined && harmonisation !== '') {
      filter.harmonisation = harmonisation === 'true';
    }
    if (recherche) {
      const q = recherche.trim();
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { nom: { $regex: q, $options: 'i' } },
          { nom_original: { $regex: q, $options: 'i' } }
        ]
      });
    }

    const result = await withDb(async db => {
      const col = db.collection('objets_magiques');
      // Si page est demandé → pagination serveur, sinon tout retourner
      if (page && page !== 'all') {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const skip = (pageNum - 1) * PER_PAGE;
        const [items, total] = await Promise.all([
          col.find(filter).sort({ nom: 1 }).skip(skip).limit(PER_PAGE).project({ description: 0 }).toArray(),
          col.countDocuments(filter)
        ]);
        return { items, total, page: pageNum, pages: Math.ceil(total / PER_PAGE) };
      } else {
        const items = await col.find(filter).sort({ nom: 1 }).project({ description: 0 }).toArray();
        return { items, total: items.length, page: 1, pages: 1 };
      }
    });

    res.json(result);
  } catch (e) {
    console.error('Erreur objets-magiques GET /', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /custom — créer un objet homebrew ──────────────────
router.post('/custom', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { nom, categorie, rarete, harmonisation, harmonisation_detail,
          description, effets, poids, prix_estime, image } = req.body;

  if (!nom) return res.status(400).json({ error: 'Le nom est obligatoire' });

  // Slug unique homebrew
  const slug = `homebrew-${userId.slice(0, 8)}-${Date.now()}`;

  const doc = {
    slug,
    nom,
    nom_original: nom,
    categorie: categorie || 'autre',
    rarete: rarete || 'peu_commun',
    harmonisation: !!harmonisation,
    harmonisation_detail: harmonisation_detail || null,
    description: description || '',
    effets: Array.isArray(effets) ? effets : [],
    poids: poids ? parseFloat(poids) : null,
    prix_estime: prix_estime ? parseFloat(prix_estime) : null,
    image: image || null,
    source: 'homebrew',
    mj_id: userId,
    partage_session: false,
    created_at: new Date()
  };

  try {
    const inserted = await withDb(db =>
      db.collection('objets_magiques').insertOne(doc)
    );
    res.status(201).json({ ...doc, _id: inserted.insertedId });
  } catch (e) {
    console.error('Erreur objets-magiques POST /custom:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /custom/:id/partager — partager aux joueurs ────────
router.post('/custom/:id/partager', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(db =>
      db.collection('objets_magiques').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: { partage_session: true } }
      )
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /custom/:id — supprimer un homebrew ──────────────
router.delete('/custom/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const result = await withDb(db =>
      db.collection('objets_magiques').deleteOne(
        { _id: new ObjectId(req.params.id), mj_id: userId, source: 'homebrew' }
      )
    );
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Introuvable ou accès refusé' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /:slug — fiche complète ─────────────────────────────
router.get('/:slug', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { slug } = req.params;

    const item = await withDb(db =>
      db.collection('objets_magiques').findOne({ slug })
    );

    if (!item) return res.status(404).json({ error: 'Objet introuvable' });

    // Vérif accès pour homebrew
    if (item.source === 'homebrew' && item.mj_id !== userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(item);
  } catch (e) {
    console.error('Erreur objets-magiques GET /:slug:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
