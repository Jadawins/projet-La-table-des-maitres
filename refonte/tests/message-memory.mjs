const values=(row,path)=>{if(!path.length)return Array.isArray(row)?row:[row];if(Array.isArray(row))return row.flatMap(v=>values(v,path));return values(row?.[path[0]],path.slice(1));};
function matches(row,filter){return Object.entries(filter).every(([key,v])=>{
  if(key==='$or')return v.some(f=>matches(row,f));
  const found=values(row,key.split('.'));
  if(v&&typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date)){
    if('$in'in v)return found.some(x=>v.$in.includes(x));if('$exists'in v)return found.some(x=>x!==undefined)===v.$exists;
  }
  return found.some(x=>x===v);
});}
export function messageMemory(){const rows=[];return {rows,
  async findOne(filter){return structuredClone(rows.find(r=>matches(r,filter))||null);},
  async insertOne(row){if(rows.some(r=>r.id===row.id))throw Object.assign(Error('duplicate'),{code:11000});rows.push(structuredClone(row));},
  async updateOne(filter,update){const row=rows.find(r=>matches(r,filter));if(!row)return {matchedCount:0};Object.assign(row,structuredClone(update.$set));return {matchedCount:1};},
  async countDocuments(filter){return rows.filter(r=>matches(r,filter)).length;},
  find(filter){let found=rows.filter(r=>matches(r,filter));return {sort(order){found.sort((a,b)=>{for(const [key,direction]of Object.entries(order)){const av=a[key],bv=b[key];if(av<bv)return -direction;if(av>bv)return direction;}return 0;});return this;},skip(n){found=found.slice(n);return this;},limit(n){found=found.slice(0,n);return this;},async toArray(){return structuredClone(found);}};}
};}
