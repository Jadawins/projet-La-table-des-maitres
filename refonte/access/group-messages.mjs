import {createHash} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
export function createGroupMessages({collection,groups,now=()=>new Date()}){
  const allowed=(actor,row)=>row.senderId===actor.userId||row.recipients.some(p=>p.userId===actor.userId);
  function expose(actor,row,group){
    const outgoing=row.senderId===actor.userId,recipient=row.recipients.find(p=>p.userId===actor.userId);
    return {id:row.id,groupId:row.groupId,groupName:group.name,senderAlias:row.senderAlias,body:row.body,createdAt:row.createdAt.toISOString(),outgoing,readAt:recipient?.readAt?.toISOString()||null,
      ...(outgoing?{recipients:row.recipients.map(p=>({alias:p.alias,readAt:p.readAt?.toISOString()||null}))}:{})};
  }
  async function visible(actor,id){
    if(typeof actor?.userId!=='string'||!actor.userId)throw fault(401,'Reconnectez-vous.');
    if(!validCharacterId(id))throw fault(404,'Message introuvable.');
    const row=await collection.findOne({id});if(!row||!allowed(actor,row))throw fault(404,'Message introuvable.');
    return {row,group:await groups.get(actor,row.groupId)};
  }
  return {
    async get(actor,id){const {row,group}=await visible(actor,id);return {message:expose(actor,row,group)};},
    async send(actor,groupId,input){
      const group=await groups.get(actor,groupId);if(!group.isMJ)throw fault(403,'Seul un MJ du groupe peut envoyer ce message.');
      const {id,recipientIds,body}=input||{};
      if(!validCharacterId(id)||typeof body!=='string'||!body.trim()||body.length>6000||!Array.isArray(recipientIds)||!recipientIds.length||recipientIds.length>100||new Set(recipientIds).size!==recipientIds.length||recipientIds.some(id=>typeof id!=='string'||id===actor.userId||!group.members.some(p=>p.userId===id)))throw fault(400,'Choisissez un ou plusieurs autres membres du groupe et un message de 6 000 caractères maximum.');
      const text=body.trim(),stamp=createHash('sha256').update(JSON.stringify([groupId,actor.userId,[...recipientIds].sort(),text])).digest('hex');
      const previous=await collection.findOne({id});
      if(previous){if(previous.stamp!==stamp)throw fault(409,'Cet envoi a déjà été enregistré avec un autre contenu.');return {message:expose(actor,previous,group)};}
      const createdAt=now(),row={id,groupId,senderId:actor.userId,senderAlias:group.members.find(p=>p.isMe).alias,body:text,createdAt,updatedAt:createdAt,revision:1,stamp,
        recipients:recipientIds.map(id=>({userId:id,alias:group.members.find(p=>p.userId===id).alias,readAt:null})),unreadIds:[...recipientIds]};
      try{await collection.insertOne(row);}catch(error){if(error.code!==11000)throw error;const saved=await collection.findOne({id});if(saved?.stamp!==stamp)throw fault(409,'Un autre envoi utilise cette référence.');return {message:expose(actor,saved,group)};}
      return {message:expose(actor,row,group)};
    },
    async history(actor,groupId,offset=0){
      const group=await groups.get(actor,groupId);
      if(!Number.isInteger(offset)||offset<0||offset>1000000)throw fault(400,'Page de messages invalide.');
      const rows=await collection.find({groupId,$or:[{senderId:actor.userId},{'recipients.userId':actor.userId}]}).sort({createdAt:-1,id:-1}).skip(offset).limit(51).toArray();
      return {messages:rows.slice(0,50).map(row=>expose(actor,row,group)),hasMore:rows.length>50,nextOffset:offset+Math.min(rows.length,50)};
    },
    async pending(actor,offset=0){
      if(!Number.isInteger(offset)||offset<0||offset>1000000)throw fault(400,'Page de messages invalide.');
      const memberGroups=await groups.list(actor),ids=memberGroups.map(g=>g.id);
      if(!ids.length)return {messages:[],unread:0,nextOffset:0,hasMore:false};
      const filter={groupId:{$in:ids},unreadIds:actor.userId};
      const [rows,unread]=await Promise.all([collection.find(filter).sort({createdAt:1,id:1}).skip(offset).limit(20).toArray(),collection.countDocuments(filter)]);
      return {messages:rows.map(row=>expose(actor,row,memberGroups.find(g=>g.id===row.groupId))),unread,nextOffset:offset+rows.length,hasMore:offset+rows.length<unread};
    },
    async read(actor,id){
      for(let attempt=0;attempt<5;attempt++){
        const {row,group}=await visible(actor,id);
        const recipient=row.recipients.find(p=>p.userId===actor.userId);if(!recipient)throw fault(403,'Seul un destinataire peut confirmer la lecture.');
        if(recipient.readAt)return {message:expose(actor,row,group)};
        const date=now(),recipients=row.recipients.map(p=>p.userId===actor.userId?{...p,readAt:date}:p);
        const result=await collection.updateOne({id,revision:row.revision},{$set:{recipients,unreadIds:row.unreadIds.filter(userId=>userId!==actor.userId),revision:row.revision+1,updatedAt:date}});
        if(result.matchedCount===1)return {message:expose(actor,{...row,recipients},group)};
      }
      throw fault(409,'La lecture a changé. Réessayez la confirmation.');
    }
  };
}
