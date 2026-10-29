import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classChoiceSpecs,classChoiceErrors} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {primalProfiles,reconcilePrimalDamage} from '../maquette/beast-companion.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
for(let level=1;level<=20;level++)for(const [id,hp,die,damage,speed]of [
  ['terre',5+5*level,'d8','1d8',{marche:12,escalade:12}],
  ['mer',5+5*level,'d8','1d6',{marche:1.5,nage:18}],
  ['ciel',4+4*level,'d6','1d4',{marche:3,vol:18}],
])test(`Belluaire 2024 · ${id} · niveau ${level}`,()=>{
  const s=classFixture(c,'rodeur',level,'rodeur_belluaire');
  if(level>=3){s.classChoices.companion=[id];s.classChoices.companionDamage=[id==='ciel'?'tranchants':'perforants'];s.classChoices.companionAppearance=['Compagnon'];}
  const m=sheetModel(s,c),beast=m.classEffects.companion;
  assert.deepEqual(m.errors,[]);
  assert.ok(!classChoiceSpecs(s,c).some(spec=>['companionHp','companionUpgrade','companion11'].includes(spec.key)));
  if(level<3){assert.equal(beast,null);return;}
  assert.equal(beast.pv,hp);assert.equal(beast.des_de_vie,level+die);
  assert.equal(beast.ca,13+m.mods.SAG);
  assert.equal(beast.frappe.attaque,m.magic.attack);
  assert.match(beast.frappe.degats,new RegExp('^'+damage));
  assert.deepEqual(beast.vitesse,speed);
  assert.equal(beast.sens.perception_passive,12+m.proficiency);
  assert.equal(beast.jets_de_sauvegarde.INT,-1+m.proficiency);
  assert.equal(beast.frappe.nombre,level>=11?2:1);
  assert.equal(Boolean(beast.frappe.option),level>=7);
  assert.equal(Boolean(beast.frappe.marque_du_chasseur),level>=11);
  if(level>=11)assert.ok(beast.frappe.marque_du_chasseur.includes(level>=20?'1d10':'1d6'));
  assert.equal(Boolean(beast.partage_de_sorts),level>=15);
  if(id==='mer')assert.equal(beast.frappe.dd_evasion,m.magic.dc);
  const saved=validateSavedCharacter(characterSnapshot(s),c);
  assert.equal(saved.status,'ready',saved.issues.join('; '));
  assert.deepEqual(sheetModel(saved.character,c).classEffects.companion,beast);
  assert.doesNotThrow(()=>renderSheet(s,c));
});

test('Changer de profil conserve seulement les types autorisés et ne présélectionne rien',()=>{
  const s=classFixture(c,'rodeur',3,'rodeur_belluaire');s.classChoices.companion=['ciel'];s.classChoices.companionDamage=['tranchants'];
  s.classChoices.companion=['mer'];reconcilePrimalDamage(s,c);
  assert.deepEqual(s.classChoices.companionDamage,[]);assert.ok(classChoiceErrors(s,c).length);
  s.classChoices.companionDamage=['perforants'];s.classChoices.companion=['terre'];reconcilePrimalDamage(s,c);
  assert.deepEqual(s.classChoices.companionDamage,['perforants']);
});

test('Les PV ne dépendent pas de SAG ; aucune CA ou attaque fabriquée sans SAG',()=>{
  const s=classFixture(c,'rodeur',3,'rodeur_belluaire');s.scores.SAG=null;
  const beast=sheetModel(s,c).classEffects.companion;
  assert.equal(beast.pv,20);assert.equal(beast.ca,null);assert.equal(beast.frappe.attaque,null);assert.equal(beast.frappe.degats,'À compléter');
});

test('Une apparence laissée libre ne bloque pas les choix mécaniques complets',()=>{
  const state=classFixture(c,'rodeur',3,'rodeur_belluaire');state.classChoices.companionAppearance=[];
  assert.deepEqual(classChoiceErrors(state,c),[]);
  assert.equal(validateSavedCharacter(characterSnapshot(state),c).status,'ready');
});

test('Les anciennes améliorations n’ajoutent ni PV, ni CA, ni vitesse, sans mutation du catalogue',()=>{
  const before=JSON.stringify(c),s=classFixture(c,'rodeur',20,'rodeur_belluaire');
  const expected=sheetModel(s,c).classEffects.companion;
  s.classChoices.companionHp=['999'];s.classChoices.companion11=['Armure naturelle'];s.classChoices.companionUpgrade=['Ancien don'];
  assert.deepEqual(sheetModel(s,c).classEffects.companion,expected);assert.equal(JSON.stringify(c),before);
  assert.equal(primalProfiles({...s,level:2},c).length,0);
});
