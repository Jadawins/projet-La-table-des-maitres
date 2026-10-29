import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
// Expected progression transcribed independently from the official 2024 table.
for(let level=1;level<=20;level++)test(`Âme acérée 2024 · niveau ${level}`,()=>{
  const state=classFixture(c,'roublard',level,'roublard_ame_aceree');
  const model=sheetModel(state,c);
  assert.deepEqual(model.errors,[]);
  assert.ok(!classChoiceSpecs(state,c).some(s=>s.key==='psiDc'));
  assert.ok(!model.spells.some(s=>s.grantSource==='Domination psychique'||s.source==='Domination psychique'));
  const blades=model.attacks.filter(a=>a.nom.includes('lame psychique')||a.nom==='Lame psychique');
  if(level<3){assert.equal(blades.length,0);assert.ok(!model.classResources.some(r=>r.nom==='Puissance psionique'));return;}
  const expected=level>=17?'12d12':level>=13?'10d10':level>=11?'8d10':level>=9?'8d8':level>=5?'6d8':'4d6';
  assert.equal(model.classResources.find(r=>r.nom==='Puissance psionique').valeur,expected);
  assert.equal(blades.length,2);
  assert.deepEqual(blades.map(a=>a.degats.de),['1d6','1d4']);
  assert.ok(blades.every(a=>a.botteActive&&a.degats.type==='psychique'));
  for(const blade of blades){assert.equal(blade.attack,model.proficiency+Math.max(model.mods.FOR,model.mods.DEX));assert.equal(blade.damageBonus,Math.max(model.mods.FOR,model.mods.DEX));}
  const mind=model.classResources.find(r=>r.nom==='DD de Déchirement mental');
  if(level>=17)assert.equal(mind.valeur,8+model.proficiency+model.mods.DEX);else assert.equal(mind,undefined);
  const saved=validateSavedCharacter(characterSnapshot(state),c);
  assert.equal(saved.status,'ready',saved.issues.join('; '));
  assert.deepEqual(sheetModel(saved.character,c).attacks,model.attacks);
});

test('Un ancien DD libre ne remplace pas le calcul officiel',()=>{
  const state=classFixture(c,'roublard',17,'roublard_ame_aceree');state.classChoices.psiDc=['99'];state.scores.DEX=17;
  const model=sheetModel(state,c);
  assert.equal(model.classResources.find(r=>r.nom==='DD de Déchirement mental').valeur,18);
});

test('Une caractéristique absente ne fabrique pas de DD',()=>{
  const state=classFixture(c,'roublard',17,'roublard_ame_aceree');state.scores.DEX=null;
  assert.equal(sheetModel(state,c).classResources.find(r=>r.nom==='DD de Déchirement mental').valeur,'À compléter');
});
