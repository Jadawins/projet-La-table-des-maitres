import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
for(let level=1;level<=20;level++)test(`Moine des Éléments 2024 · niveau ${level}`,()=>{
  const state=classFixture(c,'moine',level,'moine_credo_elements');
  const m=sheetModel(state,c);
  assert.deepEqual(m.errors,[]);
  assert.ok(!classChoiceSpecs(state,c).some(s=>s.key==='disciplines'));
  assert.ok(!m.classResources.some(r=>r.nom==='Disciplines élémentaires'));
  const spell=m.spells.find(s=>s.id==='elementalisme');
  const burst=m.classResources.find(r=>r.nom==='Explosion élémentaire');
  const stride=m.classResources.find(r=>r.nom==='Foulée des éléments');
  if(level<3)assert.equal(spell,undefined);
  else{
    assert.equal(spell.caracteristique,'SAG');
    assert.equal(spell.dc,8+m.proficiency+m.mods.SAG);
    assert.equal(spell.utilisation,'a_volonte');
    assert.match(m.attacks.find(a=>a.nom==='Mains nues').featRules.join(' '),/Harmonisation uniquement/);
  }
  if(level<6)assert.equal(burst,undefined);
  else assert.equal(burst.valeur,level>=17?'3d12':level>=11?'3d10':'3d8');
  if(level<11)assert.equal(stride,undefined);
  else{assert.equal(stride.valeur,m.speed+' m');assert.match(stride.details,/uniquement/);}
  // Conditional benefits are described, never added to permanent speed or resistances.
  const plain=structuredClone(state);plain.subclassId='moine_credo_main_ouverte';
  assert.equal(m.speed,sheetModel(plain,c).speed);
  assert.deepEqual(m.resistances,sheetModel(plain,c).resistances);
  const saved=validateSavedCharacter(characterSnapshot(state),c);
  assert.equal(saved.status,'ready',saved.issues.join('; '));
  assert.equal(sheetModel(saved.character,c).classResources.find(r=>r.nom==='Explosion élémentaire')?.valeur,burst?.valeur);
  assert.doesNotThrow(()=>renderSheet(state,c));
});

test('Les anciens noms de disciplines ne deviennent pas des aptitudes 2024',()=>{
  const state=classFixture(c,'moine',17,'moine_credo_elements');state.classChoices.disciplines=['Ancienne discipline'];
  assert.ok(!sheetModel(state,c).classEffects.summaries.some(s=>s.choices.includes('Ancienne discipline')));
});
