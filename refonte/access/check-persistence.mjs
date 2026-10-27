import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createCharacterStore} from './character-store.mjs';
import {validateSavedCharacter} from './atelier/character-storage.mjs';
import {clericProfile} from './atelier/character-rules.mjs';
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
  console.log('MongoDB create/read/update/retry/isolation checks passed.');
}finally{
  // Ne supprimer que le document temporaire créé par ce contrôle.
  await collection.deleteOne({user_id:owner,client_id:id});await client.close();
}
