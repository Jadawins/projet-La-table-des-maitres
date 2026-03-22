const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const ESPECE_DIR = path.join(__dirname, '../../Json/2024/Espece');

function loadAllEspeces() {
  const files = fs.readdirSync(ESPECE_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(ESPECE_DIR, f), 'utf-8'));
    return data;
  });
}

router.get('/', (req, res) => {
  try {
    let especes = loadAllEspeces();
    const { recherche } = req.query;

    if (recherche) {
      const q = recherche.toLowerCase();
      especes = especes.filter(e =>
        (e.nom && e.nom.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json(especes);
  } catch (err) {
    console.error('Erreur GetEspeces2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
