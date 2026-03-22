const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../Json/2024/Regles/correspondances.json');

router.get('/', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    res.status(200).json(data);
  } catch (err) {
    console.error('Erreur GetCorrespondances:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
