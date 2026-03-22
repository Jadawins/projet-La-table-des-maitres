const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const MONSTRES_DIR = path.join(__dirname, '../../Json/2024/Monstres');

function loadAllMonstres() {
  const files = fs.readdirSync(MONSTRES_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
  const all = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MONSTRES_DIR, file), 'utf-8'));
      if (Array.isArray(data)) all.push(...data);
      else if (data && typeof data === 'object') all.push(data);
    } catch (e) { /* fichier invalide, on ignore */ }
  }
  return all;
}

// GET /GetMonstres — liste avec filtres
router.get('/', (req, res) => {
  try {
    let monstres = loadAllMonstres();
    const { type, taille, fp_min, fp_max, recherche } = req.query;

    if (type) {
      monstres = monstres.filter(m => m.type && m.type.toLowerCase() === type.toLowerCase());
    }
    if (taille) {
      monstres = monstres.filter(m => m.taille && m.taille.toLowerCase() === taille.toLowerCase());
    }
    if (fp_min !== undefined && fp_min !== '') {
      monstres = monstres.filter(m => m.fp_numerique !== undefined && m.fp_numerique >= parseFloat(fp_min));
    }
    if (fp_max !== undefined && fp_max !== '') {
      monstres = monstres.filter(m => m.fp_numerique !== undefined && m.fp_numerique <= parseFloat(fp_max));
    }
    if (recherche) {
      const q = recherche.toLowerCase();
      monstres = monstres.filter(m =>
        (m.nom && m.nom.toLowerCase().includes(q)) ||
        (m.nom_original && m.nom_original.toLowerCase().includes(q))
      );
    }

    res.status(200).json(monstres);
  } catch (err) {
    console.error('Erreur GetMonstres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /GetMonstres/:slug — détail d'un monstre
router.get('/:slug', (req, res) => {
  try {
    const file = path.join(MONSTRES_DIR, `${req.params.slug}.json`);
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'Monstre introuvable' });
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.status(200).json(data);
  } catch (err) {
    console.error('Erreur GetMonstres/:slug:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
