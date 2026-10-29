import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyRulesRevision} from '../rules-revision.mjs';
import {buildCatalogue} from '../catalogue.mjs';
import {originBonuses} from '../maquette/origin-rules.mjs';
import {epicGrantSpells,featChoiceSpec,featEffects} from '../maquette/feat-effects.mjs';
import {eligibleLevelFeats} from '../maquette/progression.mjs';
import {assertRulesReady} from '../rules-release.mjs';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const snapshot=await read('../tests/fixtures/rules-2024.json');
const reference=await read('../audit/background-reference-2024.json');
const plan=await read('../data/rules-2024-corrections.json');
const c=buildCatalogue(snapshot);

test('Une simple comparaison ou des corrections partielles ne permettent pas une publication',async()=>{
  const status=await read('../audit/rules-2024-status.json');
  const ledger=await read('../audit/rules-2024-ledger.json');
  assert.equal(ledger.entries.length,status.modules.reduce((n,m)=>n+m.total,0));
  const partial=structuredClone(ledger);partial.entries[0].status='pending';
  assert.throws(()=>assertRulesReady(status,partial,plan),/pas entièrement vérifiées/);
  const entry={collection:'dons',id:'test',source:'https://www.dndbeyond.com/srd',status:'verified'};
  const ready={releaseId:plan.id,cutoff:plan.cutoff,modules:[{total:1}],status:'frozen',blockers:[]};
  const records={releaseId:plan.id,cutoff:plan.cutoff,entries:[entry]};
  assert.doesNotThrow(()=>assertRulesReady(ready,records,{...plan,status:'frozen'}));
  assert.throws(()=>assertRulesReady({...ready,blockers:['Personnages à préserver']},records,{...plan,status:'frozen'}),/problèmes/);
  assert.throws(()=>assertRulesReady(ready,{...records,entries:[{...entry,source:null}]},{...plan,status:'frozen'}),/pas entièrement vérifiées/);
});

test('Une révision possède une date de référence et une source par correction',()=>{
  assert.equal(plan.cutoff,'2026-10-28');
  assert.ok(['candidate','frozen'].includes(plan.status));
  assert.equal(new Set(plan.corrections.map(x=>x.collection+'/'+x.id)).size,plan.corrections.length);
  for(const r of plan.corrections){assert.ok(r.changes.length);assert.match(r.source,/^https:\/\/(media\.dndbeyond\.com|www\.dndbeyond\.com|roll20\.net)\//);}
});

test('Un sort absent est ajouté sur copie, avec précondition d’absence et idempotence',()=>{
  assert.equal(snapshot.collections.sorts.some(x=>x.id==='rayon_de_lune'),false);
  const first=applyRulesRevision(snapshot),spell=first.sorts.find(x=>x.id==='rayon_de_lune');
  assert.equal(spell.niveau,2);assert.equal(spell.sauvegarde,'CON');
  assert.equal(first.sorts.filter(x=>x.id==='rayon_de_lune').length,1);
  assert.deepEqual(applyRulesRevision({...snapshot,collections:first}),first);
  const drift=structuredClone(snapshot);drift.collections.sorts.push({...spell,niveau:1});
  const before=JSON.stringify(drift);assert.throws(()=>applyRulesRevision(drift),/addition source drift/);assert.equal(JSON.stringify(drift),before);
  assert.throws(()=>applyRulesRevision(snapshot,{...plan,additions:[...plan.additions,...plan.additions]}),/duplicate addition/);
});

test('Construire le catalogue ne modifie pas la source et la révision est idempotente',()=>{
  const before=JSON.stringify(snapshot);
  const first=applyRulesRevision(snapshot);
  assert.equal(JSON.stringify(snapshot),before);
  assert.deepEqual(applyRulesRevision({...snapshot,collections:first}),first);
  assert.equal(c.provenance.revision.id,'phb2024-2026-10-28');
});

test('Une divergence ou une cible ambiguë bloque la correction sans modifier les données',()=>{
  const input=structuredClone(snapshot);
  input.collections.dons.find(x=>x.id==='robuste').effets=[];
  const before=JSON.stringify(input);
  assert.throws(()=>applyRulesRevision(input),/source drift/);
  assert.equal(JSON.stringify(input),before);
  const duplicate=structuredClone(snapshot);
  duplicate.collections.dons.push(duplicate.collections.dons.find(x=>x.id==='robuste'));
  assert.throws(()=>applyRulesRevision(duplicate),/expected one/);
});

for(const r of reference)test(`Historique 2024 ${r.id} : caractéristiques, don, compétences, outil et équipement`,()=>{
  const actual=c.backgrounds.find(x=>x.id===r.id);
  for(const [field,value]of Object.entries(r.fields))assert.deepEqual(actual[field],value,field);
  assert.equal(actual.bonus_caracteristiques.suggerees.length,3);
  assert.equal(actual.competences.length,2);
  assert.equal(actual.outils.length,1);
});

for(let level=1;level<=20;level++)test(`Robuste officiel niveau ${level} : +${2*level} PV sans cumul d’origine`,()=>{
  const state={classId:'barbare',level,speciesId:'humain',backgroundId:'fermier',originFeatId:'robuste'};
  assert.equal(originBonuses(state,c).hp,2*level);
});

test('La faveur du destin convient aussi à un non-incantateur et ne donne pas de sort',()=>{
  const state={classId:'barbare',level:20,speciesId:'orc',backgroundId:'charlatan',classChoices:{},advancements:{19:{mode:'feat',featId:'faveur_du_destin',featAbility:'CHA',choices:{spell:'souhait'}}}};
  assert.ok(eligibleLevelFeats(state,c,19,{FOR:18,DEX:14,CON:16,INT:10,SAG:12,CHA:10}).some(f=>f.id==='faveur_du_destin'));
  assert.equal(featChoiceSpec(state,c,{level:19,feat:c.feats.find(x=>x.id==='faveur_du_destin')}),null);
  assert.deepEqual(epicGrantSpells(state,c),[]);
});

test('Empoisonneur ne donne aucune résistance personnelle ; Robuste décrit +2 par niveau',()=>{
  const state={classId:'clerc',level:4,speciesId:'orc',backgroundId:'charlatan',classChoices:{},scores:{FOR:12,DEX:12,CON:12,INT:14,SAG:16,CHA:12},bonusMode:'three',advancements:{4:{mode:'feat',featId:'empoisonneur',featAbility:'INT',choices:{}}}};
  assert.ok(!featEffects(state,c,{FOR:1,DEX:1,CON:1,INT:2,SAG:3,CHA:1},2).resistances.includes('poison'));
  assert.match(c.feats.find(x=>x.id==='robuste').effets[0].valeur,/deux fois votre niveau/);
});

test('Les champs des trois sorts corrigés suivent les errata',()=>{
  for(const id of ['invocation_d_elementaire','invocation_d_elementaires_mineurs'])assert.match(c.spells.find(x=>x.id===id).niveau_superieur,/1d8 par niveau/);
  assert.equal(c.spells.find(x=>x.id==='sphere_de_feu').ecole,'Évocation');
});
