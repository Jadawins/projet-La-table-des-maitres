import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdminStore} from '../access/admin-store.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {validateSavedCharacter} from '../maquette/character-storage.mjs';
import {renderAdminCharacters} from '../maquette/admin-view.mjs';
import {memoryCollection} from './admin-memory.mjs';
import {catalogue} from './spell-fixture.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
const actor={userId:'administrator',isAdmin:true};
async function fixture(){
  const rows=memoryCollection(),users=memoryCollection([{supabase_id:'owner',email:'owner@example.test'}]);
  const characters=createCharacterStore({collection:rows,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:'admin-test'});
  const admin=createAdminStore({db:{collection:name=>name==='users'?users:rows},rulesVersion:'test',characterStore:characters});
  const id=randomUUID(),state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie');state.divineOrder='Protecteur';state.name='Fiche du joueur';
  const record=await characters.save('owner',id,state,0);return {admin,characters,rows,id,record};
}
test('Consultation administrateur : fiche complète, propriétaire et aucune métadonnée interne',async()=>{
  const s=await fixture();s.rows.rows[0].combat_receipts={secret:true};
  const record=await s.admin.character(actor,'owner',s.id);
  assert.deepEqual(record.character,s.record.character);assert.equal(record.owner.email,'owner@example.test');assert.equal(record.user_id,undefined);assert.equal(record.combat_receipts,undefined);
  assert.deepEqual(await s.characters.list(actor.userId),[]);
  for(const who of [null,{userId:'owner',isAdmin:false}]){
    await assert.rejects(s.admin.character(who,'owner',s.id),e=>e.status===403);
    await assert.rejects(s.admin.editCharacter(who,'owner',s.id,{character:s.record.character,revision:1}),e=>e.status===403);
  }
});
test('Modification administrateur : propriétaire conservé, validation et journal atomique',async()=>{
  const s=await fixture(),character={...s.record.character,details:{story:'Une bénédiction accordée par le MJ.'}};
  const result=await s.admin.editCharacter(actor,'owner',s.id,{character,revision:1});
  assert.equal(result.revision,2);assert.equal(s.rows.rows.length,1);assert.equal(s.rows.rows[0].user_id,'owner');assert.equal((await s.characters.get('owner',s.id)).character.details.story,character.details.story);
  assert.equal(s.rows.rows[0].admin_edits[0].by,actor.userId);assert.equal(s.rows.rows[0].admin_edits[0].fromRevision,1);
  await assert.rejects(s.characters.get(actor.userId,s.id),e=>e.status===404);
  await assert.rejects(s.admin.editCharacter(actor,'owner',s.id,{character:{...character,level:25},revision:2}),e=>e.status===400);
  assert.equal(s.rows.rows[0].revision,2);assert.equal(s.rows.rows[0].admin_edits.length,1);
});
test('Conflit joueur/admin : ni version périmée ni fiche transférée, supprimée ou inexistante écrasée',async()=>{
  const s=await fixture();await s.characters.save('owner',s.id,{...s.record.character,name:'Correction du joueur'},1);
  await assert.rejects(s.admin.editCharacter(actor,'owner',s.id,{character:s.record.character,revision:1}),e=>e.status===409);
  assert.equal((await s.characters.get('owner',s.id)).character.name,'Correction du joueur');
  await assert.rejects(s.admin.editCharacter(actor,'other-owner',s.id,{character:s.record.character,revision:2}),e=>e.status===409);
  await s.characters.remove('owner',s.id,2);await assert.rejects(s.admin.character(actor,'owner',s.id),e=>e.status===404);
  await assert.rejects(s.admin.editCharacter(actor,'owner',s.id,{character:s.record.character,revision:3}),e=>e.status===409);
  assert.equal(s.rows.rows.length,1);
});
test('Les références ne deviennent pas des filtres MongoDB et une version de règles ne migre pas silencieusement',async()=>{
  const s=await fixture();for(const owner of [null,{$ne:null},''])await assert.rejects(s.admin.character(actor,owner,s.id),e=>e.status===400);
  await assert.rejects(s.admin.character(actor,'owner',{$ne:null}),e=>e.status===400);
  await assert.rejects(s.admin.editCharacter(actor,'owner',s.id,{character:s.record.character,revision:0}),e=>e.status===400);
  await assert.rejects(s.admin.editCharacter(actor,'owner',s.id,{character:{...s.record.character,rulesVersion:null},revision:1}),e=>[400,409].includes(e.status));
  assert.equal(s.rows.rows[0].revision,1);
});
test('Liste : recherche par nom/classe/compte, liens administrateur et textes échappés',()=>{
  const directory={accounts:[{id:'owner',email:'player@example.test'}],characters:[{id:randomUUID(),ownerId:'owner',name:'<script>Éléonore</script>',classId:'clerc',level:3,status:'ready'}]};
  assert.match(renderAdminCharacters(directory,'eleonore clerc player'),/Ouvrir la fiche/);assert.match(renderAdminCharacters(directory),/#admin\/ouvrir\/owner\//);assert.doesNotMatch(renderAdminCharacters(directory),/<script>/);assert.match(renderAdminCharacters(directory,'zzzz'),/Aucune fiche/);
});
