import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {catalogue as c,setup,player} from './spell-fixture.mjs';import {classFixture} from '../audit/class-fixtures.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';import {pdfValues} from '../maquette/character-pdf.mjs';
import {COINS,copperTotal,validateCoins,validateWallet,priceInCopper,walletAction,suggestedPrice} from '../maquette/wallet-state.mjs';import {renderWallet} from '../maquette/wallet-view.mjs';
import {beginAdvancement,finishAdvancement} from '../maquette/character-advancement.mjs';import {completeAdvancement} from '../audit/advancement-fixture.mjs';
const coins=(po=0,rest={})=>({pc:0,pa:0,pe:0,po,pp:0,...rest});
const fixture=()=>classFixture(c,'clerc',3,'clerc_domaine_vie',{divineOrder:'Protecteur'});
const apply=(s,action,meta={id:randomUUID(),at:new Date().toISOString()})=>walletAction(s,sheetModel(s,c),c,action,meta);
const funded=(money=coins(100))=>({...fixture(),wallet:{version:1,coins:money,history:[]}});
const buy=(quantity=1,rest={})=>({kind:'buy',amount:'2',coin:'po',quantity,item:{id:randomUUID(),name:'Dague',description:'',catalogueRef:'weapon:dague'},...rest});

test('Sans bourse suivie, anciennes fiches inchangées et absence de nouveau champ au snapshot',()=>{
  const s=fixture(),m=sheetModel(s,c);assert.equal(Object.hasOwn(characterSnapshot(s),'wallet'),false);assert.equal(m.money.po,22);assert.equal(pdfValues(s,c).text.gp,22);
  assert.equal(validateSavedCharacter(s,c).character.wallet,undefined);
});
test('Premier mouvement : utilise l’argent de départ une seule fois, puis conserve le solde réel',()=>{
  const s=fixture(),next=apply(s,{kind:'receive',amount:'3',coin:'po'});assert.equal(sheetModel(next,c).money.po,25);assert.equal(s.wallet,undefined);
  const again=apply(next,{kind:'spend',amount:'2',coin:'po'});assert.equal(sheetModel(again,c).money.po,23);again.equipment='B';assert.equal(sheetModel(again,c).money.po,23);assert.equal(again.wallet.history.length,2);
});
test('Monnaies : valeurs exactes du cuivre au platine et décimales sans arrondi financier',()=>{
  assert.deepEqual(COINS,{pc:1,pa:10,pe:50,po:100,pp:1000});assert.equal(copperTotal(coins(1,{pp:1,pe:1,pa:1,pc:1})),1161);
  assert.equal(priceInCopper('0,29','po'),29);assert.equal(priceInCopper('2.50','pa'),25);assert.equal(priceInCopper('0.02','pe'),1);
  for(const [amount,coin]of [['0','po'],['-1','po'],['0.001','po'],['0.01','pe'],['1e3','po'],[{},'po'],['NaN','pc'],['1','bad'],['9999999999','pp']])assert.throws(()=>priceInCopper(amount,coin),e=>e.status===400);
});
test('Entrées de monnaie : préserve les pièces existantes, y compris l’électrum',()=>{
  const s=funded(coins(4,{pe:2,pc:3})),next=apply(s,{kind:'receive',amount:'3','coin':'pe'});assert.deepEqual(next.wallet.coins,coins(4,{pe:5,pc:3}));
  assert.deepEqual(apply(next,{kind:'receive',amount:'0.25',coin:'po'}).wallet.coins,coins(4,{pe:5,pa:2,pc:8}));
});
test('Dépense avec l’appoint : ne change pas les autres monnaies',()=>{
  const s=funded(coins(5,{pp:1,pe:2,pa:3,pc:4})),next=apply(s,{kind:'spend',amount:'2',coin:'po'});assert.deepEqual(next.wallet.coins,coins(3,{pp:1,pe:2,pa:3,pc:4}));
});
test('Pas d’appoint : exige un choix explicite, puis rend exactement la monnaie sans créer d’électrum',()=>{
  const s=funded(coins(0,{pp:1}));assert.throws(()=>apply(s,{kind:'spend',amount:'2',coin:'po'}),/appoint/);assert.deepEqual(s.wallet.coins,coins(0,{pp:1}));
  const next=apply(s,{kind:'spend',amount:'2',coin:'po',allowChange:true});assert.deepEqual(next.wallet.coins,coins(8));
  const electrum=apply(funded(coins(0,{pe:1})),{kind:'spend',amount:'1',coin:'pa',allowChange:true});assert.deepEqual(electrum.wallet.coins,coins(0,{pa:4}));
});
test('Rendu de monnaie : conserve la valeur pour un ensemble déterministe de bourses et de prix',()=>{
  for(let n=1;n<=100;n++){
    const money=coins(n%7,{pc:n%9,pa:n%11,pe:n%5,pp:n%3}),total=copperTotal(money),price=1+(n*17)%total;
    const next=apply(funded(money),{kind:'spend',amount:String(price),coin:'pc',allowChange:true});assert.equal(copperTotal(next.wallet.coins),total-price);assert.ok(Object.values(next.wallet.coins).every(v=>Number.isInteger(v)&&v>=0));
  }
});
test('Achat : quantité et prix total débité ensemble, arme reliée au catalogue mais non équipée automatiquement',()=>{
  const s=funded(),original=JSON.stringify(s),action=buy(3),next=apply(s,action);assert.equal(JSON.stringify(s),original);assert.equal(next.wallet.coins.po,94);assert.equal(next.inventoryItems[0].quantity,3);assert.equal(next.inventoryItems[0].catalogueRef,'weapon:dague');assert.deepEqual(sheetModel(next,c).attacks,sheetModel(s,c).attacks);assert.equal(next.wallet.history[0].kind,'buy');assert.equal(validateSavedCharacter(next,c).status,'ready');
});
test('Achat refusé : argent insuffisant, référence inconnue, trop d’objets ou quantité invalide ne modifient rien',()=>{
  const s=funded(coins(1)),original=JSON.stringify(s);assert.throws(()=>apply(s,buy(1)),/assez d’argent/);assert.equal(JSON.stringify(s),original);
  assert.throws(()=>apply(funded(),buy(0)),e=>e.status===400);assert.throws(()=>apply(funded(),buy(1,{item:{...buy().item,catalogueRef:'weapon:inconnue'}})),e=>e.status===400);
  const full=funded();full.inventoryItems=Array.from({length:100},()=>({id:randomUUID(),name:'Objet',quantity:1,description:''}));assert.throws(()=>apply(full,buy()),e=>e.status===400);assert.equal(full.wallet.coins.po,100);
});
test('Vente partielle et dernière unité : crédite le prix convenu, retire la quantité et déséquipe une arme épuisée',()=>{
  let s=apply(funded(),buy(3));const ref='item:'+s.inventoryItems[0].id;s.equipmentState={version:1,armor:'',shield:'',weapons:[ref]};
  s=apply(s,{kind:'sell',ref,quantity:2,amount:'1',coin:'po'});assert.equal(s.inventoryItems[0].quantity,1);assert.equal(s.wallet.coins.po,96);assert.deepEqual(s.equipmentState.weapons,[ref]);
  const next=apply(s,{kind:'sell',ref,quantity:1,amount:'1.50',coin:'po'});assert.deepEqual(next.inventoryItems,[]);assert.deepEqual(next.equipmentState.weapons,[]);assert.equal(copperTotal(next.wallet.coins),9750);assert.equal(validateSavedCharacter(next,c).status,'ready');
});
test('Vente du matériel initial : retire réellement l’armure et ses effets, sans réécrire les choix de création',()=>{
  const s=fixture(),model=sheetModel(s,c),armor=model.possessions.find(i=>i.armor?.classe_armure?.base);assert.ok(armor);
  const next=apply(s,{kind:'sell',ref:armor.ref,quantity:1,amount:'5',coin:'po'}),after=sheetModel(next,c);assert.equal(next.equipment,s.equipment);assert.equal(after.possessions.some(i=>i.ref===armor.ref),false);assert.equal(after.ac,10+after.mods.DEX+2);assert.equal(next.inventorySpent[armor.ref],1);assert.equal(validateSavedCharacter(next,c).status,'ready');
  assert.throws(()=>apply(next,{kind:'sell',ref:armor.ref,quantity:1,amount:'1',coin:'po'}),e=>e.status===400);
});
test('Vente : quantité indisponible ou référence étrangère refusée, prix négatif ou nul refusé',()=>{
  const s=apply(funded(),buy()),ref='item:'+s.inventoryItems[0].id;
  for(const action of [{kind:'sell',ref,quantity:2,amount:'1',coin:'po'},{kind:'sell',ref:'item:'+randomUUID(),quantity:1,amount:'1',coin:'po'},{kind:'sell',ref,quantity:1,amount:'-1',coin:'po'},{kind:'sell',ref,quantity:1,amount:'0',coin:'po'}])assert.throws(()=>apply(s,action),e=>e.status===400);
});
test('Prix suggérés : catalogue existant, demi-prix des armes/armures, objet libre et potion sans prix inventé',()=>{
  assert.deepEqual(suggestedPrice({catalogueRef:'weapon:dague'},c),{amount:'2',coin:'po',copper:200});assert.deepEqual(suggestedPrice({catalogueRef:'weapon:dague'},c,true),{amount:'1',coin:'po',copper:100});assert.equal(suggestedPrice({nom:'Épée +8'},c),null);assert.equal(suggestedPrice({catalogueRef:'potion:healing'},c),null);
});
test('Correction explicite : exige un motif et des comptes entiers, ne fabrique pas de pièces par arrondi',()=>{
  const s=funded();assert.throws(()=>apply(s,{kind:'adjust',coins:coins(3),label:' '}),e=>e.status===400);assert.throws(()=>apply(s,{kind:'adjust',coins:coins(-1),label:'Erreur'}),e=>e.status===400);
  const next=apply(s,{kind:'adjust',coins:coins(3,{pe:2,pa:4,pc:7}),label:'Solde de la feuille papier'});assert.deepEqual(sheetModel(next,c).money,coins(3,{pe:2,pa:4,pc:7}));assert.equal(next.wallet.history[0].kind,'adjust');
});
test('Validation : champs, bornes et continuité de l’historique, vingt derniers mouvements',()=>{
  for(const bad of [null,{},coins(1,{pc:-1}),coins(1,{pa:0.5}),coins(1,{pe:'1'}),coins(1_000_000_001)])assert.throws(()=>validateCoins(bad),e=>e.status===400);
  let s=funded();for(let n=0;n<25;n++)s=apply(s,{kind:'receive',amount:'1',coin:'pc'});assert.equal(s.wallet.history.length,20);assert.equal(s.wallet.coins.pc,25);assert.deepEqual(validateWallet(s.wallet),s.wallet);
  const bad=structuredClone(s.wallet);bad.history[1].before.pc=999;assert.throws(()=>validateWallet(bad),e=>e.status===400);const duplicate=structuredClone(s.wallet);duplicate.history[1].id=duplicate.history[0].id;assert.throws(()=>validateWallet(duplicate),e=>e.status===400);
  assert.throws(()=>apply(s,{kind:'receive',amount:'1',coin:'pc'},{id:s.wallet.history.at(-1).id,at:new Date().toISOString()}),e=>e.status===400);
});
test('PDF : les cinq monnaies sont les soldes en partie, pas les sommes de départ',()=>{
  const s=funded(coins(12,{pc:3,pa:4,pe:5,pp:6})),pdf=pdfValues(s,c).text;assert.deepEqual([pdf.cp,pdf.sp,pdf.ep,pdf.gp,pdf.pp],[3,4,5,12,6]);
});
test('Ancien client : conserve bourse et historique omis avec l’inventaire, sans rejouer le gain',async()=>{
  const t=await setup(),first=await t.characters.get(player.userId,t.id),next=apply(first.character,{kind:'receive',amount:'10',coin:'po'}),saved=await t.characters.save(player.userId,t.id,next,first.revision),old=structuredClone(first.character);old.details.story='Histoire actualisée';
  const updated=await t.characters.save(player.userId,t.id,old,saved.revision);assert.deepEqual(updated.character.wallet,next.wallet);assert.equal(updated.character.wallet.history.length,1);
});
test('Réponse perdue : même achat retenté sans seconde dépense ni doublon, conflit protège la version distante',async()=>{
  const t=await setup(),r=await t.characters.get(player.userId,t.id),next=apply(r.character,buy()),saved=await t.characters.save(player.userId,t.id,next,r.revision),repeat=await t.characters.save(player.userId,t.id,next,r.revision);assert.equal(repeat.revision,saved.revision);assert.equal(repeat.character.inventoryItems.length,1);assert.deepEqual(repeat.character.wallet,saved.character.wallet);
  const concurrent=apply(r.character,buy());await assert.rejects(t.characters.save(player.userId,t.id,concurrent,r.revision),e=>e.status===409);
});
test('Montée de niveau et multiclasse conservent la bourse une seule fois',()=>{
  let base=classFixture(c,'barbare',1,'',{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14}});base=apply(base,{kind:'receive',amount:'3',coin:'po'});const change=beginAdvancement(base,c,'guerrier'),next=finishAdvancement(change.base,completeAdvancement(change.base,change.candidate,c),c);assert.deepEqual(characterSnapshot(next).wallet,base.wallet);assert.equal(validateSavedCharacter(next,c).status,'ready');assert.deepEqual(sheetModel(next,c).money,base.wallet.coins);
});
test('Affichage : textes échappés, pas de commandes en lecture seule, conversion volontaire',()=>{
  const s=apply(funded(),{kind:'receive',amount:'1',coin:'po',label:'<script>butin</script>'}),model=sheetModel(s,c),html=renderWallet(s,model,c,{editable:true});assert.doesNotMatch(html,/<script>/);assert.match(html,/Faire la monnaie si nécessaire/);assert.doesNotMatch(renderWallet(s,model,c),/<form|<button/);
});
