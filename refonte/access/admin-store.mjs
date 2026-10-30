import {validCharacterId} from './character-store.mjs';
const fault=(status,message)=>Object.assign(new Error(message),{status});
const active={deleted_at:{$exists:false}};
const requireAdmin=actor=>{if(!actor?.isAdmin||typeof actor.userId!=='string')throw fault(403,'Accès réservé à l’administration.');};
export function createAdminStore({db,rulesVersion,now=()=>new Date()}){
  const users=db.collection('users'),characters=db.collection('personnages_refonte');
  return {
    async recordAccount(user){
      if(typeof user?.id!=='string'||typeof user.email!=='string')return;
      const date=now();
      await users.updateOne({supabase_id:user.id},{$set:{email:user.email.toLowerCase(),username:String(user.user_metadata?.full_name||user.user_metadata?.username||user.email.split('@')[0]).slice(0,100),last_login:date},$setOnInsert:{created_at:date}},{upsert:true});
    },
    async overview(actor){
      requireAdmin(actor);
      const since=new Date(now().getTime()-7*86400000);
      const [accounts,total,ready,drafts,deleted,recent,classes]=await Promise.all([
        users.countDocuments({supabase_id:{$type:'string'}}),characters.countDocuments(active),characters.countDocuments({...active,status:'ready'}),characters.countDocuments({...active,status:'draft'}),characters.countDocuments({deleted_at:{$exists:true}}),characters.countDocuments({...active,created_at:{$gte:since}}),characters.aggregate([{$match:active},{$group:{_id:'$character.classId',count:{$sum:1}}},{$sort:{count:-1}}]).toArray()
      ]);
      return {accounts,characters:total,ready,drafts,deleted,recent,classes:classes.map(x=>({id:x._id,count:x.count})),rulesVersion,generatedAt:now().toISOString()};
    },
    async directory(actor){
      requireAdmin(actor);
      const [accounts,rows]=await Promise.all([
        users.find({supabase_id:{$type:'string'}},{projection:{supabase_id:1,email:1,username:1}}).sort({email:1}).limit(500).toArray(),
        characters.find(active,{projection:{user_id:1,client_id:1,revision:1,status:1,'character.name':1,'character.classId':1,'character.level':1,'character.rulesVersion':1}}).sort({updated_at:-1}).limit(500).toArray()
      ]);
      return {accounts:accounts.map(a=>({id:a.supabase_id,email:a.email||'',name:a.username||a.email||a.supabase_id})),characters:rows.map(r=>({id:r.client_id,ownerId:r.user_id,revision:r.revision,name:r.character?.name||'Sans nom',classId:r.character?.classId,level:r.character?.level,status:r.status})),limit:500};
    },
    async assign(actor,input){
      requireAdmin(actor);
      const {ownerId,id,targetId,revision,mode,requestId}=input||{};
      if(typeof ownerId!=='string'||typeof targetId!=='string'||ownerId.length>128||targetId.length>128||!validCharacterId(id)||!validCharacterId(requestId)||!Number.isInteger(revision)||revision<1||!['copy','move'].includes(mode))throw fault(400,'Attribution invalide.');
      if(ownerId===targetId)throw fault(400,'Choisissez un autre compte destinataire.');
      const target=await users.findOne({supabase_id:targetId});if(!target)throw fault(404,'Compte destinataire introuvable.');
      const source=await characters.findOne({user_id:ownerId,client_id:id,...active});if(!source)throw fault(404,'Personnage introuvable.');
      if(source.revision!==revision)throw fault(409,'La fiche a changé. Actualisez avant de l’attribuer.');
      const date=now(),event={requestId,by:actor.userId,at:date,from:ownerId,to:targetId,sourceId:id,mode};
      if(mode==='copy'){
        const previous=await characters.findOne({user_id:targetId,client_id:requestId});
        if(previous){if(previous.assignments?.some(e=>e.requestId===requestId&&e.by===actor.userId&&e.sourceId===id&&e.from===ownerId))return {id:requestId,mode,ownerId:targetId};throw fault(409,'Cette attribution existe déjà avec un autre contenu.');}
        const {_id,...copy}=structuredClone(source);
        try{await characters.insertOne({...copy,user_id:targetId,client_id:requestId,revision:1,created_at:date,updated_at:date,assignments:[...(source.assignments||[]),event]});}catch(error){if(error.code===11000)throw fault(409,'Attribution déjà en cours. Actualisez pour vérifier.');throw error;}
        return {id:requestId,mode,ownerId:targetId};
      }
      try{
        const result=await characters.updateOne({user_id:ownerId,client_id:id,revision,...active},{$set:{user_id:targetId,revision:revision+1,updated_at:date},$push:{assignments:event}});
        if(result.matchedCount!==1)throw fault(409,'La fiche a changé. Actualisez avant de l’attribuer.');
      }catch(error){if(error.code===11000)throw fault(409,'Le compte destinataire possède déjà une fiche avec cet identifiant.');throw error;}
      return {id,mode,ownerId:targetId};
    }
  };
}
