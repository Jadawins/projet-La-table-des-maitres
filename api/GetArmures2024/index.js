const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../Json/2024/Equipement/armures.json');

router.get('/', (req, res) => {
  try {
    let armures = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    const { categorie, recherche } = req.query;

    if (categorie) {
      armures = armures.filter(a => a.categorie && a.categorie.toLowerCase() === categorie.toLowerCase());
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      armures = armures.filter(a => a.nom && a.nom.toLowerCase().includes(q));
    }

    res.status(200).json(armures);
  } catch (err) {
    console.error('Erreur GetArmures2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
