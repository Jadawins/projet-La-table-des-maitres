import revision from './data/editorial-description-corrections-20261030.json' with {type:'json'};
import rewrite from './data/non-srd-description-rewrite-20261030.json' with {type:'json'};
import featRewrite from './data/non-srd-feat-rewrite-20261031.json' with {type:'json'};
import finalRewrite from './data/editorial-final-rewrite-20261031.json' with {type:'json'};

// Apply only the reviewed text fields, atomically, without mutating the source.
export function applyEditorialRevision(catalogue,plan=revision){
  const result=structuredClone(catalogue),targets=[],seen=new Set();
  if(plan.status!=='frozen'||plan.rulesVersion!==result.provenance?.revision?.id)throw Error('Édition de textes incohérente.');
  if(plan.previousEditorialRevision&&JSON.stringify(plan.previousEditorialRevision)!==JSON.stringify(result.provenance.editorialRevision))throw Error('Édition précédente différente.');
  for(const change of plan.corrections){
    const identity=JSON.stringify([change.collection,change.id,change.path]);
    const roleplay=change.collection==='backgrounds'&&change.path?.length===3&&change.path[0]==='caracteristiques_suggerees'&&['traits','ideaux','liens','defauts'].includes(change.path[1])&&Number.isInteger(change.path[2]);
    const supplement=change.collection==='fighterSupplements'&&change.id==='$root'&&(change.path?.length===3&&change.path[0]==='maneuvers'&&Number.isInteger(change.path[1])&&change.path[2]==='description'||change.path?.length===1&&change.path[0]==='maneuverNote');
    if(seen.has(identity)||!['spells','subclasses','feats','backgrounds','species','familiars','fighterSupplements'].includes(change.collection)||!Array.isArray(change.path)||!change.path.length||!roleplay&&!supplement&&!['description','trait','niveau_superieur','temps_incantation','M','condition','choix','valeur'].includes(String(change.path.at(-1)))||change.path.some(k=>['__proto__','constructor','prototype'].includes(String(k))))throw Error('Champ éditorial invalide ou répété.');
    seen.add(identity);
    const rows=supplement?[result.fighterSupplements]:result[change.collection]?.filter(row=>(row.id||row.slug)===change.id)||[];
    if(rows.length!==1)throw Error('Cible éditoriale absente ou ambiguë : '+change.id);
    if(change.collection==='fighterSupplements'&&!supplement)throw Error('Champ complémentaire non textuel.');
    if(change.collection==='backgrounds'&&!roleplay&&!(change.path.length===1&&change.path[0]==='description'))throw Error('Champ d’historique non textuel.');
    if(['species','familiars'].includes(change.collection)&&change.path.at(-1)!=='description')throw Error('Seules les descriptions peuvent changer.');
    if(change.collection==='feats'){
      const description=change.path.length===1&&change.path[0]==='description';
      const effect=change.path.length===3&&change.path[0]==='effets'&&change.path[2]==='valeur'&&rows[0].effets?.[change.path[1]]?.type!=='caracteristique';
      if(!description&&!effect)throw Error('Un don ne peut modifier ici que sa rédaction, hors hausse de caractéristique.');
    }else if(change.path.at(-1)==='valeur')throw Error('Valeur mécanique non modifiable dans une édition de textes.');
    let parent=rows[0];for(const key of change.path.slice(0,-1)){if(!parent||!Object.hasOwn(parent,key))throw Error('Chemin éditorial absent.');parent=parent[key];}
    const key=change.path.at(-1);
    if(!parent||typeof change.before!=='string'||typeof change.after!=='string'||parent[key]!==change.before)throw Error('Texte source différent : '+change.id+'/'+change.path.join('.'));
    targets.push({parent,key,value:change.after});
  }
  for(const {parent,key,value}of targets)parent[key]=value;
  result.provenance.editorialRevision={id:plan.id,status:plan.status,rulesVersion:plan.rulesVersion,baseSha256:plan.baseCatalogueSha256,scope:plan.id===revision.id?'Reviewed prose and typography only; no mechanics or redistribution-rights clearance.':plan.scope};
  return result;
}

export function applyCurrentEditorialRevisions(catalogue,{until}={}){
  let result=catalogue;
  for(const edition of [revision,rewrite,featRewrite,finalRewrite]){
    result=applyEditorialRevision(result,edition);
    if(edition.id===until)return result;
  }
  if(until)throw Error('Édition demandée introuvable.');
  return result;
}
