const form=document.getElementById('signup-form'),status=document.getElementById('signup-status'),button=document.getElementById('signup'),password=document.getElementById('password'),confirmation=document.getElementById('password-confirmation');
let busy=false;
const validateConfirmation=()=>confirmation.setCustomValidity(confirmation.value&&confirmation.value!==password.value?'Les deux mots de passe doivent être identiques.':'');
password.addEventListener('input',validateConfirmation);confirmation.addEventListener('input',validateConfirmation);
form.addEventListener('submit',async event=>{
  event.preventDefault();validateConfirmation();if(busy||!form.reportValidity())return;
  busy=true;button.disabled=true;status.textContent='Création du compte en cours…';
  try{
    const response=await fetch('/auth/signup',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('username').value.trim(),email:document.getElementById('email').value.trim(),password:password.value,passwordConfirmation:confirmation.value})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'L’inscription est temporairement indisponible. Réessayez.');
    password.value='';confirmation.value='';
    if(!result.confirmationRequired){location.replace('/atelier/');return;}
    status.textContent='';form.hidden=true;const panel=document.getElementById('signup-confirmation');panel.hidden=false;panel.focus();
  }catch(error){status.textContent=error.message==='Failed to fetch'?'Le service ne répond pas. Vos informations n’ont pas été confirmées ; réessayez dans un instant.':error.message;}
  finally{busy=false;button.disabled=false;}
});
fetch('/auth/status',{credentials:'same-origin'}).then(response=>{if(response.ok&&!busy)location.replace('/atelier/');}).catch(()=>{});
