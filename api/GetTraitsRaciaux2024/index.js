const express = require('express');
const router  = express.Router();
const traits  = require('../data/traits_raciaux_2024.json');

router.get('/', (req, res) => {
  res.json(traits);
});

module.exports = router;
