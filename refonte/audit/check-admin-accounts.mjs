// Read-only production check. Never emit user identities or credentials.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const release=process.argv[2],output=process.argv[3];
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/accounts-(before|after)\.json$/);
const {createAuthAccounts}=await import(pathToFileURL(release+'/auth-accounts.mjs'));
const {createAdminStore}=await import(pathToFileURL(release+'/admin-store.mjs'));
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
try{
  const rules=JSON.parse(await readFile(release+'/rules-release.json','utf8'));
  const accounts=createAuthAccounts({url:process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY});
  const store=createAdminStore({db:client.db('myrpgtable'),rulesVersion:rules.id,accounts});
  const [metrics,directory]=await Promise.all([store.overview({userId:'deployment-read-only',isAdmin:true}),store.directory({userId:'deployment-read-only',isAdmin:true})]);
  assert.equal(metrics.accountsWarning,undefined,'Supabase account counting is unavailable');assert.equal(directory.accountsWarning,undefined,'Supabase account directory is unavailable');
  assert(Number.isInteger(metrics.accounts)&&metrics.accounts>=0);
  const report={status:'passed',completedAt:new Date().toISOString(),registeredAccounts:metrics.accounts,directoryAccounts:directory.accounts.length,readOnly:true};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(report));
}finally{await client.close();}
