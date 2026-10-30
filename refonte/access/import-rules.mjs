import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {importRulesCatalogue,loadRulesCatalogue} from './rules-store.mjs';
const [catalogueFile,manifestFile]=process.argv.slice(2);
if(!catalogueFile||!manifestFile)throw Error('Usage : import-rules.mjs catalogue.json rules-release.json');
const catalogue=JSON.parse(await readFile(catalogueFile,'utf8')),release=JSON.parse(await readFile(manifestFile,'utf8'));
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
if(BSON.calculateObjectSize({catalogue})>15*1024*1024)throw Error('Catalogue trop volumineux pour cette version du stockage.');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
try{
  const db=client.db('myrpgtable'),result=await importRulesCatalogue(db,catalogue,release);
  const loaded=await loadRulesCatalogue(db,release);
  if(JSON.stringify(loaded.catalogue)!==JSON.stringify(catalogue))throw Error('Le catalogue relu diffère de celui importé.');
  console.log(JSON.stringify({status:'verified',version:release.id,catalogueId:release.catalogueId||release.id,...result}));
}finally{await client.close();}
