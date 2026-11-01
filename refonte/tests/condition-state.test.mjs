import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {CONDITIONS,freshDeathSaves} from '../maquette/condition-rules.mjs';
import {applyPlayAction,playView,validatePlayState,restPreview} from '../maquette/play-state.mjs';
const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('fixtures/rules-2024.json',import.meta.url))));
const fixture=(cls='barbare',level=3)=>originFixture(c,cls,level,{speciesId:'orc'},'fermier');
const view=s=>playView(s,sheetModel(s,c));
const act=(s,a)=>{s.playState=applyPlayAction(s,sheetModel(s,c),a);return view(s);};
const start=(s,hp=sheetModel(s,c).hp)=>act(s,{type:'start',currentHp:hp});
const flag=(s,condition,active=true)=>act(s,{type:'set-condition',condition,active});
const roll=(s,die,modifier=0)=>act(s,{type:'death-roll',die,modifier});

test('Quatorze états déclarables, déductions non cumulées et retrait de la seule source manuelle',()=>{
 assert.equal(CONDITIONS.length,14);const s=fixture();start(s);flag(s,'paralyzed');flag(s,'incapacitated');flag(s,'incapacitated',false);
 assert(view(s).effects.active.some(x=>x.id==='incapacitated'&&x.implicit));assert.equal(view(s).effects.speed,0);assert(!s.playState.conditions.includes('incapacitated'));
 flag(s,'paralyzed',false);assert(!view(s).effects.active.length);
});
test('Étourdi ne fixe pas la Vitesse à zéro en 2024 ; les états bloquants et l’Épuisement le font correctement',()=>{
 const s=fixture();start(s);const speed=sheetModel(s,c).speed;flag(s,'stunned');assert.equal(view(s).effects.speed,speed);
 act(s,{type:'set-exhaustion',amount:2});assert.equal(view(s).effects.speed,Math.max(0,speed-3));assert.equal(view(s).effects.d20Penalty,4);
 for(const id of ['grappled','restrained','paralyzed','petrified']){flag(s,id);assert.equal(view(s).effects.speed,0);flag(s,id,false);}
});
test('Inconscient manuel et état lié à zéro PV sont distincts ; À terre reste après le réveil',()=>{
 const s=fixture();start(s);flag(s,'unconscious');assert(view(s).effects.active.some(x=>x.id==='prone'));flag(s,'unconscious',false);assert(s.playState.conditions.includes('prone'));
 flag(s,'prone',false);act(s,{type:'set-current',amount:0});assert(view(s).effects.zeroUnconscious);act(s,{type:'zero-hp-exception',active:true});assert(!view(s).effects.active.some(x=>x.id==='unconscious'));
 flag(s,'unconscious');act(s,{type:'heal',amount:2});assert(s.playState.conditions.includes('unconscious'));assert.equal(view(s).effects.life,'alive');assert.equal(s.playState.zeroHpConscious,false);
});
test('Trois réussites stabilisent, remettent les compteurs à zéro et ne rendent aucun PV',()=>{
 const s=fixture();start(s,0);roll(s,10);roll(s,15);const result=roll(s,19);
 assert.equal(result.currentHp,0);assert.equal(result.effects.life,'stable');assert.deepEqual(s.playState.deathSaves,{...freshDeathSaves(),stable:true});assert.throws(()=>roll(s,20));
 act(s,{type:'heal',amount:1});assert.equal(view(s).effects.life,'alive');assert.deepEqual(s.playState.deathSaves,freshDeathSaves());assert(s.playState.conditions.includes('prone'));
});
test('1 et 20 naturels priment sur les modificateurs ; le malus d’Épuisement s’applique aux autres jets',()=>{
 const s=fixture();start(s,0);act(s,{type:'set-exhaustion',amount:2});assert.equal(roll(s,11,0).effects.death.failures,1);
 assert.equal(roll(s,20,-100).currentHp,1);assert.deepEqual(s.playState.deathSaves,freshDeathSaves());
 act(s,{type:'set-current',amount:0});assert.equal(roll(s,1,100).effects.death.failures,2);
 const other=fixture();start(other,0);assert.equal(roll(other,9,2).effects.death.successes,1);
});
test('Trois échecs déclarent la mort ; les soins, jets et repos ne ressuscitent pas',()=>{
 const s=fixture();start(s,0);roll(s,1);assert.equal(roll(s,2).effects.life,'dead');
 assert.throws(()=>roll(s,20));assert.throws(()=>act(s,{type:'heal',amount:10}));assert.throws(()=>act(s,{type:'long-rest',confirmed:true}));assert.throws(()=>act(s,{type:'set-current',amount:2}));
 assert.throws(()=>act(s,{type:'revive',amount:1}));act(s,{type:'revive',amount:2,confirmed:true});assert.equal(view(s).currentHp,2);assert.deepEqual(s.playState.deathSaves,freshDeathSaves());
});
test('Dégâts à zéro PV : échecs déclarés, coup critique et perte de stabilisation même avec PV temporaires',()=>{
 const s=fixture();start(s);act(s,{type:'damage',amount:1000});assert.equal(view(s).effects.death.failures,0);
 act(s,{type:'stabilize'});act(s,{type:'set-temp',amount:5});act(s,{type:'damage',amount:1,deathFailures:1});assert.equal(view(s).tempHp,4);assert.equal(view(s).effects.life,'dying');assert.equal(view(s).effects.death.failures,1);
 act(s,{type:'damage',amount:1,deathFailures:2});assert.equal(view(s).effects.life,'dead');assert.equal(view(s).effects.death.failures,3);
});
test('Déclaration de mort et correction des compteurs demandent une confirmation explicite',()=>{
 const s=fixture();start(s);assert.throws(()=>act(s,{type:'declare-dead'}));act(s,{type:'declare-dead',confirmed:true});assert.equal(view(s).currentHp,0);
 assert.throws(()=>act(s,{type:'set-death-counts',successes:0,failures:0}));assert.throws(()=>act(s,{type:'set-death-counts',successes:3,failures:3,confirmed:true}));
 act(s,{type:'set-death-counts',successes:0,failures:1,confirmed:true});assert.equal(view(s).effects.life,'dying');assert.equal(view(s).currentHp,0);
 act(s,{type:'set-death-counts',successes:3,failures:0,confirmed:true});assert.equal(view(s).effects.life,'stable');
});
test('Épuisement 6 : confirmation, mort, aucune résurrection implicite en baissant le niveau',()=>{
 const s=fixture();start(s);assert.throws(()=>act(s,{type:'set-exhaustion',amount:6}));act(s,{type:'set-exhaustion',amount:6,confirmed:true});assert.equal(view(s).effects.life,'dead');assert.equal(view(s).currentHp,0);
 assert.throws(()=>act(s,{type:'revive',amount:1,confirmed:true}));act(s,{type:'set-exhaustion',amount:5});assert.equal(view(s).effects.life,'dead');act(s,{type:'revive',amount:1,confirmed:true});assert.equal(view(s).currentHp,1);
});
test('Repos long et Résistance primitive du rôdeur réduisent l’Épuisement sans effacer les autres états',()=>{
 for(const [cls,level,shortExpected]of [['barbare',10,2],['rodeur',9,2],['rodeur',10,1]]){
  const s=fixture(cls,level);start(s);flag(s,'poisoned');act(s,{type:'set-exhaustion',amount:2});act(s,{type:'short-rest',hitDice:0,healing:0,confirmed:true});assert.equal(view(s).effects.exhaustion,shortExpected);
  assert(restPreview(s,sheetModel(s,c),{type:'long-rest'}).some(l=>l.startsWith('Épuisement')));act(s,{type:'long-rest',confirmed:true});assert.equal(view(s).effects.exhaustion,Math.max(0,shortExpected-1));assert(s.playState.conditions.includes('poisoned'));
 }
});
test('La validation serveur normalise les compteurs à PV positifs sans modifier l’entrée source',()=>{
 const s=fixture();start(s);const input=characterSnapshot(s);input.playState.deathSaves={successes:1,failures:2,stable:false,dead:false};const original=JSON.stringify(input);
 assert.deepEqual(validateSavedCharacter(input,c).character.playState.deathSaves,freshDeathSaves());assert.equal(JSON.stringify(input),original);
});
test('Anciens suivis compatibles et champs mal formés refusés avant sauvegarde',()=>{
 const old={version:1,hpLost:0,tempHp:0,used:{}};assert.deepEqual(validatePlayState(old),old);
 for(const extra of [{conditions:['unknown']},{conditions:['prone','prone']},{conditions:'prone'},{exhaustion:7},{exhaustion:1.5},{zeroHpConscious:1},{deathSaves:{successes:3,failures:0,stable:false,dead:false}},{deathSaves:{successes:0,failures:0,stable:true,dead:true}}])assert.throws(()=>validatePlayState({...old,...extra}),e=>e.status===400);
 const s=fixture();const copy=JSON.stringify(s);renderSheet(s,c);assert.equal(JSON.stringify(s),copy);assert(!Object.hasOwn(characterSnapshot(s),'playState'));
});
test('Les valeurs de base et dés sont préservés ; le rappel des effets est visible dans les autres rubriques',()=>{
 const s=fixture(),before=sheetModel(s,c),dice=JSON.stringify([s.rolls,s.hpRolls]);start(s);flag(s,'paralyzed');act(s,{type:'set-exhaustion',amount:3});
 const after=sheetModel(s,c);for(const key of ['hp','speed','ac','scores','mods','slots','attacks','magic'])assert.deepEqual(after[key],before[key]);assert.equal(JSON.stringify([s.rolls,s.hpRolls]),dice);
 const html=renderSheet(s,c,{activeTab:'spells'});assert.match(html,/aria-label="États en cours"/);assert.match(html,/Épuisement 3 : −6/);assert.match(html,/Paralysé/);assert.equal(view(s).effects.speed,0);
});
