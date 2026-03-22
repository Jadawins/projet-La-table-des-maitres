const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

// ─── UTILITAIRES ──────────────────────────────────────────────

function getUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try {
    return await fn(client.db('myrpgtable'));
  } finally {
    await client.close();
  }
}

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

// ─── GET / — liste des campagnes du MJ ────────────────────────
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const campagnes = await withDb(db =>
      db.collection('campagnes')
        .find({ mj_id: userId })
        .sort({ derniere_modification: -1 })
        .project({ chapitres: 0 })
        .toArray()
    );
    res.json(campagnes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST / — créer une campagne ──────────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom, description, statut } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis' });
  const now = new Date();
  const campagne = {
    mj_id: userId,
    nom: nom.trim(),
    description: description || '',
    statut: statut || 'preparation',
    sessions: [],
    chapitres: [],
    date_creation: now,
    derniere_modification: now
  };
  try {
    const result = await withDb(db => db.collection('campagnes').insertOne(campagne));
    res.json({ _id: result.insertedId, ...campagne });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /:id — détail complet ────────────────────────────────
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const campagne = await withDb(db =>
      db.collection('campagnes').findOne({ _id: new ObjectId(req.params.id), mj_id: userId })
    );
    if (!campagne) return res.status(404).json({ error: 'Introuvable' });
    res.json(campagne);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /:id — modifier la campagne (auto-save) ──────────────
router.put('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom, description, statut } = req.body;
  const update = { derniere_modification: new Date() };
  if (nom !== undefined) update.nom = nom;
  if (description !== undefined) update.description = description;
  if (statut !== undefined) update.statut = statut;
  try {
    const result = await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: update }
      )
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id — supprimer une campagne ─────────────────────
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const result = await withDb(db =>
      db.collection('campagnes').deleteOne({ _id: new ObjectId(req.params.id), mj_id: userId })
    );
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /:id/chapitres — ajouter un chapitre ────────────────
router.post('/:id/chapitres', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { titre } = req.body;
  try {
    const campagne = await withDb(db =>
      db.collection('campagnes').findOne({ _id: new ObjectId(req.params.id), mj_id: userId }, { projection: { chapitres: 1 } })
    );
    if (!campagne) return res.status(404).json({ error: 'Introuvable' });
    const ordre = (campagne.chapitres || []).length + 1;
    const chapitre = {
      id: uid(),
      titre: titre || `Chapitre ${ordre}`,
      ordre,
      contenu_prive: '',
      contenu_public: '',
      rencontres: [],
      lieux: []
    };
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $push: { chapitres: chapitre }, $set: { derniere_modification: new Date() } }
      )
    );
    res.json(chapitre);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /:id/chapitres/:chapitre_id ──────────────────────────
router.put('/:id/chapitres/:chapitre_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { titre, contenu_prive, contenu_public, ordre } = req.body;
  const setFields = { derniere_modification: new Date() };
  if (titre !== undefined) setFields['chapitres.$[ch].titre'] = titre;
  if (contenu_prive !== undefined) setFields['chapitres.$[ch].contenu_prive'] = contenu_prive;
  if (contenu_public !== undefined) setFields['chapitres.$[ch].contenu_public'] = contenu_public;
  if (ordre !== undefined) setFields['chapitres.$[ch].ordre'] = ordre;
  try {
    const result = await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: setFields },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }] }
      )
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id/chapitres/:chapitre_id ───────────────────────
router.delete('/:id/chapitres/:chapitre_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const result = await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $pull: { chapitres: { id: req.params.chapitre_id } }, $set: { derniere_modification: new Date() } }
      )
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /:id/chapitres/:chapitre_id/rencontres ──────────────
router.post('/:id/chapitres/:chapitre_id/rencontres', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom, description, difficulte } = req.body;
  const rencontre = {
    id: uid(),
    nom: nom || 'Nouvelle rencontre',
    description: description || '',
    difficulte: difficulte || 'moyen',
    monstres: [],
    jets_competences: []
  };
  try {
    const result = await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId, 'chapitres.id': req.params.chapitre_id },
        { $push: { 'chapitres.$[ch].rencontres': rencontre }, $set: { derniere_modification: new Date() } },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }] }
      )
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Introuvable' });
    res.json(rencontre);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /:id/chapitres/:chapitre_id/rencontres/:rencontre_id ─
