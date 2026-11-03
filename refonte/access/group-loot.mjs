import {randomUUID,createHash} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';
import {validateLoot,grantLoot} from '../maquette/loot-rules.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const userError=error=>[400,404,409].includes(error.status)?error.message:'L’attribution a été interrompue. Reprenez-la pour vérifier son enregistrement.';
const LEASE_MS=60000;
export function createGroupLoot({collection,groups,characters,catalogue,sheetModel,validate,now=()=>new Date()}){
  async function groupFor(actor,id,mj=false){const group=await groups.get(actor,id);if(mj&&!group.isMJ)throw fault(403,'Seul un MJ du groupe peut attribuer du butin.');return group;}
  async function load(actor,groupId,id,mj=false){
    const group=await groupFor(actor,groupId,mj);
    if(!validCharacterId(id))throw fault(404,'Attribution introuvable.');
    const row=await collection.findOne({id,groupId});
    if(!row||!group.isMJ&&(!row.confirmedAt||!row.recipients.some(r=>r.userId===actor.userId)))throw fault(404,'Attribution introuvable.');
    return {group,row};
  }
  function expose(actor,row,group){
    const recipients=group.isMJ?row.recipients:row.recipients.filter(r=>r.userId===actor.userId);
    return {id:row.id,groupId:row.groupId,label:row.label,senderAlias:row.senderAlias,createdAt:row.createdAt.toISOString(),confirmedAt:row.confirmedAt?.toISOString()||null,payload:row.payload,
      status:group.isMJ?row.status:recipients[0].deliveredAt?'done':'pending',
      ...(group.isMJ?{revision:row.revision,leaseUntil:row.status==='delivering'?row.leaseUntil?.toISOString():null}:{}),
      recipients:recipients.map(r=>({...(group.isMJ?{userId:r.userId}:{}),characterId:r.characterId,alias:r.alias,characterName:r.characterName,deliveredAt:r.deliveredAt?.toISOString()||null,error:r.error||'',needsReview:Boolean(r.needsReview)}))};
  }
  async function receipt(row,r){return characters.lootReceipt(r.characterId,r.receiptId,row.stamp);}
  async function checkRecipient(actor,row,r){
    const group=await groupFor(actor,row.groupId,true),member=group.members.find(m=>m.userId===r.userId);
    if(!member||member.character?.id!==r.characterId)throw fault(409,'Le membre ou son personnage associé a changé. Rattachez la fiche d’origine ou préparez une nouvelle attribution.');
    return group;
  }
  function build(row,r,state){return grantLoot(state,sheetModel(state),row.payload,{receiptId:r.receiptId,itemId:r.itemId,at:(row.confirmedAt||row.createdAt).toISOString(),label:row.label});}
  async function plan(actor,row,r){
    await checkRecipient(actor,row,r);
    const saved=await characters.get(r.userId,r.characterId),valid=validate(saved.character);
    if(saved.status!=='ready'||valid.status!=='ready')throw fault(409,'Le personnage doit avoir une fiche complète dans la version de règles actuelle.');
    validate(build(row,r,saved.character));
    return {...r,expectedRevision:saved.revision,error:'',needsReview:false};
  }
  async function claim(row,revision){
    if(!Number.isInteger(revision)||revision!==row.revision)throw fault(409,'Cette attribution a changé. Actualisez son suivi avant de continuer.');
    if(row.status==='cancelled')throw fault(409,'Cette préparation a été abandonnée.');
    if(row.status==='delivering'&&row.leaseUntil>now())throw fault(409,'L’attribution est en cours. Actualisez le suivi ; une reprise sera possible après une minute si elle a été interrompue.');
    const fields={status:'delivering',leaseToken:randomUUID(),leaseUntil:new Date(now().getTime()+LEASE_MS),revision:row.revision+1,updatedAt:now()};
    const changed=await collection.updateOne({id:row.id,revision:row.revision},{$set:fields});if(changed.matchedCount!==1)throw fault(409,'Une autre action a modifié l’attribution. Actualisez son suivi.');
    return {...row,...fields};
  }
  async function saveClaim(row,fields){
    const next={leaseUntil:new Date(now().getTime()+LEASE_MS),...fields,revision:row.revision+1,updatedAt:now()};
    const changed=await collection.updateOne({id:row.id,leaseToken:row.leaseToken,revision:row.revision},{$set:next});if(changed.matchedCount!==1)throw fault(409,'La reprise a été prise en charge ailleurs. Actualisez son suivi.');
    Object.assign(row,next);
  }
  async function authorize(actor,row,r){
    await checkRecipient(actor,row,r);
    const current=await collection.findOne({id:row.id,leaseToken:row.leaseToken,status:'delivering'});
    if(!current||current.leaseUntil<=now())throw fault(409,'La reprise doit être confirmée de nouveau depuis le suivi.');
  }
  async function finish(row){await saveClaim(row,{recipients:row.recipients,status:row.recipients.every(r=>r.deliveredAt)?'done':row.confirmedAt?'partial':'prepared',leaseUntil:now()});}
  return {
    async prepare(actor,groupId,input){
      const group=await groupFor(actor,groupId,true),{id,recipientIds}=input||{};
      if(!validCharacterId(id)||typeof input.label!=='string'||!input.label.trim()||input.label.length>100||!Array.isArray(recipientIds)||!recipientIds.length||recipientIds.length>100||new Set(recipientIds).size!==recipientIds.length||recipientIds.some(id=>typeof id!=='string'||!group.members.some(m=>m.userId===id&&m.character)))throw fault(400,'Donnez un nom au butin et choisissez des membres ayant un personnage associé.');
      const payload=validateLoot(input.payload,catalogue),label=input.label.trim(),stamp=createHash('sha256').update(JSON.stringify([actor.userId,groupId,label,[...recipientIds].sort(),payload])).digest('hex');
      const previous=await collection.findOne({id});if(previous){if(previous.stamp!==stamp)throw fault(409,'Cette référence est déjà utilisée pour une autre attribution.');return {allocation:expose(actor,previous,group)};}
      const date=now(),row={id,groupId,label,payload,stamp,senderId:actor.userId,senderAlias:group.members.find(m=>m.isMe).alias,createdAt:date,updatedAt:date,status:'prepared',revision:1,recipients:[]};
      for(const userId of recipientIds){const member=group.members.find(m=>m.userId===userId),r={userId,alias:member.alias,characterId:member.character.id,characterName:member.character.name,receiptId:randomUUID(),itemId:randomUUID(),deliveredAt:null,error:'',needsReview:false};try{row.recipients.push(await plan(actor,row,r));}catch(error){throw fault(error.status||503,member.alias+' : '+userError(error));}}
      try{await collection.insertOne(row);}catch(error){if(error.code!==11000)throw error;const existing=await collection.findOne({id});if(existing?.stamp!==stamp)throw fault(409,'Cette référence appartient à une autre attribution.');return {allocation:expose(actor,existing,group)};}
      return {allocation:expose(actor,row,group)};
    },
    async get(actor,groupId,id){const {row,group}=await load(actor,groupId,id);return {allocation:expose(actor,row,group)};},
    async history(actor,groupId,offset=0){
      const group=await groupFor(actor,groupId);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw fault(400,'Page de butin invalide.');
      const filter=group.isMJ?{groupId}:{groupId,confirmedAt:{$exists:true},'recipients.userId':actor.userId};
      const rows=await collection.find(filter).sort({createdAt:-1,id:-1}).skip(offset).limit(51).toArray();return {allocations:rows.slice(0,50).map(r=>expose(actor,r,group)),hasMore:rows.length>50,nextOffset:offset+Math.min(rows.length,50)};
    },
    async cancel(actor,groupId,id,input){
      const {row,group}=await load(actor,groupId,id,true);if(row.status==='cancelled')return {allocation:expose(actor,row,group)};
      if(row.confirmedAt||row.status!=='prepared'||input?.revision!==row.revision)throw fault(409,'Seule une préparation non confirmée peut être abandonnée. Actualisez le suivi.');
      const changed=await collection.updateOne({id,revision:row.revision,status:'prepared'},{$set:{status:'cancelled',revision:row.revision+1,updatedAt:now()}});if(!changed.matchedCount)throw fault(409,'La préparation a changé.');return this.get(actor,groupId,id);
    },
    async refresh(actor,groupId,id,input){
      const {row:original,group}=await load(actor,groupId,id,true);if(original.status==='done')return {allocation:expose(actor,original,group)};
      const row=await claim(original,input?.revision);
      try{for(let index=0;index<row.recipients.length;index++){
        const r=row.recipients[index];if(r.deliveredAt)continue;
        try{const committed=await receipt(row,r);row.recipients[index]=committed?{...r,deliveredAt:committed.at,error:'',needsReview:false}:await plan(actor,row,r);}catch(error){row.recipients[index]={...r,error:userError(error),needsReview:true};}
      }await finish(row);}catch(error){throw error;}
      return {allocation:expose(actor,row,await groupFor(actor,groupId,true))};
    },
    async confirm(actor,groupId,id,input){
      const {row:original,group}=await load(actor,groupId,id,true);if(original.status==='done')return {allocation:expose(actor,original,group)};
      if(input?.confirmed!==true)throw fault(400,'Confirmez le récapitulatif avant d’attribuer le butin.');
      const row=await claim(original,input?.revision);await saveClaim(row,{confirmedAt:row.confirmedAt||now(),confirmedBy:actor.userId});
      for(let index=0;index<row.recipients.length;index++){
        const r=row.recipients[index];if(r.deliveredAt)continue;
        try{
          await groupFor(actor,groupId,true);
          const committed=await receipt(row,r);
          if(committed)row.recipients[index]={...r,deliveredAt:committed.at,error:'',needsReview:false};
          else if(!r.needsReview){
            const delivered=await characters.applyLoot(r.userId,r.characterId,{receiptId:r.receiptId,stamp:row.stamp,revision:r.expectedRevision,build:state=>build(row,r,state),authorize:()=>authorize(actor,row,r)});
            row.recipients[index]={...r,deliveredAt:delivered.at,error:'',needsReview:false};
          }
        }catch(error){row.recipients[index]={...r,error:userError(error),needsReview:[400,404,409].includes(error.status)};}
        await saveClaim(row,{recipients:row.recipients});
      }
      await finish(row);return {allocation:expose(actor,row,await groupFor(actor,groupId,true))};
    }
  };
}
