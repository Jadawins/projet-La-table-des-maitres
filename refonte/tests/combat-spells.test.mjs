import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setup,mj,player,outsider} from './spell-fixture.mjs';
test('Sort mineur à sauvegarde : dés explicites, refus joueur, effets une seule fois après confirmation MJ',async()=>{
  const s=await setup(),before=await s.characters.get(player.userId,s.id),c=await s.prepare('flamme_sacree');assert.equal(s.draws(),0);
  await s.approve(c);assert.deepEqual((await s.characters.get(player.userId,s.id)).character.playState.slotUsed,before.character.playState.slotUsed);
  await assert.rejects(s.combats.spellRoll(player,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[2]}),e=>e.status===403);
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[2],bonus:0,reason:'Profil personnalisé sans sauvegarde'});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[3,4]});
  assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id).currentHp,100);
  await assert.rejects(s.combats.spellConfirm(player,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true}),e=>e.status===403);
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id).currentHp,93);assert.equal(s.draws(),0);
});

test('Soins : emplacement consommé à la validation, soin plafonné, annulation avant validation sans dépense',async()=>{
  const s=await setup(),first=await s.prepare('soins');
  await s.combats.spellEnd(player,s.groupId,{castId:first.id});assert.deepEqual((await s.characters.get(player.userId,s.id)).character.playState.slotUsed,{});
  const c=await s.prepare('soins');await s.approve(c);
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);
  await assert.rejects(s.approve(c),e=>e.status===409);
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'app'});assert.equal(s.draws(),2);
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id).currentHp,100);
});

test('Coupure après écriture du coût : reprise après redémarrage sans deuxième emplacement ni dé relancé',async()=>{
  const s=await setup(),c=await s.prepare('soins'),write=s.characters.applyCombatPatch.bind(s.characters);let first=true;
  s.characters.applyCombatPatch=async(...args)=>{const result=await write(...args);if(first){first=false;throw Error('Accusé perdu');}return result;};
  await assert.rejects(s.approve(c));assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);
  s.restart();await s.combats.spellRetry(mj,s.groupId,{castId:c.id});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);assert.equal(s.draws(),0);
  assert.equal((await s.combats.get(mj,s.groupId)).combat.spellCasts.find(x=>x.id===c.id).stage,'resolving');
});

test('Permissions et données canoniques : ni sort inventé ni accès extérieur ni validation par le joueur',async()=>{
  const s=await setup(),options=await s.combats.spellOptions(player,s.groupId,s.pc.id);
  await assert.rejects(s.combats.spellOptions(outsider,s.groupId,s.pc.id),e=>e.status===404);
  await assert.rejects(s.combats.spellPrepare(player,s.groupId,{combatId:options.combatId,revision:options.revision,casterId:s.pc.id,spellKey:'inventé',targetIds:[s.npc.id]}),e=>e.status===400);
  const c=await s.prepare('soins');await assert.rejects(s.combats.spellApprove(player,s.groupId,{castId:c.id,plan:c.spell.suggestions[1]}),e=>e.status===403);
  assert.equal((await s.characters.get(player.userId,s.id)).revision,1);
});

test('Zone : allié lanceur inclus, sauvegardes distinctes, jet commun et emplacement unique',async()=>{
  const s=await setup({classId:'magicien',spellId:'boule_de_feu'}),c=await s.prepare('boule_de_feu');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,targetIds:[s.npc.id,s.pc.id],plan:{...c.spell.suggestions[3],rounds:0,note:'Zone confirmée par le MJ, lanceur inclus'}});
  await s.combats.spellRoll(player,s.groupId,{castId:c.id,targetId:s.pc.id,mode:'physical',dice:[20]});
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[1],bonus:0,reason:'Profil personnalisé'});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:Array(8).fill(1)});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.pc.id,confirmed:true});
  await assert.rejects(s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'app'}),e=>e.status===409);
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const saved=await s.characters.get(player.userId,s.id);assert.equal(saved.character.playState.hpLost,4);assert.equal(saved.character.playState.slotUsed['spell-3'],1);
  assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id).currentHp,92);assert.equal(s.draws(),0);
});

