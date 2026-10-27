import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const plan=JSON.parse(await readFile(new URL('./spell-link-corrections.json',import.meta.url),'utf8'));
const backup=process.argv[2];if(!/^\/root\/backups\/myrpgtable-persistence-\d{8}T\d{6}Z$/.test(backup))throw Error('Backup directory required');
await readFile(`${backup}/database.ejsonl.gz`);
const client=new MongoClient(process.env.MONGO_URI);await client.connect();
const db=client.db('myrpgtable'),undo=[],before=[];
try{
 if(await db.collection('refonte_regles_corrections').findOne({_id:plan.id}))throw Error('Correction already applied');
 for(const change of plan.changes){
  const docs=await db.collection('sous_classes').find({_source:change.sourceId}).toArray();
  if(docs.length!==1||!isDeepStrictEqual(docs[0].niveaux,change.before))throw Error(`Precondition failed: ${change.sourceId}`);
  before.push(docs[0]);
 }
 for(const [name,rows]of [['sorts',plan.addSpells],['competences',plan.restoreSkills]])for(const row of rows)if(await db.collection(name).countDocuments({$or:[...(row.id?[{id:row.id}]:[]),{nom:row.nom}]}))throw Error(`Already exists: ${row.nom}`);
 const characters=await db.collection('personnages_refonte').find({}).toArray();
 await writeFile(`${backup}/targeted-spell-plan.json`,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 for(let i=0;i<plan.changes.length;i++){
  const change=plan.changes[i],doc=before[i];
  const r=await db.collection('sous_classes').updateOne({_id:doc._id,niveaux:doc.niveaux},{$set:{niveaux:change.after}});
  if(r.modifiedCount!==1)throw Error('Concurrent source change');
  undo.push(()=>db.collection('sous_classes').updateOne({_id:doc._id},{$set:{niveaux:doc.niveaux}}));
 }
 for(const [name,rows]of [['sorts',plan.addSpells],['competences',plan.restoreSkills]])for(const row of rows){const r=await db.collection(name).insertOne({...row});undo.push(()=>db.collection(name).deleteOne({_id:r.insertedId}));}
 if(!isDeepStrictEqual(characters,await db.collection('personnages_refonte').find({}).toArray()))throw Error('Character records changed during migration');
 await db.collection('refonte_regles_corrections').insertOne({_id:plan.id,date:new Date(),scope:plan.scope,notes:plan.changes.map(x=>({sourceId:x.sourceId,notes:x.notes,references:x.references})),backup});
 console.log('Four domain spell lists corrected, one spell added, original skill restored. Character records unchanged.');
}catch(e){for(const revert of undo.reverse())await revert();console.error(e.message);process.exitCode=1;}finally{await client.close();}
