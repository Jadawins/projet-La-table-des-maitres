const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const outcomeNames={miss:'Ratée',hit:'Touche',critical:'Critique'};
const stageNames={rolled:'Jet de toucher enregistré',ready:'En attente de validation du MJ',applied:'Résultat confirmé par le MJ',uncertain:'PV à vérifier — aucune nouvelle application automatique'};
const signed=n=>Number(n)>=0?'+'+n:String(n);
function chips(dice){return `<div class="attack-dice">${dice.map(d=>`<span class="attack-die${d.kept===false?' attack-discarded':''}"><strong>${d.value}</strong><small>d${d.sides}${d.kept===false?' · écarté':''}</small></span>`).join('')}</div>`;}
function formula(plan){return plan.dice.map(d=>d.count+'d'+d.sides).join(' + ')+(plan.flat?((plan.dice.length?' ':'')+signed(plan.flat)):plan.dice.length?'':'0');}
export function mountAttacks(root,{groupId,combat,isMJ,onState,ui={}}){
  const controller=new AbortController();let options,busy=false;
  const account=document.querySelector('meta[name="refonte-user"]')?.content||'local';
  const key='myrpgtable.attack-dice.'+account;
  let preferences={attack:'physical',damage:'physical'};
  try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const phase of ['attack','damage'])if(['physical','app'].includes(saved[phase]))preferences[phase]=saved[phase];}catch{}
  const savePreference=(phase,value)=>{preferences[phase]=value;try{localStorage.setItem(key,JSON.stringify(preferences));}catch{}};
  const endpoint='./api/groupes/'+encodeURIComponent(groupId)+'/combat/attaques';
  async function api(input){
    const response=await fetch(endpoint+(typeof input==='string'?'?attacker='+encodeURIComponent(input):''),{method:typeof input==='string'?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,
      ...(typeof input==='string'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Le jet est indisponible.');return result;
  }
  function feedback(message){const target=root.querySelector('[data-attack-feedback]');if(target)target.textContent=message;}
  async function work(task){
    if(busy)return;busy=true;root.setAttribute('aria-busy','true');const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{const result=await task();if(controller.signal.aborted)return;if(result?.state){ui.openTicket=result.ticket?.id||'';onState(result.state);} }
    catch(error){if(!controller.signal.aborted)feedback(error.message);}
    finally{busy=false;if(!controller.signal.aborted){root.setAttribute('aria-busy','false');buttons.forEach(b=>b.disabled=false);}}
  }
  const modeSelect=(phase)=>`<label>Quels dés pour ${phase==='attack'?'toucher':'les dégâts'} ?<select name="mode" data-dice-phase="${phase}" aria-label="Dés pour ${phase==='attack'?'toucher':'les dégâts'}"><option value="physical" ${preferences[phase]==='physical'?'selected':''}>Mes dés physiques</option><option value="app" ${preferences[phase]==='app'?'selected':''}>Les dés de l’application</option></select></label>`;
  function rollFields(form,sides,phase){
    const mode=form.elements.mode.value,area=form.querySelector('[data-physical-dice]');
    const previous=[...area.querySelectorAll('input')].map(input=>input.value);
    area.innerHTML=mode==='physical'?sides.map((side,index)=>`<label>Dé ${index+1} · d${side}<input name="die-${index}" aria-label="Dé ${index+1} sur ${side}" type="number" min="1" max="${side}" required value="${esc(previous[index]||'')}"></label>`).join(''):'';
    const button=form.querySelector('[data-roll-submit]');button.textContent=mode==='app'?(sides.length?'Lancer '+(phase==='attack'?'le d20':'les dégâts'):'Calculer les dégâts fixes'):'Valider '+(phase==='attack'?'le jet physique':'les dés de dégâts');
    if(!sides.length)area.innerHTML='<p>Cette attaque inflige des dégâts fixes : aucun dé à lancer.</p>';
  }
  function prepareForm(){
    const target=root.querySelector('[data-attack-options]');
    if(!options){target.innerHTML='';return;}
    target.innerHTML=`<form data-attack-roll><div class="attack-fields"><label>Attaque<select name="attackId" aria-label="Attaque choisie"><option value="">Choisir une attaque</option>${options.attacks.map(a=>`<option value="${esc(a.id)}" ${!a.usable?'disabled':''}>${esc(a.name)} · ${signed(a.bonus)} · ${esc(a.formula)}${!a.usable?' (à résoudre manuellement)':''}</option>`).join('')}${options.customAllowed?'<option value="custom">Attaque personnalisée du MJ</option>':''}</select></label>
      <label>Cible<select name="targetId" aria-label="Cible de l’attaque" required><option value="">Choisir une cible</option>${options.targets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div>
      <div data-custom-attack hidden><label>Nom de l’attaque<input name="customName" maxlength="100"></label><label>Bonus d’attaque<input name="customBonus" type="number" min="-100" max="100" value="0"></label><label>Formule de dégâts<input name="customFormula" maxlength="160" placeholder="1d6+2"></label><label>Type de dégâts<input name="customType" maxlength="100"></label></div>
      <p data-attack-notes></p><div class="attack-fields">${modeSelect('attack')}<label>Situation du jet<select name="advantage" aria-label="Avantage ou désavantage"><option value="normal">Normal</option><option value="advantage">Avantage</option><option value="disadvantage">Désavantage</option></select></label><label>Bonus circonstanciel au toucher<input name="adjustment" type="number" min="-100" max="100" value="0" required></label></div>
      <div data-physical-dice class="attack-fields"></div><button class="button primary" data-roll-submit>Valider le jet physique</button><p class="hint">Le bonus de la fiche est ajouté par le serveur. Saisissez les d20 naturels. Aucun lancer ni dégât ne se déclenche à l’ouverture de cette page.</p></form>`;
    const form=target.querySelector('form');
    const update=()=>rollFields(form,form.elements.advantage.value==='normal'?[20]:[20,20],'attack');
    form.elements.mode.addEventListener('change',()=>{savePreference('attack',form.elements.mode.value);update();});form.elements.advantage.addEventListener('change',update);
    form.elements.attackId.addEventListener('change',()=>{const attack=options.attacks.find(a=>a.id===form.elements.attackId.value);target.querySelector('[data-custom-attack]').hidden=form.elements.attackId.value!=='custom';target.querySelector('[data-attack-notes]').textContent=attack?[...attack.notes,'Dégâts de base : '+attack.formula+' '+attack.damageType].join(' · '):'';});update();
    form.addEventListener('submit',event=>{event.preventDefault();if(!form.elements.attackId.value){feedback('Choisissez une attaque.');return;}
      const mode=form.elements.mode.value;
      work(()=>api({type:'roll',combatId:options.combatId,revision:options.revision,attackerId:options.attackerId,attackId:form.elements.attackId.value,targetId:form.elements.targetId.value,mode,
        advantage:form.elements.advantage.value,adjustment:Number(form.elements.adjustment.value),...(mode==='physical'?{dice:[...form.querySelectorAll('[data-physical-dice] input')].map(input=>Number(input.value))}:{}),
        ...(form.elements.attackId.value==='custom'?{custom:{name:form.elements.customName.value,bonus:Number(form.elements.customBonus.value),formula:form.elements.customFormula.value,damageType:form.elements.customType.value}}:{})}));});
  }
  function ticketHTML(t){
    const editable=!['applied','uncertain'].includes(t.stage)&&combat.status==='running';
    return `<details class="attack-ticket" data-attack-ticket="${t.id}" ${ui.openTicket===t.id?'open':''}><summary><strong>${esc(t.attackerName)} → ${esc(t.targetName)} · ${esc(t.attack.name)}</strong><span>${stageNames[t.stage]||esc(t.stage)}</span></summary>
      ${chips(t.roll.dice)}<p>Toucher : ${t.roll.natural} ${signed(t.roll.bonus)} ${t.roll.adjustment?signed(t.roll.adjustment):''}${t.roll.penalty?' − '+t.roll.penalty+' (Épuisement)':''} = <strong>${t.roll.total}</strong> · <strong>${outcomeNames[t.decision]}</strong>${isMJ?' · CA '+t.targetAC:''}</p>
      ${t.reason?`<p>Décision du MJ : ${esc(t.reason)}</p>`:''}${t.damage?`${chips(t.damage.dice)}<p>Dégâts : ${t.damage.diceTotal} ${signed(t.damage.flat)} ${t.damage.adjustment?signed(t.damage.adjustment):''} = <strong>${t.damage.total}</strong> ${esc(t.attack.damageType)}</p>`:''}
      ${t.stage==='applied'?`<p><strong>${t.appliedDamage} dégâts confirmés et appliqués par le MJ.</strong></p>`:''}
      ${t.stage==='uncertain'?'<p>Actualisez les PV de la cible avant toute correction manuelle. Ce jet ne sera pas appliqué à nouveau.</p>':''}
      ${isMJ&&t.targetHints?`<p class="hint">Cible — résistances : ${esc(t.targetHints.resistances.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(', ')||'aucune indiquée')} · immunités : ${esc(t.targetHints.immunities.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(', ')||'aucune indiquée')} · vulnérabilités : ${esc(t.targetHints.vulnerabilities.join(', ')||'aucune indiquée')}. Vérifiez les conditions et les types de dégâts avant de confirmer.</p>`:''}
      ${editable?`<form data-damage-roll="${t.id}">${isMJ?`<label>Résultat retenu<select name="outcome" aria-label="Résultat retenu"><option value="miss" ${t.decision==='miss'?'selected':''}>Ratée</option><option value="hit" ${t.decision==='hit'?'selected':''}>Touche</option><option value="critical" ${t.decision==='critical'?'selected':''}>Critique</option></select></label><label>Raison si résultat corrigé<input name="reason" maxlength="200" value="${esc(t.reason)}"></label>`:`<input type="hidden" name="outcome" value="${t.decision}">`}
      <div data-damage-controls>${modeSelect('damage')}<p data-plan></p><div data-physical-dice class="attack-fields"></div><label>Ajustement de dégâts — ajouté une seule fois<input name="adjustment" type="number" min="-10000" max="10000" value="0" required></label><p class="hint">Les dégâts supplémentaires et les effets d’aptitudes restent à vérifier. Les dés critiques sont doublés, le bonus fixe est ajouté une fois.</p></div><button class="button secondary" data-roll-submit>Préparer les dégâts</button></form>
      ${isMJ&&t.stage==='ready'?`<form data-attack-confirm="${t.id}"><h3>Validation du MJ</h3><div class="attack-fields"><label>Traitement des dégâts<select name="treatment" aria-label="Traitement des dégâts"><option value="normal">Normaux</option><option value="resistance">Résistance — moitié arrondie en bas</option><option value="vulnerability">Vulnérabilité — double</option><option value="immunity">Immunité — zéro</option></select></label><label>Correction finale<input name="correction" type="number" min="-100000" max="100000" value="0" required></label><label>Raison de la correction<input name="reason" maxlength="200"></label><label>Échecs de mort si cible déjà à 0 PV<select name="deathFailures"><option value="0">0 — décision de la table</option><option value="1">1</option><option value="2">2 — critique</option></select></label></div><p>À appliquer : <strong data-final-damage>${t.damage?.total||0}</strong> dégâts à ${esc(t.targetName)}.</p><button class="button primary">Confirmer et appliquer</button><p class="hint">Pour plusieurs types de dégâts ou une exception, utilisez la correction finale et expliquez la décision.</p></form>`:''}
      <div class="portal-actions">${isMJ?`<button class="button secondary" data-attack-recheck="${t.id}">Revérifier sans relancer</button>`:''}<button class="button secondary" data-attack-cancel="${t.id}">Annuler cette attaque</button></div>`:''}
      <p class="hint">Ce récapitulatif expire après cinq minutes. Les PV appliqués restent sauvegardés.</p></details>`;
  }
  root.innerHTML=`<h2>Attaques et jets</h2><p>Choisissez vos dés pour chaque jet. Le MJ vérifie et confirme les dégâts sur les cibles.</p><p data-attack-feedback role="status"></p>
    ${combat.status==='running'?`<div class="attack-fields"><label>Attaquant<select data-attacker aria-label="Attaquant"><option value="">Choisir un participant</option>${combat.participants.filter(p=>p.canEdit&&!p.unavailable).map(p=>`<option value="${p.id}" ${ui.attackerId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><button class="button secondary" data-prepare-attack>Préparer / actualiser sans lancer</button></div><div data-attack-options></div>`:'<p>Démarrez ou reprenez le combat pour préparer les attaques. Les jets restent déclenchés explicitement.</p>'}
    <div class="attack-tickets">${(combat.attackTickets||[]).map(ticketHTML).join('')||'<p>Aucune attaque en attente.</p>'}</div>`;
  root.querySelector('[data-prepare-attack]')?.addEventListener('click',()=>{
    const id=root.querySelector('[data-attacker]').value;if(!id){feedback('Choisissez un attaquant.');return;}
    ui.attackerId=id;work(async()=>{options=await api(id);prepareForm();feedback('Attaque prête : choisissez la cible et déclenchez le jet.');});
  });
  root.querySelectorAll('[data-attack-ticket]').forEach(details=>details.addEventListener('toggle',()=>{if(details.open)ui.openTicket=details.dataset.attackTicket;}));
  root.querySelectorAll('[data-damage-roll]').forEach(form=>{
    const t=combat.attackTickets.find(t=>t.id===form.dataset.damageRoll);
    const update=()=>{const outcome=form.elements.outcome.value,controls=form.querySelector('[data-damage-controls]');controls.hidden=outcome==='miss';
      if(outcome==='miss'){form.querySelector('[data-physical-dice]').innerHTML='';form.querySelector('[data-roll-submit]').textContent='Soumettre le résultat au MJ';return;}
      const plan=t.plans[outcome];form.querySelector('[data-plan]').textContent='À lancer : '+formula(plan);rollFields(form,plan.dice.flatMap(d=>Array(d.count).fill(d.sides)),'damage');};
    form.elements.mode.addEventListener('change',()=>{savePreference('damage',form.elements.mode.value);update();});form.elements.outcome.addEventListener('change',update);update();
    form.addEventListener('submit',event=>{event.preventDefault();const mode=form.elements.mode.value;work(()=>api({type:'damage',ticketId:t.id,mode,outcome:form.elements.outcome.value,reason:form.elements.reason?.value||'',adjustment:Number(form.elements.adjustment.value),
      ...(mode==='physical'&&form.elements.outcome.value!=='miss'?{dice:[...form.querySelectorAll('[data-physical-dice] input')].map(input=>Number(input.value))}:{})}));});
  });
  root.querySelectorAll('[data-attack-confirm]').forEach(form=>{
    const t=combat.attackTickets.find(t=>t.id===form.dataset.attackConfirm);
    const update=()=>{const base=t.damage?.total||0,kind=form.elements.treatment.value;const n=kind==='immunity'?0:kind==='resistance'?Math.floor(base/2):kind==='vulnerability'?base*2:base;form.querySelector('[data-final-damage]').textContent=String(Math.max(0,n+Number(form.elements.correction.value||0)));};
    form.addEventListener('input',update);form.addEventListener('change',update);
    form.addEventListener('submit',event=>{event.preventDefault();work(()=>api({type:'confirm',ticketId:t.id,confirmed:true,treatment:form.elements.treatment.value,correction:Number(form.elements.correction.value),reason:form.elements.reason.value,deathFailures:Number(form.elements.deathFailures.value)}));});
  });
  for(const [selector,type]of [['[data-attack-cancel]','cancel'],['[data-attack-recheck]','recheck']])root.querySelectorAll(selector).forEach(button=>button.addEventListener('click',()=>work(()=>api({type,ticketId:type==='cancel'?button.dataset.attackCancel:button.dataset.attackRecheck}))));
  return ()=>controller.abort();
}