test('Concentration : un dégât prépare une sauvegarde sans lancer ; un échec retire l’effet de sa source',async()=>{
  const s=await setup(),c=await s.prepare('assistance');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Bonus de compétence suivi à la table',plan:{...c.spell.suggestions[0],rounds:10,note:'Ajouter 1d4 au test de compétence choisi'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const before=await s.characters.get(player.userId,s.id);
  await s.act({type:'health',participantId:s.pc.id,characterRevision:before.revision,action:{type:'damage',amount:5}});
  const current=await s.characters.get(player.userId,s.id),check=current.character.playState.concentration.checks[0];assert.equal(check.dc,10);assert.equal(s.draws(),0);
  const target=()=>s.combats.get(mj,s.groupId).then(v=>v.combat.participants.find(p=>p.id===s.npc.id));assert.equal((await target()).magicEffects.length,1);
  await s.combats.spellConcentration(player,s.groupId,{castId:c.id,checkId:check.id,mode:'physical',dice:[1]});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration,null);assert.equal((await target()).magicEffects.length,0);
  await assert.rejects(s.combats.spellConcentration(player,s.groupId,{castId:c.id,checkId:check.id,mode:'app'}),e=>e.status===409);assert.equal(s.draws(),0);
});

test('État de sort et état manuel ne se confondent pas à la fin de la concentration',async()=>{
  const s=await setup({spellId:'immobilisation_de_personne'}),c=await s.prepare('immobilisation_de_personne');
  await s.act({type:'health',participantId:s.npc.id,action:{type:'set-condition',condition:'paralyzed',active:true}});
  const plan={...c.spell.suggestions[2],kind:'save',effect:'condition',condition:'paralyzed',rounds:10,note:'Humanoïde confirmé ; nouvelle sauvegarde de fin de tour à gérer'};
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'État et sauvegarde vérifiés',plan});
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[1],bonus:0,reason:'Profil personnalisé'});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  await s.combats.spellEnd(player,s.groupId,{castId:c.id,confirmed:true});
  const npc=(await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id);assert(npc.conditions.some(c=>c.id==='paralyzed'));assert.equal(npc.magicEffects.length,0);
});

test('Durée déclarée : expiration au retour du tour d’origine, sans dé et sans soin',async()=>{
  const s=await setup(),c=await s.prepare('assistance');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Durée de contrôle raccourcie explicitement',plan:{...c.spell.suggestions[0],rounds:1,note:'Bonus suivi à la table'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  await s.act({type:'next'});let value=await s.combats.get(mj,s.groupId);assert.equal(value.combat.spellCasts[0].stage,'active');
  await s.act({type:'next'});value=await s.combats.get(mj,s.groupId);assert.equal(value.combat.spellCasts[0].stage,'ended');assert.equal(s.draws(),0);
});

test('Zone persistante : nouveau déclenchement validé, allié touché et aucun second emplacement',async()=>{
  const s=await setup({classId:'magicien',spellId:'nuee_de_daggers'}),c=await s.prepare('nuee_de_daggers');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Déclenchement initial vérifié',plan:{...c.spell.suggestions[2],kind:'direct',effect:'damage',formula:'4d4',rounds:10,note:'Zone placée par le MJ, déplacements et déclenchements vérifiés'}});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1,1,1]});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const input={castId:c.id,eventId:randomUUID(),targetIds:[s.pc.id],reason:'Le lanceur entre dans sa propre zone : déclenchement confirmé'};
  await assert.rejects(s.combats.spellPulse(player,s.groupId,input),e=>e.status===403);
  const child=(await s.combats.spellPulse(mj,s.groupId,input)).cast;
  assert.equal((await s.combats.spellPulse(mj,s.groupId,input)).cast.id,child.id);
  await s.combats.spellDamage(player,s.groupId,{castId:child.id,mode:'physical',dice:[1,1,1,1]});
  await s.combats.spellConfirm(mj,s.groupId,{castId:child.id,targetId:s.pc.id,confirmed:true});
  const saved=await s.characters.get(player.userId,s.id);assert.equal(saved.character.playState.slotUsed['spell-2'],1);assert.equal(saved.character.playState.hpLost,4);assert(saved.character.playState.concentration.checks.length===1);
  await s.combats.spellEnd(player,s.groupId,{castId:c.id,confirmed:true});await assert.rejects(s.combats.spellPulse(mj,s.groupId,{...input,eventId:randomUUID()}),e=>e.status===400);
});

