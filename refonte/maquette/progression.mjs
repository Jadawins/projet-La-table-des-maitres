const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
import {classMagic} from './class-magic.mjs';
export const ADVANCEMENT_LEVELS=Array.from({length:20},(_,i)=>i+1);
export const ORIGIN_SLOTS=['background','human',...ADVANCEMENT_LEVELS.map(n=>`level${n}`),...ADVANCEMENT_LEVELS.map(n=>`invocation${n}`)];
const abilities=['FOR','DEX','CON','INT','SAG','CHA'];
export const advancementInitial=()=>({mode:'',abilities:[],featId:'',featAbility:'',notes:'',choices:{skill:'',expertise:'',damageType:'',rituals:[],resistances:[],spell:''}});
export function improvementLevels(state,c){
  if(!Number.isInteger(state.level)||state.level<1||state.level>20)return [];
  const cls=c.classes.find(x=>x.id===state.classId);
  return Object.entries(cls?.niveaux||{}).filter(([n,row])=>+n>0&&+n<=state.level&&row.amelioration).map(([n])=>+n);
}
export function featAbilityOptions(feat){
  const effect=feat?.effets?.find(e=>e.type==='caracteristique');if(!effect)return [];
  const explicit=effect.valeur.match(/\b(FOR|DEX|CON|INT|SAG|CHA)\b/g);
  return explicit?[...new Set(explicit)]:/au choix|de votre choix|une ou deux|une caract[eé]ristique/.test(effect.valeur)?abilities:[];
}
export function inheritedValue(state,c,field,level=state.level){
  const cls=c.classes.find(x=>x.id===state.classId);let value;
  for(let n=1;n<=level;n++)if(cls?.niveaux?.[n]?.[field]!==undefined)value=cls.niveaux[n][field];
  return value;
}
function originFeatIds(state,c){
  const bg=c.backgrounds.find(b=>b.id===state.backgroundId),name=bg?.don?.replace(/\s*\([^)]*\)\s*$/,'');
  const id=c.feats.find(f=>key(f.nom)===key(name)||f.id===c.originCorrections?.backgroundFeats?.[key(name)])?.id;
  return [id,state.speciesId==='humain'?state.originFeatId:'',...(state.classId==='occultiste'?state.classChoices?.invocations||[]:[]).filter(i=>i.startsWith('lesson:')).map(i=>i.split(':')[1])].filter(Boolean);
}
export function eligibleLevelFeats(state,c,level,scores,taken=[]){
  const training=classTraining({...state,level},c);
  return c.feats.filter(f=>{
    const p=f.prerequis||{};if((p.niveau||1)>level||p.classe)return false;
    if(taken.includes(f.id)&&!(f.effets||[]).some(e=>key(e.valeur).includes('repetable')))return false;
    if(f.id==='initie_a_la_magie'&&taken.filter(id=>id===f.id).length>=3)return false;
    if(['magie_rituelle','faveur_du_destin'].includes(f.id)){
      const magic=classMagic(state,c,level),rank=Math.max(0,...Object.entries(magic.row.emplacements_de_sort||{}).filter(([,n])=>n>0).map(([r])=>+r));
      const pool=c.spells.filter(s=>s.niveau<=rank&&s.classes?.some(n=>key(n)===key(magic.spellClass)));
      if(!magic.enabled||(f.id==='magie_rituelle'?pool.filter(s=>s.rituel&&s.niveau>=1).length<2:!pool.length))return false;
    }
    const required=p.caracteristique;if(!required)return true;
    if(required==='aptitude Sorts')return classMagic(state,c,level).enabled;
    const thresholds=[...required.matchAll(/(FOR|DEX|CON|INT|SAG|CHA)\s+(\d+)/g)];
    if(thresholds.length)return thresholds.some(([,a,n])=>Number.isFinite(scores[a])&&scores[a]>=+n);
    if(key(required)==='foroudex')return true;
    if(key(required)==='formationauxarmureslegeres')return training.armors.includes('armures_legeres')||taken.includes('protection_legere');
    if(key(required)==='formationauxarmuresintermediaires')return training.armors.includes('armures_intermediaires')||taken.includes('protection_intermediaire');
    if(key(required)==='formationauxboucliers')return training.armors.includes('boucliers')||taken.includes('protection_legere');
    if(key(required)==='formationauxarmureslourdes')return training.heavy||taken.includes('protection_lourde');
    return false;
  });
}
export function evaluateProgression(state,c,baseScores,through=state.level){
  const scores={...baseScores},rows=[],issues=[],taken=originFeatIds(state,c);
  const cls=c.classes.find(x=>x.id===state.classId),limit=Math.min(through,state.level);
  const improvements=improvementLevels({...state,level:limit},c);
  const passiveLevels=Object.entries(cls?.niveaux||{}).filter(([n,row])=>+n>0&&+n<=limit&&(row.capacites||[]).some(f=>!f.conditions&&(f.effets||[]).some(e=>e.type==='augmentation_caracteristique'&&!e.conditions))).map(([n])=>+n);
  const passives=level=>{for(const f of cls?.niveaux?.[level]?.capacites||[])if(!f.conditions)for(const e of f.effets||[])if(e.type==='augmentation_caracteristique'&&!e.conditions)for(const a of e.cibles||[]){if(Number.isFinite(scores[a]))scores[a]=Math.max(scores[a],Math.min(e.maximum??30,scores[a]+e.valeur));}};
  for(const level of [...new Set([...improvements,...passiveLevels])].sort((a,b)=>a-b)){
    if(!improvements.includes(level)){passives(level);continue;}
    const choice={...advancementInitial(),...state.advancements?.[level]};
    const improvement=c.classes.find(x=>x.id===state.classId).niveaux[level].amelioration;
    const available=eligibleLevelFeats(state,c,level,scores,taken),errors=[];
    const feat=choice.mode==='feat'?available.find(f=>f.id===choice.featId):null;
    let increments=[];
    if(choice.mode==='ability'&&improvement.type!=='don'){
      const spec=c.classes.find(x=>x.id===state.classId).niveaux[level].amelioration.choix.caracteristique;
      if(choice.abilities.length!==spec.nombre||new Set(choice.abilities).size!==spec.nombre||choice.abilities.some(a=>!spec.liste.includes(a)))errors.push(`Niveau ${level} : répartissez les ${spec.nombre} augmentations distinctes de caractéristiques prévues par votre BDD.`);
      else increments=choice.abilities;
    }else if(choice.mode==='feat'){
      if(!feat)errors.push(`Niveau ${level} : choisissez un don éligible à ce palier.`);
      else{
        taken.push(feat.id);
        if(feat.id==='amelioration_de_caracteristique'){
          if(choice.abilities.length!==2||choice.abilities.some(a=>!abilities.includes(a)))errors.push(`Niveau ${level} : répartissez les deux points du don.`);
          else increments=choice.abilities;
        }else if(featAbilityOptions(feat).length){
          if(!featAbilityOptions(feat).includes(choice.featAbility))errors.push(`Niveau ${level} : choisissez la caractéristique augmentée par le don.`);
          else increments=[choice.featAbility];
        }
      }
    }else errors.push(`Niveau ${level} : choisissez une amélioration de caractéristiques ou un don.`);
    for(const ability of new Set(increments)){
      const amount=increments.filter(a=>a===ability).length;
      if(scores[ability]===null||scores[ability]===undefined)errors.push(`Niveau ${level} : renseignez d’abord vos caractéristiques.`);
      else {const cap=Number(feat?.effets?.find(e=>e.type==='caracteristique')?.valeur.match(/max\s*(\d+)/i)?.[1])||20;if(scores[ability]+amount>cap)errors.push(`Niveau ${level} : ${ability} dépasserait ${cap}.`);}
    }
    if(!errors.length)for(const a of increments)scores[a]++;
    passives(level);
    issues.push(...errors);rows.push({level,choice,feat,available,scores:{...scores},errors});
  }
  return {scores,rows,issues};
}
export function selectedLevelFeats(state,c){
  return improvementLevels(state,c).flatMap(level=>{
    const choice=state.advancements?.[level];const feat=choice?.mode==='feat'?c.feats.find(f=>f.id===choice.featId):null;
    return feat?[{level,feat,choice}]:[];
  });
}

