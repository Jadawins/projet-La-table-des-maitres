import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {buildCatalogue} from '../catalogue.mjs';
import {clericFixture,buildClericAudit} from '../audit/cleric-1-10.mjs';
import {clericProfile,finalScores,hitPoints,aptitudeErrors} from '../maquette/character-rules.mjs';
import {advancementInitial,evaluateProgression,sacredChoices,ADVANCEMENT_LEVELS,ORIGIN_SLOTS} from '../maquette/cleric-progression.mjs';
import {featChoiceErrors,featChoicesInitial} from '../maquette/feat-effects.mjs';
import {sheetModel,detailFields} from '../maquette/sheet-model.mjs';
import {renderSheet} from '../maquette/sheet-view.mjs';
import {characterSnapshot,validateSavedCharacter} from '../maquette/character-storage.mjs';
import {grantInitial,reconcileOrigins,grantedOriginSpells} from '../maquette/origin-rules.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/rules-mongodb.json',import.meta.url),'utf8'));
const c=buildCatalogue(snapshot);
const fixture=(level=20,domain='clerc_domaine_vie',vocation='Thaumaturge')=>clericFixture(c,level,domain,vocation);
const chooseBoon=(id,ability='SAG')=>{
  const s=fixture();
  s.advancements[19]={...advancementInitial(),mode:'feat',featId:id,featAbility:ability};
  return s;
};
for(const domain of c.subclasses.filter(s=>s.classe_parente==='clerc'))for(let level=11;level<=20;level++){
  test(`${domain.nom} · ${level} : les deux vocations sont complètes et relisibles`,()=>{
    for(const vocation of ['Protecteur','Thaumaturge']){
      const s=fixture(level,domain.id,vocation),profile=clericProfile(s,c),m=sheetModel(s,c);
      const saved=validateSavedCharacter(characterSnapshot(s),c);
      assert.deepEqual(m.errors,[]);
      assert.equal(saved.status,'ready');
      assert.deepEqual(JSON.parse(JSON.stringify(sheetModel(saved.character,c))),JSON.parse(JSON.stringify(m)));
      assert.deepEqual(saved.character.advancements,s.advancements);
      assert.equal(profile.proficiency,level<13?4:level<17?5:6);
      assert.ok(profile.always.every(spell=>!spell.unresolved&&spell.niveau<=profile.maxSpellLevel));
      assert.equal(m.magic.dc,8+m.proficiency+m.mods.SAG);
      assert.equal(m.magic.attack,m.proficiency+m.mods.SAG);
    }
  });
}
test('Les cinq paliers sont requis ; le niveau 19 accepte un don mais pas la branche directe',()=>{
  const s=fixture();
  assert.deepEqual(evaluateProgression(s,c,finalScores(s,c.backgrounds.find(b=>b.id===s.backgroundId))).rows.map(r=>r.level),[4,8,12,16,19]);
  for(const level of ADVANCEMENT_LEVELS){const copy=structuredClone(s);delete copy.advancements[level];assert.ok(aptitudeErrors(copy,c).some(e=>e.includes(`Niveau ${level}`)));}
  s.advancements[19]={...advancementInitial(),mode:'ability',abilities:['INT','CHA']};
  assert.ok(aptitudeErrors(s,c).some(e=>e.includes('Niveau 19')));
  s.advancements[19]={...advancementInitial(),mode:'feat',featId:'mobile',featAbility:'DEX'};
  assert.equal(validateSavedCharacter(s,c).status,'ready');
});
test('Faveurs à partir de 19, plafonds de 20 et 30 et augmentation réellement attribuée',()=>{
  const s=chooseBoon('faveur_de_memoire_magique');
  const p=evaluateProgression(s,c,finalScores(s,c.backgrounds.find(b=>b.id===s.backgroundId)));
  assert.ok(p.rows.slice(0,4).every(r=>!r.available.some(f=>f.prerequis?.niveau===19)));
  assert.equal(p.scores.SAG,21);
  const ordinary=structuredClone(s);ordinary.advancements[19]={...advancementInitial(),mode:'feat',featId:'observateur',featAbility:'SAG',choices:{...featChoicesInitial(),expertise:'Perception'}};
  assert.ok(aptitudeErrors(ordinary,c).some(e=>e.includes('dépasserait 20')));
  const scores={FOR:12,DEX:12,CON:15,INT:14,SAG:28,CHA:10};
  const only19=structuredClone(c);only19.classes.find(x=>x.id==='clerc').niveaux[4].amelioration=null;only19.classes.find(x=>x.id==='clerc').niveaux[8].amelioration=null;only19.classes.find(x=>x.id==='clerc').niveaux[12].amelioration=null;only19.classes.find(x=>x.id==='clerc').niveaux[16].amelioration=null;
  assert.equal(evaluateProgression(s,only19,{...scores,SAG:29}).scores.SAG,30);
  assert.ok(evaluateProgression(s,only19,{...scores,SAG:30}).issues.some(e=>e.includes('dépasserait 30')));
});
for(const feat of c.feats.filter(f=>f.prerequis?.niveau===19))test(`${feat.nom} : choix, effets et sauvegarde au niveau 20`,()=>{
  const s=chooseBoon(feat.id,feat.id==='faveur_de_vigueur'?'CON':feat.id==='faveur_de_vitesse'?'DEX':feat.id==='faveur_d_attaque_irresistible'||feat.id==='faveur_de_prowesse_martiale'?'FOR':'SAG');
  const choices=s.advancements[19].choices;
  if(feat.id==='faveur_de_competence')choices.expertise='Perception';
  if(feat.id==='faveur_de_resistance_aux_energies')choices.resistances=['feu','froid'];
  if(feat.id==='faveur_du_destin')choices.spell='guerison_de_groupe';
  if(feat.id==='faveur_du_destin'&&!c.spells.some(x=>x.id===choices.spell))choices.spell=c.spells.find(x=>x.niveau===9&&x.classes.includes('Clerc')).id;
  const saved=validateSavedCharacter(s,c),m=sheetModel(s,c);
  assert.equal(saved.status,'ready',saved.issues.join(' / '));
  assert.deepEqual(saved.character.advancements[19],s.advancements[19]);
  assert.ok(m.effects.summaries.some(f=>f.name===feat.nom));
  if(feat.id==='faveur_de_competence'){assert.equal(m.skills.filter(x=>x.trained).length,18);assert.equal(m.skills.find(x=>x.nom==='Perception').value,m.mods.SAG+12);}
  if(feat.id==='faveur_de_resistance_aux_energies')assert.ok(m.resistances.includes('feu')&&m.resistances.includes('froid'));
  if(feat.id==='faveur_de_vigueur')assert.equal(m.hp,263);
  if(feat.id==='faveur_de_vitesse')assert.equal(m.speed,18);
  if(feat.id==='faveur_de_vision_lucide')assert.equal(m.effects.trueSight,18);
  if(feat.id==='faveur_de_l_esprit_nocturne')assert.deepEqual(m.resistances,[]);
  if(feat.id==='faveur_du_destin')assert.ok(m.spells.some(x=>x.id===choices.spell&&x.source===feat.nom&&x.utilisation==='1_repos_long'));
});
test('Les choix épiques manquants, dupliqués ou hors liste sont signalés',()=>{
  for(const id of ['faveur_de_competence','faveur_de_resistance_aux_energies','faveur_du_destin'])assert.ok(featChoiceErrors(chooseBoon(id),c).length);
  const s=chooseBoon('faveur_de_resistance_aux_energies');s.advancements[19].choices.resistances=['feu','feu'];assert.ok(featChoiceErrors(s,c).length);s.advancements[19].choices.resistances=['feu','force'];assert.ok(featChoiceErrors(s,c).length);
  const spell=chooseBoon('faveur_du_destin');spell.advancements[19].choices.spell='souhait';assert.ok(featChoiceErrors(spell,c).length);
});
test('Les ressources 13/17/18 et les emplacements jusqu’au rang 9 proviennent de la BDD',()=>{
  for(const [level,pb,dice,channel,max]of [[11,4,'2d8',3,6],[13,5,'3d8',3,7],[17,6,'3d8',3,9],[18,6,'4d8',4,9],[20,6,'4d8',4,9]]){
    const s=fixture(level),p=clericProfile(s,c),m=sheetModel(s,c);
    assert.equal(p.proficiency,pb);assert.equal(p.sparkDice,dice);assert.equal(p.channel,channel);assert.equal(p.maxSpellLevel,max);
    assert.deepEqual(p.slots,c.classes.find(x=>x.id==='clerc').niveaux[level].emplacements_de_sort);
    assert.equal(m.classFeatures.find(f=>f.nom==='Canal divin').utilisations.initial,channel);
  }
});
test('Frappe consacrée améliorée conserve seulement l’option choisie et ne s’applique pas avant 14',()=>{
  for(const level of [13,14,20])for(const option of ['Frappe sacrée','Magie puissante']){
    const s=fixture(level);s.sacredStrike=option;
    const m=sheetModel(s,c),choice=sacredChoices(s,c).find(x=>x.nom===option);
    assert.equal(m.classFeatures.find(f=>f.nom==='Frappe consacrée').options.length,1);
    if(option==='Frappe sacrée')assert.equal(choice.effets[0].des,level>=14?'2d8':'1d8');
    if(level>=14){const improved=m.classFeatures.find(f=>f.nom==='Frappe consacrée améliorée');assert.equal(improved.effets.length,1);assert.ok(improved.description.includes(option));}
    else assert.ok(!m.classFeatures.some(f=>f.nom==='Frappe consacrée améliorée'));
  }
});
test('Les trois sorts mineurs offensifs suivent les seuils et les conditions de dégâts de la BDD',()=>{
  for(const [level,dice]of [[1,1],[5,2],[11,3],[17,4],[20,4]]){
    const s=fixture(level);s.cantrips=['flamme_sacree','glas','mot_de_radiance'];
    const m=sheetModel(s,c);
    assert.equal(m.spells.find(x=>x.id==='flamme_sacree').damageAtLevel,`${dice}d8 radiant`);
    assert.equal(m.spells.find(x=>x.id==='mot_de_radiance').damageAtLevel,`${dice}d6 radiant`);
    assert.equal(m.spells.find(x=>x.id==='glas').damageAtLevel,`${dice}d8 nécrotique (cible à plein PV) · ${dice}d12 nécrotique (cible blessée)`);
  }
});
test('PV temporaires de Magie puissante chiffrés pour les sorts de classe, sans augmenter les PV maximum',()=>{
  const s=fixture(20);s.cantrips[0]='glas';const m=sheetModel(s,c);
  const spell=m.spells.find(x=>x.id==='glas');assert.equal(spell.cantripBonus,5);assert.ok(spell.featRules.some(t=>t.includes('10 PV temporaires')));assert.equal(m.hp,203);
  assert.ok(m.classFeatures.some(f=>f.nom==='Grâce divine suprême'));assert.match(renderSheet(s,c),/Souhait/);
});
test('Les dons d’origine peuvent aussi être acquis aux niveaux 12, 16 et 19',()=>{
  const s=fixture(20);
  s.advancements[12]={...advancementInitial(),mode:'feat',featId:'doue'};
  s.advancements[16]={...advancementInitial(),mode:'feat',featId:'doue'};
  s.advancements[19]={...advancementInitial(),mode:'feat',featId:'initie_a_la_magie'};
  reconcileOrigins(s,c);
  s.originGrants.level12.proficiencies=['skill:acrobaties','skill:histoire','skill:investigation'];
  s.originGrants.level16.proficiencies=['skill:nature','skill:survie','skill:representation'];
  s.originGrants.level19={...grantInitial(),magicList:'Magicien',cantrips:['trait_de_feu','main_du_mage'],spell:'bouclier'};
  const pool=c.spells.filter(x=>x.niveau===0&&x.classes.includes('Magicien'));s.originGrants.level19.cantrips=pool.slice(0,2).map(x=>x.id);
  const saved=validateSavedCharacter(s,c);assert.equal(saved.status,'ready',saved.issues.join(' / '));assert.equal(grantedOriginSpells(s,c).filter(x=>x.source==='Don du niveau 19').length,3);
  assert.deepEqual(saved.character.originGrants,s.originGrants);
});
test('Un rechargement conserve tous les paliers, les résistances et le niveau 20',async()=>{
  const s=chooseBoon('faveur_de_resistance_aux_energies');s.advancements[19].choices.resistances=['feu','froid'];reconcileOrigins(s,c);
  const app=await readFile(new URL('../maquette/app.js',import.meta.url),'utf8');const setup=app.slice(0,app.indexOf('const esc =')).replace(/^import .*;\r?\n/gm,'');
  const result=JSON.parse(runInNewContext(setup+'\nJSON.stringify({draft,storageAvailable})',{document:{getElementById:()=>null,querySelector:()=>null},window:{addEventListener:()=>{}},localStorage:{getItem:()=>JSON.stringify(s)},grantInitial,advancementInitial,featChoicesInitial,detailFields,ADVANCEMENT_LEVELS,ORIGIN_SLOTS}));
  assert.equal(result.storageAvailable,true);assert.equal(result.draft.level,20);assert.deepEqual(result.draft.advancements,s.advancements);assert.deepEqual(result.draft.originGrants,s.originGrants);
});
test('Le rapport d’intégration couvre 80 lignes et 160 scénarios sans modifier les sources',()=>{
  const before=JSON.stringify(snapshot),a=buildClericAudit(snapshot,{maxLevel:20});
  assert.equal(a.rows.length,80);assert.equal(a.rows.flatMap(r=>r.variations).length,160);assert.ok(a.rows.every(r=>r.status==='integration_verifiee'&&!r.unlinkedSpells.length));assert.equal(JSON.stringify(snapshot),before);
});
test('Les PV physiques exigent les dix-neuf jets, sans génération ni modification des résultats',()=>{
  const s=fixture();s.hpMode='physical';s.hpRolls=Object.fromEntries(Array.from({length:19},(_,i)=>[i+2,1]));const before=structuredClone(s.hpRolls);
  assert.equal(hitPoints(s,c),127);assert.deepEqual(s.hpRolls,before);delete s.hpRolls[20];assert.equal(hitPoints(s,c),null);s.hpRolls[20]=9;assert.equal(hitPoints(s,c),null);
});
test('Redescendre sous 19 garde les choix en réserve sans appliquer les effets de la faveur',()=>{
  const s=chooseBoon('faveur_de_resistance_aux_energies');s.advancements[19].choices.resistances=['feu','froid'];assert.ok(sheetModel(s,c).resistances.includes('feu'));
  s.level=18;const p=clericProfile(s,c);s.cantrips=p.cantrips.slice(0,p.cantripCount).map(x=>x.id);s.prepared=p.prepared.slice(0,p.preparedCount).map(x=>x.id);
  assert.deepEqual(sheetModel(s,c).resistances,[]);assert.equal(validateSavedCharacter(s,c).status,'ready');assert.deepEqual(s.advancements[19].choices.resistances,['feu','froid']);
});
