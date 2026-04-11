const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

const ADMIN_ID = process.env.ADMIN_USER_ID;
const { getUserId } = require('../auth');

function isAdmin(req) {
  return ADMIN_ID && getUserId(req) === ADMIN_ID;
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
    const filter = isAdmin(req)
      ? { _id: new ObjectId(req.params.id) }
      : { _id: new ObjectId(req.params.id), user_id: userId };
    const p = await withDb(db =>
      db.collection('personnages').findOne(filter)
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

// ─── PUT /:id/ressources — mettre à jour une ressource ────────
router.put('/:id/ressources', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  const { ressource, valeur, ressources_completes } = req.body;
  try {
    let oid;
    try { oid = new ObjectId(req.params.id); }
    catch { return res.status(400).json({ error: 'ID invalide' }); }

    const update = { derniere_modification: new Date() };
    if (ressources_completes) {
      update['ressources_classe'] = ressources_completes;
    } else if (ressource && valeur !== undefined) {
      update[`ressources_classe.${ressource}.actuel`] = parseInt(valeur);
    } else {
      return res.status(400).json({ error: 'ressource+valeur ou ressources_completes requis' });
    }

    const result = await withDb(db =>
      db.collection('personnages').updateOne(
        { _id: oid, user_id: userId },
        { $set: update }
      )
    );
    if (!result.matchedCount) return res.status(403).json({ error: 'Personnage introuvable ou non autorisé' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── XP TABLE PHB 2024 ────────────────────────────────────────
const XP_PAR_NIVEAU = {
  1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000,
  9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000,
  15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000
};
function niveauDepuisXP(xp) {
  let n = 1;
  for (let i = 20; i >= 2; i--) { if ((xp || 0) >= XP_PAR_NIVEAU[i]) { n = i; break; } }
  return n;
}
function bonusMaitriseDepuisNiveau(n) {
  if (n >= 17) return 6;
  if (n >= 13) return 5;
  if (n >= 9)  return 4;
  if (n >= 5)  return 3;
  return 2;
}

// ─── POST /:id/xp — ajouter XP ────────────────────────────────
router.post('/:id/xp', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { xp } = req.body;
  if (typeof xp !== 'number' || xp < 0) return res.status(400).json({ error: 'xp invalide' });
  try {
    let oid;
    try { oid = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: 'ID invalide' }); }
    const perso = await withDb(db => db.collection('personnages').findOne({ _id: oid, user_id: userId }));
    if (!perso) return res.status(403).json({ error: 'Introuvable' });

    const ancienXP    = perso.experience || 0;
    const ancienNiv   = perso.niveau || 1;
    const nouvelXP    = ancienXP + xp;
    const nouveauNiv  = niveauDepuisXP(nouvelXP);
    const levelUp     = nouveauNiv > ancienNiv;
    const update      = { experience: nouvelXP, derniere_modification: new Date() };
    if (levelUp) update.niveau = nouveauNiv;

    await withDb(db => db.collection('personnages').updateOne({ _id: oid }, { $set: update }));
    res.json({ ok: true, experience: nouvelXP, niveau: levelUp ? nouveauNiv : ancienNiv, level_up: levelUp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /:id/niveau/preview — aperçu prochain niveau ─────────
router.get('/:id/niveau/preview', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  try {
    let oid;
    try { oid = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: 'ID invalide' }); }
    const perso = await withDb(db => db.collection('personnages').findOne({ _id: oid, user_id: userId }));
    if (!perso) return res.status(403).json({ error: 'Introuvable' });
    const ancienNiv  = perso.niveau || 1;
    const nouveauNiv = Math.min(ancienNiv + 1, 20);
    const xpNecessaire = XP_PAR_NIVEAU[nouveauNiv] || null;
    const xpActuel     = perso.experience || 0;
    const estJalon     = perso.progression === 'jalon';
    const eligible     = estJalon || xpActuel >= (xpNecessaire || 0);
    res.json({ ancien_niveau: ancienNiv, nouveau_niveau: nouveauNiv, xp_actuel: xpActuel, xp_necessaire: xpNecessaire, eligible, progression: perso.progression || 'xp' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /:id/niveau — appliquer montée en niveau ────────────
router.post('/:id/niveau', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Non authentifié' });
  const { nouveau_niveau, choix } = req.body;
  if (!nouveau_niveau) return res.status(400).json({ error: 'nouveau_niveau requis' });
  try {
    let oid;
    try { oid = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: 'ID invalide' }); }
    const perso = await withDb(db => db.collection('personnages').findOne({ _id: oid, user_id: userId }));
    if (!perso) return res.status(403).json({ error: 'Introuvable' });

    const update = { niveau: nouveau_niveau, derniere_modification: new Date() };
    update.bonus_maitrise = bonusMaitriseDepuisNiveau(nouveau_niveau);

    // Appliquer PV
    if (choix?.pv_gagne) {
      const ancienMax = perso.combat?.pv_max || 0;
      update['combat.pv_max'] = ancienMax + choix.pv_gagne;
      update['combat.pv_actuels'] = (perso.combat?.pv_actuels || 0) + choix.pv_gagne;
    }
    // Sous-classe
    if (choix?.sous_classe) update.sous_classe = choix.sous_classe;
    // Don
    if (choix?.don) {
      const aptitudes = perso.aptitudes || [];
      aptitudes.push({ type: 'don', id: choix.don.id, nom: choix.don.nom });
      update.aptitudes = aptitudes;
    }
    // Amélioration caractéristique
    if (choix?.amelioration_carac) {
      const caracs = perso.caracteristiques || {};
      for (const [car, delta] of Object.entries(choix.amelioration_carac)) {
        if (caracs[car]) caracs[car].valeur = Math.min(20, (caracs[car].valeur || 10) + delta);
      }
      update.caracteristiques = caracs;
    }

    await withDb(db => db.collection('personnages').updateOne({ _id: oid }, { $set: update }));
    res.json({ ok: true, niveau: nouveau_niveau, bonus_maitrise: update.bonus_maitrise });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
