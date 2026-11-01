// Server-only read access to Supabase Auth; never return tokens or raw users.
const unavailable=()=>Object.assign(new Error('La liste des comptes inscrits est momentanément indisponible.'),{status:503});
export function createAuthAccounts({url,key,fetcher=fetch}){
  let pending;
  const account=user=>user&&typeof user.id==='string'&&user.id&&!user.is_anonymous&&!user.deleted_at?{
    id:user.id,email:typeof user.email==='string'?user.email.toLowerCase():'',
    name:String(user.user_metadata?.full_name||user.user_metadata?.username||user.email||user.id).slice(0,100)
  }:null;
  async function request(endpoint,allowMissing=false){
    if(!url||!key)throw unavailable();
    try{
      const response=await fetcher(url.replace(/\/$/,'')+'/auth/v1/admin/users'+endpoint,{headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(allowMissing&&response.status===404)return null;
      if(!response.ok)throw unavailable();
      return await response.json();
    }catch{throw unavailable();}
  }
  async function load(){
    const found=new Map();const started=Date.now();
    for(let page=1;page<=100;page++){
      if(Date.now()-started>30000)throw unavailable();
      const data=await request('?page='+page+'&per_page=1000');
      if(!Array.isArray(data.users)||data.users.some(user=>typeof user?.id!=='string'||!user.id))throw unavailable();
      for(const user of data.users){const row=account(user);if(row)found.set(row.id,row);}
      if(data.users.length<1000){const accounts=[...found.values()].sort((a,b)=>(a.email||a.name).localeCompare(b.email||b.name));return {total:accounts.length,accounts};}
    }
    throw unavailable(); // Never publish a truncated page count as a total.
  }
  return {
    snapshot(){if(!pending)pending=load().finally(()=>{pending=undefined;});return pending;},
    async find(id){if(typeof id!=='string'||!id||id.length>128)return null;const data=await request('/'+encodeURIComponent(id),true);return account(data?.user||data);}
  };
}
