import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {beginAdvancement,finishAdvancement} from '../maquette/character-advancement.mjs';
import {completeAdvancement} from '../audit/advancement-fixture.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('./fixtures/rules-2024.json',import.meta.url),'utf8')));
test('Les identifiants hérités du prototype et les classes inconnues sont refusés sans erreur interne',()=>{
  const s=classFixture(c,'barbare',1,'',{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14}});
  const change=beginAdvancement(s,c,'guerrier'),multi=finishAdvancement(change.base,completeAdvancement(change.base,change.candidate,c),c);
  for(const classId of ['constructor','__proto__','unknown',null,42]){
    const bad=structuredClone(multi);bad.multiclass.classes[1].classId=classId;bad.multiclass.sequence[1]=classId;
    assert.throws(()=>validateSavedCharacter(bad,c),e=>e.status===400);
  }
});
test('Érudition sans compétence éligible ne crée pas une maîtrise et ne bloque pas la progression',()=>{
  const s=classFixture(c,'magicien',2,'',{backgroundId:'soldat'});s.classSkills=[];s._secondaryClass=true;s.classChoices.scholar=[];
  const spec=classChoiceSpecs(s,c).find(row=>row.key==='scholar');assert.equal(spec.count,0);assert.deepEqual(spec.options,[]);
  assert.match(spec.description,/aucune Expertise/i);
});
test('Une compétence gagnée dans une troisième classe ne bloque pas rétroactivement Érudition',()=>{
  let state=originFixture(c,'guerrier',1,{speciesId:'orc'},'soldat');state.scores={FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14};
  for(let level=1;level<=2;level++){const change=beginAdvancement(state,c,'magicien');state=finishAdvancement(change.base,completeAdvancement(change.base,change.candidate,c),c);}
  assert.deepEqual(state.multiclass.classes.find(row=>row.classId==='magicien').classChoices.scholar||[],[]);
  const change=beginAdvancement(state,c,'barde'),ready=completeAdvancement(change.base,change.candidate,c);ready.classSkills=['Nature'];
  state=finishAdvancement(change.base,ready,c);assert.equal(validateSavedCharacter(state,c).status,'ready');assert.equal(state.level,4);
});
test('Expertise ou demi-maîtrise et bonus de vocation se combinent sans compter deux fois la maîtrise',()=>{
  let state=classFixture(c,'clerc',1,'',{divineOrder:'Thaumaturge',scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14}});state.classSkills=['Religion','Médecine'];
  let change=beginAdvancement(state,c,'roublard'),ready=completeAdvancement(change.base,change.candidate,c);ready.classChoices.expertise1=['Religion','Médecine'];
  state=finishAdvancement(change.base,ready,c);let m=sheetModel(state,c);
  assert.equal(m.skills.find(s=>s.nom==='Religion').value,m.mods.INT+2*m.proficiency+Math.max(1,m.mods.SAG));
  state=originFixture(c,'barde',2,{speciesId:'orc'},'soldat');state.scores={FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14};state.classSkills=['Acrobaties','Dressage','Discrétion'];state.classChoices.expertise2=['Acrobaties','Dressage'];
  change=beginAdvancement(state,c,'clerc');change.candidate.divineOrder='Thaumaturge';ready=completeAdvancement(change.base,change.candidate,c);state=finishAdvancement(change.base,ready,c);m=sheetModel(state,c);
  const arcana=m.skills.find(s=>s.nom==='Arcanes');assert.equal(arcana.trained,false);assert.equal(arcana.value,m.mods.INT+Math.floor(m.proficiency/2)+Math.max(1,m.mods.SAG));
});
