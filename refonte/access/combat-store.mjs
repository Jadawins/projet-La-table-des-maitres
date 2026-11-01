import {randomUUID} from 'node:crypto';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const text=(value,max=100)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw fault(400,'Renseignez un nom valide.');return value.trim();};
const healthActions=new Set(['start','damage','heal','set-current','set-temp','set-condition','set-exhaustion','death-roll','stabilize','zero-hp-exception','declare-dead','revive']);
export const combatOrder=participants=>[...participants].sort((a,b)=>(b.initiative??-1000)-(a.initiative??-1000)||a.order-b.order);

export function createCombatStore({collection,groups,characters,bestiary=null,sheetModel,playView,applyPlayAction,now=()=>new Date()}) {
  async function context(actor,groupId) {return groups.get(actor,groupId);}
  function mj(group){if(!group.isMJ)throw fault(403,'Cette action est réservée au MJ du groupe.');}
  async function current(groupId) {
    const active=await collection.findOne({groupId,active:true});
    return active||(await collection.find({groupId}).sort({updatedAt:-1}).limit(1).toArray())[0]||null;
  }
  async function savedPC(group,p){
    if(!group.members.some(m=>m.userId===p.ownerId&&m.character?.id===p.characterId))throw fault(409,'Ce personnage n’est plus rattaché au groupe. Retirez-le du combat ou rattachez sa fiche.');
    const saved=await characters.get(p.ownerId,p.characterId);
    if(saved.status!=='ready')throw fault(409,'La fiche doit être terminée avant de participer au combat.');
    return saved;
  }
  function npcModel(p){return {hp:p.maxHp,ac:p.ac,initiative:p.bestiary?.initiativeBonus??undefined,speed:p.bestiary?.speeds?.marche??9,slots:{},classResources:[],mods:{}};}
  async function view(actor,group,combat){
    if(!combat)return {combat:null,isMJ:group.isMJ,groupName:group.name};
    const participants=[];
    for(const p of combatOrder(combat.participants)){
      if(p.kind==='npc'&&!p.visible&&!group.isMJ)continue;
      let model,state,revision,unavailable=false;
      if(p.kind==='pc'){
        try{const saved=await savedPC(group,p);state=saved.character;revision=saved.revision;model=sheetModel(state);}
        catch(error){if(![404,409].includes(error.status))throw error;unavailable=true;}
      }else{model=npcModel(p);state={classId:'npc',level:1,playState:p.playState};}
      const canEdit=group.isMJ||p.kind==='pc'&&p.ownerId===actor.userId;
      const live=unavailable?null:playView(state,model);
      participants.push({id:p.id,kind:p.kind,name:state?.name||p.name,initiative:p.initiative,
        visible:p.visible,canEdit,unavailable,current:p.id===combat.currentId,
        conditions:live?.effects.active.map(c=>({id:c.id,name:c.name,implicit:c.implicit}))||[],
        ...(canEdit?{characterRevision:revision,started:live?.started,currentHp:live?.currentHp,maxHp:live?.maxHp,tempHp:live?.tempHp,
          ac:model?.ac,initiativeBonus:model?.initiative,explicitConditions:live?.effects.explicit||[],exhaustion:live?.effects.exhaustion||0,
          deathSaves:live?.effects.death,life:live?.effects.life,concentration:p.concentration||''}:{}),
        ...(group.isMJ&&p.kind==='npc'&&p.bestiary?{bestiary:structuredClone(p.bestiary)}:{}),
        ...(group.isMJ&&p.kind==='pc'?{ownerId:p.ownerId,characterId:p.characterId}:{})});
    }
    return {isMJ:group.isMJ,groupName:group.name,combat:{id:combat.id,revision:combat.revision,name:combat.name,status:combat.status,
      round:combat.round,currentId:participants.some(p=>p.id===combat.currentId)?combat.currentId:null,
      participants,updatedAt:combat.updatedAt.toISOString(),...(group.isMJ?{journal:combat.journal}: {})}};
  }
  async function write(combat,fields,message){
    const result=await collection.updateOne({id:combat.id,revision:combat.revision,active:true},{$set:{...fields,
      revision:combat.revision+1,updatedAt:now(),journal:[...combat.journal,{at:now().toISOString(),message}].slice(-50)}});
    if(result.matchedCount!==1)throw fault(409,'Le combat a changé. Actualisez avant de recommencer.');
  }
  function imported(group,participants){
    const added=group.members.filter(m=>m.character&&!participants.some(p=>p.kind==='pc'&&p.ownerId===m.userId&&p.characterId===m.character.id));
    return [...participants,...added.map((m,i)=>({id:randomUUID(),kind:'pc',ownerId:m.userId,characterId:m.character.id,name:m.character.name,
      initiative:null,order:Math.max(-1,...participants.map(p=>p.order))+1+i,visible:true,concentration:''}))];
  }
  function ready(combat){if(!combat.participants.length||combat.participants.some(p=>p.initiative===null))throw fault(400,'Ajoutez des participants et saisissez toutes les initiatives.');}
  return {
    async get(actor,groupId){const group=await context(actor,groupId);return view(actor,group,await current(groupId));},
    async create(actor,groupId,input={}){
      const group=await context(actor,groupId);mj(group);
      if(await collection.findOne({groupId,active:true}))throw fault(409,'Un combat est déjà ouvert pour ce groupe.');
      const date=now(),combat={id:randomUUID(),groupId,active:true,name:text(input.name),status:'preparing',round:1,currentId:null,
        participants:imported(group,[]),revision:1,createdAt:date,updatedAt:date,journal:[]};
      try{await collection.insertOne(combat);}catch(error){if(error.code===11000)throw fault(409,'Un combat est déjà ouvert pour ce groupe.');throw error;}
      return view(actor,group,combat);
    },
    async act(actor,groupId,input={}){
      const group=await context(actor,groupId),combat=await collection.findOne({groupId,active:true});
      if(!combat)throw fault(404,'Aucun combat ouvert.');
      if(input.combatId!==combat.id||input.revision!==combat.revision)throw fault(409,'Le combat a changé. Actualisez avant de recommencer.');
      const p=combat.participants.find(p=>p.id===input.participantId);
      if(input.type==='health'){
        if(!p||!group.isMJ&&(p.kind!=='pc'||p.ownerId!==actor.userId))throw fault(403,'Vous pouvez suivre uniquement votre personnage.');
        if(!input.action||!healthActions.has(input.action.type))throw fault(400,'Action de suivi inconnue.');
        if(p.kind==='pc'){
          const saved=await savedPC(group,p);
          if(saved.revision!==input.characterRevision)throw fault(409,'La fiche a changé. Actualisez avant de recommencer.');
          const state=saved.character,model=sheetModel(state),playState=applyPlayAction(state,model,input.action);
          await characters.save(p.ownerId,p.characterId,{...state,playState},saved.revision,{strictRevision:true});
          // No second document write: character revision is the authoritative health counter.
        }else{
          const state={classId:'npc',level:1,playState:p.playState},playState=applyPlayAction(state,npcModel(p),input.action);
          await write(combat,{participants:combat.participants.map(row=>row.id===p.id?{...row,playState}:row)},'Suivi de '+p.name+' mis à jour.');
        }
        return this.get(actor,groupId);
      }
      if(input.type==='initiative'||input.type==='concentration'){
        if(!p||!group.isMJ&&(p.kind!=='pc'||p.ownerId!==actor.userId))throw fault(403,'Vous pouvez modifier uniquement votre participant.');
        if(p.kind==='pc')await savedPC(group,p);
        let fields;
        if(input.type==='initiative'){
          if(combat.status==='running')throw fault(400,'Mettez le combat en pause pour corriger les initiatives.');
          if(!integer(input.value,-100,100))throw fault(400,'Saisissez le total d’initiative (entre -100 et 100).');
          fields={initiative:input.value};
        }else{
          if(typeof input.value!=='string'||input.value.trim().length>100)throw fault(400,'Indiquez le sort maintenu (100 caractères maximum).');
          fields={concentration:input.value.trim()};
        }
        await write(combat,{participants:combat.participants.map(row=>row.id===p.id?{...row,...fields}:row)},'Participant mis à jour.');
        return this.get(actor,groupId);
      }
      mj(group);
      let fields={},message='Combat mis à jour.';
      if(['add-npc','add-bestiary','sync','remove','tie'].includes(input.type)&&combat.status==='running')throw fault(400,'Mettez le combat en pause avant de modifier les participants.');
      if(input.type==='add-bestiary'){
        if(!bestiary)throw fault(503,'Le bestiaire est momentanément indisponible.');
        if(!integer(input.quantity,1,20))throw fault(400,'Choisissez entre 1 et 20 exemplaires.');
        if(combat.participants.length+input.quantity>100)throw fault(400,'Le combat est limité à 100 participants.');
        const profile=await bestiary.get(input.monsterId,{fresh:true});
        if(!profile.usable)throw fault(400,'Les PV ou la CA de ce profil sont incomplets. Utilisez un adversaire personnalisé.');
        const names=new Set(combat.participants.map(row=>row.name)),base=profile.name.slice(0,90),added=[];
        let suffix=1,order=Math.max(-1,...combat.participants.map(p=>p.order))+1;
        for(let i=0;i<input.quantity;i++){
          while(names.has(base+' '+suffix))suffix++;
          const name=base+' '+suffix++;names.add(name);
          added.push({id:randomUUID(),kind:'npc',name,maxHp:profile.maxHp,ac:profile.ac,initiative:null,order:order++,visible:false,concentration:'',
            bestiary:profile,bestiaryAddedAt:now().toISOString(),playState:{version:1,hpLost:0,tempHp:0,used:{}}});
        }
        fields.participants=[...combat.participants,...added];message=input.quantity+' exemplaire(s) ajouté(s) : '+profile.name;
      }else if(input.type==='add-npc'){
        if(combat.participants.length>=100)throw fault(400,'Le combat est limité à 100 participants.');
        if(!integer(input.maxHp,1,100000)||!integer(input.ac,0,100))throw fault(400,'Renseignez des PV maximum et une CA valides.');
        const npc={id:randomUUID(),kind:'npc',name:text(input.name),maxHp:input.maxHp,ac:input.ac,initiative:null,
          order:Math.max(-1,...combat.participants.map(p=>p.order))+1,visible:false,concentration:'',
          playState:{version:1,hpLost:0,tempHp:0,used:{}}};
        fields.participants=[...combat.participants,npc];message='Adversaire ajouté : '+npc.name;
      }else if(input.type==='sync'){
        fields.participants=imported(group,combat.participants);if(fields.participants.length>100)throw fault(400,'Le combat est limité à 100 participants.');
        message='Personnages du groupe ajoutés.';
      }else if(input.type==='remove'){
        if(!p)throw fault(404,'Participant introuvable.');
        fields.participants=combat.participants.filter(row=>row.id!==p.id);
        if(combat.currentId===p.id){const order=combatOrder(combat.participants),index=order.findIndex(row=>row.id===p.id);fields.currentId=order[(index+1)%order.length]?.id||null;if(fields.currentId===p.id)fields.currentId=null;}
        message='Participant retiré : '+p.name;
      }else if(input.type==='visible'){
        if(!p||p.kind!=='npc'||typeof input.value!=='boolean')throw fault(400,'Choisissez un adversaire et sa visibilité.');
        fields.participants=combat.participants.map(row=>row.id===p.id?{...row,visible:input.value}:row);message='Visibilité de '+p.name+' modifiée.';
      }else if(input.type==='tie'){
        const order=combatOrder(combat.participants),index=order.findIndex(row=>row.id===input.participantId),other=order[index-1];
        if(!p||!other||p.initiative===null||p.initiative!==other.initiative)throw fault(400,'Déplacez un participant à égalité avec celui qui le précède.');
        fields.participants=combat.participants.map(row=>row.id===p.id?{...row,order:other.order}:row.id===other.id?{...row,order:p.order}:row);
      }else if(input.type==='start'||input.type==='resume'){
        if(combat.status!==(input.type==='start'?'preparing':'paused'))throw fault(400,'Ce changement d’état est impossible.');
        ready(combat);for(const pc of combat.participants.filter(p=>p.kind==='pc'))await savedPC(group,pc);
        fields.status='running';fields.currentId=combat.currentId||combatOrder(combat.participants)[0].id;message='Combat démarré ou repris.';
      }else if(input.type==='pause'){
        if(combat.status!=='running')throw fault(400,'Le combat n’est pas en cours.');fields.status='paused';message='Combat en pause.';
      }else if(input.type==='next'||input.type==='previous'){
        if(combat.status!=='running')throw fault(400,'Démarrez ou reprenez le combat avant de changer de tour.');
        const order=combatOrder(combat.participants),index=order.findIndex(p=>p.id===combat.currentId);
        const step=input.type==='next'?1:-1;if(step===-1&&index===0&&combat.round===1)throw fault(400,'Vous êtes au premier tour.');
        const next=(index+step+order.length)%order.length;fields.currentId=order[next].id;
        fields.round=combat.round+(step===1&&next===0?1:step===-1&&index===0?-1:0);message='Changement de tour.';
      }else if(input.type==='finish'){
        if(input.confirmed!==true)throw fault(400,'Confirmez la fin du combat.');fields.status='finished';fields.active=false;fields.currentId=null;message='Combat terminé. Les fiches restent conservées.';
      }else throw fault(400,'Action de combat inconnue.');
      await write(combat,fields,message);return this.get(actor,groupId);
    }
  };
}
