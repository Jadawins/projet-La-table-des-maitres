const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses={proposed:'Proposition · jet de soins à préparer',rolling:'Jet en cours d’enregistrement',rolled:'Jet enregistré · validation du MJ attendue',committing:'Utilisation en cours d’enregistrement',pending:'Utilisation à reprendre',complete:'Potion consommée · soins confirmés',cancelled:'Proposition annulée'};
const option=(value,text,selected)=>`<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(text)}</option>`;
export function renderPotionUse(use,{isMJ=false,open=false,mode=''}={}){
  const dice=use.roll?`<p class="casting-roll">${use.roll.dice.map(d=>`<span class="attack-die">${d.value}<small>d${d.sides}</small></span>`).join(' ')} + ${use.roll.flat} = <strong>${use.roll.total} PV de soins</strong></p>`:'';
  const canRoll=use.canRoll&&!use.roll&&['proposed','rolling'].includes(use.stage);
  return `<details class="casting-cast" data-potion-use="${esc(use.id)}" ${open?'open':''}><summary><strong>${esc(use.itemName)}</strong> · ${esc(use.sourceName)} → ${esc(use.targetName)} <span>${esc(statuses[use.stage]||use.stage)}</span></summary><p>Soins : ${esc(use.formula)}. La potion provient de l’inventaire de ${esc(use.sourceName)}.</p>${use.earlierCombat?'<p class="notice">Utilisation conservée du combat précédent : terminez son suivi avant une nouvelle proposition.</p>':''}${use.error?`<p role="alert">${esc(use.error)}</p>`:''}${dice}
    ${canRoll?`<form data-potion-form="roll" data-use="${esc(use.id)}"><label><input type="radio" name="mode" value="physical" ${mode==='physical'?'checked':''} required> Mes dés physiques</label><label><input type="radio" name="mode" value="app" ${mode==='app'?'checked':''} required> Les dés de l’application</label><div data-potion-physical ${mode==='physical'?'':'hidden'}>${use.dicePlan.map((sides,index)=>`<label>Dé ${index+1} sur ${sides}<input type="number" name="die" min="1" max="${sides}" step="1" ${mode==='physical'?'required':'disabled'}></label>`).join('')}</div><button class="button secondary">Valider le jet de soins</button><p class="hint">Aucun dé n’est lancé à l’affichage. Ce jet ne consomme pas encore la potion.</p></form>`:''}
    ${isMJ&&use.stage==='rolled'?`<form data-potion-form="confirm" data-use="${esc(use.id)}"><label><input type="checkbox" name="confirmed" required> J’ai vérifié la portée (1,50 m), l’action Bonus et la possibilité d’administrer cette potion à la cible.</label><button class="button primary">Consommer la potion et appliquer les soins</button></form>`:''}
    ${isMJ&&use.attempted&&['pending','committing'].includes(use.stage)?`<p>${use.sourceConsumed?'La potion est déjà consommée. La reprise ne doit appliquer que les soins restants.':'Vérifiez l’enregistrement de la consommation avant toute nouvelle proposition.'}</p><button class="button primary" data-potion-retry="${esc(use.id)}">Confirmer la reprise sans relancer</button><form data-potion-form="recheck" data-use="${esc(use.id)}"><label><input type="checkbox" name="reviewed" required> J’ai revérifié les fiches et les conditions d’utilisation ; le résultat des dés reste identique.</label><button class="button secondary">Revérifier les fiches avant reprise</button></form>`:''}
    ${use.canCancel&&!['complete','cancelled'].includes(use.stage)?`<button class="button quiet" data-potion-cancel="${esc(use.id)}">Annuler cette proposition</button>`:''}</details>`;
}
export function mountPotions(root,{groupId,state,onState,ui={}}){
  const controller=new AbortController();ui.open||={};ui.modes||={};ui.rollIds||={};let busy=false;
  const feedback=text=>{ui.error=text;const target=root.querySelector('[data-potion-feedback]');if(target)target.textContent=text;};
  async function request(body){
    const response=await fetch('./api/groupes/'+encodeURIComponent(groupId)+'/combat/potions',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Error(value.error||'Le suivi des potions est indisponible.');return value;
  }
  async function run(fn){
    if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('');
    try{const result=await fn();if(result?.use)ui.open[result.use.id]=true;if(result?.state)onState(result.state);}
    catch(error){if(!controller.signal.aborted){feedback(error.message||'Actualisez le suivi avant de reprendre.');try{const response=await fetch('./api/groupes/'+encodeURIComponent(groupId)+'/combat',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(response.ok)onState(await response.json());}catch{}}}
    finally{busy=false;if(!controller.signal.aborted)root.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function preparation(){
    const options=ui.options,source=options?.sources.find(s=>s.id===ui.sourceId);if(!options)return '';
    return `<form data-potion-form="prepare"><label>Personnage qui administre la potion<select name="sourceId" aria-label="Personnage qui administre la potion" required>${option('','Choisir un personnage',ui.sourceId)}${options.sources.map(s=>option(s.id,s.name,ui.sourceId)).join('')}</select></label>${source?`<label>Potion de l’inventaire<select name="itemRef" aria-label="Potion de l’inventaire" required>${option('','Choisir une potion',ui.itemRef)}${source.potions.map(p=>option(p.ref,p.name+' · ×'+p.quantity+' · '+p.formula,ui.itemRef)).join('')}</select></label><label>Créature qui reçoit la potion<select name="targetId" aria-label="Créature qui reçoit la potion" required>${option('','Choisir une autre créature',ui.targetId)}${options.targets.filter(t=>t.id!==source.id).map(t=>option(t.id,t.name,ui.targetId)).join('')}</select></label><button class="button primary">Proposer la potion au MJ</button>`:'<p>Seuls vos personnages avec une potion reconnue sont proposés ; un MJ peut choisir ceux de la table.</p>'}${!options.sources.length?'<p>Aucune potion de guérison reconnue dans les inventaires accessibles. Reliez une potion au catalogue depuis la fiche.</p>':''}</form>`;
  }
  function render(){
    if(controller.signal.aborted)return;
    root.innerHTML=`<h2>Potions sur une autre créature</h2><p>Proposez une potion de votre inventaire, choisissez vos dés, puis attendez la validation du MJ. Une unité sera consommée et les soins appliqués à la cible. Le MJ vérifie l’action et la portée ; les distances ne sont pas calculées sans carte.</p><p data-potion-feedback role="status" aria-live="polite">${esc(ui.error||'')}</p>${state.combat.status==='running'?'<button class="button secondary" data-potion-options>Choisir une potion à administrer</button>':''}${preparation()}<div data-potion-history>${(state.combat.potionUses||[]).map(use=>renderPotionUse(use,{isMJ:state.isMJ,open:ui.open[use.id],mode:ui.modes[use.id]||''})).join('')||'<p>Aucune utilisation de potion proposée.</p>'}</div>`;
    root.querySelector('[data-potion-options]')?.addEventListener('click',()=>run(async()=>{ui.options=await request();render();}));
    root.querySelector('[name=sourceId]')?.addEventListener('change',event=>{ui.sourceId=event.target.value;ui.itemRef='';ui.targetId='';render();});
    for(const name of ['itemRef','targetId'])root.querySelector('[name='+name+']')?.addEventListener('change',event=>ui[name]=event.target.value);
    root.querySelectorAll('[data-potion-use]').forEach(details=>details.addEventListener('toggle',()=>ui.open[details.dataset.potionUse]=details.open));
    root.querySelectorAll('[data-potion-form]').forEach(form=>{
      if(form.dataset.potionForm==='roll')form.addEventListener('change',()=>{const mode=new FormData(form).get('mode');ui.modes[form.dataset.use]=mode;form.querySelector('[data-potion-physical]').hidden=mode!=='physical';form.querySelectorAll('[name=die]').forEach(input=>{input.disabled=mode!=='physical';input.required=mode==='physical';});});
      form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;run(async()=>{
        const data=new FormData(form),type=form.dataset.potionForm,use=state.combat.potionUses.find(u=>u.id===form.dataset.use);
        let input={type,useId:use?.id,revision:use?.revision};
        if(type==='prepare'){
          const body={combatId:ui.options.combatId,sourceId:data.get('sourceId'),itemRef:data.get('itemRef'),targetId:data.get('targetId')},stamp=JSON.stringify(body);if(ui.prepareStamp!==stamp){ui.prepareStamp=stamp;ui.prepareId=crypto.randomUUID();}input={...input,...body,id:ui.prepareId};
        }else if(type==='roll'){ui.rollIds[use.id]||=crypto.randomUUID();const mode=data.get('mode');Object.assign(input,{mode,requestId:ui.rollIds[use.id],...(mode==='physical'?{dice:data.getAll('die').map(Number)}:{})});}
        else if(type==='confirm'){
          const source=state.combat.participants.find(p=>p.id===use.sourceId),target=state.combat.participants.find(p=>p.id===use.targetId);Object.assign(input,{confirmed:data.has('confirmed'),combatRevision:state.combat.revision,sourceRevision:source?.characterRevision,targetRevision:target?.characterRevision??state.combat.revision});
        }else if(type==='recheck')input.reviewed=data.has('reviewed');
        const result=await request(input);if(type==='prepare'){ui.options=null;ui.prepareStamp='';ui.prepareId='';}return result;
      });});
    });
    root.querySelectorAll('[data-potion-cancel],[data-potion-retry]').forEach(button=>button.addEventListener('click',()=>run(async()=>{const id=button.dataset.potionCancel||button.dataset.potionRetry,use=state.combat.potionUses.find(u=>u.id===id);return request({type:button.dataset.potionCancel?'cancel':'retry',useId:id,revision:use.revision,confirmed:true});})));
  }
  render();return ()=>controller.abort();
}
