import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classProfile} from '../maquette/character-rules.mjs';
import {shapePool} from '../maquette/class-profiles.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
const spells={lune:[['soins','rayon_de_lune','poussiere_d_etoile'],['invocation_d_animaux'],['flux_de_lune'],['soins_de_groupe']],mers:[['nappe_de_brouillard','bourrasque','rayon_de_givre','fracassement','vague_tonnante'],['eclair','respiration_aquatique'],['controle_de_leau','tempete_de_grele'],['invocation_d_elementaire','immobilisation_de_monstre']]};
for(const circle of ['lune','mers','astres'])for(let level=1;level<=20;level++)test(`Cercle ${circle} 2024 · niveau ${level}`,()=>{
  const s=classFixture(c,'druide',level,'druide_cercle_'+circle),before=JSON.stringify(s),p=classProfile(s,c),m=sheetModel(s,c);
  assert.deepEqual(m.errors,[]);assert.equal(validateSavedCharacter(characterSnapshot(s),c).status,'ready');assert.equal(JSON.stringify(s),before);assert.doesNotThrow(()=>renderSheet(s,c));
  if(level<3)return;
  if(circle in spells){const expected=spells[circle].filter((_,i)=>[3,5,7,9][i]<=level).flat();for(const id of expected){assert.ok(p.always.some(x=>x.id===id),id);assert.ok(!p.prepared.some(x=>x.id===id));assert.ok(!p.cantrips.some(x=>x.id===id));}}
  if(circle==='lune'){
    const pool=shapePool(s,c);assert.ok(pool.every(x=>x.type==='Beast'&&x.fp_numerique<=Math.floor(level/3)));if(level<8)assert.ok(pool.every(x=>!x.vitesse?.vol));
    assert.ok(m.classResources.find(x=>x.nom==='Forme animale').details.includes(3*level+' PV temporaires'));
    assert.equal(m.classResources.find(x=>x.nom==='Formes lunaires').valeur,13+m.mods.SAG);
    assert.equal(m.classResources.some(x=>x.nom==='Pas de lune'),level>=10);assert.equal(m.classResources.some(x=>x.nom==='Forme lunaire'),level>=14);
    assert.ok(!m.subclassFeatures.some(x=>/élémentaire|Transformations multiples|Maître métamorphe/.test(x.nom)));
  }
  if(circle==='mers'){
    assert.equal(m.swim,level>=6?m.speed:null);assert.deepEqual(m.immunities,[]);assert.deepEqual(m.resistances,[]);
    assert.equal(m.classResources.find(x=>x.nom==='Colère des mers').valeur,Math.max(1,m.mods.SAG)+'d6');
    assert.equal(m.classResources.find(x=>x.nom==='DD de Colère des mers').valeur,m.magic.dc);
    assert.equal(m.classResources.some(x=>x.nom==='Enfant de la tempête'),level>=10);
    assert.ok(!m.spells.some(x=>x.featRules.some(r=>r.includes('Maître des flots'))));
  }
  if(circle==='astres'){
    const map=p.always.filter(x=>x.grantSource.startsWith('Carte stellaire'));assert.deepEqual(map.map(x=>x.id),['assistance','rayon_tracant']);
    assert.equal(p.extraSpells.some(x=>['amelioration_caracteristique','clairvoyance','divination'].includes(x.id)),false);
    assert.equal(m.classResources.find(x=>x.nom==='Rayon traçant gratuit').valeur,Math.max(1,m.mods.SAG)+' utilisations');
    assert.equal(m.classResources.find(x=>x.nom==='Archer stellaire').valeur,(level>=10?'2d8':'1d8')+' + '+m.mods.SAG);
    assert.equal(m.classResources.some(x=>x.nom==='Présage cosmique'),level>=6);assert.equal(m.classResources.some(x=>x.nom==='Dragon stellaire'),level>=10);
    assert.deepEqual(m.immunities,[]);assert.deepEqual(m.resistances,[]);
  }
});
test('Sorts lunaires : niveaux et règles des deux entrées retrouvées, plus le sort manquant',()=>{
  const wisp=c.spells.find(x=>x.id==='poussiere_d_etoile'),fount=c.spells.find(x=>x.id==='flux_de_lune'),beam=c.spells.find(x=>x.id==='rayon_de_lune');
  assert.deepEqual(wisp.classes,['Barde','Druide']);assert.ok(wisp.description.replace(/\s+/g,' ').includes('fin de votre tour suivant'));
  assert.equal(fount.niveau,4);assert.equal(fount.degats[0].valeur,'2d6');assert.ok(fount.description.includes('visible'));
  assert.equal(beam.niveau,2);assert.equal(beam.degats[0].valeur,'2d10');assert.deepEqual(beam.zone,{forme:'cylindre',rayon_m:1.5,hauteur_m:12});assert.ok(beam.description.includes('une fois par tour'));
});
