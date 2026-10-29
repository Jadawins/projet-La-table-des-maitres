import {CURRENT_RULES_VERSION,usesCurrentRules,upgradedCharacterCopy} from './character-version.mjs';
import {backgroundAbilities,backgroundBonuses,finalScores,modifier,visibleSteps,classProfile,clericProfile,pruneSpellChoices,spellErrors,classSkills,hitPoints,aptitudeErrors} from './character-rules.mjs';
import {renderSheet} from './sheet-view.mjs';
import {detailFields} from './sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from './character-storage.mjs';
import {ADVANCEMENT_LEVELS,ORIGIN_SLOTS,advancementInitial,evaluateProgression,featAbilityOptions,sacredChoices} from './cleric-progression.mjs';
import {grantInitial,backgroundFeat,humanFeats,originFeats,originSizeOptions,selectedVariant,speciesSkillOptions,originSkills,originTools,backgroundToolOptions,grantOptions,magicFeatLists,magicFeatProfile,grantedOriginSpells,originBonuses,reconcileOrigins,originErrors,speciesChoiceSpecs,backgroundEquipmentErrors,backgroundKitOptions,backgroundItemName} from './origin-rules.mjs';

import {featChoicesInitial,featChoiceSpecs} from './feat-effects.mjs';

import {classChoiceSpecs} from './class-profiles.mjs';
import {reconcilePrimalDamage} from './beast-companion.mjs';

const root = document.getElementById('content');
let printClosed=[];
window.addEventListener('beforeprint',()=>{
  printClosed=[...root.querySelectorAll('.paper-panel details:not([open])')];
  printClosed.forEach(el=>el.open=true);
});
window.addEventListener('afterprint',()=>{printClosed.forEach(el=>el.open=false);printClosed=[];});
const labels = ['Identité', 'Classe', 'Origines', 'Caractéristiques', 'Aptitudes', 'Sorts', 'Équipement', 'Récapitulatif'];
const stats = ['FOR', 'DEX', 'CON', 'INT', 'SAG', 'CHA'];
const accountId=document.querySelector('meta[name="refonte-user"]')?.content;
const draftKey = accountId?`table-maitre-refonte-maquette-v1:${accountId}`:'table-maitre-refonte-maquette-v1';
if(accountId){
  const tag=document.querySelector('.preview-tag');
  if(tag){tag.textContent='Espace refonte';const logout=document.createElement('button');logout.className='button quiet';logout.type='button';logout.textContent='Se déconnecter';logout.addEventListener('click',async()=>{logout.disabled=true;try{const response=await fetch('/auth/logout',{method:'POST'});if(!response.ok)throw new Error();location.replace('/');}catch{logout.disabled=false;toast('Déconnexion impossible. Réessayez.');}});tag.append(logout);}
}
const initial = () => ({schemaVersion:2,rulesVersion:CURRENT_RULES_VERSION,name:'',level:1,classId:'',speciesId:'',backgroundId:'',statsMethod:'physical',scores:Object.fromEntries(stats.map(s=>[s,null])),rolls:[],equipment:'',backgroundEquipment:'',backgroundKit:'',step:0,bonusMode:'',bonusTwo:'',bonusOne:'',divineOrder:'',subclassId:'',classSkills:[],cantrips:[],prepared:[],hpMode:'fixed',hpRolls:{},variantId:'',speciesSize:'',speciesSkill:'',speciesAncestry:'',speciesCastingAbility:'',speciesCantrip:'',originFeatId:'',backgroundTool:'',sacredStrike:'',advancements:{},classChoices:{},originGrants:{background:grantInitial(),human:grantInitial()}});
const icons = { barbare: '⚒', barde: '♫', clerc: '✥', druide: '❧', ensorceleur: '✴', guerrier: '⚔', magicien: '✧', moine: '☯', occultiste: '☾', paladin: '♜', rodeur: '➶', roublard: '◇' };
const descriptions = { barbare: 'La force à l’état brut.', barde: 'Le pouvoir des mots et de la musique.', clerc: 'Une vocation guidée par la foi.', druide: 'Une alliance avec le monde naturel.', ensorceleur: 'Une magie qui vient de l’intérieur.', guerrier: 'Votre arme, votre discipline.', magicien: 'L’étude ouvre toutes les portes.', moine: 'Le corps et l’esprit à l’unisson.', occultiste: 'Un pacte, un pouvoir, un prix.', paladin: 'Un serment pour guider vos pas.', rodeur: 'À l’aise au-delà des sentiers.', roublard: 'Toujours un coup d’avance.' };
let catalogue;
let draft = initial();
let storageAvailable = true;
let timer;
let beforeSuggestion = null;
let suggestionFocus = null;
let spellSearch = '';
let activeSheetTab='overview';
let cloudCharacters=[],cloudLoading=false,cloudError='',cloudSaveError='',cloudBusy=false;
let openingSequence=0;
const localCharactersKey=draftKey+':personnages';
const snapshotStamp=person=>JSON.stringify(characterSnapshot(person));
const isDirty=person=>{
  if(!person.cloudRevision||!person.cloudSnapshot)return true;
  try{const current=characterSnapshot(person),saved=characterSnapshot(JSON.parse(person.cloudSnapshot));delete current.step;delete saved.step;return JSON.stringify(current)!==JSON.stringify(saved);}catch{return true;}
};
function localCharacters(){try{const records=JSON.parse(localStorage.getItem(localCharactersKey)||'{}');return records&&typeof records==='object'&&!Array.isArray(records)?records:{};}catch{return {};}}
try {
  const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
  if (saved && typeof saved === 'object') {
    draft.rulesVersion=typeof saved.rulesVersion==='string'?saved.rulesVersion:null;
    for (const key of ['name','classId','speciesId','backgroundId','equipment','backgroundKit','backgroundEquipment','bonusMode','bonusTwo','bonusOne','divineOrder','subclassId','hpMode','variantId','speciesSize','speciesSkill','speciesAncestry','speciesCastingAbility','speciesCantrip','originFeatId','backgroundTool','sacredStrike']) if (typeof saved[key] === 'string') draft[key] = saved[key].slice(0, 100);
    if(typeof saved.cloudId==='string'&&/^[0-9a-f-]{36}$/i.test(saved.cloudId))draft.cloudId=saved.cloudId;
    if(Number.isInteger(saved.cloudRevision)&&saved.cloudRevision>=0)draft.cloudRevision=saved.cloudRevision;
    for(const key of ['cloudUpdatedAt','cloudSnapshot'])if(typeof saved[key]==='string')draft[key]=saved[key].slice(0,key==='cloudSnapshot'?131072:100);
    for(const level of Object.keys(saved.advancements||{}).filter(n=>/^(?:[1-9]|1\d|20)$/.test(n))){
      const raw=saved.advancements?.[level];if(!raw||typeof raw!=='object')continue;
      const choice=advancementInitial();if(['','ability','feat'].includes(raw.mode))choice.mode=raw.mode;
      if(Array.isArray(raw.abilities))choice.abilities=raw.abilities.filter(a=>a===''||stats.includes(a)).slice(0,2);
      for(const key of ['featId','featAbility','notes'])if(typeof raw[key]==='string')choice[key]=raw[key].slice(0,key==='notes'?6000:150);
      choice.choices={...featChoicesInitial(),...raw.choices};
      draft.advancements[level]=choice;
    }
    draft.classChoices={};for(const [key,values]of Object.entries(saved.classChoices||{}))if(/^[a-zA-Z][a-zA-Z0-9_]{0,60}$/.test(key)&&Array.isArray(values))draft.classChoices[key]=values.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.slice(0,150)).slice(0,200);
    draft.details={};
    for(const key of Object.keys(detailFields)) if(typeof saved.details?.[key]==='string') draft.details[key]=saved.details[key].slice(0,6000);
    for(const slot of ORIGIN_SLOTS) {
      draft.originGrants[slot]=grantInitial();
      const raw=saved.originGrants?.[slot];if(!raw||typeof raw!=='object') continue;
      for(const field of ['magicList','magicAbility','spell']) if(typeof raw[field]==='string') draft.originGrants[slot][field]=raw[field].slice(0,100);
      for(const field of ['proficiencies','cantrips']) if(Array.isArray(raw[field])) draft.originGrants[slot][field]=[...new Set(raw[field].filter(value=>typeof value==='string').map(value=>value.slice(0,150)))].slice(0,field==='cantrips'?2:3);
    }
    for (const key of ['classSkills','cantrips','prepared']) if (Array.isArray(saved[key])) draft[key] = [...new Set(saved[key].filter(v=>typeof v==='string').map(v=>v.slice(0,100)))].slice(0,40);
    if (saved.hpRolls && typeof saved.hpRolls === 'object') draft.hpRolls = Object.fromEntries(Object.entries(saved.hpRolls).filter(([level,value])=>Number(level)>=2&&Number(level)<=20&&Number.isInteger(value)&&value>=1&&value<=12));
    if (!['fixed','physical','virtual'].includes(draft.hpMode)) draft.hpMode='fixed';
    if (Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 20) draft.level = saved.level;
    if (['physical', 'virtual', 'standard'].includes(saved.statsMethod)) draft.statsMethod = saved.statsMethod;
    else draft.statsMethod = 'standard';
    if (stats.every(s => saved.scores?.[s] === null || (Number.isInteger(saved.scores?.[s]) && saved.scores[s] >= 3 && saved.scores[s] <= 18))) draft.scores = saved.scores;
    if (Array.isArray(saved.rolls) && saved.rolls.length === 6 && saved.rolls.every(r => Array.isArray(r) && r.length === 4 && r.every(n => Number.isInteger(n) && n >= 1 && n <= 6))) draft.rolls = saved.rolls;
    if (Number.isInteger(saved.step)) draft.step = Math.max(0, Math.min(7,saved.schemaVersion===2?saved.step:({4:6,5:7}[saved.step]??saved.step)));
  }
} catch { storageAvailable = false; }

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const selected = (kind, id) => draft[kind] === id ? ' selected' : '';
const entry = (list, id) => catalogue[list].find(item => item.id === id);
const currentClass = () => entry('classes', draft.classId);
const currentSpecies = () => entry('species', draft.speciesId);
const currentBackground = () => entry('backgrounds', draft.backgroundId);
const option = () => currentClass()?.equipment.find(e => e.choix === draft.equipment);
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || '✧';

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 4000);
}

