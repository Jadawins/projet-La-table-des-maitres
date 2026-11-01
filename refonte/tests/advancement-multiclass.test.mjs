import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogue} from '../catalogue.mjs';
import {classFixture} from '../audit/class-fixtures.mjs';
import {classChoiceSpecs} from '../maquette/class-profiles.mjs';
import {classProfile,classSkills,finalScores} from '../maquette/character-rules.mjs';
import {sacredChoices} from '../maquette/cleric-progression.mjs';
import {validateSavedCharacter,characterSnapshot} from '../maquette/character-storage.mjs';
import {sheetModel} from '../maquette/sheet-model.mjs';
import {applyPlayAction,playView} from '../maquette/play-state.mjs';
import {beginAdvancement,advancementContext,advancementErrors,finishAdvancement} from '../maquette/character-advancement.mjs';
import {classRecords,multiclassPrerequisites,multiclassSlots} from '../maquette/multiclass-rules.mjs';
import {pdfValues} from '../maquette/character-pdf.mjs';

const c=buildCatalogue(JSON.parse(fs.readFileSync(new URL('./fixtures/rules-2024.json',import.meta.url),'utf8')));
export function completeAdvancement(base,candidate,catalogue=c){
  let context=advancementContext(base,candidate,catalogue),s=context.candidate,view=context.catalogue;
  if(s.classId==='clerc'&&!s.divineOrder)s.divineOrder='Protecteur';
  if(s.level>=3&&!s.subclassId)s.subclassId=c.subclasses.find(row=>row.classe_parente===s.classId).id;
  const skills=classSkills(s,view);if(s.classSkills.length!==skills.count)s.classSkills=skills.options.slice(0,skills.count);
  if(s.hpMode!=='fixed')s.hpRolls[s.level]=3;
  const row=view.classes.find(row=>row.id===s.classId).niveaux[s.level];
  if(row.amelioration&&!s.advancements[s.level]){
    const scores=finalScores(s,view.backgrounds.find(b=>b.id===s.backgroundId),view),abilities=[];
    for(let n=0;n<2;n++){const ability=Object.keys(scores).sort((a,b)=>scores[a]-scores[b]).find(a=>scores[a]<20);abilities.push(ability);scores[ability]++;}
    s.advancements[s.level]=row.amelioration.type==='don'?{mode:'feat',featId:'faveur_de_vigueur',featAbility:'CON',abilities:[],notes:'',choices:{}}:{mode:'ability',abilities,featId:'',featAbility:'',notes:'',choices:{}};
  }
  if(sacredChoices(s,view).length&&!s.sacredStrike)s.sacredStrike=sacredChoices(s,view)[0].nom;
  for(let pass=0;pass<4;pass++){
    context=advancementContext(base,s,catalogue);s=context.candidate;view=context.catalogue;
    for(const spec of classChoiceSpecs(s,view)){
      const picked=s.classChoices[spec.key]||[];
      if(spec.kind==='names'){s.classChoices[spec.key]=Array.from({length:spec.count},(_,i)=>picked[i]||'Langue '+i);continue;}
      if(spec.kind==='number'){s.classChoices[spec.key]=[picked[0]||'0'];continue;}
      const valid=picked.filter(id=>spec.options.some(row=>row.id===id));
      if(spec.key==='spellbook'&&s.level>=18){
        const required=[...spec.options.filter(o=>c.spells.find(x=>x.id===o.id)?.niveau===2).slice(0,1),...spec.options.filter(o=>c.spells.find(x=>x.id===o.id)?.niveau===3).slice(0,2)].map(o=>o.id);
        for(const id of required)if(!valid.includes(id))valid.push(id);
      }
      s.classChoices[spec.key]=[...valid,...spec.options.map(row=>row.id).filter(id=>!valid.includes(id))].slice(0,spec.count);
    }
  }
  const p=classProfile(s,view);
  for(const [key,pool,count]of [['cantrips',p.cantrips,p.cantripCount],['prepared',p.prepared,p.preparedCount]]){
    const old=s[key].filter(id=>pool.some(row=>row.id===id));s[key]=[...old,...pool.map(row=>row.id).filter(id=>!old.includes(id))].slice(0,count);
  }
  return s;
}
const fixture=(id,level=1)=>classFixture(c,id,level,c.subclasses.find(row=>row.classe_parente===id).id,{scores:{FOR:14,DEX:14,CON:14,INT:14,SAG:14,CHA:14},...(id==='clerc'?{divineOrder:'Protecteur'}:{})});