test('Sort de PNJ : profil vérifié par MJ, usage noté, lanceur caché absent des réponses joueur',async()=>{
  const s=await setup();await s.act({type:'visible',participantId:s.npc.id,value:false});
  await assert.rejects(s.combats.spellOptions(player,s.groupId,s.npc.id),e=>e.status===403);
  const options=await s.combats.spellOptions(mj,s.groupId,s.npc.id),spell=options.spells.find(x=>x.id==='flamme_sacree');
  const c=(await s.combats.spellPrepare(mj,s.groupId,{combatId:options.combatId,revision:options.revision,casterId:s.npc.id,spellKey:spell.key,targetIds:[s.pc.id]})).cast;
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Sort et DD du profil de contrôle',dc:14,attackBonus:4,plan:{...spell.suggestions[0],effect:'damage',formula:'1d8',rounds:0,note:'Profil vérifié'}});
  assert.equal((await s.combats.get(player,s.groupId)).combat.spellCasts.length,0);
  await assert.rejects(s.combats.spellRoll(player,s.groupId,{castId:c.id,targetId:s.pc.id,mode:'physical',dice:[1]}),e=>e.status===404);
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.pc.id,mode:'physical',dice:[1]});await s.combats.spellDamage(mj,s.groupId,{castId:c.id,mode:'physical',dice:[4]});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.pc.id,confirmed:true});assert.equal((await s.characters.get(player.userId,s.id)).character.playState.hpLost,4);
});

test('Soin écrit mais accusé perdu : reprise persistante sans deuxième soin ni restitution d’emplacement',async()=>{
  const s=await setup(),saved=await s.characters.get(player.userId,s.id);await s.act({type:'health',participantId:s.pc.id,characterRevision:saved.revision,action:{type:'damage',amount:10}});
  const c=await s.prepare('soins');await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,targetIds:[s.pc.id],plan:{...c.spell.suggestions[1],rounds:0,note:'Soins personnels'}});
  const damage=(await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1]})).cast.damage;
  const write=s.characters.applyCombatPatch.bind(s.characters);let first=true;
  s.characters.applyCombatPatch=async(...args)=>{const result=await write(...args);if(first){first=false;throw Error('Accusé perdu après soin');}return result;};
  await assert.rejects(s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.pc.id,confirmed:true}));
  s.restart();await s.combats.spellRetry(mj,s.groupId,{castId:c.id});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.pc.id,confirmed:true});
  const after=await s.characters.get(player.userId,s.id);assert.equal(after.character.playState.hpLost,10-damage.total);assert.equal(after.character.playState.slotUsed['spell-1'],1);
});

test('Défense modifiée : confirmation bloquée puis revérification des mêmes dés sans nouveau tirage',async()=>{
  const s=await setup(),c=await s.prepare('flamme_sacree');await s.approve(c);
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'app',bonus:0,reason:'Profil personnalisé'});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1]});const count=s.draws();
  await s.act({type:'health',participantId:s.npc.id,action:{type:'set-exhaustion',amount:1}});
  await assert.rejects(s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true}),e=>e.status===409);
  await s.combats.spellRecheck(mj,s.groupId,{castId:c.id,targetId:s.npc.id});assert.equal(s.draws(),count);
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});assert.equal(s.draws(),count);
});

test('Effet conservé entre deux combats : visible, déclenchement sans coût et fin nettoyée sur les deux rencontres',async()=>{
  const s=await setup(),c=await s.prepare('assistance');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Bonus à la table',plan:{...c.spell.suggestions[0],rounds:10,note:'Compétence choisie'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});await s.act({type:'finish',confirmed:true});
  let value=await s.combats.create(mj,s.groupId,{name:'Deuxième rencontre'});const pc=value.combat.participants[0];
  value=await s.combats.act(mj,s.groupId,{combatId:value.combat.id,revision:value.combat.revision,type:'initiative',participantId:pc.id,value:15});
  value=await s.combats.act(mj,s.groupId,{combatId:value.combat.id,revision:value.combat.revision,type:'start'});
  assert(value.combat.spellCasts.some(x=>x.id===c.id&&x.earlierCombat));
  const child=(await s.combats.spellPulse(mj,s.groupId,{castId:c.id,eventId:randomUUID(),targetIds:[pc.id],reason:'Effet maintenu sur un nouveau bénéficiaire, selon arbitrage'})).cast;
  await s.combats.spellConfirm(mj,s.groupId,{castId:child.id,targetId:pc.id,confirmed:true});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.magicEffects.length,1);
  await s.combats.spellEnd(player,s.groupId,{castId:c.id,confirmed:true});
  const saved=await s.characters.get(player.userId,s.id);assert.equal(saved.character.playState.magicEffects.length,0);assert.equal(saved.character.playState.concentration,null);
});

test('Source détachée : nettoyage des cibles restantes sans modification d’une fiche transférée ou étrangère',async()=>{
  const s=await setup(),c=await s.prepare('assistance');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Bonus vérifié',plan:{...c.spell.suggestions[0],rounds:10,note:'Compétence choisie'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});const before=await s.characters.get(player.userId,s.id);
  await s.groups.attach(player,s.groupId,{characterId:null});await s.combats.spellSync(mj,s.groupId);
  assert.deepEqual(await s.characters.get(player.userId,s.id),before);
  const value=await s.combats.get(mj,s.groupId);assert.equal(value.combat.participants.find(p=>p.id===s.npc.id).magicEffects.length,0);
});

