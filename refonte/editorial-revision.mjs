import revision from './data/editorial-description-corrections-20261030.json' with {type:'json'};

// Apply only the reviewed text fields, atomically, without mutating the source.
export function applyEditorialRevision(catalogue,plan=revision){
  const result=structuredClone(catalogue),targets=[],seen=new Set();
  if(plan.status!=='frozen'||plan.rulesVersion!==result.provenance?.revision?.id)throw Error('Édition de textes incohérente.');
  for(const change of plan.corrections){
    const identity=JSON.stringify([change.collection,change.id,change.path]);
    if(seen.has(identity)||!['spells','subclasses'].includes(change.collection)||!Array.isArray(change.path)||!change.path.length||!['description','niveau_superieur','temps_incantation','M','condition','choix'].includes(String(change.path.at(-1)))||change.path.some(k=>['__proto__','constructor','prototype'].includes(String(k))))throw Error('Champ éditorial invalide ou répété.');
    seen.add(identity);
    const rows=result[change.collection]?.filter(row=>row.id===change.id)||[];
    if(rows.length!==1)throw Error('Cible éditoriale absente ou ambiguë : '+change.id);
    let parent=rows[0];for(const key of change.path.slice(0,-1)){if(!parent||!Object.hasOwn(parent,key))throw Error('Chemin éditorial absent.');parent=parent[key];}
    const key=change.path.at(-1);
    if(!parent||typeof change.before!=='string'||typeof change.after!=='string'||parent[key]!==change.before)throw Error('Texte source différent : '+change.id+'/'+change.path.join('.'));
    targets.push({parent,key,value:change.after});
  }
  for(const {parent,key,value}of targets)parent[key]=value;
  result.provenance.editorialRevision={id:plan.id,status:plan.status,rulesVersion:plan.rulesVersion,baseSha256:plan.baseCatalogueSha256,scope:'Reviewed prose and typography only; no mechanics or redistribution-rights clearance.'};
  return result;
}
