import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {supportedClasses} from '../maquette/class-profiles.mjs';
import {classProfile,visibleSteps} from '../maquette/character-rules.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {spellErrors,hitPoints} from '../maquette/character-rules.mjs';
import {originFeats} from '../maquette/origin-rules.mjs';
import {invocationOptions,invocationErrors} from '../maquette/warlock-options.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url))));
for(const id of ['paladin','roublard','moine','ensorceleur','magicien','occultiste'].filter(id=>supportedClasses.includes(id)))for(const sub of c.subclasses.filter(s=>s.classe_parente===id))for(let level=1;level<=20;level++)test(`${id} · ${sub.nom} ${level} : intégration BDD et aller-retour`,()=>{
  const s=classFixture(c,id,level,sub.id),m=sheetModel(s,c),p=classProfile(s,c);
  assert.deepEqual(m.errors,[]);
  assert.equal(m.proficiency,2+Math.floor((level-1)/4));assert.ok(m.hp>0);
  assert.equal(visibleSteps(s,c).includes(5),p.hasMagic);
  if(p.hasMagic){assert.equal(m.magic.dc,8+m.proficiency+m.mods[p.castingAbility]);assert.ok(p.prepared.length>=p.preparedCount);}
  const saved=validateSavedCharacter(characterSnapshot(s),c);assert.equal(saved.status,'ready');
  assert.deepEqual(JSON.parse(JSON.stringify(sheetModel(saved.character,c))),JSON.parse(JSON.stringify(m)));
  assert.doesNotThrow(()=>renderSheet(s,c));
});
test('Paladin : style divin, aura conditionnelle et deux remplacements autorisés seulement',()=>{
  const s=classFixture(c,'paladin',18,'paladin_serment_gloire');s.classChoices.combatStyle=['divine'];const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,2).map(x=>x.id);
  const m=sheetModel(s,c);assert.equal(p.cantripCount,2);assert.ok(p.cantrips.every(x=>x.classes.includes('Clerc')));
  assert.equal(m.classResources.find(x=>x.nom==='Toucher guérisseur').valeur,90);
  assert.equal(m.classResources.find(x=>x.nom==='Aura défensive').valeur,'+3');assert.ok(m.classResources.find(x=>x.nom==='Aura défensive').details.startsWith('9 m'));
  assert.ok(p.always.some(x=>x.id==='rayon_tracant'));assert.ok(p.always.some(x=>x.id==='heroisme'));assert.ok(p.always.some(x=>x.id==='passage_sans_trace'));
  const d=classProfile(classFixture(c,'paladin',3,'paladin_serment_devotion'),c);assert.ok(d.always.some(x=>x.id==='sanctification'&&x.niveau===5));assert.match(d.spellcastingNote,/aucun emplacement/);
});
test('Roublard : expertises 1/6, paliers 10 et maîtrises de sauvegarde au niveau 15',()=>{
  const s=classFixture(c,'roublard',15,'roublard_assassin'),m=sheetModel(s,c);
  assert.equal(m.skills.filter(x=>x.expertise).length,4);assert.ok(s.advancements[10]);
  for(const a of ['SAG','CHA'])assert.equal(m.saves.find(x=>x.ability===a).value,m.mods[a]+m.proficiency);
  assert.ok(m.tools.some(x=>/poison/i.test(x)));assert.equal(m.classResources.find(r=>r.nom==='Attaque sournoise').valeur,'8d6');
});
test('Moine : progression du dé, DEX/SAG niveau 20, vitesse, CA et six sauvegardes',()=>{
  const s=classFixture(c,'moine',20,'moine_credo_paume'),m=sheetModel(s,c);
  assert.equal(m.scores.DEX,16);assert.equal(m.scores.SAG,20);assert.equal(m.ac,18);assert.equal(m.speed,18);
  assert.ok(m.saves.every(x=>x.trained));assert.equal(m.attacks.find(x=>x.nom==='Mains nues').degats.de,'1d12');assert.equal(m.attacksPerAction,2);
  assert.ok(m.immunities.includes('nécrotique'));assert.equal(m.classResources.find(r=>r.nom==='Énergie martiale').valeur,20);
});
test('Magicien : grimoire obligatoire, minimum de rangs antérieurs et préparés limités au livre',()=>{
  const s=classFixture(c,'magicien',20,'magicien_abjurateur'),p=classProfile(s,c),m=sheetModel(s,c);
  assert.equal(s.classChoices.spellbook.length,44);assert.ok(p.prepared.every(x=>s.classChoices.spellbook.includes(x.id)));
  assert.equal(m.classResources.find(x=>x.nom==='Bouclier arcanique').valeur,40+m.mods.INT);
  assert.equal(p.always.filter(x=>['Sort signature','Maîtrise arcanique'].includes(x.grantSource)).length,4);
  const bad=structuredClone(s);bad.classChoices.spellbook=c.spells.filter(x=>x.classes.includes('Magicien')&&x.niveau>=3).slice(0,44).map(x=>x.id);assert.equal(validateSavedCharacter(bad,c).status,'draft');
});
test('Ensorceleur : résistance et PV draconiques, métamagies distinctes, Magie innée reste conditionnelle',()=>{
  const s=classFixture(c,'ensorceleur',20,'ensorceleur_sorcellerie_draconique'),m=sheetModel(s,c),plain={...s,subclassId:'ensorceleur_sorcellerie_sauvage'};
  assert.equal(hitPoints(s,c),hitPoints(plain,c)+20);assert.equal(m.ac,14);assert.equal(m.magic.dc,17);
  assert.equal(s.classChoices.metamagic.length,6);assert.ok(m.resistances.includes(s.classChoices.dragonDamage[0]));assert.ok(m.classEffects.dragonForm);assert.equal(m.classEffects.dragonForm.pv,m.hp);
  s.classChoices.metamagic=Array(6).fill('subtil');assert.equal(validateSavedCharacter(s,c).status,'draft');
});
test('Les données non identifiées exigent confirmation et restent des avertissements sans statistiques inventées',()=>{
  const s=classFixture(c,'ensorceleur',6,'ensorceleur_sorcellerie_mecanique'),m=sheetModel(s,c),unknown=m.spells.find(x=>x.unresolved);
  assert.ok(unknown);assert.equal(unknown.niveau,null);assert.equal(unknown.dc,null);assert.match(m.ruleNotices,/non identifiée/);
  s.classChoices.rulesToReview=[];assert.equal(validateSavedCharacter(s,c).status,'draft');
});
test('Occultiste : pacte séparé des quatre arcanums, prérequis des manifestations et Tome sans doublon',()=>{
  const s=classFixture(c,'occultiste',20,'occultiste_protecteur_celeste'),p=classProfile(s,c);
  assert.deepEqual(p.slots,{5:4});assert.equal(p.extraSpells.filter(x=>x.source.startsWith('Secret arcanique')).length,4);
  assert.ok(p.prepared.every(x=>x.niveau<=5));assert.ok(p.extraSpells.filter(x=>x.source==='Pacte du Grimoire').every(x=>!p.prepared.some(y=>y.id===x.id)));
  s.classChoices.invocations=['thirsting'];assert.ok(invocationErrors(s,c).length);assert.ok(!invocationOptions({...s,level:1},c).some(x=>x.id==='thirsting'));
});
test('Décharge agonisante : le sort associé doit être connu, son bonus est attaché au bon sort',()=>{
  const s=classFixture(c,'occultiste',2),spell=c.spells.find(x=>x.niveau===0&&x.classes.includes('Occultiste')&&x.degats?.length);
  s.classChoices.invocations=['armor','mind','agonizing:'+spell.id];let p=classProfile(s,c);s.cantrips=p.cantrips.filter(x=>x.id!==spell.id).slice(0,p.cantripCount).map(x=>x.id);assert.ok(spellErrors(s,c).length);
  s.cantrips=[spell.id,...p.cantrips.filter(x=>x.id!==spell.id).slice(0,1).map(x=>x.id)];assert.deepEqual(spellErrors(s,c),[]);assert.ok(sheetModel(s,c).spells.find(x=>x.id===spell.id).featRules.some(x=>x.includes('CHA ajouté')));
});
test('Leçons des premiers êtres : don d’origine réel, bonus appliqué et sauvegarde stable',()=>{
  const s=classFixture(c,'occultiste',2),before=hitPoints(s,c);s.classChoices.invocations=['armor','mind','lesson:robuste'];const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  assert.ok(originFeats(s,c).some(g=>g.slot.startsWith('invocation')&&g.feat.id==='robuste'));assert.equal(hitPoints(s,c),before+2);
  assert.equal(validateSavedCharacter(s,c).status,'ready');const saved=validateSavedCharacter(s,c).character;assert.deepEqual(saved.classChoices,s.classChoices);
});
