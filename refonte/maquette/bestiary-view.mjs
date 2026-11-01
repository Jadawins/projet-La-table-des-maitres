const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>value===null||value===undefined?'—':value>=0?'+'+value:String(value);
const join=values=>values?.length?values.map(esc).join(', '):'—';
const speedNames={marche:'Marche',nage:'Nage',vol:'Vol',fouissement:'Fouissement',escalade:'Escalade'};
export function renderBestiaryProfile(profile){
  const facts=[['Type',profile.typeLabel],['Taille',profile.size],['FP',profile.cr||'—'],['PV',profile.maxHp??'—'],['CA',profile.ac??'—'],['Dés de vie',profile.hpFormula||'—']];
  const categories=[['Attaques','attacks'],['Actions','actions'],['Actions bonus','bonusActions'],['Réactions','reactions'],['Actions légendaires','legendaryActions'],['Traits','traits']];
  return `<div class="bestiary-profile"><h3>${esc(profile.name)}</h3>${profile.originalName&&profile.originalName!==profile.name?`<p>${esc(profile.originalName)}</p>`:''}
    <dl class="bestiary-facts">${facts.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    <p>${Object.entries(profile.speeds||{}).map(([key,value])=>esc(speedNames[key]||key)+' : '+esc(value)+' m').join(' · ')||'Vitesse non renseignée'}</p>
    <dl class="bestiary-abilities">${Object.entries(profile.abilities||{}).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${value.score??'—'} (${signed(value.modifier)})</dd></div>`).join('')}</dl>
    ${[['Sauvegardes',profile.saves],['Compétences',profile.skills]].map(([name,rows])=>Object.keys(rows||{}).length?`<p><strong>${name}</strong> : ${Object.entries(rows).map(([key,value])=>esc(key)+' '+signed(value)).join(' · ')}</p>`:'').join('')}
    ${[['Résistances',profile.resistances],['Immunités aux dégâts',profile.damageImmunities],['Immunités aux états',profile.conditionImmunities],['Vulnérabilités',profile.vulnerabilities],['Langues',profile.languages]].map(([name,values])=>values?.length?`<p><strong>${name}</strong> : ${join(values)}</p>`:'').join('')}
    ${Object.keys(profile.senses||{}).length?`<p><strong>Sens</strong> : ${Object.entries(profile.senses).map(([key,value])=>esc(key.replaceAll('_',' '))+' '+esc(value)).join(' · ')}</p>`:''}
    ${categories.filter(([,key])=>profile[key]?.length).map(([label,key])=>`<section class="bestiary-actions"><h4>${label}</h4>${profile[key].map(row=>`<details><summary>${esc(row.name)}${row.attackBonus!==null&&row.attackBonus!==undefined?' · attaque '+signed(row.attackBonus):''}${row.damage?' · '+esc(row.damage)+(row.damageType?' '+esc(row.damageType):''):''}</summary>${row.range?`<p>Portée : ${esc(row.range)}</p>`:''}${row.description?`<p>${esc(row.description)}</p>`:'<p>Aucune précision supplémentaire renseignée.</p>'}</details>`).join('')}</section>`).join('')}
    ${profile.descriptionsAbbreviated?'<p>Certains textes longs sont abrégés dans cet aperçu.</p>':''}
    <p class="hint">Profil du bestiaire existant. Les attaques, résistances et aptitudes restent des repères pour le MJ : leurs effets ne sont pas appliqués automatiquement. <a href="/sources.html" target="_blank" rel="noopener">Sources et licences</a></p></div>`;
}

export function mountBestiary(root,{groupId,onAdd,state={}}){
  const controller=new AbortController();let searchController,profileController,selection=null,rows=[],busy=false;
  const base='./api/groupes/'+encodeURIComponent(groupId)+'/bestiaire';
  async function request(path,signal=controller.signal){
    const response=await fetch(base+path,{credentials:'same-origin',cache:'no-store',signal});
    const value=await response.json();if(!response.ok)throw Error(value.error||'Le bestiaire est indisponible.');return value;
  }
  root.innerHTML=`<h2>Ajouter depuis le bestiaire</h2><p>Recherchez un profil, consultez ses repères puis choisissez le nombre d’exemplaires. Ils seront ajoutés cachés aux joueurs.</p>
    <form data-bestiary-search class="bestiary-search"><label>Nom du monstre<input name="q" maxlength="100" type="search" value="${esc(state.q||'')}" placeholder="Gobelin, dragon, loup…"></label>
    <label>Type<select name="type" aria-label="Type de créature"><option value="">Tous les types</option></select></label><label>Taille<select name="size" aria-label="Taille de créature"><option value="">Toutes les tailles</option></select></label>
    <label>FP minimum<input name="min" value="${esc(state.min||'')}" placeholder="0, 1/4, 5…" maxlength="10"></label><label>FP maximum<input name="max" value="${esc(state.max||'')}" placeholder="1, 5, 10…" maxlength="10"></label><button class="button secondary">Rechercher</button></form>
    <p data-bestiary-feedback role="status">Ouverture du bestiaire…</p><p data-bestiary-count></p><div data-bestiary-results class="bestiary-results"></div><button class="button secondary" data-bestiary-more hidden>Afficher la suite</button>
    <div data-bestiary-detail></div>`;
  const form=root.querySelector('form'),feedback=root.querySelector('[data-bestiary-feedback]'),results=root.querySelector('[data-bestiary-results]'),detail=root.querySelector('[data-bestiary-detail]'),more=root.querySelector('[data-bestiary-more]');
  for(const key of ['type','size'])if(state[key]){const option=document.createElement('option');option.value=state[key];option.textContent=state[key];option.selected=true;form.elements[key].append(option);}
  const setState=()=>Object.assign(state,Object.fromEntries(new FormData(form)));
  function filters(data){
    const type=form.elements.type,size=form.elements.size;
    type.innerHTML='<option value="">Tous les types</option>'+data.filters.types.map(row=>`<option value="${esc(row.id)}">${esc(row.label)}</option>`).join('');
    size.innerHTML='<option value="">Toutes les tailles</option>'+data.filters.sizes.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
    type.value=state.type||'';size.value=state.size||'';
  }
  function renderResults(){
    results.innerHTML=rows.map(row=>`<article class="bestiary-result"><div><strong>${esc(row.name)}</strong><p>${esc(row.typeLabel)} · ${esc(row.size)} · FP ${esc(row.cr||'—')} · PV ${row.maxHp??'—'} · CA ${row.ac??'—'}</p></div><button type="button" class="button secondary" data-bestiary-id="${esc(row.id)}" aria-label="Voir le profil de ${esc(row.name)}">Voir le profil</button></article>`).join('')||'<p>Aucun monstre ne correspond à ces filtres.</p>';
    results.querySelectorAll('[data-bestiary-id]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.bestiaryId)));
  }
  async function search(append=false){
    if(controller.signal.aborted)return;
    searchController?.abort();if(!append)profileController?.abort();searchController=new AbortController();
    const current=searchController;controller.signal.addEventListener('abort',()=>current.abort(),{once:true});
    const offset=append?rows.length:0;
    if(!append){setState();selection=null;detail.innerHTML='';rows=[];results.innerHTML='';root.querySelector('[data-bestiary-count]').textContent='';}
    const query=new URLSearchParams({q:state.q||'',type:state.type||'',size:state.size||'',fp_min:state.min||'',fp_max:state.max||'',offset:String(offset)});
    feedback.textContent='Recherche…';more.disabled=true;
    try{
      const data=await request('?'+query,current.signal);if(current.signal.aborted)return;
      filters(data);rows=append?[...rows,...data.monsters]:data.monsters;renderResults();more.hidden=!data.hasMore;
      root.querySelector('[data-bestiary-count]').textContent=data.total+' résultat'+(data.total>1?'s':'')+' · '+data.available+' profils dans le bestiaire';
      feedback.textContent='';
    }catch(error){if(!current.signal.aborted){feedback.textContent=error.message+' Vous pouvez réessayer ou saisir un adversaire manuellement.';more.hidden=true;}}
    finally{if(!current.signal.aborted)more.disabled=false;}
  }
  async function select(id){
    profileController?.abort();profileController=new AbortController();const current=profileController;controller.signal.addEventListener('abort',()=>current.abort(),{once:true});
    selection=null;detail.innerHTML='<p>Ouverture du profil…</p>';
    try{
      const {monster}=await request('/'+encodeURIComponent(id),current.signal);if(current.signal.aborted)return;selection=monster;
      detail.innerHTML=renderBestiaryProfile(monster)+`<form data-bestiary-add><label>Nombre d’exemplaires<input name="quantity" type="number" min="1" max="20" value="1" required></label><button class="button primary" ${monster.usable?'':'disabled'}>Ajouter au combat</button></form>${monster.usable?'':'<p>PV ou CA incomplets : utilisez la saisie manuelle pour ce profil.</p>'}`;
      detail.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();if(busy||!selection?.usable)return;busy=true;
        const button=detail.querySelector('button'),quantity=Number(detail.querySelector('input').value);button.disabled=true;
        try{await onAdd({type:'add-bestiary',monsterId:selection.id,quantity});}
        catch(error){if(!controller.signal.aborted)feedback.textContent=error.message;}
        finally{busy=false;if(!controller.signal.aborted)button.disabled=false;}
      });
    }catch(error){if(!current.signal.aborted)detail.innerHTML='<p role="status">'+esc(error.message)+'</p>';}
  }
  form.addEventListener('submit',event=>{event.preventDefault();search();});more.addEventListener('click',()=>search(true));search();
  return ()=>{controller.abort();searchController?.abort();profileController?.abort();};
}
