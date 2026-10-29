import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {applyRulesRevision} from '../rules-revision.mjs';
const snapshot=JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8'));
const c=buildCatalogue(snapshot);
const get=name=>c.masteries.find(m=>m.nom===name);
test('Poussée : jusqu’à 3 m, cible G ou inférieure, en ligne droite',()=>{
  const r=get('poussee');assert.equal(r.effets[0].distance,3);assert.equal(r.effets[0].direction,'ligne_droite');assert.deepEqual(r.conditions,[{type:'taille_max_cible',valeur:'G'}]);
});
test('Ouverture et Ralentissement exigent des dégâts et ont des durées distinctes',()=>{
  const vex=get('ouverture'),slow=get('ralentissement');
  assert.ok(vex.conditions.some(c=>c.type==='degats_infliges'));assert.equal(vex.effets[0].duree,'jusqu_a_fin_tour_suivant');
  assert.ok(slow.conditions.some(c=>c.type==='degats_infliges'));assert.equal(slow.effets[0].duree,'jusqu_a_debut_tour_suivant');assert.equal(slow.effets[0].cumul_max,3);
});
test('Enchaînement n’est pas interdit avec Avantage et ne donne pas un bonus de dégâts positif',()=>{
  const r=get('enchainement');assert.ok(!r.conditions.some(c=>c.type==='attaque_pas_avantage'));assert.ok(r.conditions.some(c=>c.type==='cible_dans_allonge_arme'));
  assert.equal(r.effets[0].limite,'1_par_tour');assert.match(r.description,/sauf s’il est négatif/);
});
test('Écorchure ne bénéficie d’aucun autre bonus et Coup double reste limité à une fois par tour',()=>{
  assert.equal(get('ecorchure').declencheur.mode,undefined);assert.match(get('ecorchure').description,/Seule l’augmentation de ce modificateur/);
  assert.equal(get('coup_double').effets[0].limite,'1_par_tour');
  const topple=get('renversement').effets[0];assert.equal(topple.caracteristique,'CON');assert.equal(topple.echec.etat,'a_terre');
});

const key=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
for(const rule of c.masteries)test(`Botte ${rule.nom} : règle lisible sur une fiche, sans appliquer un effet conditionnel permanent`,()=>{
  const weapon=c.weapons.find(w=>key(w.botte||'')===key(rule.nom));assert.ok(weapon);
  const s=classFixture(c,'guerrier',1);
  const spec=classChoiceSpecs(s,c).find(s=>s.key==='weaponMasteries');
  s.classChoices.weaponMasteries=[key(weapon.nom),...spec.options.map(o=>o.id).filter(id=>id!==key(weapon.nom))].slice(0,spec.count);
  const before=JSON.stringify(c),m=sheetModel(s,c);
  const feature=m.classFeatures.find(f=>f.nom===`Botte · ${weapon.nom} · ${weapon.botte}`);
  assert.equal(feature.description,rule.description);assert.ok(feature.description.length>40);
  const noMasteries=structuredClone(s);noMasteries.classChoices.weaponMasteries=[];const plain=sheetModel(noMasteries,c);assert.equal(m.speed,plain.speed);assert.equal(m.ac,plain.ac);
  assert.ok(renderSheet(s,c).includes(rule.description.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));
  assert.equal(JSON.stringify(c),before);
});

test('Les règles identifiées par leur nom ont aussi des préconditions de correction',()=>{
  const input=structuredClone(snapshot);input.collections.armes_bottes.find(x=>x.nom==='poussee').effets[0].distance=999;
  assert.throws(()=>applyRulesRevision(input),/source drift poussee/);
});
