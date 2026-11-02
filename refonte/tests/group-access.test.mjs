import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createGateway} from '../access/server.mjs';
import {createGroupStore} from '../access/group-store.mjs';
import {groupMemory} from './group-memory.mjs';
const origin='https://myrpgtable.fr';
async function setup(t) {
  const characters={async get(){throw Object.assign(Error('missing'),{status:404});}};
  const groups=createGroupStore({collection:groupMemory(),characters});
  const token=`x.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.x`;
  const fetcher=async url=>Response.json(url.endsWith('/user')?{id:'verified-user'}:{access_token:token});
  const server=createGateway({supabaseUrl:'https://example.invalid',anonKey:'test-only',appRoot:fileURLToPath(new URL('../maquette',import.meta.url)),groups,origin,fetcher});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const request=(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}`+path,{redirect:'manual',...options});
  const post=(path,data,cookie='',site=origin)=>request(path,{method:'POST',headers:{Origin:site,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  const login=await post('/auth/login',{email:'test@example.test',password:'test-only'});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  return {request,post,cookie,groups};
}
test('API groupes : session vérifiée, origine contrôlée et rôle indépendant de l’administration',async t=>{
  const {request,post,cookie}=await setup(t),data={name:'Ma table',alias:'Wiwi',ownerId:'forged',members:[{userId:'forged'}]};
  assert.equal((await request('/atelier/api/groupes')).status,401);
  assert.equal((await post('/atelier/api/groupes',data)).status,401);
  assert.equal((await post('/atelier/api/groupes',data,cookie,'https://evil.invalid')).status,403);
  const created=await post('/atelier/api/groupes',data,cookie);assert.equal(created.status,201);
  const {group}=await created.json();assert(group.isMJ);assert.equal(group.members[0].userId,'verified-user');
  const response=await request('/atelier/api/groupes/'+group.id,{headers:{Cookie:cookie}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await request('/atelier/api/admin/metrics',{headers:{Cookie:cookie}})).status,403);
  for(const file of ['group-view.mjs','groups.css'])assert.equal((await request('/atelier/'+file,{headers:{Cookie:cookie}})).status,200);
  assert.equal((await request('/atelier/group-store.mjs',{headers:{Cookie:cookie}})).status,404);
});
test('API groupes : erreurs de formulaire et méthodes interdites ne provoquent pas une écriture',async t=>{
  const {request,post,cookie}=await setup(t);
  for(const data of [null,[],{name:' ',alias:'Wiwi'}])assert.equal((await post('/atelier/api/groupes',data,cookie)).status,400);
  assert.equal((await request('/atelier/api/groupes',{method:'DELETE',headers:{Origin:origin,Cookie:cookie}})).status,405);
  assert.deepEqual((await (await request('/atelier/api/groupes',{headers:{Cookie:cookie}})).json()).groups,[]);
});
test('API groupes : limite sur les tentatives de code, aucun groupe découvert par recherche',async t=>{
  const {post,cookie}=await setup(t);
  for(let i=0;i<20;i++)assert.equal((await post('/atelier/api/groupes/rejoindre',{code:'0000000000000000',alias:'Joueur'},cookie)).status,404);
  assert.equal((await post('/atelier/api/groupes/rejoindre',{code:'0000000000000000',alias:'Joueur'},cookie)).status,429);
});

test('Suppression HTTP : session, origine, confirmation, rôle et révision vérifiés',async t=>{
  const {request,post,cookie,groups}=await setup(t);
  const {group}=await (await post('/atelier/api/groupes',{name:'À supprimer',alias:'Wiwi'},cookie)).json();
  const path='/atelier/api/groupes/'+group.id;
  const remove=(data,auth=cookie,site=origin)=>request(path,{method:'DELETE',headers:{Origin:site,Cookie:auth,'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await remove({confirmed:true,revision:1},'')).status,401);
  assert.equal((await remove({confirmed:true,revision:1},cookie,'https://evil.invalid')).status,403);
  for(const data of [null,[],{revision:1},{confirmed:true,revision:'1'}])assert.equal((await remove(data)).status,400);
  assert.equal((await remove({confirmed:true,revision:2})).status,409);
  const foreign=await groups.create({userId:'owner'},{name:'Autre table',alias:'Autre'});
  await groups.join({userId:'verified-user'},{code:foreign.invitationCode,alias:'Joueur'});
  const forbidden=await request('/atelier/api/groupes/'+foreign.group.id,{method:'DELETE',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,revision:2})});assert.equal(forbidden.status,403);
  assert.equal((await remove({confirmed:true,revision:1})).status,200);
  assert.equal((await request(path,{headers:{Cookie:cookie}})).status,404);
  assert.equal((await remove({confirmed:true,revision:1})).status,404);
});
