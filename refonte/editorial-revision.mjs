import revision from './data/editorial-description-corrections-20261030.json' with {type:'json'};
import rewrite from './data/non-srd-description-rewrite-20261030.json' with {type:'json'};
import featRewrite from './data/non-srd-feat-rewrite-20261031.json' with {type:'json'};

// Apply only the reviewed text fields, atomically, without mutating the source.
export function applyEditorialRevision(catalogue,plan=revision){
  const result=structuredClone(catalogue),targets=[],seen=new Set();
  if(plan.status!=='frozen'||plan.rulesVersion!==result.provenance?.revision?.id)throw Error('Édition de textes incohérente.');
  if(plan.previousEditorialRevision&&JSON.stringify(plan.previousEditorialRevision)!==JSON.stringify(result.provenance.editorialRevision))throw Error('Édition précédente différente.');
  for(const change of plan.corrections){
    const identity=JSON.stringify([change.collection,change.id,change.path]);
    if(seen.has(identity)||!['spells','subclasses','feats'].includes(change.collection)||!Array.isArray(change.path)||!change.path.length||!['description','trait','niveau_superieur','temps_incantation','M','condition','choix','valeur'].includes(String(change.path.at(-1)))||change.path.some(k=>['__proto__','constructor','prototype'].includes(String(k))))throw Error('Champ éditorial invalide ou répété.');
    seen.add(identity);
    const rows=result[change.collection]?.filter(row=>row.id===change.id)||[];
    if(rows.length!==1)throw Error('Cible éditoriale absente ou ambiguë : '+change.id);
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
  for(const edition of [revision,rewrite,featRewrite]){
    result=applyEditorialRevision(result,edition);
    if(edition.id===until)return result;
  }
  if(until)throw Error('Édition demandée introuvable.');
  return result;
}
