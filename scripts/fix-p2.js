// P2 - Corrections creerPersonnage + équipement A/B/C + validateCharacter
const fs   = require('fs');
const path = require('path');
const file = path.join(__dirname, '../js/creer-personnage.js');
let c = fs.readFileSync(file, 'utf8');

// ── 1. Corriger creerPersonnage : getCasterKey() + getCaracIncantation avec sc_data ──
const OLD_SORTS_FLATTEN = `  // Sorts — flatten sorts_choisis par niveau
  const tousNiveauxSorts = [0, ...getNiveauxSortsDisponibles(W.classe, niv)];`;
const NEW_SORTS_FLATTEN = `  // Sorts — flatten sorts_choisis par niveau
  const _casterKey = getCasterKey();
  const tousNiveauxSorts = [0, ...getNiveauxSortsDisponibles(_casterKey, niv)];`;
if (c.indexOf(OLD_SORTS_FLATTEN) === -1) { console.error('sorts flatten not found'); process.exit(1); }
c = c.replace(OLD_SORTS_FLATTEN, NEW_SORTS_FLATTEN);

const OLD_CARINC = `  const carIncant = getCaracIncantation(W.classe_data);`;
const NEW_CARINC = `  const carIncant = getCaracIncantation(W.classe_data, W.sc_data);`;
if (c.indexOf(OLD_CARINC) === -1) { console.error('carIncant not found'); process.exit(1); }
c = c.replace(OLD_CARINC, NEW_CARINC);

const OLD_SLOTS = `        ? getSlotsEmplacements(W.classe, niv)`;
const NEW_SLOTS = `        ? getSlotsEmplacements(_casterKey, niv)`;
if (c.indexOf(OLD_SLOTS) === -1) { console.error('getSlotsEmplacements not found'); process.exit(1); }
c = c.replace(OLD_SLOTS, NEW_SLOTS);

// ── 2. Remplacer renderEquipement : choix A/B/C avec radio buttons ──────────
const OLD_RENDER_EQUIP = `function renderEquipement() {
  const list = document.getElementById('equip-list');
  const classeEquip = W.classe_data?.equipement_depart || [];
  const bgEquip = W.bg_data?.equipement || [];
  const items = [];

  // Équipement de la classe (premier choix A)
  const choixA = classeEquip.find(c => c.choix === 'A');
  if (choixA) {
    (choixA.contenu || []).forEach(nom => {
      items.push({ nom, qte: 1, source: 'classe' });
    });
  }
  // Équipement du background
  bgEquip.forEach(e => {
    items.push({ nom: e.nom, qte: e.quantite || 1, source: 'bg' });
  });

  const checkedNoms = W.equipement.map(e => e.nom);
  list.innerHTML = items.map((it, i) => \`
    <div class="equip-row">
      <input type="checkbox" class="equip-check" data-nom="\${esc(it.nom)}" data-qte="\${it.qte}"
             \${checkedNoms.includes(it.nom) || checkedNoms.length === 0 ? 'checked' : ''} />
      <span class="equip-nom">\${esc(it.nom)}</span>
      <span class="equip-qte">×\${it.qte}</span>
      <span class="equip-source \${it.source}">\${it.source === 'classe' ? 'Classe' : 'Historique'}</span>
    </div>\`).join('');

  // Items déjà ajoutés manuellement
  W.equipement.filter(e => !items.some(i => i.nom === e.nom)).forEach(e => {
    const row = document.createElement('div');
    row.className = 'equip-row';
    row.innerHTML = \`
      <input type="checkbox" class="equip-check" data-nom="\${esc(e.nom)}" data-qte="\${e.quantite||1}" checked />
      <span class="equip-nom">\${esc(e.nom)}</span>
      <span class="equip-qte">×\${e.quantite||1}</span>
      <span class="equip-source" style="color:#888;">Manuel</span>\`;
    list.appendChild(row);
  });
}`;

