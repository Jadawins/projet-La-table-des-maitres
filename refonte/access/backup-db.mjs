import {createRequire} from 'node:module';
import {createWriteStream} from 'node:fs';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
const {MongoClient,BSON}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const destination=process.argv[2];
if(!destination?.startsWith('/root/backups/myrpgtable-persistence-'))throw new Error('Invalid backup destination');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
await client.connect();
const gzip=createGzip(),done=pipeline(gzip,createWriteStream(destination,{flags:'wx',mode:0o600}));
const write=async value=>{if(!gzip.write(JSON.stringify(BSON.EJSON.serialize(value))+'\n'))await Promise.race([once(gzip,'drain'),done]);};
let count=0;
try{
  const db=client.db('myrpgtable');
  await write({kind:'backup',database:'myrpgtable',date:new Date(),format:1});
  for(const info of await db.listCollections().toArray()){
    if(info.name.startsWith('system.'))continue;
    const collection=db.collection(info.name);
    await write({kind:'collection',name:info.name,options:info.options,indexes:await collection.indexes()});
    for await(const document of collection.find({})){await write({kind:'document',collection:info.name,document});count++;}
  }
  gzip.end();await done;console.log(`Database backup completed: ${count} documents.`);
}finally{await client.close();}
