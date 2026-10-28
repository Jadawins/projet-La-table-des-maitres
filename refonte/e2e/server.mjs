// Local-only harness: production gateway, validator and character store; no VPS or real identity provider.
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createGateway} from '../access/server.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {buildCatalogue} from '../catalogue.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const origin='http://127.0.0.1:4199';
const runtime=path.join(here,'.runtime',randomUUID());
await mkdir(runtime,{recursive:true});
const appRoot=path.join(runtime,'atelier');
await mkdir(appRoot);
// Static files served by the same allowlist and account injection as production.
const {copyFile}=await import('node:fs/promises');
for(const file of ['index.html','app.js','style.css','character-rules.mjs','origin-rules.mjs','character-storage.mjs','cleric-progression.mjs','progression.mjs','class-profiles.mjs','class-magic.mjs','extra-classes.mjs','warlock-options.mjs','feat-effects.mjs','sheet-model.mjs','sheet-view.mjs']){
  await copyFile(path.join(here,'../maquette',file),path.join(appRoot,file));
}
await mkdir(path.join(appRoot,'assets'));
await copyFile(path.join(here,'../../assets/img/fond-bibliotheque-sombre.png'),path.join(appRoot,'assets/fond-bibliotheque-sombre.png'));
const catalogue=buildCatalogue(JSON.parse(await readFile(path.join(here,'../data/rules-mongodb.json'),'utf8')));
await writeFile(path.join(appRoot,'catalogue.json'),JSON.stringify(catalogue));
const records=[];
const matches=(doc,filter)=>Object.entries(filter).every(([key,value])=>doc[key]===value);
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
const tokens=new Map();
async function fakeSupabase(url,options){
  if(url.endsWith('/token?grant_type=password')){
    const data=JSON.parse(options.body);
    if(!['joueur-a@example.test','joueur-b@example.test'].includes(data.email)||data.password!=='test-only')return Response.json({}, {status:401});
    const id=data.email==='joueur-a@example.test'?'e2e-account-a':'e2e-account-b';
    const token=`e2e.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+7200})).toString('base64url')}.${randomUUID()}`;
    tokens.set(token,id);return Response.json({access_token:token});
  }
  const user=tokens.get(options.headers.Authorization?.replace(/^Bearer /,''));
  return Response.json(user?{id:user}:{},{status:user?200:401});
}
const gateway=createGateway({supabaseUrl:'https://e2e.invalid',anonKey:'local-test-only',appRoot,characters,origin,fetcher:fakeSupabase});
gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
const publicFiles={
 '/':'index.html','/connexion.html':'connexion.html','/connexion.js':'connexion.js','/refonte.css':'refonte.css','/refonte.js':'refonte.js','/service-worker.js':'service-worker.js',
};
const server=createServer(async(req,res)=>{
  const route=new URL(req.url,origin).pathname;
  if(route==='/_e2e/health'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"ok":true,"isolated":true}');return;}
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
