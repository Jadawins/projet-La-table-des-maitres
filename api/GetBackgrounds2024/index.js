const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const BG_DIR = path.join(__dirname, '../../Json/2024/Background');

function loadAllBackgrounds() {
  const files = fs.readdirSync(BG_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(BG_DIR, f), 'utf-8'));
    return data;
  });
}

router.get('/', (req, res) => {
  try {
    let backgrounds = loadAllBackgrounds();
    const { recherche } = req.query;

    if (recherche) {
      const q = recherche.toLowerCase();
      backgrounds = backgrounds.filter(b =>
        (b.nom && b.nom.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q))
      );
    }

    res.status(200).json(backgrounds);
  } catch (err) {
    console.error('Erreur GetBackgrounds2024:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
