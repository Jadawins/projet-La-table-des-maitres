import {escapeHTML as esc} from './portal-view.mjs';
export function renderAdmin(metrics,directory){
  const account=id=>directory.accounts.find(a=>a.id===id)?.email||'Compte non répertorié';
  return `<p class="eyebrow">ADMINISTRATION</p><h1>Le site en un regard</h1><div class="portal-grid">${[['Comptes',metrics.accounts],['Personnages',metrics.characters],['Fiches finalisées',metrics.ready],['Brouillons en ligne',metrics.drafts],['Créés ces 7 derniers jours',metrics.recent],['Personnages supprimés',metrics.deleted]].map(([label,value])=>`<article class="portal-card"><h2>${esc(label)}</h2><p class="admin-metric">${esc(value)}</p></article>`).join('')}</div><p class="hint">Comptes enregistrés par le site et fiches conservées en ligne. Les brouillons sur les ordinateurs ne sont pas comptabilisés.</p><h2>Répartition des personnages</h2><ul>${metrics.classes.map(c=>`<li>${esc(c.id||'Classe à choisir')} : ${c.count}</li>`).join('')||'<li>Aucun personnage.</li>'}</ul><h2>Attribuer une fiche à un compte</h2><p>Une copie conserve l’original. Un transfert déplace la fiche vers le compte destinataire.</p><form id="admin-assignment" class="portal-card"><label class="field">Personnage<select id="admin-source" required><option value="">Choisir une fiche</option>${directory.characters.map((c,index)=>`<option value="${index}">${esc(c.name)} · niveau ${esc(c.level)} · ${esc(account(c.ownerId))}</option>`).join('')}</select></label><label class="field">Compte destinataire<select id="admin-target" required><option value="">Choisir un compte existant</option>${directory.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.email||a.name)}</option>`).join('')}</select></label><label class="field">Action<select id="admin-mode"><option value="copy">Créer une copie pour ce compte</option><option value="move">Transférer la fiche à ce compte</option></select></label><p>Le contenu de la fiche est conservé sans recalculer ses choix.</p><button class="button primary" type="submit">Vérifier l’attribution</button><p id="admin-feedback" role="status"></p></form><p class="hint">${directory.limit} comptes et fiches au maximum dans cette liste. Règles : ${esc(metrics.rulesVersion)}. Actualisé le ${esc(new Date(metrics.generatedAt).toLocaleString('fr-FR'))}.</p>`;
}
export async function adminRequest(path,body){const response=await fetch(`./api/admin/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw Error(data.error||'Administration indisponible. Réessayez.');return data;}
export async function mountAdmin(root){
  root.innerHTML='<h1>Administration</h1><p role="status">Chargement des informations…</p>';
  try{
    const [metrics,directory]=await Promise.all([adminRequest('metrics'),adminRequest('directory')]);
    if(location.hash!=='#admin')return;
    root.innerHTML=renderAdmin(metrics,directory);
    root.querySelector('#admin-assignment').addEventListener('submit',event=>{
      event.preventDefault();
      const source=directory.characters[Number(root.querySelector('#admin-source').value)],targetId=root.querySelector('#admin-target').value,mode=root.querySelector('#admin-mode').value;
      const feedback=root.querySelector('#admin-feedback');
      if(!source||!targetId||source.ownerId===targetId){feedback.textContent='Choisissez une fiche et un autre compte destinataire.';return;}
      const target=directory.accounts.find(a=>a.id===targetId),dialog=document.createElement('dialog');
      dialog.className='portal-dialog';dialog.innerHTML=`<h2>${mode==='copy'?'Copier':'Transférer'} cette fiche ?</h2><p><strong>${esc(source.name)}</strong> sera ${mode==='copy'?'copié':'transféré'} vers <strong>${esc(target.email||target.name)}</strong>.</p>${mode==='move'?'<p>Le compte actuel n’aura plus accès à cette fiche.</p>':''}<p role="status"></p><div class="portal-actions"><button class="button secondary" data-cancel>Annuler</button><button class="button primary" data-confirm>Confirmer l’attribution</button></div>`;
      document.body.append(dialog);dialog.showModal();
      dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      const requestId=crypto.randomUUID();
      dialog.querySelector('[data-confirm]').onclick=async event=>{event.target.disabled=true;try{await adminRequest('assign',{id:source.id,ownerId:source.ownerId,revision:source.revision,targetId,mode,requestId});dialog.close();await mountAdmin(root);root.querySelector('#admin-feedback').textContent='Attribution effectuée.';}catch(error){dialog.querySelector('[role="status"]').textContent=error.message;event.target.disabled=false;}};
    });
  }catch(error){if(location.hash!=='#admin')return;root.innerHTML=`<h1>Administration indisponible</h1><p role="alert">${esc(error.message)}</p><button class="button secondary" id="admin-retry">Réessayer</button>`;root.querySelector('#admin-retry').onclick=()=>mountAdmin(root);}
}
