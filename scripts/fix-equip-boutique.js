// Ajoute la boutique d'achat libre à l'étape équipement
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. Ajouter _boutique dans W initial ─────────────────────────────────────
const OLD_WINIT = `  equipement_or_depart: 0,`;
const NEW_WINIT = `  equipement_or_depart: 0,
  equipement_mode: 'pack',   // 'pack' ou 'achat'
  _catalogue: [],            // cache items boutique
  panier: [],                // { nom, type, categorie, prix_po, quantite }`;
if (c.indexOf(OLD_WINIT) === -1) { console.error('W init not found'); process.exit(1); }
c = c.replace(OLD_WINIT, NEW_WINIT);

// ── 2. Remplacer renderEquipement pour gérer les deux modes ────────────────
// On ajoute l'init du mode achat à la fin de renderEquipement
const OLD_RENDER_END = `  // Sélectionner le premier choix par défaut si rien choisi
  if (!W.equipement_choix_classe && classeEquip.length > 0) {
    selectEquipChoix(classeEquip[0].choix);
  }
}`;
const NEW_RENDER_END = `  // Sélectionner le premier choix par défaut si rien choisi
  if (!W.equipement_choix_classe && classeEquip.length > 0) {
    selectEquipChoix(classeEquip[0].choix);
  }

  // Afficher le bon panel selon le mode
  switchEquipTab(W.equipement_mode || 'pack', false);
}`;
if (c.indexOf(OLD_RENDER_END) === -1) { console.error('renderEquipement end not found'); process.exit(1); }
c = c.replace(OLD_RENDER_END, NEW_RENDER_END);

// ── 3. Ajouter toutes les fonctions boutique avant ajouterEquipCustom ──────
const BEFORE_CUSTOM = 'function ajouterEquipCustom() {';
const idx = c.indexOf(BEFORE_CUSTOM);
if (idx === -1) { console.error('ajouterEquipCustom not found'); process.exit(1); }

