import {createHash, randomUUID} from 'node:crypto';
import {validCharacterId} from './character-store.mjs';
import {creditGift, debitGift, giftCoins, giftItem} from '../maquette/gift-rules.mjs';
import {copperTotal, walletCoins} from '../maquette/wallet-state.mjs';

const fault = (status, message) => Object.assign(new Error(message), {status});
const LEASE_MS = 60_000;
const PAGE_SIZE = 30;
const acceptedStatuses = ['processing', 'pending'];
const involved = userId => ({$or:[{'from.userId':userId}, {'to.userId':userId}]});
const member = (group, userId) => group.members.find(row => row.userId === userId);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createGroupGifts({collection, groups, characters, catalogue, sheetModel, validate, now = () => new Date()}) {
  async function savedFor(person) {
    const saved = await characters.get(person.userId, person.characterId);
    if (saved.status !== 'ready' || (person.createdAt && saved.createdAt !== person.createdAt)) {
      throw fault(409, 'La fiche d’origine doit être disponible et complète dans le compte de son propriétaire.');
    }
    return saved;
  }

  function expose(actor, row) {
    const own = actor.userId === row.from.userId ? row.from : row.to;
    return {
      id:row.id, groupId:row.groupId, groupName:row.groupName,
      from:row.from.characterName, to:row.to.characterName,
      ownCharacterId:own.characterId, incoming:own === row.to,
      item:row.item, coins:row.coins, status:row.status, revision:row.revision,
      createdAt:row.createdAt.toISOString(), acceptedAt:row.acceptedAt?.toISOString() ?? null,
      debited:Boolean(row.debited), error:row.error ?? '',
      leaseUntil:row.status === 'processing' ? row.leaseUntil.toISOString() : null,
    };
  }

  async function load(actor, id, groupId) {
    if (!validCharacterId(id)) throw fault(404, 'Don introuvable.');
    const row = await collection.findOne({id, ...(groupId ? {groupId} : {}), ...involved(actor.userId)});
    if (!row) throw fault(404, 'Don introuvable.');
    return row;
  }

  function binding(row, saved) {
    return {userId:row.userId, characterId:saved.id, characterName:saved.character.name, createdAt:saved.createdAt};
  }

  function assertAttached(group, person) {
    if (member(group, person.userId)?.character?.id !== person.characterId) {
      throw fault(409, 'Les deux personnages doivent être rattachés au groupe. Proposez un nouveau don si une fiche a changé.');
    }
  }

  function build(row, side, state, at = (row.acceptedAt ?? row.createdAt).toISOString()) {
    const model = sheetModel(state);
    if (side === 'from') return debitGift(state, model, catalogue, row, {
      receiptId:row.debitId, otherName:row.to.characterName, at,
    });
    return creditGift(state, model, row, {
      receiptId:row.creditId, itemId:row.itemId, otherName:row.from.characterName, at,
    });
  }

  async function checkCredit(row) {
    try {
      const target = await savedFor(row.to);
      if (validate(build(row, 'to', target.character)).status !== 'ready') throw fault(409, 'La fiche destinataire doit être complète.');
    } catch (error) {
      if ([400,404,409].includes(error.status)) {
        throw fault(409, 'Le personnage destinataire ne peut pas recevoir ce don pour le moment.');
      }
      throw error;
    }
  }

  async function precheck(row) {
    const source = await savedFor(row.from);
    if (validate(build(row, 'from', source.character)).status !== 'ready') throw fault(409, 'La fiche du donneur doit être complète.');
    await checkCredit(row);
  }

  async function claim(row, revision, expectedStatus) {
    if (row.revision !== revision || row.status !== expectedStatus) {
      throw fault(409, 'Ce don a changé. Actualisez le suivi.');
    }
    const date = now();
    if (row.status === 'processing' && row.leaseUntil > date) {
      throw fault(409, 'Ce don est en cours. Réessayez après une minute si le suivi reste bloqué.');
    }
    const fields = {
      status:'processing', acceptedAt:row.acceptedAt ?? date, error:'',
      leaseToken:randomUUID(), leaseUntil:new Date(date.getTime() + LEASE_MS),
      revision:row.revision + 1, updatedAt:date,
    };
    const result = await collection.updateOne({id:row.id, revision, status:expectedStatus}, {$set:fields});
    if (!result.matchedCount) throw fault(409, 'Une autre action a modifié ce don. Actualisez le suivi.');
    return {...row, ...fields};
  }

  async function saveClaim(row, changes) {
    const next = {...changes, revision:row.revision + 1, updatedAt:now()};
    const result = await collection.updateOne(
      {id:row.id, revision:row.revision, leaseToken:row.leaseToken, status:'processing'}, {$set:next},
    );
    if (!result.matchedCount) throw fault(409, 'Ce don a été repris ailleurs. Actualisez le suivi.');
    Object.assign(row, next);
  }

  const receipt = (row, side) => characters.lootReceipt(
    row[side].characterId, side === 'from' ? row.debitId : row.creditId, row.stamp,
  );

  async function applySide(row, side) {
    if (await receipt(row, side)) return;
    const person = row[side], saved = await savedFor(person);
    await characters.applyLoot(person.userId, person.characterId, {
      receiptId:side === 'from' ? row.debitId : row.creditId,
      stamp:row.stamp, revision:saved.revision, expectedCreatedAt:person.createdAt,
      build:state => build(row, side, state),
      async authorize() {
        const current = await collection.findOne({id:row.id, leaseToken:row.leaseToken, status:'processing'});
        if (!current || current.leaseUntil <= now()) throw fault(409, 'Le don doit être repris depuis le suivi.');
      },
    });
  }

  async function execute(row) {
    let side = 'from';
    try {
      if (!await receipt(row, 'from')) {
        side = 'to';
        await checkCredit(row);
        side = 'from';
        await applySide(row, 'from');
      }
      await saveClaim(row, {debited:true, leaseUntil:new Date(now().getTime() + LEASE_MS)});
      side = 'to';
      await applySide(row, 'to');
    } catch (error) {
      const debited = row.debited || Boolean(await receipt(row, 'from'));
      const detail = side === 'from' && [400,404,409].includes(error.status)
        ? 'Vérifiez la disponibilité du personnage donneur, de l’objet et des pièces.'
        : side === 'to' && [400,404,409].includes(error.status)
          ? 'Vérifiez que la fiche destinataire peut encore recevoir le don.'
          : 'L’enregistrement a été interrompu. Reprenez le don depuis le suivi.';
      await saveClaim(row, {status:'pending', debited, error:detail, leaseUntil:now()});
      return;
    }
    await saveClaim(row, {status:'done', error:'', leaseUntil:now()});
  }

  async function list(actor, filter, offset) {
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) throw fault(400, 'Page de dons invalide.');
    const rows = await collection.find({...filter, ...involved(actor.userId)})
      .sort({updatedAt:-1, id:-1}).skip(offset).limit(PAGE_SIZE + 1).toArray();
    return {
      gifts:rows.slice(0,PAGE_SIZE).map(row => expose(actor,row)),
      hasMore:rows.length > PAGE_SIZE, nextOffset:offset + Math.min(rows.length,PAGE_SIZE),
    };
  }

  return {
    async options(actor, groupId) {
      const group = await groups.get(actor, groupId);
      const own = member(group,actor.userId);
      if (!own?.character) throw fault(409, 'Rattachez une fiche complète pour proposer un don.');
      const saved = await savedFor({userId:actor.userId, characterId:own.character.id});
      const model = sheetModel(saved.character);
      return {
        from:own.character,
        coins:walletCoins(saved.character, model.money),
        items:model.possessions.map(item => ({ref:item.ref, name:item.nom, quantity:item.quantity})),
        targets:group.members.filter(row => !row.isMe && row.character)
          .map(row => ({userId:row.userId, alias:row.alias, character:row.character})),
      };
    },

    async propose(actor, groupId, input) {
      const group = await groups.get(actor, groupId);
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          !validCharacterId(input.id) || !validCharacterId(input.sourceId) ||
          !validCharacterId(input.targetId) || typeof input.recipientId !== 'string' ||
          input.recipientId === actor.userId) {
        throw fault(400, 'Choisissez un autre personnage du groupe.');
      }
      const {id, recipientId, sourceId, targetId} = input;
      const coins = giftCoins(input.coins);
      const itemRef = input.item?.ref ?? '';
      const quantity = input.item?.quantity ?? 0;
      if (input.item != null && (typeof itemRef !== 'string' || itemRef.length > 190 || !itemRef ||
          !Number.isInteger(quantity) || quantity < 1 || quantity > 9999)) {
        throw fault(400, 'Choisissez un objet de votre inventaire et une quantité entière.');
      }
      if (!itemRef && !copperTotal(coins)) throw fault(400, 'Choisissez un objet ou des pièces à donner.');
      const requestStamp = hash([actor.userId, groupId, sourceId, recipientId, targetId, itemRef, quantity, coins]);
      const existing = await collection.findOne({id});
      if (existing) {
        if (existing.requestStamp !== requestStamp) throw fault(409, 'Cette référence de don est déjà utilisée.');
        return {gift:expose(actor,existing)};
      }
      const source = {userId:actor.userId, characterId:sourceId};
      const target = {userId:recipientId, characterId:targetId};
      assertAttached(group,source);
      assertAttached(group,target);
      const [from, to] = await Promise.all([savedFor(source), savedFor(target)]);
      const item = itemRef ? giftItem(from.character,sheetModel(from.character),itemRef,quantity) : null;
      const date = now();
      const row = {
        id, groupId, groupName:group.name, from:binding(member(group,actor.userId),from),
        to:binding(member(group,recipientId),to), itemRef, item, coins,
        requestStamp, stamp:hash([id,requestStamp,item]),
        debitId:randomUUID(), creditId:randomUUID(), itemId:randomUUID(),
        status:'offered', revision:1, createdAt:date, updatedAt:date,
      };
      await precheck(row);
      try { await collection.insertOne(row); }
      catch (error) {
        if (error.code !== 11000) throw error;
        const previous = await collection.findOne({id});
        if (previous?.requestStamp !== requestStamp) throw fault(409, 'Cette référence de don est déjà utilisée.');
        return {gift:expose(actor,previous)};
      }
      return {gift:expose(actor,row)};
    },

    async history(actor, groupId, offset = 0) {
      await groups.get(actor,groupId);
      return list(actor,{groupId},offset);
    },

    async pending(actor, offset = 0) {
      return list(actor,{status:{$in:acceptedStatuses}},offset);
    },

    async decide(actor, groupId, id, decision, input) {
      const group = await groups.get(actor,groupId);
      const row = await load(actor,id,groupId);
      const allowed = decision === 'cancelled' ? row.from.userId : row.to.userId;
      if (allowed !== actor.userId) throw fault(403, 'Cette décision appartient à l’autre joueur.');
      if (row.status === decision || decision === 'accept' && row.acceptedAt) return {gift:expose(actor,row)};
      if (row.status !== 'offered' || input?.revision !== row.revision) {
        throw fault(409, 'Cette proposition a changé. Actualisez le suivi.');
      }
      if (decision !== 'accept') {
        const fields = {status:decision, revision:row.revision + 1, updatedAt:now()};
        const result = await collection.updateOne({id, revision:row.revision, status:'offered'}, {$set:fields});
        if (!result.matchedCount) throw fault(409, 'Cette proposition a changé. Actualisez le suivi.');
        return {gift:expose(actor,{...row,...fields})};
      }
      assertAttached(group,row.from);
      assertAttached(group,row.to);
      await precheck(row);
      const freshGroup = await groups.get(actor,groupId);
      assertAttached(freshGroup,row.from);
      assertAttached(freshGroup,row.to);
      const accepted = await claim(row,input.revision,'offered');
      await execute(accepted);
      return {gift:expose(actor,accepted)};
    },

    async resume(actor, id, input) {
      const row = await load(actor,id);
      if (row.status === 'done') return {gift:expose(actor,row)};
      if (!row.acceptedAt || !acceptedStatuses.includes(row.status)) throw fault(409, 'Ce don doit d’abord être accepté.');
      const claimed = await claim(row,input?.revision,row.status);
      await execute(claimed);
      return {gift:expose(actor,claimed)};
    },
  };
}
