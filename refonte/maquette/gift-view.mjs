import {COINS} from './wallet-state.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
}[char]));
const coinNames = Object.keys(COINS);
const statuses = {
  offered:'En attente de réponse', processing:'Enregistrement en cours', pending:'À reprendre',
  done:'Don remis', declined:'Don refusé', cancelled:'Offre retirée',
};

function describe(gift) {
  const parts = gift.item ? [gift.item.quantity + ' × ' + gift.item.name] : [];
  for (const coin of coinNames) {
    if (gift.coins[coin]) parts.push(gift.coins[coin] + ' ' + coin.toUpperCase());
  }
  return parts.join(' · ');
}

function rowView(gift) {
  const button = (action, text) => '<button type="button" class="button secondary" data-gift-action="' +
    action + '" data-gift-id="' + esc(gift.id) + '">' + text + '</button>';
  let actions = '';
  if (gift.status === 'offered') {
    actions = gift.incoming ? button('accepter','Accepter') + button('refuser','Refuser') : button('retirer','Retirer l’offre');
  } else if (['pending','processing'].includes(gift.status)) {
    actions = button('reprendre','Reprendre le don');
  }
  return `<article class="loot-entry" data-gift-entry="${esc(gift.id)}">
    <h3>${esc(gift.from)} → ${esc(gift.to)}</h3>
    <p>${esc(statuses[gift.status])} · ${esc(gift.groupName)}</p>
    <p><strong>${esc(describe(gift))}</strong></p>
    ${gift.item?.description ? '<p>'+esc(gift.item.description)+'</p>' : ''}
    ${gift.error ? '<p class="hint">'+esc(gift.error)+'</p>' : ''}
    ${gift.debited && gift.status !== 'done' ? '<p class="hint">Les biens ont été retirés au donneur. Le suivi permet de terminer la remise.</p>' : ''}
    ${gift.status === 'done' ? '<a href="#ouvrir/'+esc(gift.ownCharacterId)+'">Ouvrir ma fiche</a>' : ''}
    ${actions ? '<div class="portal-actions">'+actions+'</div>' : ''}
  </article>`;
}

