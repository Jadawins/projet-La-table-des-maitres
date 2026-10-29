import revision from './data/rules-2024-corrections.json' with {type:'json'};

const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const additionIdentity=(collection,row)=>['sorts','dons'].includes(collection)?row?.id:collection==='armes'?row?.nom:['familiers','formes_draconiques','formes_animales'].includes(collection)?row?.slug:undefined;

// Work on a copy: a read-only Mongo snapshot is never rewritten by catalogue construction.
// Check all preconditions before changing anything; unrelated source drift must be reviewed.
export function applyRulesRevision(snapshot, plan=revision){
  const collections=structuredClone(snapshot.collections);
  const targets=[];
  const additions=[];
  const additionKeys=new Set();
  for(const addition of plan.additions||[]){
    if(addition.before!==null||!addition.id||additionIdentity(addition.collection,addition.after)!==addition.id)throw new Error('Rules revision: invalid addition');
    const identity=addition.collection+'/'+addition.id;
    if(additionKeys.has(identity))throw new Error('Rules revision: duplicate addition');
    additionKeys.add(identity);
    const rows=collections[addition.collection];
    if(!Array.isArray(rows))throw new Error('Rules revision: missing addition collection');
    const matches=rows.filter(row=>additionIdentity(addition.collection,row)===addition.id);
    if(matches.length>1||matches.length===1&&!equal(matches[0],addition.after))throw new Error('Rules revision: addition source drift '+identity);
    if(!matches.length)additions.push({rows,value:addition.after});
  }
  for(const correction of plan.corrections){
    const rows=collections[correction.collection];
    const matches=rows?.filter(row=>row.id===correction.id||row._source===correction.id||['formes_animales','formes_draconiques','familiers'].includes(correction.collection)&&row.slug===correction.id||!row.id&&!row._source&&row.nom===correction.id)||[];
    if(matches.length!==1)throw new Error(`Rules revision: expected one ${correction.collection}/${correction.id}`);
    const row=matches[0];
    for(const change of correction.changes){
      if(!Array.isArray(change.path)||!change.path.length||change.path.some(k=>['__proto__','prototype','constructor'].includes(String(k))))throw new Error('Rules revision: invalid field path');
      let parent=row;
      for(const key of change.path.slice(0,-1)){
        if(!parent||!Object.hasOwn(parent,key))throw new Error(`Rules revision: missing parent ${correction.id}/${change.path.join('.')}`);
        parent=parent[key];
      }
      const key=change.path.at(-1);
      const valid=parent&&(change.beforeMissing===true?(!Object.hasOwn(parent,key)||equal(parent[key],change.after)):(Object.hasOwn(parent,key)&&(equal(parent[key],change.before)||equal(parent[key],change.after))));
      if(!valid)throw new Error(`Rules revision: source drift ${correction.id}/${change.path.join('.')}`);
      targets.push({parent,key,value:change.after});
    }
  }
  for(const {parent,key,value}of targets)parent[key]=structuredClone(value);
  for(const {rows,value}of additions)rows.push(structuredClone(value));
  return collections;
}

export const rulesRevision={id:revision.id,cutoff:revision.cutoff,status:revision.status};
