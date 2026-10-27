import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {clericFixture} from '../audit/cleric-1-10.mjs';
import {advancementInitial,ADVANCEMENT_LEVELS,ORIGIN_SLOTS} from '../maquette/cleric-progression.mjs';
import {featChoiceErrors,featChoiceSpec} from '../maquette/feat-effects.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {clericProfile} from '../maquette/character-rules.mjs';
import {validateSavedCharacter,characterSnapshot} from '../maquette/character-storage.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url),'utf8')));
const state=(id,ability='SAG',level=4)=>{const s=clericFixture(c,level,'clerc_domaine_vie');s.advancements[4]={...advancementInitial(),mode:'feat',featId:id,featAbility:ability};return s;};
test('Expert exige une compétence acquise, double seulement la maîtrise et conserve le bonus de vocation',()=>{
 const s=state('expert','INT',5);assert.ok(featChoiceErrors(s,c).length);s.advancements[4].choices.expertise='Religion';assert.deepEqual(featChoiceErrors(s,c),[]);
 const before=sheetModel(clericFixture(c,5,'clerc_domaine_vie'),c).skills.find(x=>x.nom==='Religion');const actual=sheetModel(s,c).skills.find(x=>x.nom==='Religion');assert.equal(actual.value,before.value+3);assert.equal(actual.expertise,true);
 s.advancements[4].choices.expertise='Dressage';assert.ok(featChoiceErrors(s,c).length);
});
test('Observateur ne crée pas une maîtrise absente et Comédien accorde le choix',()=>{
 const s=state('observateur');s.advancements[4].choices.expertise='Investigation';assert.equal(sheetModel(s,c).skills.find(x=>x.nom==='Investigation').trained,false);
 const a=state('comedien','CHA');a.advancements[4].choices.skill='Représentation';assert.equal(sheetModel(a,c).skills.find(x=>x.nom==='Représentation').trained,true);assert.match(renderSheet(a,c),/DD 10/);
});
test('Mobile, Athlète, Discret et les maîtrises permanentes apparaissent sur la fiche',()=>{
 let s=state('mobile','DEX');assert.equal(sheetModel(s,c).speed,12);
 s.advancements[8]={...advancementInitial(),mode:'feat',featId:'athlete',featAbility:'FOR'};s.level=8;assert.equal(sheetModel(s,c).climb,12);
 s=state('discret','DEX');assert.equal(sheetModel(s,c).darkvision,18);
 s=state('chef_cuisinier','CON');assert.ok(sheetModel(s,c).tools.includes('Ustensiles de cuisinier'));
 s=state('formation_aux_armes_de_guerre','FOR');assert.ok(sheetModel(s,c).weaponTraining.includes('armes_de_guerre'));
});
test('Le maître des armures intermédiaires relève le plafond DEX et conserve les DEX négatives',()=>{
 const s=state('maitre_des_armures_intermediaires','DEX');s.scores.DEX=17;const normal=structuredClone(s);normal.advancements[4]={...advancementInitial(),mode:'ability',abilities:['INT','CHA']};assert.equal(sheetModel(s,c).ac,sheetModel(normal,c).ac+1);s.scores.DEX=3;assert.equal(sheetModel(s,c).ac,12);
});
test('Un effet conditionnel de parade ou de charge ne gonfle pas la CA ou la vitesse permanente',()=>{
 const s=state('duelliste_defensif','DEX',5);s.scores.DEX=15;const base=clericFixture(c,5,'clerc_domaine_vie');base.scores.DEX=15;assert.equal(sheetModel(s,c).ac,sheetModel(base,c).ac);assert.match(sheetModel(s,c).effects.summaries.find(f=>f.name==='Duelliste défensif').effects.join(' '),/ajoutez votre 3 à la CA/);
 assert.equal(sheetModel(state('expert_de_la_charge','FOR'),c).speed,9);
});
test('Les rituels sont choisis au palier, distincts, toujours préparés hors quota et conservés à la sauvegarde',()=>{
 const s=state('magie_rituelle');const spec=featChoiceSpec(s,c,{level:4,feat:c.feats.find(f=>f.id==='magie_rituelle')});assert.ok(spec.options.every(x=>x.niveau<=2));assert.ok(featChoiceErrors(s,c).length);
 s.advancements[4].choices.rituals=spec.options.slice(0,2).map(x=>x.id);assert.deepEqual(featChoiceErrors(s,c),[]);
 const profile=clericProfile(s,c);s.prepared=profile.prepared.slice(0,profile.preparedCount).map(x=>x.id);const m=sheetModel(s,c);assert.equal(m.spells.filter(x=>x.source==='Magie rituelle · niveau 4').length,2);assert.deepEqual(validateSavedCharacter(s,c).character.advancements[4].choices,s.advancements[4].choices);
 s.advancements[4].choices.rituals[1]=s.advancements[4].choices.rituals[0];assert.ok(featChoiceErrors(s,c).length);
});
test('Adepte élémentaire nécessite un type, applique la règle des 1 comptant comme 2 sans lancer de dés',()=>{
 const s=state('adepte_elementaire');assert.ok(featChoiceErrors(s,c).length);s.advancements[4].choices.damageType='feu';s.cantrips[0]='flamme_sacree';assert.deepEqual(featChoiceErrors(s,c),[]);assert.match(renderSheet(s,c),/les 1 sur les dés/);s.advancements[8]={...advancementInitial(),mode:'feat',featId:'adepte_elementaire',featAbility:'INT',choices:{damageType:'feu'}};s.level=8;assert.ok(featChoiceErrors(s,c).length);
});
test('Empoisonneur applique la résistance et calcule le DD selon la caractéristique choisie',()=>{
 const s=state('empoisonneur','INT',5),m=sheetModel(s,c);assert.ok(m.resistances.includes('poison'));assert.ok(m.tools.some(x=>x.includes('empoisonneur')));assert.match(m.effects.summaries.map(x=>x.effects.join(' ')).join(' '),/DD du poison infligé = 13/);
});
test('Affinité ombreuse modifie seulement les sorts des écoles concernées',()=>{
 const s=state('affinite_ombreuse','INT');s.cantrips=['glas','flamme_sacree'];const m=sheetModel(s,c);assert.equal(m.spells.find(x=>x.id==='glas').dc,m.magic.dc+1);assert.equal(m.spells.find(x=>x.id==='flamme_sacree').dc,m.magic.dc);
});
test('Les anciens choix sans structure supplémentaire se comparent sans faux changement',()=>{
 const s=clericFixture(c,4,'clerc_domaine_vie'),old=structuredClone(s);delete old.advancements[4].choices;assert.deepEqual(characterSnapshot(old),characterSnapshot(s));
});
import {runInNewContext} from 'node:vm';
import {grantInitial} from '../maquette/origin-rules.mjs';
import {featChoicesInitial} from '../maquette/feat-effects.mjs';
import {detailFields} from '../maquette/sheet-model.mjs';
test('Recharger un brouillon restaure les origines de palier avant le niveau, les scores et les choix de dons',async()=>{
 const s=state('expert','INT',10);s.advancements[4].choices.expertise='Religion';s.originGrants=Object.fromEntries(ORIGIN_SLOTS.map(k=>[k,grantInitial()]));
 const app=await readFile(new URL('../maquette/app.js',import.meta.url),'utf8');const setup=app.slice(0,app.indexOf('const esc =')).replace(/^import .*;\r?\n/gm,'');
 const result=runInNewContext(setup+'\nJSON.stringify({draft,storageAvailable})',{document:{getElementById:()=>null,querySelector:()=>null},window:{addEventListener:()=>{}},localStorage:{getItem:()=>JSON.stringify(s)},grantInitial,advancementInitial,featChoicesInitial,detailFields,ADVANCEMENT_LEVELS,ORIGIN_SLOTS});
 const restored=JSON.parse(result);assert.equal(restored.storageAvailable,true);assert.equal(restored.draft.level,10);assert.deepEqual(restored.draft.scores,s.scores);assert.equal(restored.draft.advancements[4].choices.expertise,'Religion');assert.deepEqual(restored.draft.originGrants,s.originGrants);
});
