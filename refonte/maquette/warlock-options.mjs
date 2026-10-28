const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
import {originFeats,isRepeatable} from './origin-rules.mjs';
export const selectedInvocations=s=>s.classId==='occultiste'?(s.classChoices?.invocations||[]):[];
export function invocationOptions(s,c){
  return (c.invocations?.options||[]).filter(i=>s.level>=i.level).flatMap(i=>{
    const base={nom:i.nom,description:`${i.description}${i.requires?.length?' · Prérequis : '+i.requires.map(id=>c.invocations.options.find(x=>x.id===id).nom).join(', '):''}`,rule:i};
    if(i.repeat==='feat'){const before={...s,classChoices:{...s.classChoices,invocations:selectedInvocations(s).filter(id=>!id.startsWith('lesson:'))}},owned=originFeats(before,c).map(g=>g.feat?.id);return c.feats.filter(f=>f.categorie==='origine'&&(!owned.includes(f.id)||isRepeatable(f))).map(f=>({...base,id:i.id+':'+f.id,nom:i.nom+' · '+f.nom}));}
    if(i.repeat)return c.spells.filter(x=>x.niveau===0&&x.classes.includes('Occultiste')&&x.degats?.length&&(i.repeat!=='attack'||x.attaque)&&(i.repeat!=='range'||Number(String(x.portee).match(/^(\d+)/)?.[1])>=3)).map(x=>({...base,id:i.id+':'+x.id,nom:i.nom+' · '+x.nom}));
    return [{...base,id:i.id}];
  });
}
export function invocationErrors(s,c,{spells=false}={}){
  if(s.classId!=='occultiste')return [];
  const chosen=selectedInvocations(s),errors=[];
  for(const id of chosen){const option=invocationOptions(s,c).find(o=>o.id===id);if(!option)continue;for(const required of option.rule.requires||[])if(!chosen.includes(required))errors.push(option.nom+' : prérequis manquant.');
    if(spells&&option.rule.repeat&&option.rule.repeat!=='feat'&&!s.cantrips.includes(id.split(':')[1]))errors.push(option.nom+' : ce sort mineur doit faire partie de vos sorts mineurs de classe.');
  }
  return errors;
}
export function invocationGrants(s,c,grant){
  if(s.classId!=='occultiste')return;
  for(const id of selectedInvocations(s)){const rule=c.invocations.options.find(i=>i.id===id);if(rule?.spell)grant(rule.spell,rule.nom,'CHA',rule.usage||'Sans emplacement ; voir conditions de la manifestation',false);}
  if(selectedInvocations(s).includes('tome'))for(const id of [...(s.classChoices?.tomeCantrips||[]),...(s.classChoices?.tomeRituals||[])])grant(id,'Pacte du Grimoire','CHA','Livre porté ; rituel pour les sorts de niveau 1',false);
  for(const [level,rank]of [[11,6],[13,7],[15,8],[17,9]])if(s.level>=level)for(const id of s.classChoices?.['arcanum'+rank]||[])grant(id,'Secret arcanique '+rank,'CHA','1_repos_long',false);
}