export function mountGroupGifts(root, {group, signal} = {}) {
  const controller = new AbortController();
  let options, rows = [], offset = 0, refreshSequence = 0, busy = false, timer, dialog, requestId, requestKey;
  const groupPath = group ? './api/groupes/' + encodeURIComponent(group.id) + '/dons' : '';
  const listPath = groupPath || './api/dons';

  async function api(path, body) {
    const response = await fetch(path, {
      method:body === undefined ? 'GET' : 'POST',
      credentials:'same-origin', cache:'no-store', signal:controller.signal,
      ...(body === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Le suivi des dons est indisponible.');
    return result;
  }

  const feedback = message => { root.querySelector('[data-gift-feedback]').textContent = message; };
  const field = name => root.querySelector('[data-gift-form]')?.elements.namedItem(name);
  const me = group?.members.find(member => member.isMe);

  root.innerHTML = `<h2>${group ? 'Dons entre personnages' : 'Dons à terminer'}</h2>
    <p data-gift-feedback role="status" aria-live="polite"></p>
    ${group ? '<p>Proposez un objet ou des pièces à un autre personnage du groupe. Le destinataire décide s’il accepte le don.</p>' : ''}
    ${me?.character ? '<details data-gift-compose><summary>Proposer un don</summary><div data-gift-fields></div></details>' :
      group ? '<p>Rattachez votre personnage pour proposer un don.</p>' : ''}
    <div class="portal-actions"><button type="button" class="button secondary" data-gift-reload>Actualiser les dons</button></div>
    <div data-gift-history></div>
    <button type="button" class="button secondary" data-gift-more hidden>Voir les dons précédents</button>`;
  if (!group) root.hidden = true;

  async function refresh(more = false) {
    const sequence = ++refreshSequence;
    const result = await api(listPath + '?offset=' + (more ? offset : 0));
    if (controller.signal.aborted || sequence !== refreshSequence) return;
    rows = more ? [...rows,...result.gifts.filter(row=>!rows.some(old=>old.id===row.id))] : result.gifts;
    offset = result.nextOffset;
    root.querySelector('[data-gift-history]').innerHTML = rows.map(rowView).join('') || '<p>Aucun don pour le moment.</p>';
    root.querySelector('[data-gift-more]').hidden = !result.hasMore;
    if (!group) root.hidden = rows.length === 0;
  }

  async function work(run) {
    if (busy) return;
    busy = true;
    feedback('');
    try { await run(); }
    catch (error) { if (!controller.signal.aborted) feedback(error.message); }
    finally { busy = false; }
  }

  function confirmGift(title, gift, buttonText) {
    const note = gift.item?.description ? '<p>'+esc(gift.item.description)+'</p>' : '';
    dialog = document.createElement('dialog');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('aria-labelledby','gift-dialog-title');
    dialog.innerHTML = `<h2 id="gift-dialog-title">${esc(title)}</h2>
      <p>${esc(gift.from)} → ${esc(gift.to)}</p><p><strong>${esc(describe(gift))}</strong></p>${note}
      <form method="dialog"><button class="button secondary" value="cancel" autofocus>Retour</button>
      <button class="button primary" value="confirm">${esc(buttonText)}</button></form>`;
    document.body.append(dialog);
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        const accepted = dialog.returnValue === 'confirm';
        dialog.remove();
        dialog = null;
        resolve(accepted);
      }, {once:true});
      dialog.showModal();
    });
  }

  function renderForm() {
    const panel = root.querySelector('[data-gift-fields]');
    if (!options.targets.length) {
      panel.innerHTML = '<p>Un autre membre doit rattacher son personnage pour recevoir un don.</p>';
      return;
    }
    panel.innerHTML = `<form data-gift-form>
      <label class="field">Personnage destinataire<select name="recipient" required>
        <option value="">Choisir un personnage</option>
        ${options.targets.map(target=>'<option value="'+esc(target.userId)+'">'+esc(target.character.name)+' · '+esc(target.alias)+'</option>').join('')}
      </select></label>
      <label class="field">Objet à donner<select name="item">
        <option value="">Aucun objet</option>
        ${options.items.map(item=>'<option value="'+esc(item.ref)+'">'+esc(item.name)+' · '+item.quantity+' disponible(s)</option>').join('')}
      </select></label>
      <label class="field" data-gift-quantity hidden>Quantité de l’objet<input name="quantity" type="number" min="1" step="1" value="1" disabled required></label>
      <fieldset><legend>Pièces à donner</legend><div class="wallet-balances">
        ${coinNames.map(coin=>'<label class="field">'+coin.toUpperCase()+' ('+options.coins[coin]+' disponibles)<input name="'+coin+'" type="number" min="0" max="'+options.coins[coin]+'" step="1" value="0" required></label>').join('')}
      </div></fieldset>
      <button class="button primary">Vérifier le don</button>
    </form>`;
    const form = panel.querySelector('form');
    field('item').addEventListener('change', () => {
      const item = options.items.find(item => item.ref === field('item').value);
      const quantity = field('quantity');
      quantity.disabled = !item;
      panel.querySelector('[data-gift-quantity]').hidden = !item;
      if (item) { quantity.max = Math.min(item.quantity,9999); quantity.value = '1'; }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      work(async () => {
        const target = options.targets.find(row => row.userId === field('recipient').value);
        const item = options.items.find(row => row.ref === field('item').value);
        const quantity = item ? Number(field('quantity').value) : 0;
        const coins = Object.fromEntries(coinNames.map(coin=>[coin,Number(field(coin).value)]));
        if (!target || !item && !Object.values(coins).some(Boolean)) throw Error('Choisissez un personnage et un objet ou des pièces.');
        const preview = {from:options.from.name,to:target.character.name,coins,item:item?{name:item.name,quantity}:null};
        if (!await confirmGift('Proposer ce don ?',preview,'Envoyer l’offre') || controller.signal.aborted) return;
        const body = {sourceId:options.from.id,targetId:target.character.id,recipientId:target.userId,coins,item:item?{ref:item.ref,quantity}:null};
        const key = JSON.stringify(body);
        if (key !== requestKey) { requestKey = key; requestId = crypto.randomUUID(); }
        await api(groupPath,{...body,id:requestId});
        requestKey = requestId = undefined;
        root.querySelector('[data-gift-compose]').open = false;
        await refresh();
        feedback('Offre proposée. Le destinataire peut l’accepter ou la refuser.');
      });
    });
  }

  const composer = root.querySelector('[data-gift-compose]');
  composer?.addEventListener('toggle', async () => {
    if (!composer.open) return;
    const panel = root.querySelector('[data-gift-fields]');
    panel.textContent = 'Chargement de votre inventaire…';
    try {
      const result = await api(groupPath+'/options');
      if (controller.signal.aborted || !composer.open) return;
      options = result;
      renderForm();
    } catch (error) {
      if (!controller.signal.aborted) panel.textContent = error.message;
    }
  });

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute('data-gift-reload')) { work(()=>refresh()); return; }
    if (button.hasAttribute('data-gift-more')) { work(()=>refresh(true)); return; }
    const gift = rows.find(row => row.id === button.dataset.giftId);
    if (!gift) return;
    work(async () => {
      const action = button.dataset.giftAction;
      if (action === 'accepter' && !await confirmGift('Accepter ce don ?',gift,'Confirmer la réception')) return;
      if (controller.signal.aborted) return;
      const path = action === 'reprendre' ? './api/dons/'+gift.id+'/reprendre' : groupPath+'/'+gift.id+'/'+action;
      try {
        const result = await api(path,{revision:gift.revision});
        await refresh();
        feedback(result.gift.status === 'done' ? 'Le don est remis. Ouvrez votre fiche pour retrouver son nouvel inventaire et son solde.' :
          result.gift.status === 'pending' ? result.gift.error : statuses[result.gift.status]);
      } catch (error) {
        try { await refresh(); } catch {}
        throw error;
      }
    });
  });

  async function poll() {
    if (controller.signal.aborted) return;
    if (!busy && !document.hidden) {
      try { await refresh(); } catch {}
    }
    if (!controller.signal.aborted && group) timer = setTimeout(poll,10000);
  }
  signal?.addEventListener('abort',()=>controller.abort(),{once:true});
  controller.signal.addEventListener('abort',()=>{
    clearTimeout(timer);
    if(dialog?.open)dialog.close();
  },{once:true});
  work(refresh).then(()=>{if(group&&!controller.signal.aborted)timer=setTimeout(poll,10000);});
  return ()=>controller.abort();
}
