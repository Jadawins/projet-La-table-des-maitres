const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const { getUserId } = require('../auth');

function uid() { return crypto.randomBytes(8).toString('hex'); }

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// ─── Ressources de classe par niveau ──────────────────────────
function getRessourcesDefaut(classe, niveau) {
  const niv = parseInt(niveau) || 1;
  const configs = {
    barbare: [{ id:'rages', nom:'Rages', icone:'🔥', max: niv>=17?6:niv>=12?5:niv>=6?4:niv>=3?3:2, reset:'long' }],
    druide:  [{ id:'formes_sauvages', nom:'Formes sauvages', icone:'🐺', max:2, reset:'court' }],
    moine:   [{ id:'ki', nom:'Points de ki', icone:'✨', max:niv, reset:'court' }],
    paladin: [
      { id:'channel_divinite', nom:'Channel Divinité', icone:'⚜️', max:2, reset:'court' },
      { id:'imposition_mains', nom:'Imposition des mains (PV)', icone:'🤲', max:niv*5, reset:'long' }
    ],
    clerc:   [{ id:'channel_divinite', nom:'Channel Divinité', icone:'✝️', max:2, reset:'court' }],
    ensorceleur: [{ id:'sorcellerie', nom:'Points de sorcellerie', icone:'💜', max:niv, reset:'long' }],
    occultiste: [{ id:'pacte', nom:'Emplacements de Pacte', icone:'📜', max:niv>=9?4:niv>=5?3:niv>=3?2:1, reset:'court' }],
    guerrier: [
      { id:'second_souffle', nom:'Second Souffle', icone:'🛡️', max:1, reset:'court' },
      { id:'action_surge', nom:'Action Surge', icone:'⚡', max:niv>=17?2:1, reset:'court' }
    ],
    barde:   [{ id:'inspiration', nom:'Inspiration bardique', icone:'🎵', max:null, reset:'court' }],
    magicien:[{ id:'recuperation', nom:'Récupération arcanique', icone:'📚', max:Math.max(1,Math.ceil(niv/2)), reset:'court' }]
  };
  return configs[classe?.toLowerCase()] || [];
}

