import {createBestiaryStore} from '../access/bestiary-store.mjs';
import {bestiaryMemory} from './bestiary-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createGateway} from '../access/server.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {createCombatStore} from '../access/combat-store.mjs';
import {playView,applyPlayAction} from '../maquette/play-state.mjs';
import {groupMemory} from './group-memory.mjs';
const origin='https://myrpgtable.fr';
async function setup(t){
  const characters={async get(){throw Object.assign(Error('missing'),{status:404});}};
  const groups=createGroupStore({collection:groupMemory(),characters});
  const bestiary=createBestiaryStore({collection:bestiaryMemory()});
  const combats=createCombatStore({collection:groupMemory(),groups,characters,bestiary,sheetModel:()=>({}),playView,applyPlayAction});
  const tokens=new Map();
  const fetcher=async(url,options)=>{
    if(url.endsWith('/user'))return Response.json({id:tokens.get(options.headers.Authorization?.slice(7))});
    const {email}=JSON.parse(options.body),token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${randomUUID()}`;
    tokens.set(token,email);return Response.json({access_token:token});
  };
  const server=createGateway({supabaseUrl:'https://test.invalid',anonKey:'test-only',appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),groups,combats,bestiary,origin,fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const request=(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}`+path,{redirect:'manual',...options});
  const post=(path,data,cookie='',site=origin)=>request(path,{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const login=async email=>(await post('/auth/login',{email,password:randomUUID()})).headers.get('set-cookie').split(';')[0];
  return {request,post,mj:await login('mj@example.test'),player:await login('player@example.test')};
}
test('API combat : authentification, origine, groupe privé et droits réels du MJ',async t=>{
  const s=await setup(t),created=await(await s.post('/atelier/api/groupes',{name:'Table',alias:'Wiwi'},s.mj)).json(),path='/atelier/api/groupes/'+created.group.id+'/combat';
  assert.equal((await s.request(path)).status,401);assert.equal((await s.request(path,{headers:{Cookie:s.player}})).status,404);
  await s.post('/atelier/api/groupes/rejoindre',{code:created.invitationCode,alias:'Aline'},s.player);
  assert.equal((await s.post(path,{type:'create',name:'Non',isMJ:true},s.player)).status,403);
  assert.equal((await s.post(path,{type:'create',name:'Oui'},s.mj,'https://evil.invalid')).status,403);
  const response=await s.post(path,{type:'create',name:'Le pont'},s.mj);assert.equal(response.status,201);let value=await response.json();
  const input={type:'add-npc',name:'Secret absolu',maxHp:10,ac:12,combatId:value.combat.id,revision:value.combat.revision};
  value=await(await s.post(path,input,s.mj)).json();const snapshot=await s.request(path,{headers:{Cookie:s.player}});
  assert.equal(snapshot.headers.get('cache-control'),'no-store');assert(!JSON.stringify(await snapshot.json()).includes('Secret absolu'));
  assert.equal((await s.post(path,{type:'finish',confirmed:true,isMJ:true,combatId:value.combat.id,revision:value.combat.revision},s.player)).status,403);
});
test('API combat : formes invalides, méthodes et fichiers serveur non publiés',async t=>{
  const s=await setup(t),group=await(await s.post('/atelier/api/groupes',{name:'Table',alias:'Wiwi'},s.mj)).json(),path='/atelier/api/groupes/'+group.group.id+'/combat';
  for(const data of [null,[]])assert.equal((await s.post(path,data,s.mj)).status,400);
  assert.equal((await s.request(path,{method:'DELETE',headers:{Origin:origin,Cookie:s.mj}})).status,405);
  for(const file of ['combat-view.mjs','combat.css','bestiary-view.mjs'])assert.equal((await s.request('/atelier/'+file,{headers:{Cookie:s.mj}})).status,200);
  assert.equal((await s.request('/atelier/combat-store.mjs',{headers:{Cookie:s.mj}})).status,404);
});
test('API bestiaire : lecture réservée au MJ de ce groupe, filtres contrôlés et source privée',async t=>{
  const s=await setup(t),created=await(await s.post('/atelier/api/groupes',{name:'Table',alias:'Wiwi'},s.mj)).json(),path='/atelier/api/groupes/'+created.group.id+'/bestiaire';
  assert.equal((await s.request(path)).status,401);assert.equal((await s.request(path,{headers:{Cookie:s.player}})).status,404);
  await s.post('/atelier/api/groupes/rejoindre',{code:created.invitationCode,alias:'Aline'},s.player);
  assert.equal((await s.request(path,{headers:{Cookie:s.player}})).status,403);
  assert.equal((await s.request(path+'/goblin',{headers:{Cookie:s.player}})).status,403);
  const response=await s.request(path+'?q=goblin',{headers:{Cookie:s.mj}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).monsters[0].name,'Gobelin');
  assert.equal((await s.request(path+'?fp_min=foo',{headers:{Cookie:s.mj}})).status,400);
  assert.equal((await s.request(path+'?offset=1.5',{headers:{Cookie:s.mj}})).status,400);
  assert.equal((await s.request(path+'/missing',{headers:{Cookie:s.mj}})).status,404);
  assert.equal((await s.post(path,{},s.mj)).status,405);
  assert.equal((await s.request('/atelier/bestiary-store.mjs',{headers:{Cookie:s.mj}})).status,404);
});
