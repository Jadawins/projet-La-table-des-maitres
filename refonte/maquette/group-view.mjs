import {mountGroupGifts} from './gift-view.mjs';
import {mountGroupLoot} from './loot-view.mjs';
import {mountGroupMessages} from './group-messages.mjs';
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
export function disposeGroups(root) { mounts.get(root)?.abort(); mounts.delete(root); }

export function mountGroups(root, {id = '', catalogue, enabled = true} = {}) {
  disposeGroups(root);
  const controller = new AbortController(); mounts.set(root, controller);
  let disposeMessages=()=>{},disposeLoot=()=>{},disposeGifts=()=>{};
  controller.signal.addEventListener('abort',()=>{disposeMessages();disposeLoot();disposeGifts();},{once:true});
  let group, invitationCode = '', mjInvitationCode = '', ownCharacters = [], notice = '';
  const className = id => catalogue?.classes.find(row => row.id === id)?.nom || id;
  async function api(path = '', data, method = 'POST') {
    const response = await fetch('./api/groupes' + path, {method: data === undefined ? 'GET' : method,
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      ...(data === undefined ? {} : {headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)})});
    const value = await response.json();
    if (!response.ok) throw Error(value.error || 'Le groupe est indisponible. Réessayez.');
    return value;
  }
  function error(message) {
    const target = root.querySelector('[data-group-feedback]');
    if (target) { target.textContent = message; target.focus(); }
  }
  function bind() {
    root.querySelectorAll('form[data-group-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault(); run(async () => {
        const data = Object.fromEntries(new FormData(form));
        if (form.dataset.groupForm === 'create') {
          const result = await api('', data); group = result.group; invitationCode = result.invitationCode; mjInvitationCode = result.mjInvitationCode;
          history.replaceState(null, '', '#groupes/' + group.id); await loadCharacters(); detail();
        } else if (form.dataset.groupForm === 'join') {
          group = await api('/rejoindre', data); location.hash = '#groupes/' + group.id;
        } else {
          group = await api('/' + group.id + '/personnage', {characterId: data.characterId || null});
          notice = 'Votre choix de personnage a été enregistré.'; detail();
        }
      });
    }));
    root.querySelectorAll('[data-group-action]').forEach(button => button.addEventListener('click', () => run(async () => {
      const action = button.dataset.groupAction, inviteRole = button.dataset.inviteRole || 'player';
      if (action === 'refresh') { await loadCharacters(); group = await api('/' + group.id); detail(); return; }
      if (action === 'copy') {
        try { await navigator.clipboard.writeText(inviteRole === 'mj' ? mjInvitationCode : invitationCode); notice = 'Code copié.'; detail(); }
        catch { error('Sélectionnez le code affiché pour le copier.'); } return;
      }
      const questions = {invitation:'Créer un nouveau code ? Les anciens codes ne permettront plus de rejoindre le groupe.',
        fermer:'Fermer les invitations ? Les membres actuels restent dans le groupe.',
        quitter:'Quitter ce groupe ? Votre personnage restera dans votre compte.',
        retirer:'Retirer ce joueur ? Son personnage reste dans son compte. Le code d’invitation sera désactivé.',
        archiver:'Archiver ce groupe pour tous les membres ? Les personnages restent conservés.',
        supprimer:'Supprimer le groupe « ' + group.name + ' » pour tous les membres ? Le groupe et ses combats ne seront plus accessibles. Les fiches de personnages restent dans leurs comptes.'};
      if (!confirm(questions[action])) return;
      const result = action === 'supprimer'
        ? await api('/' + group.id, {confirmed:true, revision:group.revision}, 'DELETE')
        : await api('/' + group.id + '/' + action, action === 'retirer' ? {userId:button.dataset.member} : {role:inviteRole});
      if (action === 'quitter' || action === 'archiver' || action === 'supprimer') { location.hash = '#groupes'; return; }
      if (action === 'invitation') { group = result.group; if(inviteRole === 'mj') mjInvitationCode = result.invitationCode; else invitationCode = result.invitationCode; }
      else { group = result; invitationCode = ''; mjInvitationCode = ''; }
      notice = action === 'retirer' ? 'Membre retiré. Créez un nouveau code si vous souhaitez inviter d’autres joueurs.' : '';
      detail();
    })));
  }
  async function run(work) {
    const buttons = [...root.querySelectorAll('button')]; buttons.forEach(button => button.disabled = true);
    try { await work(); } catch (failure) { if (!controller.signal.aborted) error(failure.message); }
    finally { if (!controller.signal.aborted) buttons.forEach(button => button.disabled = false); }
  }
  const feedback = () => `<p data-group-feedback role="status" tabindex="-1">${esc(notice)}</p>`;
  async function loadCharacters() {
    const response = await fetch('./api/personnages', {credentials:'same-origin', cache:'no-store', signal:controller.signal});
    if (!response.ok) throw Error('Impossible de charger vos personnages. Réessayez.');
    ownCharacters = (await response.json()).characters.filter(character => character.status === 'ready');
  }
  function invitationPanel(role) {
    const mj = role === 'mj', code = mj ? mjInvitationCode : invitationCode;
    const open = mj ? group.mjInvitationOpen : group.invitationOpen;
    const expires = mj ? group.mjInviteExpiresAt : group.inviteExpiresAt;
    return `<section class="portal-card group-invite" data-invitation-role="${role}"><h2>${mj ? 'Inviter un MJ' : 'Inviter vos joueurs'}</h2>
      <p>${mj ? 'Partagez ce code uniquement avec vos MJ : il donne accès aux adversaires cachés, aux commandes du combat et à la validation des dégâts.' : 'Partagez ce code avec vos joueurs. Ils choisissent Joueur en rejoignant le groupe.'} Les codes expirent après sept jours.</p>
      ${code && open ? `<label class="field">Code d’invitation ${mj ? 'MJ' : 'joueur'}<input id="${mj ? 'group-mj-invitation-code' : 'group-invitation-code'}" readonly value="${esc(code)}"></label><button class="button secondary" data-group-action="copy" data-invite-role="${role}">Copier le code ${mj ? 'MJ' : 'joueur'}</button>` : ''}
      <p>${open ? 'Invitations ouvertes jusqu’au ' + esc(new Date(expires).toLocaleDateString('fr-FR')) + '. Le code est affiché uniquement lors de sa création.' : 'Les invitations sont fermées ou expirées.'}</p>
      <div class="portal-actions"><button class="button secondary" data-group-action="invitation" data-invite-role="${role}">${mj ? 'Créer un code MJ' : 'Créer un nouveau code'}</button>${open ? `<button class="button secondary" data-group-action="fermer" data-invite-role="${role}">${mj ? 'Fermer les invitations MJ' : 'Fermer les invitations'}</button>` : ''}</div></section>`;
  }
  function detail() {
    if (controller.signal.aborted) return;
    disposeMessages();disposeLoot();disposeGifts();
    const me = group.members.find(member => member.isMe);
    root.innerHTML = `<a class="back" href="#groupes">← Mes groupes</a><p class="eyebrow">${group.isMJ ? 'VOTRE TABLE · MAÎTRE DU JEU' : 'VOTRE TABLE · JOUEUR'}${group.isOwner ? ' · CRÉATEUR' : ''}</p>
      <h1>${esc(group.name)}</h1><p class="group-description">${esc(group.description || 'Votre groupe est prêt à accueillir ses aventures.')}</p>
      <div class="portal-actions"><a class="button primary" href="#combat/${esc(group.id)}">Ouvrir le combat</a><button class="button secondary" data-group-action="refresh">Actualiser le groupe</button></div>${feedback()}
      ${group.isOwner ? invitationPanel('player') + invitationPanel('mj') : ''}
      <section class="portal-card"><h2>Les membres du groupe (${group.members.length})</h2><ul class="group-members">${group.members.map(member => `<li><div><strong>${esc(member.alias)}</strong> <span>${member.role === 'mj' ? 'MJ' : 'Joueur'}${member.isMe ? ' · Vous' : ''}${member.isOwner ? ' · Créateur' : ''}</span>
        <p>${member.character ? `${esc(member.character.name)} · ${esc(className(member.character.classId))} · Niveau ${esc(member.character.level)}` : member.characterUnavailable ? 'Fiche indisponible : son propriétaire doit choisir un personnage.' : 'Aucun personnage rattaché'}</p></div>
        ${group.isOwner && !member.isOwner ? `<button class="button secondary" data-group-action="retirer" data-member="${esc(member.userId)}" aria-label="Retirer ${esc(member.alias)}">Retirer</button>` : ''}</li>`).join('')}</ul></section>
      <section class="portal-card"><h2>Votre personnage pour ce groupe</h2><p>Vous gardez la propriété de votre fiche. Seuls son nom, sa classe et son niveau sont partagés ici.</p>
        <form data-group-form="character"><label class="field">Personnage enregistré<select name="characterId" id="group-character"><option value="">Aucun personnage</option>${ownCharacters.map(character => `<option value="${esc(character.id)}" ${me?.character?.id === character.id ? 'selected' : ''}>${esc(character.name)} · ${esc(className(character.classId))} · Niveau ${esc(character.level)}</option>`).join('')}</select></label><button class="button primary">Enregistrer mon choix</button></form>
        ${!ownCharacters.length ? '<p>Terminez et enregistrez une fiche pour la sélectionner. <a href="#personnages">Mes personnages →</a></p>' : ''}</section>
      <div class="portal-actions"><button class="button secondary" data-group-action="${group.isOwner ? 'supprimer' : 'quitter'}">${group.isOwner ? 'Supprimer le groupe' : 'Quitter le groupe'}</button></div>`;
    const messageRoot=document.createElement('section');messageRoot.className='portal-card group-message-panel';root.querySelector('.group-description').after(messageRoot);
    disposeMessages=mountGroupMessages(messageRoot,{group,signal:controller.signal});
    const lootRoot=document.createElement('section');lootRoot.className='portal-card group-loot-panel';messageRoot.after(lootRoot);disposeLoot=mountGroupLoot(lootRoot,{group,catalogue,signal:controller.signal});
    const giftRoot=document.createElement('section');
    giftRoot.className='portal-card group-gift-panel';
    lootRoot.after(giftRoot);
    disposeGifts=mountGroupGifts(giftRoot,{group,signal:controller.signal});
    bind();
  }
  async function listing() {
    const {groups} = await api(); if (controller.signal.aborted) return;
    disposeGifts();
    root.innerHTML = `<p class="eyebrow">VOS TABLES DE JEU</p><h1>Mes groupes</h1><p>Créez ou rejoignez une table en choisissant votre rôle : Maître du jeu ou Joueur. Vous pouvez être MJ dans un groupe et joueur dans un autre.</p>${feedback()}
      <div class="group-forms"><section class="portal-card"><h2>Créer un groupe</h2><form data-group-form="create">
        <label class="field">Votre rôle<select name="role" required><option value="">Choisir votre rôle</option><option value="mj">Maître du jeu</option><option value="player">Joueur</option></select></label>
        <label class="field">Nom du groupe<input name="name" required maxlength="100"></label>
        <label class="field">Votre nom à la table<input name="alias" required minlength="2" maxlength="40" autocomplete="nickname"></label>
        <label class="field">Présentation (facultative)<textarea name="description" maxlength="2000" rows="3"></textarea></label>
        <button class="button primary">Créer mon groupe</button></form></section>
      <section class="portal-card"><h2>Rejoindre un groupe</h2><form data-group-form="join">
        <label class="field">Votre rôle<select name="role" required><option value="">Choisir votre rôle</option><option value="mj">Maître du jeu</option><option value="player">Joueur</option></select></label>
        <label class="field">Code d’invitation<input name="code" required maxlength="16" autocomplete="off" spellcheck="false"></label>
        <label class="field">Votre nom à la table<input name="alias" required minlength="2" maxlength="40" autocomplete="nickname"></label>
        <button class="button primary">Rejoindre le groupe</button></form><p>Demandez le code correspondant à votre rôle au créateur du groupe. Aucun message ni e-mail n’est envoyé automatiquement.</p></section></div>
      <section class="portal-card" data-pending-gifts hidden></section><h2>Vos groupes</h2><div class="portal-grid">${groups.length ? groups.map(row => `<article class="portal-card"><p class="eyebrow">${row.isMJ ? 'MAÎTRE DU JEU' : 'JOUEUR'}${row.isOwner ? ' · CRÉATEUR' : ''}</p><h3><a href="#groupes/${esc(row.id)}">${esc(row.name)}</a></h3><p>${esc(row.description)}</p><p>${row.memberCount} membre${row.memberCount > 1 ? 's' : ''}</p><a href="#groupes/${esc(row.id)}">Ouvrir le groupe →</a></article>`).join('') : '<p>Vous ne faites encore partie d’aucun groupe.</p>'}</div>`;
    disposeGifts=mountGroupGifts(root.querySelector('[data-pending-gifts]'),{signal:controller.signal});
    bind();
  }
  root.innerHTML = '<h1>Mes groupes</h1><p role="status">Ouverture des groupes…</p>';
  if (!enabled) { root.innerHTML = '<h1>Mes groupes</h1><p>Connectez-vous à votre compte pour créer ou rejoindre un groupe.</p>'; return; }
  run(async () => {
    if (id) { group = await api('/' + encodeURIComponent(id)); await loadCharacters(); detail(); }
    else await listing();
  }).catch(() => {});
  // The initial loading screen also needs an error target.
  if (!root.querySelector('[data-group-feedback]')) root.insertAdjacentHTML('beforeend', feedback());
}