const boutiqueFns = `// ─── BOUTIQUE D'ACHAT LIBRE ──────────────────────────────────

function switchEquipTab(mode, doLoad) {
  W.equipement_mode = mode;
  document.getElementById('equip-panel-pack').style.display  = mode === 'pack'  ? '' : 'none';
  document.getElementById('equip-panel-achat').style.display = mode === 'achat' ? '' : 'none';
  document.getElementById('equip-tab-pack').classList.toggle('active',  mode === 'pack');
  document.getElementById('equip-tab-achat').classList.toggle('active', mode === 'achat');

  if (mode === 'achat') {
    // Calculer le budget disponible
    const budget = getBudgetAchat();
    document.getElementById('equip-budget-total').textContent   = budget;
    document.getElementById('equip-budget-restant').textContent = budget - depenseePanier();
    updateBudgetDisplay();
    if (doLoad !== false) loadCatalogue();
  }
}

function getBudgetAchat() {
  // Budget = or de départ du choix classe + or du background
  let total = 0;
  // Or du choix de classe (option "X po" uniquement)
  if (W.equipement_choix_classe) {
    const opt = (W.classe_data?.equipement_depart || []).find(o => o.choix === W.equipement_choix_classe);
    (opt?.contenu || []).forEach(nom => {
      const m = String(nom).match(/^(\\d+)\\s*po$/i);
      if (m) total += parseInt(m[1]);
    });
  }
  // Or du background (si champ or_depart présent)
  if (W.bg_data?.or_depart) total += W.bg_data.or_depart;
  return total;
}

function depenseePanier() {
  return (W.panier || []).reduce((s, i) => s + i.prix_po * (i.quantite || 1), 0);
}

function budgetRestant() {
  return getBudgetAchat() - depenseePanier();
}

function updateBudgetDisplay() {
  const restant = budgetRestant();
  const el = document.getElementById('equip-budget-restant');
  if (el) {
    el.textContent = Math.round(restant * 100) / 100;
    el.style.color = restant < 0 ? '#f87171' : restant === 0 ? '#4ade80' : '#e0e0e0';
  }
  const display = document.getElementById('equip-budget-display');
  if (display) display.classList.toggle('over-budget', restant < 0);
}

async function loadCatalogue() {
  if (W._catalogue.length > 0) { renderBoutique(); return; }
  document.getElementById('equip-boutique-list').innerHTML =
    '<div style="color:#888;text-align:center;padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>';
  try {
    const [armes, armures, equips] = await Promise.all([
      fetch(\`\${API}/GetArmes2024\`).then(r => r.json()),
      fetch(\`\${API}/GetArmures2024\`).then(r => r.json()),
      fetch(\`\${API}/GetEquipements2024\`).then(r => r.json()),
    ]);
    W._catalogue = [
      ...armes.map(i => ({ ...i, type: 'arme' })),
      ...armures.map(i => ({ ...i, type: 'armure' })),
      ...equips,
    ].filter(i => i.prix);
    renderBoutique();
  } catch (e) {
    document.getElementById('equip-boutique-list').innerHTML =
      '<div style="color:#f66;text-align:center;padding:1rem;">Erreur de chargement.</div>';
  }
}

function filtrerBoutique() { renderBoutique(); }

function renderBoutique() {
  const search = (document.getElementById('equip-search')?.value || '').toLowerCase();
  const type   = document.getElementById('equip-filtre-type')?.value || '';

  const pool = W._catalogue.filter(i => {
    if (type && i.type !== type) return false;
    if (search && !i.nom.toLowerCase().includes(search)) return false;
    return true;
  });

  const budget = getBudgetAchat();
  const list   = document.getElementById('equip-boutique-list');
  if (!list) return;

  if (!budget) {
    list.innerHTML = '<div style="color:#888;font-size:0.8rem;text-align:center;padding:1.5rem;">Aucun budget disponible.<br>Choisissez une option de classe avec de l\'or (ex : "90 po").</div>';
    return;
  }

  if (!pool.length) {
    list.innerHTML = '<div style="color:#555;font-size:0.78rem;text-align:center;padding:1rem;">Aucun article trouvé.</div>';
    return;
  }

  list.innerHTML = pool.map(item => {
    const prixPo = prixEnPoItem(item.prix);
    const inPanier = (W.panier || []).find(p => p.nom === item.nom);
    const qte = inPanier?.quantite || 0;
    const tooExpensive = prixPo > budgetRestant() + (inPanier ? inPanier.prix_po * inPanier.quantite : 0);
    const prixStr = formatPrix(item.prix);
    let detail = '';
    if (item.type === 'arme' && item.degats) detail = item.degats.de + ' ' + item.degats.type;
    if (item.type === 'armure' && item.classe_armure) detail = 'CA ' + item.classe_armure.base + (item.classe_armure.modificateur_dex ? '+DEX' : '');
    return \`<div class="boutique-row\${tooExpensive && qte === 0 ? ' boutique-disabled' : ''}">
      <div class="boutique-row-info">
        <span class="boutique-nom">\${esc(item.nom)}</span>
        \${detail ? \`<span class="boutique-detail">\${esc(detail)}</span>\` : ''}
        <span class="boutique-type boutique-type-\${item.type}">\${item.type}</span>
      </div>
      <div class="boutique-row-actions">
        <span class="boutique-prix">\${prixStr}</span>
        <div class="boutique-qty">
          <button class="boutique-btn-qty" onclick="retirerPanier('\${esc(item.nom)}')" \${qte === 0 ? 'disabled' : ''}>−</button>
          <span class="boutique-qty-val">\${qte}</span>
          <button class="boutique-btn-qty" onclick="ajouterPanier(\${JSON.stringify(JSON.stringify({nom:item.nom,type:item.type,categorie:item.categorie||item.type,prix_po:prixPo})).slice(1,-1)})" \${tooExpensive ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>\`;
  }).join('');

  renderPanier();
}

function prixEnPoItem(prix) {
  if (!prix) return 0;
  const { quantite, monnaie } = prix;
  switch (monnaie) {
    case 'po': return quantite;
    case 'pa': return Math.round(quantite / 10 * 100) / 100;
    case 'pc': return Math.round(quantite / 100 * 100) / 100;
    case 'pp': return quantite * 10;
    default:   return quantite;
  }
}

function formatPrix(prix) {
  if (!prix) return '—';
  return \`\${prix.quantite} \${prix.monnaie}\`;
}

function ajouterPanier(itemJson) {
  const item = JSON.parse('{' + itemJson + '}');
  if (budgetRestant() < item.prix_po) return;
  if (!W.panier) W.panier = [];
  const existing = W.panier.find(p => p.nom === item.nom);
  if (existing) { existing.quantite = (existing.quantite || 1) + 1; }
  else { W.panier.push({ ...item, quantite: 1 }); }
  // Sync W.equipement
  syncEquipementFromPanier();
  updateBudgetDisplay();
  renderBoutique();
}

function retirerPanier(nom) {
  if (!W.panier) return;
  const idx = W.panier.findIndex(p => p.nom === nom);
  if (idx === -1) return;
  if (W.panier[idx].quantite > 1) { W.panier[idx].quantite--; }
  else { W.panier.splice(idx, 1); }
  syncEquipementFromPanier();
  updateBudgetDisplay();
  renderBoutique();
}

function syncEquipementFromPanier() {
  // En mode achat, W.equipement = panier + équipement background
  const bgEquip = (W.bg_data?.equipement || []).map(e => ({ nom: e.nom, quantite: e.quantite || 1, source: 'bg' }));
  const panierItems = (W.panier || []).map(p => ({ nom: p.nom, quantite: p.quantite || 1, source: 'achat' }));
  W.equipement = [...panierItems, ...bgEquip];
  W.equipement_or_depart = Math.round(budgetRestant() * 100) / 100; // or restant = monnaie du perso
}

function renderPanier() {
  const el = document.getElementById('equip-panier');
  if (!el) return;
  if (!W.panier?.length) {
    el.innerHTML = '<div style="color:#555;font-size:0.78rem;font-style:italic;">Aucun item acheté.</div>';
    return;
  }
  el.innerHTML = W.panier.map(p => \`
    <div class="panier-row">
      <span class="panier-nom">\${esc(p.nom)}</span>
      <span class="panier-qte">×\${p.quantite}</span>
      <span class="panier-prix">\${Math.round(p.prix_po * p.quantite * 100) / 100} po</span>
      <button class="panier-remove" onclick="retirerPanier('\${esc(p.nom)}')" title="Retirer un">−</button>
    </div>\`).join('');
}

`;

c = c.slice(0, idx) + boutiqueFns + c.slice(idx);

fs.writeFileSync(file, c, 'utf8');
console.log('Done - boutique achat libre implemented');
