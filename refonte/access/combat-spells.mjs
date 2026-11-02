import {randomUUID} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';
import {attackRoll,damageRoll,damagePlan,adjustedDamage,integer} from './attack-rules.mjs';
import {spellChoices,spellStamp,validateSpellPlan,savingThrow,abilities} from './spell-rules.mjs';
import {CONDITIONS,conditionView} from '../maquette/condition-rules.mjs';

const fault=(status,message)=>Object.assign(new Error(message),{status});
const text=(s,max=2000)=>typeof s==='string'?s.trim().slice(0,max):'';
const terminal=new Set(['complete','ended','cancelled']);

export function createCombatSpells({collection,load,fighter,writeSnapshot,hasReceipt,getView,applyPlayAction,npcSpells=[],now=()=>new Date(),randomFace}){
  const inflight=new Map();
  const own=(actor,g,p)=>g.isMJ||p.kind==='pc'&&p.ownerId===actor.userId;
  const defense=f=>spellStamp({ac:f.model.ac,saves:f.model.saves,penalty:f.live.effects.d20Penalty,conditions:f.live.effects.active.map(e=>e.id),resistances:f.model.resistances,immunities:f.model.immunities});
  const active=ctx=>{if(ctx.combat.status!=='running')throw fault(400,'Démarrez ou reprenez le combat.');};
  const mj=ctx=>{if(!ctx.group.isMJ)throw fault(403,'Cette action est réservée au MJ.');};
  async function save(c,fields){
    const update=await collection.updateOne({id:c.id,revision:c.revision},{$set:{...fields,revision:c.revision+1,updatedAt:now()}});
    if(update.matchedCount!==1)throw fault(409,'La résolution a changé. Actualisez avant de recommencer.');
    Object.assign(c,fields,{revision:c.revision+1});return c;
  }
  async function read(actor,groupId,id){
    if(!validCharacterId(id))throw fault(400,'Référence de sort invalide.');
    let ctx=await load(actor,groupId);const c=await collection.findOne({id,groupId});
    if(c&&c.combatId!==ctx.combat.id)ctx=await load(actor,groupId,c.combatId);
    if(!c||!ctx.group.isMJ&&c.ownerId!==actor.userId&&!ctx.combat.participants.some(p=>p.id===c.casterId&&p.ownerId===actor.userId)&&!c.targets.some(t=>ctx.combat.participants.some(p=>p.id===t.id&&p.ownerId===actor.userId)))throw fault(404,'Sort introuvable.');
    const source=ctx.combat.participants.find(p=>p.id===c.casterId);if(source)visible(ctx,source);
    return {ctx,c};
  }
  async function locked(id,work){
    if(!validCharacterId(id))throw fault(400,'Référence de sort invalide.');
    const row=await collection.findOne({id}),key=row?.parentId||id;
    if(inflight.has(key))throw fault(409,'Cette résolution est déjà en cours. Actualisez dans un instant.');
    const pending=Promise.resolve().then(work);inflight.set(key,pending);
    try{return await pending;}finally{inflight.delete(key);}
  }
  async function participant(ctx,id){
    const p=ctx.combat.participants.find(p=>p.id===id);if(!p)throw fault(409,'Ce participant n’est plus dans le combat.');
    return {p,f:await fighter(ctx.group,p)};
  }
  function visible(ctx,p){if(!ctx.group.isMJ&&p.kind==='npc'&&!p.visible)throw fault(404,'Cible introuvable.');}
  async function caster(actor,ctx,id){
    const {p,f}=await participant(ctx,id);if(!own(actor,ctx.group,p))throw fault(403,'Choisissez votre propre personnage.');
    if(f.live.effects.life==='dead'||f.live.effects.active.some(c=>c.id==='incapacitated'))throw fault(400,'Ce personnage est neutralisé ou mort.');
    return {p,f};
  }
  function choices(p,f){
    if(p.kind==='pc')return spellChoices(f.state,f.model,f.live);
    const spells=npcSpells.map(s=>({...s,source:'Profil MJ · '+p.name,ability:'',dc:null,attackBonus:null}));
    return spellChoices(f.state,{...f.model,spells},f.live);
  }
  async function targets(ctx,ids){
    if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw fault(400,'Choisissez de une à cent cibles distinctes.');
    return Promise.all(ids.map(async id=>{const {p}=await participant(ctx,id);visible(ctx,p);return {id:p.id,name:p.name,roll:null,damage:null,applied:false};}));
  }
  function dto(actor,ctx,c){
    const allowed=t=>ctx.group.isMJ||ctx.combat.participants.some(p=>p.id===t.id&&(p.kind==='pc'||p.visible));
    return {id:c.id,revision:c.revision,casterId:c.casterId,casterName:c.casterName,ownerId:c.ownerId,spell:c.spell,rank:c.rank,payment:c.payment,
      stage:c.stage,plan:c.plan||null,reason:c.reason||'',damage:c.damage||null,rounds:c.remainingRounds??c.rounds??null,concentration:c.spell.concentration,
      operationPending:Boolean(c.operation),error:c.error||'',createdAt:c.createdAt,startedRound:c.timerRound??c.startedRound,
      parentId:c.parentId||null,npc:Boolean(c.npc),impact:Boolean(c.impact),sharedDamageLocked:Boolean(c.sharedDamageLocked),
      impactsRemaining:c.impactsRemaining||0,
      canEnd:ctx.group.isMJ||c.ownerId===actor.userId||ctx.combat.participants.some(p=>p.id===c.casterId&&p.ownerId===actor.userId),
      earlierCombat:ctx.displayCombatId!==undefined&&ctx.displayCombatId!==c.combatId,
      ...(ctx.group.isMJ&&c.operation?.kind==='effect'&&c.operationFailure===409?{recheckTargetId:c.operation.participantId}:{}),
      dicePlan:c.plan?.formula?damagePlan(c.plan.formula).dice.flatMap(d=>Array(d.count).fill(d.sides)):[],
      targets:c.targets.filter(allowed).map(t=>{
        const canRoll=ctx.group.isMJ||(c.plan?.kind==='attack'?c.ownerId===actor.userId:ctx.combat.participants.some(p=>p.id===t.id&&p.ownerId===actor.userId));
        const full=ctx.group.isMJ||ctx.combat.participants.some(p=>p.id===t.id&&p.ownerId===actor.userId);
        return {id:t.id,name:t.name,applied:t.applied,appliedAmount:t.appliedAmount,exempt:t.exempt,decision:t.decision,
          roll:full||c.plan?.kind==='attack'&&c.ownerId===actor.userId?t.roll:t.roll?{success:t.roll.success,total:undefined}:null,
          damage:t.damage,canRoll,canDamage:ctx.group.isMJ||c.ownerId===actor.userId,
          dicePlan:c.plan?.formula?damagePlan(c.plan.formula,t.roll?.outcome==='critical').dice.flatMap(d=>Array(d.count).fill(d.sides)):[]};
      })};
  }
  async function decorate(c){
    if(!c.parentId&&(c.plan?.impacts||1)>1){const children=await collection.find({parentId:c.id}).limit(100).toArray();c.impactsRemaining=Math.max(0,c.plan.impacts-c.targets.length-children.filter(x=>x.impact).reduce((sum,x)=>sum+x.targets.length,0));}
    return c;
  }
  async function result(actor,groupId,c){const ctx=await load(actor,groupId,c.combatId);return {cast:dto(actor,ctx,await decorate(c)),state:await getView(actor,groupId)};}
  async function snapshot(ctx,p,f,kind,data,receiptId=randomUUID()){
    let playState=f.state.playState;
    if(kind==='cast'){
      if(!f.live.started)throw fault(400,'Commencez le suivi des PV du lanceur avant de lancer le sort.');
      if(f.live.effects.life==='dead'||f.live.effects.active.some(e=>e.id==='incapacitated'))throw fault(400,'Le lanceur est neutralisé ou mort. L’incantation doit être revue.');
      const current=choices(p,f).find(s=>s.key===data.spellKey);
      if(!current||spellStamp([current.key,current.dc,current.attackBonus])!==data.canonicalStamp||f.live.effects.d20Penalty!==data.castPenalty)throw fault(409,'Le sort ou le lanceur a changé avant la dépense. Préparez de nouveau l’incantation.');
      if(data.concentration&&(f.state.playState?.concentration?.id||null)!==data.concentrationBefore)throw fault(409,'La concentration a changé pendant la validation. Annulez cette incantation en attente et préparez-la de nouveau.');
      playState=data.payment==='cantrip'||data.payment==='exception'?structuredClone(playState):applyPlayAction(f.state,f.model,{type:'spend-slot',slot:data.payment,amount:1});
      if(p.kind==='npc'){playState.used||={};const key='npc-spell-'+data.rank;playState.used[key]=(playState.used[key]||0)+1;}
      if(data.concentration)playState.concentration={id:data.castId,name:data.name,combatId:ctx.combat.id,groupId:ctx.combat.groupId,checks:[]};
    }else if(kind==='effect'){
      if(!f.live.started)throw fault(400,'Commencez le suivi des PV de la cible avant de confirmer les effets.');
      playState=data.amount>0&&['damage','heal','temp'].includes(data.effect)?applyPlayAction(f.state,f.model,{type:data.effect==='temp'?'set-temp':data.effect,amount:data.amount,deathFailures:data.deathFailures}):structuredClone(playState);
      if(data.condition&&data.conditionOperation==='remove'){
        playState.conditions=(playState.conditions||[]).filter(id=>id!==data.condition);
        playState.magicEffects=(playState.magicEffects||[]).map(e=>({...e,conditions:e.conditions.filter(id=>id!==data.condition)}));
      }else if((['condition','note'].includes(data.effect)||data.condition)&&!data.exempt){
        playState.magicEffects=[...(playState.magicEffects||[]).filter(e=>e.id!==data.castId),{id:data.castId,name:data.name,conditions:data.condition?[data.condition]:[],note:data.note}];
      }
      if(data.removeEffect)playState.magicEffects=(playState.magicEffects||[]).filter(e=>e.id!==data.castId);
      const conditions=conditionView(playState,Math.max(0,f.model.hp-playState.hpLost),f.model.speed);
      if(conditions.life==='dead'||conditions.active.some(e=>e.id==='incapacitated'))playState.concentration=null;
    }else if(kind==='end'){
      if(!playState)return null;
      playState={...structuredClone(playState),magicEffects:(playState.magicEffects||[]).filter(e=>e.id!==data.castId)};
      if(playState.concentration?.id===data.castId)playState.concentration=null;
    }else if(kind==='concentration')playState={...structuredClone(playState),concentration:data.value};
    return {receiptId,combatId:ctx.combat.id,participantId:p.id,ownerId:p.ownerId,characterId:p.characterId,revision:f.revision,beforeStamp:spellStamp(f.state.playState),character:{...f.state,playState},kind,data};
  }
  async function execute(actor,groupId,c,{retry=false}={}){
    const op=c.operation;if(!op)return;const ctx=await load(actor,groupId,op.combatId||c.combatId);
    const {p,f}=await participant(ctx,op.participantId);
    if(p.ownerId!==op.ownerId||p.characterId!==op.characterId)throw fault(409,'Le propriétaire ou le personnage a changé.');
    if(!await hasReceipt(ctx,p,op.receiptId)){
      if(c.parentId&&op.kind==='effect')await liveParent(ctx,c);
      if(op.kind==='effect'&&op.data.defenseStamp&&op.data.defenseStamp!==defense(f)){
        await save(c,{operationFailure:409,error:'La défense de la cible a changé. Revérifiez son jet avant de confirmer.'});
        throw fault(409,'La défense de la cible a changé. Revérifiez son jet avant de confirmer.');
      }
      if(retry&&(f.revision!==op.revision||spellStamp(f.state.playState)!==op.beforeStamp)){const next=await snapshot(ctx,p,f,op.kind,op.data,op.receiptId);await save(c,{operation:next,error:''});}
      try{await writeSnapshot(ctx,p,c.operation);}
      catch(error){await save(c,{operationFailure:[400,403,404,409].includes(error.status)?error.status:'unknown',error:'Enregistrement à reprendre : vérifiez le résultat puis utilisez Reprendre. Aucun dé ne sera relancé.'});throw error;}
    }
    const update={operation:null,operationFailure:null,error:''};
    if(op.kind==='cast'){update.stage='resolving';update.startedRound=ctx.combat.round;}
    if(op.kind==='effect'){
      update.targets=c.targets.map(t=>t.id===op.participantId?{...t,applied:true,appliedAmount:op.data.amount,exempt:op.data.exempt,decision:op.data.decision}:t);
      if(update.targets.every(t=>t.applied))update.stage=!c.parentId&&(c.spell.concentration||c.plan.rounds||c.plan.effect==='note'||c.plan.condition&&c.plan.conditionOperation!=='remove')?'active':'complete';
    }
    await save(c,update);
  }
  async function beginOperation(actor,groupId,c,p,f,kind,data,sourceContext){
    const ctx=sourceContext||await load(actor,groupId,c.combatId),op=await snapshot(ctx,p,f,kind,data);
    if(!op)return;
    await save(c,{operation:op});await execute(actor,groupId,c);
  }
  function targetRoll(actor,ctx,c,p,f,input){
    if(c.plan.kind==='attack'){
      if(!ctx.group.isMJ&&c.ownerId!==actor.userId)throw fault(403,'Seul le lanceur ou le MJ peut lancer l’attaque.');
      return attackRoll({mode:input.mode,advantage:input.advantage,dice:input.dice,bonus:c.spell.attackBonus,adjustment:input.adjustment,penalty:c.casterPenalty||0,ac:f.model.ac},randomFace);
    }
    if(c.plan.kind!=='save')throw fault(400,'Ce sort n’exige pas de jet de cible.');
    if(!own(actor,ctx.group,p))throw fault(403,'Vous pouvez lancer uniquement la sauvegarde de votre personnage.');
    const forced=['FOR','DEX'].includes(c.plan.saveAbility)&&f.live.effects.active.some(e=>['paralyzed','petrified','stunned','unconscious'].includes(e.id));
    if(forced)return {mode:'rule',dice:[],success:false,total:null,dc:c.spell.dc};
    const bonus=f.model.saves?.find(s=>s.ability===c.plan.saveAbility)?.value,chosenBonus=integer(bonus,-100,100)?bonus:input.bonus;
    if(!integer(bonus,-100,100)&&(!ctx.group.isMJ||!text(input.reason)))throw fault(400,'Le MJ doit préciser le bonus de sauvegarde manquant et son origine.');
    return savingThrow({mode:input.mode,advantage:input.advantage,dice:input.dice,bonus:chosenBonus,adjustment:input.adjustment,penalty:f.live.effects.d20Penalty,dc:c.spell.dc},randomFace);
  }
  const api={
    async list(actor,group,combat){
      const activeRows=await collection.find({groupId:group.id,stage:{$nin:[...terminal]}}).sort({createdAt:-1}).limit(201).toArray();
      const recent=await collection.find({groupId:group.id,combatId:combat.id}).sort({createdAt:-1}).limit(30).toArray();
      const shown=[...activeRows,...recent.filter(c=>terminal.has(c.stage)).slice(0,15)],contexts=new Map([[combat.id,{actor,group,combat}]]),result=[];
      for(const c of shown){
        if(!contexts.has(c.combatId))contexts.set(c.combatId,await load(actor,group.id,c.combatId));
        const ctx=contexts.get(c.combatId),source=ctx.combat.participants.find(p=>p.id===c.casterId);
        if(!group.isMJ&&(!source||source.kind==='npc'&&!source.visible))continue;
        if(group.isMJ||c.ownerId===actor.userId||source?.ownerId===actor.userId||c.targets.some(t=>ctx.combat.participants.some(p=>p.id===t.id&&p.ownerId===actor.userId)))result.push(dto(actor,{...ctx,displayCombatId:combat.id},await decorate(c)));
      }
      return result;
    },
    async options(actor,groupId,casterId){
      const ctx=await load(actor,groupId),{p,f}=await caster(actor,ctx,casterId);
      return {casterId:p.id,npc:p.kind==='npc',combatId:ctx.combat.id,revision:ctx.combat.revision,spells:choices(p,f),
        targets:ctx.combat.participants.filter(p=>ctx.group.isMJ||p.kind==='pc'||p.visible).map(p=>({id:p.id,name:p.name})),
        concentration:f.state.playState?.concentration||null};
    },
    async assertFinishable(actor,groupId){
      const ctx=await load(actor,groupId),rows=await collection.find({groupId,combatId:ctx.combat.id,stage:{$nin:[...terminal]}}).limit(201).toArray();
      if(rows.some(c=>c.operation||['proposed','casting','resolving','ending'].includes(c.stage)))throw fault(409,'Résolvez ou annulez les propositions de sorts en attente avant de terminer le combat. Les effets durables pourront être conservés.');
    },
    async prepare(actor,groupId,input){
      const ctx=await load(actor,groupId);active(ctx);
      if(ctx.combat.id!==input.combatId||ctx.combat.revision!==input.revision)throw fault(409,'Le combat a changé. Actualisez avant de préparer le sort.');
      const {p,f}=await caster(actor,ctx,input.casterId),spell=choices(p,f).find(s=>s.key===input.spellKey);
      if(!spell)throw fault(400,'Ce sort n’est pas disponible sur cette fiche.');
      let rank=0,payment='cantrip';
      if(spell.level>0){
        const slot=spell.slots.find(s=>s.id===input.payment);
        if(!slot&&input.payment!=='exception')throw fault(400,'Choisissez un emplacement disponible.');
        payment=input.payment;rank=slot?.rank??input.rank;
        if(!integer(rank,spell.level,9))throw fault(400,'Choisissez un niveau de lancement valide.');
      }
      const rows=await targets(ctx,input.targetIds),date=now().toISOString();
      if((await collection.find({groupId,stage:{$nin:[...terminal]}}).limit(201).toArray()).length>=200)throw fault(429,'Terminez les effets et résolutions en attente du groupe avant d’en préparer de nouveaux.');
      if((await collection.find({groupId,combatId:ctx.combat.id}).limit(501).toArray()).length>=500)throw fault(429,'Ce combat a atteint la limite de 500 résolutions de sorts. Terminez-le pour préparer la suite.');
      const pending=await collection.find({groupId,combatId:ctx.combat.id,ownerId:actor.userId}).limit(100).toArray();
      if(pending.filter(c=>!terminal.has(c.stage)).length>=20)throw fault(429,'Terminez ou annulez vos sorts en attente.');
      const c={id:randomUUID(),revision:1,groupId,combatId:ctx.combat.id,ownerId:actor.userId,casterId:p.id,casterName:p.name,
        spell,rank,payment,npc:p.kind==='npc',targets:rows,stage:'proposed',createdAt:date,updatedAt:now(),spellStamp:spellStamp([spell.key,spell.dc,spell.attackBonus]),operation:null};
      await collection.insertOne(c);return result(actor,groupId,c);
    },
    async approve(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);mj(ctx);
      if(c.stage!=='proposed')throw fault(409,'Ce sort a déjà été validé ou annulé.');
      if(input.completed!==true)throw fault(400,'Confirmez que l’incantation est terminée et ses conditions vérifiées.');
      const owner={userId:c.ownerId},ownerCtx={...ctx,group:{...ctx.group,isMJ:ctx.group.members.some(m=>m.userId===c.ownerId&&m.role==='mj')}};
      if(!ctx.group.members.some(m=>m.userId===c.ownerId))throw fault(409,'Le lanceur a quitté le groupe.');
      const {p,f}=await caster(owner,ownerCtx,c.casterId),current=choices(p,f).find(s=>s.key===c.spell.key);
      if(!current||spellStamp([current.key,current.dc,current.attackBonus])!==c.spellStamp)throw fault(409,'Le sort ou les caractéristiques du lanceur ont changé. Préparez de nouveau le sort.');
      const plan=validateSpellPlan(input.plan),reason=text(input.reason);
      const spell={...c.spell};
      if(c.npc){
        if(!reason||!integer(input.dc,plan.kind==='save'?1:0,100)||!integer(input.attackBonus,-100,100))throw fault(400,'Le MJ doit vérifier le profil : DD, bonus d’attaque et motif.');
        spell.dc=input.dc;spell.attackBonus=input.attackBonus;
      }
      if(plan.condition&&!CONDITIONS.some(e=>e.id===plan.condition))throw fault(400,'Choisissez un état connu.');
      if(plan.effect==='condition'&&!plan.condition)throw fault(400,'Choisissez l’état à appliquer.');
      if(c.payment==='exception'&&!reason)throw fault(400,'Précisez l’aptitude ou la règle permettant de lancer sans emplacement.');
      if(plan.impacts>1&&!reason)throw fault(400,'Précisez la règle donnant plusieurs impacts à cette incantation.');
      const chosen=await targets(ctx,input.targetIds||c.targets.map(t=>t.id));
      const suggestion=c.spell.suggestions[c.rank];
      if(suggestion?.maxTargets&&chosen.length>suggestion.maxTargets&&!reason)throw fault(400,'Cette modification du nombre de cibles demande un motif du MJ.');
      if(c.spell.concentration&&f.state.playState?.concentration&&input.replaceConcentration!==true)throw fault(400,'Confirmez le remplacement de la concentration actuelle.');
      if((suggestion?.reviewRequired||plan.formula!==suggestion?.formula||plan.kind!==suggestion?.kind||plan.effect!==suggestion?.effect)&&!reason)throw fault(400,'Expliquez le plan de résolution vérifié par le MJ.');
      await save(c,{spell,plan,reason,targets:chosen,stage:'casting',concentrationBefore:f.state.playState?.concentration?.id||null,rounds:plan.rounds||null,remainingRounds:plan.rounds||null,timerCombatId:ctx.combat.id,timerRound:ctx.combat.round,timerAnchorId:ctx.combat.currentId,anchorId:ctx.combat.currentId,casterPenalty:f.live.effects.d20Penalty});
      await beginOperation(actor,groupId,c,p,f,'cast',{spellKey:c.spell.key,canonicalStamp:c.spellStamp,castPenalty:c.casterPenalty,payment:c.payment,rank:c.rank,concentration:c.spell.concentration,concentrationBefore:c.concentrationBefore,castId:c.id,name:c.spell.name});
      await api.reconcile(actor,groupId);
      return result(actor,groupId,c);
    });},
    async roll(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);
      if(c.stage!=='resolving'||c.operation)throw fault(409,'Ce sort ne peut pas recevoir de nouveau jet.');
      const t=c.targets.find(t=>t.id===input.targetId);if(!t||t.applied)throw fault(400,'Choisissez une cible à résoudre.');
      const {p,f}=await participant(ctx,t.id),roll=targetRoll(actor,ctx,c,p,f,input);
      await save(c,{targets:c.targets.map(row=>row.id===t.id?{...row,roll,defenseStamp:defense(f),damage:null}:row)});return result(actor,groupId,c);
    });},
    async recheck(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);mj(ctx);
      const t=c.targets.find(t=>t.id===input.targetId);if(!t||t.applied)throw fault(400,'Choisissez une cible à résoudre.');
      const {p,f}=await participant(ctx,t.id);
      if(c.operation){
        if(c.operation.kind!=='effect'||c.operation.participantId!==t.id||c.operationFailure!==409||await hasReceipt(ctx,p,c.operation.receiptId))throw fault(409,'Reprenez d’abord l’enregistrement en attente.');
        await save(c,{operation:null,operationFailure:null,error:''});
      }
      if(!t.roll){if(c.plan.kind==='direct')return result(actor,groupId,c);throw fault(400,'Cette cible n’a pas encore de jet à revérifier.');}
      const roll=targetRoll(actor,ctx,c,p,f,{mode:'physical',dice:t.roll.dice.map(d=>d.value),advantage:t.roll.advantage,adjustment:t.roll.adjustment,bonus:t.roll.bonus,reason:'Revérification du bonus déclaré'});
      if(t.roll.mode!=='rule')roll.mode=t.roll.mode;
      await save(c,{targets:c.targets.map(row=>row.id===t.id?{...row,roll,defenseStamp:defense(f),damage:roll.outcome==='miss'||(roll.outcome==='critical')!==(t.roll.outcome==='critical')?null:row.damage}:row)});
      return result(actor,groupId,c);
    });},
    async adjudicate(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);mj(ctx);
      const t=c.targets.find(t=>t.id===input.targetId);if(!t||t.applied||!t.roll||c.operation)throw fault(400,'Résolvez d’abord le jet de cette cible.');
      const reason=text(input.reason);if(!reason)throw fault(400,'Expliquez la décision du MJ.');
      const roll={...t.roll};
      if(c.plan.kind==='attack'){if(!['hit','miss','critical'].includes(input.decision))throw fault(400,'Choisissez touche, échec ou critique.');roll.outcome=input.decision;}
      else if(c.plan.kind==='save'){if(!['success','failure'].includes(input.decision))throw fault(400,'Choisissez réussite ou échec.');roll.success=input.decision==='success';}
      else throw fault(400,'Ce sort n’exige pas de jet à arbitrer.');
      await save(c,{targets:c.targets.map(row=>row.id===t.id?{...row,roll,adjudication:reason,damage:c.plan.kind==='attack'&&(roll.outcome==='miss'||(roll.outcome==='critical')!==(t.roll.outcome==='critical'))?null:row.damage}:row)});
      return result(actor,groupId,c);
    });},
    async damage(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);
      if(!ctx.group.isMJ&&c.ownerId!==actor.userId)throw fault(403,'Seul le lanceur ou le MJ prépare les dégâts ou soins.');
      if(c.stage!=='resolving'||c.operation||!['damage','heal','temp'].includes(c.plan.effect))throw fault(400,'Ce sort n’attend pas de jet de dégâts ou soins.');
      if(c.sharedDamageLocked)throw fault(400,'Cet impact reprend le jet commun de l’incantation ; aucun nouveau dé nécessaire.');
      if(c.plan.kind==='attack'){
        const target=c.targets.find(t=>t.id===input.targetId);if(!target||target.applied||!target.roll)throw fault(400,'Résolvez d’abord l’attaque contre cette cible.');
        if(target.roll.outcome==='miss')throw fault(400,'L’attaque a échoué : aucun jet de dégâts.');
        const damage=damageRoll({expression:c.plan.formula,critical:target.roll.outcome==='critical',mode:input.mode,dice:input.dice,adjustment:input.adjustment},randomFace);
        await save(c,{targets:c.targets.map(t=>t.id===target.id?{...t,damage}:t)});
      }else{
        if(c.targets.some(t=>t.applied))throw fault(409,'Le jet commun a déjà servi : il ne peut plus être remplacé.');
        const damage=damageRoll({expression:c.plan.formula,mode:input.mode,dice:input.dice,adjustment:input.adjustment},randomFace);await save(c,{damage});
      }
      return result(actor,groupId,c);
    });},
    async confirm(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);active(ctx);mj(ctx);
      if(c.operation)throw fault(409,'Reprenez d’abord l’enregistrement en attente.');
      const target=c.targets.find(t=>t.id===input.targetId);if(!target)throw fault(404,'Cible introuvable.');
      if(target.applied)return result(actor,groupId,c);
      if(c.parentId)await liveParent(ctx,c);
      if(c.stage!=='resolving'||input.confirmed!==true)throw fault(400,'Vérifiez et confirmez les effets sur la cible.');
      const reason=text(input.reason),exempt=input.exempt===true;
      if(exempt&&!reason)throw fault(400,'Indiquez pourquoi cette cible est épargnée.');
      if(!exempt&&c.plan.kind!=='direct'&&!target.roll)throw fault(400,'Résolvez le jet de cette cible avant les effets.');
      const {p,f}=await participant(ctx,target.id),miss=c.plan.kind==='attack'&&target.roll?.outcome==='miss';
      if(!exempt&&target.roll&&target.defenseStamp!==defense(f))throw fault(409,'La défense de la cible a changé. Le MJ peut revérifier le jet sans relancer.');
      const success=c.plan.kind==='save'&&target.roll?.success;
      const applies=!exempt&&!miss&&!(success&&c.plan.success==='none');
      const damage=target.damage||c.damage;let amount=0;
      if(applies&&['damage','heal','temp'].includes(c.plan.effect)){
        if(!damage)throw fault(400,'Validez d’abord les dés de dégâts ou de soins.');
        const base=success&&c.plan.success==='half'?Math.floor(damage.total/2):damage.total;
        if(c.plan.effect!=='damage'&&(input.treatment||'normal')!=='normal')throw fault(400,'Les résistances ne s’appliquent pas aux soins.');
        if((input.correction??0)!==0&&!reason)throw fault(400,'Expliquez la correction finale.');
        amount=adjustedDamage(base,input.treatment||'normal',input.correction??0);
      }
      const data={castId:c.parentId||c.id,name:c.spell.name,effect:applies?c.plan.effect:'none',amount,condition:applies&&(!success||c.plan.conditionOnSuccess)?c.plan.condition:'',conditionOperation:c.plan.conditionOperation,note:c.plan.note,
        defenseStamp:!exempt&&['damage','condition'].includes(c.plan.effect)?defense(f):null,
        removeEffect:Boolean(c.parentId&&success&&c.plan.releaseOnSuccess&&c.plan.condition),exempt,decision:reason,deathFailures:input.deathFailures??0};
      if(!integer(data.deathFailures,0,2))throw fault(400,'Déclarez zéro, un ou deux échecs de mort.');
      if(c.plan.effect==='temp'&&amount<f.live.tempHp&&input.replaceTemp!==true)throw fault(400,'Confirmez le remplacement des PV temporaires actuels.');
      await beginOperation(actor,groupId,c,p,f,'effect',data);
      await settleConcentration(actor,groupId,c,ctx);
      await api.reconcile(actor,groupId);return result(actor,groupId,c);
    });},
    async retry(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);mj(ctx);
      if(c.operation)await execute(actor,groupId,c,{retry:true});
      else if(c.stage==='casting'){
        const {p,f}=await participant(ctx,c.casterId);
        await beginOperation(actor,groupId,c,p,f,'cast',{spellKey:c.spell.key,canonicalStamp:c.spellStamp,castPenalty:c.casterPenalty,payment:c.payment,rank:c.rank,concentration:c.spell.concentration,concentrationBefore:c.concentrationBefore,castId:c.id,name:c.spell.name});
      }
      if(c.stage==='ending')await finish(actor,groupId,c,ctx);
      await settleConcentration(actor,groupId,c,ctx);
      await api.reconcile(actor,groupId);
      return result(actor,groupId,c);
    });},
    async pulse(actor,groupId,input){return locked(input.castId,async()=>{
      const original=await read(actor,groupId,input.castId),c=original.c,ctx=await load(actor,groupId);active(ctx);mj(ctx);
      const impact=input.impact===true;
      if((impact?!['complete','active'].includes(c.stage):c.stage!=='active')||c.parentId||c.operation)throw fault(400,'Choisissez une incantation ou un effet actif.');
      if(impact&&(ctx.combat.id!==c.combatId||ctx.combat.round!==c.startedRound||ctx.combat.currentId!==c.anchorId))throw fault(409,'Les impacts de cette incantation doivent être résolus pendant le même tour.');
      if(!validCharacterId(input.eventId)||!text(input.reason))throw fault(400,'Précisez le déclenchement vérifié à la table.');
      await liveParent(ctx,{parentId:c.id,impact});
      const source=original.ctx.combat.participants.find(p=>p.id===c.casterId);
      const bound=ctx.combat.id===c.combatId?source:ctx.combat.participants.find(p=>p.kind==='pc'&&source?.kind==='pc'&&p.ownerId===source.ownerId&&p.characterId===source.characterId);
      if(!bound)throw fault(409,'Rattachez le lanceur au combat actuel pour préparer ce déclenchement.');
      const chosen=await targets(ctx,input.targetIds),requestStamp=spellStamp([c.id,impact,[...input.targetIds].sort(),text(input.reason)]);
      const previous=await collection.findOne({id:input.eventId});
      if(previous){if(previous.parentId!==c.id||previous.requestStamp!==requestStamp)throw fault(409,'Ce déclenchement existe déjà avec un autre contenu.');return result(actor,groupId,previous);}
      if(impact){const children=await collection.find({parentId:c.id}).limit(500).toArray();const used=c.targets.length+children.filter(x=>x.impact).reduce((sum,x)=>sum+x.targets.length,0);if(used+chosen.length>(c.plan.impacts||1))throw fault(400,'Tous les impacts déclarés de cette incantation ont déjà été préparés.');}
      if((await collection.find({groupId,combatId:ctx.combat.id}).limit(501).toArray()).length>=500)throw fault(429,'La limite de résolutions de ce combat est atteinte.');
      const date=now().toISOString(),child={id:input.eventId,revision:1,parentId:c.id,impact,requestStamp,groupId,combatId:ctx.combat.id,ownerId:c.ownerId,
        casterId:bound.id,casterName:c.casterName,spell:{...c.spell,concentration:false},rank:c.rank,payment:'already-paid',targets:chosen,
        plan:{...c.plan,rounds:0,impacts:1},reason:text(input.reason),stage:'resolving',createdAt:date,updatedAt:now(),casterPenalty:c.casterPenalty||0,startedRound:ctx.combat.round,operation:null,
        ...(impact&&c.plan.sharedImpacts&&c.damage?{damage:c.damage,sharedDamageLocked:true}:{})};
      await collection.insertOne(child);return result(actor,groupId,child);
    });},
    async concentration(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);
      const {p,f}=await participant(ctx,c.casterId);if(!own(actor,ctx.group,p))throw fault(403,'Choisissez votre propre sauvegarde de concentration.');
      if(c.operation)throw fault(409,'Reprenez d’abord l’enregistrement.');
      const current=f.state.playState?.concentration,check=current?.checks.find(x=>x.id===input.checkId);
      if(current?.id!==c.id||!check)throw fault(409,'Cette sauvegarde est déjà résolue ou la concentration est terminée.');
      const knownBonus=f.model.saves?.find(s=>s.ability==='CON')?.value;
      if(!integer(knownBonus,-100,100)&&(!ctx.group.isMJ||!integer(input.bonus,-100,100)||!text(input.reason)))throw fault(400,'Le MJ doit préciser le bonus de CON manquant et son origine.');
      const bonus=integer(knownBonus,-100,100)?knownBonus:input.bonus;
      const roll=savingThrow({mode:input.mode,advantage:input.advantage,dice:input.dice,bonus,adjustment:input.adjustment,penalty:f.live.effects.d20Penalty,dc:check.dc},randomFace);
      await save(c,{concentrationRoll:roll});
      await beginOperation(actor,groupId,c,p,f,'concentration',{value:roll.success?{...current,checks:current.checks.filter(x=>x.id!==check.id)}:null});
      if(!roll.success)await finish(actor,groupId,c,ctx);
      await api.reconcile(actor,groupId);return result(actor,groupId,c);
    });},
    async sync(actor,groupId){await api.reconcile(actor,groupId);return {state:await getView(actor,groupId)};},
    async timer(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);mj(ctx);
      if(c.stage!=='active'||c.parentId||c.operation||input.confirmed!==true||!integer(input.remainingRounds,0,10000))throw fault(400,'Confirmez une durée restante de zéro à 10 000 rounds.');
      if(input.remainingRounds===0)await finish(actor,groupId,c,ctx);
      else{const current=await load(actor,groupId);await save(c,{remainingRounds:input.remainingRounds,timerCombatId:current.combat.id,timerRound:current.combat.round,timerAnchorId:current.combat.currentId});}
      return result(actor,groupId,c);
    });},
    async reconcile(actor,groupId){
      const current=await load(actor,groupId),rows=await collection.find({groupId,stage:{$nin:[...terminal]}}).limit(201).toArray();
      for(const c of rows){
        if(terminal.has(c.stage)||c.stage==='proposed'||c.stage==='casting'||c.operation||inflight.has(c.parentId||c.id))continue;
        if(c.parentId){const parent=await collection.findOne({id:c.parentId});if(!parent||['ended','cancelled'].includes(parent.stage)||!c.impact&&terminal.has(parent.stage))await save(c,{stage:'cancelled'});continue;}
        const ctx=c.combatId===current.combat.id?current:await load(actor,groupId,c.combatId);
        let f;try{({f}=await participant(ctx,c.casterId));}catch(error){if(![404,409].includes(error.status))throw error;await locked(c.id,()=>finish(actor,groupId,c,ctx));continue;}
        const stopped=c.spell.concentration&&(f.state.playState?.concentration?.id!==c.id||f.live.effects.life==='dead'||f.live.effects.active.some(e=>e.id==='incapacitated'));
        let expired=c.remainingRounds===0&&c.rounds>0;
        if(c.remainingRounds>0&&current.combat.status==='running'){
          if(c.timerCombatId!==current.combat.id||!c.timerAnchorId)await save(c,{timerCombatId:current.combat.id,timerRound:current.combat.round,timerAnchorId:current.combat.currentId});
          else if(current.combat.currentId===c.timerAnchorId&&current.combat.round>c.timerRound){
            const remaining=Math.max(0,c.remainingRounds-(current.combat.round-c.timerRound));
            await save(c,{remainingRounds:remaining,timerRound:current.combat.round});expired=remaining===0;
          }
        }
        if(stopped||expired||c.stage==='ending')await locked(c.id,()=>finish(actor,groupId,c,ctx));
      }
    },
    async end(actor,groupId,input){return locked(input.castId,async()=>{
      const {ctx,c}=await read(actor,groupId,input.castId);
      if(!ctx.group.isMJ&&c.ownerId!==actor.userId&&!ctx.combat.participants.some(p=>p.id===c.casterId&&p.ownerId===actor.userId))throw fault(403,'Seul le lanceur ou le MJ peut terminer ce sort.');
      if(c.operation){
        const opCtx=c.operation.combatId===ctx.combat.id?ctx:await load(actor,groupId,c.operation.combatId);let p;
        try{({p}=await participant(opCtx,c.operation.participantId));}catch(error){
          if(![404,409].includes(error.status)||input.confirmed!==true)throw error;
          await save(c,{abandonedOperation:{receiptId:c.operation.receiptId,reason:'participant-unavailable'},operation:null,error:'Le participant a quitté le groupe ou sa fiche a changé de propriétaire : ses effets restent à vérifier dans son compte.'});
        }
        if(c.operation){
          if(await hasReceipt(opCtx,p,c.operation.receiptId))await execute(actor,groupId,c);
          else if([400,403,404,409].includes(c.operationFailure)&&input.confirmed===true)await save(c,{operation:null,operationFailure:null,error:''});
          else throw fault(409,'Reprenez l’enregistrement avant de terminer le sort : son résultat doit être vérifié.');
        }
      }
      if(['ended','cancelled'].includes(c.stage))return result(actor,groupId,c);
      if(c.stage==='proposed'){await save(c,{stage:'cancelled'});return result(actor,groupId,c);}
      if(input.confirmed!==true)throw fault(400,'Confirmez la fin du sort. Les ressources dépensées ne seront pas rendues.');
      await finish(actor,groupId,c,ctx);return result(actor,groupId,c);
    });}
  };
  async function liveParent(ctx,c){
    const parent=await collection.findOne({id:c.parentId,groupId:ctx.combat.groupId});
    if(!parent||(c.impact?!['active','complete'].includes(parent.stage):parent.stage!=='active'))throw fault(409,'L’effet d’origine n’est plus actif.');
    if(parent.spell.concentration){const source=parent.combatId===ctx.combat.id?ctx:await load(ctx.actor,ctx.combat.groupId,parent.combatId);const {f}=await participant(source,parent.casterId);if(f.state.playState?.concentration?.id!==parent.id)throw fault(409,'La concentration d’origine est terminée.');}
    return parent;
  }
  async function settleConcentration(actor,groupId,c,ctx){
    const parent=c.parentId?await collection.findOne({id:c.parentId,groupId}):c;
    if(!parent?.spell.concentration||['ended','cancelled','proposed'].includes(parent.stage))return;
    const origin=parent.combatId===ctx.combat.id?ctx:await load(actor,groupId,parent.combatId);
    let source;try{source=await participant(origin,parent.casterId);}catch(error){if(![404,409].includes(error.status))throw error;}
    if(!source||source.f.state.playState?.concentration?.id!==parent.id)await finish(actor,groupId,parent,origin);
  }
  async function finish(actor,groupId,c,ctx){
    await save(c,{stage:'ending'});
    const children=c.parentId?[]:await collection.find({parentId:c.id}).limit(500).toArray();
    for(const source of [c,...children]){
      const sourceCtx=source.combatId===ctx.combat.id?ctx:await load(actor,groupId,source.combatId);
      for(const id of [...new Set([...(source.id===c.id?[c.casterId]:[]),...source.targets.filter(t=>t.applied).map(t=>t.id)])]){
        let value;try{value=await participant(sourceCtx,id);}catch(error){if(![404,409].includes(error.status))throw error;continue;}
        const {p,f}=value;
        if(f.state.playState?.concentration?.id!==c.id&&!f.state.playState?.magicEffects?.some(e=>e.id===c.id))continue;
        await beginOperation(actor,groupId,c,p,f,'end',{castId:c.id},sourceCtx);
      }
    }
    await save(c,{stage:'ended'});
  }
  return api;
}
