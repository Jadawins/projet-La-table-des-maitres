import {createAdminStore} from '../access/admin-store.mjs';
import {memoryCollection} from '../tests/admin-memory.mjs';
// Local-only harness: production gateway, validator and character store; no VPS or real identity provider.
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createGateway} from '../access/server.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {buildCatalogue} from '../catalogue.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const origin='http://127.0.0.1:4199';
const runtime=path.join(here,'.runtime',randomUUID());
await mkdir(runtime,{recursive:true});
const appRoot=path.join(runtime,'atelier');
await mkdir(path.join(appRoot,'assets'),{recursive:true});
// Static files served by the same allowlist and account injection as production.
const {copyFile}=await import('node:fs/promises');
for(const file of ['index.html','app.js','style.css','character-rules.mjs','origin-rules.mjs','character-storage.mjs','character-version.mjs','cleric-progression.mjs','progression.mjs','class-profiles.mjs','beast-companion.mjs','species-rules.mjs','wild-shape.mjs','class-magic.mjs','extra-classes.mjs','warlock-options.mjs','feat-effects.mjs','sheet-model.mjs','sheet-view.mjs','portal-view.mjs','admin-view.mjs','character-pdf.mjs','portal.css','assets/fiche-personnage-2024.pdf','assets/pdf-lib-1.17.1.mjs','assets/pdf-lib-LICENSE.md']){
  await copyFile(path.join(here,'../maquette',file),path.join(appRoot,file));
}

await copyFile(path.join(here,'../../assets/img/fond-bibliotheque-sombre.png'),path.join(appRoot,'assets/fond-bibliotheque-sombre.png'));
const catalogue=buildCatalogue(JSON.parse(await readFile(path.join(here,'../tests/fixtures/rules-2024.json'),'utf8')));

