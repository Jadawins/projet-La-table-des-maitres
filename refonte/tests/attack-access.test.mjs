import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createGateway} from '../access/server.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {createCombatStore} from '../access/combat-store.mjs';
import {playView,applyPlayAction} from '../maquette/play-state.mjs';
import {groupMemory} from './group-memory.mjs';
const origin='https://myrpgtable.fr';
async function setup(t){
  const characters={async get(){throw Object.assign(Error('missing'),{status:404});}},groups=createGroupStore({collection:groupMemory(),characters});
  const combats=createCombatStore({collection:groupMemory(),groups,characters,sheetModel:()=>({}),playView,applyPlayAction});
  const tokens=new Map(),fetcher=async(url,options)=>{
    if(url.endsWith('/user'))return Response.json({id:tokens.get(options.headers.Authorization?.slice(7))});
    const input=JSON.parse(options.body),token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.${randomUUID()}`;tokens.set(token,input.email);return Response.json({access_token:token});
  };
  const server=createGateway({supabaseUrl:'https://test.invalid',anonKey:'test-only',appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),groups,combats,origin,fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const request=(route,options={})=>fetch(`http://127.0.0.1:${server.address().port}`+route,{redirect:'manual',...options});
  const post=(route,data,cookie='',site=origin)=>request(route,{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const login=async email=>(await post('/auth/login',{email,password:randomUUID()})).headers.get('set-cookie').split(';')[0];
  const mj=await login('mj@example.test'),player=await login('player@example.test');
  const created=await(await post('/atelier/api/groupes',{name:'Attaques',alias:'Wiwi'},mj)).json(),groupId=created.group.id;
  await post('/atelier/api/groupes/rejoindre',{code:created.invitationCode,alias:'Aline'},player);
  const route='/atelier/api/groupes/'+groupId+'/combat',attackRoute=route+'/attaques';
  let state=await(await post(route,{type:'create',name:'Le pont'},mj)).json();
  const act=async data=>state=await(await post(route,{combatId:state.combat.id,revision:state.combat.revision,...data},mj)).json();
  await act({type:'add-npc',name:'Source',maxHp:10,ac:12});await act({type:'add-npc',name:'Cible',maxHp:10,ac:12});
  const [a,b]=state.combat.participants;for(const p of [a,b])await act({type:'initiative',participantId:p.id,value:10});await act({type:'start'});
  return {request,post,mj,player,attackRoute,state,a,b};
}
test('API attaques : session, origine, rôle du groupe et fichiers privés',async t=>{
  const s=await setup(t);assert.equal((await s.request(s.attackRoute+'?attacker='+s.a.id)).status,401);
  assert.equal((await s.request(s.attackRoute+'?attacker='+s.a.id,{headers:{Cookie:s.player}})).status,403);
  assert.equal((await s.post(s.attackRoute,{type:'roll'},s.mj,'https://evil.invalid')).status,403);
  assert.equal((await s.post(s.attackRoute,{type:'constructor'},s.mj)).status,400);
  assert.equal((await s.post(s.attackRoute,null,s.mj)).status,400);
  assert.equal((await s.request('/atelier/attack-view.mjs',{headers:{Cookie:s.mj}})).status,200);
  for(const file of ['attack-rules.mjs','combat-attacks.mjs'])assert.equal((await s.request('/atelier/'+file,{headers:{Cookie:s.mj}})).status,404);
});
test('API attaques : aucune écriture de PV avant confirmation et aucun double dégât au rejeu',async t=>{
  const s=await setup(t),input={type:'roll',combatId:s.state.combat.id,revision:s.state.combat.revision,attackerId:s.a.id,targetId:s.b.id,attackId:'custom',custom:{name:'Attaque de contrôle',bonus:5,formula:'1d6+2'},mode:'physical',dice:[18]};
  const rolledResponse=await s.post(s.attackRoute,input,s.mj);assert.equal(rolledResponse.status,200);assert.equal(rolledResponse.headers.get('cache-control'),'no-store');
  const rolled=await rolledResponse.json(),id=rolled.ticket.id;
  const damage=await s.post(s.attackRoute,{type:'damage',ticketId:id,mode:'physical',dice:[1]},s.mj);assert.equal(damage.status,200);assert.equal((await damage.json()).state.combat.participants.find(p=>p.id===s.b.id).currentHp,10);
  assert.equal((await s.post(s.attackRoute,{type:'confirm',ticketId:id,confirmed:true,isMJ:true},s.player)).status,404);
  const applied=await(await s.post(s.attackRoute,{type:'confirm',ticketId:id,confirmed:true},s.mj)).json();assert.equal(applied.state.combat.participants.find(p=>p.id===s.b.id).currentHp,7);
  const repeated=await(await s.post(s.attackRoute,{type:'confirm',ticketId:id,confirmed:true},s.mj)).json();assert.equal(repeated.state.combat.participants.find(p=>p.id===s.b.id).currentHp,7);
});
