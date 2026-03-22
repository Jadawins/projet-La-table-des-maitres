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

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  try {
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === verifyHash;
  } catch {
    return false;
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

// ─── GET /Sessions — liste des sessions ───────────────────────
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { statut, recherche } = req.query;
  try {
    await withDb(async (db) => {
      const query = {};
      if (statut && statut !== 'toutes') query.statut = statut;
      if (recherche) query.nom = { $regex: recherche, $options: 'i' };

      const sessions = await db.collection('sessions')
        .find(query, { projection: { mot_de_passe: 0 } })
        .sort({ date_derniere_activite: -1 })
        .toArray();

      // Ajouter flag: est-ce que l'utilisateur est MJ ou joueur
      const enriched = sessions.map(s => ({
        ...s,
        est_mj: s.mj_id === userId,
        est_joueur: (s.joueurs || []).some(j => j.user_id === userId),
        nb_joueurs: (s.joueurs || []).length,
        est_privee: !!s.mot_de_passe
      }));

      // Trier : mes sessions en premier
      enriched.sort((a, b) => {
        const aIn = a.est_mj || a.est_joueur ? 0 : 1;
        const bIn = b.est_mj || b.est_joueur ? 0 : 1;
        return aIn - bIn;
      });

      res.status(200).json(enriched);
    });
  } catch (err) {
    console.error('Erreur GET /Sessions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /Sessions/:id — détail d'une session ─────────────────
router.get('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne(
        { _id: new ObjectId(req.params.id) },
        { projection: { mot_de_passe: 0 } }
      );
      if (!session) return res.status(404).json({ error: 'Session introuvable' });

      res.status(200).json({
        ...session,
        est_mj: session.mj_id === userId,
        est_joueur: (session.joueurs || []).some(j => j.user_id === userId),
        nb_joueurs: (session.joueurs || []).length,
        est_privee: !!session.mot_de_passe
      });
    });
  } catch (err) {
    console.error('Erreur GET /Sessions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Sessions — créer une session ───────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { nom, description, visibilite, mot_de_passe, statut, systeme, mj_pseudo } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis' });

  const now = new Date();
  const session = {
    nom,
    description: description || '',
    mj_id: userId,
    mj_pseudo: mj_pseudo || 'MJ',
    visibilite: visibilite === 'privee' ? 'privee' : 'publique',
    mot_de_passe: (visibilite === 'privee' && mot_de_passe) ? hashPassword(mot_de_passe) : null,
    statut: statut || 'recrutement',
    joueurs: [],
    date_creation: now,
    date_derniere_activite: now,
    systeme: systeme || 'D&D 2024',
    image: null
  };

  try {
    await withDb(async (db) => {
      const result = await db.collection('sessions').insertOne(session);
      res.status(201).json({ _id: result.insertedId, ...session, mot_de_passe: undefined });
    });
  } catch (err) {
    console.error('Erreur POST /Sessions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Sessions/:id/rejoindre — rejoindre une session ─────
router.post('/:id/rejoindre', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { mot_de_passe, pseudo } = req.body;

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });

      if (session.mj_id === userId) return res.status(400).json({ error: 'Vous êtes le MJ de cette session' });
      if ((session.joueurs || []).some(j => j.user_id === userId)) {
        return res.status(400).json({ error: 'Vous êtes déjà dans cette session' });
      }

      if (session.mot_de_passe) {
        if (!mot_de_passe) return res.status(403).json({ error: 'Mot de passe requis' });
        if (!verifyPassword(mot_de_passe, session.mot_de_passe)) {
          return res.status(403).json({ error: 'Mot de passe incorrect' });
        }
      }

      const now = new Date();
      await db.collection('sessions').updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $push: { joueurs: { user_id: userId, pseudo: pseudo || 'Joueur', personnage_id: null, personnage_nom: null, date_rejointe: now } },
          $set: { date_derniere_activite: now }
        }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur POST /Sessions/:id/rejoindre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /Sessions/:id/quitter — quitter une session ───────
router.delete('/:id/quitter', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id === userId) return res.status(400).json({ error: 'Le MJ ne peut pas quitter sa propre session' });

      await db.collection('sessions').updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $pull: { joueurs: { user_id: userId } },
          $set: { date_derniere_activite: new Date() }
        }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur DELETE /Sessions/:id/quitter:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /Sessions/:id — modifier une session ─────────────────
router.put('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id !== userId) return res.status(403).json({ error: 'Seul le MJ peut modifier la session' });

      const { nom, description, visibilite, mot_de_passe, statut, systeme } = req.body;
      const update = { date_derniere_activite: new Date() };
      if (nom) update.nom = nom;
      if (description !== undefined) update.description = description;
      if (visibilite) update.visibilite = visibilite;
      if (statut) update.statut = statut;
      if (systeme) update.systeme = systeme;
      if (visibilite === 'privee' && mot_de_passe) {
        update.mot_de_passe = hashPassword(mot_de_passe);
      } else if (visibilite === 'publique') {
        update.mot_de_passe = null;
      }

      await db.collection('sessions').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur PUT /Sessions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /Sessions/:id — supprimer une session ─────────────
router.delete('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id !== userId) return res.status(403).json({ error: 'Seul le MJ peut supprimer la session' });

      await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur DELETE /Sessions/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Sessions/:id/personnage — associer un personnage ───
router.post('/:id/personnage', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { personnage_id, personnage_nom } = req.body;

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });

      const joueurIndex = (session.joueurs || []).findIndex(j => j.user_id === userId);
      if (joueurIndex === -1) return res.status(403).json({ error: 'Vous n\'êtes pas dans cette session' });

      await db.collection('sessions').updateOne(
        { _id: new ObjectId(req.params.id), 'joueurs.user_id': userId },
        {
          $set: {
            'joueurs.$.personnage_id': personnage_id ? new ObjectId(personnage_id) : null,
            'joueurs.$.personnage_nom': personnage_nom || null,
            date_derniere_activite: new Date()
          }
        }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur POST /Sessions/:id/personnage:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Sessions/:id/expulser — MJ expulse un joueur ───────
router.post('/:id/expulser', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { joueur_id } = req.body;
  if (!joueur_id) return res.status(400).json({ error: 'joueur_id requis' });

  try {
    await withDb(async (db) => {
      const session = await db.collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id !== userId) return res.status(403).json({ error: 'Seul le MJ peut expulser un joueur' });

      await db.collection('sessions').updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $pull: { joueurs: { user_id: joueur_id } },
          $set: { date_derniere_activite: new Date() }
        }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur POST /Sessions/:id/expulser:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
