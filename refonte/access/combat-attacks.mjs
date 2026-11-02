import {createHash,randomUUID} from 'node:crypto';
import {participantAttacks,parseDamage,damagePlan,attackRoll,damageRoll,adjustedDamage,integer} from './attack-rules.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const terminal=new Set(['applied','cancelled','uncertain']);
const boundedText=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';

export function createCombatAttacks({load,fighter,saveDamage,getView,now=Date.now,randomFace}){
  const tickets=new Map();
  function cleanup(){for(const [id,t]of tickets)if(t.expiresAt<=now()&&!t.inflight)tickets.delete(id);}
  function attackerStamp(p,f,attack){return hash({id:p.id,owner:p.ownerId,character:p.characterId,attack,penalty:f.live.effects.d20Penalty,conditions:f.live.effects.active.map(c=>c.id).sort(),dead:f.live.effects.life==='dead'});}
  function targetStamp(p,f){return hash({id:p.id,owner:p.ownerId,character:p.characterId,ac:f.model.ac,conditions:f.live.effects.active.map(c=>c.id).sort(),resistances:f.model.resistances||p.bestiary?.resistances||[],immunities:f.model.immunities||p.bestiary?.damageImmunities||[]});}
  function canUse(actor,group,p){return group.isMJ||p.kind==='pc'&&p.ownerId===actor.userId;}
  function attackDefinition(p,f,id,input,group){
    if(id!=='custom'){
      const attack=participantAttacks(p,f.model).find(a=>a.id===id);if(!attack||!attack.usable)throw fault(400,'Cette attaque n’est pas disponible. Choisissez une autre attaque ou consultez le MJ.');return attack;
    }
    if(!group.isMJ)throw fault(403,'Les attaques personnalisées sont réservées au MJ.');
    const name=boundedText(input?.name,100),formula=boundedText(input?.formula,160),damageType=boundedText(input?.damageType,100),bonus=input?.bonus;
    if(!name||!integer(bonus,-100,100))throw fault(400,'Renseignez le nom et le bonus de l’attaque personnalisée.');parseDamage(formula);
    return {id:'custom',name,formula,bonus,damageType,criticalFrom:20,notes:['Attaque personnalisée déclarée par le MJ.'],usable:true};
  }
  function active(ctx){if(ctx.combat.status!=='running')throw fault(400,'Démarrez ou reprenez le combat pour résoudre une attaque.');}
  async function participants(actor,ctx,attackerId,targetId){
    const attacker=ctx.combat.participants.find(p=>p.id===attackerId),target=ctx.combat.participants.find(p=>p.id===targetId);
    if(!attacker||!canUse(actor,ctx.group,attacker)||!ctx.group.isMJ&&attacker.kind==='npc')throw fault(403,'Vous pouvez préparer uniquement les attaques de votre personnage.');
    if(!target||!ctx.group.isMJ&&target.kind==='npc'&&!target.visible)throw fault(404,'Cible introuvable.');
    const [a,b]=await Promise.all([fighter(ctx.group,attacker),fighter(ctx.group,target)]);
    if(a.live.effects.life==='dead'||a.live.effects.active.some(c=>c.id==='incapacitated'))throw fault(400,'Ce participant est neutralisé ou mort. Le MJ doit vérifier son état avant une attaque.');
    if(!integer(b.model.ac,0,100))throw fault(400,'La CA de la cible est indisponible.');
    return {attacker,target,a,b};
  }
  function serialize(t,isMJ){
    const out={id:t.id,ownerId:t.ownerId,attackerId:t.attackerId,targetId:t.targetId,attackerName:t.attackerName,targetName:t.targetName,attack:t.attack,
      roll:t.roll,decision:t.decision,reason:t.reason,damage:t.damage,stage:t.stage,createdAt:t.createdAt,expiresAt:new Date(t.expiresAt).toISOString(),
      ...(t.stage==='applied'?{appliedDamage:t.appliedDamage,appliedAt:t.appliedAt}:{}),
      plan:t.decision==='miss'?null:damagePlan(t.attack.formula,t.decision==='critical'),plans:{hit:damagePlan(t.attack.formula,false),critical:damagePlan(t.attack.formula,true)}};
    if(isMJ)Object.assign(out,{targetAC:t.targetAC,targetHints:t.targetHints});return structuredClone(out);
  }
  async function read(actor,groupId,id){
    cleanup();const ctx=await load(actor,groupId),t=tickets.get(id);
    if(!t||t.groupId!==groupId||t.combatId!==ctx.combat.id||!ctx.group.isMJ&&t.ownerId!==actor.userId)throw fault(404,'Ce jet est expiré ou indisponible. Préparez une nouvelle attaque.');
    return {ctx,t};
  }
  async function validateContext(actor,groupId,t,{recheck=false}={}){
    const ctx=await load(actor,groupId);active(ctx);
    const ownerActor={userId:t.ownerId};
    const ownerGroup={...ctx.group,isMJ:ctx.group.members.some(m=>m.userId===t.ownerId&&m.role==='mj')};
    if(!ctx.group.members.some(m=>m.userId===t.ownerId))throw fault(409,'L’auteur de ce jet ne fait plus partie du groupe.');
    const p=await participants(ownerActor,{...ctx,group:ownerGroup},t.attackerId,t.targetId);
    const definition=t.attack.id==='custom'?t.attack:attackDefinition(p.attacker,p.a,t.attack.id,null,ownerGroup);
    if(attackerStamp(p.attacker,p.a,definition)!==t.attackerStamp)throw fault(409,'Les caractéristiques ou l’état de l’attaquant ont changé. Préparez une nouvelle attaque.');
    if(!recheck&&targetStamp(p.target,p.b)!==t.targetStamp)throw fault(409,'La défense ou l’état de la cible a changé. Le MJ peut revérifier le jet sans relancer les dés.');
    return {ctx,...p};
  }
  function rememberTarget(t,p){
    t.targetStamp=targetStamp(p.target,p.b);t.targetAC=p.b.model.ac;
    t.targetHints={resistances:p.b.model.resistances||p.target.bestiary?.resistances||[],immunities:p.b.model.immunities||p.target.bestiary?.damageImmunities||[],vulnerabilities:p.target.bestiary?.vulnerabilities||[],conditions:p.b.live.effects.active.map(c=>c.name)};
  }
  async function result(actor,groupId,t){return {ticket:serialize(t,(await load(actor,groupId)).group.isMJ),state:await getView(actor,groupId)};}
  return {
    list(actor,group,combat){cleanup();if(!combat)return [];return [...tickets.values()].filter(t=>t.groupId===group.id&&t.combatId===combat.id&&(group.isMJ||t.ownerId===actor.userId)&&t.stage!=='cancelled').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,50).map(t=>serialize(t,group.isMJ));},
    async options(actor,groupId,attackerId){
      const ctx=await load(actor,groupId),p=ctx.combat.participants.find(p=>p.id===attackerId);
      if(!p||!canUse(actor,ctx.group,p))throw fault(403,'Vous pouvez préparer uniquement les attaques de votre personnage.');
      const f=await fighter(ctx.group,p);
      return {attackerId:p.id,attackerName:f.state.name||p.name,attacks:participantAttacks(p,f.model),customAllowed:ctx.group.isMJ,
        combatId:ctx.combat.id,revision:ctx.combat.revision,targets:ctx.combat.participants.filter(p=>ctx.group.isMJ||p.kind==='pc'||p.visible).map(p=>({id:p.id,name:p.name})),status:ctx.combat.status};
    },
    async roll(actor,groupId,input){
      cleanup();const ctx=await load(actor,groupId);active(ctx);
      if(input.combatId!==ctx.combat.id||input.revision!==ctx.combat.revision)throw fault(409,'Le combat a changé. Actualisez avant de lancer les dés.');
      if(tickets.size>=500||[...tickets.values()].filter(t=>t.ownerId===actor.userId&&!terminal.has(t.stage)).length>=20)throw fault(429,'Trop de jets en attente. Annulez les anciens ou attendez leur expiration.');
      const p=await participants(actor,ctx,input.attackerId,input.targetId),attack=attackDefinition(p.attacker,p.a,input.attackId,input.custom,ctx.group);
      const roll=attackRoll({mode:input.mode,advantage:input.advantage,dice:input.dice,bonus:attack.bonus,adjustment:input.adjustment,penalty:p.a.live.effects.d20Penalty,criticalFrom:attack.criticalFrom,ac:p.b.model.ac},randomFace);
      const t={id:randomUUID(),groupId,combatId:ctx.combat.id,ownerId:actor.userId,attackerId:p.attacker.id,targetId:p.target.id,
        attackerName:p.a.state.name||p.attacker.name,targetName:p.b.state.name||p.target.name,attack,roll,decision:roll.outcome,reason:'',damage:null,stage:'rolled',
        attackerStamp:attackerStamp(p.attacker,p.a,attack),createdAt:new Date(now()).toISOString(),expiresAt:now()+5*60000};
      rememberTarget(t,p);tickets.set(t.id,t);return result(actor,groupId,t);
    },
    async damage(actor,groupId,input){
      const {t,ctx}=await read(actor,groupId,input.ticketId);if(terminal.has(t.stage)||t.inflight)throw fault(409,'Ce jet ne peut plus être modifié.');
      await validateContext(actor,groupId,t);
      if(terminal.has(t.stage)||t.inflight)throw fault(409,'Ce jet ne peut plus être modifié.');
      const decision=input.outcome||t.roll.outcome;
      if(!['hit','miss','critical'].includes(decision))throw fault(400,'Choisissez le résultat de l’attaque.');
      const reason=boundedText(input.reason);
      if(decision!==t.roll.outcome&&(!ctx.group.isMJ||!reason))throw fault(ctx.group.isMJ?400:403,'Le MJ doit indiquer pourquoi le résultat de l’attaque est corrigé.');
      const damage=decision==='miss'?null:damageRoll({expression:t.attack.formula,critical:decision==='critical',mode:input.mode,dice:input.dice,adjustment:input.adjustment},randomFace);
      t.decision=decision;t.reason=reason;t.damage=damage;t.stage='ready';return result(actor,groupId,t);
    },
    async recheck(actor,groupId,input){
      const {t,ctx}=await read(actor,groupId,input.ticketId);if(!ctx.group.isMJ)throw fault(403,'La revérification est réservée au MJ.');
      if(terminal.has(t.stage)||t.inflight)throw fault(409,'Ce jet ne peut plus être modifié.');
      const p=await validateContext(actor,groupId,t,{recheck:true});
      if(terminal.has(t.stage)||t.inflight)throw fault(409,'Ce jet ne peut plus être modifié.');
      const oldCritical=t.decision==='critical',originalMode=t.roll.mode;
      t.roll=attackRoll({mode:'physical',advantage:t.roll.advantage,dice:t.roll.dice.map(d=>d.value),bonus:t.attack.bonus,adjustment:t.roll.adjustment,penalty:t.roll.penalty,criticalFrom:t.attack.criticalFrom,ac:p.b.model.ac});t.roll.mode=originalMode;
      t.decision=t.roll.outcome;t.reason='';rememberTarget(t,p);
      if(t.decision==='miss'){t.damage=null;t.stage='rolled';}
      else if(oldCritical!==(t.decision==='critical')){t.damage=null;t.stage='rolled';}
      return result(actor,groupId,t);
    },
    async confirm(actor,groupId,input){
      const {t,ctx}=await read(actor,groupId,input.ticketId);if(!ctx.group.isMJ)throw fault(403,'Le MJ doit confirmer les dégâts.');
      if(t.stage==='applied')return result(actor,groupId,t);
      if(t.inflight)return t.inflight;
      if(t.stage!=='ready'||input.confirmed!==true)throw fault(400,'Vérifiez les jets puis confirmez explicitement le résultat.');
      const work=(async()=>{
        const p=await validateContext(actor,groupId,t);
        const treatment=input.treatment||'normal',correction=input.correction??0,reason=boundedText(input.reason);
        if(correction!==0&&!reason)throw fault(400,'Indiquez la raison de la correction finale.');
        const damage=adjustedDamage(t.decision==='miss'?0:t.damage.total,treatment,correction);
        if(t.decision==='miss'&&damage!==0)throw fault(400,'Une attaque ratée n’applique pas de dégâts.');
        const deathFailures=input.deathFailures??0;if(!integer(deathFailures,0,2))throw fault(400,'Déclarez zéro, un ou deux échecs de mort.');
        if(damage>0){
          if(!p.b.live.started)throw fault(400,'Commencez le suivi des PV de la cible avant de confirmer les dégâts.');
          try{await saveDamage(p.ctx,p.target,p.b,{type:'damage',amount:damage,deathFailures},t);}
          catch(error){if(![400,403,404,409].includes(error.status)){t.stage='uncertain';throw fault(503,'Le résultat de l’écriture doit être vérifié. Actualisez les PV avant toute correction ; ce jet ne sera pas appliqué à nouveau.');}throw error;}
        }
        t.stage='applied';t.appliedDamage=damage;t.appliedAt=new Date(now()).toISOString();t.finalDecision={treatment,correction,reason};
        return result(actor,groupId,t);
      })();t.inflight=work;
      try{return await work;}finally{delete t.inflight;}
    },
    async cancel(actor,groupId,input){const {t}=await read(actor,groupId,input.ticketId);if(t.inflight||t.stage==='applied')throw fault(409,'Une attaque appliquée ou en cours ne peut pas être annulée.');t.stage='cancelled';return {state:await getView(actor,groupId)};}
  };
}
