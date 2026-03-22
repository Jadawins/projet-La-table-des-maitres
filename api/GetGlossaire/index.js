const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../Json/2024/Regles/glossaire.json');

router.get('/', (req, res) => {
  try {
    let entrees = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    const { categorie, recherche } = req.query;

    if (categorie) {
      entrees = entrees.filter(e => e.categorie && e.categorie.toLowerCase() === categorie.toLowerCase());
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      entrees = entrees.filter(e =>
        (e.nom && e.nom.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json(entrees);
  } catch (err) {
    console.error('Erreur GetGlossaire:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
