import {createHash} from 'node:crypto';
export const validCharacterId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const fault=(status,message)=>{const error=new Error(message);error.status=status;return error;};
const expose=doc=>({id:doc.client_id,revision:doc.revision,updatedAt:doc.updated_at.toISOString(),createdAt:doc.created_at.toISOString(),character:doc.character,status:doc.status,issues:doc.issues});
export function createCharacterStore({collection,validate,catalogueFingerprint}){
  async function lootReceipt(id,receiptId,stamp){
    if(!validCharacterId(id)||!validCharacterId(receiptId)||typeof stamp!=='string'||!/^[0-9a-f]{64}$/.test(stamp))throw fault(400,'Référence de butin invalide.');
    // A transfer or soft deletion must not hide an already committed receipt.
    // This internal lookup exposes only delivery metadata, never another sheet.
    const row=await collection.findOne({client_id:id,[`loot_receipts.${receiptId}.stamp`]:stamp});
    return row?.loot_receipts?.[receiptId]||null;
  }
  return {
    lootReceipt,
    async applyLoot(userId,id,{receiptId,stamp,revision,build,authorize}){
      const receipt=await lootReceipt(id,receiptId,stamp);if(receipt)return receipt;
      const filter={user_id:userId,client_id:id,deleted_at:{$exists:false}},previous=await collection.findOne(filter);
      if(!previous)throw fault(404,'Le personnage n’est plus disponible dans ce compte.');
      if(previous.loot_receipts?.[receiptId])throw fault(409,'Cette référence de butin est déjà utilisée pour une autre attribution.');
      if(previous.revision!==revision)throw fault(409,'La fiche a changé. Revoyez l’attribution restante avant de confirmer.');
      if(Object.keys(previous.loot_receipts||{}).length>=5000)throw fault(409,'Le suivi des attributions de cette fiche est plein.');
      const result=validate(build(structuredClone(previous.character)));
      if(previous.status!=='ready'||result.status!=='ready'||(previous.character.rulesVersion??null)!==(result.character.rulesVersion??null))throw fault(409,'Le personnage doit avoir une fiche complète dans la version de règles actuelle.');
      await authorize();
      const date=new Date(),receiptValue={stamp,at:date,revision:revision+1},contentHash=createHash('sha256').update(JSON.stringify(result.character)).digest('hex');
      const doc={...result,revision:revision+1,updated_at:date,content_hash:contentHash,catalogue_fingerprint:catalogueFingerprint,loot_receipts:{...(previous.loot_receipts||{}),[receiptId]:receiptValue}};
      const written=await collection.updateOne({...filter,revision},{$set:doc});
      if(written.matchedCount!==1){const committed=await lootReceipt(id,receiptId,stamp);if(committed)return committed;throw fault(409,'La fiche a changé pendant l’attribution. Revoyez les fiches restantes.');}
      return receiptValue;
    },
    async list(userId){
      const docs=await collection.find({user_id:userId,deleted_at:{$exists:false}},{projection:{client_id:1,revision:1,updated_at:1,status:1,'character.name':1,'character.level':1,'character.classId':1,'character.multiclass.classes.classId':1,'character.multiclass.classes.level':1,'character.speciesId':1,'character.backgroundId':1}}).sort({updated_at:-1}).limit(200).toArray();
      return docs.map(d=>({id:d.client_id,revision:d.revision,updatedAt:d.updated_at.toISOString(),status:d.status,...d.character}));
    },
    async get(userId,id){if(!validCharacterId(id))throw fault(404,'Personnage introuvable.');const doc=await collection.findOne({user_id:userId,client_id:id});if(!doc||doc.deleted_at)throw fault(404,'Personnage introuvable.');return expose(doc);},
    // Internal combat commands only. The receipt and the new character are committed
    // in the same document, so a lost acknowledgement can be recovered after restart.
    async combatReceiptAny(id,receiptId){
      if(!validCharacterId(id)||!validCharacterId(receiptId))throw fault(400,'Référence de résolution invalide.');
      const doc=await collection.findOne({client_id:id,[`combat_receipts.${receiptId}`]:{$exists:true}});
      return doc?.combat_receipts?.[receiptId]||null;
    },
    async combatReceipt(userId,id,receiptId){
      if(!validCharacterId(id)||!validCharacterId(receiptId))throw fault(400,'Référence de résolution invalide.');
      const doc=await collection.findOne({user_id:userId,client_id:id,deleted_at:{$exists:false}});
      if(!doc)throw fault(404,'Personnage introuvable.');
      return doc.combat_receipts?.[receiptId]||null;
    },
    async applyCombatPatch(userId,id,{revision,receiptId,character}){
      if(!validCharacterId(id)||!validCharacterId(receiptId)||!Number.isInteger(revision)||revision<1)throw fault(400,'Référence de résolution invalide.');
      const filter={user_id:userId,client_id:id,deleted_at:{$exists:false}},previous=await collection.findOne(filter);
      if(!previous)throw fault(404,'Personnage introuvable.');
      const result=validate(character),contentHash=createHash('sha256').update(JSON.stringify(result.character)).digest('hex');
      const receipt=previous.combat_receipts?.[receiptId];
      if(receipt){if(receipt.hash!==contentHash)throw fault(409,'Cette résolution a déjà été enregistrée avec un autre contenu.');return expose(previous);}
      if(previous.revision!==revision)throw fault(409,'La fiche a changé. Actualisez la résolution avant de confirmer.');
      if(previous.status!=='ready'||(previous.character.rulesVersion??null)!==(result.character.rulesVersion??null))throw fault(409,'La fiche ou sa version de règles a changé.');
      const date=new Date(),doc={...result,revision:revision+1,updated_at:date,content_hash:contentHash,catalogue_fingerprint:catalogueFingerprint,
        combat_receipts:{...(previous.combat_receipts||{}),[receiptId]:{hash:contentHash,at:date}}};
      const updated=await collection.updateOne({...filter,revision},{$set:doc});
      if(updated.matchedCount!==1){
        const current=await collection.findOne(filter);
        if(current?.combat_receipts?.[receiptId]?.hash===contentHash)return expose(current);
        throw fault(409,'La fiche a changé pendant la résolution. Actualisez avant de confirmer.');
      }
      return expose({...previous,...doc});
    },
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
    async save(userId,id,input,revision,{strictRevision=false,adminEdit=null}={}){
      if(!validCharacterId(id)||!Number.isInteger(revision)||revision<0)throw fault(400,'Référence de sauvegarde invalide.');
      const filter={user_id:userId,client_id:id};let previous=await collection.findOne(filter);
      if(strictRevision&&previous?.revision!==revision)throw fault(409,'Ce personnage a été modifié ailleurs. Actualisez avant de recommencer.');
      for(const key of ['inventoryItems','equipmentState','inventorySpent','inventoryLastUse','wallet'])if(input?.[key]===undefined&&previous?.character?.[key]!==undefined)input={...input,[key]:previous.character[key]};
      let result=validate(input);
      if((previous?.character?.playState?.deathSaves?.dead||previous?.character?.playState?.exhaustion===6)&&input.playState&&input.playState.deathSaves===undefined&&input.playState.hpLost!==previous.character.playState.hpLost)throw fault(409,'Le suivi vital a changé. Actualisez la fiche pour gérer un retour à la vie ; votre brouillon est conservé.');
      if(previous?.character?.multiclass&&input.multiclass===undefined)throw fault(409,'Cette fiche est multiclassée. Actualisez le site avant de modifier ses niveaux.');
      if(previous?.character?.playState?.hitDiceUsedByType&&input.playState?.hitDiceUsedByType===undefined&&input.playState?.hitDiceUsed!==undefined&&input.playState.hitDiceUsed!==previous.character.playState.hitDiceUsed)throw fault(409,'Les types de dés de vie ont changé. Actualisez le site avant de modifier leurs dépenses.');
      // An older open client may omit the optional session field. Preserve it.
      if(input.playState===undefined&&previous?.character?.playState!==undefined)result=validate({...input,playState:previous.character.playState});
      else if(input.playState&&previous?.character?.playState){
        const preserved={...input.playState};let missing=false;
        for(const key of ['slotUsed','hitDiceUsed','hitDiceUsedByType','lastRest','conditions','exhaustion','deathSaves','zeroHpConscious','magicEffects','concentration'])if(input.playState[key]===undefined&&previous.character.playState[key]!==undefined){preserved[key]=previous.character.playState[key];missing=true;}
        if(missing)result=validate({...input,playState:preserved});
      }
      const contentHash=createHash('sha256').update(JSON.stringify(result.character)).digest('hex');
      if(previous?.deleted_at)throw fault(409,'Ce personnage a été supprimé. Un ancien brouillon ne peut pas le remplacer.');
      if(previous&&(previous.character?.rulesVersion??null)!==(result.character.rulesVersion??null))throw fault(409,'La version des règles a changé. Enregistrez une copie pour préserver la fiche d’origine.');
      if(previous?.content_hash===contentHash&&previous.catalogue_fingerprint===catalogueFingerprint)return expose(previous);
      if(previous&&previous.revision!==revision)throw fault(409,'Ce personnage a été modifié ailleurs. Rouvrez la version enregistrée avant de continuer. Votre brouillon local est conservé.');
      if(!previous&&revision!==0)throw fault(409,'La version enregistrée est introuvable. Votre brouillon local est conservé.');
      const date=new Date(),doc={...filter,...result,revision:revision+1,created_at:previous?.created_at||date,updated_at:date,content_hash:contentHash,catalogue_fingerprint:catalogueFingerprint};
      if(adminEdit)doc.admin_edits=[...(previous?.admin_edits||[]),{by:adminEdit.by,at:date,fromRevision:revision,toRevision:revision+1}].slice(-100);
      if(!previous){
        try{await collection.insertOne(doc);}catch(error){if(error.code!==11000)throw error;previous=await collection.findOne(filter);if(previous?.content_hash===contentHash)return expose(previous);throw fault(409,'Une autre sauvegarde est déjà en cours. Réessayez.');}
      }else{
        const update=await collection.updateOne({...filter,revision,deleted_at:{$exists:false}},{$set:doc});if(update.matchedCount!==1)throw fault(409,'Le personnage a changé ailleurs. Votre brouillon local est conservé.');
      }
      return expose(doc);
    },
  };
}
