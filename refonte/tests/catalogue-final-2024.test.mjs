import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {applyRulesRevision} from '../rules-revision.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const raw=read('../tests/fixtures/rules-2024.json'),d=applyRulesRevision(raw),c=buildCatalogue(raw);
const fieldChecks=(actual,fields,label)=>{assert.ok(actual,label);for(const [key,value]of Object.entries(fields))assert.deepEqual(actual[key],value,`${label}.${key}`);};
for(const r of read('../audit/spell-comparisons-2024.json').entries)test(`Référence complète du sort ${r.id}`,()=>fieldChecks(d.sorts.find(x=>x.id===r.id),r.fields,r.id));
const presence=read('../audit/final-presence-reference-2024.json');
test(`Référence complète du sort ${presence.id}`,()=>fieldChecks(d.sorts.find(x=>x.id===presence.id),presence.fields,presence.id));
for(const r of read('../audit/feat-reference-2024.json').entries)test(`Référence du don ${r.id}`,()=>fieldChecks(d.dons.find(x=>x.id===r.id),r.fields,r.id));
for(const r of read('../audit/equipment-reference-2024.json').entries)test(`Référence équipement ${r.collection}/${r.id}`,()=>fieldChecks(d[r.collection].find(x=>(['armes','competences'].includes(r.collection)?x.nom:x.id)===r.id),r.fields,r.id));
for(const [name,collection]of [['animal','formes_animales'],['dragon','formes_draconiques'],['familiar','familiers']])for(const r of read(`../audit/${name}-reference-2024.json`).entries)test(`Profil officiel ${collection}/${r.id}`,()=>fieldChecks(d[collection].find(x=>x.slug===r.id),r.parsed,r.id));
for(const r of read('../audit/complementary-spells-2024-preparation.json').after)test(`Sort complémentaire ${r.id} : référence et archivage`,()=>{
  const actual=read('../data/missing-spells.json').find(x=>x.id===r.id);
  fieldChecks(actual,r,r.id);
  if(actual.aliasOf){assert.ok(!c.spells.some(x=>x.id===r.id));assert.ok(c.spells.some(x=>x.id===actual.aliasOf));}
  else assert.ok(c.spells.some(x=>x.id===r.id));
});
for(const r of read('../audit/invocations-2024-preparation.json').after.options)test(`Manifestation ${r.id} : référence`,()=>fieldChecks(c.invocations.options.find(x=>x.id===r.id),r,r.id));
for(const r of read('../data/rules-2024-corrections.json').additions)test(`Absence complétée ${r.collection}/${r.id} : contenu de référence`,()=>{
  assert.equal(r.before,null);assert.match(r.source,/^https:\/\//);
  fieldChecks(d[r.collection].find(x=>(r.collection==='armes'?x.nom:r.collection==='familiers'?x.slug:x.id)===r.id),r.after,r.id);
});
const fixtures=new Map();
for(const spell of c.spells)test(`Fiche de sort ${spell.id} : texte, paramètres et valeurs d'incantation`,()=>{
  const cls=c.classes.find(x=>spell.classes?.includes(x.nom));assert.ok(cls,`Liste de classe manquante : ${spell.id}`);
  if(!fixtures.has(cls.id))fixtures.set(cls.id,classFixture(c,cls.id,20,c.subclasses.find(s=>s.classe_parente===cls.id).id));
  const state=structuredClone(fixtures.get(cls.id));
  state.cantrips=spell.niveau===0?[spell.id]:[];state.prepared=spell.niveau===0?[]:[spell.id];
  // Isolated rendering contract, not a claim that this one-spell state has completed all wizard choices.
  const card=sheetModel(state,c).spells.find(x=>x.id===spell.id);assert.ok(card);
  assert.equal(card.description,spell.description);assert.equal(card.niveau,spell.niveau);
  assert.deepEqual(card.composantes,spell.composantes);assert.deepEqual(card.invocation,spell.invocation);
  assert.equal(card.dc,Number.isFinite(spell.sauvegarde?.dd_fixe)?spell.sauvegarde.dd_fixe:8+sheetModel(state,c).proficiency+sheetModel(state,c).mods[card.ability]);
  const html=renderSheet(state,c,{activeTab:'spells'});
  const escapedName=spell.nom.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  assert.ok(html.includes(`<h3>${escapedName}</h3>`));
  assert.ok(!/\b(?:NaN|Infinity)\b/.test(html));
});
