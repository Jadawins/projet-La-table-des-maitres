const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.get('/', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('monstres');
    const query = {};
    const { type, taille, fp_min, fp_max, recherche } = req.query;

    if (type) query.type = { $regex: new RegExp(`^${type}$`, 'i') };
    if (taille) query.taille = { $regex: new RegExp(`^${taille}$`, 'i') };
    if (fp_min !== undefined && fp_min !== '') query.fp_numerique = { ...query.fp_numerique, $gte: parseFloat(fp_min) };
    if (fp_max !== undefined && fp_max !== '') query.fp_numerique = { ...query.fp_numerique, $lte: parseFloat(fp_max) };
    if (recherche) {
      query.$or = [
        { nom: { $regex: recherche, $options: 'i' } },
        { nom_original: { $regex: recherche, $options: 'i' } }
      ];
    }

    const monstres = await col.find(query, { projection: { _id: 0, _source: 0 } }).toArray();
    res.status(200).json(monstres);
  } catch (err) {
    console.error('Erreur GetMonstres:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

router.get('/:slug', async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const col = client.db('myrpgtable').collection('monstres');
    const docs = await col.find({ _source: req.params.slug }, { projection: { _id: 0, _source: 0 } }).toArray();
    if (docs.length === 0) return res.status(404).json({ error: 'Monstre introuvable' });
    res.status(200).json(docs.length === 1 ? docs[0] : docs);
  } catch (err) {
    console.error('Erreur GetMonstres/:slug:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await client.close();
  }
});

module.exports = router;
