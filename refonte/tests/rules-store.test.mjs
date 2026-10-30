import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueHash,importRulesCatalogue,loadRulesCatalogue,RULES_COLLECTION} from '../access/rules-store.mjs';
function setup(){
  const rows=new Map();let writes=0;
  const db={collection(name){assert.equal(name,RULES_COLLECTION);return {findOne:async({_id})=>structuredClone(rows.get(_id)??null),insertOne:async row=>{if(rows.has(row._id))throw Object.assign(Error('duplicate'),{code:11000});rows.set(row._id,structuredClone(row));writes++;}};}};
  const catalogue={provenance:{revision:{id:'test-rules-2024',status:'frozen'}}};
  for(const name of ['classes','subclasses','species','backgrounds','spells','feats','skills','weapons','armors','tools'])catalogue[name]=[{id:name+'-example',description:'Donnée synthétique de test'}];
  const release={id:'test-rules-2024',sha256:catalogueHash(catalogue)};
  return {db,rows,catalogue,release,writes:()=>writes};
}
test('Import versionné : égalité complète après relecture et absence de mutation de l’entrée',async()=>{
  const {db,catalogue,release,writes}=setup(),before=structuredClone(catalogue);
  assert.equal((await importRulesCatalogue(db,catalogue,release)).created,true);assert.equal(writes(),1);
  assert.deepEqual((await loadRulesCatalogue(db,release)).catalogue,before);assert.deepEqual(catalogue,before);
});
test('Réexécuter le même import ne crée ni doublon ni mise à jour',async()=>{
  const x=setup();await importRulesCatalogue(x.db,x.catalogue,x.release);
  assert.equal((await importRulesCatalogue(x.db,x.catalogue,x.release)).created,false);assert.equal(x.writes(),1);
});
test('Modifier une version déjà importée est refusé sans écriture',async()=>{
  const x=setup();await importRulesCatalogue(x.db,x.catalogue,x.release);x.catalogue.spells[0].description='changé';
  await assert.rejects(importRulesCatalogue(x.db,x.catalogue,x.release),/Empreinte/);assert.equal(x.writes(),1);
});
test('Une altération en BDD est repérée au démarrage, sans secours sur disque',async()=>{
  const x=setup();await importRulesCatalogue(x.db,x.catalogue,x.release);x.rows.get(x.release.id).catalogue.spells=[];
  await assert.rejects(loadRulesCatalogue(x.db,x.release),/incomplet/);
});
test('Version absente ou mauvais identifiant : le chargement échoue',async()=>{
  const x=setup();await assert.rejects(loadRulesCatalogue(x.db,x.release),/introuvable/);
  await assert.rejects(loadRulesCatalogue(x.db,{...x.release,id:'../unexpected'}),/invalide/);
});
test('Un contenu concurrent différent ne remplace pas une version existante',async()=>{
  const x=setup();await importRulesCatalogue(x.db,x.catalogue,x.release);
  const changed=structuredClone(x.catalogue);changed.spells[0].description='nouveau contenu';
  await assert.rejects(importRulesCatalogue(x.db,changed,{...x.release,sha256:catalogueHash(changed)}),/incohérente/);assert.equal(x.writes(),1);
});

test('Une nouvelle édition conserve les règles des personnages et ne remplace pas le catalogue précédent',async()=>{
  const x=setup();await importRulesCatalogue(x.db,x.catalogue,x.release);
  const updated=structuredClone(x.catalogue),catalogueId=x.release.id+'-textes';
  updated.spells[0].description='Résumé corrigé';updated.provenance.editorialRevision={id:catalogueId,status:'frozen',rulesVersion:x.release.id};
  const release={...x.release,catalogueId,sha256:catalogueHash(updated)};
  await importRulesCatalogue(x.db,updated,release);assert.equal(x.writes(),2);
  assert.deepEqual((await loadRulesCatalogue(x.db,x.release)).catalogue,x.catalogue);
  assert.deepEqual((await loadRulesCatalogue(x.db,release)).catalogue,updated);
  assert.equal((await importRulesCatalogue(x.db,updated,release)).created,false);assert.equal(x.writes(),2);
});

test('Une édition incohérente ou un identifiant dangereux est refusé avant toute écriture',async()=>{
  const x=setup();
  await assert.rejects(importRulesCatalogue(x.db,x.catalogue,{...x.release,catalogueId:x.release.id+'-textes'}),/Édition/);
  await assert.rejects(importRulesCatalogue(x.db,x.catalogue,{...x.release,catalogueId:'../escape'}),/invalide/);
  assert.equal(x.writes(),0);
});