test('Projectiles multiples : budget MJ, jet direct commun réutilisé et un emplacement pour trois impacts',async()=>{
  const s=await setup({classId:'magicien',spellId:'projectile_magique'}),c=await s.prepare('projectile_magique');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Trois projectiles de force, jet commun et protections vérifiés',plan:{...c.spell.suggestions[1],kind:'direct',effect:'damage',formula:'1d4+1',impacts:3,sharedImpacts:true,rounds:0,note:'Un projectile par impact'}});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[2]});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  for(let i=0;i<2;i++){
    const child=(await s.combats.spellPulse(mj,s.groupId,{castId:c.id,impact:true,eventId:randomUUID(),targetIds:[s.npc.id],reason:'Projectile suivant'})).cast;
    assert.equal(child.sharedDamageLocked,true);await assert.rejects(s.combats.spellDamage(player,s.groupId,{castId:child.id,mode:'app'}),e=>e.status===400);
    await s.combats.spellConfirm(mj,s.groupId,{castId:child.id,targetId:s.npc.id,confirmed:true});
  }
  await assert.rejects(s.combats.spellPulse(mj,s.groupId,{castId:c.id,impact:true,eventId:randomUUID(),targetIds:[s.npc.id],reason:'Impact en trop'}),e=>e.status===400);
  assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(p=>p.id===s.npc.id).currentHp,91);assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);assert.equal(s.draws(),0);
});

test('Deux confirmations simultanées d’une même cible : aucune deuxième écriture',async()=>{
  const s=await setup(),c=await s.prepare('soins');await s.approve(c);await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1]});
  const results=await Promise.allSettled([s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true}),s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.status,409);
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});assert.equal((await s.characters.get(player.userId,s.id)).character.playState.slotUsed['spell-1'],1);
});

test('Un déclenchement qui neutralise le lanceur termine immédiatement la concentration et ses effets',async()=>{
  const s=await setup({classId:'magicien',spellId:'nuee_de_daggers'}),c=await s.prepare('nuee_de_daggers');
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Zone vérifiée par le MJ',plan:{...c.spell.suggestions[2],kind:'direct',effect:'damage',formula:'4d4',rounds:10,note:'Zone persistante'}});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1,1,1]});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const fresh=await s.characters.get(player.userId,s.id);
  await s.act({type:'health',participantId:s.pc.id,characterRevision:fresh.revision,action:{type:'damage',amount:s.pc.maxHp-1}});
  const child=(await s.combats.spellPulse(mj,s.groupId,{castId:c.id,eventId:randomUUID(),targetIds:[s.pc.id],reason:'Le lanceur entre dans la zone'})).cast;
  await s.combats.spellDamage(player,s.groupId,{castId:child.id,mode:'physical',dice:[1,1,1,1]});
  await s.combats.spellConfirm(mj,s.groupId,{castId:child.id,targetId:s.pc.id,confirmed:true});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration,null);
  assert.equal((await s.combats.get(mj,s.groupId)).combat.spellCasts.find(x=>x.id===c.id).stage,'ended');
});

test('Remplacer une concentration retire uniquement les effets de la précédente',async()=>{
  const s=await setup(),a=await s.prepare('assistance');
  const approve=c=>s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,replaceConcentration:true,reason:'Bonus suivi à la table',plan:{...c.spell.suggestions[0],rounds:10,note:'Bonus de compétence'}});
  await approve(a);await s.combats.spellConfirm(mj,s.groupId,{castId:a.id,targetId:s.npc.id,confirmed:true});
  const b=await s.prepare('assistance');await approve(b);
  let value=await s.combats.get(mj,s.groupId);assert.equal(value.combat.spellCasts.find(x=>x.id===a.id).stage,'ended');assert.equal(value.combat.participants.find(x=>x.id===s.npc.id).magicEffects.length,0);
  await s.combats.spellConfirm(mj,s.groupId,{castId:b.id,targetId:s.npc.id,confirmed:true});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration.id,b.id);
});

