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

// ─── GET /Combats/:id/journal — log chronologique ─────────────
router.get('/:id/journal', async (req, res) => {
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
      const journal = (combat.messages || []).filter(m =>
        m.type === 'systeme' || m.type === 'combat' ||
        m.destinataire === 'tous' || m.destinataire === userId || m.expediteur_id === userId || isMj
      );
      res.status(200).json(journal.slice(-100));
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/attaque ────────────────────────────────
router.post('/:id/attaque', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { attaquant_id, cible_id, d20, degats, type_degats, arme_id } = req.body;
  if (!attaquant_id || !cible_id || d20 === undefined) {
    return res.status(400).json({ error: 'attaquant_id, cible_id et d20 requis' });
  }

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const attaquant = combat.participants.find(p => p.id === attaquant_id);
      const cible    = combat.participants.find(p => p.id === cible_id);
      if (!attaquant || !cible) return res.status(404).json({ error: 'Participant introuvable' });

      const d20n = parseInt(d20);
      const caC  = cible.ca || 10;

      // Coup critique / raté auto
      let touche = false;
      let critique = false;
      if (d20n === 1)  { touche = false; }
      else if (d20n === 20) { touche = true; critique = true; }
      else { touche = (d20n >= caC); }

      let degatsAppliques = 0;
      let logMsg = '';
      const now = new Date();

      if (!touche) {
        logMsg = `⚔️ ${attaquant.nom} attaque ${cible.nom} — d20 = ${d20n}${d20n===1?' (Raté automatique!)':` vs CA ${caC} — Raté !`}`;
      } else {
        let dmg = parseInt(degats) || 0;

        // Vérifier résistances/immunités
        const resistances = cible.resistances || [];
        const immunites    = cible.immunites   || [];
        const typeLower    = (type_degats || '').toLowerCase();

        if (immunites.includes(typeLower)) {
          dmg = 0;
          logMsg = `⚔️ ${attaquant.nom} attaque ${cible.nom}${critique?' (CRITIQUE!)':''} — Immunité ${type_degats} — 0 dégâts !`;
        } else if (resistances.includes(typeLower)) {
          dmg = Math.floor(dmg / 2);
          logMsg = `⚔️ ${attaquant.nom} attaque ${cible.nom}${critique?' (CRITIQUE!)':''} — Résistance ${type_degats} — ${dmg} dégâts (÷2)`;
        } else {
          logMsg = `⚔️ ${attaquant.nom} attaque ${cible.nom}${critique?' (CRITIQUE!)':''} — d20+bonus = ${d20n} vs CA ${caC} — ${dmg} dégâts ${type_degats||''}`;
        }

        degatsAppliques = dmg;
        const avantPV = cible.pv_actuels;
        cible.pv_actuels = Math.max(0, cible.pv_actuels - dmg);

        if (avantPV > 0 && cible.pv_actuels === 0) {
          logMsg += ` — 💀 ${cible.nom} tombe à 0 PV !`;
        } else {
          logMsg += ` — PV : ${cible.pv_actuels}/${cible.pv_max}`;
        }

        // Vérifier concentration si cible concentrée
        let alerteConc = null;
        if ((cible.conditions || []).includes('concentre') && dmg > 0) {
          const dd = Math.max(10, Math.floor(dmg / 2));
          alerteConc = `⚠️ ${cible.nom} doit réussir un JS CON DD ${dd} pour maintenir sa Concentration`;
        }
        if (alerteConc) logMsg += ' | ' + alerteConc;
      }

      const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };

      const participants = combat.participants.map(p => p.id === cible_id ? cible : p);
      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { participants, derniere_activite: now }, $push: { messages: msgCombat } }
      );

      res.status(200).json({ touche, critique, degats_appliques: degatsAppliques, pv_restants: cible.pv_actuels, log: logMsg });
    });
  } catch (err) {
    console.error('[Combats/attaque]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/soin ───────────────────────────────────
router.post('/:id/soin', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { cible_id, pv, soignant_nom } = req.body;
  if (!cible_id || pv === undefined) return res.status(400).json({ error: 'cible_id et pv requis' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const cible = combat.participants.find(p => p.id === cible_id);
      if (!cible) return res.status(404).json({ error: 'Participant introuvable' });

      const pvSoin = Math.max(0, parseInt(pv) || 0);
      const avant = cible.pv_actuels;
      cible.pv_actuels = Math.min(cible.pv_max, cible.pv_actuels + pvSoin);
      const gain = cible.pv_actuels - avant;

      const soignant = soignant_nom || 'Quelqu\'un';
      const logMsg = `💚 ${soignant} soigne ${cible.nom} — +${gain} PV — PV : ${cible.pv_actuels}/${cible.pv_max}`;
      const now = new Date();
      const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };

      const participants = combat.participants.map(p => p.id === cible_id ? cible : p);
      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { participants, derniere_activite: now }, $push: { messages: msgCombat } }
      );

      res.status(200).json({ pv_restants: cible.pv_actuels, gain, log: logMsg });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/sauvegarde ────────────────────────────
router.post('/:id/sauvegarde', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { participant_id, caracteristique, d20, modificateur, maitrise, dd } = req.body;
  if (!participant_id || !caracteristique || d20 === undefined) {
    return res.status(400).json({ error: 'participant_id, caracteristique et d20 requis' });
  }

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const participant = combat.participants.find(p => p.id === participant_id);
      if (!participant) return res.status(404).json({ error: 'Participant introuvable' });

      const d20n  = parseInt(d20);
      const modif = parseInt(modificateur) || 0;
      const total = d20n + modif;
      const seuil = parseInt(dd) || 10;
      const reussi = total >= seuil;

      let logMsg = `🎲 ${participant.nom} — JS ${caracteristique} : d20(${d20n}) + ${modif >= 0 ? '+' : ''}${modif} = ${total} vs DD ${seuil} — ${reussi ? '✅ Réussi !' : '❌ Raté !'}`;

      // Concentration brisée si CON et raté
      let concBrise = false;
      if (caracteristique.toUpperCase() === 'CON' && !reussi && (participant.conditions || []).includes('concentre')) {
        concBrise = true;
        logMsg += ` 💨 Concentration brisée !`;

        // Retirer la condition
        participant.conditions = participant.conditions.filter(c => c !== 'concentre');
        const participants = combat.participants.map(p => p.id === participant_id ? participant : p);
        const now = new Date();
        const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };
        await db.collection('combats').updateOne(
          { _id: oid },
          { $set: { participants, derniere_activite: now }, $push: { messages: msgCombat } }
        );
        return res.status(200).json({ reussi, total, concentration_brisee: concBrise, log: logMsg });
      }

      const now = new Date();
      const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };
      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { derniere_activite: now }, $push: { messages: msgCombat } }
      );

      res.status(200).json({ reussi, total, concentration_brisee: concBrise, log: logMsg });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /Combats/:id/participant/:pid/conditions ─────────────
