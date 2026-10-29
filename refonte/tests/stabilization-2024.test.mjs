import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {applyRulesRevision} from '../rules-revision.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {CURRENT_RULES_VERSION,upgradedCharacterCopy} from '../maquette/character-version.mjs';
import {sheetModel,scaledCantripDamage} from '../maquette/sheet-model.mjs';
import {featChoiceSpecs} from '../maquette/feat-effects.mjs';
import {createCharacterStore} from '../access/character-store.mjs';
import {shapePool,classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {assertRulesReady} from '../rules-release.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/rules-2024.json',import.meta.url)));
const c=buildCatalogue(raw),spell=id=>c.spells.find(s=>s.id===id);

test('Les fiches révisées n’utilisent plus les anciens paramètres de sommeil, auras et châtiments',()=>{
  assert.equal(spell('sommeil').niveau_superieur,null);
  assert.equal(spell('vie_carquois').niveau,5);
  assert.equal(spell('convocation_de_mort_vivant').niveau,3);
  assert.equal(spell('chatiment_de_cecite').concentration,false);
  assert.equal(spell('chatiment_de_courroux').concentration,false);
  assert.equal(spell('grele_d_epines').degats[0].valeur,'1d10');
  assert.equal(spell('mot_de_pouvoir_fortifiant').classes.includes('Barde'),true);
  assert.match(spell('mot_de_pouvoir_fortifiant').description,/120/);
  assert.match(spell('chaudron_bouillonnant_de_tasha').description,/potion/);
  assert.equal(spell('chaudron_bouillonnant_de_tasha').degats.length,0);
});

test('Un dégât conditionnel reste conditionnel dans le résumé de fiche',()=>{
  const s=classFixture(c,'magicien',9,'magicien_abjurateur');
  s.prepared=['porte_dimensionnelle'];
  s.classChoices.spellbook=[...new Set([...s.classChoices.spellbook,'porte_dimensionnelle'])];
  const card=sheetModel(s,c).spells.find(x=>x.id==='porte_dimensionnelle');
  assert.match(card.damageAtLevel,/Uniquement si la destination/);
});

test('Glas conserve le bon type de dé pour chaque branche aux niveaux5/11/17',()=>{
  const s=spell('glas');for(const[level,count]of [[1,1],[5,2],[11,3],[17,4]])
    for(const effect of s.degats)assert.equal(scaledCantripDamage(effect,s.niveau_superieur,level),`${count}d${effect.valeur.endsWith('12')?'12':'8'}`);
});

test('Les huit convocations ont un profil utilisable et aucune attaque fictive du lanceur',()=>{
  const ids=['convocation_de_bete','convocation_de_fee','convocation_d_aberration','convocation_d_artificiel','convocation_de_elementaire','convocation_de_celeste','convocation_de_mort_vivant','convocation_de_fielon'];
  for(const id of ids){const s=spell(id);assert.equal(s.attaque,null,id);assert.match(s.invocation.description,/CA\d+\+rang/,id);assert.match(s.invocation.source,/expansion=32231/);}
});

test('Le catalogue inclut les absences confirmées et les paramètres d’équipement corrigés',()=>{
  assert.equal(c.weapons.length,38);
  assert.equal(c.weapons.find(w=>w.nom==='Pic de guerre').botte,'sape');
  assert.equal(c.weapons.find(w=>w.nom==='Rapière').botte,'ouverture');
  assert.equal(c.weapons.find(w=>w.nom==='Trident').degats.de,'1d8');
  assert.equal(c.weapons.find(w=>w.nom==='Mousquet').proprietes.includes('lourde'),false);
  assert.equal(c.armors.find(a=>a.id==='clibanion').classe_armure.base,17);
  assert.equal(c.armors.find(a=>a.id==='clibanion').force_min,15);
  assert.equal(c.armors.find(a=>a.id==='bouclier').enfiler,'action Utilisation');
  assert.equal(c.familiars.find(f=>f.slug==='slaad-tadpole').pv,7);
  assert.equal(spell('aura_de_purete').niveau,4);
  assert.equal(spell('staggering_smite').niveau,4);
});

test('Les ajouts arme et familier restent idempotents et refusent une divergence sans mutation',()=>{
  const applied=applyRulesRevision(raw);assert.deepEqual(applyRulesRevision({...raw,collections:applied}),applied);
  const drift=structuredClone(raw);drift.collections.armes.push({...c.weapons.find(w=>w.nom==='Pic de guerre'),poids:99});
  const before=JSON.stringify(drift);assert.throws(()=>applyRulesRevision(drift),/addition source drift/);assert.equal(JSON.stringify(drift),before);
});

