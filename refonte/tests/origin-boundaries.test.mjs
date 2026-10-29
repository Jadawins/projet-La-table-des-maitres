import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture,finishChoices} from '../audit/origin-fixtures.mjs';
import {backgroundBonuses} from '../maquette/character-rules.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
for(const b of c.backgrounds)test(`${b.nom} · trois bonus ou chaque répartition +2/+1 autorisée`,()=>{
  const allowed=b.bonus_caracteristiques.suggerees.map(a=>({STR:'FOR',WIS:'SAG'}[a]||a));
  const three=backgroundBonuses({bonusMode:'three'},b);for(const a of allowed)assert.equal(three[a],1);
  for(const a of allowed)for(const other of allowed)if(a!==other){const bonus=backgroundBonuses({bonusMode:'split',bonusTwo:a,bonusOne:other},b);assert.equal(bonus[a],2);assert.equal(bonus[other],1);assert.equal(Object.values(bonus).reduce((s,n)=>s+n,0),3);}
  assert.equal(Object.values(backgroundBonuses({bonusMode:'split',bonusTwo:allowed[0],bonusOne:allowed[0]},b)).reduce((s,n)=>s+n,0),0);
});
for(const cls of ['guerrier','rodeur','paladin'])for(const feat of c.feats.filter(f=>f.id.startsWith('style_')))test(`${cls} · style ${feat.nom} · fiche et sauvegarde`,()=>{
  const s=originFixture(c,cls,2,{speciesId:'orc'},'charlatan');s.classChoices.combatStyle=[feat.id];finishChoices(s,c);
  const result=validateSavedCharacter(characterSnapshot(s),c);assert.equal(result.status,'ready',result.issues.join('; '));
  assert.deepEqual(result.character.classChoices.combatStyle,[feat.id]);assert.ok(sheetModel(s,c).classFeatures.some(f=>f.nom===feat.nom));
});
test('Une taille incompatible ne peut pas être enregistrée comme une fiche complète',()=>{
  for(const [id,variant,size]of [['nain','nain_montagnes','P'],['halfelin','','M']]){
    const s=originFixture(c,'clerc',1,{speciesId:id,variantId:variant,speciesSize:size},'charlatan');s.speciesSize=size;
    assert.equal(validateSavedCharacter(characterSnapshot(s),c).status,'draft');
  }
});