export function activeFeatures(state,c){
  const cls=c.classes.find(x=>x.id===state.classId);
  const sub=state.level>=3?c.subclasses.find(s=>s.id===state.subclassId&&key(s.classe_parente)===key(cls?.nom)):null;
  return [...Object.entries(cls?.niveaux||{}).filter(([n])=>+n>0&&+n<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...structuredClone(f),source:cls.nom+' · niveau '+n,level:+n}))),...Object.entries(sub?.niveaux||{}).filter(([n])=>+n<=state.level).flatMap(([n,row])=>(row.capacites||[]).map(f=>({...structuredClone(f),source:sub.nom+' · niveau '+n,level:+n})))];
}
export function classTraining(state,c){
  const base=c.classes.find(x=>x.id===state.classId)?.niveaux?.[0]||{};
  const armors=[...(base.maitrises_armures||[])],weapons=[...(base.maitrises_armes||[])];
  const variant=c.species.find(s=>s.id===state.speciesId)?.variantes?.find(v=>v.id===state.variantId);
  if(variant?.traits_speciaux?.some(t=>t.id==='maitrise_armures_naines'))armors.push('armures_legeres','armures_intermediaires');
  for(const feature of activeFeatures(state,c)){
    const selected=(feature.options||[]).find(o=>o.nom===state.divineOrder||o.nom===state.classChoices?.[key(feature.nom)]?.[0]);
    for(const e of selected?.effets||[]){if(e.type==='ajout_formation_armures')armors.push(e.valeur);if(e.type==='ajout_maitrise_armes')weapons.push(e.valeur);}
    if(!feature.options?.length&&/maitrise.*armureslourdes/.test(key(feature.description)))armors.push('armures_lourdes');
    if(!feature.options?.length&&/maitrise.*armuresintermediaires/.test(key(feature.description)))armors.push('armures_intermediaires');
    if(!feature.options?.length&&/maitrise.*armesdeguerre/.test(key(feature.description)))weapons.push('armes_de_guerre');
    if(!feature.options?.length&&/maitrise.*boucliers/.test(key(feature.description)))armors.push('boucliers');
  }
  return {armors:[...new Set(armors)],weapons:[...new Set(weapons)],heavy:armors.includes('armures_lourdes')};
}