function save(silent = false) {
  try {
    draft.cloudId??=crypto.randomUUID();
    localStorage.setItem(draftKey, JSON.stringify(draft));
    if(draft.name||draft.classId){const records=localCharacters();if(usesCurrentRules(draft)||!records[draft.cloudId])records[draft.cloudId]=draft;localStorage.setItem(localCharactersKey,JSON.stringify(records));}
    storageAvailable = true;
  }
  catch { storageAvailable = false; }
  if(accountId){
    const status=root.querySelector('.sheet-save-status');
    if(status)status.textContent=draft.cloudRevision?(isDirty(draft)?'Modifications à enregistrer. La dernière version reste dans votre compte.':'Enregistré dans votre compte.'):'Ce personnage est encore un brouillon sur cet appareil.';
    root.querySelectorAll('[data-save-character]').forEach(button=>{button.disabled=cloudBusy;button.textContent=cloudBusy?'Enregistrement…':draft.cloudRevision?'Enregistrer les modifications':'Enregistrer le personnage';});
  }
  if (!silent) toast(storageAvailable ? 'Brouillon conservé sur cet appareil.' : 'Le navigateur ne permet pas de conserver ce brouillon.');
}

async function cloudRequest(path,options={}){
  const response=await fetch('./api/personnages'+path,{credentials:'same-origin',...options});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'La sauvegarde est indisponible. Votre brouillon local est conservé.');return result;
}
async function refreshCloudCharacters(){
  if(!accountId)return;cloudLoading=true;cloudError='';
  try{cloudCharacters=(await cloudRequest('')).characters;}catch(error){cloudError=error.message;}finally{cloudLoading=false;}
}
async function saveCloudCharacter(){
  if(!accountId||cloudBusy)return;
  if(!usesCurrentRules(draft)){toast('Créez une copie à mettre à niveau avant de l’enregistrer.');return;}
  if(!draft.name.trim()){toast('Donnez un nom au personnage avant de l’enregistrer.');return;}
  save(true);const id=draft.cloudId,character=characterSnapshot(draft),stamp=snapshotStamp(draft);
  cloudBusy=true;cloudSaveError='';route();
  try{
    const result=await cloudRequest('/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({character,revision:draft.cloudRevision||0})});
    if(draft.cloudId===id){
      const unchanged=snapshotStamp(draft)===stamp;
      if(unchanged)Object.assign(draft,result.character);
      Object.assign(draft,{cloudId:result.id,cloudRevision:result.revision,cloudUpdatedAt:result.updatedAt,cloudSnapshot:snapshotStamp(result.character)});save(true);
    }
    await refreshCloudCharacters();toast(result.status==='ready'?'Personnage enregistré dans votre compte.':'Personnage enregistré dans votre compte. Certains choix restent à compléter.');
  }catch(error){cloudSaveError=error.message;toast(error.message);}finally{cloudBusy=false;route();}
}
async function openCloudCharacter(id){
  const sequence=++openingSequence;save(true);
  root.innerHTML='<h1>Votre personnage arrive…</h1><p>Chargement de la fiche enregistrée.</p>';
  try{
    const result=await cloudRequest('/'+encodeURIComponent(id));
    if(sequence!==openingSequence||location.hash!==`#ouvrir/${id}`)return;
    const records=localCharacters(),local=records[id];
    if(local&&isDirty(local)&&snapshotStamp(local)!==snapshotStamp(result.character)){
      const copy={...local,cloudId:crypto.randomUUID(),cloudRevision:0,cloudUpdatedAt:'',cloudSnapshot:''};records[copy.cloudId]=copy;localStorage.setItem(localCharactersKey,JSON.stringify(records));
    }
    draft={...initial(),...result.character,rulesVersion:result.character.rulesVersion??null,cloudId:result.id,cloudRevision:result.revision,cloudUpdatedAt:result.updatedAt,cloudSnapshot:snapshotStamp(result.character)};
    cloudSaveError='';save(true);history.replaceState(null,'','#fiche/brouillon');route();
  }catch(error){if(sequence===openingSequence){root.innerHTML=`<a class="back" href="#personnages">← Mes personnages</a><h1>Le personnage n’a pas pu être ouvert.</h1><p>${esc(error.message)}</p><a class="button secondary" href="#creation">Reprendre mon brouillon local</a>`;}}
}

function characters() {
  if(accountId)return accountCharacters();
  const hasDraft = Boolean(draft.name || draft.classId);
  return `<div class="heading-row"><div><div class="eyebrow">LE DÉBUT DE VOTRE AVENTURE</div><h1>Mes personnages</h1><p>Des idées, des héros, des histoires à écrire.</p></div><a class="button primary" href="#nouveau"><span class="plus">+</span> Créer un personnage</a></div>
    ${hasDraft ? `<div class="draft-banner"><span>Brouillon en cours : <strong>${esc(draft.name || 'Sans nom')}</strong></span><a class="button secondary" href="#creation">Reprendre mon brouillon →</a></div>` : ''}
    <section class="hero" aria-label="Votre prochaine aventure"><div class="hero-copy"><div class="eyebrow">IMAGINEZ. CRÉEZ. INCARNEZ.</div><h2>Quel héros sommeille<br>en vous ?</h2><p>Une lame affûtée, un grimoire oublié, un serment à tenir. Votre prochaine histoire commence ici.</p><a href="#nouveau">Donner vie à mon personnage <span aria-hidden="true">→</span></a></div><div class="hero-seal" aria-hidden="true"></div></section>
    <div class="section-bar"><h2>Vos compagnons d’aventure <span class="count">2 exemples</span></h2><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Chercher un personnage…" aria-label="Chercher un personnage"></label></div>
    <div class="character-grid" id="characters">${characterCard('vaelen', 'Vaelen Forgebrume', 'Humain', 'Guerrier', 'Soldat', '')}${characterCard('selya', 'Sélya Aubétoile', 'Elfe', 'Magicien', 'Sage', 'violet')}<a class="new-card" href="#nouveau"><span class="circle" aria-hidden="true">+</span><h3>Une nouvelle légende</h3><p>Choisissez qui vous voulez devenir.</p></a></div><p class="small-note">Les personnages présentés sont des exemples. Votre compte et vos personnages actuels ne sont pas modifiés.</p>`;
}

function accountCharacters(){
  const locals=Object.entries(localCharacters()).filter(([,person])=>typeof person?.name==='string'&&person.name.trim()&&isDirty(person));
  const formatDate=value=>new Date(value).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
  const card=(person,local=false)=>{
    const id=local?person.cloudId:person.id,cls=entry('classes',person.classId),species=entry('species',person.speciesId);
    return `<a class="saved-character" href="#${local?'brouillon':'ouvrir'}/${esc(id)}"><span class="saved-glyph" aria-hidden="true">${icons[person.classId]||'✧'}</span><div><span class="saved-kind">${local?'SUR CET APPAREIL · À ENREGISTRER':'DANS VOTRE COMPTE'}</span><h3>${esc(person.name||'Sans nom')}</h3><p>${esc(cls?.nom||'Classe à choisir')} · Niveau ${person.level} · ${esc(species?.nom||'Espèce à choisir')}</p>${!local?`<small>${person.status==='draft'?'Choix à compléter · ':''}Enregistré le ${esc(formatDate(person.updatedAt))}</small>`:'<small>Vos modifications locales sont conservées ici.</small>'}</div><span class="saved-open">${local?'Reprendre':'Ouvrir'} →</span></a>`;
  };
  return `<div class="heading-row"><div><div class="eyebrow">VOTRE GRIMOIRE</div><h1>Mes personnages</h1><p>Retrouvez vos personnages enregistrés et vos idées en cours.</p></div><a class="button primary" href="#nouveau">+ Créer un personnage</a></div>${draft.name&&isDirty(draft)?`<div class="draft-banner"><span>En cours : <strong>${esc(draft.name)}</strong></span><a class="button secondary" href="#fiche/brouillon">Revenir à ma fiche →</a></div>`:''}<div class="section-bar"><h2>Dans votre compte <span class="count">${cloudCharacters.length}</span></h2><button class="button quiet" id="refresh-characters" type="button">Actualiser</button></div>${cloudError?`<div class="notice" role="alert">${esc(cloudError)} <a href="/connexion.html">Se reconnecter</a></div>`:''}<div class="saved-character-list">${cloudLoading?'<p>Chargement de vos personnages…</p>':cloudCharacters.map(person=>card(person)).join('')||'<div class="empty"><h3>Votre premier personnage vous attend.</h3><p>Depuis sa fiche, cliquez sur « Enregistrer le personnage » pour le retrouver ici et sur vos autres appareils.</p></div>'}</div>${locals.length?`<div class="section-bar"><h2>Brouillons sur cet appareil</h2></div><div class="saved-character-list">${locals.map(([,person])=>card(person,true)).join('')}</div>`:''}`;
}

function characterCard(id, name, species, cls, bg, tone) {
  return `<a class="character" href="#fiche/${id}" data-search="${esc(name.toLocaleLowerCase('fr'))}"><div class="portrait ${tone}"><span class="example">PERSONNAGE D’EXEMPLE</span><div class="monogram"><span>${initials(name)}</span></div><span class="level">NIVEAU 1</span></div><div class="char-content"><h3>${esc(name)}</h3><p>${esc(species)} · ${esc(cls)}</p><div class="char-bottom"><span>${esc(bg)}</span><strong>Ouvrir la fiche →</strong></div></div></a>`;
}

function choices(items, field, detail) {
  return `<div class="choice-grid">${items.map(item => `<button type="button" class="choice${selected(field, item.id)}" data-choice="${field}" data-id="${esc(item.id)}" aria-pressed="${draft[field] === item.id}">${field === 'classId' ? `<span class="choice-glyph" aria-hidden="true">${icons[item.id] || '✦'}</span>` : ''}<strong>${esc(item.nom)}</strong><small>${esc(detail(item))}</small></button>`).join('')}</div>`;
}

function stepContent() {
  switch (draft.step) {
    case 0: return `<h2>Tout commence par une histoire.</h2><p class="intro">Donnez un nom à votre personnage et choisissez le niveau auquel commence votre aventure.</p><label class="field">Nom du personnage <input id="name" maxlength="80" autocomplete="off" placeholder="Nom de votre personnage" value="${esc(draft.name)}" required><span class="hint">Un surnom, un nom de famille… à vous de choisir.</span></label><label class="field">Niveau de départ<select id="level">${Array.from({length:20}, (_, i) => `<option value="${i+1}" ${draft.level === i+1 ? 'selected' : ''}>Niveau ${i+1}</option>`).join('')}</select><span class="hint">Votre MJ vous indique à quel niveau débute la partie.</span></label><div class="notice">La classe, l’espèce et l’historique seront choisis aux étapes suivantes. Les douze classes sont proposées du niveau 1 au niveau 20 à partir de la BDD. Les données qui demandent une précision du MJ sont signalées pendant la création.</div>`;
    case 1: return `<h2>Quelle est votre vocation ?</h2><p class="intro">Choisissez une classe. C’est elle qui dessine votre manière de partir à l’aventure.</p>${choices(catalogue.classes, 'classId', c => descriptions[c.id] || 'Une nouvelle voie à explorer.')}`;
    case 2: return origins();
    case 3: return characteristics();
    case 4: return aptitudes();
    case 5: return magic();
    case 6: return `<h2>Prêt pour le départ.</h2><p class="intro">Choisissez séparément l’équipement de votre classe et celui de votre historique.</p><h3>Votre classe</h3>${(currentClass()?.equipment || []).map(e => `<button type="button" class="choice equipment-option${selected('equipment', e.choix)}" data-choice="equipment" data-id="${esc(e.choix)}" aria-pressed="${draft.equipment === e.choix}"><strong>Option ${esc(e.choix)}</strong><small>${esc(e.contenu.join(' · '))}</small></button>`).join('') || '<div class="notice">Les options d’équipement de cette classe ne figurent pas dans le catalogue local.</div>'}<h3 class="origin-title">Votre historique : ${esc(currentBackground()?.nom)}</h3><button type="button" class="choice equipment-option${selected('backgroundEquipment','A')}" data-choice="backgroundEquipment" data-id="A" aria-pressed="${draft.backgroundEquipment==='A'}"><strong>Option A · Le matériel</strong><small>${esc((currentBackground()?.equipement || []).map(e => `${e.nom} ×${e.quantite || 1}`).join(' · '))}</small></button><button type="button" class="choice equipment-option${selected('backgroundEquipment','B')}" data-choice="backgroundEquipment" data-id="B" aria-pressed="${draft.backgroundEquipment==='B'}"><strong>Option B · 50 po</strong><small>À la place du matériel de l’historique. Vos maîtrises et votre don sont conservés.</small></button>${backgroundKitOptions(draft,catalogue).length?`<label>La boîte de jeux dans votre sac<select data-origin-field="backgroundKit"><option value="">Choisir…</option>${backgroundKitOptions(draft,catalogue).map(t=>`<option value="${esc(t.id)}" ${draft.backgroundKit===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>`:''}`;
    default: return `<h2>Le début d’une légende.</h2><p class="intro">Voici le personnage que vous avez imaginé. Revenez sur une étape pour ajuster vos choix.</p>${review(draft)}${originReview(draft)}${rulesReview(draft)}<div class="notice"><strong>Aperçu du parcours.</strong> Vos choix d’origine et de classe sont repris ci-dessous. La fiche rassemble vos informations, vos aptitudes et vos sorts. Vous pourrez y compléter votre histoire et vos langues.</div>${cloudSaveControl()}`;
  }
}

function cloudSaveControl(){
  if(!accountId)return '';
  return `<div class="cloud-save-control"><button type="button" class="button primary" data-save-character ${cloudBusy?'disabled':''}>${cloudBusy?'Enregistrement…':draft.cloudRevision?'Enregistrer les modifications':'Enregistrer le personnage'}</button><p class="hint">${draft.cloudRevision?(isDirty(draft)?'Modifications à enregistrer.':'Enregistré dans votre compte.'):'Pour retrouver ce personnage depuis votre compte.'}</p>${cloudSaveError?`<p class="hint" role="alert">${esc(cloudSaveError)}</p>`:''}</div>`;
}

function summary() {
  const choices = [['Classe', currentClass()], ['Espèce', currentSpecies()], ['Historique', currentBackground()]].filter(([, value]) => value);
  return `<aside class="resume" aria-label="Résumé du personnage"><span class="resume-label">VOTRE PERSONNAGE</span><h3 id="summary-name">${esc(draft.name || 'Une histoire à écrire')}</h3><p id="summary-level">Niveau ${draft.level} · D&D 2024</p>${choices.length ? `<dl>${choices.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value.nom)}</dd></div>`).join('')}</dl>` : '<p class="summary-empty">Vos choix apparaîtront ici au fil de la création.</p>'}<a class="button secondary" href="#fiche/brouillon">Voir ma fiche en cours →</a>${cloudSaveControl()}<button class="button quiet" type="button" id="save">↓ Garder mon brouillon</button><span class="hint">Conservé uniquement dans ce navigateur.</span></aside>`;
}

function characteristics() {
  const methods = [
    ['physical', 'Mes dés physiques', 'Je lance mes dés et je saisis mes résultats.'],
    ['virtual', 'Les dés de l’application', 'Je déclenche les lancers et je vois chaque dé.'],
    ['standard', 'Les valeurs standard', 'Sans lancer : 15, 14, 13, 12, 10 et 8.'],
  ];
  const physical = draft.statsMethod === 'physical';
  const virtual = draft.statsMethod === 'virtual';
  const values = virtual ? [...new Set(draft.rolls.map(r => r.reduce((sum, n) => sum + n, 0) - Math.min(...r)))].sort((a,b) => b-a) : [15,14,13,12,10,8];
  return `<h2>Vos dés, votre manière.</h2><p class="intro">Autour d’une table ou à l’écran, gardez le choix de vos lancers.</p><div class="method-grid">${methods.map(([id, name, detail]) => `<button type="button" class="choice${draft.statsMethod === id ? ' selected' : ''}" data-method="${id}" aria-pressed="${draft.statsMethod === id}"><strong>${name}</strong><small>${detail}</small></button>`).join('')}</div>
    <h3 class="origin-title">${physical ? 'Saisissez vos résultats' : virtual ? 'Lancez, puis répartissez' : 'Répartissez les six valeurs'}</h3>
    <p class="intro">${physical ? 'Lancez quatre dés à six faces, écartez le plus faible et additionnez les trois autres. Recommencez six fois, puis répartissez vos résultats comme vous le souhaitez.' : virtual ? 'Chaque lancer affiche les quatre dés et le dé écarté. Vous pouvez ensuite changer leur répartition.' : 'Utilisez chaque valeur une fois, dans la caractéristique de votre choix.'}</p>
    ${virtual ? `<button type="button" class="button secondary" id="roll-stats">${draft.rolls.length ? 'Relancer les six jets' : 'Lancer les six jets'}</button><div class="roll-grid">${draft.rolls.map((roll, index) => { const lowest = roll.indexOf(Math.min(...roll)); return `<div class="roll"><span>Jet ${index + 1}</span><div>${roll.map((n, i) => `<b class="${i === lowest ? 'dropped' : ''}" ${i === lowest ? 'title="Dé écarté"' : ''}>${n}</b>`).join('')}</div><strong>= ${roll.reduce((sum, n) => sum + n, 0) - Math.min(...roll)}</strong></div>`; }).join('')}</div>` : ''}
    ${!virtual || draft.rolls.length ? `<div class="stat-grid">${stats.map(s => `<label class="stat-field">${s}${physical ? `<input type="number" data-stat="${s}" aria-label="Résultat physique ${s}" min="3" max="18" step="1" inputmode="numeric" placeholder="—" value="${draft.scores[s] ?? ''}">` : `<select data-stat="${s}" aria-label="Caractéristique ${s}">${values.map(n => `<option value="${n}" ${draft.scores[s] === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`}</label>`).join('')}</div>` : ''}
    ${suggestionControls()}
    ${bonusControls()}`;
}

function suggestionPool() {
  if (draft.statsMethod === 'standard') return [15,14,13,12,10,8];
  if (draft.statsMethod === 'virtual') return draft.rolls.length === 6 ? draft.rolls.map(roll => roll.reduce((sum, n) => sum + n, 0) - Math.min(...roll)) : [];
  const pool = stats.map(stat => draft.scores[stat]);
  return pool.every(n => Number.isInteger(n) && n >= 3 && n <= 18) ? pool : [];
}

function suggestionControls() {
  const main = (currentClass()?.principales || []).filter(stat => stats.includes(stat));
  if (!main.length) return '';
  const ready = suggestionPool().length === 6;
  return `<div class="suggestion"><h3>Un coup de pouce pour votre ${esc(currentClass().nom.toLocaleLowerCase('fr'))} ?</h3><p>Caractéristiques principales : ${main.join(', ')}. La suggestion leur donne les meilleures valeurs, puis privilégie la Constitution. Vous gardez le dernier mot.</p>${main.length > 1 ? `<label class="field">Votre priorité<select id="suggest-focus">${main.map(stat => `<option value="${stat}" ${stat === suggestionFocus ? 'selected' : ''}>${stat}</option>`).join('')}</select></label>` : ''}<div class="suggestion-actions"><button type="button" class="button secondary" id="suggest-stats" ${ready ? '' : 'disabled'}>Suggérer selon ma classe</button><button type="button" class="button quiet" id="undo-suggestion" ${beforeSuggestion ? '' : 'disabled'}>Annuler la suggestion</button></div><span class="hint">Les six résultats sont conservés. Aucun dé n’est relancé.${ready ? '' : ' Renseignez ou lancez les six résultats pour utiliser la suggestion.'}</span></div>`;
}

function suggestStats(focus) {
  const main = (currentClass()?.principales || []).filter(stat => stats.includes(stat));
  const pool = suggestionPool().sort((a,b) => b-a);
  if (!main.length || pool.length !== 6) return false;
  const first = main.includes(focus) ? focus : main[0];
  suggestionFocus = first;
  // La BDD donne les principales ; CON est une aide de répartition, pas une règle de classe.
  const rest = [...stats].sort((a,b) => (draft.scores[b] ?? 0) - (draft.scores[a] ?? 0));
  const order = [...new Set([first, ...main, 'CON', ...rest])];
  beforeSuggestion = {...draft.scores};
  draft.scores = Object.fromEntries(order.map((stat, index) => [stat, pool[index]]));
  return true;
}

function rollD6() {
  // Écarter le reste de la division pour que les six faces aient la même probabilité.
  const value = new Uint8Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= 252);
  return value[0] % 6 + 1;
}

function origins() {
  const species=currentSpecies();const bg=currentBackground();const variant=selectedVariant(draft,catalogue);
  const sizeOptions=originSizeOptions(draft,catalogue);const skillOptions=speciesSkillOptions(draft,catalogue);const tools=backgroundToolOptions(draft,catalogue);
  const feats=originFeats(draft,catalogue);
  return `<h2>D’où venez-vous ?</h2><p class="intro">Votre espèce, votre passé et les talents qui vous accompagnent.</p><details class="origin-picker" ${species?'':'open'}><summary>Espèce · ${esc(species?.nom||'À choisir')}</summary>${choices(catalogue.species,'speciesId',s=>`Vitesse : ${s.vitesse} m`)}</details>
  ${species?`<section class="rules-section first"><p>${esc(species.description)}</p>${sizeOptions.length>1?`<label class="field">Taille<select data-origin-field="speciesSize"><option value="">Choisir votre taille</option>${sizeOptions.map(size=>`<option value="${size}" ${draft.speciesSize===size?'selected':''}>${size==='M'?'Moyenne (M)':size==='P'?'Petite (P)':esc(size)}</option>`).join('')}</select><span class="hint">${esc(species.taille.details)}</span></label>`:`<p>Taille : ${esc(sizeOptions[0]||'—')} · Vitesse : ${species.vitesse} m</p>`}${species.variantes?.length?`<h3 class="origin-title">Votre lignage ou héritage</h3>${choices(species.variantes,'variantId',v=>v.description||'')}`:''}${variant?`<p class="hint">${esc(variant.description||'')}</p>`:''}${skillOptions.length?`<label class="field">Compétence accordée par votre espèce<select data-origin-field="speciesSkill"><option value="">Choisir une compétence</option>${skillOptions.map(name=>`<option value="${esc(name)}" ${draft.speciesSkill===name?'selected':''}>${esc(name)}</option>`).join('')}</select><span class="hint">Cette maîtrise s’ajoute à celles de votre historique et de votre classe.</span></label>`:''}${speciesChoiceSpecs(draft,catalogue).map(spec=>`<label class="field">${esc(spec.label)}<select data-origin-field="${spec.field}"><option value="">Choisir</option>${spec.options.map(o=>`<option value="${esc(o.id)}" ${draft[spec.field]===o.id?'selected':''}>${esc(o.nom)}</option>`).join('')}</select>${spec.hint?`<span class="hint">${esc(spec.hint)}</span>`:''}</label>`).join('')}<div class="feature-list">${[...(species.traits||[]),...(variant?.traits_speciaux||[])].map(trait=>`<details><summary>${esc(trait.nom)}</summary><p>${esc(trait.description)}</p></details>`).join('')}</div></section>`:''}
  <details class="origin-picker" ${bg?'':'open'}><summary>Historique · ${esc(bg?.nom||'À choisir')}</summary>${choices(catalogue.backgrounds,'backgroundId',b=>b.competences.join(' · '))}</details>
  ${bg?`<section class="rules-section first"><p>${esc(bg.description)}</p><div class="origin-grants"><span>Compétences : ${esc((bg.competences||[]).join(' · '))}</span><span>Outils : ${esc((bg.outils||[]).join(' · ')||'—')}</span></div>${tools.length?`<label class="field">Outil de votre historique<select data-origin-field="backgroundTool"><option value="">Choisir</option>${tools.map(tool=>`<option value="${esc(tool.id)}" ${draft.backgroundTool===tool.id?'selected':''}>${esc(tool.name)}</option>`).join('')}</select></label>`:''}</section>`:''}
  ${feats.find(g=>g.slot==='background')?featControls(feats.find(g=>g.slot==='background')):''}
  ${species?.id==='humain'?`<section class="rules-section"><h3>Le don de votre humain</h3><p>Polyvalent vous accorde un don d’origine supplémentaire. Choisissez celui qui correspond à votre personnage.</p><label class="field">Don d’origine<select data-origin-field="originFeatId"><option value="">Choisir un don</option>${humanFeats(draft,catalogue).map(feat=>`<option value="${esc(feat.id)}" ${draft.originFeatId===feat.id?'selected':''}>${esc(feat.nom)}</option>`).join('')}</select></label>${feats.find(g=>g.slot==='human')?featControls(feats.find(g=>g.slot==='human'),false):''}</section>`:''}
  ${originSpellSummary(draft)}`;
}

function featControls(grant,section=true) {
  const selected=draft.originGrants[grant.slot];const feat=grant.feat;const options=grantOptions(draft,catalogue,grant);const magic=magicFeatProfile(draft,catalogue,grant);
  return `<${section?'section':'div'} class="${section?'rules-section':'feat-inner'}"><h3>${grant.slot==='background'?'Don de l’historique · ':''}${esc(grant.name)}</h3>${feat?`<p>${esc(feat.description)}</p><details class="feat-effects"><summary>Effets du don</summary><ul>${(feat.effets||[]).map(effect=>`<li>${esc(effect.valeur)}</li>`).join('')}</ul></details>`:'<p class="hint">Le nom du don est conservé ; sa fiche reste à relier au catalogue.</p>'}
  ${options.length?`<details class="proficiency-picker" ${selected.proficiencies.length<3?'open':''}><summary>Choisir trois maîtrises <span class="count">${selected.proficiencies.length} / 3</span></summary><div class="skill-grid">${options.map(option=>`<label class="skill-choice"><input type="checkbox" data-grant-slot="${grant.slot}" data-grant-choice="${esc(option.id)}" ${selected.proficiencies.includes(option.id)?'checked':''} ${selected.proficiencies.length>=3&&!selected.proficiencies.includes(option.id)?'disabled':''}><span>${esc(option.name)}<small>${option.type==='skill'?'Compétence':'Outil'}</small></span></label>`).join('')}</div></details>`:''}
  ${magic?`${grant.forcedList?`<p class="hint">Liste : ${esc(grant.forcedList)} · Caractéristique : ${esc(magic.ability||'—')}</p>`:`<label class="field">Liste de sorts<select data-grant-slot="${grant.slot}" data-grant-field="magicList"><option value="">Choisir une liste</option>${magicFeatLists(draft,catalogue,grant).map(name=>`<option ${selected.magicList===name?'selected':''}>${name}</option>`).join('')}</select></label>`}${magic.list?`<label class="field">Caractéristique d’incantation<select data-grant-slot="${grant.slot}" data-grant-field="magicAbility"><option value="">Choisir une caractéristique</option>${['INT','SAG','CHA'].map(a=>`<option value="${a}" ${selected.magicAbility===a?'selected':''}>${a}</option>`).join('')}</select><span class="hint">Indépendante de la liste de sorts choisie.</span></label><h3 class="origin-title">Deux sorts mineurs <span class="count">${selected.cantrips.length} / 2</span></h3><div class="skill-grid">${magic.cantrips.map(spell=>`<label class="skill-choice"><input type="checkbox" data-grant-slot="${grant.slot}" data-origin-cantrip="${esc(spell.id)}" ${selected.cantrips.includes(spell.id)?'checked':''} ${selected.cantrips.length>=2&&!selected.cantrips.includes(spell.id)?'disabled':''}><span>${esc(spell.nom)}</span></label>`).join('')}</div><label class="field">Sort de niveau 1<select data-grant-slot="${grant.slot}" data-grant-field="spell"><option value="">Choisir un sort</option>${magic.spells.map(spell=>`<option value="${esc(spell.id)}" ${selected.spell===spell.id?'selected':''}>${esc(spell.nom)}</option>`).join('')}</select><span class="hint">${esc(magic.ability)} · une utilisation par repos long, selon le don de votre bibliothèque.</span></label>`:''}`:''}</${section?'section':'div'}>`;
}

function originSpellSummary(person) {
  const spells=grantedOriginSpells(person,catalogue);
  if(!spells.length) return '';
  return `<section class="automatic-spells"><h3>La magie de vos origines</h3><p>Ces sorts viennent de votre espèce ou de vos dons ; ils restent séparés des choix de classe.</p><div>${spells.map(spell=>`<span>${esc(spell.nom)} <small>${esc(spell.source)}${spell.niveau===null?' · fiche à relier':` · niv. ${spell.niveau}`}</small></span>`).join('')}</div></section>`;
}

function originReview(person) {
  const species=entry('species',person.speciesId);const variant=selectedVariant(person,catalogue);const size=person.speciesSize||originSizeOptions(person,catalogue)[0];
  const feats=originFeats(person,catalogue);const skills=originSkills(person,catalogue);const tools=originTools(person,catalogue);const bonuses=originBonuses(person,catalogue);
  return `<div class="review"><div class="review-box full"><h3>Vos origines</h3><p>${esc(species?.nom||'À choisir')}${variant?` · ${esc(variant.nom)}`:''} · Taille ${esc(size||'à choisir')}</p><p>Maîtrises d’origine : ${esc(skills.join(' · ')||'—')}</p><p>Outils : ${esc(tools.join(' · ')||'—')}</p></div>${feats.map(grant=>`<div class="review-box full"><h3>${grant.label||(grant.slot==='human'?'Don humain':'Don d’historique')} · ${esc(grant.name)}</h3><p>${esc(grant.feat?.description||'Fiche à relier')}</p><ul>${(grant.feat?.effets||[]).map(effect=>`<li>${esc(effect.valeur)}</li>`).join('')}</ul></div>`).join('')}${bonuses.hp||bonuses.initiative?`<div class="review-box full"><h3>Bonus de vos dons</h3><p>${bonuses.hp?`PV maximum : +${bonuses.hp}. `:''}${bonuses.initiative?`Initiative : +${bonuses.initiative}.`:''}</p></div>`:''}</div>${originSpellSummary(person)}`;
}

function initiative(person) {const dex=modifier(finalScores(person,entry('backgrounds',person.backgroundId),catalogue).DEX);return dex===null?'—':signed(dex+originBonuses(person,catalogue).initiative);}

function updateOriginChoices() {
  reconcileOrigins(draft,catalogue);
  const allowed=classSkills(draft,catalogue).options;
  draft.classSkills=draft.classSkills.filter(name=>allowed.includes(name));
  pruneSpellChoices(draft,catalogue);
  save(true);drawCreation();
}

function bonusControls() {
  const allowed = backgroundAbilities(currentBackground());
  const bonuses = backgroundBonuses(draft,currentBackground());
  const finals = finalScores(draft,currentBackground(),catalogue);
  return `<section class="rules-section"><h3>Le bonus de votre historique</h3><p>${esc(currentBackground()?.nom)} : répartissez vos bonus parmi ${allowed.join(', ')}.</p><div class="choice-grid">${[['three','+1 / +1 / +1'],['split','+2 / +1']].map(([id,label])=>`<button type="button" class="choice${draft.bonusMode===id?' selected':''}" data-bonus-mode="${id}" aria-pressed="${draft.bonusMode===id}"><strong>${label}</strong></button>`).join('')}</div>${draft.bonusMode==='split'?`<div class="choice-grid">${[['bonusTwo','Bonus +2'],['bonusOne','Bonus +1']].map(([key,label])=>`<label class="field">${label}<select data-bonus-select="${key}"><option value="">Choisir</option>${allowed.map(stat=>`<option value="${stat}" ${draft[key]===stat?'selected':''}>${stat}</option>`).join('')}</select></label>`).join('')}</div>`:''}<div class="final-stats">${stats.map(stat=>`<span>${stat} <strong>${finals[stat]??'—'}</strong>${bonuses[stat]?`<small>+${bonuses[stat]}</small>`:''}</span>`).join('')}</div><span class="hint">Caractéristiques finales, bonus inclus. Les résultats de vos dés restent inchangés.</span></section>`;
}

function classControls(){return classChoiceSpecs(draft,catalogue).map(spec=>`<section class="rules-section"><h3>${esc(spec.nom)} <span class="count">${(draft.classChoices?.[spec.key]||[]).filter(Boolean).length}/${spec.count}</span></h3>${spec.description?`<p class="hint">${esc(spec.description)}</p>`:''}${['names','number'].includes(spec.kind)?Array.from({length:spec.count},(_,i)=>`<label class="field">${esc(spec.nom)} ${i+1}<input type="${spec.kind==='number'?'number':'text'}" data-class-free="${spec.key}" data-class-index="${i}" maxlength="150" value="${esc(draft.classChoices?.[spec.key]?.[i]||'')}"></label>`).join(''):`<div class="skill-grid">${spec.options.map(o=>`<label class="skill-choice"><input type="checkbox" data-class-select="${spec.key}" data-class-value="${esc(o.id)}" ${(draft.classChoices?.[spec.key]||[]).includes(o.id)?'checked':''} ${!(draft.classChoices?.[spec.key]||[]).includes(o.id)&&(draft.classChoices?.[spec.key]||[]).length>=spec.count?'disabled':''}><span>${esc(o.nom)}${o.description?`<small>${esc(o.description)}</small>`:''}</span></label>`).join('')}</div>`}</section>`).join('');}

function aptitudes() {
  const profile = classProfile(draft,catalogue);
  if (!profile) return `<h2>Les talents de votre personnage.</h2><p class="intro">Les données de cette classe ou de ce niveau ne sont pas disponibles dans le catalogue actuel.</p><div class="notice">Vous pouvez continuer à explorer la maquette. Cette fiche ne sera pas complète.</div>`;
  const vocation = currentClass().niveaux['1'].capacites.find(c=>c.nom==='Vocation divine');
  const skillOptions = classSkills(draft,catalogue);
  const hp = hitPoints(draft,catalogue);
  const die = Number(currentClass().niveaux['0'].de_vie.type.match(/d(\d+)/)[1]);
  const domain = profile.domain;
  return `<h2>Un pouvoir, une vocation.</h2><p class="intro">Les choix de votre ${esc(currentClass().nom.toLocaleLowerCase('fr'))} de niveau ${draft.level}, réunis au même endroit.</p>${vocation?`<section class="rules-section first"><h3>Vocation divine</h3><p>Choisissez votre rôle sacré.</p>${choices(vocation.options.map(o=>({id:o.nom,nom:o.nom,detail:o.nom==='Protecteur'?'Armes de guerre et armures lourdes.':'Un sort mineur supplémentaire ; aide aux tests d’Arcanes et de Religion.'})),'divineOrder',o=>o.detail)}</section>`:''}
  ${draft.level>=3?`<section class="rules-section"><h3>${draft.classId==='clerc'?'Votre domaine':'Votre voie'}</h3><p>Choisissez une sous-classe parmi celles de votre bibliothèque actuelle.</p><div class="choice-grid">${catalogue.subclasses.filter(s=>s.classe_parente===draft.classId).map(s=>`<button class="choice${selected('subclassId',s.id)}" type="button" data-choice="subclassId" data-id="${esc(s.id)}" aria-pressed="${draft.subclassId===s.id}" ${s.available?'':'disabled'}><strong>${esc(s.nom)}</strong><small>Aptitudes de votre bibliothèque.</small></button>`).join('')}</div>${domain?`<div class="feature-list">${profile.domainFeatures.map(f=>`<details><summary>${esc(f.nom)}</summary><p>${esc(f.description)}</p></details>`).join('')}</div>`:''}</section>`:''}
  ${progressionControls()}${classControls()}${originFeats(draft,catalogue).filter(g=>g.slot.startsWith('invocation')).map(g=>featControls(g,false)).join('')}<section class="rules-section"><h3>Compétences de classe <span class="count">${draft.classSkills.length} / ${skillOptions.count}</span></h3><p>Vos origines accordent déjà : ${esc(originSkills(draft,catalogue).join(', '))}. Choisissez ${skillOptions.count} autres maîtrises.</p><div class="skill-grid">${skillOptions.options.map((name,index)=>`<label class="skill-choice"><input type="checkbox" data-class-skill="${esc(name)}" ${draft.classSkills.includes(name)?'checked':''} ${!draft.classSkills.includes(name)&&draft.classSkills.length>=skillOptions.count?'disabled':''}><span>${esc(name)}</span></label>`).join('')}</div></section>
  <section class="rules-section"><h3>Vos points de vie</h3><p>Le premier niveau donne le maximum du dé de vie. Pour les suivants, choisissez votre méthode.</p><label class="field">Méthode<select id="hp-mode">${[['fixed','Valeur fixe'],['physical','Mes dés physiques'],['virtual','Les dés de l’application']].map(([id,name])=>`<option value="${id}" ${draft.hpMode===id?'selected':''}>${name}</option>`).join('')}</select></label><div class="hp-levels"><div><span>Niveau 1</span><strong>${die} + mod. CON</strong><small>Automatique</small></div>${Array.from({length:draft.level-1},(_,i)=>i+2).map(level=>`<div><span>Niveau ${level}</span>${draft.hpMode==='fixed'?`<strong>${Math.floor(die/2)+1} + mod. CON</strong>`:draft.hpMode==='physical'?`<label>Résultat du d${die}<input type="number" data-hp-level="${level}" min="1" max="${die}" step="1" inputmode="numeric" value="${draft.hpRolls[level]??''}" aria-label="Dé de vie niveau ${level}"></label>`:`<span><strong>${draft.hpRolls[level]??'—'}</strong> + mod. CON</span><button type="button" class="button secondary" data-roll-hp="${level}">Lancer le d${die}</button>`}</div>`).join('')}</div><div class="hp-total">Points de vie maximum <strong id="hp-total">${hp??'À compléter'}</strong></div><span class="hint">Le modificateur de Constitution final est appliqué à chaque niveau. Aucun lancer automatique.</span></section>
  <section class="rules-section"><h3>Vos autres aptitudes</h3><div class="feature-list">${Array.from({length:draft.level},(_,i)=>currentClass().niveaux[i+1]?.capacites||[]).flat().filter(c=>!['Sorts','Vocation divine'].includes(c.nom)).map(c=>`<details><summary>${esc(c.nom)}</summary><p>${esc(c.description)}</p></details>`).join('')}</div></section>`;
}

function levelFeatChoices(row){return featChoiceSpecs(draft,catalogue,row).map(spec=>levelFeatChoice(row,spec)).join('');}
function levelFeatChoice(row,spec){
  const chosen={...featChoicesInitial(),...row.choice.choices};
  if(spec.field==='resistances')return `<h4>${esc(spec.label)} · ${chosen.resistances.length}/2</h4><div class="skill-grid">${spec.options.map(v=>`<label class="skill-choice"><input type="checkbox" data-feat-resistance="${esc(v)}" data-feat-level="${row.level}" ${chosen.resistances.includes(v)?'checked':''} ${!chosen.resistances.includes(v)&&chosen.resistances.length>=2?'disabled':''}><span>${esc(v)}</span></label>`).join('')}</div>`;
  if(spec.field==='spell')return `<label class="field">${esc(spec.label)}<select data-feat-choice="spell" data-feat-level="${row.level}"><option value="">Choisir</option>${spec.options.map(s=>`<option value="${esc(s.id)}" ${chosen.spell===s.id?'selected':''}>${esc(s.nom)} · niv. ${s.niveau}</option>`).join('')}</select></label>`;
  if(spec.field==='rituals')return `<h4>${esc(spec.label)} · ${chosen.rituals.length}/${spec.count}</h4><div class="skill-grid">${spec.options.map(s=>`<label class="skill-choice"><input type="checkbox" data-feat-ritual="${esc(s.id)}" data-feat-level="${row.level}" ${chosen.rituals.includes(s.id)?'checked':''} ${!chosen.rituals.includes(s.id)&&chosen.rituals.length>=spec.count?'disabled':''}><span>${esc(s.nom)} · niv. ${s.niveau}</span></label>`).join('')}</div>`;
  return `<label class="field">${esc(spec.label)}<select data-feat-choice="${spec.field}" data-feat-level="${row.level}"><option value="">Choisir</option>${spec.options.map(v=>`<option value="${esc(v)}" ${chosen[spec.field]===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
}
function progressionControls(){
  const progression=evaluateProgression(draft,catalogue,finalScores(draft,currentBackground()));
  const statSelect=(level,index,selected,allowed=stats)=>`<label class="field">${index===null?'Caractéristique du don':`Point ${index+1}`}<select data-advance-level="${level}" ${index===null?'data-advance-field="featAbility"':`data-advance-point="${index}"`}><option value="">Choisir</option>${allowed.map(a=>`<option value="${a}" ${selected===a?'selected':''}>${a}</option>`).join('')}</select></label>`;
  const levels=progression.rows.map(row=>{
    const {level,choice,feat}=row,origin=originFeats(draft,catalogue).find(g=>g.slot===`level${level}`);
    return `<section class="rules-section"><h3>Vos choix du niveau ${level}</h3><div class="choice-grid">${(currentClass().niveaux[level].amelioration.type==='don'?[['feat','Un don ou une faveur épique']]:[['ability','Caractéristiques'],['feat','Un don']]).map(([mode,label])=>`<button type="button" class="choice${choice.mode===mode?' selected':''}" data-advance-mode="${mode}" data-advance-level="${level}" aria-pressed="${choice.mode===mode}"><strong>${label}</strong><small>${mode==='ability'?'+2 à une caractéristique ou +1 à deux caractéristiques, maximum 20.':'Choisissez un don dont vous remplissez les conditions à ce niveau.'}</small></button>`).join('')}</div>${choice.mode==='feat'?`<label class="field">Don du niveau ${level}<select data-advance-level="${level}" data-advance-field="featId"><option value="">Choisir un don</option>${row.available.map(f=>`<option value="${esc(f.id)}" ${choice.featId===f.id?'selected':''}>${esc(f.nom)}</option>`).join('')}</select></label>${feat?`<p>${esc(feat.description)}</p><ul class="progression-effects">${(feat.effets||[]).map(e=>`<li>${esc(e.valeur)}</li>`).join('')}</ul>`:''}`:''}${choice.mode==='ability'||feat?.id==='amelioration_de_caracteristique'?`<div class="choice-grid">${[0,1].map(index=>statSelect(level,index,choice.abilities[index])).join('')}</div>${feat?.id==='amelioration_de_caracteristique'?'<p class="hint">Le don permet +2 sur une caractéristique, ou +1 sur deux différentes.</p>':''}`:featAbilityOptions(feat).length?statSelect(level,null,choice.featAbility,featAbilityOptions(feat)):''}${levelFeatChoices(row)}${origin?featControls(origin,false):''}${feat&&feat.id!=='amelioration_de_caracteristique'?`<label class="field">Notes personnelles sur ce don<textarea rows="3" maxlength="6000" data-advance-notes="${level}">${esc(choice.notes)}</textarea><span class="hint">Les bonus permanents sont intégrés à la fiche. Les effets conditionnels y sont détaillés avec leurs conditions d’utilisation.</span></label>`:''}${choice.mode&&row.errors.length?`<p class="notice">${esc(row.errors[0])}</p>`:''}</section>`;
  }).join('');
  const sacred=sacredChoices(draft,catalogue);
  return levels+(sacred.length?`<section class="rules-section"><h3>Niveau 7 · Frappe consacrée</h3>${choices(sacred.map(option=>({id:option.nom,nom:option.nom,description:option.description})),'sacredStrike',o=>o.description)}</section>`:'');
}

function magic() {
  const profile = classProfile(draft,catalogue);
  if (!profile) return '<h2>Votre magie.</h2><p class="intro">Le choix détaillé des sorts est en cours de construction pour cette classe ou ce niveau.</p>';
  const scores = finalScores(draft,currentBackground(),catalogue);
  const wisdom = modifier(scores[profile.castingAbility]);
  return `<h2>Composez votre magie.</h2><p class="intro">Choisissez vos sorts mineurs et les sorts que vous préparez. Les emplacements servent à les lancer ; ils ne limitent pas le nombre de sorts de chaque niveau que vous pouvez préparer.</p><div class="magic-summary"><span>${esc(profile.castingAbility)} <strong>${scores[profile.castingAbility]??'—'}</strong></span><span>DD des sorts <strong>${wisdom===null?'—':8+profile.proficiency+wisdom}</strong></span><span>Attaque magique <strong>${wisdom===null?'—':signed(profile.proficiency+wisdom)}</strong></span></div><div class="slot-bar">Emplacements : ${Object.entries(profile.slots).map(([level,count])=>`<span>niveau ${level} <strong>${count}</strong></span>`).join('')}</div>${profile.spellcastingNote?`<p class="notice">${esc(profile.spellcastingNote)}</p>`:''}${profile.always.length?`<section class="automatic-spells"><h3>Sorts toujours préparés</h3><p>Toujours préparés, en plus de vos ${profile.preparedCount} choix.</p><div>${profile.always.map(s=>`<span>${esc(s.sourceName||s.nom)} <small>niv. ${s.niveau} · ${esc(s.grantSource||profile.domain?.nom||'Domaine')}${s.unresolved?" · fiche à relier":""}</small></span>`).join('')}</div></section>`:''}<label class="search spell-search"><span aria-hidden="true">⌕</span><input id="spell-search" type="search" placeholder="Chercher un sort…" aria-label="Chercher un sort" value="${esc(spellSearch)}"></label>${profile.extraSpells?.length?`<section class="automatic-spells"><h3>Sorts accordés par vos aptitudes</h3><p>${profile.extraSpells.map(s=>`${esc(s.nom)} · ${esc(s.source)}${s.utilisation?` · ${esc(s.utilisation.replaceAll('_',' '))}`:''}`).join('<br>')}</p></section>`:''}${spellSection('cantrips','Sorts mineurs',profile.cantrips,profile.cantripCount)}${spellSection('prepared','Sorts préparés',profile.prepared,profile.preparedCount)}<div class="notice">Contenu issu de votre bibliothèque actuelle. Les mises à jour de règles seront examinées ultérieurement.</div>`;
}

function signed(value) {return value>=0?`+${value}`:String(value);}
function spellSection(kind,title,pool,count) {
  return `<section class="rules-section"><h3>${title} <span class="count">${draft[kind].length} / ${count}</span></h3><div class="spell-list">${pool.map(s=>`<article class="spell-card" data-spell-card="${esc(s.nom.toLocaleLowerCase('fr'))}" ${spellSearch&&!s.nom.toLocaleLowerCase('fr').includes(spellSearch.toLocaleLowerCase('fr'))?'hidden':''}><label><input type="checkbox" data-spell-kind="${kind}" data-spell-id="${esc(s.id)}" ${draft[kind].includes(s.id)?'checked':''} ${!draft[kind].includes(s.id)&&draft[kind].length>=count?'disabled':''}><span><strong>${esc(s.nom)}</strong><small>${s.niveau===0?'Sort mineur':`Niveau ${s.niveau}`} · ${esc(s.ecole)} · ${esc(s.temps_incantation)}</small></span></label><details><summary>Détails du sort</summary><p>${esc(s.description)}</p><p>Portée : ${esc(s.portee)} · Durée : ${esc(s.duree)}</p></details></article>`).join('')}</div></section>`;
}

function creation() {
  return `<a class="back" href="#personnages">← Mes personnages</a><div class="creation-header"><div class="eyebrow">CHAQUE HÉROS A UN COMMENCEMENT</div><h1>Créons votre personnage.</h1><p>Un choix à la fois. Vous pourrez revenir sur chacun d’eux.</p></div><div class="wizard"><nav class="steps" aria-label="Étapes de création">${visibleSteps(draft,catalogue).map((step,i) => `<button type="button" class="step ${step < draft.step ? 'done' : ''}" data-step="${step}" ${step === draft.step ? 'aria-current="step"' : ''} ${step > draft.step ? 'disabled' : ''}><b>${step < draft.step ? '✓' : i + 1}</b>${labels[step]}</button>`).join('')}</nav><section class="form-panel" aria-label="${labels[draft.step]}">${stepContent()}<div class="form-actions"><button type="button" class="button quiet" id="previous">${draft.step ? '← Précédent' : 'Quitter'}</button><button type="button" class="button primary" id="next">${draft.step === 7 ? 'Voir la fiche →' : 'Continuer →'}</button></div></section>${summary()}</div>`;
}

function rulesReview(person) {
  const profile = classProfile(person,catalogue);
  if(person.classId==='barbare'&&profile)return `<div class="review"><div class="review-box full"><h3>Vos aptitudes</h3><p>${esc(profile.subclass?.nom||'Voie à choisir')} · ${hitPoints(person,catalogue)??'—'} PV maximum</p><p>Rages : ${profile.rage} · dégâts pendant la Rage : +${profile.rageDamage}</p>${classChoiceSpecs(person,catalogue).map(spec=>`<p>${esc(spec.nom)} : ${esc((person.classChoices?.[spec.key]||[]).map(id=>spec.options.find(o=>o.id===id)?.nom||id).join(' · '))}</p>`).join('')}</div></div>`;
  if (!profile) return '';
  const finals = finalScores(person,entry('backgrounds',person.backgroundId),catalogue);
  return `<div class="review"><div class="review-box"><h3>Caractéristiques finales</h3><p>${stats.map(s=>`${s} ${finals[s]??'—'} (${signed(modifier(finals[s])??0)})`).join(' · ')}</p></div><div class="review-box"><h3>Aptitudes</h3><p>${esc(person.classId==='clerc'?(person.divineOrder||'Vocation à choisir'):'')}<br>${esc(profile.domain?.nom||(person.level>=3?'Sous-classe à choisir':''))}<br>PV maximum : ${hitPoints(person,catalogue)??'À compléter'}</p></div><div class="review-box full"><h3>Compétences</h3><p>${esc([...(entry('backgrounds',person.backgroundId)?.competences||[]),...person.classSkills].join(' · '))}</p></div><div class="review-box full"><h3>Sorts mineurs · ${person.cantrips.length}/${profile.cantripCount}</h3><p>${esc(person.cantrips.map(id=>catalogue.spells.find(s=>s.id===id)?.nom).filter(Boolean).join(' · ')||'À choisir')}</p></div><div class="review-box full"><h3>Sorts préparés · ${person.prepared.length}/${profile.preparedCount}</h3><p>${esc(person.prepared.map(id=>catalogue.spells.find(s=>s.id===id)?.nom).filter(Boolean).join(' · ')||'À choisir')}</p>${profile.always.length?`<p class="hint">En plus, sorts accordés : ${esc(profile.always.map(s=>s.nom).join(' · '))}.</p>`:''}</div></div>`;
}

function review(person) {
  const cls = entry('classes', person.classId);
  const species = entry('species', person.speciesId);
  const bg = entry('backgrounds', person.backgroundId);
  const eq = cls?.equipment.find(e => e.choix === person.equipment);
  return `<div class="review"><div class="review-box"><h3>Identité</h3><p>${esc(person.name)}<br>${esc(species?.nom || 'À choisir')} · ${esc(cls?.nom || 'À choisir')}<br>${esc(bg?.nom || 'À choisir')} · Niveau ${person.level}</p></div><div class="review-box"><h3>Caractéristiques de base</h3><p>${stats.map(s => `${s} ${person.scores[s] ?? '—'}`).join(' · ')}</p><p>${person.statsMethod === 'physical' ? 'Dés physiques · résultats saisis' : person.statsMethod === 'virtual' ? 'Dés de l’application' : 'Valeurs standard'}</p></div><div class="review-box full"><h3>Équipement choisi</h3><p>${esc(eq?.contenu.join(' · ') || 'À choisir')}</p></div></div>`;
}

function legacyCharacter(){return `<a class="back" href="#personnages">← Mes personnages</a><h1>${esc(draft.name||'Personnage conservé')}</h1><p>Cette fiche a été créée avec une ancienne version des règles. Ses choix d’origine sont conservés ; ses valeurs ne sont pas recalculées avec la refonte.</p><p>Pour utiliser les règles mises à jour, créez une copie puis vérifiez ses choix. La fiche d’origine reste intacte.</p><button type="button" class="button primary" data-upgrade-copy>Créer une copie à mettre à niveau</button><details><summary>Consulter les choix d’origine</summary><p>${esc(entry('classes',draft.classId)?.nom||draft.classId)} · Niveau ${esc(draft.level)} · ${esc(entry('species',draft.speciesId)?.nom||draft.speciesId)}</p><dl class="sheet-pairs">${Object.entries(draft.scores||{}).map(([key,value])=>`<div><dt>${esc(key)} · valeur de base</dt><dd>${esc(value??'À compléter')}</dd></div>`).join('')}</dl><p>Sorts choisis : ${[...(draft.cantrips||[]),...(draft.prepared||[])].map(id=>esc(catalogue.spells.find(x=>x.id===id)?.nom||id)).join(' · ')||'Aucun'}</p>${Object.entries(draft.details||{}).map(([key,value])=>`<p><strong>${esc(detailFields[key]||key)}</strong> : ${esc(value)}</p>`).join('')}</details>`;}

function sheet(id) {
  const person = id === 'vaelen' ? { ...initial(), name:'Vaelen Forgebrume', classId:'guerrier', speciesId:'humain', backgroundId:'soldat', equipment:'A' } : id === 'selya' ? { ...initial(), name:'Sélya Aubétoile', classId:'magicien', speciesId:'elfe', backgroundId:'sage', equipment:'A' } : draft;
  return renderSheet(person,catalogue,{example:id!=='brouillon',activeTab:activeSheetTab,savingEnabled:Boolean(accountId),saveState:{saving:cloudBusy,error:cloudSaveError,saved:Boolean(person.cloudRevision),dirty:isDirty(person),updatedAt:person.cloudUpdatedAt}});
}

function validStep() {
  if (draft.step === 0 && !draft.name.trim()) { toast('Donnez un nom à votre personnage.'); document.getElementById('name').focus(); return false; }
  if (draft.step === 1 && !currentClass()) { toast('Choisissez une classe pour continuer.'); return false; }
  if (draft.step === 2 && (!currentSpecies() || !currentBackground())) { toast('Choisissez une espèce et un historique.'); return false; }
  if (draft.step === 2) {const errors=originErrors(draft,catalogue,{levelGrants:false});if(errors.length){toast(errors[0]);return false;}}
  if (draft.step === 3) {
    if (draft.statsMethod === 'physical') {
      if (!stats.every(s => Number.isInteger(draft.scores[s]) && draft.scores[s] >= 3 && draft.scores[s] <= 18)) { toast('Saisissez six résultats entiers entre 3 et 18.'); return false; }
    } else {
      const expected = draft.statsMethod === 'virtual' ? draft.rolls.map(r => r.reduce((sum, n) => sum + n, 0) - Math.min(...r)) : [8,10,12,13,14,15];
      if (expected.length !== 6 || stats.map(s => draft.scores[s]).sort((a,b) => a-b).join(',') !== expected.sort((a,b) => a-b).join(',')) { toast(draft.statsMethod === 'virtual' ? 'Lancez six jets et utilisez chaque résultat une fois.' : 'Utilisez chacune des six valeurs une seule fois.'); return false; }
    }
    if (Object.values(backgroundBonuses(draft,currentBackground())).reduce((sum,n)=>sum+n,0)!==3) {toast('Répartissez les bonus de votre historique.');return false;}
  }
  if (draft.step === 4) {const errors=aptitudeErrors(draft,catalogue);if(errors.length){toast(errors[0]);return false;}}
  if (draft.step === 5) {const errors=spellErrors(draft,catalogue);if(errors.length){toast(errors[0]);return false;}}
  if (draft.step === 6 && (!option() || backgroundEquipmentErrors(draft,catalogue).length)) { toast('Choisissez l’équipement de votre classe et de votre historique.'); return false; }
  if (draft.step === 7) {
    const origins=originErrors(draft,catalogue,{levelGrants:false});if(origins.length){draft.step=2;save(true);drawCreation();toast(origins[0]);return false;}
    if(Object.values(backgroundBonuses(draft,currentBackground())).reduce((sum,n)=>sum+n,0)!==3){draft.step=3;save(true);drawCreation();toast('Répartissez les bonus de votre historique.');return false;}
    const aptitude=aptitudeErrors(draft,catalogue);const spells=spellErrors(draft,catalogue);
    if(aptitude.length||spells.length){draft.step=aptitude.length?4:5;save(true);drawCreation();toast((aptitude.length?aptitude:spells)[0]);return false;}
  }
  return true;
}

function drawCreation() { root.innerHTML = creation(); bind(); }
function route() {
  let hash = location.hash.slice(1);
  if (hash === 'content') { root.focus(); return; }
  if (hash === 'nouveau') {
    save(true);
    activeSheetTab='overview';cloudSaveError='';
    draft = initial();
    beforeSuggestion = null;
    suggestionFocus = null;
    save(true);
    history.replaceState(null, '', '#creation');
    hash = 'creation';
  }
  if(hash.startsWith('ouvrir/')){openCloudCharacter(hash.slice('ouvrir/'.length));return;}
  if(hash.startsWith('brouillon/')){
    const id=hash.slice('brouillon/'.length),record=localCharacters()[id];
    if(record){try{const character=usesCurrentRules(record)?validateSavedCharacter(record,catalogue).character:{...record,rulesVersion:record.rulesVersion??null};save(true);draft={...initial(),...character,cloudId:id,cloudRevision:record.cloudRevision||0,cloudUpdatedAt:record.cloudUpdatedAt||'',cloudSnapshot:record.cloudSnapshot||''};cloudSaveError='';save(true);hash='creation';history.replaceState(null,'','#creation');}catch{toast('Ce brouillon ne peut pas être ouvert. Le brouillon actuel est conservé.');hash='personnages';}}
    else hash='personnages';
  }
  if((hash==='creation'||hash==='fiche/brouillon')&&!usesCurrentRules(draft)){root.innerHTML=legacyCharacter();bind();return;}
  const isCreation = hash === 'creation';
  document.getElementById('breadcrumb').textContent = isCreation ? 'Créer un personnage' : hash.startsWith('fiche/') ? 'Fiche personnage' : 'Mes personnages';
  root.innerHTML = isCreation ? creation() : hash.startsWith('fiche/') ? sheet(hash.split('/')[1]) : characters();
  bind();
  window.scrollTo(0, 0);
}

function bind() {
  root.querySelector('[data-upgrade-copy]')?.addEventListener('click',()=>{save(true);draft=upgradedCharacterCopy(draft,crypto.randomUUID());beforeSuggestion=null;save(true);history.replaceState(null,'','#creation');route();toast('Copie créée : vérifiez les choix avec les nouvelles règles. L’original est conservé.');});
  root.querySelectorAll('[data-class-select]').forEach(input=>input.addEventListener('change',()=>{draft.classChoices??={};const key=input.dataset.classSelect,values=draft.classChoices[key]||[];draft.classChoices[key]=input.checked?[...values,input.dataset.classValue]:values.filter(v=>v!==input.dataset.classValue);if(key==='companion')reconcilePrimalDamage(draft,catalogue);pruneSpellChoices(draft,catalogue);save(true);drawCreation();}));
  root.querySelectorAll('[data-class-free]').forEach(input=>input.addEventListener('input',()=>{draft.classChoices??={};draft.classChoices[input.dataset.classFree]??=[];draft.classChoices[input.dataset.classFree][+input.dataset.classIndex]=input.value;save(true);}));
  root.querySelectorAll('[data-advance-mode]').forEach(button=>button.addEventListener('click',()=>{
    const level=button.dataset.advanceLevel;draft.advancements[level]={...advancementInitial(),mode:button.dataset.advanceMode};draft.originGrants[`level${level}`]=grantInitial();reconcileOrigins(draft,catalogue);save(true);drawCreation();
  }));
  root.querySelectorAll('[data-advance-field],[data-advance-point]').forEach(input=>input.addEventListener('change',()=>{
    const level=input.dataset.advanceLevel,choice=draft.advancements[level]??=advancementInitial();
    if(input.dataset.advancePoint!==undefined){choice.abilities=[choice.abilities[0]||'',choice.abilities[1]||''];choice.abilities[Number(input.dataset.advancePoint)]=input.value;}
    else{choice[input.dataset.advanceField]=input.value;if(input.dataset.advanceField==='featId'){choice.abilities=[];choice.featAbility='';choice.notes='';choice.choices=featChoicesInitial();draft.originGrants[`level${level}`]=grantInitial();}}
    reconcileOrigins(draft,catalogue);save(true);drawCreation();
    root.querySelector(`[data-advance-level="${level}"][${input.dataset.advancePoint!==undefined?`data-advance-point="${input.dataset.advancePoint}"`:`data-advance-field="${input.dataset.advanceField}"`}]`)?.focus({preventScroll:true});
  }));
  root.querySelectorAll('[data-feat-choice],[data-feat-ritual],[data-feat-resistance]').forEach(input=>input.addEventListener('change',()=>{
    const choice=draft.advancements[input.dataset.featLevel];choice.choices={...featChoicesInitial(),...choice.choices};
    if(input.dataset.featChoice)choice.choices[input.dataset.featChoice]=input.value;
    else if(input.dataset.featResistance)choice.choices.resistances=input.checked?[...choice.choices.resistances,input.dataset.featResistance]:choice.choices.resistances.filter(v=>v!==input.dataset.featResistance);
    else choice.choices.rituals=input.checked?[...choice.choices.rituals,input.dataset.featRitual]:choice.choices.rituals.filter(id=>id!==input.dataset.featRitual);
    reconcileOrigins(draft,catalogue);pruneSpellChoices(draft,catalogue);save(true);drawCreation();
  }));
  root.querySelectorAll('[data-advance-notes]').forEach(input=>input.addEventListener('input',()=>{draft.advancements[input.dataset.advanceNotes].notes=input.value;save(true);}));
  root.querySelectorAll('[data-save-character]').forEach(button=>button.addEventListener('click',saveCloudCharacter));
  document.getElementById('refresh-characters')?.addEventListener('click',async()=>{await refreshCloudCharacters();route();});
  const sheetTabs=[...root.querySelectorAll('[data-sheet-tab]')];
  sheetTabs.forEach((button,index)=>{
    button.addEventListener('click',()=>{
      activeSheetTab=button.dataset.sheetTab;
      sheetTabs.forEach(tab=>{const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
      root.querySelectorAll('.sheet-tab-panel').forEach(panel=>panel.hidden=panel.id!==`sheet-panel-${activeSheetTab}`);
      const panel=document.getElementById(`sheet-panel-${activeSheetTab}`);
      if(panel.getBoundingClientRect().top<button.closest('.sheet-tabs').getBoundingClientRect().bottom)panel.scrollIntoView({block:'start'});
    });
    button.addEventListener('keydown',event=>{
      const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
      const target=event.key==='Home'?0:event.key==='End'?sheetTabs.length-1:offset?(index+offset+sheetTabs.length)%sheetTabs.length:null;
      if(target===null)return;event.preventDefault();sheetTabs[target].click();sheetTabs[target].focus();
    });
  });
  document.getElementById('print-sheet')?.addEventListener('click',()=>window.print());
  root.querySelectorAll('[data-sheet-detail]').forEach(input=>input.addEventListener('input',()=>{
    draft.details??={};draft.details[input.dataset.sheetDetail]=input.value;save(true);
  }));
  document.getElementById('save-sheet-details')?.addEventListener('click',()=>{save(true);route();toast('Les détails du personnage ont été enregistrés.');});
  document.getElementById('level')?.addEventListener('change', event => {
    draft.level = Number(event.target.value);
    document.getElementById('summary-level').textContent = `Niveau ${draft.level} · D&D 2024`;
    if(draft.level<3) draft.subclassId='';
    reconcileOrigins(draft,catalogue);
    pruneSpellChoices(draft,catalogue);
    save(true);
  });
  document.getElementById('name')?.addEventListener('input', event => {
    draft.name = event.target.value;
    document.getElementById('summary-name').textContent = draft.name || 'Une histoire à écrire';
    save(true);
  });
  root.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.choice === 'classId' && draft.classId !== button.dataset.id) { draft.equipment='';draft.divineOrder='';draft.subclassId='';draft.classSkills=[];draft.hpRolls={};draft.classChoices={};draft.advancements={};draft.sacredStrike='';beforeSuggestion=null;suggestionFocus=null; }
    if (button.dataset.choice === 'backgroundId' && draft.backgroundId !== button.dataset.id) {draft.bonusMode='';draft.bonusTwo='';draft.bonusOne='';draft.classSkills=[];draft.originGrants.background=grantInitial();draft.backgroundTool='';draft.backgroundEquipment='';draft.backgroundKit='';}
    if (button.dataset.choice === 'speciesId' && draft.speciesId !== button.dataset.id) {draft.variantId='';draft.speciesSize='';draft.speciesSkill='';draft.speciesAncestry='';draft.speciesCastingAbility='';draft.originFeatId='';draft.originGrants.human=grantInitial();}
    draft[button.dataset.choice] = button.dataset.id;
    if(button.dataset.choice==='backgroundEquipment'&&draft.backgroundEquipment!=='A')draft.backgroundKit='';
    reconcileOrigins(draft,catalogue);
    draft.classSkills=draft.classSkills.filter(name=>classSkills(draft,catalogue).options.includes(name));
    pruneSpellChoices(draft,catalogue);
    save(true);
    drawCreation();
    root.querySelector(`[data-choice="${button.dataset.choice}"][data-id="${button.dataset.id}"]`)?.focus({preventScroll:true});
  }));
  root.querySelectorAll('[data-stat]').forEach(input => input.addEventListener('input', () => {
    draft.scores[input.dataset.stat] = input.value === '' ? null : Number(input.value);
    beforeSuggestion = null;
    const suggest = document.getElementById('suggest-stats');
    if (suggest) suggest.disabled = suggestionPool().length !== 6;
    const undo = document.getElementById('undo-suggestion');
    if (undo) undo.disabled = true;
    save(true);
  }));
  document.getElementById('suggest-stats')?.addEventListener('click', () => {
    if (!suggestStats(document.getElementById('suggest-focus')?.value)) return;
    save(true); drawCreation();
    document.getElementById('suggest-stats')?.focus({preventScroll:true});
    toast('Répartition suggérée. Vos six résultats sont conservés.');
  });
  document.getElementById('undo-suggestion')?.addEventListener('click', () => {
    if (!beforeSuggestion) return;
    draft.scores = beforeSuggestion;
    beforeSuggestion = null;
    save(true); drawCreation();
    document.getElementById('suggest-stats')?.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-method]').forEach(button => button.addEventListener('click', () => {
    if (draft.statsMethod === button.dataset.method) return;
    draft.statsMethod = button.dataset.method;
    beforeSuggestion = null;
    draft.rolls = [];
    draft.scores = Object.fromEntries(stats.map((s, i) => [s, draft.statsMethod === 'standard' ? [15,14,13,12,10,8][i] : null]));
    save(true); drawCreation();
    root.querySelector(`[data-method="${button.dataset.method}"]`)?.focus({preventScroll:true});
  }));
  document.getElementById('roll-stats')?.addEventListener('click', () => {
    beforeSuggestion = null;
    draft.rolls = stats.map(() => Array.from({length:4}, rollD6));
    draft.scores = Object.fromEntries(stats.map((s, i) => [s, draft.rolls[i].reduce((sum,n) => sum+n,0) - Math.min(...draft.rolls[i])]));
    save(true); drawCreation();
    document.getElementById('roll-stats')?.focus({preventScroll:true});
  });
  root.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => { draft.step = Number(button.dataset.step); save(true); drawCreation(); }));
  document.getElementById('next')?.addEventListener('click', () => {
    if (!validStep()) return;
    if (draft.step === 7) { location.hash = 'fiche/brouillon'; return; }
    const steps=visibleSteps(draft,catalogue);
    draft.step=steps[steps.indexOf(draft.step)+1];
    save(true);
    drawCreation();
    root.querySelector('.form-panel').scrollIntoView({block:'start'});
  });
  document.getElementById('previous')?.addEventListener('click', () => {
    if (!draft.step) { location.hash = 'personnages'; return; }
    const steps=visibleSteps(draft,catalogue);
    draft.step=steps[steps.indexOf(draft.step)-1];save(true);drawCreation();
  });
  document.getElementById('save')?.addEventListener('click', () => save());
  document.getElementById('search')?.addEventListener('input', event => {
    const query = event.target.value.toLocaleLowerCase('fr').trim();
    root.querySelectorAll('[data-search]').forEach(card => { card.hidden = !card.dataset.search.includes(query); });
  });
  root.querySelectorAll('[data-bonus-mode]').forEach(button=>button.addEventListener('click',()=>{draft.bonusMode=button.dataset.bonusMode;save(true);drawCreation();}));
  root.querySelectorAll('[data-bonus-select]').forEach(input=>input.addEventListener('change',()=>{draft[input.dataset.bonusSelect]=input.value;save(true);drawCreation();}));
  root.querySelectorAll('[data-class-skill]').forEach(input=>input.addEventListener('change',()=>{
    const name=input.dataset.classSkill;
    draft.classSkills=input.checked?[...draft.classSkills,name]:draft.classSkills.filter(s=>s!==name);
    save(true);drawCreation();
    [...root.querySelectorAll('[data-class-skill]')].find(el=>el.dataset.classSkill===name)?.focus({preventScroll:true});
  }));
  document.getElementById('hp-mode')?.addEventListener('change',event=>{draft.hpMode=event.target.value;draft.hpRolls={};save(true);drawCreation();});
  root.querySelectorAll('[data-hp-level]').forEach(input=>input.addEventListener('input',()=>{draft.hpRolls[input.dataset.hpLevel]=input.value===''?null:Number(input.value);save(true);document.getElementById('hp-total').textContent=hitPoints(draft,catalogue)??'À compléter';}));
  root.querySelectorAll('[data-roll-hp]').forEach(button=>button.addEventListener('click',()=>{
    const die=Number(currentClass().niveaux['0'].de_vie.type.match(/d(\d+)/)[1]);
    const value=new Uint8Array(1);do{crypto.getRandomValues(value);}while(value[0]>=256-256%die);
    draft.hpRolls[button.dataset.rollHp]=value[0]%die+1;save(true);drawCreation();
  }));
  root.querySelectorAll('[data-spell-kind]').forEach(input=>input.addEventListener('change',()=>{
    const kind=input.dataset.spellKind;const id=input.dataset.spellId;
    draft[kind]=input.checked?[...draft[kind],id]:draft[kind].filter(s=>s!==id);
    pruneSpellChoices(draft,catalogue);save(true);drawCreation();
    [...root.querySelectorAll('[data-spell-kind]')].find(el=>el.dataset.spellKind===kind&&el.dataset.spellId===id)?.focus({preventScroll:true});
  }));
  document.getElementById('spell-search')?.addEventListener('input',event=>{spellSearch=event.target.value;root.querySelectorAll('[data-spell-card]').forEach(card=>card.hidden=!card.dataset.spellCard.includes(spellSearch.toLocaleLowerCase('fr')));});
  root.querySelectorAll('[data-origin-field]').forEach(input=>input.addEventListener('change',()=>{
    if(input.dataset.originField==='originFeatId'&&draft.originFeatId!==input.value) draft.originGrants.human=grantInitial();
    draft[input.dataset.originField]=input.value;updateOriginChoices();
    [...root.querySelectorAll('[data-origin-field]')].find(el=>el.dataset.originField===input.dataset.originField)?.focus({preventScroll:true});
  }));
  root.querySelectorAll('[data-grant-field]').forEach(input=>input.addEventListener('change',()=>{
    const grant=draft.originGrants[input.dataset.grantSlot];
    if(input.dataset.grantField==='magicList'&&grant.magicList!==input.value){grant.cantrips=[];grant.spell='';}
    grant[input.dataset.grantField]=input.value;updateOriginChoices();
  }));
  root.querySelectorAll('[data-grant-choice]').forEach(input=>input.addEventListener('change',()=>{
    const grant=draft.originGrants[input.dataset.grantSlot];const id=input.dataset.grantChoice;
    grant.proficiencies=input.checked?[...new Set([...grant.proficiencies,id])]:grant.proficiencies.filter(value=>value!==id);
    updateOriginChoices();
    [...root.querySelectorAll('[data-grant-choice]')].find(el=>el.dataset.grantSlot===input.dataset.grantSlot&&el.dataset.grantChoice===id)?.focus({preventScroll:true});
  }));
  root.querySelectorAll('[data-origin-cantrip]').forEach(input=>input.addEventListener('change',()=>{
    const grant=draft.originGrants[input.dataset.grantSlot];const id=input.dataset.originCantrip;
    grant.cantrips=input.checked?[...new Set([...grant.cantrips,id])]:grant.cantrips.filter(value=>value!==id);
    updateOriginChoices();
    [...root.querySelectorAll('[data-origin-cantrip]')].find(el=>el.dataset.grantSlot===input.dataset.grantSlot&&el.dataset.originCantrip===id)?.focus({preventScroll:true});
  }));
}

async function init() {
  try {
    const response = await fetch('./catalogue.json');
    if (!response.ok) throw new Error('catalogue');
    catalogue = await response.json();
    if(usesCurrentRules(draft)){
    if (!currentClass()) { draft.classId = ''; draft.equipment = ''; draft.step = Math.min(draft.step, 1); }
    if (!currentSpecies() || !currentBackground()) draft.step = Math.min(draft.step, 2);
    if (!draft.name.trim()) draft.step = 0;
    reconcileOrigins(draft,catalogue);
    draft.classSkills=draft.classSkills.filter(name=>classSkills(draft,catalogue).options.includes(name));
    pruneSpellChoices(draft,catalogue);
    if(!visibleSteps(draft,catalogue).includes(draft.step)) draft.step=4;
    }
    save(true);
    await refreshCloudCharacters();
    window.addEventListener('hashchange', route);
    route();
  } catch {
    root.innerHTML = '<h1>Le grimoire ne s’ouvre pas.</h1><p>Le catalogue local est indisponible. Relancez le serveur de prévisualisation, puis rechargez cette page.</p>';
  }
}
init();
