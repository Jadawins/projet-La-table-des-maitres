import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {playView,applyPlayAction} from '../maquette/play-state.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {createCombatStore} from '../access/combat-store.mjs';
import {groupMemory} from './group-memory.mjs';
import {memoryCollection} from './admin-memory.mjs';
const catalogue=buildCatalogue(JSON.parse(await readFile(new URL('./fixtures/rules-2024.json',import.meta.url))));
const mj={userId:'mj'},player={userId:'player'},outsider={userId:'outsider'};
export async function setup({classId='clerc',spellId=null}={}){
  let draws=0;
  const characters=createCharacterStore({collection:memoryCollection(),validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:'spell-tests'});
  const groups=createGroupStore({collection:groupMemory(),characters}),created=await groups.create(mj,{name:'Magie',alias:'Wiwi'}),groupId=created.group.id;
  await groups.join(player,{code:created.invitationCode,alias:'Clerc'});
  const id=randomUUID(),state=classFixture(catalogue,classId,5,classId==='clerc'?'clerc_domaine_vie':catalogue.subclasses.find(s=>s.classe_parente===classId).id);state.name='Lanceur de test';if(classId==='clerc')state.divineOrder='Protecteur';if(spellId){state.prepared[0]=spellId;if(classId==='magicien'&&!state.classChoices.spellbook.includes(spellId))state.classChoices.spellbook[0]=spellId;}
  state.playState=applyPlayAction(state,sheetModel(state,catalogue),{type:'start',currentHp:sheetModel(state,catalogue).hp});
  await characters.save(player.userId,id,state,0);await groups.attach(player,groupId,{characterId:id});
  const collection=groupMemory(),spellCollection=groupMemory();
  const make=()=>createCombatStore({spellCatalogue:catalogue.spells,collection,spellCollection,characters,groups,sheetModel:s=>sheetModel(s,catalogue),playView,applyPlayAction,attackRandomFace:sides=>{draws++;return Math.min(4,sides);}});
  let combats=make(),value=await combats.create(mj,groupId,{name:'La tour'});
  const act=async data=>{value=await combats.get(mj,groupId);return value=await combats.act(mj,groupId,{combatId:value.combat.id,revision:value.combat.revision,...data});};
  await act({type:'add-npc',name:'Adversaire',maxHp:100,ac:12});const [pc,npc]=value.combat.participants;
  await act({type:'visible',participantId:npc.id,value:true});for(const p of value.combat.participants)await act({type:'initiative',participantId:p.id,value:15});await act({type:'start'});
  const prepare=async spellId=>{
    const options=await combats.spellOptions(player,groupId,pc.id),spell=options.spells.find(s=>s.id===spellId);assert(spell,'Sort de test absent : '+spellId);
    const payment=spell.level?spell.slots[0].id:'cantrip';
    const result=await combats.spellPrepare(player,groupId,{combatId:options.combatId,revision:options.revision,casterId:pc.id,spellKey:spell.key,payment,targetIds:[npc.id]});
    return result.cast;
  };
  const approve=async c=>{
    const suggestion=c.spell.suggestions[c.rank];
    return combats.spellApprove(mj,groupId,{castId:c.id,completed:true,plan:{...suggestion,rounds:0,note:'Effets supplémentaires vérifiés à la table'},confirmed:true});
  };
  return {state,get combats(){return combats;},make,restart(){combats=make();},characters,groups,groupId,id,pc,npc,act,prepare,approve,spellCollection,draws:()=>draws};
}


export {catalogue,mj,player,outsider};
