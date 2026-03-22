const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CLASSE_DIR = path.join(__dirname, '../../Json/2024/Classe');

function loadAllClasses() {
  const files = fs.readdirSync(CLASSE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(CLASSE_DIR, f), 'utf-8'));
    return {
      id: f.replace('.json', ''),
      nom: data.nom,
      source: data.source,
      de_vie: data.niveaux?.['0']?.de_vie,
      caracteristique_principale: data.niveaux?.['0']?.caracteristique_principale,
      sauvegardes_maitrise: data.niveaux?.['0']?.sauvegardes_maitrise,
      competences_choisies: data.niveaux?.['0']?.competences_choisies,
      _full: data
    };
  });
}

router.get('/', (req, res) => {
  try {
    let classes = loadAllClasses();
    const { recherche } = req.query;

    if (recherche) {
      const q = recherche.toLowerCase();
      classes = classes.filter(c => c.nom && c.nom.toLowerCase().includes(q));
    }

    res.status(200).json(classes);
  } catch (err) {
    console.error('Erreur GetClasses2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
