const express = require('express');
const { execSync } = require('child_process');
const router = express.Router();

router.post('/', (req, res) => {
  const token = req.headers['authorization'];
  const expected = 'Bearer ' + process.env.WEBHOOK_SECRET;

  if (!token || token !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(200).json({ message: 'Deploy triggered' });

  try {
    const pull = execSync('cd /var/www/myrpgtable/app && git pull origin master', { timeout: 30000 });
    console.log('[deploy] pull:', new Date().toISOString(), pull.toString().trim());
    const restart = execSync('pm2 restart myrpgtable-api', { timeout: 15000 });
    console.log('[deploy] pm2 restart:', restart.toString().trim());
  } catch (err) {
    console.error('[deploy] Error:', err.message);
  }
});

module.exports = router;