for(const first of c.classes)for(const second of c.classes.filter(row=>row.id!==first.id))test(`Multiclassage ${first.nom} 1 / ${second.nom} 1 : choix, fiche et sauvegarde`,()=>{
  const state=fixture(first.id),original=JSON.stringify(state);
  const {base,candidate}=beginAdvancement(state,c,second.id),ready=completeAdvancement(base,candidate);
  assert.deepEqual(advancementErrors(base,ready,c),[]);
  const result=finishAdvancement(base,ready,c),model=sheetModel(result,c);
  assert.equal(result.level,2);assert.equal(result.classId,first.id);assert.equal(model.proficiency,2);assert.equal(classRecords(result).length,2);
  assert.equal(model.errors.length,0,model.errors.join('; '));assert.deepEqual(validateSavedCharacter(result,c).character,result);
  assert.equal(JSON.stringify(state),original);assert.equal(model.inventory.length,sheetModel(state,c).inventory.length,'No second starting equipment');
  assert.equal(model.saves.filter(s=>s.trained).length,2,'Secondary classes do not grant base saving throws');
});
test('Prérequis de toutes les classes, alternative du guerrier, limite totale et aucune conversion implicite',()=>{
  const s=fixture('barbare',3);s.scores.FOR=12;
  assert(multiclassPrerequisites(s,c,'druide').some(e=>e.includes('Barbare')));
  assert.throws(()=>beginAdvancement(s,c,'druide'),/13 requis/);
  assert.equal(beginAdvancement(s,c).candidate.level,4);
  const f=fixture('guerrier');f.scores.FOR=10;f.scores.DEX=14;assert.deepEqual(multiclassPrerequisites(f,c,'roublard'),[]);
  assert.throws(()=>beginAdvancement(fixture('barbare',20),c),/20/);
  assert.equal(characterSnapshot(s).multiclass,undefined);
});
test('Passage 3 → 4 : CON rétroactive, maintien des choix et choix des PV actuels',()=>{
  const s=fixture('barbare',3),old=sheetModel(s,c);s.playState=applyPlayAction(s,old,{type:'start',currentHp:10});
  const {base,candidate}=beginAdvancement(s,c);candidate.advancements[4]={mode:'ability',abilities:['CON','CON'],featId:'',featAbility:'',notes:'',choices:{}};
  const next=completeAdvancement(base,candidate);next.advancements[4]=candidate.advancements[4];
  const kept=finishAdvancement(base,next,c),grown=finishAdvancement(base,next,c,'increase');
  assert.equal(sheetModel(kept,c).hp-old.hp,13,'7 + new CON 3, plus retroactive 1 per old level');
  assert.equal(playView(kept,sheetModel(kept,c)).currentHp,10);assert.equal(playView(grown,sheetModel(grown,c)).currentHp,23);
  next.scores.FOR++;assert(advancementErrors(base,next,c).length);
});
test('La montée ne soigne pas les personnages à zéro PV ou morts et ne restaure pas les réserves',()=>{
  for(const dead of [false,true]){
    const s=fixture('barbare',3),m=sheetModel(s,c);s.playState=applyPlayAction(s,m,{type:'start',currentHp:0});s.playState.used.rage=1;
    s.playState=applyPlayAction(s,m,dead?{type:'declare-dead',confirmed:true}:{type:'death-roll',die:1});
    const {base,candidate}=beginAdvancement(s,c);const next=finishAdvancement(base,completeAdvancement(base,candidate),c,'increase');
    assert.equal(playView(next,sheetModel(next,c)).currentHp,0);assert.equal(next.playState.used.rage,1);assert.deepEqual(next.playState.deathSaves,s.playState.deathSaves);
  }
});
test('Barbare 3 / Guerrier 1 : PV secondaires non maximisés, dés distincts et repos',()=>{
  const s=fixture('barbare',3),{base,candidate}=beginAdvancement(s,c,'guerrier');
  candidate.hpMode='physical';candidate.hpRolls[1]=2;const ready=completeAdvancement(base,candidate);ready.hpRolls[1]=2;
  const result=finishAdvancement(base,ready,c),m=sheetModel(result,c);
  assert.equal(m.hp,sheetModel(s,c).hp+4);assert.deepEqual(m.hitDiceGroups,[{die:'1d12',max:3},{die:'1d10',max:1}]);
  result.playState=applyPlayAction(result,m,{type:'start',currentHp:10});
  result.playState=applyPlayAction(result,m,{type:'short-rest',confirmed:true,hitDiceByType:{'1d12':1,'1d10':1},healing:8});
  assert.deepEqual(result.playState.hitDiceUsedByType,{'1d12':1,'1d10':1});assert.equal(playView(result,m).currentHp,18);
  assert.throws(()=>applyPlayAction(result,m,{type:'short-rest',confirmed:true,hitDiceByType:{'1d10':1},healing:3}),/assez/);
  result.playState=applyPlayAction(result,m,{type:'long-rest',confirmed:true});assert.equal(result.playState.hitDiceUsed,0);
  assert.match(pdfValues(result,c).text['hd-max'],/3d12 \+ 1d10/);
});
test('Emplacements communs, arrondi 2024 des demi-incantateurs, pacte séparé et sorts préparés par classe',()=>{
  const bard=fixture('barde',3),{base,candidate}=beginAdvancement(bard,c,'paladin');
  const result=finishAdvancement(base,completeAdvancement(base,candidate),c),slots=multiclassSlots(result,c);
  assert.equal(slots.casterLevel,4);assert.deepEqual(slots.slots,{1:4,2:3});
  const warlock=fixture('occultiste',3),change=beginAdvancement(warlock,c,'clerc');
  const mixed=finishAdvancement(change.base,completeAdvancement(change.base,change.candidate),c),model=sheetModel(mixed,c);
  assert.deepEqual(model.slots,{1:2});assert.deepEqual(model.pactSlots,{2:2});
  mixed.playState=applyPlayAction(mixed,model,{type:'start',currentHp:model.hp});
  for(const slot of playView(mixed,model).slots)mixed.playState=applyPlayAction(mixed,model,{type:'spend-slot',slot:slot.id,amount:1});
  mixed.playState=applyPlayAction(mixed,model,{type:'short-rest',confirmed:true,hitDice:0,healing:0});
  const view=playView(mixed,model);assert.equal(view.slots.find(s=>s.id==='pact').remaining,2);assert.equal(view.slots.find(s=>s.id==='spell-1').remaining,1);
  assert(model.spells.some(s=>s.ability==='CHA'));assert(model.spells.some(s=>s.ability==='SAG'));
});
test('Une troisième classe conserve les précédentes et les données incohérentes sont refusées',()=>{
  const s=fixture('barbare',3),one=beginAdvancement(s,c,'guerrier');const dual=finishAdvancement(one.base,completeAdvancement(one.base,one.candidate),c);
  const two=beginAdvancement(dual,c,'roublard');const triple=finishAdvancement(two.base,completeAdvancement(two.base,two.candidate),c);
  assert.equal(sheetModel(triple,c).proficiency,3);assert.equal(triple.multiclass.classes.length,3);
  const bad=structuredClone(triple);bad.multiclass.classes[0].level=2;assert.throws(()=>validateSavedCharacter(bad,c),/total/);
});
for(const sub of c.subclasses)test(`Montée 2 → 3 et choix de sous-classe : ${sub.nom}`,()=>{
  const s=fixture(sub.classe_parente,2),{base,candidate}=beginAdvancement(s,c);candidate.subclassId=sub.id;
  const ready=completeAdvancement(base,candidate),errors=advancementErrors(base,ready,c);assert.deepEqual(errors,[]);
  const result=finishAdvancement(base,ready,c);assert.equal(result.subclassId,sub.id);assert.equal(sheetModel(result,c).errors.length,0);
});
function combined(first,firstLevel,second,secondLevel,firstSubclass,secondSubclass){
  const a=fixture(first,firstLevel),b=fixture(second,secondLevel);if(firstSubclass)a.subclassId=firstSubclass;if(secondSubclass)b.subclassId=secondSubclass;
  const copy=s=>Object.fromEntries(['classId','level','subclassId','divineOrder','classSkills','cantrips','prepared','hpMode','hpRolls','advancements','originGrants','classChoices','sacredStrike'].map(k=>[k,structuredClone(s[k]??'')]));
  a.multiclass={version:1,sequence:[...Array(firstLevel).fill(first),...Array(secondLevel).fill(second)],classes:[copy(a),copy(b)],armorClassSource:first};a.level=firstLevel+secondLevel;
  return a;
}
test('Attaque supplémentaire ne se cumule pas et le niveau total ne débloque pas les aptitudes de classe',()=>{
  const low=combined('barbare',3,'guerrier',2);assert.equal(sheetModel(low,c).attacksPerAction,1);
  const dual=combined('barbare',5,'guerrier',5);assert.equal(sheetModel(dual,c).attacksPerAction,2);
  const fighter=combined('guerrier',11,'barbare',5);assert.equal(sheetModel(fighter,c).attacksPerAction,3);
});
test('Demi-incantateurs et tiers-incantateurs se combinent selon les niveaux propres',()=>{
  assert.equal(multiclassSlots(combined('barde',3,'rodeur',4),c).casterLevel,5);
  assert.deepEqual(multiclassSlots(combined('barde',3,'rodeur',4),c).slots,{1:4,2:3,3:2});
  assert.deepEqual(multiclassSlots(combined('paladin',1,'rodeur',1),c).slots,{1:3});
  const arcane=c.subclasses.find(s=>s.classe_parente==='guerrier'&&s.id.includes('occulte')).id;
  assert.equal(multiclassSlots(combined('guerrier',4,'magicien',2,arcane),c).casterLevel,3);
  assert.deepEqual(multiclassSlots(combined('guerrier',4,'barbare',2,arcane),c).slots,{1:3});
});
test('Les ASI de plusieurs classes appliquent la Constitution à tous les niveaux et partagent les prérequis',()=>{
  const s=combined('barbare',4,'clerc',4);s.multiclass.classes[0].advancements[4].abilities=['CON','CON'];s.multiclass.classes[1].advancements[4].abilities=['CON','CON'];
  const m=sheetModel(s,c);assert.equal(m.scores.CON,19);assert.equal(m.mods.CON,4);
  assert.equal(m.hp,12+3*7+4*5+8*4);
  const malicious=structuredClone(s);malicious.playState={version:1,hpLost:-5,tempHp:0,used:{}};assert.throws(()=>validateSavedCharacter(malicious,c),/invalide/);
});
test('Les sorts mineurs progressent avec le niveau total, sans débloquer des sorts de classe supérieurs',()=>{
  const s=combined('occultiste',2,'barde',3);s.multiclass.classes[0].cantrips=['decharge_occulte','illusion_mineure'];
  const m=sheetModel(s,c),blast=m.spells.find(s=>s.id==='decharge_occulte');assert(blast);assert(blast.featRules.some(r=>r.includes('2 rayon')));
  assert.equal(m.magicProfiles.length,2);assert.equal(m.proficiency,3);
});
for(const sub of c.subclasses)test(`Progression successive 1 → 20 : ${sub.nom}`,()=>{
  let state=fixture(sub.classe_parente);
  for(let level=2;level<=20;level++){
    const {base,candidate}=beginAdvancement(state,c);if(level===3)candidate.subclassId=sub.id;
    const ready=completeAdvancement(base,candidate),errors=advancementErrors(base,ready,c);
    assert.deepEqual(errors,[],sub.nom+' niveau '+level);
    state=finishAdvancement(base,ready,c);assert.equal(state.level,level);
    if(level>=3)assert.equal(state.subclassId,sub.id);
  }
});
