import {CONDITIONS} from './condition-rules.mjs';
import {playView} from './play-state.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(id,name,label,value,min,max)=>`<label for="${id}">${label}</label><input id="${id}" name="${name}" type="number" min="${min}" max="${max}" step="1" value="${value}" required>`;
const lifeNames={alive:'Vivant',dying:'À 0 PV · jets de mort à suivre',stable:'Stabilisé · 0 PV',dead:'Mort déclarée',unknown:'Suivi non commencé'};
export function renderConditionBanner(state,model){
  const view=playView(state,model),e=view.effects;
  if(!view.started||!e.active.length&&!e.exhaustion&&e.life!=='dead')return '';
  return `<aside class="condition-banner" aria-label="États en cours"><strong>${e.life==='dead'?'Mort déclarée · ':''}En partie</strong><span>${e.active.map(c=>esc(c.name)).join(' · ')}${e.exhaustion?` · Épuisement ${e.exhaustion} : −${e.d20Penalty} aux Tests d20`:''}</span><span>Vitesse en partie : ${e.speed===null?'à compléter':esc(e.speed)+' m'}</span><p>Les valeurs de la fiche restent les valeurs de base. Appliquez les effets indiqués aux jets effectués à la table.</p><button type="button" class="button quiet" data-open-play>Voir les effets en partie</button></aside>`;
}
export function renderConditions(state,model,{busy=false}={}){
  const view=playView(state,model),e=view.effects,d=e.death;
  const blocked=busy?'disabled':'';
  const circles=n=>`<span aria-hidden="true">${'●'.repeat(n)}${'○'.repeat(3-n)}</span>`;
  return `<section class="play-conditions" aria-label="États et suivi vital"><h3>États et Épuisement</h3>
    <p>${e.active.length?e.active.map(c=>`<span class="condition-badge">${esc(c.name)}${c.implicit?' · induit':''}</span>`).join(' '):'Aucun état déclaré.'}</p>
    <details class="condition-picker"><summary>Ajouter ou retirer un état</summary><p>Les cases représentent les états déclarés manuellement. Les états liés à un autre état ou à zéro PV apparaissent en plus dans le résumé. Leurs sources, durées et exceptions sont vérifiées à votre table.</p><div class="condition-grid">${CONDITIONS.map(c=>`<label><input type="checkbox" data-play-condition="${c.id}" ${e.explicit.includes(c.id)?'checked':''} ${blocked}> ${esc(c.name)}</label>`).join('')}</div></details>
    ${e.active.length?`<ul class="condition-effects">${e.active.map(c=>`<li><strong>${esc(c.name)}${c.implicit?' (induit)':''}.</strong> ${esc(c.text)}</li>`).join('')}</ul>`:''}
    <form data-play-action="set-exhaustion" class="play-inline"><label for="play-exhaustion">Niveau d’Épuisement</label><select id="play-exhaustion" name="amount">${Array.from({length:7},(_,i)=>`<option value="${i}" ${i===e.exhaustion?'selected':''}>${i}${i===0?' · aucun':i===6?' · mort':''}</option>`).join('')}</select><button class="button secondary" ${blocked}>Appliquer l’Épuisement</button></form>
    <p data-condition-penalty>Malus aux Tests d20 : −${e.d20Penalty}. Vitesse en partie : <strong data-condition-speed>${e.speed===null?'à compléter':esc(e.speed)+' m'}</strong>.</p>
    <p class="hint">La Vitesse tient compte de l’Épuisement et des états qui la fixent à zéro. Les autres effets sont rappelés ici ; les jets, cibles, immunités et aptitudes restent sous votre contrôle.</p>
    <h3>Jets de sauvegarde contre la mort</h3><p class="life-status" data-life-status>${lifeNames[e.life]}</p>
    ${view.currentHp===0?`<div class="death-counters"><p>Réussites : <strong data-death-successes>${d.successes}</strong> / 3 ${circles(d.successes)}</p><p>Échecs : <strong data-death-failures>${d.failures}</strong> / 3 ${circles(d.failures)}</p></div>`:''}
    ${e.life==='stable'?'<p>Les compteurs ont été remis à zéro. Aucun jet de mort tant que vous restez stabilisé ; vous êtes normalement toujours Inconscient à 0 PV.</p>':''}
    ${e.life==='dying'?`<form data-play-action="death-roll" class="play-death-form">${number('play-death-die','die','Résultat naturel de votre d20',10,1,20)}${number('play-death-modifier','modifier','Autres bonus ou malus (hors Épuisement)',0,-100,100)}<p class="hint">Le malus d’Épuisement de −${e.d20Penalty} sera appliqué. Un 1 naturel vaut deux échecs ; un 20 naturel rend 1 PV. Aucun dé n’est lancé ici.</p><button class="button secondary" ${blocked}>Enregistrer le jet de mort</button></form><form data-play-action="stabilize"><button class="button secondary" ${blocked}>Déclarer stabilisé</button></form>`:''}
    ${view.currentHp===0&&e.life!=='dead'?`<label class="condition-exception"><input type="checkbox" data-zero-hp-exception ${state.playState?.zeroHpConscious?'checked':''} ${blocked}> Une aptitude me permet de rester conscient à 0 PV</label><p class="hint">Cette exception n’annule pas automatiquement les jets de mort. Un état Inconscient déclaré manuellement reste à retirer séparément si nécessaire.</p>`:''}
    ${e.life==='dead'?`<p>Les soins ordinaires et les repos ne font pas revenir à la vie. Réduire l’Épuisement ne retire pas, à lui seul, la mort déclarée.</p><form data-play-action="revive" class="play-death-form">${number('play-revive-hp','amount','PV après le retour à la vie',1,1,view.maxHp)}<button class="button secondary" ${busy||e.exhaustion===6?'disabled':''}>Déclarer le retour à la vie</button></form>`:''}
    <details class="life-corrections"><summary>Corrections et cas particuliers</summary><p>Les dégâts massifs, les effets de mort immédiate et les aptitudes de survie sont validés à votre table. La correction des compteurs est une correction de saisie, pas un sort de résurrection.</p>
    ${view.currentHp===0?`<form data-play-action="set-death-counts" class="play-death-form">${number('play-correct-successes','successes','Réussites à déclarer',d.successes,0,3)}${number('play-correct-failures','failures','Échecs à déclarer',d.failures,0,3)}<button class="button secondary" ${blocked}>Corriger le suivi des jets</button></form>`:''}
    ${e.life!=='dead'?`<form data-play-action="declare-dead"><button class="button danger" ${blocked}>Déclarer la mort</button></form>`:''}</details></section>`;
}