const records=[];
const matches=(doc,filter)=>Object.entries(filter).every(([key,value])=>value&&typeof value==='object'&&'$exists' in value?Object.hasOwn(doc,key)===value.$exists:doc[key]===value);
let pendingWrite=Promise.resolve();
const persist=()=>{const snapshot=JSON.stringify(records,null,2);pendingWrite=pendingWrite.then(()=>writeFile(path.join(runtime,'characters.json'),snapshot));return pendingWrite;};
const collection={
  async findOne(filter){return structuredClone(records.find(d=>matches(d,filter))||null);},
  async insertOne(doc){
    if(records.some(d=>d.user_id===doc.user_id&&d.client_id===doc.client_id))throw Object.assign(new Error('Duplicate'),{code:11000});
    records.push(structuredClone(doc));await persist();
  },
  async updateOne(filter,update){
    const index=records.findIndex(d=>matches(d,filter));if(index<0)return {matchedCount:0};
    records[index]={...records[index],...structuredClone(update.$set)};await persist();return {matchedCount:1};
  },
  find(filter){
    let result=records.filter(d=>matches(d,filter));
    return {sort(){result.sort((a,b)=>b.updated_at-a.updated_at);return this;},limit(n){result=result.slice(0,n);return this;},async toArray(){return structuredClone(result);}};
  },
};
const characters=createCharacterStore({collection,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:'e2e-isolated'});
const tokens=new Map(),signupAccounts=new Map(),signupCodes=new Map();
const identity=new Map([['e2e-account-a',{id:'e2e-account-a',email:'joueur-a@example.test',email_confirmed_at:'2026-10-30'}],['e2e-account-b',{id:'e2e-account-b',email:'joueur-b@example.test',email_confirmed_at:'2026-10-30'}]]);
function issueToken(id){const token='e2e.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+7200})).toString('base64url')+'.'+randomUUID();tokens.set(token,id);return Response.json({access_token:token});}
async function fakeSupabase(url,options){
  if(url.includes('/signup?')){
    const input=JSON.parse(options.body);if(signupAccounts.has(input.email))return Response.json({id:'duplicate-obfuscated'});
    const id='signup-'+randomUUID(),code=randomUUID();signupAccounts.set(input.email,{id,password:input.password,code,confirmed:false});signupCodes.set(code,{id,email:input.email,challenge:input.code_challenge});identity.set(id,{id,email:input.email,user_metadata:input.data,email_confirmed_at:'2026-10-30'});return Response.json({id});
  }
  if(url.endsWith('/token?grant_type=pkce')){
    const input=JSON.parse(options.body),flow=signupCodes.get(input.auth_code);
    if(!flow||createHash('sha256').update(input.code_verifier).digest('base64url')!==flow.challenge)return Response.json({},{status:401});
    signupCodes.delete(input.auth_code);signupAccounts.get(flow.email).confirmed=true;return issueToken(flow.id);
  }
  if(url.endsWith('/token?grant_type=password')){
    const data=JSON.parse(options.body),registered=signupAccounts.get(data.email);
    if(registered)return registered.confirmed&&registered.password===data.password?issueToken(registered.id):Response.json({},{status:401});
    if(!['joueur-a@example.test','joueur-b@example.test'].includes(data.email)||data.password!=='test-only')return Response.json({}, {status:401});
    return issueToken(data.email==='joueur-a@example.test'?'e2e-account-a':'e2e-account-b');
  }
  const user=identity.get(tokens.get(options.headers.Authorization?.replace(/^Bearer /,'')));
  return Response.json(user||{},{status:user?200:401});
}
const adminUsers=memoryCollection([{supabase_id:'e2e-account-a',email:'joueur-a@example.test'},{supabase_id:'e2e-account-b',email:'joueur-b@example.test'}]);
const admin=createAdminStore({db:{collection:name=>name==='users'?adminUsers:memoryCollection(records)},rulesVersion:'e2e'});
const gateway=createGateway({supabaseUrl:'https://e2e.invalid',anonKey:'local-test-only',appRoot,characters,origin,catalogueText:JSON.stringify(catalogue),fetcher:fakeSupabase,admin,adminEmails:['joueur-a@example.test']});
gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
const publicFiles={
 '/':'index.html','/connexion.html':'connexion.html','/connexion.js':'connexion.js','/inscription.html':'inscription.html','/inscription.js':'inscription.js','/sources.html':'sources.html','/refonte.css':'refonte.css','/refonte.js':'refonte.js','/service-worker.js':'service-worker.js',
};
const server=createServer(async(req,res)=>{
  const route=new URL(req.url,origin).pathname;
  if(route==='/_e2e/email'){const account=signupAccounts.get(new URL(req.url,origin).searchParams.get('email'));res.writeHead(account?200:404,{'Content-Type':'application/json'}).end(JSON.stringify(account?{link:origin+'/home.html?code='+account.code}:{}));return;}
  if(route==='/home.html'){const flow=signupCodes.get(new URL(req.url,origin).searchParams.get('code'));if(flow)signupAccounts.get(flow.email).confirmed=true;res.writeHead(302,{Location:'/connexion.html'+new URL(req.url,origin).search}).end();return;}
  if(route==='/_e2e/health'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true,"isolated":true}');return;}
  if(route==='/assets/fond-bibliotheque-sombre.png'){res.writeHead(200,{'Content-Type':'image/png'}).end(await readFile(path.join(here,'../../assets/img/fond-bibliotheque-sombre.png')));return;}
  if(route==='/favicon.ico'){res.writeHead(302,{Location:'/favicon.png'}).end();return;}
  if(route==='/favicon.png'){res.writeHead(200,{'Content-Type':'image/png'}).end(await readFile(path.join(here,'../../assets/icone/favicon-192.png')));return;}
  if(publicFiles[route]){
    const file=publicFiles[route],type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'}).end(await readFile(path.join(here,'../accueil',file)));return;
  }
  const proxy=request({hostname:'127.0.0.1',port:gateway.address().port,path:req.url,method:req.method,headers:req.headers},upstream=>{res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);});
  proxy.on('error',()=>res.writeHead(503).end());req.pipe(proxy);
});
server.listen(4199,'127.0.0.1');await once(server,'listening');
console.log(`Isolated E2E workshop: ${origin}`);
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close();gateway.close();});