// ─── GET /Repos/actif/:session_id ─────────────────────────────
router.get('/actif/:session_id', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    await withDb(async (db) => {
      let sessionOid;
      try { sessionOid = new ObjectId(req.params.session_id); }
      catch { return res.status(400).json({ error: 'session_id invalide' }); }

      const repos = await db.collection('repos').findOne(
        { session_id: sessionOid, statut: 'en_attente' },
        { sort: { date_demande: -1 } }
      );
      if (!repos) return res.status(404).json({ error: 'Aucun vote en cours' });
      res.json(repos);
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /Repos — créer un sondage ───────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { session_id, type, demandeur_nom, mode_validation, timer_secondes } = req.body;
  if (!session_id || !type) return res.status(400).json({ error: 'session_id et type requis' });

  try {
    await withDb(async (db) => {
      let sessionOid;
      try { sessionOid = new ObjectId(session_id); }
      catch { return res.status(400).json({ error: 'session_id invalide' }); }

      // Fermer tout vote précédent
      await db.collection('repos').updateMany(
        { session_id: sessionOid, statut: 'en_attente' },
        { $set: { statut: 'expire' } }
      );

      const now = new Date();
      const timerSec = parseInt(timer_secondes) || 0;
      const repos = {
        session_id: sessionOid,
        type,
        demandeur_id: userId,
        demandeur_nom: demandeur_nom || 'Quelqu\'un',
        statut: 'en_attente',
        mode_validation: mode_validation || 'majorite',
        timer_secondes: timerSec,
        timer_debut: timerSec > 0 ? now : null,
        timer_expire: timerSec > 0 ? new Date(now.getTime() + timerSec * 1000) : null,
        votes: [],
        date_demande: now,
        date_resolution: null
      };

      const result = await db.collection('repos').insertOne(repos);
      res.status(201).json({ _id: result.insertedId, ...repos });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /Repos/:id/vote ───────────────────────────────────────
router.put('/:id/vote', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { nom, reponse } = req.body;
  if (!reponse) return res.status(400).json({ error: 'reponse requis (ok|non)' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const repos = await db.collection('repos').findOne({ _id: oid });
      if (!repos) return res.status(404).json({ error: 'Vote introuvable' });
      if (repos.statut !== 'en_attente') return res.status(400).json({ error: 'Vote terminé' });

      // Vérifier timer expiré
      if (repos.timer_expire && new Date() > new Date(repos.timer_expire)) {
        await db.collection('repos').updateOne({ _id: oid }, { $set: { statut: 'expire', date_resolution: new Date() } });
        return res.status(400).json({ error: 'Timer expiré' });
      }

      // Ajouter ou mettre à jour le vote
      const votes = repos.votes || [];
      const idx = votes.findIndex(v => v.user_id === userId);
      if (idx >= 0) votes[idx] = { user_id: userId, nom: nom || 'Joueur', reponse };
      else votes.push({ user_id: userId, nom: nom || 'Joueur', reponse });

      // Vérifier seuil atteint
      const nbOk  = votes.filter(v => v.reponse === 'ok').length;
      const nbNon = votes.filter(v => v.reponse === 'non').length;
      const total = votes.length;

      let newStatut = 'en_attente';
      if (repos.mode_validation === 'unanimite') {
        // Unanimité : si 1 non → refusé
        if (nbNon > 0) newStatut = 'refuse';
        else if (nbOk >= total && total >= 2) newStatut = 'accepte'; // au moins 2 votes tous ok
      } else {
        // Majorité : si plus de ok que de non
        if (nbOk > nbNon && total >= 2) newStatut = 'accepte';
      }

      const update = { $set: { votes } };
      if (newStatut !== 'en_attente') {
        update.$set.statut = newStatut;
        update.$set.date_resolution = new Date();
      }
      await db.collection('repos').updateOne({ _id: oid }, update);

      res.json({ success: true, votes, statut: newStatut, nb_ok: nbOk, nb_non: nbNon });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /Repos/:id/valider — MJ force ───────────────────────
router.put('/:id/valider', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const repos = await db.collection('repos').findOne({ _id: oid });
      if (!repos) return res.status(404).json({ error: 'Vote introuvable' });

      // Vérifier que c'est le MJ de la session
      const session = await db.collection('sessions').findOne({ _id: repos.session_id });
      if (session && session.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      await db.collection('repos').updateOne(
        { _id: oid },
        { $set: { statut: 'force', date_resolution: new Date() } }
      );
      res.json({ success: true, statut: 'force' });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /Repos/:id/refuser ───────────────────────────────────
router.put('/:id/refuser', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      await db.collection('repos').updateOne(
        { _id: oid },
        { $set: { statut: 'refuse', date_resolution: new Date() } }
      );
      res.json({ success: true, statut: 'refuse' });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /Repos/:id/timer ─────────────────────────────────────
router.put('/:id/timer', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { timer_secondes } = req.body;
  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const now = new Date();
      const timerSec = parseInt(timer_secondes) || 0;
      const update = timerSec > 0
        ? { timer_secondes: timerSec, timer_debut: now, timer_expire: new Date(now.getTime() + timerSec * 1000) }
        : { timer_secondes: 0, timer_debut: null, timer_expire: null };

      await db.collection('repos').updateOne({ _id: oid }, { $set: update });
      res.json({ success: true });
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /Repos/:id/appliquer — applique effets à tous ───────
router.post('/:id/appliquer', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    await withDb(async (db) => {
      let oid;
      try { oid = new ObjectId(req.params.id); }
      catch { return res.status(400).json({ error: 'ID invalide' }); }

      const repos = await db.collection('repos').findOne({ _id: oid });
      if (!repos) return res.status(404).json({ error: 'Vote introuvable' });
      if (!['accepte','force'].includes(repos.statut)) return res.status(400).json({ error: 'Repos non accepté' });

      // Récupérer les joueurs de la session
      const session = await db.collection('sessions').findOne({ _id: repos.session_id });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });

      const userIds = (session.joueurs || []).map(j => j.user_id).filter(Boolean);
      const personnages = await db.collection('personnages').find({ user_id: { $in: userIds } }).toArray();

      const isLong = repos.type === 'long';
      const updates = [];

      for (const p of personnages) {
        const update = {};
        const ressources = p.ressources_classe || {};
        const classe = (p.classe || '').toLowerCase();
        const niveau = p.niveau || 1;
        const configsClasse = getRessourcesDefaut(classe, niveau);

        // Réinitialiser ressources selon type de repos
        const newRessources = { ...ressources };
        for (const cfg of configsClasse) {
          const resetType = cfg.reset;
          if (isLong || resetType === 'court') {
            const maxVal = cfg.max;
            newRessources[cfg.id] = { actuel: maxVal, max: maxVal };
          }
        }
        update['ressources_classe'] = newRessources;

        if (isLong) {
          // Repos long : récupère tous les PV + emplacements de sorts + dés de vie
          const pvMax = p.combat?.pv_max || 10;
          update['combat.pv_actuels'] = pvMax;

          // Récupérer dés de vie (max moitié du total)
          const dvTotal = p.combat?.des_vie?.total || niveau;
          const dvRestants = p.combat?.des_vie?.restants || 0;
          const dvRecup = Math.max(1, Math.floor(dvTotal / 2));
          update['combat.des_vie.restants'] = Math.min(dvTotal, dvRestants + dvRecup);

          // Reset emplacements de sorts
          if (p.sorts?.emplacements?.length) {
            const empl = p.sorts.emplacements.map(e => ({ ...e, utilises: 0 }));
            update['sorts.emplacements'] = empl;
          }

          // Réduire épuisement
          if ((p.conditions_personnage || []).includes('epuisement')) {
            // Logique simple : on laisse ça côté client pour l'instant
          }
        }

        // Mise à jour derniere_modification
        update['derniere_modification'] = new Date();

        updates.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: update }
          }
        });
      }

      if (updates.length) await db.collection('personnages').bulkWrite(updates);

      // Marquer repos comme appliqué
      await db.collection('repos').updateOne({ _id: oid }, { $set: { statut: 'applique' } });

      const typeLabel = isLong ? 'long' : 'court';
      res.json({ success: true, nb_personnages: updates.length, message: `Repos ${typeLabel} appliqué à ${updates.length} personnage(s)` });
    });
  } catch (err) {
    console.error('[Repos/appliquer]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /Repos/imposer — MJ impose directement ─────────────
router.post('/imposer', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { session_id, type } = req.body;
  if (!session_id || !type) return res.status(400).json({ error: 'session_id et type requis' });

  try {
    await withDb(async (db) => {
      let sessionOid;
      try { sessionOid = new ObjectId(session_id); }
      catch { return res.status(400).json({ error: 'session_id invalide' }); }

      const session = await db.collection('sessions').findOne({ _id: sessionOid });
      if (!session) return res.status(404).json({ error: 'Session introuvable' });
      if (session.mj_id !== userId) return res.status(403).json({ error: 'MJ uniquement' });

      // Créer et marquer directement comme forcé
      const now = new Date();
      const repos = {
        session_id: sessionOid,
        type,
        demandeur_id: userId,
        demandeur_nom: 'MJ',
        statut: 'force',
        mode_validation: 'force',
        timer_secondes: 0,
        timer_debut: null,
        timer_expire: null,
        votes: [],
        date_demande: now,
        date_resolution: now
      };
      const result = await db.collection('repos').insertOne(repos);

      // Appliquer immédiatement (réutiliser la logique d'application)
      const reposId = result.insertedId;
      const isLong = type === 'long';
      const userIds = (session.joueurs || []).map(j => j.user_id).filter(Boolean);
      const personnages = await db.collection('personnages').find({ user_id: { $in: userIds } }).toArray();

      const updates = [];
      for (const p of personnages) {
        const update = {};
        const ressources = p.ressources_classe || {};
        const classe = (p.classe || '').toLowerCase();
        const niveau = p.niveau || 1;
        const configsClasse = getRessourcesDefaut(classe, niveau);
        const newRessources = { ...ressources };
        for (const cfg of configsClasse) {
          if (isLong || cfg.reset === 'court') {
            newRessources[cfg.id] = { actuel: cfg.max, max: cfg.max };
          }
        }
        update['ressources_classe'] = newRessources;
        if (isLong) {
          update['combat.pv_actuels'] = p.combat?.pv_max || 10;
          const dvTotal = p.combat?.des_vie?.total || niveau;
          const dvRestants = p.combat?.des_vie?.restants || 0;
          update['combat.des_vie.restants'] = Math.min(dvTotal, dvRestants + Math.max(1, Math.floor(dvTotal/2)));
          if (p.sorts?.emplacements?.length) {
            update['sorts.emplacements'] = p.sorts.emplacements.map(e => ({ ...e, utilises: 0 }));
          }
        }
        update['derniere_modification'] = new Date();
        updates.push({ updateOne: { filter: { _id: p._id }, update: { $set: update } } });
      }
      if (updates.length) await db.collection('personnages').bulkWrite(updates);
      await db.collection('repos').updateOne({ _id: reposId }, { $set: { statut: 'applique' } });

      res.status(201).json({ success: true, nb_personnages: updates.length, type });
    });
  } catch (err) {
    console.error('[Repos/imposer]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
