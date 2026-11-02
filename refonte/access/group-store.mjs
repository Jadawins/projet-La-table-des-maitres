import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';

const fault = (status, message) => Object.assign(new Error(message), {status});
const hash = code => createHash('sha256').update(code).digest('hex');
const active = {archivedAt: {$exists: false}, deletedAt: {$exists: false}};
const clean = (value, min, max, label) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    throw fault(400, label);
  return value.trim();
};

export function createGroupStore({collection, characters, now = () => new Date()}) {
  function actorId(actor) {
    if (!actor?.userId || typeof actor.userId !== 'string') throw fault(401, 'Reconnectez-vous.');
    return actor.userId;
  }
  const roleFor = (group, member) => member.role ?? (member.userId === group.ownerId ? 'mj' : 'player');
  function selectedRole(value, fallback) {
    const role = value === undefined ? fallback : value;
    if (!['mj', 'player'].includes(role)) throw fault(400, 'Choisissez Maître du jeu ou Joueur.');
    return role;
  }
  async function memberGroup(actor, id) {
    const userId = actorId(actor);
    if (!validCharacterId(id)) throw fault(404, 'Groupe introuvable.');
    const group = await collection.findOne({id, ...active});
    if (!group || !group.members.some(member => member.userId === userId))
      throw fault(404, 'Groupe introuvable.');
    return group;
  }
  function ownerOnly(group, actor) {
    if (group.ownerId !== actorId(actor)) throw fault(403, 'Cette action est réservée au créateur du groupe.');
  }
  async function change(group, fields) {
    const result = await collection.updateOne({id: group.id, revision: group.revision, ...active}, {
      $set: {...fields, revision: group.revision + 1, updatedAt: now()}
    });
    if (result.matchedCount !== 1) throw fault(409, 'Le groupe a changé. Actualisez puis réessayez.');
  }
  function invitation(role = 'player') {
    const code = randomBytes(8).toString('hex').toUpperCase();
    return {code, fields: role === 'mj'
      ? {mjInviteHash: hash(code), mjInviteExpiresAt: new Date(now().getTime() + 7 * 86400000)}
      : {inviteHash: hash(code), inviteExpiresAt: new Date(now().getTime() + 7 * 86400000)}};
  }
  async function view(group, actor) {
    const isOwner = group.ownerId === actorId(actor);
    const isMJ = roleFor(group, group.members.find(member => member.userId === actor.userId)) === 'mj';
    const members = await Promise.all(group.members.map(async member => {
      let character = null;
      if (member.characterId) {
        try {
          const saved = await characters.get(member.userId, member.characterId);
          if (saved.status === 'ready') character = {id: saved.id, name: saved.character.name,
            classId: saved.character.classId, level: saved.character.level};
        } catch (error) { if (error.status !== 404) throw error; }
      }
      return {userId: member.userId, alias: member.alias, role: roleFor(group, member), isOwner: member.userId === group.ownerId,
        isMe: member.userId === actor.userId, character,
        characterUnavailable: Boolean(member.characterId && !character)};
    }));
    return {id: group.id, name: group.name, description: group.description, isMJ, isOwner, revision: group.revision,
      members, createdAt: group.createdAt.toISOString(), updatedAt: group.updatedAt.toISOString(),
      ...(isOwner ? {mjInvitationOpen: Boolean(group.mjInviteHash && group.mjInviteExpiresAt > now()),
        mjInviteExpiresAt: group.mjInviteExpiresAt?.toISOString() || null, invitationOpen: Boolean(group.inviteHash && group.inviteExpiresAt > now()),
        inviteExpiresAt: group.inviteExpiresAt?.toISOString() || null} : {})};
  }
  return {
    async list(actor) {
      const userId = actorId(actor);
      const rows = await collection.find({...active, 'members.userId': userId}).sort({updatedAt: -1}).limit(200).toArray();
      return rows.map(group => ({id: group.id, name: group.name, description: group.description,
        isMJ: roleFor(group, group.members.find(m => m.userId === userId)) === 'mj', isOwner: group.ownerId === userId, memberCount: group.members.length, updatedAt: group.updatedAt.toISOString()}));
    },
    async get(actor, id) { return view(await memberGroup(actor, id), actor); },
    async create(actor, input = {}) {
      const ownerId = actorId(actor);
      const name = clean(input.name, 1, 100, 'Donnez un nom au groupe (100 caractères maximum).');
      const alias = clean(input.alias, 2, 40, 'Choisissez votre nom à la table (2 à 40 caractères).');
      const description = clean(input.description ?? '', 0, 2000, 'La présentation est limitée à 2 000 caractères.');
      const role = selectedRole(input.role, 'mj'), invite = invitation(), mjInvite = invitation('mj'), date = now();
      const group = {id: randomUUID(), ownerId, name, description, members: [{userId: ownerId, alias, role, characterId: null}],
        ...invite.fields, ...mjInvite.fields, revision: 1, createdAt: date, updatedAt: date};
      await collection.insertOne(group);
      return {group: await view(group, actor), invitationCode: invite.code, mjInvitationCode: mjInvite.code};
    },
    async join(actor, input = {}) {
      const userId = actorId(actor);
      const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
      if (!/^[A-F0-9]{16}$/.test(code)) throw fault(404, 'Code d’invitation invalide ou expiré.');
      const alias = clean(input.alias, 2, 40, 'Choisissez votre nom à la table (2 à 40 caractères).');
      const role = selectedRole(input.role, 'player'), field = role === 'mj' ? 'mjInviteHash' : 'inviteHash';
      const group = await collection.findOne({...active, [field]: hash(code)});
      const expires = group?.[role === 'mj' ? 'mjInviteExpiresAt' : 'inviteExpiresAt'];
      if (!group || !expires || expires <= now())
        throw fault(404, 'Code d’invitation invalide ou expiré.');
      const existing = group.members.find(member => member.userId === userId);
      if (existing) {
        if (roleFor(group, existing) !== role) throw fault(409, 'Vous faites déjà partie de ce groupe avec un autre rôle.');
        return view(group, actor);
      }
      if (group.members.length >= 50) throw fault(409, 'Ce groupe a atteint sa limite de 50 membres.');
      await change(group, {members: [...group.members, {userId, alias, role, characterId: null}]});
      return this.get(actor, group.id);
    },
    async rotate(actor, id, input = {}) {
      const group = await memberGroup(actor, id); ownerOnly(group, actor);
      const role = selectedRole(input.role, 'player'), invite = invitation(role); await change(group, invite.fields);
      return {group: await this.get(actor, id), invitationCode: invite.code, role};
    },
    async closeInvitation(actor, id, input = {}) {
      const group = await memberGroup(actor, id); ownerOnly(group, actor);
      const role = selectedRole(input.role, 'player');
      await change(group, role === 'mj' ? {mjInviteHash: null, mjInviteExpiresAt: null} : {inviteHash: null, inviteExpiresAt: null});
      return this.get(actor, id);
    },
    async attach(actor, id, input = {}) {
      const group = await memberGroup(actor, id);
      const characterId = input.characterId;
      if (characterId !== null) {
        if (!validCharacterId(characterId)) throw fault(400, 'Choisissez une fiche enregistrée dans votre compte.');
        const saved = await characters.get(actor.userId, characterId);
        if (saved.status !== 'ready') throw fault(400, 'Terminez et enregistrez la fiche avant de la rattacher.');
      }
      await change(group, {members: group.members.map(member => member.userId === actor.userId ? {...member, characterId} : member)});
      return this.get(actor, id);
    },
    async leave(actor, id) {
      const group = await memberGroup(actor, id);
      if (group.ownerId === actor.userId) throw fault(400, 'Le créateur peut supprimer le groupe, mais ne peut pas le quitter.');
      await change(group, {members: group.members.filter(member => member.userId !== actor.userId)});
      return {left: true};
    },
    async removeMember(actor, id, input = {}) {
      const group = await memberGroup(actor, id); ownerOnly(group, actor);
      if (input.userId === group.ownerId) throw fault(400, 'Le créateur ne peut pas se retirer du groupe.');
      if (!group.members.some(member => member.userId === input.userId)) throw fault(404, 'Membre introuvable.');
      // Rotate/close the invitation to prevent an excluded member immediately rejoining with the old code.
      await change(group, {members: group.members.filter(member => member.userId !== input.userId), inviteHash: null, inviteExpiresAt: null, mjInviteHash: null, mjInviteExpiresAt: null});
      return this.get(actor, id);
    },
    async remove(actor, id, input = {}) {
      const group = await memberGroup(actor, id); ownerOnly(group, actor);
      if (input.confirmed !== true || !Number.isInteger(input.revision) || input.revision < 1)
        throw fault(400, 'Confirmez la suppression du groupe.');
      if (input.revision !== group.revision)
        throw fault(409, 'Le groupe a changé. Actualisez avant de le supprimer.');
      // As with character removal, retain a private tombstone; all group access is closed.
      // Characters remain owned by their accounts; combat access always checks the group.
      await change(group, {deletedAt: now(), inviteHash: null, inviteExpiresAt: null, mjInviteHash: null, mjInviteExpiresAt: null});
      return {id, deleted: true};
    },
    async archive(actor, id) {
      const group = await memberGroup(actor, id); ownerOnly(group, actor);
      await change(group, {archivedAt: now(), inviteHash: null, inviteExpiresAt: null, mjInviteHash: null, mjInviteExpiresAt: null});
      return {archived: true};
    }
  };
}