router.put('/:id/participant/:pid/conditions', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { conditions } = req.body;
  if (!Array.isArray(conditions)) return res.status(400).json({ error: 'conditions doit être un tableau' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const pid = req.params.pid;
      const participants = combat.participants.map(p =>
        p.id === pid ? { ...p, conditions } : p
      );

      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { participants, derniere_activite: new Date() } }
      );

      res.status(200).json({ success: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/mort ───────────────────────────────────
router.post('/:id/mort', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { participant_id, resultat } = req.body; // 'succes'|'echec'|'nat20'|'nat1'
  if (!participant_id || !resultat) return res.status(400).json({ error: 'participant_id et resultat requis' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const participant = combat.participants.find(p => p.id === participant_id);
      if (!participant) return res.status(404).json({ error: 'Participant introuvable' });

      if (!participant.jets_mort) participant.jets_mort = { succes: 0, echecs: 0 };

      let logMsg = '';
      let stabilise = false;
      let mort = false;

      if (resultat === 'nat20') {
        participant.pv_actuels = 1;
        participant.jets_mort = { succes: 0, echecs: 0 };
        logMsg = `✨ ${participant.nom} — 20 naturel ! Revient à 1 PV !`;
        stabilise = true;
      } else if (resultat === 'nat1') {
        participant.jets_mort.echecs = Math.min(3, participant.jets_mort.echecs + 2);
        logMsg = `💀 ${participant.nom} — 1 naturel ! 2 cases échec cochées (${participant.jets_mort.echecs}/3)`;
      } else if (resultat === 'succes') {
        participant.jets_mort.succes = Math.min(3, participant.jets_mort.succes + 1);
        if (participant.jets_mort.succes >= 3) {
          logMsg = `✅ ${participant.nom} — Stabilisé ! (3 succès)`;
          stabilise = true;
        } else {
          logMsg = `🎲 ${participant.nom} — JS mort : Succès (${participant.jets_mort.succes}/3)`;
        }
      } else if (resultat === 'echec') {
        participant.jets_mort.echecs = Math.min(3, participant.jets_mort.echecs + 1);
        if (participant.jets_mort.echecs >= 3) {
          logMsg = `💀 ${participant.nom} — Mort... (3 échecs)`;
          mort = true;
        } else {
          logMsg = `🎲 ${participant.nom} — JS mort : Échec (${participant.jets_mort.echecs}/3)`;
        }
      }

      const participants = combat.participants.map(p => p.id === participant_id ? participant : p);
      const now = new Date();
      const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };

      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { participants, derniere_activite: now }, $push: { messages: msgCombat } }
      );

      res.status(200).json({ succes: participant.jets_mort.succes, echecs: participant.jets_mort.echecs, stabilise, mort, pv_actuels: participant.pv_actuels, log: logMsg });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Combats/:id/sort ───────────────────────────────────
router.post('/:id/sort', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { lanceur_id, sort_nom, sort_niveau, cible_id, d20, degats, type_degats, concentration } = req.body;
  if (!lanceur_id || !sort_nom) return res.status(400).json({ error: 'lanceur_id et sort_nom requis' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const combat = await db.collection('combats').findOne({ _id: oid });
      if (!combat) return res.status(404).json({ error: 'Combat introuvable' });

      const lanceur = combat.participants.find(p => p.id === lanceur_id);
      const cible   = cible_id ? combat.participants.find(p => p.id === cible_id) : null;

      let logMsg = `🔮 ${lanceur?.nom || '?'} lance ${sort_nom}${sort_niveau ? ` (niv. ${sort_niveau})` : ''}`;
      const now = new Date();
      let participants = [...combat.participants];

      if (cible) {
        if (d20 !== undefined) {
          const d20n = parseInt(d20);
          logMsg += ` sur ${cible.nom} — d20 = ${d20n}`;
        }
        if (degats !== undefined && parseInt(degats) > 0) {
          const dmg = parseInt(degats);
          const typeLower = (type_degats || '').toLowerCase();
          const resistances = cible.resistances || [];
          const immunites   = cible.immunites   || [];
          let dmgFinal = dmg;
          if (immunites.includes(typeLower)) { dmgFinal = 0; logMsg += ` — Immunité !`; }
          else if (resistances.includes(typeLower)) { dmgFinal = Math.floor(dmg / 2); logMsg += ` — Résistance (÷2)`; }
          cible.pv_actuels = Math.max(0, cible.pv_actuels - dmgFinal);
          logMsg += ` — 💥 ${dmgFinal} dégâts ${type_degats || ''} — PV ${cible.pv_actuels}/${cible.pv_max}`;
          participants = participants.map(p => p.id === cible_id ? cible : p);
        }
      }

      if (concentration) {
        // Retirer concentration précédente si elle existe
        participants = participants.map(p => {
          if (p.id === lanceur_id && (p.conditions || []).includes('concentre')) {
            return { ...p, sort_concentration: sort_nom };
          }
          if (p.id === lanceur_id) {
            return { ...p, conditions: [...(p.conditions || []).filter(c => c !== 'concentre'), 'concentre'], sort_concentration: sort_nom };
          }
          return p;
        });
        logMsg += ` 🟣 [Concentration]`;
      }

      const msgCombat = { id: uid(), expediteur_id: userId, expediteur_nom: 'Système', destinataire: 'tous', contenu: logMsg, type: 'combat', timestamp: now };

      await db.collection('combats').updateOne(
        { _id: oid },
        { $set: { participants, derniere_activite: now }, $push: { messages: msgCombat } }
      );

      res.status(200).json({ success: true, pv_cible: cible?.pv_actuels, log: logMsg });
    });
  } catch (err) {
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
