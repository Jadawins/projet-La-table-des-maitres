import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {playView,applyPlayAction,restPreview,resourceRecovery,validatePlayState} from '../maquette/play-state.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('fixtures/rules-2024.json',import.meta.url))));
const fixture=(cls='barde',level=3)=>originFixture(c,cls,level,{speciesId:'orc'},'fermier');
const act=(s,a)=>{s.playState=applyPlayAction(s,sheetModel(s,c),a);return playView(s,sheetModel(s,c));};
const start=s=>act(s,{type:'start',currentHp:sheetModel(s,c).hp});
const rest=(s,type='short-rest',extra={})=>act(s,{type,hitDice:0,healing:0,confirmed:true,...extra});

test('Emplacements ordinaires : chaque niveau a son quota, aucune dépense implicite',()=>{
 const s=fixture(),original=JSON.stringify(s);const view=playView(s,sheetModel(s,c));assert.deepEqual(view.slots.map(x=>[x.id,x.max,x.rank]),[['spell-1',4,1],['spell-2',2,2]]);assert.equal(JSON.stringify(s),original);
 start(s);act(s,{type:'spend-slot',slot:'spell-1',amount:4});assert.equal(playView(s,sheetModel(s,c)).slots[0].remaining,0);
 assert.throws(()=>act(s,{type:'spend-slot',slot:'spell-1',amount:1}));assert.equal(playView(s,sheetModel(s,c)).slots[1].remaining,2);
 act(s,{type:'restore-slot',slot:'spell-1',amount:1});assert.equal(playView(s,sheetModel(s,c)).slots[0].remaining,1);
 assert.throws(()=>act(s,{type:'restore-slot',slot:'spell-1',amount:4}));assert.throws(()=>act(s,{type:'spend-slot',slot:'spell-9',amount:1}));
});
test('Pacte : un pool conservé quand le rang change, récupéré au repos court sans Secret arcanique ajouté',()=>{
 const s=fixture('occultiste');start(s);act(s,{type:'spend-slot',slot:'pact',amount:2});s.level=5;
 const upgraded=playView(s,sheetModel(s,c));assert.equal(upgraded.slots.length,1);assert.equal(upgraded.slots[0].rank,3);assert.equal(upgraded.slots[0].remaining,0);
 assert.equal(rest(s).slots[0].remaining,2);s.level=20;assert.equal(playView(s,sheetModel(s,c)).slots[0].rank,5);assert.equal(playView(s,sheetModel(s,c)).slots.length,1);
 assert.equal(playView(s,sheetModel(s,c)).resources.find(r=>r.id==='magical-cunning').max,1);
});
test('Un repos court soigne seulement les jets saisis, consomme les dés et conserve les PV temporaires',()=>{
 const s=fixture('druide'),beforeDice=JSON.stringify([s.rolls,s.hpRolls]);start(s);act(s,{type:'damage',amount:12});act(s,{type:'set-temp',amount:8});
 const hp=playView(s,sheetModel(s,c)).currentHp;const result=rest(s,'short-rest',{hitDice:2,healing:7});
 assert.equal(result.currentHp,hp+7);assert.equal(result.hitDice.remaining,1);assert.equal(result.tempHp,8);assert.equal(JSON.stringify([s.rolls,s.hpRolls]),beforeDice);
 assert.throws(()=>rest(s,'short-rest',{hitDice:2,healing:5}));assert.throws(()=>rest(s,'short-rest',{hitDice:0,healing:5}));assert.throws(()=>rest(s,'short-rest',{hitDice:1,healing:0}));
});
test('Les emplacements ordinaires restent dépensés au repos court et reviennent au repos long',()=>{
 const s=fixture('clerc');start(s);act(s,{type:'spend-slot',slot:'spell-1',amount:3});act(s,{type:'damage',amount:5});act(s,{type:'set-temp',amount:7});act(s,{type:'set-hit-dice-used',amount:2});
 assert.equal(rest(s).slots.find(x=>x.id==='spell-1').remaining,1);
 const after=rest(s,'long-rest');assert.equal(after.currentHp,after.maxHp);assert.equal(after.tempHp,0);assert.equal(after.hitDice.remaining,3);assert.equal(after.slots.find(x=>x.id==='spell-1').remaining,4);assert.equal(after.lastRest.kind,'long');
});
test('Repos court : Rage, Forme animale, Souffle vital et Canal divin récupèrent une utilisation',()=>{
 for(const [cls,id]of [['barbare','rage'],['druide','wild-shape'],['guerrier','second-wind'],['clerc','channel-divinity'],['paladin','channel-divinity']]){
  const s=fixture(cls,10);start(s);const r=playView(s,sheetModel(s,c)).resources.find(r=>r.id===id);act(s,{type:'spend',resource:id,amount:r.max});assert.equal(rest(s).resources.find(r=>r.id===id).remaining,1,cls);
 }
});
test('Inspiration : récupération courte à partir de 5 ; Énergie et Élan guerrier récupèrent toute leur réserve',()=>{
 for(const [cls,id,level,expected]of [['barde','inspiration',3,0],['barde','inspiration',5,'all'],['moine','focus',5,'all'],['guerrier','action-surge',20,'all']]){
  const s=fixture(cls,level);start(s);const r=playView(s,sheetModel(s,c)).resources.find(r=>r.id===id);act(s,{type:'spend',resource:id,amount:r.max});assert.equal(rest(s).resources.find(r=>r.id===id).remaining,expected==='all'?r.max:expected);
 }
});
test('Les réserves de repos long et les récupérations optionnelles ne sont pas accordées au repos court',()=>{
 for(const [cls,id]of [['rodeur','favored-enemy'],['ensorceleur','sorcery'],['magicien','arcane-recovery'],['occultiste','magical-cunning'],['paladin','lay-on-hands']]){
  const s=fixture(cls,10);start(s);const r=playView(s,sheetModel(s,c)).resources.find(r=>r.id===id);act(s,{type:'spend',resource:id,amount:r.max});assert.equal(rest(s).resources.find(r=>r.id===id).remaining,0);assert.equal(rest(s,'long-rest').resources.find(r=>r.id===id).remaining,r.max);
 }
});
test('Flash protecteur suit le palier de niveau 6 ; une récupération inconnue reste manuelle',()=>{
 assert.equal(resourceRecovery('quota-flash-protecteur',{level:3}).short,0);assert.equal(resourceRecovery('quota-flash-protecteur',{level:6}).short,'all');assert.equal(resourceRecovery('quota-non-referencee',{level:20}),null);
 for(const level of [3,6]){const s=classFixture(c,'clerc',level,'clerc_domaine_lumiere');start(s);const r=playView(s,sheetModel(s,c)).resources.find(r=>r.id==='quota-flash-protecteur');act(s,{type:'spend',resource:r.id,amount:r.max});assert.equal(rest(s).resources.find(x=>x.id===r.id).remaining,level>=6?r.max:0);}
});
test('Prévisualisation sans mutation, confirmation obligatoire et repos à zéro PV refusé',()=>{
 const s=fixture();start(s);const stamp=JSON.stringify(s);assert(restPreview(s,sheetModel(s,c),{type:'long-rest'}).length>3);assert.equal(JSON.stringify(s),stamp);
 assert.throws(()=>act(s,{type:'long-rest'}));act(s,{type:'set-current',amount:0});assert.throws(()=>rest(s));assert.throws(()=>rest(s,'long-rest'));
});
test('Tous les niveaux des classes gardent des pools de sorts et dés de vie valides',()=>{
 for(const cls of c.classes)for(const level of [1,3,5,10,20]){
  const s=fixture(cls.id,level);const m=sheetModel(s,c);start(s);const v=playView(s,m);assert.equal(v.hitDice.max,level);
  for(const slot of v.slots){assert(slot.max>0&&slot.rank>=1&&slot.rank<=9);act(s,{type:'spend-slot',slot:slot.id,amount:slot.max});}
  const after=rest(s,'long-rest');assert(after.slots.every(x=>x.remaining===x.max));assert.equal(after.hitDice.remaining,level);
 }
});
test('Validation, sauvegarde et compatibilité v1 : champs nouveaux facultatifs, données mal formées refusées',()=>{
 const legacy={version:1,hpLost:2,tempHp:0,used:{}};assert.deepEqual(validatePlayState(legacy),legacy);
 const s=fixture();start(s);act(s,{type:'spend-slot',slot:'spell-2',amount:1});rest(s,'short-rest',{hitDice:1,healing:3});
 assert.deepEqual(validateSavedCharacter(characterSnapshot(s),c).character.playState,s.playState);
 for(const invalid of [{slotUsed:{'spell-10':1}},{slotUsed:{pact:-1}},{slotUsed:[]},{hitDiceUsed:1.5},{lastRest:{kind:'long',at:'bad'}}])assert.throws(()=>validatePlayState({...legacy,...invalid}),e=>e.status===400);
});
