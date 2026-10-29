import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCatalogue} from '../catalogue.mjs';
import {originFixture} from '../audit/origin-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {backgroundItemName,backgroundKitOptions} from '../maquette/origin-rules.mjs';
const c=buildCatalogue(JSON.parse(await readFile(new URL('../tests/fixtures/rules-2024.json',import.meta.url))));
const references=JSON.parse(await readFile(new URL('../audit/background-reference-2024.json',import.meta.url)));

for(const ref of references)for(const choice of ['A','B'])test(`Historique ${ref.id} · équipement ${choice} indépendant de la classe`,()=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},ref.id,{equipment:'B',backgroundEquipment:choice});
  const before=JSON.stringify(s),m=sheetModel(s,c);
  assert.equal(JSON.stringify(s),before);
  assert.deepEqual(m.errors,[]);
  const result=validateSavedCharacter(characterSnapshot(s),c);
  assert.equal(result.status,'ready');
  assert.equal(result.character.backgroundEquipment,choice);
  const gold=ref.fields.equipement.find(i=>i.nom==="Pièces d'or")?.quantite||0;
  assert.equal(m.money.po,75+(choice==='B'?50:gold));
  if(choice==='B')assert.deepEqual(m.inventory,[]);
  else for(const item of ref.fields.equipement.filter(i=>i.nom!=="Pièces d'or")){
    const name=backgroundItemName(s,c,item.nom);
    assert.equal(m.inventory.find(i=>i.nom===name)?.quantity,item.quantite,name);
    assert.ok(!name.includes('au choix'));
  }
  const alternative=sheetModel({...s,backgroundEquipment:choice==='A'?'B':'A'},c);
  assert.deepEqual(m.skills,alternative.skills);
  assert.deepEqual(m.tools,alternative.tools);
  assert.deepEqual(m.feats,alternative.feats);
});

test('Une ancienne fiche sans choix reste intacte et doit préciser son équipement avant validation',()=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},'charlatan');delete s.backgroundEquipment;
  const before=JSON.stringify(s),r=validateSavedCharacter(characterSnapshot(s),c);
  assert.equal(JSON.stringify(s),before);assert.equal(r.status,'draft');
  assert.ok(r.issues.includes('Équipement d’historique à choisir.'));
  assert.equal(sheetModel(s,c).inventory.some(i=>i.source.includes('Historique')),false);
  assert.throws(()=>validateSavedCharacter({...s,backgroundEquipment:'C'},c),/invalide/);
});

test('Voyageur : boîte de jeux explicitement choisie, sans maîtrise supplémentaire',()=>{
  const s=originFixture(c,'barbare',1,{speciesId:'orc'},'voyageur');
  const kits=backgroundKitOptions(s,c);assert.ok(kits.length>1);
  const m=sheetModel(s,c);assert.ok(m.inventory.some(i=>i.nom===kits[0].name));
  assert.ok(!m.tools.includes(kits[0].name));
  s.backgroundKit='';assert.ok(validateSavedCharacter(s,c).issues.includes('Choisissez la boîte de jeux de votre équipement.'));
  s.backgroundEquipment='B';assert.ok(!validateSavedCharacter(s,c).issues.includes('Choisissez la boîte de jeux de votre équipement.'));
});
