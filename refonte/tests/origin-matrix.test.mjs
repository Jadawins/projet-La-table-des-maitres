import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {originCases,originFixture} from '../audit/origin-fixtures.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
const origins=originCases(c);
const key=s=>s==='Intuition'?'perspicacite':s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function check(s){
  const label=[s.classId,s.level,s.speciesId,s.variantId,s.speciesSize,s.backgroundId].join('/');
  const saved=validateSavedCharacter(characterSnapshot(s),c);assert.equal(saved.status,'ready',label+' '+saved.issues.join('; '));
  const m=sheetModel(saved.character,c);assert.deepEqual(m.errors,[],label);
  assert.deepEqual(validateSavedCharacter(characterSnapshot(saved.character),c).character,saved.character,label+' conservation');
  const bg=c.backgrounds.find(b=>b.id===s.backgroundId);
  const expected={...s.scores};
  for(const a of bg.bonus_caracteristiques.suggerees)expected[({STR:'FOR',WIS:'SAG'}[a]||a)]++;
  for(const r of Object.values(s.advancements))if(r.mode==='ability')for(const a of r.abilities)expected[a]++;else if(r.featAbility)expected[r.featAbility]++;
  if(s.level===20&&s.classId==='barbare'){expected.FOR+=4;expected.CON+=4;}
  if(s.level===20&&s.classId==='moine'){expected.DEX+=4;expected.SAG+=4;}
  assert.deepEqual(m.scores,expected,label+' caractéristiques');
  const die=Number(c.classes.find(x=>x.id===s.classId).niveaux[0].de_vie.type.match(/d(\d+)/)[1]),con=Math.floor((expected.CON-10)/2);
  const robust=(bg.don==='Robuste'||s.speciesId==='humain'&&s.originFeatId==='robuste')?s.level:0;
  const vigor=Object.values(s.advancements).some(r=>r.featId==='faveur_de_vigueur')?40:0;
  const hp=die+con+(s.level-1)*(Math.floor(die/2)+1+con)+robust+vigor+(s.speciesId==='nain'?s.level:0);
  assert.equal(m.hp,hp,label+' PV');
  for(const name of bg.competences)assert.ok(m.skills.some(x=>key(x.nom)===key(name)&&x.trained),label+' compétence '+name);
  assert.ok(!m.resistances.some(r=>r.startsWith('variable_')),label+' résistances');
  assert.equal(new Set(m.resistances).size,m.resistances.length,label+' résistances doublées');
}
// Exhaustive cross-product at level 5: all 12 classes, all 30 species/lineage/size choices and all 16 backgrounds.
for(const cls of c.classes)for(const origin of origins)test(`${cls.nom} · ${origin.speciesId}/${origin.variantId}/${origin.speciesSize} · 16 historiques`,()=>{
  for(const bg of c.backgrounds)check(originFixture(c,cls.id,5,origin,bg.id));
});
// Additional boundaries: no subclass, first lineage spells, late progression and final class boosts.
for(const cls of c.classes)for(const level of [1,3,10,20])test(`${cls.nom} · niveau ${level} · 30 origines`,()=>{
  for(const [i,origin]of origins.entries())check(originFixture(c,cls.id,level,origin,c.backgrounds[i%c.backgrounds.length].id));
});
