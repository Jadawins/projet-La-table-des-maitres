// ═══════════════════════════════════════════════════════════════
//  Admin — statistiques et supervision (accès restreint)
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const { MongoClient } = require('mongodb');

const ADMIN_ID = process.env.ADMIN_USER_ID; // UUID Supabase de l'admin
const { getUserId } = require('../auth');

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// ─── GET /Admin/stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  if (!ADMIN_ID || userId !== ADMIN_ID) return res.status(403).json({ error: 'Accès refusé' });

  try {
    const data = await withDb(async (db) => {
      const [
        totalPersonnages,
        totalSessions,
        totalCampagnes,
        totalMonstres,
        totalObjets,
        totalCombats,
        parUtilisateur,
        recentPersos,
        recentSessions,
      ] = await Promise.all([
        db.collection('personnages').countDocuments(),
        db.collection('sessions').countDocuments(),
        db.collection('campagnes').countDocuments(),
        db.collection('monstres_custom').countDocuments(),
        db.collection('objets_magiques').countDocuments({ homebrew: true }),
        db.collection('combats').countDocuments(),

        db.collection('personnages').aggregate([
          { $group: {
            _id: '$user_id',
            count: { $sum: 1 },
            persos: { $push: { id: '$_id', nom: '$nom' } },
            derniere_activite: { $max: '$derniere_modification' }
          }},
          { $sort: { count: -1 } },
          { $limit: 50 }
        ]).toArray(),

        db.collection('personnages').find({})
          .sort({ created_at: -1 })
          .limit(10)
          .project({ nom: 1, classe: 1, niveau: 1, user_id: 1, created_at: 1 })
          .toArray(),

        db.collection('sessions').find({})
          .sort({ created_at: -1 })
          .limit(5)
          .project({ nom: 1, statut: 1, mj_id: 1, created_at: 1 })
          .toArray(),
      ]);

      return {
        totaux: {
          personnages: totalPersonnages,
          sessions: totalSessions,
          campagnes: totalCampagnes,
          monstres_custom: totalMonstres,
          objets_magiques_homebrew: totalObjets,
          combats: totalCombats,
        },
        utilisateurs: parUtilisateur.map(u => ({
          user_id: u._id,
          nb_personnages: u.count,
          personnages: u.persos.slice(0, 5),
          derniere_activite: u.derniere_activite || null,
        })),
        recent_personnages: recentPersos,
        recent_sessions: recentSessions,
        generated_at: new Date().toISOString(),
      };
    });

    res.json(data);
  } catch (e) {
    console.error('Admin/stats error:', e);
    res.status(500).json({ error: 'Erreur serveur', detail: e.message });
  }
});

module.exports = router;
