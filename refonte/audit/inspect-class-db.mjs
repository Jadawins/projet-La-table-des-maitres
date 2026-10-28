// Read-only rule inventory. Never query accounts, characters or environment values.
import {createRequire} from 'node:module';
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
await client.connect();
try{const db=client.db('myrpgtable');const all=(await db.listCollections({}, {nameOnly:true}).toArray()).map(c=>c.name);console.log(JSON.stringify({collections:all}));const names=all.filter(n=>/frapp|metamag|invoc|discip|option|techni|capac/i.test(n));for(const name of names){const collection=db.collection(name);console.log(JSON.stringify({name,count:await collection.countDocuments(),rules:await collection.find({}, {projection:{_id:0}}).toArray()}));}}finally{await client.close();}
