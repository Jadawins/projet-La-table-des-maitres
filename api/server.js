require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
const ALLOWED_ORIGINS = [
  'https://myrpgtable.fr',
  'https://www.myrpgtable.fr',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5500',  // VS Code Live Server
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

app.listen(PORT, '127.0.0.1', () => console.log(`API démarrée sur le port ${PORT}`));
