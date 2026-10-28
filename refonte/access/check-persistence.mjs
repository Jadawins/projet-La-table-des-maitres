import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createCharacterStore} from './character-store.mjs';
import {validateSavedCharacter} from './atelier/character-storage.mjs';
import {clericProfile,classProfile,classSkills} from './atelier/character-rules.mjs';
import {classChoiceSpecs,supportedClasses} from './atelier/class-profiles.mjs';
import {classFixture} from './check-class-fixture.mjs';
import {originCases,originFixture} from './check-origin-fixture.mjs';
import {advancementInitial} from './atelier/cleric-progression.mjs';
import {readFile} from 'node:fs/promises';
const {MongoClient}=createRequire('/var/www/myrpgtable/app/api/package.json')('mongodb');
const client=new MongoClient(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});await client.connect();
const collection=client.db('myrpgtable').collection('refonte_controles');
const owner='verification-'+randomUUID(),id=randomUUID();
const catalogue=JSON.parse(await readFile(new URL('./atelier/catalogue.json',import.meta.url),'utf8'));
const store=createCharacterStore({collection,validate:s=>validateSavedCharacter(s,catalogue),catalogueFingerprint:'controle-technique'});
const s={name:'Contrôle temporaire de sauvegarde',level:3,classId:'clerc',speciesId:'humain',backgroundId:'charlatan',equipment:'A',statsMethod:'physical',hpMode:'fixed',scores:{FOR:12,DEX:11,CON:14,INT:14,SAG:18,CHA:9},classSkills:[],cantrips:[],prepared:[],rolls:[],bonusMode:'three',details:{story:'Contrôle de conservation'}};
try{
  await collection.createIndex({user_id:1,client_id:1},{unique:true});
  const saved=await store.save(owner,id,s,0),retry=await store.save(owner,id,s,0);
  if(saved.revision!==1||retry.revision!==1)throw new Error('Idempotence failed');
  const read=await store.get(owner,id);if(read.character.details.story!==s.details.story)throw new Error('Readback failed');
  s.details.story='Contrôle de mise à jour';const updated=await store.save(owner,id,s,1);if(updated.revision!==2)throw new Error('Update failed');
  if((await store.list('other-'+owner)).length)throw new Error('Isolation failed');
  Object.assign(s,{level:10,divineOrder:'Thaumaturge',speciesSize:'M',speciesSkill:'Perception',originFeatId:'robuste',classSkills:['Médecine','Religion'],sacredStrike:'Magie puissante',advancements:{4:{...advancementInitial(),mode:'ability',abilities:['SAG','CON']},8:{...advancementInitial(),mode:'ability',abilities:['SAG','CON']}}});
  let revision=2;
  for(const domain of catalogue.subclasses.filter(x=>x.classe_parente==='clerc')){
    s.subclassId=domain.id;const profile=clericProfile(s,catalogue);
    s.cantrips=profile.cantrips.slice(0,profile.cantripCount).map(x=>x.id);s.prepared=profile.prepared.slice(0,profile.preparedCount).map(x=>x.id);
    const saved=await store.save(owner,id,s,revision++),read=await store.get(owner,id);
    if(saved.status!=='ready'||read.character.sacredStrike!=='Magie puissante'||read.character.advancements[8].abilities[0]!=='SAG')throw new Error('Cleric 10 roundtrip failed');
  }
  console.log('Four cleric domains at level 10 saved and reloaded successfully.');
  s.advancements[4]={...advancementInitial(),mode:'feat',featId:'expert',featAbility:'INT',choices:{skill:'',expertise:'Religion',damageType:'',rituals:[]}};
  s.advancements[8]={...advancementInitial(),mode:'feat',featId:'magie_rituelle',featAbility:'SAG',choices:{skill:'',expertise:'',damageType:'',rituals:catalogue.spells.filter(x=>x.rituel&&x.niveau>=1&&x.niveau<=4&&x.classes?.includes('Clerc')).slice(0,2).map(x=>x.id)}};
  const profile=clericProfile(s,catalogue);s.prepared=profile.prepared.slice(0,profile.preparedCount).map(x=>x.id);
  const featSaved=await store.save(owner,id,s,revision++),featRead=await store.get(owner,id);
  if(featSaved.status!=='ready'||featRead.character.advancements[4].choices.expertise!=='Religion'||featRead.character.advancements[8].choices.rituals.length!==2)throw Error('Feat choice roundtrip failed');
  console.log('Expertise and ritual choices saved and reloaded successfully.');
  s.level=20;
  s.advancements[12]={...advancementInitial(),mode:'ability',abilities:['CON','INT']};
  s.advancements[16]={...advancementInitial(),mode:'ability',abilities:['CON','INT']};
  s.advancements[19]={...advancementInitial(),mode:'feat',featId:'faveur_de_resistance_aux_energies',featAbility:'SAG',choices:{skill:'',expertise:'',damageType:'',rituals:[],resistances:['feu','froid'],spell:''}};
  for(const domain of catalogue.subclasses.filter(x=>x.classe_parente==='clerc'))for(const vocation of ['Protecteur','Thaumaturge']){
    s.subclassId=domain.id;s.divineOrder=vocation;
    const profile=clericProfile(s,catalogue);s.cantrips=profile.cantrips.slice(0,profile.cantripCount).map(x=>x.id);s.prepared=profile.prepared.slice(0,profile.preparedCount).map(x=>x.id);
    const saved=await store.save(owner,id,s,revision++),read=await store.get(owner,id);
    if(saved.status!=='ready'||read.character.level!==20||read.character.advancements[12].abilities[0]!=='CON'||read.character.advancements[16].abilities[1]!=='INT'||read.character.advancements[19].choices.resistances.join(',')!=='feu,froid')throw Error('Cleric 20 roundtrip failed');
  }
  s.advancements[19]={...advancementInitial(),mode:'feat',featId:'faveur_du_destin',featAbility:'SAG',choices:{skill:'',expertise:'',damageType:'',rituals:[],resistances:[],spell:catalogue.spells.find(x=>x.niveau===9&&x.classes?.includes('Clerc')).id}};
  const epicSaved=await store.save(owner,id,s,revision++),epicRead=await store.get(owner,id);
  if(epicSaved.status!=='ready'||epicRead.character.advancements[19].choices.spell!==s.advancements[19].choices.spell)throw Error('Epic spell roundtrip failed');
  console.log('Four cleric domains, both vocations at level 20 and epic choices saved and reloaded successfully.');
  for(const classId of supportedClasses.filter(id=>id!=='clerc'))for(const sub of catalogue.subclasses.filter(x=>x.classe_parente===classId)){
    const value=classFixture(catalogue,classId,20,sub.id);
    const saved=await store.save(owner,id,value,revision++),read=await store.get(owner,id);
    if(saved.status!=='ready'||read.character.classId!==classId||JSON.stringify(read.character.classChoices)!==JSON.stringify(value.classChoices))throw Error('Class roundtrip failed: '+sub.id);
  }
  console.log('All eleven additional classes and forty-four subclasses at level 20 saved and reloaded successfully.');
  for(const [i,origin]of originCases(catalogue).entries()){
    const value=originFixture(catalogue,supportedClasses[i%supportedClasses.length],5,origin,catalogue.backgrounds[i%catalogue.backgrounds.length].id);
    const saved=await store.save(owner,id,value,revision++),read=await store.get(owner,id);
    if(saved.status!=='ready'||read.character.speciesId!==value.speciesId||read.character.variantId!==value.variantId||read.character.speciesAncestry!==(value.speciesAncestry||'')||read.character.speciesCastingAbility!==(value.speciesCastingAbility||'')||JSON.stringify(read.character.originGrants)!==JSON.stringify(value.originGrants))throw Error('Origin roundtrip failed: '+value.speciesId);
  }
  for(const feat of catalogue.feats.filter(f=>f.categorie==='origine')){
    const value=originFixture(catalogue,'barde',1,{speciesId:'humain',speciesSize:'P'},feat.id==='truand'?'fermier':'charlatan',{originFeatId:feat.id});
    const saved=await store.save(owner,id,value,revision++),read=await store.get(owner,id);
    if(saved.status!=='ready'||read.character.originFeatId!==feat.id||JSON.stringify(read.character.originGrants)!==JSON.stringify(value.originGrants))throw Error('Human feat roundtrip failed: '+feat.id);
  }
  console.log('Thirty species/lineage/size origins and eleven human feats saved and reloaded successfully.');
  console.log('MongoDB create/read/update/retry/isolation checks passed.');
}finally{
  // Ne supprimer que le document temporaire créé par ce contrôle.
  await collection.deleteOne({user_id:owner,client_id:id});await client.close();
}
