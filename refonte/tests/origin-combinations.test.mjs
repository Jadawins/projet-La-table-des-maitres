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
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
const make=(speciesId,variantId='',level=5)=>originFixture(c,'clerc',level,{speciesId,variantId,speciesSize:'M'},'charlatan');

test('Ténacité naine ajoute un PV par niveau, sans compter deux fois le libellé collinaire',()=>{
  for(const level of [1,3,5,10,20])for(const variant of ['nain_collinaire','nain_montagnes'])assert.equal(hitPoints(make('nain',variant,level),c)-hitPoints(make('orc','',level),c),level);
});
test('La formation du nain des montagnes rend Protection lourde accessible au palier prévu',()=>{
  const s=originFixture(c,'magicien',4,{speciesId:'nain',variantId:'nain_montagnes'},'charlatan');
  assert.ok(classTraining(s,c).armors.includes('armures_intermediaires'));
  s.advancements[4]={...advancementInitial(),mode:'feat',featId:'protection_lourde',featAbility:'FOR'};
  assert.equal(evaluateProgression(s,c,s.scores).issues.length,0);
});
test('La chaîne des formations légères puis intermédiaires reconnaît le don acquis',()=>{
  const s=originFixture(c,'magicien',8,{speciesId:'orc'},'charlatan');
  s.advancements[4]={...advancementInitial(),mode:'feat',featId:'protection_legere',featAbility:'DEX'};
  s.advancements[8]={...advancementInitial(),mode:'feat',featId:'protection_intermediaire',featAbility:'DEX'};
  assert.deepEqual(evaluateProgression(s,c,s.scores).issues,[]);
});
test('Le Marin conserve son libellé source et retrouve le don de tavernes du catalogue',()=>{
  const s=make('orc');s.backgroundId='marin';assert.equal(backgroundFeat(s,c).name,'Habitué des tavernes');assert.equal(backgroundFeat(s,c).feat?.id,'bagarreur_de_tavernes');
});
test('Les sorts de lignage sont reliés avant le calcul des dégâts et du DD',()=>{
  const s=make('tieffelin','infernal');const spell=sheetModel(s,c).spells.find(x=>x.source==='Espèce'&&x.nom==='Représailles infernales');
  assert.ok(spell?.description);assert.ok(spell.damageAtLevel);assert.equal(spell.ability,'CHA');
});
test('Porte-lumière donne Lumière par CHA et un gnome garde ses sorts non identifiés signalés',()=>{
  const light=grantedOriginSpells(make('aasimar'),c).find(s=>s.id==='lumiere');assert.equal(light?.caracteristique,'CHA');
  const missing=grantedOriginSpells(make('gnome','gnome_forets'),c).find(s=>s.sourceName==='Transmutation du bois');assert.equal(missing?.unresolved,true);assert.equal(missing?.description,undefined);
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
test('Présence d’outre-monde utilise le choix du joueur sans modifier les sorts fixes de son héritage',()=>{
  const s=make('tieffelin','infernal');s.speciesCastingAbility='';assert.ok(originErrors(s,c).length);
  for(const a of ['INT','SAG','CHA']){
    s.speciesCastingAbility=a;const spells=sheetModel(s,c).spells.filter(x=>x.source==='Espèce');
    assert.equal(spells.find(x=>x.id==='thaumaturgie').ability,a);
    assert.equal(spells.find(x=>x.id==='represailles_infernales').ability,'CHA');
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
