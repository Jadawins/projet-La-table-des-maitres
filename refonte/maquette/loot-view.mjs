import {catalogueOptions} from './equipment-view.mjs';
import {COINS} from './wallet-state.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coinsText=coins=>Object.keys(COINS).filter(c=>coins[c]).map(c=>coins[c]+' '+c.toUpperCase()).join(' · ');
const giftText=payload=>[payload.item?payload.item.quantity+' × '+payload.item.name:'',coinsText(payload.coins)].filter(Boolean).join(' + ');
export function lootPreview(row){
  const remaining=row.recipients.filter(r=>!r.deliveredAt),eligible=remaining.filter(r=>!r.needsReview);
  return `<h2 id="loot-preview-title">Attribuer ce butin ?</h2><p><strong>${esc(row.label)}</strong></p><p>Chaque personnage sélectionné reçoit : <strong>${esc(giftText(row.payload))}</strong>.</p><ul>${row.recipients.map(r=>`<li><strong>${esc(r.characterName)}</strong> · ${esc(r.alias)} : ${r.deliveredAt?'déjà reçu, ne sera pas renvoyé':r.error?esc(r.error):'à attribuer'}</li>`).join('')}</ul><p>Les objets sont ajoutés sans être équipés. Aucune pièce n’est retirée au MJ. En cas d’interruption, le suivi permet de reprendre uniquement ce qui reste à attribuer.</p><form method="dialog"><button class="button secondary" value="cancel" autofocus>Annuler</button><button class="button primary" value="confirm" ${!eligible.length?'disabled':''}>Confirmer ${eligible.length} attribution${eligible.length>1?'s':''}</button></form>`;
}
export function renderLootHistory(rows,{isMJ=false,me=''}={}){
  const names={prepared:'À confirmer',delivering:'Attribution en cours',partial:'Attribution incomplète',done:'Butin attribué',cancelled:'Préparation abandonnée',pending:'Attribution en attente'};
  return rows.map(row=>`<article class="loot-entry" data-loot-entry="${esc(row.id)}"><h3>${esc(row.label)}</h3><p>${esc(names[row.status]||row.status)} · ${esc(row.senderAlias)} · ${esc(new Date(row.createdAt).toLocaleString('fr-FR'))}</p><p>${esc(giftText(row.payload))}${isMJ?' par personnage sélectionné':''}</p><ul>${row.recipients.map(r=>`<li>${esc(r.characterName)} · ${r.deliveredAt?'Reçu':r.needsReview?'À revoir':'En attente'}${r.error?`<p class="hint">${esc(r.error)}</p>`:''}${r.deliveredAt&&(!isMJ||r.userId===me)?` <a href="#ouvrir/${esc(r.characterId)}">Ouvrir ma fiche</a>`:''}</li>`).join('')}</ul>${isMJ&&!['done','cancelled'].includes(row.status)?`<div class="portal-actions"><button class="button secondary" data-loot-open="${esc(row.id)}">${row.confirmedAt?'Reprendre les attributions restantes':'Voir le récapitulatif'}</button><button class="button secondary" data-loot-refresh="${esc(row.id)}">Revoir les fiches restantes</button>${!row.confirmedAt&&row.status==='prepared'?`<button class="button quiet" data-loot-cancel="${esc(row.id)}">Abandonner la préparation</button>`:''}</div>${row.status==='delivering'?'<p class="hint">Si l’envoi a été interrompu, actualisez le suivi et réessayez après une minute.</p>':''}`:''}</article>`).join('')||'<p>Aucune attribution pour le moment.</p>';
}
export function mountGroupLoot(root,{group,catalogue,signal}){
  const controller=new AbortController();signal?.addEventListener('abort',()=>controller.abort(),{once:true});
  let rows=[],hasMore=false,offset=0,busy=false,timer,dialog,pendingId='',pendingBody='';
  const me=group.members.find(m=>m.isMe)?.userId;
  async function api(path='',body){
    const response=await fetch('./api/groupes/'+encodeURIComponent(group.id)+'/butin'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Impossible de suivre cette attribution. Actualisez puis réessayez.');return result;
  }
  function feedback(text){const target=root.querySelector('[data-loot-feedback]');if(target)target.textContent=text;}
  function busyUI(value){busy=value;root.querySelectorAll('button').forEach(b=>b.disabled=value);}
  async function history(more=false){
    const result=await api('?offset='+(more?offset:0));if(controller.signal.aborted)return;
    rows=more?[...rows,...result.allocations]:result.allocations;offset=result.nextOffset;hasMore=result.hasMore;
    root.querySelector('[data-loot-history]').innerHTML=renderLootHistory(rows,{isMJ:group.isMJ,me});root.querySelector('[data-loot-more]').hidden=!hasMore;bindHistory();
  }
  async function work(fn){if(busy)return;busyUI(true);feedback('');try{await fn();}catch(error){if(!controller.signal.aborted){feedback(error.message);try{await history();}catch{}}}finally{if(!controller.signal.aborted)busyUI(false);}}
  async function preview(row){
    if(row.status==='done'){await history();feedback('Ce butin a déjà été attribué.');return;}
    dialog=document.createElement('dialog');dialog.className='confirm-dialog loot-preview';dialog.setAttribute('aria-labelledby','loot-preview-title');dialog.innerHTML=lootPreview(row);document.body.append(dialog);
    const confirmed=await new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.showModal();});dialog.remove();dialog=null;
    if(controller.signal.aborted)return;
    if(confirmed){
      const result=await api('/'+row.id+'/confirmer',{revision:row.revision,confirmed:true});
      await history();feedback(result.allocation.status==='done'?'Butin attribué. Les fiches sont enregistrées dans les comptes de leurs propriétaires.':'Certaines attributions restent en attente. Vérifiez le suivi pour les reprendre.');
    }else if(!row.confirmedAt&&row.status==='prepared'){
      await api('/'+row.id+'/abandonner',{revision:row.revision});await history();feedback('Préparation abandonnée. Aucune fiche n’a reçu ce butin.');
    }
  }
  function bindHistory(){
    root.querySelectorAll('[data-loot-open]').forEach(button=>button.addEventListener('click',()=>work(async()=>preview((await api('/'+button.dataset.lootOpen)).allocation))));
    root.querySelectorAll('[data-loot-refresh]').forEach(button=>button.addEventListener('click',()=>work(async()=>{const row=(await api('/'+button.dataset.lootRefresh)).allocation,result=await api('/'+row.id+'/actualiser',{revision:row.revision});await history();await preview(result.allocation);}))); 
    root.querySelectorAll('[data-loot-cancel]').forEach(button=>button.addEventListener('click',()=>work(async()=>{const row=(await api('/'+button.dataset.lootCancel)).allocation;await api('/'+row.id+'/abandonner',{revision:row.revision});await history();feedback('Préparation abandonnée.');})));
  }
  root.innerHTML=`<h2>${group.isMJ?'Distribuer du butin':'Butin de votre personnage'}</h2><p data-loot-feedback role="status" aria-live="polite"></p>${group.isMJ?`<p>Choisissez les personnages destinataires. Chacun recevra la quantité et les pièces indiquées ; le montant n’est pas divisé automatiquement.</p><details data-loot-compose><summary>Préparer un butin</summary><form data-loot-form><label class="field">Nom du butin<input name="label" maxlength="100" required placeholder="Récompense de la crypte"></label><fieldset><legend>Personnages destinataires</legend>${group.members.map(m=>`<label class="loot-recipient"><input type="checkbox" name="recipient" value="${esc(m.userId)}" ${!m.character?'disabled':''}> ${esc(m.alias)} · ${esc(m.character?.name||'Aucun personnage disponible')}</label>`).join('')}</fieldset><fieldset><legend>Pièces reçues par chacun</legend><div class="wallet-balances">${Object.keys(COINS).map(coin=>`<label class="field">${coin.toUpperCase()} par personnage<input name="${coin}" type="number" min="0" max="1000000000" step="1" value="0" required></label>`).join('')}</div></fieldset><label><input type="checkbox" name="giveItem"> Ajouter un objet au butin</label><div data-loot-item hidden><label class="field">Objet du catalogue<select name="catalogueRef" aria-label="Objet du catalogue">${catalogueOptions(catalogue)}</select></label><label class="field">Nom de l’objet<input name="itemName" maxlength="120"></label><label class="field">Quantité par personnage<input name="quantity" type="number" min="1" max="9999" step="1" value="1"></label><label><input type="checkbox" name="consumable"> Objet consommable</label><label class="field">Description de l’objet<textarea name="description" maxlength="2000" rows="2"></textarea></label></div><button class="button primary">Préparer le récapitulatif</button></form></details>`:'<p>Les attributions du MJ apparaissent ici. Ouvrez ou actualisez votre fiche pour retrouver le butin reçu.</p>'}<button class="button secondary" data-loot-reload>Actualiser le butin</button><div data-loot-history></div><button class="button secondary" data-loot-more hidden>Voir les attributions précédentes</button>`;
  const form=root.querySelector('[data-loot-form]');
  form?.elements.giveItem.addEventListener('change',()=>{const enabled=form.elements.giveItem.checked;root.querySelector('[data-loot-item]').hidden=!enabled;form.elements.itemName.required=enabled;form.elements.quantity.required=enabled;});
  form?.elements.catalogueRef.addEventListener('change',()=>{if(form.elements.catalogueRef.value)form.elements.itemName.value=form.elements.catalogueRef.selectedOptions[0].textContent;form.elements.consumable.checked=form.elements.catalogueRef.value.startsWith('potion:');});
  form?.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity())return;work(async()=>{
    const data=new FormData(form),recipientIds=data.getAll('recipient');if(!recipientIds.length)throw Error('Choisissez au moins un personnage destinataire.');
    const input={label:data.get('label'),recipientIds,payload:{coins:Object.fromEntries(Object.keys(COINS).map(c=>[c,Number(data.get(c))])),item:data.has('giveItem')?{name:data.get('itemName'),quantity:Number(data.get('quantity')),description:data.get('description'),consumable:data.has('consumable'),...(data.get('catalogueRef')?{catalogueRef:data.get('catalogueRef')}:{} )}:null}};
    const stamp=JSON.stringify(input);if(stamp!==pendingBody){pendingBody=stamp;pendingId=crypto.randomUUID();}
    const result=await api('',{...input,id:pendingId});await history();await preview(result.allocation);pendingId='';pendingBody='';
  });});
  root.querySelector('[data-loot-reload]').addEventListener('click',()=>work(()=>history()));root.querySelector('[data-loot-more]').addEventListener('click',()=>work(()=>history(true)));
  async function poll(){if(!controller.signal.aborted){if(!busy&&!document.hidden)try{await history();}catch{}timer=setTimeout(poll,10000);}}
  controller.signal.addEventListener('abort',()=>{clearTimeout(timer);dialog?.close();dialog?.remove();},{once:true});
  work(()=>history()).then(()=>{if(!controller.signal.aborted)timer=setTimeout(poll,10000);});
  return ()=>controller.abort();
}