test('Une fiche ancienne est refusée sans la modifier ; la mise à niveau crée une copie explicite',()=>{
  const original=classFixture(c,'clerc',3,'clerc_domaine_vie');delete original.rulesVersion;
  original.name='Youpi matin';original.cloudId='old-id';original.cloudRevision=1;
  const before=JSON.stringify(original);assert.throws(()=>validateSavedCharacter(original,c),e=>e.status===409);
  assert.equal(characterSnapshot(original).rulesVersion,null);
  const copy=upgradedCharacterCopy(original,'new-id');
  assert.equal(copy.rulesVersion,CURRENT_RULES_VERSION);assert.equal(copy.cloudRevision,0);
  assert.deepEqual(copy.scores,original.scores);assert.deepEqual(copy.rolls,original.rolls);
  copy.scores.FOR=3;assert.equal(JSON.stringify(original),before);
  assert.throws(()=>upgradedCharacterCopy(original,'old-id'));
});

test('Le serveur refuse de remplacer une fiche ancienne par une fiche aux nouvelles règles',async()=>{
  const input=classFixture(c,'clerc',3,'clerc_domaine_vie'),id='12345678-1234-1234-1234-123456789abc';
  const stored={character:{...input,rulesVersion:undefined},revision:1};let writes=0;
  const store=createCharacterStore({collection:{findOne:async()=>stored,updateOne:async()=>{writes++;return {matchedCount:1};}},validate:s=>validateSavedCharacter(s,c),catalogueFingerprint:'test'});
  await assert.rejects(store.save('test',id,input,1),e=>e.status===409);assert.equal(writes,0);
});

test('Les choix multiples de dons et six rituels survivent à la sauvegarde',()=>{
  const s=originFixture(c,'guerrier',20,{speciesId:'orc'},'charlatan');
  s.advancements[4]={mode:'feat',abilities:[],featId:'magie_rituelle',featAbility:'INT',notes:'',choices:{rituals:c.spells.filter(x=>x.niveau===1&&x.rituel).slice(0,6).map(x=>x.id)}};
  s.advancements[8]={mode:'feat',abilities:[],featId:'weapon_master',featAbility:'FOR',notes:'',choices:{weapon:'Pic de guerre'}};
  const saved=validateSavedCharacter(s,c).character;
  assert.equal(saved.advancements[4].choices.rituals.length,6);
  assert.equal(saved.advancements[8].choices.weapon,'Pic de guerre');
  const row={level:4,feat:c.feats.find(f=>f.id==='expert'),choice:{choices:{}}};
  assert.deepEqual(featChoiceSpecs(s,c,row).map(x=>x.field),['skill','expertise']);
});

test('Les profils sans référence sont exclus des choix ; leur réserve documentée ne devient jamais une validation',()=>{
  const ledger=JSON.parse(fs.readFileSync(new URL('../audit/rules-2024-ledger.json',import.meta.url)));
  const exclusions=ledger.entries.filter(e=>e.status==='reference-unavailable');assert.equal(exclusions.length,5);
  const s=classFixture(c,'druide',20,'druide_cercle_lune');
  for(const row of exclusions){assert.ok(!shapePool(s,c).some(f=>f.slug===row.id));assert.equal(row.excludedFromCreation,true);}
  const unavailable={...exclusions[0]};
  const release={releaseId:ledger.releaseId,cutoff:ledger.cutoff,status:'frozen',blockers:[],modules:[{total:1}]};
  const plan={id:ledger.releaseId,cutoff:ledger.cutoff,status:'frozen'};
  assert.doesNotThrow(()=>assertRulesReady(release,{...ledger,entries:[unavailable]},plan));
  delete unavailable.exclusionEvidence;assert.throws(()=>assertRulesReady(release,{...ledger,entries:[unavailable]},plan));
});

test('Le Pacte de la Chaîne propose aussi le têtard de slaad sans imposer une forme',()=>{
  const s=classFixture(c,'occultiste',5,'occultiste_protecteur_celeste');s.classChoices.invocations=['chain'];
  const spec=classChoiceSpecs(s,c).find(x=>x.key==='familiar');assert.ok(spec);assert.equal(spec.min,0);assert.ok(spec.options.some(x=>x.id==='slaad-tadpole'));
});
