// Disposable control groups only. No real account or character is created or modified.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [release,output]=process.argv.slice(2);
assert.match(release??'',/^\/var\/www\/myrpgtable\/refonte-access\/\d{8}T\d{6}Z$/);
assert.match(output??'',/^\/root\/backups\/myrpgtable-persistence-[\w-]+\/groups-(before|after)\.json$/);
const {createGroupStore}=await import(pathToFileURL(release+'/group-store.mjs'));
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const collection=client.db('myrpgtable').collection('refonte_groupes_controles');
const ids=[],mj={userId:'deployment-group-'+randomUUID()},player={userId:'deployment-group-'+randomUUID()},outsider={userId:'deployment-group-'+randomUUID()};
const characterId=randomUUID();
const characters={async get(userId,id){if(userId!==player.userId||id!==characterId)throw Object.assign(Error('missing'),{status:404});return {id,status:'ready',character:{name:'Fiche de contrôle',classId:'barde',level:3}};}};
const store=createGroupStore({collection,characters});
try{
  await collection.createIndex({id:1},{unique:true});
  await collection.createIndex({inviteHash:1},{unique:true,partialFilterExpression:{inviteHash:{$type:'string'}}});
  const created=await store.create(mj,{name:'Contrôle groupe',alias:'MJ de contrôle'}),{group,invitationCode}=created;ids.push(group.id);
  assert(created.group.isMJ);assert.equal((await store.list(mj)).length,1);
  await assert.rejects(store.get(player,group.id),e=>e.status===404);
  await store.join(player,{code:invitationCode,alias:'Joueur de contrôle'});
  await store.join(player,{code:invitationCode,alias:'Joueur de contrôle'});
  assert.equal((await store.get(mj,group.id)).members.length,2);
  await store.attach(player,group.id,{characterId});
  assert.equal((await store.get(mj,group.id)).members[1].character.id,characterId);
  await assert.rejects(store.attach(mj,group.id,{characterId}),e=>e.status===404);
  await assert.rejects(store.archive(player,group.id),e=>e.status===403);
  const fresh=await store.rotate(mj,group.id);
  await assert.rejects(store.join(outsider,{code:invitationCode,alias:'Autre joueur'}),e=>e.status===404);
  await store.join(outsider,{code:fresh.invitationCode,alias:'Autre joueur'});
  await store.removeMember(mj,group.id,{userId:outsider.userId});
  await assert.rejects(store.join(outsider,{code:fresh.invitationCode,alias:'Autre joueur'}),e=>e.status===404);
  await store.leave(player,group.id);assert.deepEqual(await store.list(player),[]);
  await store.archive(mj,group.id);assert.deepEqual(await store.list(mj),[]);
  assert((await collection.findOne({id:group.id})).archivedAt);
  const report={status:'passed',completedAt:new Date().toISOString(),checks:8,collection:'refonte_groupes_controles',
    coverage:['create-and-reopen','membership-privacy','idempotent-join','owned-character-reference','role-permissions','invitation-rotation','removal-and-departure','soft-archive'],realCharactersWritten:false};
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify(report));
}finally{await collection.deleteMany({id:{$in:ids}});await client.close();}
