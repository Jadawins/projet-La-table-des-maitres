import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildCatalogue} from '../catalogue.mjs';
import {applyEditorialRevision} from '../editorial-revision.mjs';
import plan from '../data/editorial-description-corrections-20261030.json' with {type:'json'};
const snapshot=JSON.parse(readFileSync(new URL('fixtures/rules-2024.json',import.meta.url)));
const base=buildCatalogue(snapshot,{editorial:false});

test('Édition : seuls les 35 champs approuvés changent, toutes les données mécaniques restent identiques',()=>{
  const before=structuredClone(base),edited=applyEditorialRevision(base),restored=structuredClone(edited);
  assert.equal(createHash('sha256').update(JSON.stringify(base)).digest('hex'),plan.baseCatalogueSha256);
  assert.equal(plan.corrections.length,35);
  for(const c of plan.corrections){let row=restored[c.collection].find(r=>r.id===c.id);for(const key of c.path.slice(0,-1))row=row[key];assert.equal(row[c.path.at(-1)],c.after);row[c.path.at(-1)]=c.before;}
  delete restored.provenance.editorialRevision;assert.deepEqual(restored,base);assert.deepEqual(base,before);
  assert.equal(edited.provenance.revision.id,'phb2024-2026-10-28');
});

test('Typographie : dés et valeurs inchangés, uniquement des espaces pour les 29 corrections',()=>{
  const spacing=plan.corrections.filter(c=>c.kind==='spacing-only');assert.equal(spacing.length,29);
  for(const c of spacing)assert.equal(c.after.replace(/\s/g,''),c.before.replace(/\s/g,''),c.id);
  assert.equal(plan.corrections.filter(c=>c.kind==='reviewed-prose').length,6);
  for(const c of plan.corrections)assert.deepEqual(c.after.match(/\d+(?:[.,]\d+)?(?:d\d+)?/g),c.before.match(/\d+(?:[.,]\d+)?(?:d\d+)?/g),c.id);
});

test('Une dérive du texte source bloque l’édition sans modifier les données entrantes',()=>{
  const changed=structuredClone(base),c=plan.corrections.at(-1);let row=changed[c.collection].find(r=>r.id===c.id);for(const key of c.path.slice(0,-1))row=row[key];row[c.path.at(-1)]+=' dérive';const before=structuredClone(changed);
  assert.throws(()=>applyEditorialRevision(changed),/Texte source différent/);assert.deepEqual(changed,before);
});

test('Une édition ne peut pas ajouter un changement numérique, une entrée ambiguë ou un chemin dangereux',()=>{
  const c=plan.corrections[0];
  for(const path of [['niveau'],['__proto__','description']])assert.throws(()=>applyEditorialRevision(base,{...plan,corrections:[{...c,path}]}),/invalide/);
  assert.throws(()=>applyEditorialRevision(base,{...plan,corrections:[c,c]}),/répété/);
  assert.throws(()=>applyEditorialRevision(base,{...plan,rulesVersion:'other'}),/incohérente/);
});
