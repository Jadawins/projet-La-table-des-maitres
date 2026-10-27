const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const skillKey=value=>key(value)==='intuition'?'perspicacite':key(value);
export const grantInitial=()=>({proficiencies:[],magicList:'',cantrips:[],spell:''});
const species=(state,c)=>c.species.find(s=>s.id===state.speciesId);
const background=(state,c)=>c.backgrounds.find(b=>b.id===state.backgroundId);
export function backgroundFeat(state,c) {
  const name=background(state,c)?.don;
  if(!name) return null;
  const base=name.replace(/\s*\([^)]*\)\s*$/,'');
  const feat=c.feats.find(f=>key(f.nom)===key(base)||key(f.id)===key(base));
  return {slot:'background',feat,name,forcedList:name.match(/\(([^)]+)\)/)?.[1]||''};
}
export function isRepeatable(feat){return (feat?.effets||[]).some(e=>key(e.valeur).includes('repetable'));}
export function humanFeats(state,c) {
  const bg=backgroundFeat(state,c)?.feat;
  return c.feats.filter(f=>f.categorie==='origine'&&(f.prerequis?.niveau||1)<=state.level&&(!bg||bg.id!==f.id||isRepeatable(f)));
}
export function originFeats(state,c) {
  const result=[];const bg=backgroundFeat(state,c);if(bg) result.push(bg);
  if(state.speciesId==='humain') {
    const feat=humanFeats(state,c).find(f=>f.id===state.originFeatId);
    if(feat) result.push({slot:'human',feat,name:feat.nom,forcedList:''});
  }
  for(const {level,feat}of selectedLevelFeats(state,c))if(feat.categorie==='origine')result.push({slot:`level${level}`,feat,name:feat.nom,forcedList:'',label:`Don du niveau ${level}`});
  return result;
}
export function originSizeOptions(state,c) {
  const category=species(state,c)?.taille?.categorie||'';
  return category.split('_ou_').filter(Boolean);
}
export function selectedVariant(state,c){return species(state,c)?.variantes?.find(v=>v.id===state.variantId);}
export function toolOptions(c) {
  return (c.tools||[]).flatMap(tool=>tool.variants?.length?tool.variants.map(v=>({id:`tool:${tool.id}:${key(v.nom)}`,name:v.nom,type:'tool',category:tool.id,source:tool})): [{id:`tool:${tool.id}`,name:tool.nom,type:'tool',category:tool.categorie,source:tool}]);
}
export function backgroundToolOptions(state,c) {
  const requested=(background(state,c)?.outils||[]).find(name=>/au choix/i.test(name));
  if(!requested) return [];
  const normalized=key(requested);
  return toolOptions(c).filter(tool=>normalized.includes('instrument')?tool.category==='instruments_de_musique':normalized.includes('jeux')?tool.category==='boite_de_jeux':normalized.includes('artisan')?tool.category==='artisan':false);
}
export function fixedOriginSkills(state,c) {
  return [...new Set([...(background(state,c)?.competences||[]),...(species(state,c)?.competences_maitrises||[]).filter(name=>!name.startsWith('au_choix'))])];
}
export function speciesSkillOptions(state,c) {
  const choices=species(state,c)?.competences_maitrises||[];
  const marker=choices.find(name=>name.startsWith('au_choix'));
  if(!marker) return [];
  const automatic=new Set(fixedOriginSkills(state,c).map(skillKey));
  return c.skills.map(s=>s.nom==='Intuition'?'Perspicacité':s.nom).filter(name=>!automatic.has(skillKey(name))&&(marker==='au_choix'||marker==='au_choix_intuition_perception_survie'&&['perspicacite','perception','survie'].includes(skillKey(name))));
}
export function originSkills(state,c) {
  const result=[...fixedOriginSkills(state,c)];
  if(speciesSkillOptions(state,c).includes(state.speciesSkill)) result.push(state.speciesSkill);
  for(const grant of originFeats(state,c)) {
    for(const id of state.originGrants?.[grant.slot]?.proficiencies||[]) {
      if(!id.startsWith('skill:')) continue;
      const name=c.skills.find(s=>`skill:${skillKey(s.nom)}`===id)?.nom;
      if(name) result.push(name);
    }
  }
  return result.filter((name,index)=>result.findIndex(other=>skillKey(other)===skillKey(name))===index);
}
export function originTools(state,c) {
  const result=(background(state,c)?.outils||[]).filter(name=>!/au choix/i.test(name));
  const chosen=backgroundToolOptions(state,c).find(t=>t.id===state.backgroundTool);
  if(chosen) result.push(chosen.name);
  const options=toolOptions(c);
  for(const grant of originFeats(state,c)) {
    if(grant.feat?.id==='truand') result.push(c.tools?.find(t=>t.id==='materiel_de_contrefacon')?.nom||'Outils de contrefaçon');
    for(const id of state.originGrants?.[grant.slot]?.proficiencies||[]) {
      const tool=options.find(t=>t.id===id);if(tool) result.push(tool.name);
    }
  }
  return result.filter((name,index)=>result.findIndex(other=>key(other)===key(name))===index);
}
export function grantOptions(state,c,grant) {
  const id=grant.feat?.id;
  if(!['doue','faconneur','musicien'].includes(id)) return [];
  const baseSkills=new Set([...fixedOriginSkills(state,c),state.speciesSkill,...(state.classSkills||[])].map(skillKey));
  const baseTools=new Set((background(state,c)?.outils||[]).filter(name=>!/au choix/i.test(name)).map(key));
  const chosenTool=backgroundToolOptions(state,c).find(t=>t.id===state.backgroundTool);if(chosenTool) baseTools.add(key(chosenTool.name));
  const other=new Set(originFeats(state,c).filter(g=>g.slot!==grant.slot).flatMap(g=>state.originGrants?.[g.slot]?.proficiencies||[]));
  const tools=toolOptions(c).filter(t=>!baseTools.has(key(t.name))&&!other.has(t.id));
  if(id==='faconneur') return tools.filter(t=>t.category==='artisan');
  if(id==='musicien') return tools.filter(t=>t.category==='instruments_de_musique');
  return [...c.skills.filter(s=>!baseSkills.has(skillKey(s.nom))).map(s=>({id:`skill:${skillKey(s.nom)}`,name:s.nom,type:'skill'})),...tools].filter(option=>!other.has(option.id));
}
export function magicFeatLists(state,c,grant) {
  let lists=['Clerc','Druide','Magicien'];
  if(grant.forcedList) return lists.filter(name=>key(name)===key(grant.forcedList));
  const used=originFeats(state,c).filter(g=>g.slot!==grant.slot&&g.feat?.id==='initie_a_la_magie').map(other=>other.forcedList||state.originGrants?.[other.slot]?.magicList);
  lists=lists.filter(name=>!used.some(value=>key(name)===key(value)));
  return lists;
}
export function magicFeatProfile(state,c,grant) {
  if(grant.feat?.id!=='initie_a_la_magie') return null;
  const selection=state.originGrants?.[grant.slot]||grantInitial();
  const list=grant.forcedList||selection.magicList;
  if(!magicFeatLists(state,c,grant).includes(list)) return {list:'',cantrips:[],spells:[],ability:''};
  const cls=c.classes.find(cls=>key(cls.nom)===key(list));
  const pool=c.spells.filter(s=>(s.classes||[]).some(name=>key(name)===key(list)));
  return {list,cantrips:pool.filter(s=>s.niveau===0),spells:pool.filter(s=>s.niveau===1),ability:cls?.niveaux?.['0']?.caracteristique_incantation||''};
}
export function innateSpells(state,c) {
  const variant=selectedVariant(state,c);
  const result=(variant?.sorts_raciaux||[]).filter(s=>(s.niveau_personnage_requis||1)<=state.level).map(s=>({...s,source:'Espèce',nom:s.nom,niveau:s.niveau_sort}));
  for(const name of species(state,c)?.sorts_innes||[]) {
    if(String(name).startsWith('variable_')) continue;
    if(result.some(s=>key(s.id)===key(name)||key(s.nom)===key(name))) continue;
    const spell=c.spells.find(s=>key(s.id)===key(name)||key(s.nom)===key(name));
    result.push(spell?{...spell,source:'Espèce'}:{id:name,nom:name,niveau:null,unresolved:true,source:'Espèce'});
  }
  return result;
}
export function grantedOriginSpells(state,c) {
  const result=[...innateSpells(state,c)];
  for(const grant of originFeats(state,c)) {
    const profile=magicFeatProfile(state,c,grant);if(!profile?.list) continue;
    const selection=state.originGrants?.[grant.slot]||grantInitial();
    const cantrips=[...new Set(selection.cantrips)].map(id=>profile.cantrips.find(s=>s.id===id)).filter(Boolean);
    const spell=profile.spells.find(s=>s.id===selection.spell);
    for(const entry of [...cantrips,...(spell?[spell]:[])]) result.push({...entry,source:grant.label||(grant.slot==='human'?'Don humain':'Don d’historique'),caracteristique:profile.ability,utilisation:entry.niveau===1?'1_repos_long':'a_volonte'});
  }
  return result;
}
export function originBonuses(state,c) {
  const ids=originFeats(state,c).map(g=>g.feat?.id);
  const cls=c.classes.find(cls=>cls.id===state.classId);
  let proficiency=2;
  for(let n=1;n<=state.level;n++) if(cls?.niveaux?.[n]?.bonusMaitrise!==undefined) proficiency=cls.niveaux[n].bonusMaitrise;
  return {hp:ids.includes('robuste')?state.level:0,initiative:ids.includes('vigilant')?proficiency:0,proficiency};
}
export function reconcileOrigins(state,c) {
  if(!state.originGrants) state.originGrants={};
  for(const slot of ORIGIN_SLOTS) state.originGrants[slot]={...grantInitial(),...state.originGrants[slot]};
  if(!speciesSkillOptions(state,c).includes(state.speciesSkill)) state.speciesSkill='';
  if(!originSizeOptions(state,c).includes(state.speciesSize)) state.speciesSize='';
  if(!selectedVariant(state,c)) state.variantId='';
  if(state.speciesId!=='humain'||!humanFeats(state,c).some(f=>f.id===state.originFeatId)) {state.originFeatId='';state.originGrants.human=grantInitial();}
  if(!backgroundToolOptions(state,c).some(t=>t.id===state.backgroundTool)) state.backgroundTool='';
  const backgroundChoices=new Set(state.originGrants.background.proficiencies);
  state.originGrants.human.proficiencies=state.originGrants.human.proficiencies.filter(id=>!backgroundChoices.has(id));
  for(const grant of originFeats(state,c)) {
    if(!grant.feat) continue;
    const selection=state.originGrants[grant.slot];
    const allowed=grantOptions(state,c,grant);
    selection.proficiencies=[...new Set(selection.proficiencies)].filter(id=>allowed.some(o=>o.id===id)).slice(0,3);
    const profile=magicFeatProfile(state,c,grant);
    if(profile) {
      if(!profile.list) {selection.magicList='';selection.cantrips=[];selection.spell='';}
      else {selection.cantrips=[...new Set(selection.cantrips)].filter(id=>profile.cantrips.some(s=>s.id===id)).slice(0,2);if(!profile.spells.some(s=>s.id===selection.spell)) selection.spell='';}
    } else {selection.magicList='';selection.cantrips=[];selection.spell='';}
  }
}
export function originErrors(state,c,{levelGrants=true}={}) {
  const errors=[];const s=species(state,c);
  if(!s||!background(state,c)) return ['Choisissez une espèce et un historique.'];
  if(originSizeOptions(state,c).length>1&&!originSizeOptions(state,c).includes(state.speciesSize)) errors.push('Choisissez la taille de votre personnage.');
  if(s.variantes?.length&&!selectedVariant(state,c)) errors.push('Choisissez un lignage ou un héritage.');
  if(speciesSkillOptions(state,c).length&&!speciesSkillOptions(state,c).includes(state.speciesSkill)) errors.push('Choisissez la compétence accordée par votre espèce.');
  if(state.speciesId==='humain'&&!humanFeats(state,c).some(f=>f.id===state.originFeatId)) errors.push('Choisissez le don d’origine de votre humain.');
  if(backgroundToolOptions(state,c).length&&!backgroundToolOptions(state,c).some(t=>t.id===state.backgroundTool)) errors.push('Choisissez l’outil accordé par votre historique.');
  errors.push(...originGrantErrors(state,c,originFeats(state,c).filter(g=>levelGrants||!g.slot.startsWith('level'))));
  return errors;
}
import {selectedLevelFeats,ORIGIN_SLOTS} from './cleric-progression.mjs';

export function originGrantErrors(state,c,grants=originFeats(state,c)){
  const errors=[];
  for(const grant of grants) {
    if(!grant.feat) continue;
    const selected=state.originGrants?.[grant.slot]||grantInitial();
    const options=grantOptions(state,c,grant);
    if(['doue','faconneur','musicien'].includes(grant.feat.id)&&(selected.proficiencies.length!==3||new Set(selected.proficiencies).size!==3||selected.proficiencies.some(id=>!options.some(o=>o.id===id)))) errors.push(`${grant.name} : choisissez trois maîtrises distinctes disponibles.`);
    const profile=magicFeatProfile(state,c,grant);
    if(profile&&(!profile.list||selected.cantrips.length!==2||new Set(selected.cantrips).size!==2||selected.cantrips.some(id=>!profile.cantrips.some(s=>s.id===id))||!profile.spells.some(s=>s.id===selected.spell))) errors.push(`${grant.name} : choisissez une liste, deux sorts mineurs distincts et un sort de niveau 1.`);
  }
  return errors;
}