router.put('/:id/chapitres/:chapitre_id/rencontres/:rencontre_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom, description, difficulte, monstres, jets_competences } = req.body;
  const setFields = { derniere_modification: new Date() };
  if (nom !== undefined) setFields['chapitres.$[ch].rencontres.$[r].nom'] = nom;
  if (description !== undefined) setFields['chapitres.$[ch].rencontres.$[r].description'] = description;
  if (difficulte !== undefined) setFields['chapitres.$[ch].rencontres.$[r].difficulte'] = difficulte;
  if (monstres !== undefined) setFields['chapitres.$[ch].rencontres.$[r].monstres'] = monstres;
  if (jets_competences !== undefined) setFields['chapitres.$[ch].rencontres.$[r].jets_competences'] = jets_competences;
  try {
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: setFields },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }, { 'r.id': req.params.rencontre_id }] }
      )
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id/chapitres/:chapitre_id/rencontres/:rencontre_id
router.delete('/:id/chapitres/:chapitre_id/rencontres/:rencontre_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $pull: { 'chapitres.$[ch].rencontres': { id: req.params.rencontre_id } }, $set: { derniere_modification: new Date() } },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }] }
      )
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /:id/chapitres/:chapitre_id/rencontres/:rencontre_id/lancer
router.post('/:id/chapitres/:chapitre_id/rencontres/:rencontre_id/lancer', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id requis' });
  try {
    const result = await withDb(async db => {
      // Vérifier que la session appartient au MJ
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(session_id), mj_id: userId });
      if (!session) throw new Error('Session introuvable ou accès refusé');

      // Récupérer la rencontre
      const campagne = await db.collection('campagnes').findOne(
        { _id: new ObjectId(req.params.id), mj_id: userId }
      );
      if (!campagne) throw new Error('Campagne introuvable');
      const chapitre = campagne.chapitres.find(c => c.id === req.params.chapitre_id);
      if (!chapitre) throw new Error('Chapitre introuvable');
      const rencontre = chapitre.rencontres.find(r => r.id === req.params.rencontre_id);
      if (!rencontre) throw new Error('Rencontre introuvable');

      // Créer le combat avec les monstres pré-chargés
      const now = new Date();
      const participants = rencontre.monstres.map((m, idx) => ({
        id: uid(),
        nom: m.quantite > 1 ? `${m.nom} ${idx + 1}` : m.nom,
        type: 'monstre',
        initiative: 10,
        pv_max: m.pv_max,
        pv_actuels: m.pv_max,
        ca: m.ca,
        visible: false,
        conditions: [],
        attaques: m.attaques || [],
        initiative_bonus: m.initiative_bonus || 0
      }));

      // Aplatir les quantités > 1
      const participantsFlatted = [];
      rencontre.monstres.forEach(m => {
        for (let i = 0; i < (m.quantite || 1); i++) {
          participantsFlatted.push({
            id: uid(),
            nom: m.quantite > 1 ? `${m.nom} ${i + 1}` : m.nom,
            type: 'monstre',
            initiative: 10,
            pv_max: m.pv_max,
            pv_actuels: m.pv_max,
            ca: m.ca,
            visible: false,
            conditions: [],
            attaques: m.attaques || [],
            initiative_bonus: m.initiative_bonus || 0
          });
        }
      });

      const combat = {
        session_id: new ObjectId(session_id),
        actif: true,
        round: 1,
        tour_actuel: 0,
        participants: participantsFlatted,
        messages: [{
          id: uid(),
          auteur: 'Système',
          contenu: `⚔️ Rencontre lancée : ${rencontre.nom}`,
          date: now,
          secret: false,
          dest: 'tous'
        }],
        date_debut: now,
        rencontre_source: {
          campagne_id: req.params.id,
          chapitre_id: req.params.chapitre_id,
          rencontre_id: req.params.rencontre_id,
          nom: rencontre.nom
        }
      };

      // Désactiver les combats actifs précédents
      await db.collection('combats').updateMany(
        { session_id: new ObjectId(session_id), actif: true },
        { $set: { actif: false } }
      );
      const ins = await db.collection('combats').insertOne(combat);
      return { combat_id: ins.insertedId.toString(), session_id };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /:id/chapitres/:chapitre_id/lieux ───────────────────
router.post('/:id/chapitres/:chapitre_id/lieux', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom } = req.body;
  const lieu = {
    id: uid(),
    nom: nom || 'Nouveau lieu',
    description_privee: '',
    description_publique: '',
    pnj: []
  };
  try {
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $push: { 'chapitres.$[ch].lieux': lieu }, $set: { derniere_modification: new Date() } },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }] }
      )
    );
    res.json(lieu);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /:id/chapitres/:chapitre_id/lieux/:lieu_id ───────────
router.put('/:id/chapitres/:chapitre_id/lieux/:lieu_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nom, description_privee, description_publique, pnj } = req.body;
  const setFields = { derniere_modification: new Date() };
  if (nom !== undefined) setFields['chapitres.$[ch].lieux.$[l].nom'] = nom;
  if (description_privee !== undefined) setFields['chapitres.$[ch].lieux.$[l].description_privee'] = description_privee;
  if (description_publique !== undefined) setFields['chapitres.$[ch].lieux.$[l].description_publique'] = description_publique;
  if (pnj !== undefined) setFields['chapitres.$[ch].lieux.$[l].pnj'] = pnj;
  try {
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $set: setFields },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }, { 'l.id': req.params.lieu_id }] }
      )
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id/chapitres/:chapitre_id/lieux/:lieu_id ────────
router.delete('/:id/chapitres/:chapitre_id/lieux/:lieu_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    await withDb(db =>
      db.collection('campagnes').updateOne(
        { _id: new ObjectId(req.params.id), mj_id: userId },
        { $pull: { 'chapitres.$[ch].lieux': { id: req.params.lieu_id } }, $set: { derniere_modification: new Date() } },
        { arrayFilters: [{ 'ch.id': req.params.chapitre_id }] }
      )
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
