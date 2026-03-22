const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

// ─── AUTH ─────────────────────────────────────────────────────
function getUserId(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(auth.slice(7).split('.')[1], 'base64url').toString());
    return payload.sub || null;
  } catch { return null; }
}

function uid() { return crypto.randomBytes(8).toString('hex'); }

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// ─── GET /Combats/:session_id — combat actif d'une session ────
router.get('/:session_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let sessionId;
      try { sessionId = new ObjectId(req.params.session_id); }
      catch { return res.status(400).json({ error: 'session_id invalide' }); }

      const combat = await db.collection('combats').findOne(
        { session_id: sessionId, statut: 'actif' },
        { sort: { date_creation: -1 } }
      );

      if (!combat) return res.status(404).json({ error: 'Aucun combat actif' });

      // Filtrer les participants selon le rôle
      const isMj = combat.mj_id === userId;
      const filteredParticipants = isMj
        ? combat.participants
        : combat.participants.filter(p => p.visible_joueurs || p.user_id === userId);

      // Filtrer messages selon destinataire
      const filteredMessages = (combat.messages || []).filter(m =>
        m.destinataire === 'tous' ||
        m.destinataire === userId ||
        m.expediteur_id === userId ||
        isMj
      );

      res.status(200).json({
        ...combat,
        participants: filteredParticipants,
        messages: filteredMessages,
        est_mj: isMj,
        notes_mj: isMj ? combat.notes_mj : undefined
      });
    });
  } catch (err) {
    console.error('Erreur GET /Combats/:session_id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats — créer un combat ──────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id requis' });

  try {
    await withDb(async (db) => {
      // Vérifier que l'utilisateur est MJ de la session
      let sessionOid;
      try { sessionOid = new ObjectId(session_id); }
      catch { return res.status(400).json({ error: 'session_id invalide' }); }

      const session = await db.collection('sessions').findOne({ _id: sessionOid });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id !== userId) return res.status(403).json({ error: 'Seul le MJ peut créer un combat' });

      // Archiver les combats actifs précédents
      await db.collection('combats').updateMany(
        { session_id: sessionOid, statut: 'actif' },
        { $set: { statut: 'termine' } }
      );

      const now = new Date();

      // Pré-remplir avec les joueurs de la session
      const participants = (session.joueurs || []).map(j => ({
        id: uid(),
        nom: j.personnage_nom || j.pseudo,
        type: 'joueur',
        user_id: j.user_id,
        initiative: 0,
        pv_max: 10,
        pv_actuels: 10,
        ca: 10,
        conditions: [],
        notes: '',
        visible_joueurs: true
      }));

      const combat = {
        session_id: sessionOid,
        mj_id: userId,
        statut: 'actif',
        round: 1,
        tour_actuel: 0,
        participants,
        messages: [{
          id: uid(),
          expediteur_id: userId,
          expediteur_nom: 'Système',
          destinataire: 'tous',
          contenu: 'Le combat commence ! Bonne chance à tous.',
          type: 'systeme',
          timestamp: now
        }],
        notes_mj: '',
        date_creation: now,
        derniere_activite: now
      };

      const result = await db.collection('combats').insertOne(combat);
      res.status(201).json({ _id: result.insertedId, ...combat });
    });
  } catch (err) {
    console.error('Erreur POST /Combats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /Combats/:id — mettre à jour le combat ───────────────
router.put('/:id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });
      if (combat.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      const allowed = ['participants', 'round', 'tour_actuel', 'statut', 'notes_mj', 'derniere_activite'];
      const update = { derniere_activite: new Date() };
      for (const key of allowed) {
        if (req.body[key] !== undefined) update[key] = req.body[key];
      }

      await db.collection('combats').updateOne({ _id: oid }, { $set: update });
      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur PUT /Combats/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/participant — ajouter un participant ───
router.post('/:id/participant', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });
      if (combat.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      const { nom, type, initiative, pv_max, ca, notes, visible_joueurs } = req.body;
      const participant = {
        id: uid(),
        nom: nom || 'Inconnu',
        type: type || 'monstre',
        user_id: null,
        initiative: parseInt(initiative) || 0,
        pv_max: parseInt(pv_max) || 10,
        pv_actuels: parseInt(pv_max) || 10,
        ca: parseInt(ca) || 10,
        conditions: [],
        notes: notes || '',
        visible_joueurs: visible_joueurs !== false
      };

      await db.collection('combats').updateOne(
        { _id: oid },
        { $push: { participants: participant }, $set: { derniere_activite: new Date() } }
      );

      res.status(201).json({ success: true, participant });
    });
  } catch (err) {
    console.error('Erreur POST /Combats/:id/participant:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /Combats/:id/participant/:pid — supprimer ─────────
router.delete('/:id/participant/:pid', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });
      if (combat.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      await db.collection('combats').updateOne(
        { _id: oid },
        { $pull: { participants: { id: req.params.pid } }, $set: { derniere_activite: new Date() } }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    console.error('Erreur DELETE /Combats/:id/participant/:pid:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/message — envoyer un message ──────────
router.post('/:id/message', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const { contenu, destinataire, type, expediteur_nom } = req.body;
      if (!contenu?.trim()) return res.status(400).json({ error: 'Contenu vide' });

      const isMj = combat.mj_id === userId;
      const message = {
        id: uid(),
        expediteur_id: userId,
        expediteur_nom: expediteur_nom || (isMj ? 'MJ' : 'Joueur'),
        destinataire: destinataire || 'tous',
        contenu: contenu.trim(),
        type: type || (destinataire && destinataire !== 'tous' ? 'secret' : 'normal'),
        timestamp: new Date()
      };

      await db.collection('combats').updateOne(
        { _id: oid },
        { $push: { messages: message }, $set: { derniere_activite: new Date() } }
      );

      res.status(201).json({ success: true, message });
    });
  } catch (err) {
    console.error('Erreur POST /Combats/:id/message:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /Combats/:id/messages — récupérer les messages ───────
router.get('/:id/messages', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid }, { projection: { messages: 1, mj_id: 1 } });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const isMj = combat.mj_id === userId;
      const messages = (combat.messages || []).filter(m =>
        m.destinataire === 'tous' ||
        m.destinataire === userId ||
        m.expediteur_id === userId ||
        isMj
      );

      // Retourner seulement les 50 derniers
      res.status(200).json(messages.slice(-50));
    });
  } catch (err) {
    console.error('Erreur GET /Combats/:id/messages:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /Combats/:id/tour — passer au tour suivant ──────────
router.put('/:id/tour', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });
      if (combat.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      const nbParticipants = (combat.participants || []).length;
      if (!nbParticipants) return res.status(400).json({ error: 'Aucun participant' });

      let tourSuivant = (combat.tour_actuel + 1) % nbParticipants;
      let roundSuivant = combat.round;
      if (tourSuivant === 0) roundSuivant++;

      const participant = combat.participants[tourSuivant];
      const msgSystem = {
        id: uid(),
        expediteur_id: userId,
        expediteur_nom: 'Système',
        destinataire: 'tous',
        contenu: `Round ${roundSuivant} — Tour de ${participant?.nom || '?'}`,
        type: 'systeme',
        timestamp: new Date()
      };

      await db.collection('combats').updateOne(
        { _id: oid },
        {
          $set: { tour_actuel: tourSuivant, round: roundSuivant, derniere_activite: new Date() },
          $push: { messages: msgSystem }
        }
      );

      res.status(200).json({ success: true, round: roundSuivant, tour_actuel: tourSuivant });
    });
  } catch (err) {
    console.error('Erreur PUT /Combats/:id/tour:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
