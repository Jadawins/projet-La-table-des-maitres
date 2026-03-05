require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Auto-chargement des routes (un dossier = une route)
fs.readdirSync(__dirname).forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.statSync(fullPath).isDirectory()) return;
  if (['node_modules'].includes(dir)) return;
  try {
    const route = require(fullPath);
    app.use(`/${dir}`, route);
    console.log(`✓ Route chargée : /${dir}`);
  } catch (err) {
    // pas un routeur, on ignore
  }
});

app.get('/', (req, res) => res.json({ status: 'API La Table du Maître en ligne' }));

app.listen(PORT, () => console.log(`API démarrée sur le port ${PORT}`));
