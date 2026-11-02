import {CONDITIONS} from './condition-rules.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=(name,html)=>`<label>${name}${html}</label>`;
const select=(name,rows,value='')=>`<select name="${name}">${rows.map(([id,title])=>`<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(title)}</option>`).join('')}</select>`;
const number=(name,value=0,min=-100,max=100)=>`<input name="${name}" type="number" value="${value}" min="${min}" max="${max}" step="1" required>`;
const modes=[['physical','Mes dés physiques'],['app','Les dés de l’application']];
const kinds=[['attack','Attaque de sort'],['save','Sauvegarde par cible'],['direct','Effet sans jet de cible']];
const effects=[['damage','Dégâts'],['heal','Soins'],['temp','PV temporaires'],['condition','État'],['note','Effet à suivre à la table']];
const statuses={proposed:'Proposition · validation du MJ attendue',casting:'Incantation · enregistrement à reprendre',resolving:'Sort lancé · effets à résoudre',active:'Effet en cours',complete:'Résolution terminée',ending:'Fin du sort à reprendre',ended:'Sort terminé',cancelled:'Proposition annulée'};

export function mountSpells(root,{groupId,state,onState,ui={}}){
  const controller=new AbortController(),combat=state.combat,isMJ=state.isMJ;
  const account=document.querySelector('meta[name="refonte-user"]')?.content||'local',preferenceKey='myrpgtable.spell-dice.'+account;
  let preferences={};try{preferences=JSON.parse(localStorage.getItem(preferenceKey)||'{}');}catch{}
  const mode=kind=>['app','physical'].includes(preferences[kind])?preferences[kind]:'physical';
  const feedback=message=>{const node=root.querySelector('[data-casting-status]');if(node)node.textContent=message;};
  async function request(data,query=''){
    const response=await fetch('./api/groupes/'+encodeURIComponent(groupId)+'/combat/sorts'+query,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,
      ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
    const value=await response.json();if(!response.ok)throw Error(value.error||'La résolution est indisponible.');return value;
  }
  async function run(work){
    const buttons=[...root.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
    try{const result=await work();if(result?.cast){ui.open||={};ui.open[result.cast.id]=true;if(result.cast.parentId&&ui.pulseIds)delete ui.pulseIds[result.cast.parentId];}if(result?.state)onState(result.state);}
    catch(error){if(!controller.signal.aborted)feedback(error.message);}
    finally{if(!controller.signal.aborted)buttons.forEach(b=>b.disabled=false);}
  }
  function diceFields(sides,kind){return `<div class="casting-dice-options">${label('Dés à utiliser',select('mode',modes,mode(kind)))}<div data-physical-dice ${mode(kind)==='app'?'hidden':''}>${sides.map((side,i)=>label('Dé '+(i+1)+' sur '+side,`<input name="die" type="number" min="1" max="${side}" step="1" required>`)).join('')}</div></div>`;}
  const checklist=(rows,selected,name='targetIds')=>`<div class="casting-targets">${rows.map(p=>`<label><input name="${name}" type="checkbox" value="${esc(p.id)}" ${selected.includes(p.id)?'checked':''}> ${esc(p.name)}</label>`).join('')}</div>`;
  function preparation(){
    const options=ui.options,spell=options?.spells.find(s=>s.key===ui.spellKey);
    if(!options)return '';
    const rows=options.spells.map(s=>[s.key,s.name+' · '+s.source+' · '+(s.level?'niveau '+s.level:'sort mineur')]);
    const payments=spell?.level?[['','Choisir une ressource'],...spell.slots.map(s=>[s.id,(s.pact?'Pacte · ':'')+'niveau '+s.rank+' · '+s.remaining+' restant(s)']),['exception','Aptitude / exception : le MJ doit préciser la dépense']]:[['cantrip','Sort mineur · aucun emplacement']];
    return `<form data-casting-form="prepare">${label('Sort de la fiche',select('spellKey',[['','Choisir un sort'],...rows],ui.spellKey))}
      ${spell?`<details><summary>Lire ${esc(spell.name)}</summary><p>${esc(spell.description)}</p><p>${esc(spell.higher)}</p><p>${esc(spell.range)} · ${esc(spell.duration)} · ${esc(spell.castingTime)}</p><p>${esc(spell.usage)}</p>${spell.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</details>
      ${label('Ressource utilisée',select('payment',payments,ui.payment||''))}<div data-exception-rank ${ui.payment==='exception'?'':'hidden'}>${label('Niveau déclaré pour cette exception',number('rank',spell.level,spell.level,9))}</div>
      <fieldset><legend>Cibles proposées · les alliés sont aussi sélectionnables</legend>${checklist(options.targets,ui.targets||[])}</fieldset>
      <p class="hint">Le MJ vérifie la zone, les cibles, les composants et les aptitudes. Aucun effet ni emplacement n’est appliqué à cette étape.</p><button class="button primary">Proposer le sort au MJ</button>`:''}</form>`;
  }
  function approval(c){
    const p=c.spell.suggestions[c.rank];
    return `<form data-casting-form="approve" data-cast="${c.id}"><h4>Vérification du MJ</h4><p>Incantation : ${esc(c.spell.castingTime)} · Portée : ${esc(c.spell.range)} · Durée : ${esc(c.spell.duration)}${c.spell.concentration?' · Concentration':''}</p>
      <details><summary>Texte du sort et aptitudes à vérifier</summary><p>${esc(c.spell.description)}</p><p>${esc(c.spell.higher)}</p>${c.spell.notes.map(n=>`<p>${esc(n)}</p>`).join('')}<p>Vérifiez aussi les aptitudes de classe et les dons qui modifient ce sort. La formule proposée est une base.</p></details>
      ${c.npc?`<p class="notice">Sort de PNJ : vérifiez sa liste de sorts et ses limites dans le profil. L’application note les utilisations, sans inventer de quota.</p><div class="casting-fields">${label('DD des sorts du profil',number('dc',0,0,100))}${label('Bonus d’attaque de sort du profil',number('attackBonus'))}</div>`:''}
      <fieldset><legend>Participants réellement dans la zone / cibles retenues</legend>${checklist(combat.participants,c.targets.map(t=>t.id))}</fieldset>
      <div class="casting-fields">${label('Résolution',select('kind',kinds,p.kind))}${label('Effet',select('effect',effects,p.effect))}${label('Formule de base vérifiée à ce niveau',`<input name="formula" value="${esc(p.formula)}" maxlength="160" placeholder="Exemple : 2d8+3">`)}${label('Type de dégâts',`<input name="damageType" value="${esc(p.damageType)}" maxlength="100">`)}
      ${label('Sauvegarde',select('saveAbility',['FOR','DEX','CON','INT','SAG','CHA'].map(a=>[a,a]),p.saveAbility))}${label('En cas de sauvegarde réussie',select('success',[['none','Aucun effet'],['half','Dégâts réduits de moitié'],['full','Effet entier']],p.success))}
      ${label('État à appliquer',select('condition',[['','Aucun état'],...CONDITIONS.map(x=>[x.id,x.name])]))}${label('Durée suivie en rounds (0 : fin manuelle)',number('rounds',0,0,10000))}${label('Nombre total d’impacts si plusieurs rayons / projectiles',number('impacts',1,1,100))}</div>
      ${label('Traitement de l’état choisi',select('conditionOperation',[['add','Appliquer cet état'],['remove','Retirer cet état']]))}
      <label><input type="checkbox" name="conditionOnSuccess"> Le sort applique aussi cet état après une sauvegarde réussie.</label><label><input type="checkbox" name="releaseOnSuccess" checked> Une nouvelle sauvegarde réussie met fin à l’état provenant de ce sort, selon son texte.</label>
      <label><input name="sharedImpacts" type="checkbox"> Ces impacts directs partagent le même jet de dégâts, selon le sort (sans attaque par rayon).</label>
      ${p.reviewRequired?'<p class="notice">Cette mécanique nécessite un plan du MJ. L’application ne déduit pas ses effets depuis le texte.</p>':''}
      ${label('Rappel de l’effet, bonus et exceptions',`<textarea name="note" maxlength="2000" rows="2"></textarea>`)}${label('Motif du plan / aptitude permettant une exception',`<textarea name="reason" maxlength="2000" rows="2"></textarea>`)}
      <label><input type="checkbox" name="completed" required> L’incantation est terminée ; les cibles, composants, actions et aptitudes ont été vérifiés.</label>
      ${c.spell.concentration?'<label><input type="checkbox" name="replaceConcentration"> Remplacer la concentration actuelle, si le lanceur en maintient déjà une.</label>':''}
      <button class="button primary">Valider l’incantation et sa dépense</button></form>`;
  }
  function diceSummary(roll){if(!roll)return '';return `<p class="casting-roll">${(roll.dice||[]).map(d=>`<span class="attack-die ${d.kept===false?'attack-discarded':''}">${d.value}<small>d${d.sides}</small></span>`).join(' ')}${roll.total!==null&&roll.total!==undefined?' Total : '+roll.total:''}${roll.outcome?' · '+esc({hit:'Touche',miss:'Échec',critical:'Critique'}[roll.outcome]):roll.success!==undefined?' · '+(roll.success?'Réussite':'Échec'):''}</p>`;}
  function damageForm(c,t){
    const name=c.plan.effect==='heal'?'soins':c.plan.effect==='temp'?'PV temporaires':'dégâts';
    return `<form data-casting-form="damage" data-cast="${c.id}" data-target="${t?.id||''}"><h4>Jet de ${name}${t?' · '+esc(t.name):' commun aux cibles'}</h4><p>Formule : ${esc(c.plan.formula)}${t?.roll?.outcome==='critical'?' · critique : dés doublés, bonus fixe une fois':''}</p>
      ${diceFields(t?.dicePlan||c.dicePlan,'damage')}${label('Ajustement ajouté une fois',number('adjustment'))}<button class="button secondary">Valider le jet de ${name}</button></form>`;
  }
  function target(c,t){
    if(t.applied)return `<section class="casting-target"><h4>${esc(t.name)}</h4><p>Effets confirmés par le MJ${t.appliedAmount!==undefined?' · '+t.appliedAmount:''}${t.exempt?' · cible épargnée':''}.</p></section>`;
    const rollable=t.canRoll&&c.plan.kind!=='direct',p=combat.participants.find(p=>p.id===t.id);
    const forced=c.plan.kind==='save'&&['FOR','DEX'].includes(c.plan.saveAbility)&&p?.conditions.some(x=>['paralyzed','petrified','stunned','unconscious'].includes(x.id));
    const roll=rollable&&forced?`<form data-casting-form="roll" data-cast="${c.id}" data-target="${t.id}"><p>L’état de la cible impose l’échec de cette sauvegarde. Aucun dé nécessaire.</p><input type="hidden" name="mode" value="physical"><button class="button secondary">Confirmer l’échec imposé par l’état</button></form>`:rollable?`<form data-casting-form="roll" data-cast="${c.id}" data-target="${t.id}"><h4>${c.plan.kind==='save'?'Sauvegarde '+esc(c.plan.saveAbility):'Attaque'} · ${esc(t.name)}</h4>
      ${label('Situation du jet',select('advantage',[['normal','Normal'],['advantage','Avantage'],['disadvantage','Désavantage']]))}${diceFields([20],c.plan.kind)}
      ${label('Ajustement circonstanciel',number('adjustment'))}${isMJ?`${label('Bonus manquant du profil (si demandé)',number('bonus'))}${label('Origine du bonus manquant',`<input name="reason" maxlength="2000">`)}`:''}<button class="button secondary">Valider le jet contre cette cible</button></form>`:'';
    const confirm=isMJ?`<form data-casting-form="confirm" data-cast="${c.id}" data-target="${t.id}"><div class="casting-fields">${label('Traitement des dégâts',select('treatment',[['normal','Normal'],['resistance','Résistance : moitié'],['vulnerability','Vulnérabilité : double'],['immunity','Immunité : zéro']]))}${label('Correction finale',number('correction',0,-100000,100000))}${label('Échecs de mort pour ces dégâts',select('deathFailures',[[0,'Aucun / non concerné'],[1,'Un échec'],[2,'Deux échecs']]))}</div>
      <label><input type="checkbox" name="exempt"> Épargner cette cible selon le sort ou une aptitude</label>${label('Motif de l’exception / correction',`<input name="reason" maxlength="2000">`)}<label><input type="checkbox" name="replaceTemp"> Remplacer les PV temporaires existants, même si le nouveau montant est inférieur</label>
      <button class="button primary">Confirmer les effets sur ${esc(t.name)}</button></form>`:'';
    const ruling=isMJ&&t.roll?`<details><summary>Cas particulier · décision du MJ</summary><form data-casting-form="adjudicate" data-cast="${c.id}" data-target="${t.id}">${label('Résultat retenu',select('decision',c.plan.kind==='attack'?[['hit','Touche'],['miss','Échec'],['critical','Critique']]:[['success','Sauvegarde réussie'],['failure','Sauvegarde échouée']]))}${label('Aptitude, distance ou règle appliquée',`<input name="reason" maxlength="2000" required>`)}<button class="button secondary">Valider la décision du MJ</button></form></details>`:'';
    return `<section class="casting-target" data-casting-target="${t.id}"><h4>${esc(t.name)}</h4>${diceSummary(t.roll)}${roll}${ruling}
      ${c.plan.kind==='attack'&&t.canDamage&&t.roll&&t.roll.outcome!=='miss'&&['damage','heal','temp'].includes(c.plan.effect)?damageForm(c,t):''}${diceSummary(t.damage)}${isMJ&&t.roll?`<button class="button secondary" data-casting-recheck="${c.id}" data-target="${t.id}">Revérifier le jet sans relancer</button>`:''}${confirm}</section>`;
  }
  function cast(c){
    const proposer=c.ownerId===account||isMJ;
    return `<details class="casting-cast" data-casting-cast="${c.id}" ${ui.open?.[c.id]?'open':''}><summary><strong>${esc(c.spell.name)}</strong> · ${esc(c.casterName)} <span>${c.parentId?'Déclenchement · ':''}${esc(statuses[c.stage]||c.stage)}</span></summary>
      <p>Niveau de lancement : ${c.rank} · ${c.payment==='cantrip'?'sort mineur':c.payment==='already-paid'?'nouveau déclenchement · aucun emplacement supplémentaire':c.payment==='exception'?'exception vérifiée par le MJ':esc(c.payment.replace('spell-','emplacement de niveau '))}</p>
      ${c.parentId?`<p>${esc(c.reason)}</p>`:''}
      ${c.error?`<p role="alert">${esc(c.error)}</p>`:''}${c.plan?.note?`<p class="notice">${esc(c.plan.note)}</p>`:''}
      ${c.earlierCombat?'<p class="notice">Effet conservé d’un combat précédent. Le temps écoulé entre les rencontres se vérifie à la table.</p>':''}
      ${c.stage==='proposed'&&isMJ?approval(c):''}
      ${(c.operationPending||c.stage==='casting'||c.stage==='ending')&&isMJ?`<button class="button secondary" data-casting-retry="${c.id}">Reprendre l’enregistrement sans relancer</button>`:''}
      ${c.recheckTargetId&&isMJ?`<button class="button secondary" data-casting-recheck="${c.id}" data-target="${c.recheckTargetId}">Revérifier la cible sans relancer</button>`:''}
      ${c.stage==='resolving'&&!c.operationPending?`${['damage','heal','temp'].includes(c.plan.effect)&&c.plan.kind!=='attack'&&proposer&&!c.sharedDamageLocked?damageForm(c):''}${diceSummary(c.damage)}${c.targets.map(t=>target(c,t)).join('')}`:''}
      ${c.stage==='active'?`<p>${c.rounds?'Durée restante suivie : '+c.rounds+' rounds.':'Durée : '+esc(c.spell.duration)+' · fin manuelle si aucune durée en rounds déclarée.'}</p><p>Cibles : ${c.targets.map(t=>esc(t.name)).join(', ')}</p>`:''}
      ${c.stage==='active'&&!c.parentId&&isMJ?`<form data-casting-form="timer" data-cast="${c.id}">${label('Ajuster la durée restante en rounds (0 : terminer)',number('remainingRounds',c.rounds||0,0,10000))}<button class="button secondary">Confirmer la durée restante</button></form>`:''}
      ${c.stage==='active'&&!c.parentId&&isMJ?`<form data-casting-form="pulse" data-cast="${c.id}"><h4>Déclenchement d’un effet persistant</h4><p>Choisissez uniquement les créatures concernées par ce déclenchement : entrée dans la zone, début ou fin de tour, selon le texte du sort. Aucun nouvel emplacement n’est dépensé.</p>${checklist(combat.participants,[])}${label('Déclenchement et règle vérifiés',`<textarea name="reason" maxlength="2000" required></textarea>`)}<button class="button secondary">Préparer ce déclenchement</button></form>`:''}
      ${['complete','active'].includes(c.stage)&&!c.parentId&&c.impactsRemaining>0&&isMJ?`<form data-casting-form="impact" data-cast="${c.id}"><h4>Impacts de cette incantation : ${c.impactsRemaining} restant(s)</h4><p>Chaque cible cochée reçoit un impact. Pour plusieurs rayons sur la même créature, préparez les impacts suivants séparément, pendant ce tour. Aucun emplacement supplémentaire n’est dépensé.</p>${checklist(combat.participants,[])}${label('Impact(s) de cette incantation',`<input name="reason" maxlength="2000" required placeholder="Exemple : deuxième rayon">`)}<button class="button secondary">Préparer les impacts suivants</button></form>`:''}
      ${!['ended','complete','cancelled'].includes(c.stage)&&c.canEnd?`<button class="button secondary" data-casting-end="${c.id}">${c.stage==='proposed'?'Annuler la proposition':'Terminer le sort et ses effets'}</button>`:''}</details>`;
  }
  function concentration(p){
    const c=p.concentrationTracker;if(!c)return '';
    return `<section class="casting-concentration"><h4>Concentration · ${esc(p.name)} · ${esc(c.name)}</h4>${c.checks.map(check=>`<form data-casting-form="concentration" data-cast="${c.id}" data-check="${check.id}"><p>${check.damage} dégâts reçus · sauvegarde de CON DD ${check.dc}</p>${diceFields([20],'concentration')}${label('Situation du jet',select('advantage',[['normal','Normal'],['advantage','Avantage'],['disadvantage','Désavantage']]))}${label('Ajustement circonstanciel',number('adjustment'))}${isMJ?`${label('Bonus de CON manquant du profil',number('bonus'))}${label('Origine du bonus manquant',`<input name="reason" maxlength="2000">`)}`:''}<button class="button secondary">Résoudre la concentration</button></form>`).join('')||'<p>Aucune sauvegarde de concentration en attente.</p>'}</section>`;
  }
  function render(){
    const controlled=combat.participants.filter(p=>p.canEdit&&!p.unavailable&&(p.kind==='pc'||isMJ));
    root.innerHTML=`<h2>Sorts et concentration</h2><p>Préparez le sort depuis une fiche. Le MJ confirme l’incantation, les cibles, puis les effets. Aucun dé n’est lancé automatiquement.</p><p data-casting-status role="status"></p>
      ${combat.status==='running'?`<div class="casting-picker">${label('Lanceur de sorts',select('caster',[['','Choisir un personnage'],...controlled.map(p=>[p.id,p.name])],ui.casterId))}<button class="button secondary" data-casting-load>Afficher les sorts sans lancer</button></div>${preparation()}`:''}
      <div class="casting-list">${(combat.spellCasts||[]).map(cast).join('')}</div>${controlled.map(concentration).join('')}
      <button class="button secondary" data-casting-sync>Vérifier les effets en cours sans lancer</button>`;
    bind();
  }
  function data(form){const raw=Object.fromEntries(new FormData(form));return {...raw,targetIds:[...new FormData(form).getAll('targetIds')],dice:[...new FormData(form).getAll('die')].map(Number)};}
  function bind(){
    root.querySelector('[data-casting-load]')?.addEventListener('click',()=>run(async()=>{ui.casterId=root.querySelector('select[name=caster]').value;if(!ui.casterId)throw Error('Choisissez un personnage.');ui.options=await request(undefined,'?caster='+encodeURIComponent(ui.casterId));ui.spellKey='';render();}));
    root.querySelector('[data-casting-sync]')?.addEventListener('click',()=>run(()=>request({type:'sync'})));
    root.querySelectorAll('[data-casting-cast]').forEach(node=>node.addEventListener('toggle',()=>{ui.open||={};ui.open[node.dataset.castingCast]=node.open;}));
    root.querySelector('[name=spellKey]')?.addEventListener('change',e=>{ui.spellKey=e.target.value;ui.payment='';render();});
    root.querySelector('[name=payment]')?.addEventListener('change',e=>{ui.payment=e.target.value;root.querySelector('[data-exception-rank]').hidden=e.target.value!=='exception';});
    root.querySelectorAll('form').forEach(form=>{
      const kind=form.dataset.castingForm,selector=form.querySelector('[name=mode]');
      const setDice=()=>{
        const situation=form.querySelector('[name=advantage]')?.value||'normal',physical=form.querySelector('[data-physical-dice]');
        if(!physical)return;
        if(['roll','concentration'].includes(kind))physical.innerHTML=(situation==='normal'?[20]:[20,20]).map((s,i)=>label('Dé '+(i+1)+' sur '+s,`<input name="die" type="number" min="1" max="${s}" step="1" required>`)).join('');
        physical.hidden=selector.value==='app';physical.querySelectorAll('input').forEach(input=>input.disabled=physical.hidden);
      };
      if(selector){setDice();selector.addEventListener('change',()=>{preferences[kind==='roll'?(combat.spellCasts.find(c=>c.id===form.dataset.cast)?.plan.kind||'save'):kind]=selector.value;try{localStorage.setItem(preferenceKey,JSON.stringify(preferences));}catch{}setDice();});form.querySelector('[name=advantage]')?.addEventListener('change',setDice);}
      form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
        const d=data(form),base={type:kind,castId:form.dataset.cast,targetId:form.dataset.target,checkId:form.dataset.check};
        if(kind==='prepare')return request({type:kind,combatId:ui.options.combatId,revision:ui.options.revision,casterId:ui.casterId,spellKey:d.spellKey,payment:d.payment,rank:Number(d.rank),targetIds:d.targetIds});
        if(kind==='approve')return request({...base,completed:d.completed==='on',dc:Number(d.dc||0),attackBonus:Number(d.attackBonus||0),replaceConcentration:d.replaceConcentration==='on',targetIds:d.targetIds,reason:d.reason,plan:{...d,rounds:Number(d.rounds),impacts:Number(d.impacts),sharedImpacts:d.sharedImpacts==='on',conditionOnSuccess:d.conditionOnSuccess==='on',releaseOnSuccess:d.releaseOnSuccess==='on'}});
        if(['pulse','impact'].includes(kind)){ui.pulseIds||={};ui.pulseIds[base.castId]||=crypto.randomUUID();return request({...base,type:'pulse',impact:kind==='impact',eventId:ui.pulseIds[base.castId],targetIds:d.targetIds,reason:d.reason});}
        if(kind==='confirm')return request({...base,confirmed:true,exempt:d.exempt==='on',replaceTemp:d.replaceTemp==='on',treatment:d.treatment,correction:Number(d.correction),deathFailures:Number(d.deathFailures),reason:d.reason});
        if(kind==='timer')return request({...base,confirmed:true,remainingRounds:Number(d.remainingRounds)});
        if(kind==='adjudicate')return request({...base,decision:d.decision,reason:d.reason});
        return request({...base,mode:d.mode,advantage:d.advantage,adjustment:Number(d.adjustment||0),bonus:Number(d.bonus||0),reason:d.reason,...(d.mode==='physical'?{dice:d.dice}:{})});
      });});
    });
    root.querySelectorAll('[data-casting-retry]').forEach(b=>b.onclick=()=>run(()=>request({type:'retry',castId:b.dataset.castingRetry})));
    root.querySelectorAll('[data-casting-recheck]').forEach(b=>b.onclick=()=>run(()=>request({type:'recheck',castId:b.dataset.castingRecheck,targetId:b.dataset.target})));
    root.querySelectorAll('[data-casting-end]').forEach(b=>b.onclick=()=>{if(confirm('Terminer ce sort ? Les effets seront retirés ; les ressources déjà dépensées ne sont pas rendues.'))run(()=>request({type:'end',castId:b.dataset.castingEnd,confirmed:true}));});
  }
  render();return ()=>controller.abort();
}
