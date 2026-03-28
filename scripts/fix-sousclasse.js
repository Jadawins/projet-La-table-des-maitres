// Ajoute getNiveauSousClasse(), met à jour selectClasse() et validateStep(3)
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. Ajouter getNiveauSousClasse juste avant selectClasse ──────
const BEFORE_SELECT = 'async function selectClasse(id) {';
const idx = c.indexOf(BEFORE_SELECT);
if (idx === -1) { console.error('selectClasse not found'); process.exit(1); }

const newFn = `function getNiveauSousClasse(classeData) {
  if (!classeData?.niveaux) return 3;
  const niveaux = classeData.niveaux;
  const found = Object.keys(niveaux)
    .map(Number)
    .sort((a, b) => a - b)
    .find(n => niveaux[String(n)]?.verifier_sous_classe === true);
  return found ?? 3;
}

`;
c = c.slice(0, idx) + newFn + c.slice(idx);

// ── 2. Remplacer le bloc sous-classe dans selectClasse ───────────
const OLD_SC = `  // Sous-classes si niveau \u2265 3\n  const scSection = document.getElementById('sousclasse-section');\n  if ((W.niveau || 1) >= 3) {\n    scSection.style.display = 'block';\n    await loadSousClasses(id);\n  } else {\n    scSection.style.display = 'none';\n  }`;

const NEW_SC = `  // Sous-classes si niveau >= unlock level
  const scSection = document.getElementById('sousclasse-section');
  const unlockNiveau = getNiveauSousClasse(W.classe_data);
  const subtitle = document.getElementById('sousclasse-subtitle');
  if (subtitle) subtitle.innerHTML = '<i class="fa-solid fa-star"></i> Sous-classe (niveau ' + unlockNiveau + ')';
  if ((W.niveau || 1) >= unlockNiveau) {
    scSection.style.display = 'block';
    await loadSousClasses(id);
  } else {
    scSection.style.display = 'none';
  }`;

if (c.indexOf(OLD_SC) === -1) { console.error('OLD_SC block not found'); process.exit(1); }
c = c.replace(OLD_SC, NEW_SC);

// ── 3. Mettre à jour validateStep(3) pour exiger la sous-classe ──
const OLD_V = `  if (n === 3 && !W.classe) { alert('S\u00e9lectionnez une classe.'); return false; }`;
const NEW_V = `  if (n === 3) {
    if (!W.classe) { alert('S\u00e9lectionnez une classe.'); return false; }
    const unlock = getNiveauSousClasse(W.classe_data);
    if ((W.niveau || 1) >= unlock && !W.sous_classe) {
      alert('S\u00e9lectionnez une sous-classe (obligatoire \u00e0 partir du niveau ' + unlock + ').');
      return false;
    }
  }`;

if (c.indexOf(OLD_V) === -1) { console.error('validateStep(3) marker not found'); process.exit(1); }
c = c.replace(OLD_V, NEW_V);

fs.writeFileSync(file, c, 'utf8');
console.log('Done - sous-classe dynamic unlock implemented');
