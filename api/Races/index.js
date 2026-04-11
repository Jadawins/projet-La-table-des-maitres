const express = require('express');
const router  = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const ADMIN_ID = process.env.ADMIN_USER_ID;
const { getUserId } = require('../auth');

async function withDb(fn) {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  try { return await fn(client.db('myrpgtable')); }
  finally { await client.close(); }
}

// ─── GET / — liste les races publiées (+ drafts de l'utilisateur) ──
router.get('/', async (req, res) => {
  const userId = getUserId(req);
  try {
    const races = await withDb(db => {
      const filter = userId
        ? { $or: [{ statut: 'validated' }, { statut: 'draft', createur_id: userId }] }
        : { statut: 'validated' };
      return db.collection('races_homebrew').find(filter)
        .sort({ created_at: -1 })
        .project({ traits_custom: 0, traits_rp: 0 }) // allège la liste
        .toArray();
    });
    res.json(races);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /:id — détail complet ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const race = await withDb(db =>
      db.collection('races_homebrew').findOne({ _id: new ObjectId(req.params.id) })
    );
    if (!race) return res.status(404).json({ error: 'Race introuvable' });
    res.json(race);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST / — créer une race homebrew ──────────────────────────────
router.post('/', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { nom, version, type_creature, famille, vitesse, taille, alignement, age,
    darkvision, initiative_bonus, ability_scores, maitrise_armes, maitrise_armures,
    maitrise_outils, sorts_raciaux, ascendance_draconique, manifestation_divine,
    manifestation_saisonniere, langues, competences, maitrise_etats, avantage_js_magie,
    resistances_degats, traits_custom, traits_rp } = req.body;

  if (!nom?.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' });

  const race = {
    nom: nom.trim(),
    version: version || 'Homebrew',
    type_creature: type_creature || '',
    famille: famille || null,
    vitesse: vitesse || null,
    taille,
    alignement,
    age,
    darkvision,
    initiative_bonus: !!initiative_bonus,
    ability_scores: ability_scores || [],
    maitrise_armes: maitrise_armes || null,
    maitrise_armures: maitrise_armures || null,
    maitrise_outils: maitrise_outils || null,
    sorts_raciaux: sorts_raciaux || [],
    ascendance_draconique: !!ascendance_draconique,
    manifestation_divine: !!manifestation_divine,
    manifestation_saisonniere: !!manifestation_saisonniere,
    langues: langues || null,
    competences: competences || null,
    maitrise_etats: maitrise_etats || [],
    avantage_js_magie: avantage_js_magie || null,
    resistances_degats: resistances_degats || [],
    traits_custom: traits_custom || [],
    traits_rp: traits_rp || [],
    statut: 'draft',          // draft → validated après 10 rapports
    createur_id: userId,
    rapports: [],             // { user_id, approbation, commentaire, created_at }
    nb_approbations: 0,
    created_at: new Date().toISOString(),
  };

  try {
    const result = await withDb(db => db.collection('races_homebrew').insertOne(race));
    res.status(201).json({ _id: result.insertedId, nom: race.nom, statut: race.statut });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /:id/rapport — soumettre un rapport de bêta-test ─────────
router.post('/:id/rapport', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { approbation, commentaire } = req.body; // approbation: true/false
  if (typeof approbation !== 'boolean') return res.status(400).json({ error: 'approbation (boolean) requis' });

  try {
    const result = await withDb(async db => {
      const col = db.collection('races_homebrew');
      const race = await col.findOne({ _id: new ObjectId(req.params.id) });
      if (!race) return null;

      // Un utilisateur ne peut soumettre qu'un seul rapport
      const dejaRapporte = (race.rapports || []).some(r => r.user_id === userId);
      if (dejaRapporte) return { erreur: 'Vous avez déjà soumis un rapport pour cette race.' };

      const rapport = { user_id: userId, approbation, commentaire: commentaire?.trim() || '', created_at: new Date().toISOString() };
      const rapports = [...(race.rapports || []), rapport];
      const nb_approbations = rapports.filter(r => r.approbation).length;
      const statut = nb_approbations >= 10 ? 'validated' : race.statut;

      await col.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { rapports, nb_approbations, statut } }
      );
      return { statut, nb_approbations, total_rapports: rapports.length };
    });

    if (!result) return res.status(404).json({ error: 'Race introuvable' });
    if (result.erreur) return res.status(409).json({ error: result.erreur });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
