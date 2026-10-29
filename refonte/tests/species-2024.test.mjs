import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {originErrors,grantedOriginSpells,reconcileOrigins,humanFeats,originFeats,magicFeatProfile,grantInitial} from '../maquette/origin-rules.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {classTraining} from '../maquette/progression.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')));
const make=(speciesId,level=5,extra={})=>originFixture(c,'barbare',level,{speciesId,...extra},'charlatan');

for(const [species,variants]of [['elfe',['drow','elfe_sylvestre','haut_elfe']],['gnome',['gnome_forets','gnome_roches']],['tieffelin',['abyssal','chtonien','infernal']]])for(const variantId of variants)for(const ability of ['INT','SAG','CHA'])for(const level of [1,3,5,20])test(`${species}/${variantId} · ${ability} · niveau ${level}`,()=>{
  const s=make(species,level,{variantId,speciesCastingAbility:ability});
  const m=sheetModel(s,c),spells=m.spells.filter(sp=>sp.source==='Espèce');
  assert.ok(spells.length);assert.ok(spells.every(sp=>sp.ability===ability&&!sp.unresolved));
  for(const spell of spells)assert.equal(spell.dc,8+m.proficiency+m.mods[ability]);
  assert.ok(spells.every(sp=>sp.niveau<=2));
  const saved=validateSavedCharacter(characterSnapshot(s),c);assert.equal(saved.status,'ready',saved.issues.join('; '));
  assert.equal(saved.character.speciesCastingAbility,ability);
});

test('Le haut-elfe garde Prestidigitation sans choix, ou choisit un seul mineur de Magicien',()=>{
  const s=make('elfe',1,{variantId:'haut_elfe',speciesCastingAbility:'CHA'});
  assert.ok(grantedOriginSpells(s,c).some(sp=>sp.id==='prestidigitation'));
  s.speciesCantrip='trait_de_feu';const spells=grantedOriginSpells(s,c);
  assert.ok(spells.some(sp=>sp.id==='trait_de_feu'));assert.ok(!spells.some(sp=>sp.id==='prestidigitation'));
  s.speciesCantrip='soins';assert.ok(originErrors(s,c).length);
  s.speciesId='gnome';s.variantId='gnome_forets';reconcileOrigins(s,c);assert.equal(s.speciesCantrip,'');
});

for(const ability of ['INT','SAG','CHA'])for(const background of ['acolyte','guide','sage'])test(`Initié à la magie · ${background} · choix ${ability}`,()=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},background);
  s.originGrants.background.magicAbility=ability;
  const grant=originFeats(s,c).find(g=>g.slot==='background');assert.equal(magicFeatProfile(s,c,grant).ability,ability);
  const m=sheetModel(s,c),spells=m.spells.filter(sp=>sp.source==='Don d’historique');assert.equal(spells.length,3);
  assert.ok(spells.every(sp=>sp.ability===ability&&sp.dc===8+m.proficiency+m.mods[ability]));
  const saved=validateSavedCharacter(characterSnapshot(s),c);assert.equal(saved.status,'ready');assert.equal(saved.character.originGrants.background.magicAbility,ability);
  s.originGrants.background.magicAbility='';assert.ok(originErrors(s,c).length);assert.ok(sheetModel(s,c).spells.filter(sp=>sp.source==='Don d’historique').every(sp=>sp.dc===null));
});

test('Une caractéristique de don non autorisée est refusée par la sauvegarde',()=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},'acolyte');s.originGrants.background.magicAbility='FOR';assert.throws(()=>validateSavedCharacter(s,c),/choix de don/);
  assert.equal(grantInitial().magicAbility,'');
});

test('Le nain 2024 n’a ni sous-espèce mécanique ni formations d’armure',()=>{
  assert.deepEqual(c.species.find(s=>s.id==='nain').variantes,[]);
  const s=originFixture(c,'magicien',1,{speciesId:'nain'},'charlatan');assert.ok(!classTraining(s,c).armors.includes('armures_intermediaires'));
});

for(const level of [1,5,11,17,20])test(`Souffle drakéide · niveau ${level} · DD CON et dés explicites`,()=>{
  const s=make('drakeide',level,{variantId:'airain'}),m=sheetModel(s,c);
  const resource=m.speciesResources.find(r=>r.nom==='Souffle');
  const dice=level>=17?'4d10':level>=11?'3d10':level>=5?'2d10':'1d10';
  assert.equal(resource.valeur,dice+' feu');assert.ok(resource.details.includes('DD '+(8+m.proficiency+m.mods.CON)));assert.match(resource.details,/JS DEX/);
  assert.equal(m.speciesResources.some(r=>r.nom==='Vol draconique'),level>=5);
});

test('Aasimar, goliath, nain et orc : quotas et effets conditionnels corrects',()=>{
  const a=sheetModel(make('aasimar',5),c);assert.equal(a.speciesResources.find(r=>r.nom==='Mains guérisseuses').valeur,'3d4 PV');
  assert.ok(!sheetModel(make('aasimar',1),c).speciesResources.some(r=>r.nom==='Révélation céleste'));
  const g=sheetModel(make('goliath',5,{speciesAncestry:'givre'}),c);assert.equal(g.speed,13.5);assert.equal(g.speciesResources[0].valeur,'3 utilisations');assert.match(g.speciesResources[0].details,/1d6/);assert.match(g.speciesResources[1].details,/16.5 m/);
  assert.equal(sheetModel(make('nain',5),c).speciesResources[0].valeur,'3 utilisations');
  assert.match(sheetModel(make('orc',5),c).speciesResources[0].details,/Repos court ou long/);
});

test('Seuls dix dons d’origines 2024 sont proposés à un humain ; Truand reste archivé',()=>{
  const s=make('humain');s.backgroundId='noble';assert.equal(humanFeats(s,c).length,10);
  assert.ok(!humanFeats(s,c).some(f=>f.id==='truand'));assert.equal(c.feats.find(f=>f.id==='truand').categorie,'archive');
});
