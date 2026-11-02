import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestSpell,savingThrow,validateSpellPlan} from '../access/spell-rules.mjs';
test('Sauvegardes ordinaires : un 20 peut échouer et un 1 réussir ; avantage et malus sont détaillés',()=>{
  assert.equal(savingThrow({mode:'physical',dice:[20],bonus:1,dc:25}).success,false);
  assert.equal(savingThrow({mode:'physical',dice:[1],bonus:20,dc:14}).success,true);
  const roll=savingThrow({mode:'physical',dice:[5,16],advantage:'advantage',bonus:3,penalty:2,dc:17});assert.equal(roll.total,17);assert.equal(roll.dice[0].kept,false);assert(roll.success);
});
test('Soins surclassés et sort mineur : formules de base seulement, effets ambigus non inventés',()=>{
  const heal=suggestSpell({id:'soins',niveau:1,ability:'SAG'},{mods:{SAG:3}},3);assert.equal(heal.formula,'6d8+3');assert.equal(heal.effect,'heal');
  const unknown=suggestSpell({id:'autre',niveau:2,description:'999d20 dégâts automatiques'},{mods:{}},2);assert.equal(unknown.formula,'');assert(unknown.reviewRequired);
  assert.throws(()=>validateSpellPlan({kind:'direct',effect:'damage',formula:'process.exit()',success:'none',rounds:0}));
});
