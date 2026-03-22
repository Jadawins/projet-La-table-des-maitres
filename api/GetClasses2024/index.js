const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CLASSE_DIR = path.join(__dirname, '../../Json/2024/Classe');

function loadAllClasses() {
  const files = fs.readdirSync(CLASSE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(CLASSE_DIR, f), 'utf-8'));
    const n0 = data.niveaux?.['0'] || {};
    return {
      id: f.replace('.json', ''),
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
}

function loadOneClasse(id) {
  const file = path.join(CLASSE_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

// GET / — liste légère (sans données de tous les niveaux)
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

// GET /:id — données complètes d'une classe
router.get('/:id', (req, res) => {
  try {
    const data = loadOneClasse(req.params.id);
    if (!data) return res.status(404).json({ error: 'Classe introuvable' });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
