import {mountPotions} from './potion-combat-view.mjs';
import {mountSpells} from './spell-combat-view.mjs';
import {mountAttacks} from './attack-view.mjs';
import {mountBestiary,renderBestiaryProfile} from './bestiary-view.mjs';
import {CONDITIONS} from './condition-rules.mjs';
const mounts=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={preparing:'Préparation',running:'En cours',paused:'En pause',finished:'Terminé'};
export function disposeCombat(root){mounts.get(root)?.();mounts.delete(root);}
export function mountCombat(root,{groupId}){
  disposeCombat(root);const controller=new AbortController();let state,busy=false,notice='',timer,disposeBestiary,disposeAttacks,disposeSpells,disposePotions;const bestiaryState={},attackUI={},spellUI={},potionUI={};
  const stop=()=>{controller.abort();clearInterval(timer);disposeBestiary?.();disposeAttacks?.();disposeSpells?.();disposePotions?.();};mounts.set(root,stop);
  async function request(data){
    const response=await fetch('./api/groupes/'+encodeURIComponent(groupId)+'/combat',{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
      ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
    const value=await response.json();if(!response.ok){const error=Error(value.error||'Le combat est indisponible.');error.status=response.status;throw error;}return value;
  }
  function feedback(message){const box=root.querySelector('[data-combat-feedback]');if(box)box.textContent=message;}
  async function run(work){
    if(busy)return;busy=true;root.setAttribute('aria-busy','true');const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{state=await work();notice='Enregistré.';render();}
    catch(error){if(!controller.signal.aborted){if(error.status===404||error.status===401){stop();root.innerHTML='<h1>Combat inaccessible</h1><p>'+esc(error.message)+'</p><a href="#groupes">Mes groupes →</a>';}
      else feedback(error.message+' Utilisez Actualiser avant de recommencer si une fiche ou le combat a changé.');}}
    finally{busy=false;root.setAttribute('aria-busy','false');if(!controller.signal.aborted)buttons.forEach(b=>b.disabled=false);}
  }
  function healthForm(p){
    if(!p.canEdit||p.unavailable||state.combat.status==='finished')return '';
    if(!p.started)return `<form data-combat-form="health" data-person="${p.id}"><input type="hidden" name="operation" value="start"><label>PV actuels pour commencer le suivi<input aria-label="PV actuels de ${esc(p.name)}" name="amount" type="number" min="0" max="${p.maxHp}" required value="${p.maxHp}"></label><button class="button secondary">Commencer le suivi</button></form>`;
    return `<form data-combat-form="health" data-person="${p.id}"><label>Action<select name="operation" aria-label="Action pour ${esc(p.name)}"><option value="damage">Dégâts</option><option value="heal">Soins</option><option value="set-temp">Fixer les PV temporaires</option><option value="set-current">Corriger les PV actuels</option></select></label><label>Montant<input name="amount" aria-label="Montant pour ${esc(p.name)}" type="number" min="0" max="100000" required></label><label>Échecs de mort si dégâts à 0 PV<select name="deathFailures"><option value="0">0</option><option value="1">1</option><option value="2">2 (critique)</option></select></label><button class="button secondary">Appliquer les PV</button></form>
      <form data-combat-form="condition" data-person="${p.id}"><label>État<select name="condition" aria-label="État de ${esc(p.name)}">${CONDITIONS.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Modification<select name="active"><option value="true">Ajouter</option><option value="false">Retirer</option></select></label><button class="button secondary">Appliquer l’état</button></form>
      ${p.currentHp===0&&p.life!=='dead'?`<form data-combat-form="death" data-person="${p.id}"><label>d20 naturel<input name="die" type="number" min="1" max="20" required></label><label>Modificateur hors Épuisement<input name="modifier" type="number" min="-100" max="100" value="0" required></label><button class="button secondary">Enregistrer le jet de mort</button><button type="button" class="button secondary" data-combat-action="stabilize" data-person="${p.id}">Stabiliser</button></form>`:''}`;
  }
  function participant(p,index,rows){
    const editable=p.canEdit&&state.combat.status!=='finished';
    return `<article class="combat-participant ${p.current?'combat-current':''}" data-participant="${p.id}"><header><div><span class="eyebrow">${p.kind==='pc'?'PERSONNAGE':'ADVERSAIRE'}${state.isMJ&&p.kind==='npc'&&!p.visible?' · CACHÉ AUX JOUEURS':''}</span><h2>${esc(p.name)}${p.current?' · Tour en cours':''}</h2></div><div class="combat-initiative">${p.initiative??'—'}<small>Initiative</small></div></header>
      ${p.unavailable?'<p>Fiche indisponible ou personnage détaché du groupe. Le MJ peut le retirer du combat après une pause.</p>':`<p>${p.canEdit?`PV : <strong>${p.started?p.currentHp:'À initialiser'} / ${p.maxHp}</strong> · PV temporaires : ${p.tempHp} · CA : ${p.ac??'—'}`:'Les PV et la CA sont réservés au propriétaire et au MJ.'}</p>
      <p>${p.conditions.length?p.conditions.map(c=>esc(c.name)+(c.implicit?' (induit)':'')).join(' · '):'Aucun état'}</p>
      ${p.canEdit&&p.deathSaves&&p.currentHp===0?`<p>Jets contre la mort : ${p.deathSaves.successes} succès · ${p.deathSaves.failures} échecs${p.deathSaves.stable?' · Stabilisé':''}${p.deathSaves.dead?' · Mort déclarée':''}</p>`:''}
      ${p.canEdit?`<p>Épuisement : ${p.exhaustion}. ${p.concentration?'Concentration déclarée : '+esc(p.concentration):'Aucune concentration déclarée.'}</p>`:''}
      ${p.canEdit&&p.concentration&&p.conditions.some(c=>c.id==='incapacitated')?'<p class="combat-warning">Neutralisé : interrompez la concentration déclarée.</p>':''}
      ${state.isMJ&&p.bestiary?`<details class="bestiary-snapshot"><summary>Profil du bestiaire utilisé</summary>${renderBestiaryProfile(p.bestiary)}</details>`:''}
      ${editable?`<details><summary>Gérer ce participant</summary>${state.combat.status!=='running'?`<form data-combat-form="initiative" data-person="${p.id}"><label>Total d’initiative ${p.initiativeBonus!==undefined?`(bonus de la fiche : ${p.initiativeBonus>=0?'+':''}${p.initiativeBonus??'—'})`:''}<input name="value" aria-label="Initiative de ${esc(p.name)}" type="number" min="-100" max="100" required value="${p.initiative??''}"></label><button class="button secondary">Enregistrer l’initiative</button></form>`:''}
      ${healthForm(p)}${p.concentrationTracker?'<p class="hint">Cette concentration est reliée au sort. Utilisez le panneau Sorts et concentration pour la résoudre ou la terminer.</p>':`<form data-combat-form="concentration" data-person="${p.id}"><label>Concentration — suivi manuel<input name="value" maxlength="100" value="${esc(p.concentration)}" placeholder="Nom du sort, ou vide pour arrêter"></label><button class="button secondary">Enregistrer la concentration</button></form><p class="hint">Ce repère manuel ne crée pas d’effet de sort. Les sorts reliés se suivent dans le panneau ci-dessus.</p>`}</details>`:''}`}
      ${state.isMJ&&state.combat.status!=='finished'?`<div class="portal-actions">${p.kind==='npc'?`<button class="button secondary" data-combat-action="visible" data-person="${p.id}">${p.visible?'Masquer aux joueurs':'Révéler aux joueurs'}</button>`:''}${state.combat.status!=='running'?`<button class="button secondary" data-combat-action="remove" data-person="${p.id}">Retirer du combat</button>${index>0&&p.initiative!==null&&rows[index-1].initiative===p.initiative?`<button class="button secondary" data-combat-action="tie" data-person="${p.id}">Passer avant à égalité</button>`:''}`:''}</div>`:''}</article>`;
  }
  function render(){
    if(controller.signal.aborted)return;
    disposeBestiary?.();disposeAttacks?.();disposeSpells?.();disposePotions?.();
    const expanded=new Map([...root.querySelectorAll('.combat-participant')].map(node=>[node.dataset.participant,[...node.querySelectorAll(':scope > details')].map(detail=>detail.open)]));
    const combat=state.combat;
    root.innerHTML=`<a class="back" href="#groupes/${esc(groupId)}">← ${esc(state.groupName)}</a><p class="eyebrow">VOTRE TABLE · COMBAT</p><h1>${esc(combat?.name||'Préparer un combat')}</h1><p data-combat-feedback role="status">${esc(notice)}</p>${state.spellWarning?'<p class="combat-warning">'+esc(state.spellWarning)+'</p>':''}
      <div class="portal-actions"><button class="button secondary" data-combat-action="refresh">Actualiser</button></div>
      ${!combat||combat.status==='finished'?`${combat?'<p>Combat terminé. Les PV et les états restent conservés dans les fiches.</p>':''}${state.isMJ?'<section class="portal-card"><h2>Nouveau combat</h2><form data-combat-form="create"><label class="field">Nom du combat<input name="name" maxlength="100" required></label><button class="button primary">Préparer le combat</button></form></section>':'<p>Le MJ prépare le prochain combat du groupe.</p>'}`:''}
      ${combat?`<section class="combat-status portal-card"><strong>${statuses[combat.status]} · Round ${combat.round}</strong><p>${combat.status==='running'?combat.currentId?'Tour de '+esc(combat.participants.find(p=>p.id===combat.currentId)?.name):'Tour géré par le MJ.':'Les résultats des dés sont saisis manuellement. Les égalités se règlent en préparation ou en pause.'}</p>
      ${state.isMJ?`<div class="portal-actions">${combat.status==='preparing'?'<button class="button primary" data-combat-action="start">Démarrer le combat</button>':''}${combat.status==='running'?'<button class="button secondary" data-combat-action="previous">Tour précédent</button><button class="button primary" data-combat-action="next">Tour suivant</button><button class="button secondary" data-combat-action="pause">Mettre en pause</button>':''}${combat.status==='paused'?'<button class="button primary" data-combat-action="resume">Reprendre le combat</button>':''}${combat.status!=='finished'?'<button class="button secondary" data-combat-action="finish">Terminer le combat</button>':''}</div>`:''}</section>
      ${state.isMJ&&['preparing','paused'].includes(combat.status)?`<section class="portal-card combat-prep"><h2>Participants</h2><button class="button secondary" data-combat-action="sync">Ajouter les personnages rattachés</button><form data-combat-form="npc"><label>Nom de l’adversaire<input name="name" maxlength="100" required></label><label>PV maximum<input name="maxHp" type="number" min="1" max="100000" required></label><label>Classe d’armure<input name="ac" type="number" min="0" max="100" required></label><button class="button secondary">Ajouter l’adversaire</button></form><p>Les nouveaux adversaires sont cachés aux joueurs jusqu’à leur révélation.</p></section><section class="portal-card combat-prep" data-bestiary-panel></section>`:''}
      <section class="portal-card combat-attacks" data-attack-panel></section>${state.spellsAvailable?'<section class="portal-card combat-spells" data-spell-panel></section>':''}${state.potionsAvailable?'<section class="portal-card combat-potions" data-potion-panel></section>':''}<div class="combat-participants">${combat.participants.map(participant).join('')||'<p>Aucun participant visible pour le moment.</p>'}</div>
      ${state.isMJ?`<details class="portal-card"><summary>Journal du MJ</summary><ul>${combat.journal.map(event=>`<li>${esc(new Date(event.at).toLocaleTimeString('fr-FR'))} · ${esc(event.message)}</li>`).join('')}</ul></details>`:''}`:''}`;
    root.querySelectorAll('.combat-participant').forEach(node=>node.querySelectorAll(':scope > details').forEach((detail,index)=>detail.open=expanded.get(node.dataset.participant)?.[index]||false));
    bind();
    const potionPanel=root.querySelector('[data-potion-panel]');if(potionPanel)disposePotions=mountPotions(potionPanel,{groupId,state,ui:potionUI,onState:fresh=>{state=fresh;notice='Suivi de potion actualisé.';render();}});
    const spellPanel=root.querySelector('[data-spell-panel]');if(spellPanel)disposeSpells=mountSpells(spellPanel,{groupId,state,ui:spellUI,onState:fresh=>{state=fresh;notice='Résolution de sort enregistrée.';render();}});
    const attackPanel=root.querySelector('[data-attack-panel]');if(attackPanel)disposeAttacks=mountAttacks(attackPanel,{groupId,combat:state.combat,isMJ:state.isMJ,ui:attackUI,onState:fresh=>{state=fresh;notice='Jet enregistré. Les dégâts sont appliqués uniquement après confirmation du MJ.';render();}});
    const panel=root.querySelector('[data-bestiary-panel]');if(panel)disposeBestiary=mountBestiary(panel,{groupId,state:bestiaryState,onAdd:data=>run(()=>act(data))});
  }
  function act(data){return request({...data,combatId:state.combat.id,revision:state.combat.revision});}
  function bind(){
    root.querySelectorAll('form[data-combat-form]').forEach(form=>form.addEventListener('submit',event=>{
      event.preventDefault();const data=Object.fromEntries(new FormData(form)),kind=form.dataset.combatForm;
      const p=state.combat?.participants.find(p=>p.id===form.dataset.person);
      run(()=>{
        if(kind==='create')return request({type:'create',name:data.name});
        if(kind==='npc')return act({type:'add-npc',name:data.name,maxHp:Number(data.maxHp),ac:Number(data.ac)});
        if(kind==='initiative'||kind==='concentration')return act({type:kind,participantId:p.id,value:kind==='initiative'?Number(data.value):data.value});
        let action;
        if(kind==='health')action=data.operation==='start'?{type:'start',currentHp:Number(data.amount)}:{type:data.operation,amount:Number(data.amount),deathFailures:Number(data.deathFailures)};
        if(kind==='condition')action={type:'set-condition',condition:data.condition,active:data.active==='true'};
        if(kind==='death')action={type:'death-roll',die:Number(data.die),modifier:Number(data.modifier)};
        return act({type:'health',participantId:p.id,characterRevision:p.characterRevision,action});
      });
    }));
    root.querySelectorAll('[data-combat-action]').forEach(button=>button.addEventListener('click',()=>{
      const type=button.dataset.combatAction,p=state.combat?.participants.find(p=>p.id===button.dataset.person);
      if(type==='refresh'){run(()=>request());return;}
      if(['finish','remove'].includes(type)&&!confirm(type==='finish'?'Terminer ce combat ? Les fiches conserveront leurs PV et états.':'Retirer ce participant du combat ? Sa fiche reste conservée.'))return;
      run(()=>act(type==='stabilize'?{type:'health',participantId:p.id,characterRevision:p.characterRevision,action:{type:'stabilize'}}:
        {type,participantId:p?.id,...(type==='visible'?{value:!p.visible}:{}),...(type==='finish'?{confirmed:true}:{})}));
    }));
  }
  root.innerHTML='<h1>Combat</h1><p data-combat-feedback role="status">Ouverture du combat…</p>';
  run(()=>request());
  timer=setInterval(async()=>{
    if(busy||document.hidden||root.contains(document.activeElement)&&document.activeElement.closest('form,details[open],[data-bestiary-panel],[data-attack-panel],[data-spell-panel],[data-potion-panel]'))return;
    busy=true;
    try{const fresh=await request();if(!controller.signal.aborted&&!(root.contains(document.activeElement)&&document.activeElement.closest('form,details[open],[data-bestiary-panel],[data-attack-panel],[data-spell-panel],[data-potion-panel]'))&&JSON.stringify(fresh)!==JSON.stringify(state)){state=fresh;render();}}
    catch(error){if(!controller.signal.aborted){if([401,404].includes(error.status)){stop();root.innerHTML='<h1>Combat inaccessible</h1><p>'+esc(error.message)+'</p><a href="#groupes">Mes groupes →</a>';}else feedback('Actualisation indisponible. Les dernières valeurs restent affichées.');}}
    finally{busy=false;}
  },5000);
}
