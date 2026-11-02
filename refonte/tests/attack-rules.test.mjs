import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDamage,damagePlan,attackRoll,damageRoll,adjustedDamage,participantAttacks} from '../access/attack-rules.mjs';
test('Expressions de dégâts : plusieurs groupes, constantes et critique sans doubler le bonus fixe',()=>{
  assert.deepEqual(parseDamage('2d10 + 1d8 - 2'),{formula:'2d10+1d8-2',dice:[{count:2,sides:10},{count:1,sides:8}],flat:-2});
  assert.deepEqual(damagePlan('1d6+3',true).dice,[{count:2,sides:6}]);assert.equal(damagePlan('1d6+3',true).flat,3);
  assert.deepEqual(damagePlan('1+3',true).dice,[]);assert.equal(damagePlan('1+3',true).flat,4);
  for(const formula of ['1d6+-2','-1d6','1d6;process.exit()','0d6','1d1','101d6','1d1000','(1d6)*2',''])assert.throws(()=>parseDamage(formula),e=>e.status===400);
});
test('Avantage et désavantage gardent le bon d20 et affichent le dé écarté',()=>{
  const common={mode:'physical',dice:[1,20],bonus:10,ac:15};
  const advantage=attackRoll({...common,advantage:'advantage'});assert.equal(advantage.natural,20);assert.equal(advantage.outcome,'critical');assert.equal(advantage.dice[0].kept,false);
  const disadvantage=attackRoll({...common,advantage:'disadvantage'});assert.equal(disadvantage.natural,1);assert.equal(disadvantage.outcome,'miss');assert.equal(disadvantage.dice[1].kept,false);
  const equal=attackRoll({...common,dice:[12,12],advantage:'advantage'});assert.equal(equal.dice[0].kept,true);assert.equal(equal.dice[1].kept,false);
});
test('Toucher : seuil de critique de la fiche, échec naturel et Épuisement explicitement compté',()=>{
  assert.equal(attackRoll({mode:'physical',dice:[1],bonus:100,ac:0}).outcome,'miss');
  assert.equal(attackRoll({mode:'physical',dice:[20],bonus:0,penalty:100,ac:100}).outcome,'critical');
  assert.equal(attackRoll({mode:'physical',dice:[19],bonus:0,ac:100,criticalFrom:19}).outcome,'critical');
  const result=attackRoll({mode:'physical',dice:[13],bonus:5,adjustment:2,penalty:4,ac:16});assert.equal(result.total,16);assert.equal(result.outcome,'hit');
});
test('Dés physiques bornés et dés de l’application issus uniquement du générateur serveur',()=>{
  let calls=0;const random=side=>{calls++;return side;};
  assert.equal(attackRoll({mode:'physical',dice:[8],bonus:1,ac:10},random).natural,8);assert.equal(calls,0);
  const rolled=attackRoll({mode:'app',advantage:'advantage',bonus:1,ac:10},random);assert.deepEqual(rolled.dice.map(d=>d.value),[20,20]);assert.equal(calls,2);
  for(const dice of [[0],[21],['10'],[10,11]])assert.throws(()=>attackRoll({mode:'physical',dice,bonus:0,ac:10}),e=>e.status===400);
  assert.throws(()=>attackRoll({mode:'app',dice:[20],bonus:0,ac:10},random),e=>e.status===400);assert.equal(calls,2);
});
test('Dégâts : dés critiques, corrections ajoutées une fois, fixes et résistance arrondie',()=>{
  const rolled=damageRoll({expression:'1d6+3',critical:true,mode:'physical',dice:[2,5],adjustment:4});assert.equal(rolled.total,14);assert.equal(rolled.flat,3);
  assert.equal(damageRoll({expression:'1d4-2',mode:'physical',dice:[1]}).total,0);
  let calls=0;assert.equal(damageRoll({expression:'4',mode:'app'},()=>{calls++;return 1;}).total,4);assert.equal(calls,0);
  assert.equal(adjustedDamage(7,'resistance'),3);assert.equal(adjustedDamage(7,'vulnerability'),14);assert.equal(adjustedDamage(7,'immunity'),0);assert.equal(adjustedDamage(7,'resistance',2),5);
  assert.throws(()=>damageRoll({expression:'1d6',critical:true,mode:'physical',dice:[6]}),e=>e.status===400);
});
test('Armes : polyvalence, bonus d’aptitude, dégâts fixes de sarbacane et mains nues',()=>{
  const model={mods:{FOR:3},proficiency:2,attacks:[{nom:'Épée longue',attack:5,damageBonus:3,degats:{de:'1d8',polyvalente:'1d10',type:'tranchants'},criticalFrom:19,featRules:['Duel à vérifier.']},{nom:'Sarbacane',attack:4,damageBonus:2,degats:{de:'1',type:'perforants'}}]};
  const attacks=participantAttacks({kind:'pc'},model);assert.equal(attacks[0].formula,'1d8+3');assert.equal(attacks[1].formula,'1d10+3');assert.equal(attacks[0].criticalFrom,19);assert.equal(attacks[2].formula,'1');assert.equal(attacks[3].formula,'1+3');
  const npc=participantAttacks({kind:'npc',bestiary:{attacks:[{name:'Morsure',attackBonus:0,damage:'2d6+1d4+2',damageType:'perforants'}]}},{});assert(npc[0].usable);assert.equal(npc[0].bonus,0);
});