const NEW_RENDER_EQUIP = `function renderEquipement() {
  const container = document.getElementById('equip-list');
  const classeEquip = W.classe_data?.equipement_depart || [];
  const bgEquip = W.bg_data?.equipement || [];

  let html = '';

  // ── Choix d'équipement de la classe (A / B / C) ──
  if (classeEquip.length > 0) {
    html += '<div style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin-bottom:0.5rem;">Équipement de classe — choisissez une option :</div>';
    classeEquip.forEach(opt => {
      const selected = W.equipement_choix_classe === opt.choix;
      html += \`<label class="equip-choix-row\${selected ? ' selected' : ''}" onclick="selectEquipChoix('\${opt.choix}')">
        <input type="radio" name="equip-classe" value="\${opt.choix}" \${selected ? 'checked' : ''}
               onchange="selectEquipChoix('\${opt.choix}')" style="margin-right:0.5rem;" />
        <span style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin-right:0.5rem;">Option \${opt.choix}</span>
        <span style="font-size:0.78rem;color:#ddd;">\${(opt.contenu || []).join(', ')}</span>
      </label>\`;
    });
    html += '<div style="height:0.8rem;"></div>';
  }

  // ── Équipement du background (fixe) ──
  if (bgEquip.length > 0) {
    html += '<div style="font-size:0.78rem;color:#c9a84c;font-weight:600;margin-bottom:0.4rem;">Équipement d\'historique :</div>';
    bgEquip.forEach(e => {
      html += \`<div class="equip-row">
        <span class="equip-nom">\${esc(e.nom)}</span>
        <span class="equip-qte">×\${e.quantite || 1}</span>
        <span class="equip-source bg">Historique</span>
      </div>\`;
    });
  }

  container.innerHTML = html;

  // Sélectionner le premier choix par défaut si rien choisi
  if (!W.equipement_choix_classe && classeEquip.length > 0) {
    selectEquipChoix(classeEquip[0].choix);
  }
}

function selectEquipChoix(choix) {
  W.equipement_choix_classe = choix;
  const classeEquip = W.classe_data?.equipement_depart || [];
  const opt = classeEquip.find(o => o.choix === choix);

  // Mettre à jour visuellement les labels
  document.querySelectorAll('.equip-choix-row').forEach(el => {
    el.classList.toggle('selected', el.querySelector('input')?.value === choix);
  });
  const radio = document.querySelector(\`input[name="equip-classe"][value="\${choix}"]\`);
  if (radio) radio.checked = true;

  // Mettre à jour W.equipement avec le contenu du choix sélectionné
  const bgEquip = W.bg_data?.equipement || [];
  W.equipement = [];

  // Vérifier si c'est un choix "or uniquement" (contient uniquement des entrées en "po")
  const contenu = opt?.contenu || [];
  contenu.forEach(nom => {
    const poMatch = String(nom).match(/^(\\d+)\\s*po$/i);
    if (poMatch) {
      // C'est de l'or — stocker séparément
      W.equipement_or_depart = parseInt(poMatch[1]);
    } else {
      W.equipement.push({ nom, quantite: 1, source: 'classe' });
    }
  });

  // Ajouter l'équipement du background
  bgEquip.forEach(e => {
    W.equipement.push({ nom: e.nom, quantite: e.quantite || 1, source: 'bg' });
  });
}`;

if (c.indexOf(OLD_RENDER_EQUIP) === -1) { console.error('renderEquipement not found'); process.exit(1); }
c = c.replace(OLD_RENDER_EQUIP, NEW_RENDER_EQUIP);

// ── 3. Mettre à jour collectStep(8) pour ne plus lire les checkboxes ────────
const OLD_COLLECT8 = `    W.equipement = [...document.querySelectorAll('.equip-check:checked')].map(el => ({`;
if (c.indexOf(OLD_COLLECT8) !== -1) {
  // Trouver le bloc complet et le remplacer
  const idxStart = c.indexOf('    W.equipement = [...document.querySelectorAll(\'.equip-check:checked\')]');
  const idxEnd   = c.indexOf('\n', c.indexOf('})', idxStart)) + 1;
  const oldBlock = c.slice(idxStart, idxEnd);
  // On n'a plus besoin de collecter depuis les checkboxes — renderEquipement gère W.equipement directement
  c = c.slice(0, idxStart) + '    // W.equipement est maintenu en temps réel par selectEquipChoix()\n' + c.slice(idxEnd);
  console.log('Replaced collectStep(8) equipement');
} else {
  console.warn('collectStep(8) equipement not found');
}

// ── 4. Mettre à jour W initial : ajouter equipement_choix_classe + equipement_or_depart ──
const OLD_WINIT_EQUIP = `  equipement: [],`;
const NEW_WINIT_EQUIP = `  equipement: [],
  equipement_choix_classe: null,
  equipement_or_depart: 0,`;
if (c.indexOf(OLD_WINIT_EQUIP) === -1) { console.error('W.equipement init not found'); process.exit(1); }
c = c.replace(OLD_WINIT_EQUIP, NEW_WINIT_EQUIP);

// ── 5. Dans creerPersonnage : créditer l'or de départ dans monnaie ──────────
const OLD_MONNAIE = `    monnaie: { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 },`;
const NEW_MONNAIE = `    monnaie: { pp: 0, po: W.equipement_or_depart || 0, pe: 0, pa: 0, pc: 0 },`;
if (c.indexOf(OLD_MONNAIE) === -1) { console.error('monnaie not found'); process.exit(1); }
c = c.replace(OLD_MONNAIE, NEW_MONNAIE);

