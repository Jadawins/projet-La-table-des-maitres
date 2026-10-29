import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classProfile} from '../maquette/character-rules.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
// Independent transcription of the SRD 5.2.1 tables, pp. 48–49.
const table={
  Aride:{resistance:'feu',spells:['flou','mains_brulantes','trait_de_feu','boule_de_feu','fletrissement','mur_de_pierre']},
  Polaire:{resistance:'froid',spells:['immobilisation_de_personne','nappe_de_brouillard','rayon_de_givre','tempete_de_neige','tempete_de_grele','cone_de_froid']},
  Tempéré:{resistance:'foudre',spells:['foulee_brumeuse','poigne_electrique','sommeil','eclair','liberte_de_mouvement','passage_par_les_arbres']},
  Tropical:{resistance:'poison',spells:['aspersion_acide','rayon_empoisonneur','toile_d_araignee','nuage_nauseabond','metamorphose','fleau_d_insectes']}
};
for(const [terrain,expected]of Object.entries(table))for(let level=1;level<=20;level++)test(`Terre 2024 · ${terrain} · niveau ${level}`,()=>{
  const s=classFixture(c,'druide',level,'druide_cercle_terre');if(level>=3)s.classChoices.terrain=[terrain];
  const p=classProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  const before=JSON.stringify(s),m=sheetModel(s,c),saved=validateSavedCharacter(characterSnapshot(s),c);
  assert.equal(saved.status,'ready',saved.issues.join('; '));assert.deepEqual(m.errors,[]);assert.equal(JSON.stringify(s),before);
  const count=level<3?0:3+[5,7,9].filter(n=>n<=level).length;
  const granted=p.always.filter(x=>x.grantSource.startsWith('Sorts de terrain'));
  assert.deepEqual(granted.map(x=>x.id),expected.spells.slice(0,count));
  assert.equal(p.cantripCount,(level>=10?4:level>=4?3:2)+(s.classChoices.vocationnaturelle?.[0]==='Mage'?1:0));
  assert.ok(granted.every(x=>!p.prepared.some(y=>y.id===x.id)&&!p.cantrips.some(y=>y.id===x.id)));
  if(level>=3){
    const power=m.classResources.find(r=>r.nom==='Aval de la terre');assert.equal(power.valeur,level>=14?'4d6':level>=10?'3d6':'2d6');
    assert.equal(m.classResources.find(r=>r.nom==='DD d’Aval de la terre').valeur,8+m.proficiency+m.mods.SAG);
    const spell=m.spells.find(x=>x.id===expected.spells[2]);assert.equal(spell.ability,'SAG');assert.equal(spell.dc,m.magic.dc);
    assert.deepEqual(classChoiceSpecs(s,c).find(x=>x.key==='terrain').options.map(x=>x.id),Object.keys(table));
  }
  if(level>=6)assert.equal(m.classResources.find(r=>r.nom==='Ressourcement').valeur,Math.ceil(level/2)+' niveaux');
  else assert.ok(!m.classResources.some(r=>r.nom==='Ressourcement'));
  assert.equal(m.resistances.includes(expected.resistance),level>=10);assert.deepEqual(m.immunities,level>=10?['Empoisonné']:[]);
  assert.equal(m.classResources.some(r=>r.nom==='Sanctuaire de dame Nature'),level>=14);
  assert.ok(!m.subclassFeatures.some(f=>['Sort mineur naturel','Foulée de la terre','Esprit de la nature'].includes(f.nom)));
  assert.doesNotThrow(()=>renderSheet(s,c));
});

test('Un ancien terrain demande un choix explicite ; aucune conversion automatique',()=>{
  const s=classFixture(c,'druide',10,'druide_cercle_terre');s.classChoices.terrain=['Arctique'];const before=JSON.stringify(s);
  const r=validateSavedCharacter(characterSnapshot(s),c);assert.equal(r.status,'draft');assert.equal(JSON.stringify(s),before);
  assert.ok(!classProfile(s,c).always.some(x=>x.grantSource.startsWith('Sorts de terrain')));
});

test('Les sorts mineurs de terrain bénéficient des aptitudes de Druide',()=>{
  const s=classFixture(c,'druide',15,'druide_cercle_terre');s.classChoices.terrain=['Aride'];s.classChoices.elementalStrike=['Magie puissante'];
  const m=sheetModel(s,c),spell=m.spells.find(x=>x.id==='trait_de_feu');assert.equal(spell.cantripBonus,m.mods.SAG);
  assert.ok(spell.featRules.some(x=>x.includes('90 m')));
});

test('Forme animale : durée arrondie et conservation des paramètres du personnage',()=>{
  const m=sheetModel(classFixture(c,'druide',5,'druide_cercle_terre'),c);
  assert.ok(m.classResources.find(r=>r.nom==='Forme animale').details.includes('durée 2 heures'));
  const rules=c.classes.find(x=>x.id==='druide').niveaux[2].capacites.find(x=>x.nom==='Forme animale').effets[0].regles;
  assert.ok(rules.profil.includes('points de vie')||rules.profil.includes('PV'));assert.ok(rules.objets.includes('fusionné sans effet'));
});

test('Tempête de grêle : fiche 2024 distincte de Tempête de neige',()=>{
  const spell=c.spells.find(x=>x.id==='tempete_de_grele');assert.equal(spell.niveau,4);assert.equal(spell.ecole,'Évocation');
  assert.equal(spell.concentration,false);assert.equal(spell.duree,'instantanée');assert.equal(spell.portee,'90 m');
  assert.deepEqual(spell.zone,{forme:'cylindre',rayon_m:6,hauteur_m:12});assert.deepEqual(spell.degats,[{type:'contondants',valeur:'2d10'},{type:'froid',valeur:'4d6'}]);
  assert.ok(spell.niveau_superieur.includes('1d10'));assert.equal(spell.composantes.M,'une moufle');
});
