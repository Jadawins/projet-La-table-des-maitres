import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {hitPoints} from '../maquette/character-rules.mjs';
import {backgroundFeat,grantedOriginSpells,originErrors,reconcileOrigins,speciesChoiceSpecs,humanFeats} from '../maquette/origin-rules.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {classTraining,advancementInitial,evaluateProgression} from '../maquette/progression.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
const make=(speciesId,variantId='',level=5)=>originFixture(c,'clerc',level,{speciesId,variantId,speciesSize:'M'},'charlatan');

test('Ténacité naine 2024 ajoute un PV par niveau, sans sous-espèce mécanique',()=>{
  for(const level of [1,3,5,10,20])for(const variant of [''])assert.equal(hitPoints(make('nain',variant,level),c)-hitPoints(make('orc','',level),c),level);
});
test('Le nain 2024 n’accorde pas de formation d’armure ; Protection lourde conserve son prérequis',()=>{
 const s=originFixture(c,'magicien',4,{speciesId:'nain'},'charlatan');assert.ok(!classTraining(s,c).armors.includes('armures_intermediaires'));s.advancements[4]={...advancementInitial(),mode:'feat',featId:'protection_lourde',featAbility:'FOR'};assert.ok(evaluateProgression(s,c,s.scores).issues.length);
});

test('La chaîne des formations légères puis intermédiaires reconnaît le don acquis',()=>{
  const s=originFixture(c,'magicien',8,{speciesId:'orc'},'charlatan');
  s.advancements[4]={...advancementInitial(),mode:'feat',featId:'protection_legere',featAbility:'DEX'};
  s.advancements[8]={...advancementInitial(),mode:'feat',featId:'protection_intermediaire',featAbility:'DEX'};
  assert.deepEqual(evaluateProgression(s,c,s.scores).issues,[]);
});
test('Le Marin 2024 accorde Bagarreur de tavernes',()=>{
  const s=make('orc');s.backgroundId='marin';assert.equal(backgroundFeat(s,c).name,'Bagarreur de tavernes');assert.equal(backgroundFeat(s,c).feat?.id,'bagarreur_de_tavernes');
});
test('Les sorts de lignage sont reliés avant le calcul des dégâts et du DD',()=>{
  const s=make('tieffelin','infernal');const spell=sheetModel(s,c).spells.find(x=>x.source==='Espèce'&&x.nom==='Représailles infernales');
  assert.ok(spell?.description);assert.ok(spell.damageAtLevel);assert.equal(spell.ability,'INT');
});
test('Porte-lumière reste par CHA et le gnome des forêts n’accorde plus de sorts inventés',()=>{
 assert.equal(grantedOriginSpells(make('aasimar'),c).find(s=>s.id==='lumiere')?.caracteristique,'CHA');const spells=grantedOriginSpells(make('gnome','gnome_forets',20),c);assert.deepEqual(spells.map(s=>s.id).sort(),['communication_avec_les_animaux','illusion_mineure']);assert.ok(spells.every(s=>!s.unresolved));
});

test('Les résistances choisies remplacent les marqueurs variables et fusionnent leurs variantes de nom',()=>{
  const m=sheetModel(make('drakeide','airain'),c);assert.deepEqual(m.resistances,['feu']);
  const n=sheetModel(make('nain','nain_montagnes'),c);assert.deepEqual(n.resistances,['poison']);
  assert.deepEqual(sheetModel(make('aasimar'),c).resistances,['nécrotique','radiant']);
});
test('Les six ascendances du goliath sont obligatoires, conservées et effacées au changement d’espèce',()=>{
  const s=make('goliath');s.speciesAncestry='';assert.ok(originErrors(s,c).some(e=>e.includes('ascendance')));
  for(const o of speciesChoiceSpecs(s,c)[0].options){s.speciesAncestry=o.id;assert.equal(validateSavedCharacter(characterSnapshot(s),c).character.speciesAncestry,o.id);}
  s.speciesId='orc';reconcileOrigins(s,c);assert.equal(s.speciesAncestry,'');
});
test('Le choix d’incantation tieffelin s’applique à tous ses sorts',()=>{
  const s=make('tieffelin','infernal');s.speciesCastingAbility='';assert.ok(originErrors(s,c).length);
  for(const a of ['INT','SAG','CHA']){
    s.speciesCastingAbility=a;const spells=sheetModel(s,c).spells.filter(x=>x.source==='Espèce');
    assert.equal(spells.find(x=>x.id==='thaumaturgie').ability,a);
    assert.equal(spells.find(x=>x.id==='represailles_infernales').ability,a);
    assert.equal(spells.filter(x=>x.id==='thaumaturgie').length,1);
    assert.equal(validateSavedCharacter(characterSnapshot(s),c).character.speciesCastingAbility,a);
  }
});
for(const [i,feat]of c.feats.filter(f=>f.categorie==='origine').entries())test(`Humain · ${feat.nom} · tous les historiques et les deux tailles`,()=>{
  for(const background of c.backgrounds)for(const size of ['M','P']){
    const cls=c.classes[i%c.classes.length].id;
    const probe={classId:cls,level:1,speciesId:'humain',backgroundId:background.id};
    if(!humanFeats(probe,c).some(f=>f.id===feat.id))continue; // Non-repeatable duplicates are not legal combinations.
    const s=originFixture(c,cls,1,{speciesId:'humain',speciesSize:size},background.id,{originFeatId:feat.id});
    const result=validateSavedCharacter(characterSnapshot(s),c);
    assert.equal(result.status,'ready',`${cls}/${background.id}/${size}: ${result.issues.join('; ')}`);
    assert.equal(result.character.originFeatId,feat.id);
  }
});
