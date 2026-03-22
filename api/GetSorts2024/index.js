const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const SORT_DIR = path.join(__dirname, '../../Json/2024/Sort');

function loadAllSorts() {
  const all = [];
  for (let i = 0; i <= 9; i++) {
    const file = path.join(SORT_DIR, `sorts_niveau_${i}.json`);
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      all.push(...data);
    }
  }
  return all;
}

router.get('/', (req, res) => {
  try {
    let sorts = loadAllSorts();
    const { niveau, ecole, classe, concentration, rituel, recherche } = req.query;

    if (niveau !== undefined && niveau !== '') {
      sorts = sorts.filter(s => s.niveau === parseInt(niveau));
    }
    if (ecole) {
      sorts = sorts.filter(s => s.ecole && s.ecole.toLowerCase() === ecole.toLowerCase());
    }
    if (classe) {
      sorts = sorts.filter(s => Array.isArray(s.classes) && s.classes.some(c => c.toLowerCase() === classe.toLowerCase()));
    }
    if (concentration !== undefined && concentration !== '') {
      sorts = sorts.filter(s => s.concentration === (concentration === 'true'));
    }
    if (rituel !== undefined && rituel !== '') {
      sorts = sorts.filter(s => s.rituel === (rituel === 'true'));
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      sorts = sorts.filter(s =>
        (s.nom && s.nom.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json(sorts);
  } catch (err) {
    console.error('Erreur GetSorts2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
