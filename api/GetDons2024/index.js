const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../Json/2024/Don/dons.json');

router.get('/', (req, res) => {
  try {
    let dons = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    const { categorie, recherche } = req.query;

    if (categorie) {
      dons = dons.filter(d => d.categorie && d.categorie.toLowerCase() === categorie.toLowerCase());
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      dons = dons.filter(d =>
        (d.nom && d.nom.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json(dons);
  } catch (err) {
    console.error('Erreur GetDons2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
