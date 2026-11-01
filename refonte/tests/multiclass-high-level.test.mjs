import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {completeAdvancement} from '../audit/advancement-fixture.mjs';
import {beginAdvancement,finishAdvancement,advancementErrors} from '../maquette/character-advancement.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('./fixtures/rules-2024.json',import.meta.url),'utf8')));
for(const [index,primary]of c.classes.entries()){
  const target=c.classes[(index+1)%c.classes.length];
  test(`Multiclassage progressif jusqu’au total 20 : ${primary.nom} 1 / ${target.nom} 19`,()=>{
    let state=classFixture(c,primary.id,1,'',{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14},...(primary.id==='clerc'?{divineOrder:'Protecteur'}:{})});
    for(let total=2;total<=20;total++){
      const {base,candidate}=beginAdvancement(state,c,target.id),ready=completeAdvancement(base,candidate,c);
      assert.deepEqual(advancementErrors(base,ready,c),[],target.nom+' niveau '+(total-1));
      state=finishAdvancement(base,ready,c);assert.equal(state.level,total);
      const model=sheetModel(state,c);assert.equal(model.proficiency,2+Math.floor((total-1)/4));assert.equal(model.errors.length,0);
      assert.equal(validateSavedCharacter(state,c).status,'ready');
    }
    assert.equal(state.multiclass.classes[0].level,1);assert.equal(state.multiclass.classes[1].level,19);
    assert.throws(()=>beginAdvancement(state,c,target.id),/20/);
  });
}
