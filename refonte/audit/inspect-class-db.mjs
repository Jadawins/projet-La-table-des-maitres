// Read-only rule inventory. Never query accounts, characters or environment values.
import {createRequire} from 'node:module';
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});
await client.connect();
try{const db=client.db('myrpgtable');const names=(await db.listCollections({}, {nameOnly:true}).toArray()).map(c=>c.name).filter(n=>/manoe|manœ|progress|table|techni|capac|sort|classe/i.test(n));for(const name of names){const collection=db.collection(name);console.log(JSON.stringify({name,count:await collection.countDocuments(),keys:Object.keys(await collection.findOne({}, {projection:{_id:0}})||{})}));}}finally{await client.close();}
