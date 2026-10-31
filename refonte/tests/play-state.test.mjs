import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {playView,applyPlayAction,validatePlayState} from '../maquette/play-state.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('fixtures/rules-2024.json',import.meta.url))));
const fixture=(cls='barbare',level=3)=>originFixture(c,cls,level,{speciesId:'orc'},'fermier');
const act=(s,type,amount,resource)=>{s.playState=applyPlayAction(s,sheetModel(s,c),{type,amount,currentHp:amount,resource});return playView(s,sheetModel(s,c));};
test('Une fiche existante reste sans suivi tant que le joueur ne le commence pas',()=>{
 const s=fixture(),before=JSON.stringify(s),m=sheetModel(s,c);
 assert.equal(playView(s,m).started,false);renderSheet(s,c);assert.equal(JSON.stringify(s),before);
 assert(!Object.hasOwn(characterSnapshot(s),'playState'));assert(!Object.hasOwn(validateSavedCharacter(s,c).character,'playState'));
 assert.throws(()=>act(s,'damage',1));
});
test('PV temporaires absorbés en premier, dégâts plafonnés à zéro et soins limités au maximum',()=>{
 const s=fixture(),max=sheetModel(s,c).hp;act(s,'start',max-2);act(s,'set-temp',5);
 assert.deepEqual([act(s,'damage',3).currentHp,s.playState.tempHp],[max-2,2]);
 assert.deepEqual([act(s,'damage',7).currentHp,s.playState.tempHp],[max-7,0]);
 assert.equal(act(s,'heal',1000).currentHp,max);assert.equal(act(s,'damage',1000).currentHp,0);
 assert.equal(act(s,'heal',4).currentHp,4);
});
test('Les PV temporaires sont remplacés et les corrections sont explicites',()=>{
 const s=fixture(),max=sheetModel(s,c).hp;act(s,'start',max);act(s,'set-temp',9);assert.equal(act(s,'set-temp',3).tempHp,3);
 assert.equal(act(s,'set-current',0).currentHp,0);assert.equal(act(s,'set-current',max).currentHp,max);
 const old=structuredClone(s.playState);assert.throws(()=>act(s,'set-current',max+1));assert.deepEqual(s.playState,old);
 for(const n of [-1,1.5,NaN,Infinity,'2'])assert.throws(()=>act(s,'damage',n));
 assert.throws(()=>act(s,'start',max));
});
test('Les réserves des quatre classes prioritaires suivent leurs maxima calculés',()=>{
 for(const [cls,id]of [['barbare','rage'],['barde','inspiration'],['druide','wild-shape'],['rodeur','favored-enemy']]){
  const s=fixture(cls);const m=sheetModel(s,c);act(s,'start',m.hp);
  const r=playView(s,m).resources.find(r=>r.id===id);assert(r,cls);assert(r.max>0);
  assert.equal(act(s,'spend',r.max,id).resources.find(r=>r.id===id).remaining,0);
  assert.throws(()=>act(s,'spend',1,id));assert.equal(act(s,'restore',1,id).resources.find(r=>r.id===id).remaining,1);
  assert.throws(()=>act(s,'restore',r.max,id));
 }
});
test('Une valeur de dégâts, un DD ou un budget de récupération ne devient pas un faux quota',()=>{
 for(const cls of c.classes){const s=fixture(cls.id,20),view=playView(s,sheetModel(s,c));assert(view.resources.every(r=>Number.isInteger(r.max)&&r.max>0));assert(!view.resources.some(r=>/Dégâts|^DD|Archer stellaire|Calice|Arts martiaux|Foulée/.test(r.label)));}
 const s=fixture('magicien',20);assert.equal(playView(s,sheetModel(s,c)).resources.find(r=>r.id==='arcane-recovery').max,1);
});
test('Les dépenses restent conservées quand le maximum de la ressource change',()=>{
 const s=fixture('barbare',20);act(s,'start',sheetModel(s,c).hp);const r=playView(s,sheetModel(s,c)).resources.find(r=>r.id==='rage');act(s,'spend',r.max,'rage');s.level=1;
 assert.equal(playView(s,sheetModel(s,c)).resources.find(r=>r.id==='rage').remaining,0);assert.equal(s.playState.used.rage,r.max);
 s.level=20;assert.equal(playView(s,sheetModel(s,c)).resources.find(r=>r.id==='rage').remaining,0);
});
test('Le suivi survit à la validation et au snapshot sans changer les calculs ni les dés',()=>{
 const s=fixture('druide'),base=structuredClone(s),m=sheetModel(s,c);act(s,'start',m.hp);act(s,'damage',7);act(s,'spend',1,'wild-shape');
 const saved=validateSavedCharacter(characterSnapshot(s),c).character;assert.deepEqual(saved.playState,s.playState);
 const after=sheetModel(saved,c),before=sheetModel(base,c);for(const key of ['hp','ac','scores','mods','slots','attacks'])assert.deepEqual(after[key],before[key]);assert.deepEqual(saved.rolls,base.rolls);assert.deepEqual(saved.hpRolls,base.hpRolls);
 const snapshot=characterSnapshot(saved);snapshot.playState.used['wild-shape']=0;assert.equal(saved.playState.used['wild-shape'],1);
});
test('Le serveur rejette les suivis mal formés et les clés dangereuses',()=>{
 const s=fixture();for(const playState of [null,[],{version:2,hpLost:0,tempHp:0,used:{}},{version:1,hpLost:-1,tempHp:0,used:{}},{version:1,hpLost:0,tempHp:0,used:{rage:1.5}},JSON.parse('{"version":1,"hpLost":0,"tempHp":0,"used":{"__proto__":1}}')])assert.throws(()=>validateSavedCharacter({...s,playState},c),e=>e.status===400);
 assert.throws(()=>validatePlayState({version:1,hpLost:0,tempHp:0,used:Object.fromEntries(Array.from({length:101},(_,i)=>['key-'+i,0]))}));
});
test('Onglet accessible sans action automatique, exemples en lecture seule et texte échappé',()=>{
 const s=fixture();assert.match(renderSheet(s,c),/data-sheet-tab="play"/);assert.match(renderSheet(s,c,{example:true}),/disponible sur vos propres personnages/);
 assert.doesNotMatch(renderSheet(s,c,{example:true}),/data-play-action/);act(s,'start',0);const html=renderSheet(s,c,{activeTab:'play'});assert.match(html,/data-play-current>0</);assert.match(html,/sauvegarde contre la mort/);
});
