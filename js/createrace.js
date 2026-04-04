const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const target = tab.getAttribute('data-target');
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === target);
    });
  });
});

function toggleSection(checkboxId, sectionId) {
  const checkbox = document.getElementById(checkboxId);
  const section = document.getElementById(sectionId);

  if (!checkbox || !section) return;

  // Applique l'état correct au chargement
  const appliquerToggle = () => {
    section.style.display = checkbox.checked ? 'block' : 'none';
  };

  appliquerToggle(); // dès le chargement

  // Mets à jour dynamiquement quand l'utilisateur coche/décoche
  checkbox.addEventListener('change', appliquerToggle);
}

// Appliquer pour chaque couple
toggleSection('ability_score_fr', 'bonus_details_fr');
toggleSection('darkvision_fr', 'darkvision_details_fr');
toggleSection('show_weapon_section_fr', 'weapon_section_fr');
toggleSection('show_armor_section_fr', 'armor_section_fr');
toggleSection('show_damage_type_select_fr', 'damage_type_section_fr');
toggleSection('show_tools_section_fr', 'tools_section_fr');
toggleSection('show_languages_section_fr', 'languages_section_fr');
toggleSection('show_skills_section_fr', 'skills_section_fr');
toggleSection('fixed_skills_fr', 'fixed_skills_block_fr');
toggleSection('restrict_skill_choice_fr', 'restricted_skills_config_fr');
toggleSection('show_rp_traits_fr', 'rp_traits_section_fr');
toggleSection('show_condition_mastery_fr', 'condition_mastery_section_fr');
toggleSection('allow_language_choice_fr', 'language_choice_count_container_fr');
toggleSection('allow_skill_choice_fr', 'skill_choice_count_container_fr');
toggleSection('show_save_adv_magic_fr', 'save_adv_magic_section_fr');
toggleSection('show_racial_spells_fr', 'racial_spells_section_fr');
// toggleSection('show_custom_traits_fr', 'custom_traits_section_fr'); // remplacé par traits dynamiques




