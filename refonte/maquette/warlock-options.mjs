const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
import {originFeats,isRepeatable,grantedOriginSpells} from './origin-rules.mjs';
import {inheritedValue} from './progression.mjs';
export const selectedInvocations=s=>s.classId==='occultiste'?(s.classChoices?.invocations||[]):[];
function patronSpellIds(s,c){
  const sub=s.level>=3?c.subclasses.find(x=>x.id===s.subclassId&&x.classe_parente==='occultiste'):null;
  return Object.entries(sub?.niveaux||{}).filter(([n])=>+n<=s.level).flatMap(([,r])=>r.sorts_connus_supplementaires||[]);
}
export function warlockOtherPreparedIds(s,c){return [...(s.cantrips||[]),...(s.prepared||[]),...patronSpellIds(s,c),...grantedOriginSpells(s,c).map(x=>x.id),...(s.level>=9?['contact_avec_les_plans']:[]),...(s.subclassId==='occultiste_protecteur_grand_ancien'&&s.level>=10?['malefice']:[])];}
function knownWarlockCantripIds(s,c){return [...(s.cantrips||[]),...patronSpellIds(s,c),...(selectedInvocations(s).includes('tome')?s.classChoices?.tomeCantrips||[]:[])].filter(id=>c.spells.some(x=>x.id===id&&x.niveau===0));}
export function invocationOptions(s,c){
  return (c.invocations?.options||[]).filter(i=>s.level>=i.level).flatMap(i=>{
    const base={nom:i.nom,description:`${i.description}${i.requires?.length?' · Prérequis : '+i.requires.map(id=>c.invocations.options.find(x=>x.id===id).nom).join(', '):''}`,rule:i};
    if(i.repeat==='feat'){const before={...s,classChoices:{...s.classChoices,invocations:selectedInvocations(s).filter(id=>!id.startsWith('lesson:'))}},owned=originFeats(before,c).map(g=>g.feat?.id);return c.feats.filter(f=>f.categorie==='origine'&&(!owned.includes(f.id)||isRepeatable(f))).map(f=>({...base,id:i.id+':'+f.id,nom:i.nom+' · '+f.nom}));}
    if(i.repeat){const known=knownWarlockCantripIds(s,c);return c.spells.filter(x=>x.niveau===0&&(x.classes?.includes('Occultiste')||known.includes(x.id))&&x.degats?.length&&(i.repeat!=='attack'||x.attaque)&&(i.repeat!=='range'||Number(String(x.portee).match(/^(\d+)/)?.[1])>=3)).map(x=>({...base,id:i.id+':'+x.id,nom:i.nom+' · '+x.nom}));}
    return [{...base,id:i.id}];
  });
}
export function invocationErrors(s,c,{spells=false}={}){
  if(s.classId!=='occultiste')return [];
  const chosen=selectedInvocations(s),errors=[];
  for(const id of chosen){const option=invocationOptions(s,c).find(o=>o.id===id);if(!option)continue;for(const required of option.rule.requires||[])if(!chosen.includes(required))errors.push(option.nom+' : prérequis manquant.');
    if(spells&&option.rule.repeat&&option.rule.repeat!=='feat'&&!knownWarlockCantripIds(s,c).includes(id.split(':')[1]))errors.push(option.nom+' : ce sort mineur d’Occultiste doit être connu (classe, protecteur ou Codex porté).');
  }
  for(const from of [2,5,7,9,12,15].filter(n=>n<=s.level)){
    const maximum=inheritedValue(s,c,'manifestations_occultes_nombre')-inheritedValue(s,c,'manifestations_occultes_nombre',from-1)+s.level-from+1;
    if(chosen.filter(id=>(c.invocations.options.find(x=>x.id===id.split(':')[0])?.level||1)>=from).length>maximum)errors.push('Manifestations : trop de choix accessibles seulement depuis le niveau '+from+' pour les gains et remplacements possibles (maximum '+maximum+').');
  }
  if(selectedInvocations(s).includes('tome')){
    const other=new Set(warlockOtherPreparedIds(s,c));
    if([...(s.classChoices?.tomeCantrips||[]),...(s.classChoices?.tomeRituals||[])].some(id=>other.has(id)))errors.push('Codex des Ombres : choisissez des sorts qui ne sont pas déjà préparés par ailleurs.');
  }
  return errors;
}
export function invocationGrants(s,c,grant){
  if(s.classId!=='occultiste')return;
  for(const id of selectedInvocations(s)){const rule=c.invocations.options.find(i=>i.id===id);if(rule?.spell)grant(rule.spell,rule.nom,'CHA',rule.usage||'Sans emplacement ; voir conditions de la manifestation',false);}
  if(selectedInvocations(s).includes('tome'))for(const id of [...(s.classChoices?.tomeCantrips||[]),...(s.classChoices?.tomeRituals||[])])grant(id,'Pacte du Grimoire','CHA','Toujours préparé comme sort d’Occultiste tant que le livre est porté ; emplacements ou rituel selon le sort.',true);
  for(const [level,rank]of [[11,6],[13,7],[15,8],[17,9]])if(s.level>=level)for(const id of s.classChoices?.['arcanum'+rank]||[])grant(id,'Secret arcanique '+rank,'CHA','1_repos_long',false);
}