// ── 6. Ajouter validateCharacter() avant creerPersonnage ──────────────────
const BEFORE_CREER = 'async function creerPersonnage() {';
const idx = c.indexOf(BEFORE_CREER);
if (idx === -1) { console.error('creerPersonnage not found'); process.exit(1); }

const validateFn = `function validateCharacter() {
  // 1. Nom
  if (!W.nom?.trim()) { alert('Le nom du personnage est obligatoire.'); return false; }
  // 2. Espèce
  if (!W.espece) { alert('Sélectionnez une espèce.'); return false; }
  if ((W.espece_data?.variantes || []).length > 0 && !W.espece_variante) {
    alert('Sélectionnez un lignage pour votre espèce.'); return false;
  }
  // 3. Classe
  if (!W.classe) { alert('Sélectionnez une classe.'); return false; }
  // 4. Sous-classe obligatoire si niveau requis
  const unlock = getNiveauSousClasse(W.classe_data);
  if ((W.niveau || 1) >= unlock && !W.sous_classe) {
    alert('Sélectionnez une sous-classe (obligatoire à partir du niveau ' + unlock + ').'); return false;
  }
  // 5. Background
  if (!W.background) { alert('Sélectionnez un historique.'); return false; }
  if (!bgBonusIsValid()) { alert('Répartissez les bonus de caractéristiques du background.'); return false; }
  // 6. Stats
  if (W.stats_method === 'standard') {
    if (!STAT_KEYS.every(k => W.stats_assigned[k] !== null)) {
      alert('Distribuez toutes les valeurs standard.'); return false;
    }
  } else if (W.stats_method === 'pointbuy') {
    if (pbTotalSpent() !== PB_BUDGET) {
      alert('Dépensez exactement ' + PB_BUDGET + ' points.'); return false;
    }
  } else if (!W.stats_method) {
    alert('Choisissez une méthode d\'attribution des caractéristiques.'); return false;
  }
  // 7. PV
  if (!pvAllSet()) { alert('Choisissez les points de vie pour chaque niveau.'); return false; }
  // 8. Compétences
  const nSlots = getExpertiseSlots(W.classe, W.niveau);
  if (nSlots > 0 && W.competences_expertise.length < nSlots) {
    alert('Choisissez ' + nSlots + ' compétence(s) pour l\'Expertise.'); return false;
  }
  // 9. Sorts (si lanceur)
  if (isCaster(W.classe_data, W.sc_data)) {
    const _ck = getCasterKey();
    const nbC = (MAGIE_CANTRIPS[_ck] !== undefined) ? getNbCantrips(_ck, W.niveau) : 0;
    if (nbC > 0 && (W.sorts_choisis[0] || []).length < nbC) {
      alert('Choisissez ' + nbC + ' sort(s) mineur(s).'); return false;
    }
    const niveauxS = getNiveauxSortsDisponibles(_ck, W.niveau);
    if (niveauxS.length > 0) {
      const mode = MAGIE_MODE[_ck] || '';
      let cible = 0;
      if (mode === 'connus')   cible = getNbSortsConnus(_ck, W.niveau);
      if (mode === 'prepares') cible = Math.max(0, getNbSortsPrepares(_ck, W.niveau, finalStats()));
      if (cible > 0) {
        const total = niveauxS.reduce((acc, nv) => acc + (W.sorts_choisis[nv]?.length || 0), 0);
        if (total < cible) {
          const label = mode === 'connus' ? 'connus' : 'préparés';
          alert('Choisissez ' + cible + ' sort(s) ' + label + '. (' + total + '/' + cible + ')'); return false;
        }
      }
    }
  }
  // 10. Équipement : un choix de classe doit être fait
  if ((W.classe_data?.equipement_depart || []).length > 0 && !W.equipement_choix_classe) {
    alert('Choisissez une option d\'équipement pour votre classe.'); return false;
  }
  return true;
}

`;

c = c.slice(0, idx) + validateFn + c.slice(idx);

// ── 7. Appeler validateCharacter() au début de creerPersonnage ──────────────
const OLD_CREER_START = `async function creerPersonnage() {
  collectStep(W.step);`;
const NEW_CREER_START = `async function creerPersonnage() {
  collectStep(W.step);
  if (!validateCharacter()) return;`;
if (c.indexOf(OLD_CREER_START) === -1) { console.error('creerPersonnage start not found'); process.exit(1); }
c = c.replace(OLD_CREER_START, NEW_CREER_START);

fs.writeFileSync(file, c, 'utf8');
console.log('Done - P2 corrections applied');
