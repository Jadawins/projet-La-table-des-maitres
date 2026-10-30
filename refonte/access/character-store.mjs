import {createHash} from 'node:crypto';
export const validCharacterId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const fault=(status,message)=>{const error=new Error(message);error.status=status;return error;};
const expose=doc=>({id:doc.client_id,revision:doc.revision,updatedAt:doc.updated_at.toISOString(),createdAt:doc.created_at.toISOString(),character:doc.character,status:doc.status,issues:doc.issues});
export function createCharacterStore({collection,validate,catalogueFingerprint}){
  return {
    async list(userId){
      const docs=await collection.find({user_id:userId,deleted_at:{$exists:false}},{projection:{client_id:1,revision:1,updated_at:1,status:1,'character.name':1,'character.level':1,'character.classId':1,'character.speciesId':1,'character.backgroundId':1}}).sort({updated_at:-1}).limit(200).toArray();
      return docs.map(d=>({id:d.client_id,revision:d.revision,updatedAt:d.updated_at.toISOString(),status:d.status,...d.character}));
    },
    async get(userId,id){if(!validCharacterId(id))throw fault(404,'Personnage introuvable.');const doc=await collection.findOne({user_id:userId,client_id:id});if(!doc||doc.deleted_at)throw fault(404,'Personnage introuvable.');return expose(doc);},
    async remove(userId,id,revision){
      if(!validCharacterId(id))throw fault(404,'Personnage introuvable.');
      if(!Number.isInteger(revision)||revision<1)throw fault(400,'Référence de suppression invalide.');
      const filter={user_id:userId,client_id:id},previous=await collection.findOne(filter);
      if(!previous)throw fault(404,'Personnage introuvable.');
      if(previous.deleted_at)return {id,deleted:true};
      if(previous.revision!==revision)throw fault(409,'Ce personnage a été modifié ailleurs. Actualisez la liste avant de le supprimer.');
      const date=new Date();
      const update=await collection.updateOne({...filter,revision,deleted_at:{$exists:false}},{$set:{deleted_at:date,updated_at:date,revision:revision+1}});
      if(update.matchedCount!==1)throw fault(409,'Le personnage a changé ailleurs. Actualisez la liste avant de le supprimer.');
      return {id,deleted:true};
    },
    async save(userId,id,input,revision){
      if(!validCharacterId(id)||!Number.isInteger(revision)||revision<0)throw fault(400,'Référence de sauvegarde invalide.');
      const result=validate(input),contentHash=createHash('sha256').update(JSON.stringify(result.character)).digest('hex');
      const filter={user_id:userId,client_id:id};let previous=await collection.findOne(filter);
      if(previous?.deleted_at)throw fault(409,'Ce personnage a été supprimé. Un ancien brouillon ne peut pas le remplacer.');
      if(previous&&(previous.character?.rulesVersion??null)!==(result.character.rulesVersion??null))throw fault(409,'La version des règles a changé. Enregistrez une copie pour préserver la fiche d’origine.');
      if(previous?.content_hash===contentHash&&previous.catalogue_fingerprint===catalogueFingerprint)return expose(previous);
      if(previous&&previous.revision!==revision)throw fault(409,'Ce personnage a été modifié ailleurs. Rouvrez la version enregistrée avant de continuer. Votre brouillon local est conservé.');
      if(!previous&&revision!==0)throw fault(409,'La version enregistrée est introuvable. Votre brouillon local est conservé.');
      const date=new Date(),doc={...filter,...result,revision:revision+1,created_at:previous?.created_at||date,updated_at:date,content_hash:contentHash,catalogue_fingerprint:catalogueFingerprint};
      if(!previous){
        try{await collection.insertOne(doc);}catch(error){if(error.code!==11000)throw error;previous=await collection.findOne(filter);if(previous?.content_hash===contentHash)return expose(previous);throw fault(409,'Une autre sauvegarde est déjà en cours. Réessayez.');}
      }else{
        const update=await collection.updateOne({...filter,revision,deleted_at:{$exists:false}},{$set:doc});if(update.matchedCount!==1)throw fault(409,'Le personnage a changé ailleurs. Votre brouillon local est conservé.');
      }
      return expose(doc);
    },
  };
}
