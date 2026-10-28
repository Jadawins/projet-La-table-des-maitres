import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {classProfile,finalScores,modifier} from '../maquette/character-rules.mjs';
import {classChoiceSpecs,classChoiceErrors,shapePool} from '../maquette/class-profiles.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {classTraining} from '../maquette/progression.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
const ids=['barbare','rodeur','barde','druide'];
for(const id of ids)for(const sub of c.subclasses.filter(s=>s.classe_parente===id))for(let level=1;level<=20;level++)test(`${id} · ${sub.nom} · ${level} : fiche et sauvegarde`,()=>{
  const s=classFixture(c,id,level,sub.id),m=sheetModel(s,c),p=classProfile(s,c);
  assert.deepEqual(m.errors,[]);
  const saved=validateSavedCharacter(characterSnapshot(s),c);
  assert.equal(saved.status,'ready');
  assert.deepEqual(saved.character.classChoices,s.classChoices);
  assert.deepEqual(JSON.parse(JSON.stringify(sheetModel(saved.character,c))),JSON.parse(JSON.stringify(m)));
  assert.equal(m.proficiency,2+Math.floor((level-1)/4));
  if(p.hasMagic){assert.equal(m.magic.dc,8+m.proficiency+modifier(m.scores[p.castingAbility]));assert.ok(p.prepared.length>=p.preparedCount);}
  assert.ok(p.always.every(x=>!x.unresolved));
  assert.doesNotThrow(()=>renderSheet(s,c));
});
test('Les huit terrains sont reliés à tous les paliers et restent hors quota',()=>{
  for(const terrain of Object.keys(c.classSupplements.terrainSpells))for(const level of [3,5,7,9,20]){
    const s=classFixture(c,'druide',level,'druide_cercle_terre');s.classChoices.terrain=[terrain];
    const p=classProfile(s,c);
    assert.deepEqual(p.missingSpells,[]);
    assert.equal(p.always.filter(x=>x.grantSource.startsWith('Sorts de terrain')).length,2*Math.min(4,(level-1)/2));
    assert.ok(p.always.every(x=>!p.prepared.some(y=>y.id===x.id)));
  }
});
test('Barbare : CA, attaques, paliers de rage, FOR/CON 20 et PV rétroactifs',()=>{
  const low=classFixture(c,'barbare',1),high=classFixture(c,'barbare',20,'barbare_voie_zelateur');
  const m=sheetModel(low,c),h=sheetModel(high,c);
  assert.equal(m.ac,10+m.mods.DEX+m.mods.CON);
  assert.equal(h.scores.FOR,20);assert.equal(h.scores.CON,24);
  assert.equal(h.hp,12+h.mods.CON+19*(7+h.mods.CON)+40);
  assert.equal(h.attacksPerAction,2);assert.equal(classProfile(high,c).rage,6);
  assert.equal(h.ac,10+h.mods.DEX+h.mods.CON);
  assert.equal(h.inventory.find(x=>x.nom==='Hachette').quantity,4);
});
test('Barde : CHA, expertise, polyvalence et instrument de départ',()=>{
  const s=classFixture(c,'barde',9,'barde_college_savoir'),m=sheetModel(s,c);
  assert.equal(m.magic.ability,'CHA');assert.equal(m.skills.filter(x=>x.expertise).length,4);
  for(const skill of m.skills.filter(x=>!x.trained))assert.equal(skill.value,m.mods[skill.ability]+2);
  assert.ok(m.tools.includes('chalemie'));assert.ok(m.tools.includes('cor'));assert.ok(m.tools.includes('cornemuse'));
  assert.ok(m.inventory.some(x=>x.nom===m.classEffects.equipmentInstrument));
});
test('Druide : vocation, formes autorisées, Mage et gardien ne se cumulent pas',()=>{
  const s=classFixture(c,'druide',2),p=classProfile(s,c);
  s.classChoices.vocationnaturelle=['Mage'];assert.equal(classProfile(s,c).cantripCount,p.row.sorts_mineurs+1);
  assert.ok(!classTraining(s,c).weapons.includes('armes_de_guerre'));
  s.classChoices.vocationnaturelle=['Gardien'];assert.ok(classTraining(s,c).weapons.includes('armes_de_guerre'));
  assert.ok(shapePool(s,c).every(f=>f.fp_numerique<=.25&&!f.vitesse.vol));
  const moon=classFixture(c,'druide',6,'druide_cercle_lune');assert.equal(shapePool(moon,c).filter(f=>f.type==='Elemental').length,4);
});
test('Les choix manquants, doublés ou hors liste empêchent la fiche complète',()=>{
  for(const id of ids){const sub=c.subclasses.find(s=>s.classe_parente===id),s=classFixture(c,id,20,sub.id);for(const spec of classChoiceSpecs(s,c)){
    const bad=structuredClone(s);bad.classChoices[spec.key]=[];assert.ok(classChoiceErrors(bad,c).length);assert.equal(validateSavedCharacter(bad,c).status,'draft');
  }}
});
test('Sens, déplacements et immunités restent liés à leur niveau et sous-classe',()=>{
  const sea=sheetModel(classFixture(c,'druide',14,'druide_cercle_mers'),c);assert.deepEqual(sea.immunities,['froid','tonnerre']);assert.equal(sea.swim,12);
  const ranger=sheetModel(classFixture(c,'rodeur',18,'rodeur_traqueur_tenebres'),c);assert.equal(ranger.blindvision,9);assert.ok(ranger.resistances.includes('nécrotique'));assert.equal(ranger.swim,ranger.speed);
  const bard=classFixture(c,'barde',6,'barde_college_vaillance');assert.equal(sheetModel(bard,c).attacksPerAction,2);assert.ok(classTraining(bard,c).weapons.includes('armes_de_guerre'));
});
test('Styles de combat : Archerie, Défense et Combattant naturel',()=>{
  const archer=classFixture(c,'rodeur',6,'rodeur_chasseur'),base=sheetModel(archer,c);
  archer.classChoices.combatStyle=['style_defense'];const defense=sheetModel(archer,c);assert.equal(defense.ac,base.ac+1);
  const bow=m=>m.attacks.find(a=>a.nom==='Arc long');assert.equal(bow(base).attack,bow(defense).attack+2);
  archer.classChoices.combatStyle=['natural'];const p=classProfile(archer,c);assert.equal(p.cantripCount,2);assert.ok(p.cantrips.every(s=>s.classes.includes('Druide')));
  archer.cantrips=p.cantrips.slice(0,2).map(s=>s.id);assert.deepEqual(sheetModel(archer,c).errors,[]);
});
test('Le Mage et Magie puissante du druide chiffrent leurs bonus sans effet clérical',()=>{
  const s=classFixture(c,'druide',15,'druide_cercle_mers');s.classChoices.vocationnaturelle=['Mage'];s.classChoices.elementalStrike=['Magie puissante'];
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);
  const m=sheetModel(s,c),nature=m.skills.find(x=>x.nom==='Nature');assert.ok(nature.value>=m.mods.INT+m.mods.SAG);
  const cantrip=m.spells.find(x=>x.niveau===0&&x.source==='Druide');assert.equal(cantrip.cantripBonus,m.mods.SAG);
  assert.ok(m.spells.every(x=>!x.featRules.some(r=>r.startsWith('Frappe consacrée'))));
});
test('Séduction utilise le meilleur de CHA et DEX uniquement sans armure ni bouclier',()=>{
  const s=classFixture(c,'barde',3,'barde_college_seduction',{equipment:'B'}),m=sheetModel(s,c);assert.equal(m.ac,13);
  s.equipment='A';assert.equal(sheetModel(s,c).ac,12);
});
test('Compagnon : PV du MJ, amélioration de CA et absence de mutation du profil source',()=>{
  const s=classFixture(c,'rodeur',11,'rodeur_belluaire');s.classChoices.companionHp=['2'];s.classChoices.companion11=['Armure naturelle'];
  const m=sheetModel(s,c),original=c.shapeForms.find(f=>f.slug===s.classChoices.companion[0]);
  assert.equal(m.classEffects.companion.pv,44+m.mods.SAG+2);assert.equal(m.classEffects.companion.ca,original.ca+1);assert.notEqual(m.classEffects.companion,original);
});
test('Une classe inconnue est refusée sans bénéficier de choix empruntés',()=>{
  const s=classFixture(c,'barbare',1);s.classId='inconnue';assert.equal(classProfile(s,c),null);assert.throws(()=>validateSavedCharacter(s,c));
});