test('Dégâts et état combinés, puis restauration : état retiré sans effacer les autres états manuels',async()=>{
  const s=await setup(),c=await s.prepare('flamme_sacree');
  await s.act({type:'health',participantId:s.npc.id,action:{type:'set-condition',condition:'poisoned',active:true}});
  await s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Effet additionnel arbitré pour ce contrôle',plan:{...c.spell.suggestions[0],condition:'blinded',rounds:1,note:'État additionnel'}});
  await s.combats.spellRoll(mj,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[1],bonus:0,reason:'Profil personnalisé'});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,mode:'physical',dice:[1,1]});await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});
  const target=async()=>(await s.combats.get(mj,s.groupId)).combat.participants.find(x=>x.id===s.npc.id);
  assert.equal((await target()).currentHp,98);assert((await target()).conditions.some(x=>x.id==='blinded'));
  const restore=await s.prepare('soins');await s.combats.spellApprove(mj,s.groupId,{castId:restore.id,completed:true,reason:'Restauration testée sans soins supplémentaires',plan:{kind:'direct',effect:'condition',condition:'blinded',conditionOperation:'remove',success:'none',rounds:0,note:'Retire aveuglement'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:restore.id,targetId:s.npc.id,confirmed:true});
  assert(!(await target()).conditions.some(x=>x.id==='blinded'));assert((await target()).conditions.some(x=>x.id==='poisoned'));assert.equal((await target()).currentHp,98);
});

test('Critique arbitré par MJ : motif obligatoire, dés précédents invalidés et aucun tirage automatique',async()=>{
  const s=await setup({spellId:'rayon_tracant'}),c=await s.prepare('rayon_tracant');await s.approve(c);
  await s.combats.spellRoll(player,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[15]});
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:[1,1,1,1]});
  await assert.rejects(s.combats.spellAdjudicate(mj,s.groupId,{castId:c.id,targetId:s.npc.id,decision:'critical'}),e=>e.status===400);
  const updated=await s.combats.spellAdjudicate(mj,s.groupId,{castId:c.id,targetId:s.npc.id,decision:'critical',reason:'Condition et distance vérifiées'});
  assert.equal(updated.cast.targets[0].damage,null);assert.equal(updated.cast.targets[0].dicePlan.length,8);
  await s.combats.spellDamage(player,s.groupId,{castId:c.id,targetId:s.npc.id,mode:'physical',dice:Array(8).fill(1)});
  await s.combats.spellConfirm(mj,s.groupId,{castId:c.id,targetId:s.npc.id,confirmed:true});assert.equal((await s.combats.get(mj,s.groupId)).combat.participants.find(x=>x.id===s.npc.id).currentHp,92);assert.equal(s.draws(),0);
});

test('Un état neutralisant appliqué par un sort arrête aussi la concentration sans dégâts',async()=>{
  const s=await setup(),a=await s.prepare('assistance');
  await s.combats.spellApprove(mj,s.groupId,{castId:a.id,completed:true,reason:'Bonus suivi à la table',plan:{...a.spell.suggestions[0],rounds:10,note:'Bonus de compétence'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:a.id,targetId:s.npc.id,confirmed:true});
  const b=await s.prepare('soins');await s.combats.spellApprove(mj,s.groupId,{castId:b.id,completed:true,targetIds:[s.pc.id],reason:'Condition de contrôle arbitré par MJ',plan:{kind:'direct',effect:'condition',condition:'paralyzed',success:'none',rounds:1,note:'Condition de contrôle'}});
  await s.combats.spellConfirm(mj,s.groupId,{castId:b.id,targetId:s.pc.id,confirmed:true});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration,null);
  assert.equal((await s.combats.get(mj,s.groupId)).combat.spellCasts.find(x=>x.id===a.id).stage,'ended');
});

test('Reprise concurrente : ne remplace jamais une nouvelle concentration sans nouvelle validation',async()=>{
  const s=await setup(),a=await s.prepare('assistance'),write=s.characters.applyCombatPatch.bind(s.characters);let blocked=true;
  s.characters.applyCombatPatch=async(...args)=>{if(blocked){blocked=false;throw Object.assign(Error('Conflit simulé avant écriture'),{status:409});}return write(...args);};
  const approve=c=>s.combats.spellApprove(mj,s.groupId,{castId:c.id,completed:true,reason:'Bonus suivi à la table',plan:{...c.spell.suggestions[0],rounds:10,note:'Bonus de compétence'}});
  await assert.rejects(approve(a),e=>e.status===409);
  const b=await s.prepare('assistance');await approve(b);
  await assert.rejects(s.combats.spellRetry(mj,s.groupId,{castId:a.id}),e=>e.status===409);
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration.id,b.id);
  await s.combats.spellEnd(player,s.groupId,{castId:a.id,confirmed:true});
  assert.equal((await s.characters.get(player.userId,s.id)).character.playState.concentration.id,b.id);
});
