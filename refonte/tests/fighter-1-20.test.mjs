import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classProfile,visibleSteps,aptitudeErrors} from '../maquette/character-rules.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {improvementLevels,advancementInitial,eligibleLevelFeats} from '../maquette/progression.mjs';
import {classSpellPool,ritualPool} from '../maquette/feat-effects.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
const fixture=(level,sub='guerrier_champion')=>classFixture(c,'guerrier',level,sub);
for(const sub of c.subclasses.filter(x=>x.classe_parente==='guerrier'))for(let level=1;level<=20;level++)test(`${sub.nom} ${level} : BDD, calculs, fiche, sauvegarde`,()=>{
  const s=fixture(level,sub.id),m=sheetModel(s,c),p=classProfile(s,c);
  assert.deepEqual(m.errors,[]);
  assert.equal(m.hp,10+m.mods.CON+(level-1)*(6+m.mods.CON)+(level>=19?40:0));
  assert.equal(m.attacksPerAction,level>=20?4:level>=11?3:level>=5?2:1);
  assert.equal(m.proficiency,2+Math.floor((level-1)/4));
  assert.equal(s.classChoices.weaponMasteries.length,level>=16?6:level>=10?5:level>=4?4:3);
  const saved=validateSavedCharacter(characterSnapshot(s),c);assert.equal(saved.status,'ready');
  assert.deepEqual(JSON.parse(JSON.stringify(sheetModel(saved.character,c))),JSON.parse(JSON.stringify(m)));
  assert.doesNotThrow(()=>renderSheet(s,c));
  const magic=sub.id==='guerrier_chevalier_occulte'&&level>=3;
  assert.equal(visibleSteps(s,c).includes(5),magic);assert.equal(p.hasMagic,magic);
  if(magic){assert.equal(p.castingAbility,'INT');assert.equal(p.cantripCount,level>=10?3:2);assert.equal(m.magic.dc,8+m.proficiency+m.mods.INT);assert.ok(p.prepared.every(x=>x.classes.includes('Magicien')));}
});
test('Les paliers supplémentaires 6 et 14 sont exigés et conservés',()=>{
  const s=fixture(20);assert.deepEqual(improvementLevels(s,c),[4,6,8,12,14,16,19]);
  for(const n of [6,14]){const copy=structuredClone(s);delete copy.advancements[n];assert.ok(aptitudeErrors(copy,c).some(e=>e.includes('Niveau '+n)));}
});
test('Champion : deux styles distincts, critique, Athlète remarquable sans JS inventé',()=>{
  const s=fixture(15),m=sheetModel(s,c);assert.equal(s.classChoices.combatStyle10.length,1);
  s.classChoices.combatStyle10=s.classChoices.combatStyle;assert.ok(aptitudeErrors(s,c).length);
  assert.equal(m.initiative,m.mods.DEX);
  for(const skill of m.skills.filter(x=>!x.trained&&['FOR','DEX','CON'].includes(x.ability)))assert.equal(skill.value,m.mods[skill.ability]);
  assert.equal(m.saves.find(x=>x.ability==='DEX').value,m.mods.DEX);
});
test('Maître de guerre : quantités BDD, DD choisi, outil et manœuvres obligatoires',()=>{
  for(const [level,known,dice]of [[3,3,'4d8'],[7,5,'5d8'],[10,7,'5d10'],[15,9,'6d10'],[18,9,'6d12']]){
    const s=fixture(level,'guerrier_maitre_guerre'),m=sheetModel(s,c);assert.equal(s.classChoices.maneuvers.length,known);assert.ok(m.classResources.some(r=>r.valeur===dice));assert.ok(m.tools.length>1);
    assert.equal(m.classResources.find(r=>r.nom==='DD des manœuvres').valeur,8+m.proficiency+m.mods.FOR);
    s.classChoices.maneuverAbility=['DEX'];assert.equal(sheetModel(s,c).classResources.find(r=>r.nom==='DD des manœuvres').valeur,8+m.proficiency+m.mods.DEX);
    s.classChoices.maneuvers=[];assert.ok(aptitudeErrors(s,c).length);
  }
});
test('Soldat psi : ressources et immunités aux seuils BDD',()=>{
  for(const [n,dice]of [[3,'4d6'],[14,'10d10'],[15,'10d10'],[18,'12d12']]){const m=sheetModel(fixture(n,'guerrier_soldat_psi'),c);assert.equal(m.classResources.find(r=>r.nom==='Dés psioniques').valeur,dice);assert.equal(m.immunities.includes('psychique'),false);assert.equal(m.resistances.includes('psychique'),n>=10);}
});
test('Chevalier occulte : emplacements, quotas, armes liées facultatives et dons magiques',()=>{
  for(const [n,prepared,slots]of [[3,3,{1:2}],[7,5,{1:4,2:2}],[13,9,{1:4,2:3,3:2}],[20,13,{1:4,2:3,3:3,4:1}]]){const s=fixture(n,'guerrier_chevalier_occulte'),p=classProfile(s,c);assert.equal(p.preparedCount,prepared);assert.deepEqual(p.slots,slots);}
  const s=fixture(8,'guerrier_chevalier_occulte');s.classChoices.boundWeapons=[];assert.equal(validateSavedCharacter(s,c).status,'ready');
  s.classChoices.boundWeapons=c.weapons.slice(0,3).map(w=>w.nom);assert.equal(validateSavedCharacter(s,c).status,'draft');
  assert.ok(classSpellPool(s,c,8).some(x=>x.classes.includes('Magicien')));assert.ok(ritualPool(s,c,8).length);
  assert.ok(eligibleLevelFeats(s,c,4,{FOR:14,DEX:12,CON:16,INT:14,SAG:16,CHA:16}).some(f=>f.id==='magie_rituelle'));
  s.level=2;assert.ok(!eligibleLevelFeats(s,c,2,{FOR:14,DEX:12,CON:16,INT:14,SAG:16,CHA:16}).some(f=>f.id==='magie_rituelle'));
});
