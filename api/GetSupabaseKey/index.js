const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const key = process.env.VITE_SUPABASE_KEY;
  const url = process.env.VITE_SUPABASE_URL;

  if (!key || !url) {
    return res.status(500).json({ error: 'Clé ou URL Supabase manquante.' });
  }

  res.status(200).json({ key, url });
});

module.exports = router;
