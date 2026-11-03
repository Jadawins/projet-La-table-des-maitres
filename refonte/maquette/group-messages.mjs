const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pollNow=()=>{},openPopup=()=>{};
async function request(path,data,signal){
  const response=await fetch('./api/'+path,{method:data===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',signal,...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'Les messages sont indisponibles.'),{status:response.status});return value;
}
export function startMessagePopups(){
  const controller=new AbortController(),deferred=new Set(),handled=new Set();let queue=[],dialog=null,checking=false,timer,feedOffset=0;
  const button=document.createElement('button');button.className='button quiet message-alert';button.type='button';button.dataset.messageInbox='';button.textContent='Messages du MJ';document.querySelector('.topbar').append(button);
  const schedule=()=>{clearTimeout(timer);if(!controller.signal.aborted)timer=setTimeout(check,3000);};
  function close(){if(dialog?.open)dialog.close();}
  function show(message){
    if(controller.signal.aborted||dialog||document.querySelector('dialog[open]'))return;
    dialog=document.createElement('dialog');dialog.className='portal-dialog group-message-popup';dialog.dataset.messagePopup=message.id;dialog.setAttribute('aria-labelledby','mj-message-title');
    dialog.innerHTML=`<p class="eyebrow">MESSAGE PRIVÉ · ${esc(message.groupName)}</p><h2 id="mj-message-title">${esc(message.senderAlias)} vous écrit</h2><p class="hint">${esc(new Date(message.createdAt).toLocaleString('fr-FR'))}</p><p class="message-body">${esc(message.body)}</p>${message.outgoing?`<p class="hint">Destinataires : ${message.recipients.map(p=>esc(p.alias)+(p.readAt?' · lu':' · en attente')).join(', ')}</p>`:''}<p role="status"></p><div class="portal-actions">${!message.outgoing&&!message.readAt?'<button class="button primary" data-message-read>J’ai lu</button><button class="button secondary" data-message-later>Relire plus tard</button>':'<button class="button secondary" data-message-later>Fermer</button>'}</div>`;
    const node=dialog;
    dialog.addEventListener('close',()=>{deferred.add(message.id);node.remove();if(dialog===node)dialog=null;setTimeout(next,0);},{once:true});
    dialog.querySelector('[data-message-later]').onclick=()=>node.close();
    dialog.querySelector('[data-message-read]')?.addEventListener('click',async event=>{
      event.target.disabled=true;
      try{await request('messages/'+message.id+'/lu',{},controller.signal);handled.add(message.id);queue=queue.filter(m=>m.id!==message.id);feedOffset=0;if(dialog===node)close();check();}
      catch(error){if(node.isConnected){node.querySelector('[role=status]').textContent=error.message;event.target.disabled=false;}}
    });document.body.append(dialog);dialog.showModal();
  }
  function next(){if(!document.hidden&&!document.querySelector('dialog[open]')){const message=queue.find(m=>!deferred.has(m.id)&&!handled.has(m.id));if(message)show(message);}}
  async function check(){
    if(checking||controller.signal.aborted)return;
    if(document.hidden){schedule();return;}checking=true;
    try{const result=await request('messages?offset='+feedOffset,undefined,controller.signal);queue=result.messages.filter(m=>!handled.has(m.id));const unread=result.unread??queue.length;button.textContent=unread?'Messages du MJ · '+unread+' non lu(s)':'Messages du MJ';if(queue.every(m=>deferred.has(m.id)))feedOffset=result.hasMore?result.nextOffset:0;next();}
    catch(error){if(error.status===401){controller.abort();close();button.remove();}}
    finally{checking=false;schedule();}
  }
  pollNow=check;openPopup=async id=>{try{const {message}=await request('messages/'+encodeURIComponent(id),undefined,controller.signal);show(message);}catch(error){alert(error.message);}};
  button.onclick=async()=>{try{const result=await request('messages',undefined,controller.signal);if(result.messages.length)show(result.messages[0]);else alert('Aucun message non lu. Retrouvez l’historique dans votre groupe.');}catch(error){alert(error.message);}};
  document.addEventListener('visibilitychange',check,{signal:controller.signal});window.addEventListener('focus',check,{signal:controller.signal});document.addEventListener('close',()=>setTimeout(next,0),{capture:true,signal:controller.signal});window.addEventListener('pagehide',()=>{clearTimeout(timer);controller.abort();close();},{once:true});check();
}
const drafts=new Map();
export function mountGroupMessages(root,{group,signal}){
  const controller=new AbortController();let timer,loading=false,rows=[],more=false,offset=0,sending=false,refreshAgain=false;
  const dispose=()=>{clearTimeout(timer);signal.removeEventListener('abort',dispose);controller.abort();};signal.addEventListener('abort',dispose,{once:true});
  const draft=drafts.get(group.id)||{body:'',recipientIds:[],id:crypto.randomUUID()};drafts.set(group.id,draft);
  const candidates=group.members.filter(p=>!p.isMe);
  root.innerHTML=`<h2>Messages privés du MJ</h2><p>Les destinataires reçoivent une fenêtre sur leur écran quand l’atelier est ouvert. Les messages restent disponibles à leur retour.</p>${group.isMJ?`<form data-group-message-form><fieldset><legend>Envoyer un message privé</legend><div class="message-recipients">${candidates.map(p=>`<label><input type="checkbox" name="recipient" value="${esc(p.userId)}" ${draft.recipientIds.includes(p.userId)?'checked':''}> ${esc(p.alias)}</label>`).join('')||'<p>Invitez des membres pour leur écrire.</p>'}</div><button class="button quiet" type="button" data-message-select-all>Choisir tous les autres membres</button><label class="field">Votre message<textarea name="body" rows="4" maxlength="6000" required>${esc(draft.body)}</textarea></label><button class="button primary" type="submit" ${candidates.length?'':'disabled'}>Envoyer le message</button></fieldset></form>`:''}<p data-message-feedback role="status"></p><div data-message-history></div><button class="button secondary" type="button" data-messages-more hidden>Voir les messages plus anciens</button>`;
  function render(){root.querySelector('[data-message-history]').innerHTML=rows.map(m=>`<article class="message-history-row"><h3>${m.outgoing?'Message envoyé':'Message de '+esc(m.senderAlias)}</h3><p class="hint">${esc(new Date(m.createdAt).toLocaleString('fr-FR'))} · ${m.outgoing?'Lu par '+m.recipients.filter(p=>p.readAt).length+'/'+m.recipients.length:m.readAt?'Lu':'Non lu'}</p><p>${esc(m.body.slice(0,160))}${m.body.length>160?'…':''}</p><button class="button secondary" data-open-message="${m.id}">Lire le message</button></article>`).join('')||'<p>Aucun message pour vous dans ce groupe.</p>';root.querySelector('[data-messages-more]').hidden=!more;root.querySelectorAll('[data-open-message]').forEach(b=>b.onclick=()=>openPopup(b.dataset.openMessage));}
  async function refresh(append=false){
    if(controller.signal.aborted)return;if(loading){refreshAgain=true;return;}loading=true;
    try{const data=await request('groupes/'+group.id+'/messages?offset='+(append?offset:0),undefined,controller.signal);if(controller.signal.aborted)return;rows=append?[...new Map([...rows,...data.messages].map(m=>[m.id,m])).values()]:[...new Map([...data.messages,...rows].map(m=>[m.id,m])).values()];offset=append?data.nextOffset:Math.max(offset,data.nextOffset);more=append?data.hasMore:more||data.hasMore;render();}
    catch(error){if(!controller.signal.aborted)root.querySelector('[data-message-feedback]').textContent=error.message;}
    finally{loading=false;clearTimeout(timer);if(!controller.signal.aborted){if(refreshAgain){refreshAgain=false;refresh();}else timer=setTimeout(()=>{if(!document.hidden)refresh();else timer=setTimeout(()=>refresh(),10000);},10000);}}
  }
  const form=root.querySelector('form');
  function remember(){if(!form)return;draft.body=form.elements.body.value;draft.recipientIds=[...form.querySelectorAll('[name=recipient]:checked')].map(e=>e.value);}
  form?.addEventListener('input',remember);root.querySelector('[data-message-select-all]')?.addEventListener('click',()=>{form.querySelectorAll('[name=recipient]').forEach(e=>e.checked=true);remember();});
  form?.addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;remember();if(!draft.recipientIds.length){root.querySelector('[data-message-feedback]').textContent='Choisissez au moins un destinataire.';return;}
    sending=true;form.querySelector('fieldset').disabled=true;
    try{await request('groupes/'+group.id+'/messages',{id:draft.id,recipientIds:draft.recipientIds,body:draft.body},controller.signal);draft.id=crypto.randomUUID();draft.body='';draft.recipientIds=[];form.reset();form.querySelector('textarea').value='';form.querySelectorAll('[name=recipient]').forEach(e=>e.checked=false);root.querySelector('[data-message-feedback]').textContent='Message envoyé aux destinataires choisis.';await refresh();pollNow();}
    catch(error){if(!controller.signal.aborted)root.querySelector('[data-message-feedback]').textContent=error.message;}
    finally{sending=false;if(!controller.signal.aborted)form.querySelector('fieldset').disabled=false;}
  });root.querySelector('[data-messages-more]').onclick=()=>refresh(true);refresh();return dispose;
}
