import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
test('Tempête de neige 2024 : contrôle, pas de dégâts ; Cylindre de rayon 6 m',()=>{
  const s=c.spells.find(x=>x.id==='tempete_de_neige');
  assert.equal(s.niveau,3);assert.equal(s.ecole,'Invocation');assert.equal(s.concentration,true);assert.ok(s.duree.includes('1 minute'));
  assert.deepEqual(s.degats??[],[]);assert.deepEqual(s.zone,{forme:'cylindre',rayon_m:6,hauteur_m:12});assert.equal(s.sauvegarde.caracteristique,'DEX');assert.equal(s.sauvegarde.demi_si_reussi,false);
  assert.ok(s.description.includes('À terre'));assert.ok(s.description.replace(/\s+/g,' ').includes('perdre sa Concentration'));assert.match(s.description,/Visibilité[\s\S]*nulle/);
});
test('Rayon empoisonné 2024 : attaque et empoisonnement sans JS supplémentaire',()=>{
  const s=c.spells.find(x=>x.id==='rayon_empoisonneur');
  assert.equal(s.niveau,1);assert.equal(s.nom,'Rayon empoisonné');assert.equal(s.sauvegarde,null);assert.equal(s.attaque,'distance');
  assert.deepEqual(s.classes,['Ensorceleur','Magicien']);assert.deepEqual(s.degats,[{type:'poison',valeur:'2d8'}]);
  const state=classFixture(c,'druide',5,'druide_cercle_terre');state.classChoices.terrain=['Tropical'];
  const m=sheetModel(state,c),spell=m.spells.find(x=>x.id===s.id);assert.equal(spell.ability,'SAG');assert.equal(spell.dc,m.magic.dc);assert.equal(spell.sauvegarde,null);
  assert.ok(renderSheet(state,c).includes('Rayon empoisonné'));
});
