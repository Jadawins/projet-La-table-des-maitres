import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {catalogue as c,setup,player} from './spell-fixture.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {applyPlayAction,playView} from '../maquette/play-state.mjs';
import {POTIONS,potionResult,consumeItem,validateEquipmentState,validateSpent,validateLastUse,reconcileEquipment} from '../maquette/equipment-state.mjs';
import {pdfValues} from '../maquette/character-pdf.mjs';
import {beginAdvancement,finishAdvancement} from '../maquette/character-advancement.mjs';import {completeAdvancement} from '../audit/advancement-fixture.mjs';
const blank=()=>({version:1,armor:'',shield:'',weapons:[]});
const item=(catalogueRef,name=catalogueRef)=>({id:randomUUID(),name,quantity:2,description:'',catalogueRef});
const fixture=(cls='clerc')=>classFixture(c,cls,3,cls==='clerc'?'clerc_domaine_vie':'',{divineOrder:'Protecteur'});
const refs=s=>sheetModel({...s,equipmentState:undefined},c).possessions;
const use=(s,ref,result)=>consumeItem(s,refs(s),ref,result,{id:randomUUID(),at:new Date().toISOString(),heal:(state,amount)=>applyPlayAction(state,sheetModel(state,c),{type:'heal',amount})});
test('Compatibilité : un objet libre ne change aucun calcul ; les nouveaux champs restent absents',()=>{
  const s=fixture(),before=sheetModel(s,c);s.inventoryItems=[{id:randomUUID(),name:'Harnois +9',quantity:1,description:''}];const after=sheetModel(s,c);
  for(const key of ['ac','acNote','speed','attacks','hp'])assert.deepEqual(after[key],before[key]);assert.equal(Object.hasOwn(characterSnapshot(s),'equipmentState'),false);
});
test('Équipement explicite vide : retire armure, bouclier et armes des attaques sans perdre les possessions',()=>{
  const s=fixture(),before=sheetModel(s,c);s.equipmentState=blank();const m=sheetModel(s,c);assert.equal(m.ac,10+m.mods.DEX);assert.equal(m.equippedShield,false);assert.equal(m.attacks.length,0);assert.deepEqual(m.inventory,before.inventory);assert.equal(validateSavedCharacter(s,c).status,'ready');
});
test('Armure et bouclier acquis : CA et PDF utilisent uniquement les objets portés, sans bonus ajouté par le nom',()=>{
  const s=fixture(),armor=item('armor:harnois','Harnois du roi +5'),shield=item('armor:bouclier');s.inventoryItems=[armor,shield];s.equipmentState={...blank(),armor:'item:'+armor.id,shield:'item:'+shield.id};
  const m=sheetModel(s,c);assert.equal(m.ac,20);assert.equal(m.equippedShield,true);const pdf=pdfValues(s,c);assert.equal(pdf.text.ac,20);assert.equal(pdf.checks.shield,true);
  s.equipmentState.shield='';assert.equal(sheetModel(s,c).ac,18);assert.equal(pdfValues(s,c).checks.shield,false);
});
test('Arme canonique acquise : caractéristique, maîtrise, dégâts, attaques et doublons',()=>{
  const s=fixture(),weapon=item('weapon:dague','Dague personnelle');s.inventoryItems=[weapon,{...weapon,id:randomUUID()}];s.equipmentState={...blank(),weapons:s.inventoryItems.map(i=>'item:'+i.id)};
  const m=sheetModel(s,c),a=m.attacks.find(a=>a.nom==='Dague');assert.equal(m.attacks.length,1);assert.equal(a.attack,Math.max(m.mods.DEX,m.mods.FOR)+m.proficiency);assert.equal(a.degats.de,'1d4');assert.equal(a.trained,true);
  s.inventoryItems=[item('weapon:arclong')];s.equipmentState.weapons=['item:'+s.inventoryItems[0].id];const other=sheetModel(s,c);assert.equal(other.attacks[0].ability,'DEX');
});
test('Moine : porter et retirer une armure désactive puis rétablit défense et arts martiaux',()=>{
  const s=fixture('moine'),armor=item('armor:armure_de_cuir');s.inventoryItems=[armor];s.equipmentState=blank();const naked=sheetModel(s,c);assert.equal(naked.ac,10+naked.mods.DEX+naked.mods.SAG);assert.ok(naked.attacks.some(a=>a.nom==='Mains nues'));
  s.equipmentState.armor='item:'+armor.id;const worn=sheetModel(s,c);assert.equal(worn.ac,11+worn.mods.DEX);assert.ok(!worn.attacks.some(a=>a.nom==='Mains nues'));assert.match(worn.ruleNotices,/sans formation/);
  const shield=item('armor:bouclier');s.inventoryItems.push(shield);s.equipmentState.armor='';s.equipmentState.shield='item:'+shield.id;const shielded=sheetModel(s,c);assert.equal(shielded.ac,10+shielded.mods.DEX);assert.ok(!shielded.attacks.some(a=>a.nom==='Mains nues'));assert.equal(shielded.speed,worn.speed);
});
test('Armure intermédiaire : plafonne la DEX positive et conserve la DEX négative',()=>{
  const s=fixture(),armor=item('armor:cuirasse');s.inventoryItems=[armor];s.equipmentState={...blank(),armor:'item:'+armor.id};s.scores.DEX=18;let m=sheetModel(s,c);assert.equal(m.ac,16);s.scores.DEX=8;m=sheetModel(s,c);assert.equal(m.ac,13);
});
test('Sélections et références invalides refusées ; retirer ou changer le type d’un objet le déséquipe',()=>{
  const s=fixture(),a=item('armor:harnois');s.inventoryItems=[a];s.equipmentState={...blank(),weapons:['item:'+a.id]};assert.throws(()=>validateSavedCharacter(s,c),e=>e.status===400);
  s.equipmentState={...blank(),armor:'item:'+a.id};s.inventoryItems=[];reconcileEquipment(s,refs(s));assert.deepEqual(s.equipmentState,blank());
  s.inventoryItems=[item('weapon:introuvable')];assert.throws(()=>validateSavedCharacter(s,c),e=>e.status===400);
  for(const value of [null,{}, {...blank(),weapons:['item:'+a.id,'item:'+a.id]},{...blank(),armor:{$ne:null}}])assert.throws(()=>validateEquipmentState(value),e=>e.status===400);
  assert.throws(()=>validateSpent({'start:corde':0}),e=>e.status===400);assert.throws(()=>validateLastUse({}),e=>e.status===400);
});
test('Dés : résultats physiques contrôlés et application lancée uniquement par une action explicite',()=>{
  assert.deepEqual(potionResult(POTIONS[0],'physical',[1,4]),{mode:'physical',dice:[1,4],healing:7});let rolls=0;
  assert.equal(potionResult(POTIONS[3],'app',undefined,()=>{rolls++;return 4;}).healing,60);assert.equal(rolls,10);
  for(const dice of [[],[0,4],[1,5],[1,1,1],['2',2]])assert.throws(()=>potionResult(POTIONS[0],'physical',dice),e=>e.status===400);
  assert.throws(()=>potionResult(POTIONS[0],'app',[1,1],()=>1),e=>e.status===400);
});
test('Potion : une quantité et les soins dans un snapshot, soins plafonnés, PV temporaires conservés',()=>{
  const s=fixture(),p=item('potion:healing');s.inventoryItems=[p];const m=sheetModel(s,c);s.playState=applyPlayAction(s,m,{type:'start',currentHp:m.hp-3});s.playState.tempHp=8;
  const original=JSON.stringify(s),next=use(s,'item:'+p.id,potionResult(POTIONS[0],'physical',[4,4]));assert.equal(JSON.stringify(s),original);assert.equal(next.inventoryItems[0].quantity,1);assert.equal(next.playState.hpLost,0);assert.equal(next.playState.tempHp,8);assert.equal(next.inventoryLastUse.healing,10);assert.equal(validateSavedCharacter(next,c).status,'ready');
});
test('Potion à 0 PV : nettoie les jets de mort ; mort déclarée ou suivi absent refusent la dépense',()=>{
  const s=fixture(),p=item('potion:healing');s.inventoryItems=[p];assert.throws(()=>use(s,'item:'+p.id,potionResult(POTIONS[0],'physical',[1,1])),e=>e.status===400);
  s.playState=applyPlayAction(s,sheetModel(s,c),{type:'start',currentHp:0});s.playState.deathSaves={successes:1,failures:2,stable:false,dead:false};const next=use(s,'item:'+p.id,potionResult(POTIONS[0],'physical',[1,1]));assert.equal(playView(next,sheetModel(next,c)).currentHp,4);assert.equal(next.playState.deathSaves.failures,0);
  s.playState.deathSaves.dead=true;assert.throws(()=>use(s,'item:'+p.id,potionResult(POTIONS[0],'physical',[1,1])),e=>e.status===400);assert.equal(s.inventoryItems[0].quantity,2);
});
test('Consommable libre : dernière unité retirée, aucun effet ni bonus inféré du texte',()=>{
  const s=fixture(),p={id:randomUUID(),name:'Ration de soin +10',description:'Soigne 100 PV',quantity:1,consumable:true};s.inventoryItems=[p];const next=use(s,'item:'+p.id,null);assert.deepEqual(next.inventoryItems,[]);assert.equal(next.playState,undefined);assert.equal(next.inventoryLastUse.healing,0);assert.throws(()=>use(next,'item:'+p.id,null),e=>e.status===400);
});
test('Matériel de départ : une potion consommée garde un décompte séparé sans réécrire le choix initial',()=>{
  const s=fixture(),starting=[{nom:'Potion de guérison',quantity:2}],p=refs(s);s.playState=applyPlayAction(s,sheetModel(s,c),{type:'start',currentHp:1});
  const possessions=[{...starting[0],ref:'start:potiondeguerison',consumable:true,potion:POTIONS[0]}];const next=consumeItem(s,possessions,possessions[0].ref,potionResult(POTIONS[0],'physical',[1,1]),{id:randomUUID(),at:new Date().toISOString(),heal:(state,amount)=>applyPlayAction(state,sheetModel(state,c),{type:'heal',amount})});assert.equal(next.inventorySpent['start:potiondeguerison'],1);assert.equal(s.inventorySpent,undefined);
});
test('Sauvegarde perdue : répéter le même snapshot ne consomme pas deux fois ; un autre onglet reste protégé',async()=>{
  const t=await setup(),r=await t.characters.get(player.userId,t.id),p=item('potion:healing');const first=await t.characters.save(player.userId,t.id,{...r.character,inventoryItems:[p]},r.revision);
  const next=use(first.character,'item:'+p.id,potionResult(POTIONS[0],'physical',[2,3])),saved=await t.characters.save(player.userId,t.id,next,first.revision);const replay=await t.characters.save(player.userId,t.id,next,first.revision);assert.equal(replay.revision,saved.revision);assert.equal(replay.character.inventoryItems[0].quantity,1);
  await assert.rejects(t.characters.save(player.userId,t.id,use(first.character,'item:'+p.id,potionResult(POTIONS[0],'physical',[1,1])),first.revision),e=>e.status===409);
});
test('Ancien client : conserve simultanément références portées, objets et dernier usage sans les déséquiper',async()=>{
  const t=await setup(),r=await t.characters.get(player.userId,t.id),a=item('armor:harnois');let state={...r.character,inventoryItems:[a],equipmentState:{...blank(),armor:'item:'+a.id}};
  const saved=await t.characters.save(player.userId,t.id,state,r.revision),old=structuredClone(r.character);old.details.story='Ancien client';const updated=await t.characters.save(player.userId,t.id,old,saved.revision);assert.deepEqual(updated.character.equipmentState,state.equipmentState);assert.deepEqual(updated.character.inventoryItems,[a]);
});
test('Multiclasse et montée de niveau : conserve équipement et quantités sans cumuler plusieurs armures',()=>{
  const s=classFixture(c,'barbare',1,'',{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14}}),armor=item('armor:harnois');s.inventoryItems=[armor];s.equipmentState={...blank(),armor:'item:'+armor.id};
  const change=beginAdvancement(s,c,'guerrier'),next=finishAdvancement(change.base,completeAdvancement(change.base,change.candidate,c),c);assert.deepEqual(next.equipmentState,s.equipmentState);assert.equal(sheetModel(next,c).ac,18);assert.equal(validateSavedCharacter(next,c).status,'ready');assert.equal(sheetModel(next,c).possessions.filter(i=>i.ref==='item:'+armor.id).length,1);
});
