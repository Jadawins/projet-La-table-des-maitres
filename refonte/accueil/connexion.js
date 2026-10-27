const form=document.getElementById('connection-form');
const status=document.getElementById('login-status');
const button=document.getElementById('connect');
let busy=false;
async function connect(route,data){
  if(busy)return;busy=true;button.disabled=true;status.textContent='Connexion en cours…';
  try{
    const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'same-origin'});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Connexion impossible pour le moment.');
    document.getElementById('password').value='';location.replace('/atelier/');
  }catch(error){status.textContent=error.message==='Failed to fetch'?'Le service ne répond pas. Réessayez dans un instant.':error.message;}
  finally{busy=false;button.disabled=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();connect('/auth/login',{email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});});
const query=new URLSearchParams(location.search),code=query.get('code');
if(code){history.replaceState(null,'','/connexion.html');connect('/auth/callback',{code});}
else if(query.has('error')){history.replaceState(null,'','/connexion.html');status.textContent='La connexion a été annulée ou n’a pas abouti. Vous pouvez réessayer.';}
else fetch('/auth/status',{credentials:'same-origin'}).then(response=>{if(response.ok)location.replace('/atelier/');}).catch(()=>{});
