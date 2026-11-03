import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {validateInventory,changeInventory} from '../maquette/inventory-state.mjs';import {renderInventory} from '../maquette/inventory-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';import {sheetModel} from '../maquette/sheet-model.mjs';import {renderSheet} from '../maquette/sheet-view.mjs';
import {pdfValues,createCharacterPDF} from '../maquette/character-pdf.mjs';import {PDFDocument} from '../maquette/assets/pdf-lib-1.17.1.mjs';
import {beginAdvancement,finishAdvancement} from '../maquette/character-advancement.mjs';import {completeAdvancement} from '../audit/advancement-fixture.mjs';import {classFixture} from '../audit/class-fixtures.mjs';
import {setup,catalogue,player,mj} from './spell-fixture.mjs';
const item=()=>({id:randomUUID(),name:'Boussole ancienne',quantity:2,description:'Offerte par le MJ.'});
test('Inventaire : ajout, modification et retrait par identifiant sans modifier l’état précédent',()=>{
  const first=item(),source=[first],added=changeInventory(source,{type:'add',item:item()});assert.equal(source.length,1);assert.equal(added.length,2);
  const edited=changeInventory(added,{type:'update',id:first.id,item:{...first,quantity:3}});assert.equal(edited[0].quantity,3);assert.equal(added[0].quantity,2);
  assert.equal(changeInventory(edited,{type:'remove',id:first.id}).length,1);assert.throws(()=>changeInventory(source,{type:'remove',id:randomUUID()}),e=>e.status===400);
});
test('Inventaire : types, identifiants, quantités, longueurs, doublons et volume bornés',()=>{
  const first=item();for(const bad of [null,{},[null],[{...first,id:'bad'}],[{...first,name:' '}],[{...first,name:'a'.repeat(121)}],[{...first,name:{$ne:null}}],[{...first,quantity:0}],[{...first,quantity:1.5}],[{...first,quantity:'2'}],[{...first,quantity:10000}],[{...first,description:'a'.repeat(2001)}],[first,first],Array.from({length:101},item),Array.from({length:30},()=>({...item(),description:'a'.repeat(2000)}))])assert.throws(()=>validateInventory(bad),e=>e.status===400);
  assert.deepEqual(validateInventory([{...first,name:' Objet ',description:' Note ',ownerId:'ignored'}]),[{...first,name:'Objet',description:'Note'}]);
});
test('Champ facultatif : anciens snapshots inchangés, sérialisation et validation des objets ajoutés',async()=>{
  const s=await setup(),record=await s.characters.get(player.userId,s.id);assert.equal(Object.hasOwn(characterSnapshot(record.character),'inventoryItems'),false);
  const state={...record.character,inventoryItems:[item()]},clean=validateSavedCharacter(characterSnapshot(state),catalogue);assert.equal(clean.status,'ready');assert.deepEqual(clean.character.inventoryItems,state.inventoryItems);
  clean.character.inventoryItems[0].quantity=10;assert.equal(state.inventoryItems[0].quantity,2);
});
test('Ancien client : conserve objets et suivi de partie omis, retrait explicite et conflit de révision',async()=>{
  const s=await setup(),record=await s.characters.get(player.userId,s.id),extra=item();
  const stored=await s.characters.save(player.userId,s.id,{...record.character,inventoryItems:[extra]},record.revision);
  const old=structuredClone(stored.character);delete old.inventoryItems;delete old.playState;old.details.story='Texte de l’ancien client';
  const updated=await s.characters.save(player.userId,s.id,old,stored.revision);assert.deepEqual(updated.character.inventoryItems,[extra]);assert.deepEqual(updated.character.playState,stored.character.playState);
  await assert.rejects(s.characters.save(player.userId,s.id,{...stored.character,inventoryItems:[]},stored.revision),e=>e.status===409);
  const cleared=await s.characters.save(player.userId,s.id,{...updated.character,inventoryItems:[]},updated.revision);assert.deepEqual(cleared.character.inventoryItems,[]);
});
test('Les possessions ajoutées ne changent ni calculs, ni matériel initial, ni attaques de la fiche',async()=>{
  const s=await setup(),record=await s.characters.get(player.userId,s.id),original=sheetModel(record.character,catalogue);
  const state={...record.character,inventoryItems:[{...item(),name:'Armure magique +3'}]};assert.deepEqual(JSON.parse(JSON.stringify(sheetModel(state,catalogue))),JSON.parse(JSON.stringify(original)));
  const html=renderSheet(state,catalogue,{savingEnabled:true});assert.match(html,/Armure magique \+3/);assert.match(html,/data-inventory-action="add"/);
  assert.doesNotMatch(renderInventory([{...item(),name:'<script>Objet</script>',description:'<img src=x>'}]),/<script>|<img/);assert.doesNotMatch(renderInventory([item()]),/<form|<button/);
});
test('Multiclasse et montée de niveau conservent une seule liste d’objets',()=>{
  const base=classFixture(catalogue,'barbare',1,'',{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14}});base.inventoryItems=[item()];
  const next=beginAdvancement(base,catalogue,'guerrier'),multi=finishAdvancement(next.base,completeAdvancement(next.base,next.candidate,catalogue),catalogue);
  assert.deepEqual(validateSavedCharacter(multi,catalogue).character.inventoryItems,base.inventoryItems);assert.equal(characterSnapshot(multi).inventoryItems.length,1);
  const before=pdfValues({...multi,inventoryItems:[]},catalogue).text.equipment;assert.equal(pdfValues(multi,catalogue).text.equipment,before+'\n2 × Boussole ancienne');
});
test('Une dépense de sort et son reçu conservent les objets du personnage',async()=>{
  const s=await setup(),record=await s.characters.get(player.userId,s.id),extra=item();await s.characters.save(player.userId,s.id,{...record.character,inventoryItems:[extra]},record.revision);
  const c=await s.prepare('soins');await s.approve(c);s.restart();await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1]});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const final=await s.characters.get(player.userId,s.id);assert.deepEqual(final.character.inventoryItems,[extra]);assert.equal(final.character.playState.slotUsed['spell-1'],1);
});
test('PDF fourni : objet et quantité persistés dans le champ équipement',async()=>{
  const state=classFixture(catalogue,'clerc',3,'clerc_domaine_vie',{divineOrder:'Protecteur'});state.inventoryItems=[item()];
  const source=JSON.stringify(state),template=await readFile(new URL('../maquette/assets/fiche-personnage-2024.pdf',import.meta.url)),pdf=await createCharacterPDF(state,catalogue,template),doc=await PDFDocument.load(pdf.bytes);
  assert.match(doc.getForm().getTextField('equipment').getText(),/2 × Boussole ancienne/);assert.equal(JSON.stringify(state),source);
});
