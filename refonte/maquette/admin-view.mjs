import {escapeHTML as esc} from './portal-view.mjs';
const normalize=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function renderAdminCharacters(directory,query=''){
  const owner=id=>directory.accounts.find(a=>a.id===id)?.email||'Compte non répertorié';
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  const rows=directory.characters.filter(c=>terms.every(term=>normalize([c.name,c.classId,owner(c.ownerId)].join(' ')).includes(term)));
  return rows.map(c=>`<article class="portal-card" data-admin-character="${esc(c.id)}"><h3>${esc(c.name)}</h3><p>${esc(c.classId||'Classe à choisir')} · Niveau ${esc(c.level)} · ${c.status==='ready'?'Fiche finalisée':'Brouillon en ligne'}</p><p>${esc(owner(c.ownerId))}</p><a class="button secondary" href="#admin/ouvrir/${encodeURIComponent(c.ownerId)}/${encodeURIComponent(c.id)}">Ouvrir la fiche</a></article>`).join('')||'<p>Aucune fiche ne correspond à votre recherche.</p>';
}
export function renderAdmin(metrics,directory){
  const account=id=>directory.accounts.find(a=>a.id===id)?.email||'Compte non répertorié';
  return `<p class="eyebrow">ADMINISTRATION</p><h1>Le site en un regard</h1><button type="button" class="button secondary" id="admin-refresh">Actualiser</button><p id="admin-refresh-status" class="hint" role="status">Actualisation automatique toutes les 30 secondes.</p><div class="portal-grid">${[['Comptes inscrits','accounts',metrics.accounts],['Personnages','characters',metrics.characters],['Fiches finalisées','ready',metrics.ready],['Brouillons en ligne','drafts',metrics.drafts],['Créés ces 7 derniers jours','recent',metrics.recent],['Personnages supprimés','deleted',metrics.deleted]].map(([label,key,value])=>`<article class="portal-card"><h2>${esc(label)}</h2><p class="admin-metric" data-admin-metric="${key}">${esc(value??'—')}</p></article>`).join('')}</div><p class="hint">Inscriptions, y compris les comptes qui ne se sont pas encore connectés, et fiches conservées en ligne. Les brouillons sur les ordinateurs ne sont pas comptabilisés.</p><p id="admin-accounts-status" class="hint" role="status">${esc(metrics.accountsWarning||'')}</p><h2>Répartition des personnages</h2><ul id="admin-class-counts">${metrics.classes.map(c=>`<li>${esc(c.id||'Classe à choisir')} : ${c.count}</li>`).join('')||'<li>Aucun personnage.</li>'}</ul><h2>Toutes les fiches</h2><p>Consultez et complétez les fiches dans le compte de leur joueur.</p><label class="field">Rechercher une fiche<input type="search" id="admin-character-search" placeholder="Nom, classe ou compte du joueur…"></label><div id="admin-characters" class="portal-grid">${renderAdminCharacters(directory)}</div><h2>Attribuer une fiche à un compte</h2><p>Une copie conserve l’original. Un transfert déplace la fiche vers le compte destinataire.</p><p id="admin-directory-status" class="hint">${esc(directory.accountsWarning||'')}</p><form id="admin-assignment" class="portal-card"><label class="field">Personnage<select id="admin-source" required><option value="">Choisir une fiche</option>${directory.characters.map((c,index)=>`<option value="${index}">${esc(c.name)} · niveau ${esc(c.level)} · ${esc(account(c.ownerId))}</option>`).join('')}</select></label><label class="field">Compte destinataire<select id="admin-target" required><option value="">Choisir un compte existant</option>${directory.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.email||a.name)}</option>`).join('')}</select></label><label class="field">Action<select id="admin-mode"><option value="copy">Créer une copie pour ce compte</option><option value="move">Transférer la fiche à ce compte</option></select></label><p>Le contenu de la fiche est conservé sans recalculer ses choix.</p><button class="button primary" type="submit">Vérifier l’attribution</button><p id="admin-feedback" role="status"></p></form><p class="hint">${directory.limit} comptes et fiches au maximum dans cette liste. Règles : ${esc(metrics.rulesVersion)}. <span id="admin-updated">Actualisé le ${esc(new Date(metrics.generatedAt).toLocaleString('fr-FR'))}.</span></p>`;
}
export async function adminRequest(path,body,{signal}={}){
  const response=await fetch(`./api/admin/${path}`,{cache:'no-store',signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Administration indisponible. Réessayez.');return data;
}
const mounts=new WeakMap();
export async function mountAdmin(root){
  mounts.get(root)?.dispose();
  const controller=new AbortController();let timer,button,directory;
  const mounted={dispose(){clearTimeout(timer);controller.abort();window.removeEventListener('hashchange',onRoute);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);if(mounts.get(root)===mounted)mounts.delete(root);}};
  const active=()=>mounts.get(root)===mounted&&location.hash==='#admin';
  const onRoute=()=>{if(location.hash!=='#admin')mounted.dispose();};
  const onFocus=()=>{if(active()&&!document.hidden)refresh();};
  mounts.set(root,mounted);window.addEventListener('hashchange',onRoute);
  root.innerHTML='<h1>Administration</h1><p role="status">Chargement des informations…</p>';
  const request=path=>adminRequest(path,undefined,{signal:controller.signal});
  function update(metrics,next){
    for(const node of root.querySelectorAll('[data-admin-metric]'))node.textContent=metrics[node.dataset.adminMetric]??'—';
    root.querySelector('#admin-accounts-status').textContent=metrics.accountsWarning||'';
    root.querySelector('#admin-directory-status').textContent=next.accountsWarning||'';
    root.querySelector('#admin-updated').textContent='Actualisé le '+new Date(metrics.generatedAt).toLocaleString('fr-FR')+'.';
    root.querySelector('#admin-class-counts').innerHTML=metrics.classes.map(c=>`<li>${esc(c.id||'Classe à choisir')} : ${c.count}</li>`).join('')||'<li>Aucun personnage.</li>';
    const source=root.querySelector('#admin-source'),target=root.querySelector('#admin-target'),old=source.value===''?null:directory.characters[Number(source.value)],targetId=target.value;
    const owner=id=>next.accounts.find(a=>a.id===id)?.email||'Compte non répertorié';
    source.innerHTML='<option value="">Choisir une fiche</option>'+next.characters.map((c,index)=>`<option value="${index}">${esc(c.name)} · niveau ${esc(c.level)} · ${esc(owner(c.ownerId))}</option>`).join('');
    const index=old?next.characters.findIndex(c=>c.id===old.id&&c.ownerId===old.ownerId):-1;source.value=index<0?'':String(index);
    target.innerHTML='<option value="">Choisir un compte existant</option>'+next.accounts.map(a=>`<option value="${esc(a.id)}">${esc(a.email||a.name)}</option>`).join('');
    target.value=next.accounts.some(a=>a.id===targetId)?targetId:'';directory=next;
    root.querySelector('#admin-characters').innerHTML=renderAdminCharacters(directory,root.querySelector('#admin-character-search').value);
  }
  function schedule(){clearTimeout(timer);if(active())timer=setTimeout(()=>{if(active()&&!document.hidden)refresh();else if(active())schedule();else mounted.dispose();},30000);}
  async function refresh(){
    if(!active()||!button||button.disabled)return;
    button.disabled=true;root.querySelector('#admin-refresh-status').textContent='Actualisation…';
    try{
      const [metrics,next]=await Promise.all([request('metrics'),request('directory')]);if(!active())return;
      update(metrics,next);root.querySelector('#admin-refresh-status').textContent='Données actualisées. Actualisation automatique toutes les 30 secondes.';
    }catch{if(active())root.querySelector('#admin-refresh-status').textContent='Actualisation impossible. Les dernières données affichées sont conservées ; réessayez.';}
    finally{if(active()){button.disabled=false;schedule();}}
  }
  try{
    const [metrics,next]=await Promise.all([request('metrics'),request('directory')]);if(!active())return;
    directory=next;root.innerHTML=renderAdmin(metrics,directory);button=root.querySelector('#admin-refresh');button.onclick=refresh;
    root.querySelector('#admin-character-search').oninput=event=>{root.querySelector('#admin-characters').innerHTML=renderAdminCharacters(directory,event.target.value);};
    window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);schedule();
    root.querySelector('#admin-assignment').addEventListener('submit',event=>{
      event.preventDefault();
      const sourceValue=root.querySelector('#admin-source').value,source=sourceValue===''?null:directory.characters[Number(sourceValue)],targetId=root.querySelector('#admin-target').value,mode=root.querySelector('#admin-mode').value;
      const feedback=root.querySelector('#admin-feedback');
      if(!source||!targetId||source.ownerId===targetId){feedback.textContent='Choisissez une fiche et un autre compte destinataire.';return;}
      const target=directory.accounts.find(a=>a.id===targetId),dialog=document.createElement('dialog');
      dialog.className='portal-dialog';dialog.innerHTML=`<h2>${mode==='copy'?'Copier':'Transférer'} cette fiche ?</h2><p><strong>${esc(source.name)}</strong> sera ${mode==='copy'?'copié':'transféré'} vers <strong>${esc(target.email||target.name)}</strong>.</p>${mode==='move'?'<p>Le compte actuel n’aura plus accès à cette fiche.</p>':''}<p role="status"></p><div class="portal-actions"><button class="button secondary" data-cancel>Annuler</button><button class="button primary" data-confirm>Confirmer l’attribution</button></div>`;
      document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      const requestId=crypto.randomUUID();
      dialog.querySelector('[data-confirm]').onclick=async event=>{
        event.target.disabled=true;
        try{await adminRequest('assign',{id:source.id,ownerId:source.ownerId,revision:source.revision,targetId,mode,requestId});dialog.close();if(active()){await mountAdmin(root);const feedback=root.querySelector('#admin-feedback');if(feedback)feedback.textContent='Attribution effectuée.';}}
        catch(error){dialog.querySelector('[role="status"]').textContent=error.message;event.target.disabled=false;}
      };
    });
  }catch(error){
    if(!active())return;
    root.innerHTML=`<h1>Administration indisponible</h1><p role="alert">${esc(error.message)}</p><button class="button secondary" id="admin-retry">Réessayer</button>`;root.querySelector('#admin-retry').onclick=()=>mountAdmin(root);
  }
}