document.getElementById('add_rp_trait_fr').addEventListener('click', () => {
  const name = document.getElementById('rp_trait_name_fr').value.trim();
  const desc = document.getElementById('rp_trait_desc_fr').value.trim();
  const list = document.getElementById('rp_traits_list_fr');

  if (!name || !desc) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.traitName = name;
  item.dataset.traitDesc = desc;
  item.textContent = `${name} : ${desc}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);

  // reset les champs
  document.getElementById('rp_trait_name_fr').value = '';
  document.getElementById('rp_trait_desc_fr').value = '';
});

document.getElementById('add_weapon').addEventListener('click', () => {
  const select = document.getElementById('weapon_select');
  if (!select) {
    // Si le menu n'existe pas encore, on le génère
    genererMenuDeroulant();
    return;
  }

  const weaponName = select.value;
  if (weaponName) {
    const weaponList = document.getElementById('weapon_list');

    // Évite les doublons
    const exists = Array.from(weaponList.children).some(
      item => item.dataset.weapon === weaponName
    );
    if (exists) return;

    const item = document.createElement('div');
    item.classList.add('weapon-item');
    item.dataset.weapon = weaponName;
    item.textContent = weaponName;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '❌';
    removeBtn.classList.add('remove-weapon-btn');
    removeBtn.addEventListener('click', () => item.remove());

    item.appendChild(removeBtn);
    weaponList.appendChild(item);
  }
});

let toutesLesArmes = [];
let toutesLesArmures = [];
const bonusArmures = [];
let allDamageTypes = [];
const damageTraits = [];
let tousLesOutils = [];
let toutesLesLangues = [];
let toutesLesCompetences = [];
let toutesLesConditions = [];

async function chargerSortsRaciauxDepuisAPI() {
  try {
    const response = await fetch('/api/GetSpells2014');
    if (!response.ok) throw new Error('Erreur lors du chargement des sorts raciaux');

    const sorts = await response.json();
    chargerSortsPourSortsRaciaux(sorts);
  } catch (err) {
    console.error('❌ Erreur API sorts raciaux :', err);
  }
}

function chargerSortsPourSortsRaciaux(sorts) {
  const datalist = document.getElementById('racial_spell_list_fr');
  datalist.innerHTML = '';

  const noms = sorts
    .map(s => s.name?.fr || s.name?.en)
    .filter(Boolean)
    .sort();

  noms.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    datalist.appendChild(option);
  });
}

async function chargerLanguesDepuisAPI() {
  try {
    const response = await fetch('/api/GetLanguages');
    if (!response.ok) throw new Error('Erreur API langues');
    toutesLesLangues = await response.json();
    console.log('✅ Langues chargées :', toutesLesLangues);
    genererMenuLangues(); // 🟢 même logique que types de dégâts
  } catch (err) {
    console.error('❌ Erreur chargement langues :', err);
  }
}

async function chargerCompetencesDepuisAPI() {
  try {
    const response = await fetch('/api/GetSkills');
    if (!response.ok) throw new Error('Erreur API compétences');
    toutesLesCompetences = await response.json();
    console.log('✅ Compétences chargées :', toutesLesCompetences);
    genererMenuCompetences(); // 🟢 ici aussi
  } catch (err) {
    console.error('❌ Erreur chargement compétences :', err);
  }
}

function genererMenuLangues() {
  const select = document.getElementById('languages_select');
  select.innerHTML = '';

  toutesLesLangues
    .map(l => l.name.fr || l.name.en)
    .sort()
    .forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
}


function genererMenuCompetences() {
  const noms = toutesLesCompetences.map(c => c.name.fr || c.name.en).sort();

  const menus = ['skills_select', 'fixed_skills_select_fr', 'restricted_skills_select_fr'];
  menus.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = '';
    noms.forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
  });
}


async function chargerOutilsDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API outils');

    const data = await response.json();
    const outils = data.find(d => d.index === "tools")?.equipment || [];

    tousLesOutils = outils.map(o => ({
      nom: o.name?.fr || o.name?.en || o.index
    }));

    console.log('✅ Outils chargés :', tousLesOutils);
  } catch (err) {
    console.error('❌ Erreur lors du chargement des outils :', err);
  }
}

async function chargerTypesDegatsDepuisAPI() {
  try {
    const response = await fetch('/api/GetDamageTypes/');
    if (!response.ok) throw new Error("Erreur lors du chargement des types de dégâts");
    allDamageTypes = await response.json();

    console.log("✅ Types de dégâts chargés :", allDamageTypes);
    genererMenuDegats();
  } catch (err) {
    console.error("❌ Impossible de charger les types de dégâts :", err);
  }
}

function genererMenuDegats() {
  const select = document.getElementById('damage_type_select');
  select.innerHTML = '';

  allDamageTypes.forEach(type => {
    const option = document.createElement('option');
    option.value = type.index;
    option.textContent = type.name?.fr || type.name?.en || type.index;
    select.appendChild(option);
  });
}

async function chargerConditionsDepuisAPI() {
  try {
    const response = await fetch('/api/GetConditions2014');
    if (!response.ok) throw new Error('Erreur API conditions');
    toutesLesConditions = await response.json();
    console.log('✅ Conditions chargées :', toutesLesConditions);
    genererMenuConditions(); // 🟢 comme les dégâts
  } catch (err) {
    console.error('❌ Erreur chargement conditions :', err);
  }
}

function genererMenuConditions() {
  const select = document.getElementById('condition_select_fr');
  select.innerHTML = '';

  toutesLesConditions
    .map(c => c.name.fr || c.name.en)
    .sort()
    .forEach(nom => {
      const option = document.createElement('option');
      option.value = nom;
      option.textContent = nom;
      select.appendChild(option);
    });
}


async function chargerArmesDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API');

    const data = await response.json();
    const armes = data.find(d => d.index === "weapon")?.equipment || [];

    toutesLesArmes = armes.map(a => ({
      nom: a.name?.fr || a.name?.en || a.index
    }));

    console.log('✅ Armes chargées depuis la BDD :', toutesLesArmes);
  } catch (err) {
    console.error('❌ Erreur lors du chargement des armes :', err);
  }
}
window.genererMenuDeroulant = function genererMenuDeroulant() {
  const container = document.getElementById('weapon_dropdown_container');
  container.innerHTML = ''; // Vide le conteneur au cas où

  const nomsArmes = toutesLesArmes.map(a => a.nom).sort();

  const select = document.createElement('select');
  select.id = 'weapon_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsArmes.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}
async function chargerArmuresDepuisAPI() {
  try {
    const response = await fetch('/api/GetCategories/');
    if (!response.ok) throw new Error('Erreur API armures');

    const data = await response.json();
    const armures = data.find(d => d.index === "armor")?.equipment || [];

    toutesLesArmures = armures.map(a => ({
      nom: a.name?.fr || a.name?.en || a.index
    }));

    console.log('✅ Armures chargées :', toutesLesArmures);
  } catch (err) {
    console.error('❌ Erreur chargement armures :', err);
  }
}
function genererMenuDeroulantArmures() {
  const container = document.getElementById('armor_dropdown_container');
  container.innerHTML = '';

  const nomsArmures = toutesLesArmures.map(a => a.nom).sort();

  const select = document.createElement('select');
  select.id = 'armor_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsArmures.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}
async function chargerTraitsRaciaux() {
  try {
    const r = await fetch('/api/GetTraitsRaciaux2024');
    const traits = await r.json();
    genererCheckboxesTraits(traits);
  } catch (err) {
    console.error('❌ Erreur chargement traits raciaux :', err);
  }
}

function genererCheckboxesTraits(traits) {
  const container = document.getElementById('traits_raciaux_dynamiques');
  if (!container) return;
  container.innerHTML = traits.map(t => `
    <label style="display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.5rem;cursor:pointer;">
      <input type="checkbox" class="trait-racial-check" id="trait_${t.id}" data-id="${t.id}" style="margin-top:0.15rem;accent-color:#865dff;flex-shrink:0;" />
      <span>
        <strong style="color:#d5d1a9;font-size:0.85rem;">${t.nom}</strong>
        <span style="font-size:0.75rem;color:#aaa;margin-left:0.4rem;">(${t.espece})</span>
        <br><span style="font-size:0.75rem;color:#aaa;">${t.description}</span>
      </span>
    </label>
  `).join('');
}

document.addEventListener("DOMContentLoaded", async function () {
  // Chargement dynamique
  await chargerArmesDepuisAPI();
  await chargerArmuresDepuisAPI();
  await chargerCaracteristiques();
  await chargerTypesDegatsDepuisAPI();
  await chargerOutilsDepuisAPI();
  await chargerLanguesDepuisAPI();
  await chargerCompetencesDepuisAPI();
  await chargerConditionsDepuisAPI();
  await chargerSortsRaciauxDepuisAPI();
  await chargerTraitsRaciaux();

  // Forcer affichage des menus au chargement
  genererMenuDeroulant();
  genererMenuDeroulantArmures();
  genererMenuDeroulantOutils();
  genererMenuLangues();
  genererMenuCompetences();
  genererMenuConditions();

  
  // Cacher le menu déroulant de caractéristiques si "Appliquer à toutes" est coché
  const applyCheckbox = document.getElementById('apply_to_all_stats');
  const selectStat = document.getElementById('select_stat_group');
  applyCheckbox.addEventListener('change', () => {
    selectStat.style.display = applyCheckbox.checked ? 'none' : 'block';
  });
});

document.getElementById('add_armor').addEventListener('click', () => {
  const select = document.getElementById('armor_select');
  if (select) {
    const nom = select.value;
    if (nom) ajouterArmure(nom);
  }
});

function convertirVirguleEnPoint(id) {
  const el = document.getElementById(id);
  if (el) el.value = el.value.replace(',', '.');
}

function checked(id) {
  return document.getElementById(id)?.checked || false;
}

function collecterDonnees() {
  // Bonus de stats
  const ability_scores = bonusStats.map(s => ({ stat: s.index, bonus: s.value }));

  // Armes
  const weapon_categories = Array.from(document.querySelectorAll('input[name="catégorie"]:checked')).map(cb => cb.value);
  const weapon_list = Array.from(document.querySelectorAll('#weapon_list .weapon-item')).map(d => d.dataset.weapon);

  // Armures
  const armor_categories = Array.from(document.querySelectorAll('input[name="catégorie_armure"]:checked')).map(cb => cb.value);
  const armor_list = Array.from(document.querySelectorAll('#armor_list .weapon-item')).map(d => d.dataset.armor);

  // Outils
  const tools_list = Array.from(document.querySelectorAll('#tools_list .weapon-item')).map(d => d.dataset.tool || d.textContent.replace('❌', '').trim());

  // Langues
  const languages = Array.from(document.querySelectorAll('#languages_list .weapon-item')).map(d => d.dataset.langue);

  // Compétences fixes
  const fixed_skills = Array.from(document.querySelectorAll('#fixed_skills_list_fr .weapon-item')).map(d => d.dataset.skill);

  // Compétences restreintes
  const restricted_skills = Array.from(document.querySelectorAll('#restricted_skills_list_fr .weapon-item')).map(d => d.dataset.skill);

  // Sorts raciaux
  const racial_spells = Array.from(document.querySelectorAll('#racial_spells_list_fr .weapon-item')).map(d => ({
    nom: d.dataset.spell,
    niveau: parseInt(d.dataset.level) || 1,
    frequence: d.dataset.freq || 'at_will',
  }));

  // Résistances dégâts
  const damage_traits = Array.from(document.querySelectorAll('#damage_trait_list .weapon-item')).map(d => ({
    type: d.dataset.type,
    resistance: d.dataset.resistance === 'true',
    immunity: d.dataset.immunity === 'true',
    advantage: d.dataset.advantage === 'true',
  }));

  // Maîtrises d'état
  const condition_masteries = Array.from(document.querySelectorAll('#condition_mastery_list .weapon-item')).map(d => ({
    condition: d.dataset.condition,
    type: d.dataset.type,
  }));

  // Traits RP
  const rp_traits = Array.from(document.querySelectorAll('#rp_traits_list_fr .weapon-item')).map(d => ({
    nom: d.dataset.traitName,
    description: d.dataset.traitDesc,
  }));

  // Avantage JS magie
  const save_adv_magic = checked('show_save_adv_magic_fr') ? {
    str: checked('save_adv_str_fr'),
    dex: checked('save_adv_dex_fr'),
    con: checked('save_adv_con_fr'),
    int: checked('save_adv_int_fr'),
    wis: checked('save_adv_wis_fr'),
    cha: checked('save_adv_cha_fr'),
  } : null;

  // Traits raciaux prédéfinis (cochés dynamiquement depuis l'API)
  const traits_raciaux_selectionnes = Array.from(
    document.querySelectorAll('#traits_raciaux_dynamiques .trait-racial-check:checked')
  ).map(cb => cb.dataset.id);

  return {
    nom: document.getElementById('name_fr')?.value.trim(),
    version: document.getElementById('version_fr')?.value,
    type_creature: document.getElementById('typeSelect')?.value,
    famille: checked('hasFamilleCheckbox') ? document.getElementById('familleInput')?.value.trim() : null,
    vitesse: parseFloat(document.getElementById('speed_fr')?.value) || null,
    taille: {
      code: document.getElementById('size_code_fr')?.value,
      description: document.getElementById('size_description_fr')?.value.trim(),
    },
    alignement: document.getElementById('alignment_fr')?.value.trim(),
    age: document.getElementById('age_fr')?.value.trim(),
    darkvision: checked('darkvision_fr') ? parseInt(document.getElementById('darkvision_distance_fr')?.value) || 18 : null,
    initiative_bonus: checked('initiative_bonus_fr'),
    ability_scores: checked('ability_score_fr') ? ability_scores : [],
    maitrise_armes: checked('show_weapon_section_fr') ? {
      nom: document.getElementById('weapon_name')?.value.trim(),
      categories: weapon_categories,
      armes: weapon_list,
    } : null,
    maitrise_armures: checked('show_armor_section_fr') ? {
      nom: document.getElementById('armor_name')?.value.trim(),
      categories: armor_categories,
      armures: armor_list,
    } : null,
    maitrise_outils: checked('show_tools_section_fr') ? {
      nom: document.getElementById('tools_name')?.value.trim(),
      outils: tools_list,
    } : null,
    sorts_raciaux: checked('show_racial_spells_fr') ? racial_spells : [],
    ascendance_draconique: checked('draconic_ancestry_fr'),
    manifestation_divine: checked('divine_manifestation_fr'),
    manifestation_saisonniere: checked('seasonal_manifestation_fr'),
    langues: checked('show_languages_section_fr') ? {
      fixes: languages,
      choix_libre: checked('allow_language_choice_fr'),
      nb_choix: parseInt(document.getElementById('language_choice_count_fr')?.value) || 0,
    } : null,
    competences: checked('show_skills_section_fr') ? {
      fixes: fixed_skills,
      choix_libre: checked('allow_skill_choice_fr'),
      nb_choix: parseInt(document.getElementById('skill_choice_count_fr')?.value) || 0,
      liste_restreinte: checked('restrict_skill_choice_fr') ? restricted_skills : [],
      nb_choix_restreint: parseInt(document.getElementById('restricted_skill_choice_count_fr')?.value) || 0,
    } : null,
    maitrise_etats: checked('show_condition_mastery_fr') ? condition_masteries : [],
    avantage_js_magie: save_adv_magic,
    resistances_degats: checked('show_damage_type_select_fr') ? damage_traits : [],
    traits_raciaux: traits_raciaux_selectionnes,
    traits_rp: checked('show_rp_traits_fr') ? rp_traits : [],
    statut: 'draft',
  };
}

document.getElementById('raceForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  convertirVirguleEnPoint('speed_fr');

  const data = collecterDonnees();
  if (!data.nom) { alert('Le nom de la race est obligatoire.'); return; }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Envoi…';

  try {
    const r = await fetch('/api/Races', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
    const result = await r.json();
    alert(`Race "${data.nom}" créée avec succès (id: ${result._id})`);
    e.target.reset();
  } catch (err) {
    alert('Erreur : ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer la race';
  }
});

/**
 * Récupère les armes sélectionnées par catégorie ET par nom
 * Retourne un objet avec deux tableaux : categories[] et armes[]
 */
function getArmesSelectionnees() {
  // Catégories cochées
  const categories = Array.from(document.querySelectorAll('input[name="catégorie"]:checked'))
    .map(cb => cb.value);

  // Armes précises ajoutées
  const armes = Array.from(document.querySelectorAll('#weapon_list .weapon-item'))
    .map(div => div.dataset.weapon);

  return { categories, armes };
}
function ajouterArmure(nom) {
  const armorList = document.getElementById('armor_list');

  const exists = Array.from(armorList.children).some(
    item => item.dataset.armor === nom
  );
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.armor = nom;
  item.textContent = nom;

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '❌';
  removeBtn.classList.add('remove-weapon-btn');
  removeBtn.addEventListener('click', () => item.remove());

  item.appendChild(removeBtn);
  armorList.appendChild(item);

  bonusArmures.push(nom);
}
// Stocke les bonus ajoutés
const bonusStats = [];

async function chargerCaracteristiques() {
  try {
    const res = await fetch('/api/GetStats');
    if (!res.ok) throw new Error('Erreur API GetStats');
    const stats = await res.json();

    const select = document.getElementById('select_stat');
    select.innerHTML = ''; // Vide d’abord

    stats.forEach(stat => {
      const option = document.createElement('option');
      option.value = stat.index;
      option.textContent = stat.name.toUpperCase();
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erreur chargement caractéristiques:', err);
  }
}

function ajouterBonusStat(index, name, value) {
  // Empêche les doublons
  const alreadyExists = bonusStats.some(item => item.index === index);
  if (alreadyExists) return;

  const statList = document.getElementById('stat_bonus_list');

  const div = document.createElement('div');
  div.className = 'stat-item';
  div.dataset.stat = index;

  const span = document.createElement('span');
  span.textContent = `${name.toUpperCase()} +${value}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.className = 'remove-stat-btn';
  btn.onclick = () => {
    div.remove();
    const i = bonusStats.findIndex(s => s.index === index);
    if (i !== -1) bonusStats.splice(i, 1);
  };

  div.appendChild(span);
  div.appendChild(btn);
  statList.appendChild(div);

  bonusStats.push({ index, value });
}

document.getElementById('add_condition_mastery').addEventListener('click', () => {
  const condition = document.getElementById('condition_select_fr').value;
  const type = document.getElementById('condition_type_fr').value;
  const list = document.getElementById('condition_mastery_list');

  if (!condition || !type) return;

  // Empêche les doublons exacts
  const exists = Array.from(list.children).some(item =>
    item.dataset.condition === condition && item.dataset.type === type
  );
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.condition = condition;
  item.dataset.type = type;

  item.textContent = `${condition} – ${labelConditionTypeFr(type)}`;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

function labelConditionTypeFr(type) {
  switch (type) {
    case 'advantage': return 'Avantage au jet';
    case 'resistance': return 'Résistance';
    case 'immunity': return 'Immunité';
    default: return type;
  }
}


document.getElementById('add_stat_bonus').addEventListener('click', async () => {
  const value = parseInt(document.getElementById('stat_bonus_value').value);
  if (isNaN(value) || value < 1) return;

  const applyToAll = document.getElementById('apply_to_all_stats').checked;

  const select = document.getElementById('select_stat');
  const selectedIndex = select.value;
  const selectedText = select.options[select.selectedIndex].text;

  if (applyToAll) {
    const allOptions = Array.from(select.options);
    allOptions.forEach(opt => {
      ajouterBonusStat(opt.value, opt.textContent, value);
    });
  } else {
    ajouterBonusStat(selectedIndex, selectedText, value);
  }
});

function genererMenuDeroulantOutils() {
  const container = document.getElementById('tools_dropdown_container');
  container.innerHTML = '';

  const nomsOutils = tousLesOutils.map(o => o.nom).sort();

  const select = document.createElement('select');
  select.id = 'tools_select';
  select.classList.add('dropdown-style');
  select.style.width = 'auto';

  nomsOutils.forEach(nom => {
    const option = document.createElement('option');
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  });

  container.appendChild(select);
}

document.getElementById('add_language').addEventListener('click', () => {
  const select = document.getElementById('languages_select');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('languages_list');
  const exists = Array.from(list.children).some(item => item.dataset.langue === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.langue = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});


document.getElementById('add_fixed_skill_fr').addEventListener('click', () => {
  const select = document.getElementById('fixed_skills_select_fr');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('fixed_skills_list_fr');
  const exists = Array.from(list.children).some(item => item.dataset.skill === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.skill = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});

document.getElementById('add_restricted_skill_fr').addEventListener('click', () => {
  const select = document.getElementById('restricted_skills_select_fr');
  const nom = select?.value;
  if (!nom) return;

  const list = document.getElementById('restricted_skills_list_fr');
  const exists = Array.from(list.children).some(item => item.dataset.skill === nom);
  if (exists) return;

  const item = document.createElement('div');
  item.classList.add('weapon-item');
  item.dataset.skill = nom;
  item.textContent = nom;

  const btn = document.createElement('button');
  btn.textContent = '❌';
  btn.classList.add('remove-weapon-btn');
  btn.addEventListener('click', () => item.remove());

  item.appendChild(btn);
  list.appendChild(item);
});
