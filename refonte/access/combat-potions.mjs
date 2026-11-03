import {randomUUID} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';
import {damageRoll} from './attack-rules.mjs';
import {spellStamp} from './spell-rules.mjs';
import {consumeItem,reconcileEquipment} from '../maquette/equipment-state.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const terminal=new Set(['complete','cancelled']),LEASE=60000;
export function createCombatPotions({collection,load,fighter,hasReceipt,writeSnapshot,getView,applyPlayAction,now=()=>new Date(),randomFace}){
  const mj=ctx=>{if(!ctx.group.isMJ)throw fault(403,'La validation des potions est réservée au MJ.');};
  const running=ctx=>{if(ctx.combat.status!=='running')throw fault(409,'Démarrez ou reprenez le combat avant de consommer une potion.');};
  const binding=p=>({id:p.id,kind:p.kind,name:p.name,ownerId:p.ownerId??null,characterId:p.characterId??null});
  function participant(ctx,p){const current=ctx.combat.participants.find(x=>x.id===p.id);if(!current||current.kind!==p.kind||(current.ownerId??null)!==(p.ownerId??null)||(current.characterId??null)!==(p.characterId??null))throw fault(409,'Ce participant ou son personnage a changé.');return current;}
  function visible(ctx,p){return ctx.group.isMJ||p.kind==='pc'||p.visible;}
  function canSee(actor,ctx,c){return ctx.group.isMJ||c.source.ownerId===actor.userId||c.target.ownerId===actor.userId;}
  async function read(actor,groupId,id){
    if(!validCharacterId(id))throw fault(404,'Utilisation de potion introuvable.');
    const c=await collection.findOne({id,groupId});if(!c)throw fault(404,'Utilisation de potion introuvable.');
    const ctx=await load(actor,groupId,c.combatId);
    const target=ctx.combat.participants.find(p=>p.id===c.targetId);
    if(!canSee(actor,ctx,c)||target&&!visible(ctx,target))throw fault(404,'Utilisation de potion introuvable.');
    return {ctx,c};
  }
  function dto(actor,ctx,c){return {id:c.id,revision:c.revision,combatId:c.combatId,sourceId:c.sourceId,sourceName:c.source.name,targetId:c.targetId,targetName:c.target.name,itemName:c.itemName,formula:c.formula,dicePlan:Array(c.potion.count).fill(c.potion.sides),stage:c.stage,roll:c.roll||null,error:c.error||'',needsReview:c.needsReview||'',sourceConsumed:Boolean(c.sourceConsumed),healed:Boolean(c.healed),attempted:Boolean(c.attempted),canRoll:ctx.group.isMJ||c.source.ownerId===actor.userId,canCancel:!c.attempted&&(ctx.group.isMJ||c.source.ownerId===actor.userId),earlierCombat:ctx.displayCombatId!==undefined&&ctx.displayCombatId!==c.combatId};}
  async function result(actor,groupId,c){const ctx=await load(actor,groupId,c.combatId);return {use:dto(actor,ctx,c),state:await getView(actor,groupId)};}
  async function save(c,fields){
    const next={leaseUntil:new Date(now().getTime()+LEASE),...fields,revision:c.revision+1,updatedAt:now()};
    const update=await collection.updateOne({id:c.id,revision:c.revision,...(c.leaseToken?{leaseToken:c.leaseToken}:{})},{$set:next});if(!update.matchedCount)throw fault(409,'Cette utilisation a changé. Actualisez son suivi.');Object.assign(c,next);
  }
  async function claim(c,revision,stage){
    if(revision!==c.revision||!Number.isInteger(revision))throw fault(409,'La proposition a changé. Actualisez avant de continuer.');
    if(['rolling','committing'].includes(c.stage)&&c.leaseUntil>now())throw fault(409,'L’enregistrement est en cours. Actualisez ; après une interruption, une reprise est possible après une minute.');
    const fields={stage,leaseToken:randomUUID(),leaseUntil:new Date(now().getTime()+LEASE),revision:c.revision+1,updatedAt:now()};
    const update=await collection.updateOne({id:c.id,revision:c.revision},{$set:fields});if(!update.matchedCount)throw fault(409,'Une autre résolution est en cours.');Object.assign(c,fields);
  }
  async function source(ctx,c){
    const p=participant(ctx,c.source),f=await fighter(ctx.group,p);
    if(!f.live.started||f.live.effects.life==='dead'||f.live.effects.active.some(e=>e.id==='incapacitated'))throw fault(400,'Le personnage qui administre la potion doit avoir commencé son suivi et pouvoir agir.');
    const item=f.model.possessions.find(i=>i.ref===c.itemRef);
    if(!item?.potion||item.potion.id!==c.potion.id||item.nom!==c.itemName)throw fault(409,'Cette potion n’est plus disponible ou a été modifiée.');
    return {p,f,item};
  }
  async function target(ctx,c){
    const p=participant(ctx,c.target),f=await fighter(ctx.group,p);
    if(!f.live.started||f.live.effects.life==='dead')throw fault(400,'La cible doit avoir un suivi de PV commencé et ne pas être déclarée morte.');
    return {p,f};
  }
  function operation(ctx,c,p,f,kind){
    let character;
    if(kind==='source'){
      const roll={mode:c.roll.mode,dice:c.roll.dice.map(d=>d.value),healing:c.roll.total};
      character=consumeItem(f.state,f.model.possessions,c.itemRef,roll,{id:c.id,at:c.confirmedAt.toISOString(),heal:()=>structuredClone(f.state.playState)});
      // A consumable cannot remain selected as equipment after its last unit.
      const remaining=f.model.possessions.filter(i=>i.ref!==c.itemRef||i.quantity>1);reconcileEquipment(character,remaining);
    }else character={...f.state,playState:applyPlayAction(f.state,f.model,{type:'heal',amount:c.roll.total})};
    return {receiptId:kind==='source'?c.sourceReceiptId:c.targetReceiptId,combatId:c.combatId,participantId:p.id,ownerId:p.ownerId,characterId:p.characterId,revision:f.revision,beforeStamp:spellStamp(f.state.playState),character,kind:kind==='source'?'potion-source':'potion-heal'};
  }
  async function plan(actor,groupId,c){
    const ctx=await load(actor,groupId,c.combatId);mj(ctx);
    const paid=await hasReceipt(ctx,c.source,c.sourceReceiptId),healed=await hasReceipt(ctx,c.target,c.targetReceiptId),ops={...c.operations};
    if(!paid){running(ctx);const {p,f}=await source(ctx,c);ops.source=operation(ctx,c,p,f,'source');}
    if(!healed){const {p,f}=await target(ctx,c);ops.target=operation(ctx,c,p,f,'target');}
    return {operations:ops,sourceConsumed:paid,healed,needsReview:'',error:''};
  }
  async function execute(actor,groupId,c){
    for(const side of ['source','target']){
      const ctx=await load(actor,groupId,c.combatId);mj(ctx);
      const p=c[side],receiptId=side==='source'?c.sourceReceiptId:c.targetReceiptId;
      try{
        if(!await hasReceipt(ctx,p,receiptId)){
          if(c.needsReview===side)throw fault(409,'Revérifiez les fiches avant de reprendre, sans relancer les dés.');
          const current=await collection.findOne({id:c.id,leaseToken:c.leaseToken,stage:'committing'});if(!current||current.leaseUntil<=now())throw fault(409,'Actualisez et reprenez cette utilisation.');
          if(side==='source'){running(ctx);await source(ctx,c);}else await target(ctx,c);
          participant(ctx,p);const op=c.operations?.[side];if(!op)throw fault(409,'Revérifiez les fiches avant de reprendre.');
          await writeSnapshot(ctx,p,op);
        }
      }catch(error){
        await save(c,{stage:'pending',needsReview:[400,403,404,409].includes(error.status)?side:'',error:side==='source'?'Consommation à vérifier. Utilisez le suivi avant toute nouvelle proposition.':'Potion consommée ; soins à reprendre. Les dés ne seront pas relancés.',leaseUntil:now()});throw error;
      }
      await save(c,{[side==='source'?'sourceConsumed':'healed']:true,needsReview:c.needsReview===side?'':c.needsReview});
    }
    await save(c,{stage:'complete',operations:null,error:'',needsReview:'',leaseUntil:now()});
  }
  return {
    async list(actor,group,combat){
      const pending=await collection.find({groupId:group.id,stage:{$nin:[...terminal]}}).sort({createdAt:-1}).limit(201).toArray(),recent=await collection.find({groupId:group.id,combatId:combat.id}).sort({createdAt:-1}).limit(30).toArray(),rows=[...pending,...recent.filter(r=>terminal.has(r.stage)).slice(0,15)],result=[];
      for(const c of rows){if(!group.isMJ&&c.source.ownerId!==actor.userId&&c.target.ownerId!==actor.userId)continue;const ctx=c.combatId===combat.id?{group,combat}:await load(actor,group.id,c.combatId);const p=ctx.combat.participants.find(p=>p.id===c.targetId);if(p&&!visible(ctx,p))continue;result.push(dto(actor,{...ctx,displayCombatId:combat.id},c));}return result;
    },
    async options(actor,groupId){
      const ctx=await load(actor,groupId);running(ctx);const sources=[];
      for(const p of ctx.combat.participants.filter(p=>p.kind==='pc'&&(ctx.group.isMJ||p.ownerId===actor.userId))){try{const f=await fighter(ctx.group,p),potions=(f.model.possessions||[]).filter(i=>i.potion).map(i=>({ref:i.ref,name:i.nom,quantity:i.quantity,formula:i.potion.count+'d'+i.potion.sides+'+'+i.potion.bonus}));if(potions.length)sources.push({id:p.id,name:p.name,potions});}catch(error){if(![400,404,409].includes(error.status))throw error;}}
      return {combatId:ctx.combat.id,sources,targets:ctx.combat.participants.filter(p=>visible(ctx,p)).map(p=>({id:p.id,name:p.name}))};
    },
    async prepare(actor,groupId,input){
      const ctx=await load(actor,groupId);running(ctx);if(!validCharacterId(input?.id)||input.combatId!==ctx.combat.id||typeof input.itemRef!=='string'||input.itemRef.length>200)throw fault(400,'Proposition de potion invalide.');
      const p=ctx.combat.participants.find(p=>p.id===input.sourceId),t=ctx.combat.participants.find(p=>p.id===input.targetId);
      if(!p||p.kind!=='pc'||!ctx.group.isMJ&&p.ownerId!==actor.userId)throw fault(403,'Choisissez votre propre personnage pour administrer la potion.');
      if(!t||!visible(ctx,t))throw fault(404,'Cible introuvable.');if(t.id===p.id||t.kind==='pc'&&t.ownerId===p.ownerId&&t.characterId===p.characterId)throw fault(400,'Choisissez une autre créature. Pour boire vous-même, utilisez votre fiche.');
      const stamp=spellStamp([actor.userId,ctx.combat.id,p.id,t.id,input.itemRef]),previous=await collection.findOne({id:input.id});if(previous){if(previous.stamp!==stamp)throw fault(409,'Cette référence appartient à une autre proposition.');return result(actor,groupId,previous);}
      const f=await fighter(ctx.group,p),item=f.model.possessions.find(i=>i.ref===input.itemRef);if(!item?.potion)throw fault(400,'Choisissez une potion de guérison présente dans votre inventaire.');
      const c={id:input.id,stamp,groupId,combatId:ctx.combat.id,sourceId:p.id,targetId:t.id,source:binding(p),target:binding(t),itemRef:input.itemRef,itemName:item.nom,potion:structuredClone(item.potion),formula:item.potion.count+'d'+item.potion.sides+'+'+item.potion.bonus,sourceReceiptId:randomUUID(),targetReceiptId:randomUUID(),stage:'proposed',revision:1,createdAt:now(),updatedAt:now(),roll:null,attempted:false,sourceConsumed:false,healed:false};
      await source(ctx,c);await target(ctx,c);if(await collection.countDocuments({groupId,stage:{$nin:[...terminal]}})>=200)throw fault(409,'Terminez les utilisations en attente avant d’en préparer de nouvelles.');
      try{await collection.insertOne(c);}catch(error){if(error.code!==11000)throw error;const saved=await collection.findOne({id:c.id});if(saved?.stamp!==stamp)throw fault(409,'Cette référence appartient à une autre proposition.');return result(actor,groupId,saved);}return result(actor,groupId,c);
    },
    async roll(actor,groupId,input){
      const {ctx,c}=await read(actor,groupId,input?.useId);if(!ctx.group.isMJ&&c.source.ownerId!==actor.userId)throw fault(403,'Seul le propriétaire de la potion ou le MJ peut lancer ses dés.');
      if(!validCharacterId(input.requestId)||!['physical','app'].includes(input.mode)||input.mode==='app'&&input.dice!==undefined)throw fault(400,'Choisissez des dés physiques ou ceux de l’application.');
      const stamp=spellStamp([input.requestId,input.mode,input.dice??null]);if(c.roll){if(c.rollStamp!==stamp)throw fault(409,'Le jet est déjà enregistré. Il ne sera pas relancé.');return result(actor,groupId,c);}
      if(!['proposed','rolling'].includes(c.stage))throw fault(409,'Cette potion ne peut plus être lancée.');running(ctx);await source(ctx,c);
      if(input.mode==='physical')damageRoll({expression:c.formula,mode:input.mode,dice:input.dice},randomFace);
      await claim(c,input.revision,'rolling');const roll=damageRoll({expression:c.formula,mode:input.mode,dice:input.dice},randomFace);await save(c,{stage:'rolled',roll,rollStamp:stamp,leaseUntil:now()});return result(actor,groupId,c);
    },
    async confirm(actor,groupId,input){
      const {ctx,c}=await read(actor,groupId,input?.useId);mj(ctx);if(c.stage==='complete')return result(actor,groupId,c);if(c.stage!=='rolled'||input.confirmed!==true)throw fault(400,'Validez le jet, la portée et l’action avant de confirmer.');running(ctx);
      const sf=(await source(ctx,c)).f,tf=(await target(ctx,c)).f;if(input.combatRevision!==ctx.combat.revision||input.sourceRevision!==sf.revision||input.targetRevision!==(tf.revision??ctx.combat.revision))throw fault(409,'Le combat ou une fiche a changé. Actualisez le récapitulatif avant de confirmer.');
      c.confirmedAt=now();const operations=await plan(actor,groupId,c);await claim(c,input.revision,'committing');await save(c,{...operations,confirmedAt:c.confirmedAt,attempted:true});await execute(actor,groupId,c);return result(actor,groupId,c);
    },
    async retry(actor,groupId,input){
      const {ctx,c}=await read(actor,groupId,input?.useId);mj(ctx);if(c.stage==='complete')return result(actor,groupId,c);if(!c.attempted||input.confirmed!==true)throw fault(400,'Confirmez la reprise de cette utilisation.');await claim(c,input.revision,'committing');await execute(actor,groupId,c);return result(actor,groupId,c);
    },
    async recheck(actor,groupId,input){
      const {ctx,c}=await read(actor,groupId,input?.useId);mj(ctx);if(c.stage==='complete')return result(actor,groupId,c);if(!c.attempted||input.reviewed!==true)throw fault(400,'Vérifiez les fiches avant de reprendre cette utilisation.');const next=await plan(actor,groupId,c);await claim(c,input.revision,'committing');await save(c,{...next,stage:'pending',leaseUntil:now()});return result(actor,groupId,c);
    },
    async cancel(actor,groupId,input){
      const {ctx,c}=await read(actor,groupId,input?.useId);if(!ctx.group.isMJ&&c.source.ownerId!==actor.userId)throw fault(403,'Seul le propriétaire ou le MJ peut annuler cette proposition.');if(c.attempted||c.sourceConsumed)throw fault(409,'Une utilisation commencée doit être reprise dans le suivi ; aucune potion n’est remboursée automatiquement.');if(c.stage==='cancelled')return result(actor,groupId,c);await claim(c,input.revision,'committing');await save(c,{stage:'cancelled',leaseUntil:now()});return result(actor,groupId,c);
    },
    async beforeRemove(combatId,participantId){const rows=await collection.find({combatId,attempted:true,stage:{$nin:[...terminal]}}).limit(201).toArray();if(rows.some(c=>c.sourceId===participantId||c.targetId===participantId))throw fault(409,'Terminez la résolution de potion en attente avant de retirer ce participant.');}
  };
}
