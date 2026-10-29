import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
const snapshot=JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8'));
const c=buildCatalogue(snapshot);
const state=()=>({name:'Test',classId:'clerc',level:3,speciesId:'humain',backgroundId:'charlatan',equipment:'A',backgroundEquipment:'A',scores:{FOR:12,DEX:11,CON:14,INT:14,SAG:18,CHA:9},bonusMode:'three',divineOrder:'Thaumaturge',subclassId:'clerc_domaine_vie',classSkills:['Médecine','Religion'],speciesSkill:'Perception',speciesSize:'M',originFeatId:'robuste',hpMode:'fixed',cantrips:['assistance'],prepared:[]});
test('Fiche du clerc 3 : valeurs finales, CA portée, PV et sauvegardes',()=>{
  const m=sheetModel(state(),c);assert.equal(m.hp,30);assert.equal(m.ac,16);assert.equal(m.initiative,1);
  assert.equal(m.saves.find(s=>s.ability==='SAG').value,6);assert.equal(m.saves.find(s=>s.ability==='CHA').value,2);
  assert.equal(m.magic.dc,14);assert.equal(m.magic.attack,6);
});
test('Compétences : bonus Thaumaturge et origine, sans inventer un lien absent',()=>{
  const m=sheetModel(state(),c);assert.equal(m.skills.find(s=>s.nom==='Religion').value,8);
  assert.equal(m.skills.find(s=>s.nom==='Arcanes').value,6);assert.equal(m.passive,16);
  const missing=m.skills.find(s=>s.nom==='Escamotage');assert.equal(missing.trained,true);assert.equal(missing.value,3);const incomplete=structuredClone(c);incomplete.skills=incomplete.skills.filter(s=>s.nom!=='Escamotage');assert.equal(sheetModel(state(),incomplete).skills.find(s=>s.nom==='Escamotage').value,null);
});
test('Matériel de classe et historique réunis, monnaies additionnées, arme maîtrisée',()=>{
  const m=sheetModel(state(),c);assert.equal(m.money.po,22);assert.equal(m.attacks[0].attack,3);assert.equal(m.attacks[0].damageBonus,1);
  assert.equal(m.inventory.find(i=>i.nom==='Bouclier').quantity,1);assert.ok(m.tools.includes('Matériel de contrefaçon'));
});
test('Équipement non choisi, caractéristiques absentes : pas de valeurs fabriquées',()=>{
  const s=state();s.equipment='';s.scores=Object.fromEntries(Object.keys(s.scores).map(k=>[k,null]));
  const m=sheetModel(s,c);assert.equal(m.ac,null);assert.equal(m.hp,null);assert.equal(m.magic.dc,null);assert.equal(m.passive,null);assert.equal(m.attacks.length,0);assert.ok(m.errors.length>0);
});
test('CA : DEX négative conservée et plafonnement de l’armure intermédiaire',()=>{
  const s=state();s.scores.DEX=18;assert.equal(sheetModel(s,c).ac,17);s.scores.DEX=3;assert.equal(sheetModel(s,c).ac,12);
});
test('Sorts choisis et sorts du domaine séparés, aptitudes limitées au niveau',()=>{
  const m=sheetModel(state(),c);assert.equal(m.spells.length,5);assert.equal(m.spells.filter(s=>s.always).length,4);
  assert.ok(m.subclassFeatures.some(f=>f.nom==='Disciple de la vie'));assert.ok(!m.subclassFeatures.some(f=>f.nom==='Guérison bénie'));
  const s=state();s.level=1;assert.equal(sheetModel(s,c).subclassFeatures.length,0);
});
test('Descriptions, personnalité et effets rendus sans interpréter du HTML utilisateur',()=>{
  const s=state();s.name='<img src=x onerror=alert(1)>';s.details={story:'<script>test</script>',languages:'Langue de test'};
  const html=renderSheet(s,c);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;test'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Langue de test'));assert.ok(html.includes('Canal divin'));assert.ok(html.includes('Bannissement des morts-vivants'));assert.ok(html.includes('Composantes, effets et paramètres'));
});
test('Construire et afficher une fiche ne modifie ni le personnage ni la BDD',()=>{
  const s=state(),before=JSON.stringify(s),data=JSON.stringify(c);renderSheet(s,c);assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(c),data);
});
test('La navigation donne accès à six rubriques et conserve toutes les informations de la fiche',()=>{
  const html=renderSheet(state(),c);
  assert.equal((html.match(/role="tab" /g)||[]).length,6);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,6);
  assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
  assert.match(html,/id="sheet-tab-overview"[^>]*aria-selected="true"/);
  for(const text of ['Caractéristiques','Compétences','Attaques et armes','Disciple de la vie','Bénédiction','Équipement et monnaies','Personnalité et histoire'])assert.ok(html.includes(text));
});
test('Revenir sur Histoire conserve l’onglet et les champs saisis',()=>{
  const s=state();s.details={story:'Histoire conservée',languages:'Langue conservée'};
  const html=renderSheet(s,c,{activeTab:'story'});
  assert.match(html,/id="sheet-tab-story"[^>]*aria-selected="true"/);
  assert.match(html,/id="sheet-panel-story"[^>]*tabindex="0" >/);
  assert.ok(html.includes('Histoire conservée'));assert.ok(html.includes('Langue conservée'));
  assert.match(html,/id="sheet-panel-overview"[^>]* hidden>/);
});
test('Un onglet inconnu revient sur la vue d’ensemble sans supprimer de rubrique',()=>{
  const html=renderSheet(state(),c,{activeTab:'invalid'});
  assert.match(html,/id="sheet-tab-overview"[^>]*aria-selected="true"/);
  assert.equal((html.match(/role="tabpanel"/g)||[]).length,6);
});
test('Une fiche connectée propose l’enregistrement, puis distingue une version enregistrée de modifications locales',()=>{
  const s=state();let html=renderSheet(s,c,{savingEnabled:true});assert.match(html,/data-save-character >Enregistrer le personnage/);
  html=renderSheet(s,c,{savingEnabled:true,saveState:{saved:true,dirty:false}});assert.ok(html.includes('Enregistré dans votre compte.'));assert.ok(html.includes('Enregistrer les modifications'));
  html=renderSheet(s,c,{savingEnabled:true,saveState:{saved:true,dirty:true}});assert.ok(html.includes('Modifications à enregistrer.'));
});
