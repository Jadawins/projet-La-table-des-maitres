const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const SC_DIR = path.join(__dirname, '../../Json/2024/SousClasse');

function loadAllSousClasses() {
  const files = fs.readdirSync(SC_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(SC_DIR, f), 'utf-8'));
    return { id: f.replace('.json', ''), ...data };
  });
}

router.get('/', (req, res) => {
  try {
    let sousClasses = loadAllSousClasses();
    const { classe, recherche } = req.query;

    if (classe) {
      sousClasses = sousClasses.filter(sc => sc.classe_parente && sc.classe_parente.toLowerCase() === classe.toLowerCase());
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      sousClasses = sousClasses.filter(sc => sc.nom && sc.nom.toLowerCase().includes(q));
    }

    res.status(200).json(sousClasses);
  } catch (err) {
    console.error('Erreur GetSousClasses2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
