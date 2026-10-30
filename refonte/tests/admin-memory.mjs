const get=(doc,key)=>key.split('.').reduce((v,k)=>v?.[k],doc);
function matches(doc,filter){return Object.entries(filter).every(([key,v])=>{const actual=get(doc,key);if(v&&typeof v==='object'){if('$exists'in v)return (actual!==undefined)===v.$exists;if('$type'in v)return typeof actual===v.$type;if('$gte'in v)return actual>=v.$gte;}return actual===v;});}
export function memoryCollection(rows=[]){
  return {rows,
    async findOne(filter){return structuredClone(rows.find(r=>matches(r,filter))||null);},
    async countDocuments(filter){return rows.filter(r=>matches(r,filter)).length;},
    find(filter){let result=rows.filter(r=>matches(r,filter));return {sort(){return this;},limit(n){result=result.slice(0,n);return this;},async toArray(){return structuredClone(result);}};},
    aggregate(){return {async toArray(){const groups=new Map();for(const r of rows.filter(r=>r.deleted_at===undefined))groups.set(r.character?.classId,(groups.get(r.character?.classId)||0)+1);return [...groups].map(([_id,count])=>({_id,count}));}};},
    async insertOne(doc){if(rows.some(r=>r.user_id===doc.user_id&&r.client_id===doc.client_id))throw Object.assign(Error('duplicate'),{code:11000});rows.push(structuredClone(doc));},
    async updateOne(filter,update,options={}){let r=rows.find(r=>matches(r,filter));if(!r){if(!options.upsert)return {matchedCount:0};r={...filter,...update.$setOnInsert};rows.push(r);}if(update.$set?.user_id&&rows.some(other=>other!==r&&other.user_id===update.$set.user_id&&other.client_id===r.client_id))throw Object.assign(Error('duplicate'),{code:11000});Object.assign(r,structuredClone(update.$set||{}));for(const [key,value]of Object.entries(update.$push||{}))(r[key]??=[]).push(structuredClone(value));return {matchedCount:1};}
  };
}
