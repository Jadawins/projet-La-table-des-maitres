const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('classes');
    const query = {};
    const { recherche } = req.query;
    if (recherche) query.nom = { $regex: recherche, $options: 'i' };

    const docs = await col.find(query).toArray();
    const classes = docs.map(data => {
      const n0 = data.niveaux?.['0'] || {};
      return {
        id: data._source,
        nom: data.nom,
        source: data.source,
        de_vie: n0.de_vie,
        caracteristique_principale: n0.caracteristique_principale,
        sauvegardes_maitrise: n0.sauvegardes_maitrise,
        competences_choisies: n0.competences_choisies,
        incantation: !!n0.incantation,
        caracteristique_incantation: n0.caracteristique_incantation || null,
        maitrises_armes: n0.maitrises_armes || [],
        maitrises_armures: n0.maitrises_armures || [],
        equipement_depart: n0.equipement_depart || []
      };
    });
    res.status(200).json(classes);
  } catch (err) {
    console.error('Erreur GetClasses2024:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

router.get('/:id', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('classes');
    const data = await col.findOne({ _source: req.params.id }, { projection: { _id: 0, _source: 0 } });
    if (!data) return res.status(404).json({ error: 'Classe introuvable' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
