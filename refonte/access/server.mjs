import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const COOKIE='__Host-myrpgtable_session', OAUTH='__Host-myrpgtable_oauth';
const hash=s=>createHash('sha256').update(s).digest('hex');
const cookie=(name,value,age=28800)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const getCookie=(req,name)=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createGateway({supabaseUrl,anonKey,appRoot,characters,origin='https://myrpgtable.fr',fetcher=fetch,now=Date.now}) {
  if(!supabaseUrl||!anonKey)throw new Error('Configuration de connexion absente');
  const sessions=new Map(),pending=new Map(),attempts=new Map();
  const files={'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','character-rules.mjs':'text/javascript; charset=utf-8','origin-rules.mjs':'text/javascript; charset=utf-8','character-storage.mjs':'text/javascript; charset=utf-8','cleric-progression.mjs':'text/javascript; charset=utf-8','progression.mjs':'text/javascript; charset=utf-8','class-profiles.mjs':'text/javascript; charset=utf-8','class-magic.mjs':'text/javascript; charset=utf-8','extra-classes.mjs':'text/javascript; charset=utf-8','warlock-options.mjs':'text/javascript; charset=utf-8','feat-effects.mjs':'text/javascript; charset=utf-8','sheet-model.mjs':'text/javascript; charset=utf-8','sheet-view.mjs':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','catalogue.json':'application/json; charset=utf-8','assets/fond-bibliotheque-sombre.png':'image/png'};
  const json=(res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
  const redirect=(res,to,headers={})=>{res.writeHead(302,{Location:to,'Cache-Control':'no-store',...headers});res.end();};
  async function body(req,max=32768){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>max){const error=new Error('Le personnage est trop volumineux.');error.status=413;throw error;}}try{return JSON.parse(raw||'{}');}catch{const error=new Error('Le contenu envoyé est invalide.');error.status=400;throw error;}}
  async function authFetch(endpoint,data,token){
    const response=await fetcher(`${supabaseUrl.replace(/\/$/,'')}/auth/v1/${endpoint}`,{method:data?'POST':'GET',headers:{apikey:anonKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(12000)});
    const result=await response.json();return {ok:response.ok,data:result};
  }
  async function verified(tokens){
    if(typeof tokens?.access_token!=='string'||tokens.access_token.length>16000)return null;
    const result=await authFetch('user',null,tokens.access_token);
    if(!result.ok||typeof result.data?.id!=='string'||!result.data.id||result.data.is_anonymous)return null;
    // Décodage uniquement APRÈS validation par Supabase, jamais comme repli de vérification.
    let exp;try{exp=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url')).exp;}catch{return null;}
    if(!Number.isFinite(exp)||exp*1000<=now())return null;
    return {userId:result.data.id,refreshToken:tokens.refresh_token||'',expires:exp*1000,until:now()+8*3600000};
  }
  function createSession(res,session){
    if(sessions.size>=10000)throw new Error('sessions');
    const id=randomBytes(32).toString('base64url');sessions.set(hash(id),session);
    json(res,200,{ok:true},{'Set-Cookie':cookie(COOKIE,id)});
  }
  async function sessionFor(req){
    const key=hash(getCookie(req,COOKIE)),session=sessions.get(key);if(!session)return null;
    if(session.until<=now()){sessions.delete(key);return null;}
    if(session.expires<=now()+30000){
      if(!session.refreshToken){sessions.delete(key);return null;}
      if(!session.refreshing)session.refreshing=(async()=>{
        const tokens=await authFetch('token?grant_type=refresh_token',{refresh_token:session.refreshToken});
        const updated=tokens.ok?await verified(tokens.data):null;
        if(!updated||updated.userId!==session.userId){sessions.delete(key);return null;}
        Object.assign(session,updated,{until:session.until});return session;
      })().finally(()=>{delete session.refreshing;});
      return session.refreshing;
    }
    return session;
  }
  function rateAllowed(req){
    const ip=req.headers['x-real-ip']||req.socket.remoteAddress;
    let record=attempts.get(ip);if(!record||record.until<=now()){record={count:0,until:now()+15*60000};attempts.set(ip,record);}
    return ++record.count<=12;
  }
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,origin),route=url.pathname;
      if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&req.headers.origin!==origin)return json(res,403,{error:'Rechargez la page de connexion.'});
      if(route==='/atelier/api/personnages'||route.startsWith('/atelier/api/personnages/')){
        const session=await sessionFor(req);if(!session)return json(res,401,{error:'Reconnectez-vous pour enregistrer dans votre compte. Votre brouillon reste sur cet appareil.'});
        if(!characters)return json(res,503,{error:'L’enregistrement est temporairement indisponible. Votre brouillon est conservé.'});
        const id=route.slice('/atelier/api/personnages/'.length);
        if(req.method==='GET'&&route==='/atelier/api/personnages')return json(res,200,{characters:await characters.list(session.userId)});
        if(req.method==='GET'&&id)return json(res,200,await characters.get(session.userId,id));
        if(req.method==='PUT'&&id){const data=await body(req,131072);return json(res,200,await characters.save(session.userId,id,data.character,data.revision));}
        return json(res,405,{error:'Cette opération est indisponible.'});
      }
      if(req.method==='GET'&&route==='/auth/status'){
        const session=await sessionFor(req);return json(res,session?200:401,session?{ok:true}:{ok:false});
      }
      if(req.method==='POST'&&route==='/auth/logout'){
        sessions.delete(hash(getCookie(req,COOKIE)));return json(res,200,{ok:true},{'Set-Cookie':cookie(COOKIE,'',0)});
      }
      if(req.method==='GET'&&route==='/auth/oauth'){
        const provider=url.searchParams.get('provider');if(!['google','discord'].includes(provider))return json(res,400,{error:'Connexion indisponible.'});
        if(!rateAllowed(req))return json(res,429,{error:'Trop de tentatives. Réessayez plus tard.'});
        const id=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
        pending.set(hash(id),{verifier,until:now()+10*60000});
        const target=new URL(`${supabaseUrl.replace(/\/$/,'')}/auth/v1/authorize`);
        target.searchParams.set('provider',provider);target.searchParams.set('redirect_to',`${origin}/home.html`);
        target.searchParams.set('code_challenge',createHash('sha256').update(verifier).digest('base64url'));target.searchParams.set('code_challenge_method','s256');
        return redirect(res,target.href,{'Set-Cookie':cookie(OAUTH,id,600)});
      }
      if(req.method==='POST'&&['/auth/login','/auth/callback'].includes(route)){
        if(!rateAllowed(req))return json(res,429,{error:'Trop de tentatives. Réessayez dans quinze minutes.'});
        const data=await body(req);let tokens;
        if(route==='/auth/login'){
          if(typeof data.email!=='string'||typeof data.password!=='string'||data.email.length>320||data.password.length>1024)return json(res,400,{error:'Renseignez votre adresse e-mail et votre mot de passe.'});
          tokens=await authFetch('token?grant_type=password',{email:data.email,password:data.password});
        }else{
          const key=hash(getCookie(req,OAUTH)),flow=pending.get(key);pending.delete(key);
          if(!flow||flow.until<=now()||typeof data.code!=='string'||data.code.length>4096)return json(res,401,{error:'Cette connexion a expiré. Recommencez avec Google ou Discord.'});
          tokens=await authFetch('token?grant_type=pkce',{auth_code:data.code,code_verifier:flow.verifier});
        }
        if(!tokens.ok)return json(res,401,{error:'Connexion impossible. Vérifiez vos identifiants ou recommencez la connexion.'});
        const session=await verified(tokens.data);if(!session)return json(res,401,{error:'Votre connexion ne peut pas être vérifiée.'});
        return createSession(res,session);
      }
      if(route==='/atelier'||route.startsWith('/atelier/')){
        if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Méthode indisponible.'});
        const session=await sessionFor(req);if(!session)return redirect(res,'/connexion.html');
        if(route==='/atelier')return redirect(res,'/atelier/');
        const file=route.slice('/atelier/'.length)||'index.html';if(!Object.hasOwn(files,file))return json(res,404,{error:'Page introuvable.'});
        let content=await readFile(path.join(appRoot,file));
        if(file==='index.html')content=Buffer.from(content.toString('utf8').replace('<head>',`<head><meta name="refonte-user" content="${esc(session.userId)}">`));
        res.writeHead(200,{'Content-Type':files[file],'Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:content);
      }
      return json(res,404,{error:'Page introuvable.'});
    }catch(error){
      if([400,404,409,413].includes(error.status))return json(res,error.status,{error:error.message});
      return json(res,503,{error:'Le service est temporairement indisponible. Vos données locales sont conservées ; réessayez dans un instant.'});
    }
  });
  const cleanup=setInterval(()=>{
    for(const [k,v] of sessions)if(v.until<=now())sessions.delete(k);
    for(const map of [pending,attempts])for(const [k,v]of map)if(v.until<=now())map.delete(k);
  },60000);cleanup.unref();server.on('close',()=>clearInterval(cleanup));return server;
}
