import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {clericFixture,buildClericAudit} from '../audit/cleric-1-10.mjs';
import {clericProfile,finalScores,aptitudeErrors,hitPoints} from '../maquette/character-rules.mjs';
import {advancementInitial,evaluateProgression} from '../maquette/cleric-progression.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {validateSavedCharacter,characterSnapshot} from '../maquette/character-storage.mjs';
import {grantInitial,magicFeatProfile,originFeats,grantedOriginSpells} from '../maquette/origin-rules.mjs';
const snapshot=JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url),'utf8')),c=buildCatalogue(snapshot),bg=c.backgrounds.find(b=>b.id==='charlatan');
for(const domain of c.subclasses.filter(s=>s.classe_parente==='clerc'))for(let level=1;level<=10;level++)test(`${domain.nom} · niveau ${level} · les deux vocations sont créables et enregistrables`,()=>{
  for(const vocation of ['Protecteur','Thaumaturge']){
    const s=clericFixture(c,level,domain.id,vocation),m=sheetModel(s,c),saved=validateSavedCharacter(s,c);
    assert.deepEqual(m.errors,[]);assert.equal(saved.status,'ready');assert.equal(clericProfile(s,c).proficiency,level<5?2:level<9?3:4);
    assert.equal(m.magic.dc,8+m.proficiency+Math.floor((m.scores.SAG-10)/2));assert.equal(m.magic.attack,m.proficiency+Math.floor((m.scores.SAG-10)/2));
    assert.deepEqual(saved.character.advancements,s.advancements);assert.equal(saved.character.sacredStrike,s.sacredStrike);
  }
});
test('Les seuils 4 et 8 augmentent les caractéristiques et la Constitution recalcule tous les PV',()=>{
  const s=clericFixture(c,10,'clerc_domaine_vie'),m=sheetModel(s,c);assert.equal(m.scores.SAG,20);assert.equal(m.scores.CON,17);assert.equal(m.hp,103);assert.equal(m.magic.dc,17);
  s.hpMode='physical';s.hpRolls=Object.fromEntries(Array.from({length:9},(_,i)=>[i+2,1]));assert.equal(hitPoints(s,c),67);
});
test('Les deux branches d’amélioration permettent +2 au même score dans la limite de20',()=>{
  const s=clericFixture(c,4,'clerc_domaine_vie');s.advancements[4].abilities=['SAG','SAG'];assert.equal(finalScores(s,bg,c).SAG,20);assert.deepEqual(aptitudeErrors(s,c),[]);
  s.advancements[4]={...advancementInitial(),mode:'feat',featId:'amelioration_de_caracteristique',abilities:['SAG','SAG']};assert.equal(finalScores(s,bg,c).SAG,20);assert.deepEqual(aptitudeErrors(s,c),[]);
  s.scores.SAG=19;assert.ok(aptitudeErrors(s,c).some(e=>e.includes('dépasserait 20')));
});
test('Une faveur épique de niveau19 reste indisponible au palier4 d’un personnage20',()=>{
  const s=clericFixture(c,20,'clerc_domaine_vie'),p=evaluateProgression(s,c,finalScores(s,bg));assert.ok(!p.rows[0].available.some(f=>f.id==='faveur_de_vigueur'));assert.ok(p.rows.find(r=>r.level===19).available.some(f=>f.id==='faveur_de_vigueur'));
});
test('Résilient ajoute CON et sa sauvegarde avec la maîtrise courante',()=>{
  const s=clericFixture(c,5,'clerc_domaine_vie');s.advancements[4]={...advancementInitial(),mode:'feat',featId:'resilient',featAbility:'CON'};const m=sheetModel(s,c);assert.equal(m.scores.CON,16);assert.equal(m.saves.find(x=>x.ability==='CON').value,6);
});
test('Canal divin passe à 3 au niveau 6 et Éclat sacré à 2d8 au niveau 7, sans modifier la source',()=>{
  const before=JSON.stringify(c),s=clericFixture(c,10,'clerc_domaine_vie'),m=sheetModel(s,c);assert.equal(m.channel,3);assert.equal(m.sparkDice,'2d8');const channel=m.classFeatures.find(f=>f.nom==='Canal divin');assert.equal(channel.utilisations.initial,3);assert.equal(channel.effets_disponibles[0].jet.des,'2d8');assert.equal(JSON.stringify(c),before);
});
test('Les domaines2024 ne donnent pas les anciens sorts mineurs ou maîtrises inventées',()=>{
  let s=clericFixture(c,3,'clerc_domaine_lumiere');const p=clericProfile(s,c);assert.equal(p.automaticCantrips.length,0);assert.ok(p.cantrips.some(x=>x.id==='lumiere'));
  s=clericFixture(c,9,'clerc_domaine_ruse');const m=sheetModel(s,c);assert.equal(m.skills.find(x=>x.nom==='Discrétion').trained,false);assert.equal(m.skills.find(x=>x.nom==='Tromperie').value,4);assert.ok(!m.weaponTraining.includes('Rapière'));
});
test('Les dégâts de Mot de radiance suivent le seuil écrit dans la BDD et Magie puissante le choix réel',()=>{
  const s=clericFixture(c,7,'clerc_domaine_vie');s.cantrips[0]='mot_de_radiance';let m=sheetModel(s,c),spell=m.spells.find(s=>s.id==='mot_de_radiance');assert.equal(spell.damageAtLevel,'2d6 radiant');assert.equal(spell.cantripBonus,4);s.sacredStrike='Frappe sacrée';spell=sheetModel(s,c).spells.find(s=>s.id==='mot_de_radiance');assert.equal(spell.cantripBonus,null);
});
test('Les sorts corrigés sont reliés au catalogue et respectent leur rang',()=>{
  const s=clericFixture(c,10,'clerc_domaine_guerre');assert.ok(clericProfile(s,c).always.some(x=>x.id==='rayon_tracant'&&!x.unresolved));for(const d of c.subclasses.filter(x=>x.classe_parente==='clerc'))for(let level=3;level<=10;level++){const p=clericProfile(clericFixture(c,level,d.id),c);assert.ok(p.always.every(x=>!x.unresolved&&x.niveau<=p.maxSpellLevel));}
});
test('Le rapport couvre 40 lignes, 80 scénarios et distingue les paramètres manquants de source',()=>{
  const audit=buildClericAudit(snapshot);assert.equal(audit.rows.length,40);assert.equal(audit.rows.flatMap(r=>r.variations).length,80);assert.ok(audit.rows.every(r=>r.status==='integration_verifiee'));assert.ok(audit.rows.every(r=>!r.unlinkedSpells.length));
});
test('Un don d’origine pris au niveau 4 conserve ses propres choix de sorts sans changer le quota du clerc',()=>{
  const s=clericFixture(c,4,'clerc_domaine_vie');s.advancements[4]={...advancementInitial(),mode:'feat',featId:'initie_a_la_magie'};s.originGrants={...s.originGrants,human:grantInitial(),level4:{...grantInitial(),magicList:'Druide',magicAbility:'SAG'}};
  const grant=originFeats(s,c).find(g=>g.slot==='level4'),p=magicFeatProfile(s,c,grant);s.originGrants.level4.cantrips=p.cantrips.slice(0,2).map(x=>x.id);s.originGrants.level4.spell=p.spells[0].id;
  assert.deepEqual(aptitudeErrors(s,c),[]);assert.equal(clericProfile(s,c).cantripCount,5);assert.equal(grantedOriginSpells(s,c).filter(x=>x.source==='Don du niveau 4').length,3);
  const saved=validateSavedCharacter(s,c);assert.equal(saved.status,'ready');assert.deepEqual(saved.character.originGrants.level4,s.originGrants.level4);
});
test('Les anciennes sauvegardes sans champs de progression se comparent sans faux changement',()=>{
  const old=clericFixture(c,3,'clerc_domaine_vie');delete old.advancements;delete old.sacredStrike;old.originGrants={background:grantInitial(),human:grantInitial()};
  const restored={...old,advancements:{},sacredStrike:'',originGrants:{...old.originGrants,level4:grantInitial(),level8:grantInitial()}};
  assert.deepEqual(characterSnapshot(old),characterSnapshot(restored));
});
