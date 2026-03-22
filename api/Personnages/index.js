const express = require('express');
const router = express.Router();
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

// ─── GET / — liste des personnages ────────────────────────────
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const personnages = await withDb(db =>
      db.collection('personnages').find({ user_id: userId })
        .sort({ derniere_modification: -1 })
        .project({ notes: 0, historique_perso: 0 })
        .toArray()
    );
    res.json(personnages);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST / — créer un personnage ─────────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const body = req.body;
  if (!body.nom) return res.status(400).json({ error: 'Nom requis' });
  const now = new Date();
  const personnage = {
    user_id: userId,
    nom: body.nom,
    niveau: body.niveau || 1,
    experience: body.experience || 0,
    espece: body.espece || '',
    classe: body.classe || '',
    sous_classe: body.sous_classe || null,
    background: body.background || '',
    alignement: body.alignement || null,
    caracteristiques: body.caracteristiques || {
      FOR: { valeur: 10, modificateur: 0 },
      DEX: { valeur: 10, modificateur: 0 },
      CON: { valeur: 10, modificateur: 0 },
      INT: { valeur: 10, modificateur: 0 },
      SAG: { valeur: 10, modificateur: 0 },
      CHA: { valeur: 10, modificateur: 0 }
    },
    bonus_maitrise: body.bonus_maitrise || 2,
    inspiration: false,
    combat: body.combat || {
      pv_max: 10, pv_actuels: 10, pv_temporaires: 0,
      ca: 10, initiative: 0, vitesse: 9,
      des_vie: { total: 1, restants: 1, type: 'd8' }
    },
    jets_sauvegarde: body.jets_sauvegarde || {},
    competences: body.competences || [],
    attaques: body.attaques || [],
    sorts: body.sorts || {
      caracteristique_incantation: null, dd_sorts: null,
      bonus_attaque_sort: null, emplacements: [], sorts_connus: []
    },
    equipement: body.equipement || [],
    monnaie: body.monnaie || { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 },
    traits: body.traits || { traits_personnalite: [], ideaux: [], liens: [], defauts: [] },
    aptitudes: body.aptitudes || [],
    langues: body.langues || [],
    maitrise_armes: body.maitrise_armes || [],
    maitrise_armures: body.maitrise_armures || [],
    maitrise_outils: body.maitrise_outils || [],
    notes: body.notes || '',
    apparence: body.apparence || '',
    historique_perso: body.historique_perso || '',
    date_creation: now,
    derniere_modification: now
  };
  try {
    const result = await withDb(db => db.collection('personnages').insertOne(personnage));
    res.json({ _id: result.insertedId, ...personnage });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /:id — détail complet ────────────────────────────────
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const p = await withDb(db =>
      db.collection('personnages').findOne({ _id: new ObjectId(req.params.id), user_id: userId })
    );
    if (!p) return res.status(404).json({ error: 'Introuvable' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PUT /:id — modifier ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const allowed = ['nom','niveau','experience','espece','classe','sous_classe','background',
    'alignement','caracteristiques','bonus_maitrise','inspiration','combat','jets_sauvegarde',
    'competences','attaques','sorts','equipement','monnaie','traits','aptitudes','langues',
    'maitrise_armes','maitrise_armures','maitrise_outils','notes','apparence','historique_perso'];
  const update = { derniere_modification: new Date() };
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  try {
    const result = await withDb(db =>
      db.collection('personnages').updateOne(
        { _id: new ObjectId(req.params.id), user_id: userId },
        { $set: update }
      )
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── DELETE /:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const result = await withDb(db =>
      db.collection('personnages').deleteOne({ _id: new ObjectId(req.params.id), user_id: userId })
    );
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
