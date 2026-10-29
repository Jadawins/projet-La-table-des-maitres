import {createHash} from 'node:crypto';

export const RULES_COLLECTION='regles_catalogues';
export const catalogueHash=catalogue=>createHash('sha256').update(JSON.stringify(catalogue)).digest('hex');

function validateRelease(release){
  if(!/^[a-z0-9][a-z0-9-]{2,100}$/.test(release?.id??'')||! /^[a-f0-9]{64}$/.test(release?.sha256??''))throw Error('Référence de règles invalide.');
}
export function validateCatalogue(catalogue,release){
  validateRelease(release);
  if(!catalogue||catalogue.provenance?.revision?.id!==release.id||catalogue.provenance?.revision?.status!=='frozen')throw Error('Version de catalogue absente ou non figée.');
  for(const field of ['classes','subclasses','species','backgrounds','spells','feats','skills','weapons','armors','tools'])if(!Array.isArray(catalogue[field])||!catalogue[field].length)throw Error(`Catalogue incomplet : ${field}.`);
  if(catalogueHash(catalogue)!==release.sha256)throw Error('Empreinte du catalogue différente de la version validée.');
  return catalogue;
}
export async function loadRulesCatalogue(db,release){
  validateRelease(release);
  const row=await db.collection(RULES_COLLECTION).findOne({_id:release.id});
  if(!row||row.schemaVersion!==1||row.sha256!==release.sha256)throw Error('Version des règles introuvable ou incohérente dans MongoDB.');
  const catalogue=validateCatalogue(row.catalogue,release);
  return {catalogue,text:JSON.stringify(catalogue),sha256:release.sha256};
}
export async function importRulesCatalogue(db,catalogue,release){
  validateCatalogue(catalogue,release);
  const collection=db.collection(RULES_COLLECTION);
  const existing=await collection.findOne({_id:release.id});
  if(existing){await loadRulesCatalogue(db,release);return {created:false,sha256:release.sha256};}
  try{
    await collection.insertOne({_id:release.id,schemaVersion:1,sha256:release.sha256,createdAt:new Date(),catalogue:structuredClone(catalogue)});
  }catch(error){if(error.code!==11000)throw error;}
  // Re-read through the normal loader: BSON round-trip and concurrent imports must preserve every field.
  await loadRulesCatalogue(db,release);
  return {created:true,sha256:release.sha256};
}
