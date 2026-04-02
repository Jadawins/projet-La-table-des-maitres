/* =============================================================
   CAMPAGNE-DETAIL.JS — Éditeur de campagne inline (TipTap)
   ============================================================= */

import { Editor, Node, mergeAttributes } from 'https://esm.sh/@tiptap/core@2';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2';

const API = 'https://myrpgtable.fr/api';

// ─── STATE ───────────────────────────────────────────────────
let token       = null;
let campagne    = null;
let campagneId  = null;
let chapitres   = [];       // [{id, titre, ordre, contenu: TipTapDoc}]
let currentChapId = null;
let editor      = null;
let saveTimer   = null;
let isDirty     = false;
let sessionId   = null;
let sessionJoueurs = [];   // [{user_id, pseudo}]

// Bloc en cours d'édition dans la modale
let activeBlocType   = null;
let activeBlocBid    = null;
let activeBlocGetPos = null;

// Listes temporaires dans les modales
let tempMonstres = [];
let tempItems    = [];

// Recherche monstres
let selectedMonstre      = null;
let _monstresSearchTimer = null;

// ─── COMPÉTENCES ─────────────────────────────────────────────
const COMPETENCES = [
  'Acrobaties','Arcanes','Athlétisme','Discrétion','Dressage',
  'Escamotage','Histoire','Intimidation','Investigation','Médecine',
  'Nature','Perception','Perspicacité','Persuasion','Religion',
  'Représentation','Survie','Tromperie'
];
const COMP_CARAC = {
  'Acrobaties':'DEX','Arcanes':'INT','Athlétisme':'FOR','Discrétion':'DEX',
  'Dressage':'SAG','Escamotage':'DEX','Histoire':'INT','Intimidation':'CHA',
  'Investigation':'INT','Médecine':'SAG','Nature':'INT','Perception':'SAG',
  'Perspicacité':'SAG','Persuasion':'CHA','Religion':'INT','Représentation':'CHA',
  'Survie':'SAG','Tromperie':'CHA'
};

// ─── UTILS ───────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,6); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }; }

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3200);
}

function setSaveIndicator(state) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  const map = {
    saved:  ['✓ Sauvegardé',     'save-indicator saved'],
    saving: ['⏳ Sauvegarde…',   'save-indicator saving'],
    dirty:  ['● Non sauvegardé', 'save-indicator'],
    none:   ['—',                'save-indicator']
  };
  const [text, cls] = map[state] || map.none;
  el.textContent = text;
  el.className = cls;
}

// ─── AUTH ─────────────────────────────────────────────────────
let _authDone = false;
function waitForAuth(cb) {
  if (_authDone) { cb(); return; }
  function fire() {
    if (_authDone) return;
    _authDone = true;
    token = window.SUPABASE_TOKEN;
    cb();
  }
  if (window.SUPABASE_TOKEN) { fire(); return; }
  window.addEventListener('supabase-ready', fire, { once: true });
  let n = 0;
  const t = setInterval(() => {
    if (window.SUPABASE_TOKEN) { clearInterval(t); fire(); }
    if (++n > 150) clearInterval(t);
  }, 100);
}

// ─── CUSTOM TIPTAP NODES ─────────────────────────────────────
// Fabrique de nœud inline atom pour chaque type de bloc
function makeBlocNode(typeName, emoji) {
  return Node.create({
    name: typeName,
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
      return {
        bid:  { default: '' },
        nom:  { default: 'Bloc' },
        data: { default: '{}' }
      };
    },

    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes, {
        'data-type': typeName,
        'data-bid':  HTMLAttributes.bid,
        class: `bloc-inline bloc-${typeName}`
      }), `${emoji} ${HTMLAttributes.nom}`];
    },

    parseHTML() {
      return [{ tag: `span[data-type="${typeName}"]` }];
    },

    addNodeView() {
      return ({ node, getPos }) => {
        // Référence mutable pour que le click handler ait toujours les attrs à jour
        let currentNode = node;

        const dom = document.createElement('span');
        dom.className = `bloc-inline bloc-${typeName}`;
        dom.dataset.type = typeName;
        dom.dataset.bid  = node.attrs.bid;
        dom.textContent  = `${emoji} ${node.attrs.nom}`;

        dom.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const data = JSON.parse(currentNode.attrs.data || '{}');
          ouvrirModal(typeName, data, currentNode.attrs.bid, getPos);
        });

        return {
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== typeName) return false;
            currentNode      = updatedNode;
            dom.dataset.bid  = updatedNode.attrs.bid;
            dom.textContent  = `${emoji} ${updatedNode.attrs.nom}`;
            return true;
          }
        };
      };
    }
  });
}

const RencontreNode  = makeBlocNode('rencontre',  '⚔️');
const JetNode        = makeBlocNode('jet',        '🎲');
const LootNode       = makeBlocNode('loot',       '💰');
const PnjNode        = makeBlocNode('pnj',        '👤');
const LieuNode       = makeBlocNode('lieu',       '📍');
const ImageBlocNode  = makeBlocNode('imagebloc',  '🖼️');

// ─── INIT ÉDITEUR ─────────────────────────────────────────────
function initEditor() {
  if (editor) { editor.destroy(); editor = null; }

  const el = document.getElementById('tiptap-editor');
  el.style.display = 'block';
  document.getElementById('editor-placeholder').style.display = 'none';

  editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      RencontreNode,
      JetNode,
      LootNode,
      PnjNode,
      LieuNode,
      ImageBlocNode
    ],
    content: '',
    onUpdate() {
      isDirty = true;
      setSaveIndicator('dirty');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => autoSave(), 30000);
    },
    onSelectionUpdate() {
      updateToolbarState();
    }
  });

  setupToolbarEvents();
}

function setupToolbarEvents() {
  // Boutons formatage
  document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editor) return;
      const cmd = btn.dataset.cmd;
      if (cmd === 'bold')   editor.chain().focus().toggleBold().run();
      if (cmd === 'italic') editor.chain().focus().toggleItalic().run();
      if (cmd === 'h2')     editor.chain().focus().toggleHeading({ level: 2 }).run();
      if (cmd === 'h3')     editor.chain().focus().toggleHeading({ level: 3 }).run();
      if (cmd === 'bullet') editor.chain().focus().toggleBulletList().run();
      updateToolbarState();
    });
  });

  // Boutons blocs
  document.querySelectorAll('.tb-btn[data-bloc]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editor) return;
      nouvelleInsertionBloc(btn.dataset.bloc);
    });
  });
}

function updateToolbarState() {
  if (!editor) return;
  document.querySelector('[data-cmd="bold"]')  ?.classList.toggle('active', editor.isActive('bold'));
  document.querySelector('[data-cmd="italic"]')?.classList.toggle('active', editor.isActive('italic'));
  document.querySelector('[data-cmd="h2"]')    ?.classList.toggle('active', editor.isActive('heading', { level: 2 }));
  document.querySelector('[data-cmd="h3"]')    ?.classList.toggle('active', editor.isActive('heading', { level: 3 }));
  document.querySelector('[data-cmd="bullet"]')?.classList.toggle('active', editor.isActive('bulletList'));
}

// ─── NAVIGATION CHAPITRES ─────────────────────────────────────
function renderNav() {
  const body = document.getElementById('nav-body');
  if (!chapitres.length) {
    body.innerHTML = `<div style="padding:1rem;color:#444;font-size:0.78rem;text-align:center;">
      Aucun chapitre.<br>Cliquez sur + pour commencer.
    </div>`;
    return;
  }

  const sorted = [...chapitres].sort((a, b) => a.ordre - b.ordre);
  body.innerHTML = sorted.map(ch => `
    <div class="nav-chapitre ${ch.id === currentChapId ? 'active' : ''}"
         data-id="${ch.id}" draggable="true">
      <span class="drag-handle" title="Glisser pour réordonner">⠿</span>
      <span class="nav-chapitre-titre">${escHtml(ch.titre)}</span>
    </div>
  `).join('');

  body.querySelectorAll('.nav-chapitre').forEach(item => {
    item.addEventListener('click', () => selectionnerChapitre(item.dataset.id));

    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('chapId', item.dataset.id);
      item.style.opacity = '0.45';
    });
    item.addEventListener('dragend', () => { item.style.opacity = '1'; });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('chapId');
      if (draggedId && draggedId !== item.dataset.id) {
        reordonnerChapitres(draggedId, item.dataset.id);
      }
    });
  });
}

function reordonnerChapitres(draggedId, targetId) {
  const dragged = chapitres.find(c => c.id === draggedId);
  const target  = chapitres.find(c => c.id === targetId);
  if (!dragged || !target) return;
  const tmp = dragged.ordre;
  dragged.ordre = target.ordre;
  target.ordre  = tmp;
  // Ré-attribuer des ordres uniques
  [...chapitres].sort((a, b) => a.ordre - b.ordre).forEach((c, i) => { c.ordre = i; });
  renderNav();
  markDirty();
}

function selectionnerChapitre(id) {
  if (currentChapId === id) return;
  // Flush le contenu de l'éditeur dans le chapitre courant
  if (currentChapId && editor) {
    const ch = chapitres.find(c => c.id === currentChapId);
    if (ch) ch.contenu = editor.getJSON();
  }
  currentChapId = id;
  const ch = chapitres.find(c => c.id === id);
  if (!ch) return;

  if (!editor) initEditor();
  editor.commands.setContent(ch.contenu || { type: 'doc', content: [{ type: 'paragraph' }] });
  updateToolbarState();
  renderNav();
}

async function ajouterChapitre() {
  const titre = prompt('Titre du nouveau chapitre :');
  if (!titre || !titre.trim()) return;
  const id    = `chap_${uid()}`;
  const ordre = chapitres.length;
  chapitres.push({
    id, titre: titre.trim(), ordre,
    contenu: { type: 'doc', content: [{ type: 'paragraph' }] }
  });
  renderNav();
  selectionnerChapitre(id);
  markDirty();
  await autoSave();
}

// ─── INSERTION DE BLOCS ───────────────────────────────────────
const DEFAULTS = {
  rencontre: { type:'rencontre', nom:'Nouvelle rencontre', description:'', difficulte:'moyen', monstres:[] },
  jet:       { type:'jet', nom:'Jet', competence:'Perception', caracteristique:'SAG', dd:15, contexte:'', succes:'', echec:'' },
  loot:      { type:'loot', nom:'Nouveau loot', items:[] },
  pnj:       { type:'pnj', nom:'Nouveau PNJ', description_publique:'', notes_mj:'', attitude:'indifferent' },
  lieu:      { type:'lieu', nom:'Nouveau lieu', description_publique:'', notes_mj:'' },
  imagebloc: { type:'imagebloc', nom:'Image', url:'' }
};

function nouvelleInsertionBloc(type) {
  const data = JSON.parse(JSON.stringify(DEFAULTS[type] || { type, nom: 'Bloc' }));
  ouvrirModal(type, data, null, null);
}

function insererBlocDansEditeur(type, data) {
  if (!editor) return;
  const bid = uid();
  editor.chain().focus().insertContent({
    type,
    attrs: { bid, nom: data.nom || 'Bloc', data: JSON.stringify(data) }
  }).run();
  markDirty();
}

function mettreAJourBloc(type, bid, getPos, data) {
  if (!editor) return;
  const state = editor.view.state;
  let done = false;

  state.doc.descendants((node, pos) => {
    if (done) return false;
    if (node.type.name === type && node.attrs.bid === bid) {
      const tr = state.tr.setNodeMarkup(pos, null, {
        bid,
        nom:  data.nom || 'Bloc',
        data: JSON.stringify(data)
      });
      editor.view.dispatch(tr);
      done = true;
      return false;
    }
  });

  // Fallback via getPos si la recherche par bid a échoué
  if (!done && typeof getPos === 'function') {
    try {
      const pos = getPos();
      const node = state.doc.nodeAt(pos);
      if (node) {
        const tr = state.tr.setNodeMarkup(pos, null, {
          bid,
          nom:  data.nom || 'Bloc',
          data: JSON.stringify(data)
        });
        editor.view.dispatch(tr);
      }
    } catch (e) { /* ignore */ }
  }
  markDirty();
}

function supprimerBloc(type, bid, getPos) {
  if (!editor) return;
  const state = editor.view.state;
  let done = false;

  state.doc.descendants((node, pos) => {
    if (done) return false;
    if (node.type.name === type && node.attrs.bid === bid) {
      const tr = state.tr.delete(pos, pos + node.nodeSize);
      editor.view.dispatch(tr);
      done = true;
      return false;
    }
  });
  markDirty();
}

// ─── MODALES ──────────────────────────────────────────────────
function ouvrirModal(type, data, bid, getPos) {
  activeBlocType   = type;
  activeBlocBid    = bid;
  activeBlocGetPos = getPos;

  const isNew     = !bid;
  const isSession = !!sessionId;

  function banner(id)  { const el = document.getElementById(id); if (el) el.style.display = isSession ? 'block' : 'none'; }
  function sBtn(id)    { const el = document.getElementById(id); if (el) el.style.display = isSession ? '' : 'none'; }
  function suppBtn(id) { const el = document.getElementById(id); if (el) el.style.display = isNew ? 'none' : ''; }

  if (type === 'rencontre') {
    banner('session-banner-rencontre');
    sBtn('renc-lancer');
    suppBtn('renc-supprimer');
    document.getElementById('renc-nom').value  = data.nom        || '';
    document.getElementById('renc-diff').value = data.difficulte || 'moyen';
    document.getElementById('renc-desc').value = data.description || '';
    tempMonstres = JSON.parse(JSON.stringify(data.monstres || []));
    resetMonstresSearch();
    renderMonstresList();
    show('modal-rencontre');

  } else if (type === 'jet') {
    banner('session-banner-jet');
    sBtn('jet-envoyer');
    suppBtn('jet-supprimer');
    document.getElementById('jet-comp').value     = data.competence     || 'Perception';
    document.getElementById('jet-carac').value    = data.caracteristique || 'SAG';
    document.getElementById('jet-dd').value       = data.dd              || 15;
    document.getElementById('jet-contexte').value = data.contexte        || '';
    document.getElementById('jet-succes').value   = data.succes          || '';
    document.getElementById('jet-echec').value    = data.echec           || '';
    show('modal-jet');

  } else if (type === 'loot') {
    banner('session-banner-loot');
    sBtn('loot-distribuer');
    suppBtn('loot-supprimer');
    document.getElementById('loot-nom').value = data.nom || '';
    tempItems = JSON.parse(JSON.stringify(data.items || []));
    renderItemsList();
    show('modal-loot');

  } else if (type === 'pnj') {
    suppBtn('pnj-supprimer');
    document.getElementById('pnj-nom').value      = data.nom                 || '';
    document.getElementById('pnj-desc').value     = data.description_publique || '';
    document.getElementById('pnj-notes').value    = data.notes_mj            || '';
    document.getElementById('pnj-attitude').value = data.attitude             || 'indifferent';
    show('modal-pnj');

  } else if (type === 'lieu') {
    banner('session-banner-lieu');
    sBtn('lieu-partager');
    suppBtn('lieu-supprimer');
    document.getElementById('lieu-nom').value   = data.nom                 || '';
    document.getElementById('lieu-desc').value  = data.description_publique || '';
    document.getElementById('lieu-notes').value = data.notes_mj            || '';
    show('modal-lieu');

  } else if (type === 'imagebloc') {
    banner('session-banner-imagebloc');
    sBtn('img-montrer');
    suppBtn('img-supprimer');
    document.getElementById('img-nom').value = data.nom || '';
    document.getElementById('img-url').value = data.url || '';
    updateImagePreview();
    show('modal-imagebloc');
  }
}

function show(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id)  { document.getElementById(id)?.classList.add('hidden'); }

function fermerModal(type) {
  hide(`modal-${type}`);
  activeBlocType   = null;
  activeBlocBid    = null;
  activeBlocGetPos = null;
}

function sauvegarderBloc(type) {
  let data = {};

  if (type === 'rencontre') {
    data = {
      type: 'rencontre',
      nom:        (document.getElementById('renc-nom').value.trim()  || 'Rencontre'),
      description: document.getElementById('renc-desc').value.trim(),
      difficulte:  document.getElementById('renc-diff').value,
      monstres:    [...tempMonstres]
    };

  } else if (type === 'jet') {
    const comp = document.getElementById('jet-comp').value;
    const dd   = parseInt(document.getElementById('jet-dd').value) || 15;
    data = {
      type: 'jet',
      nom:           `${comp} DD ${dd}`,
      competence:    comp,
      caracteristique: document.getElementById('jet-carac').value,
      dd,
      contexte: document.getElementById('jet-contexte').value.trim(),
      succes:   document.getElementById('jet-succes').value.trim(),
      echec:    document.getElementById('jet-echec').value.trim()
    };

  } else if (type === 'loot') {
    data = {
      type:  'loot',
      nom:   (document.getElementById('loot-nom').value.trim() || 'Loot'),
      items: [...tempItems]
    };

  } else if (type === 'pnj') {
    data = {
      type:                'pnj',
      nom:                 (document.getElementById('pnj-nom').value.trim()  || 'PNJ'),
      description_publique: document.getElementById('pnj-desc').value.trim(),
      notes_mj:             document.getElementById('pnj-notes').value.trim(),
      attitude:             document.getElementById('pnj-attitude').value
    };

  } else if (type === 'lieu') {
    data = {
      type:                'lieu',
      nom:                 (document.getElementById('lieu-nom').value.trim()  || 'Lieu'),
      description_publique: document.getElementById('lieu-desc').value.trim(),
      notes_mj:             document.getElementById('lieu-notes').value.trim()
    };

  } else if (type === 'imagebloc') {
    data = {
      type: 'imagebloc',
      nom:  (document.getElementById('img-nom').value.trim() || 'Image'),
      url:   document.getElementById('img-url').value.trim()
    };
  }

  if (activeBlocBid) {
    mettreAJourBloc(type, activeBlocBid, activeBlocGetPos, data);
  } else {
    insererBlocDansEditeur(type, data);
  }
  fermerModal(type);
}

function supprimerBlocActif(type) {
  supprimerBloc(type, activeBlocBid, activeBlocGetPos);
  fermerModal(type);
}

// ─── LISTE MONSTRES ───────────────────────────────────────────
function renderMonstresList() {
  const list = document.getElementById('renc-monstres-list');
  if (!tempMonstres.length) {
    list.innerHTML = '<div class="items-list-empty">Aucun monstre — ajoutez-en ci-dessous</div>';
    return;
  }
  list.innerHTML = tempMonstres.map((m, i) => `
    <div class="item-row">
      <span class="item-row-label">${escHtml(m.nom)}</span>
      <span class="item-row-badge">×${m.quantite}</span>
      ${m.fp != null ? `<span class="item-row-badge">FP ${escHtml(String(m.fp))}</span>` : ''}
      <span class="item-row-badge">PV ${m.pv}</span>
      <span class="item-row-badge">CA ${m.ca}</span>
      <button class="item-remove-btn" data-i="${i}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.item-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tempMonstres.splice(parseInt(btn.dataset.i), 1);
      renderMonstresList();
    });
  });
}

function ajouterMonstre() {
  if (!selectedMonstre) { showToast('Sélectionnez un monstre dans les résultats', 'error'); return; }
  tempMonstres.push({
    nom:      selectedMonstre.nom || selectedMonstre.nom_original,
    slug:     selectedMonstre.slug || null,
    fp:       selectedMonstre.fp   ?? null,
    type:     selectedMonstre.type || null,
    quantite: parseInt(document.getElementById('renc-m-qte').value) || 1,
    pv:       parseInt(document.getElementById('renc-m-pv').value)  || 10,
    ca:       parseInt(document.getElementById('renc-m-ca').value)  || 12
  });
  resetMonstresSearch();
  renderMonstresList();
}

// ─── RECHERCHE MONSTRES DB ────────────────────────────────────
function resetMonstresSearch() {
  selectedMonstre = null;
  const _g = id => document.getElementById(id);
  if (_g('renc-m-search'))   _g('renc-m-search').value   = '';
  if (_g('renc-m-type'))     _g('renc-m-type').value     = '';
  if (_g('renc-m-taille'))   _g('renc-m-taille').value   = '';
  if (_g('renc-m-fp-min'))   _g('renc-m-fp-min').value   = '';
  if (_g('renc-m-fp-max'))   _g('renc-m-fp-max').value   = '';
  if (_g('renc-m-qte'))      _g('renc-m-qte').value      = 1;
  if (_g('renc-m-pv'))       _g('renc-m-pv').value       = 10;
  if (_g('renc-m-ca'))       _g('renc-m-ca').value       = 12;
  if (_g('renc-m-selected-nom'))    _g('renc-m-selected-nom').textContent = 'Sélectionnez un monstre';
  if (_g('renc-m-selected-badges')) _g('renc-m-selected-badges').innerHTML = '';
  if (_g('renc-m-selected-card'))   _g('renc-m-selected-card').classList.remove('active');
  const results = _g('renc-m-results');
  if (results) { results.innerHTML = ''; results.classList.remove('visible'); }
}

function initMonstresSearch() {
  const ids = ['renc-m-search','renc-m-type','renc-m-taille','renc-m-fp-min','renc-m-fp-max'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', triggerMonstresSearch);
    if (el && el.tagName === 'SELECT') el.addEventListener('change', triggerMonstresSearch);
  });
}

function triggerMonstresSearch() {
  clearTimeout(_monstresSearchTimer);
  _monstresSearchTimer = setTimeout(doSearchMonstres, 280);
}

async function doSearchMonstres() {
  const q      = document.getElementById('renc-m-search').value.trim();
  const type   = document.getElementById('renc-m-type').value;
  const taille = document.getElementById('renc-m-taille').value;
  const fpMin  = document.getElementById('renc-m-fp-min').value;
  const fpMax  = document.getElementById('renc-m-fp-max').value;
  const results = document.getElementById('renc-m-results');

  if (!q && !type && !taille && fpMin === '' && fpMax === '') {
    results.innerHTML = '';
    results.classList.remove('visible');
    return;
  }

  results.innerHTML = '<div class="monstre-loading">Recherche…</div>';
  results.classList.add('visible');

  const params = new URLSearchParams();
  if (q)      params.set('recherche', q);
  if (type)   params.set('type', type);
  if (taille) params.set('taille', taille);
  if (fpMin !== '') params.set('fp_min', fpMin);
  if (fpMax !== '') params.set('fp_max', fpMax);

  try {
    const res  = await fetch(`${API}/GetMonstres?${params}`);
    const list = await res.json();
    renderMonstresResults(Array.isArray(list) ? list.slice(0, 12) : []);
  } catch {
    results.innerHTML = '<div class="monstre-loading">Erreur de chargement</div>';
  }
}

function renderMonstresResults(list) {
  const results = document.getElementById('renc-m-results');
  if (!list.length) {
    results.innerHTML = '<div class="monstre-loading">Aucun résultat</div>';
    return;
  }
  results.innerHTML = list.map(m => `
    <div class="monstre-result-item" data-slug="${escHtml(m.slug || '')}">
      <span class="monstre-result-nom">${escHtml(m.nom || m.nom_original || '')}</span>
      <span class="monstre-result-badges">
        <span class="item-row-badge">FP ${escHtml(String(m.fp ?? '?'))}</span>
        <span class="item-row-badge">${escHtml(m.type || '')}</span>
        <span class="item-row-badge">${escHtml(m.taille || '')}</span>
      </span>
    </div>
  `).join('');
  results.querySelectorAll('.monstre-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const m = list.find(x => (x.slug || '') === el.dataset.slug);
      if (m) selectMonstrefromDB(m);
    });
  });
}

function selectMonstrefromDB(m) {
  selectedMonstre = m;
  document.getElementById('renc-m-selected-nom').textContent = m.nom || m.nom_original || '';
  document.getElementById('renc-m-selected-badges').innerHTML = `
    <span class="item-row-badge">FP ${escHtml(String(m.fp ?? '?'))}</span>
    <span class="item-row-badge">${escHtml(m.type || '')}</span>
    <span class="item-row-badge">${escHtml(m.taille || '')}</span>
  `;
  document.getElementById('renc-m-selected-card').classList.add('active');
  if (m.pv) document.getElementById('renc-m-pv').value = m.pv;
  if (m.ca) document.getElementById('renc-m-ca').value = m.ca;
  document.getElementById('renc-m-qte').value = 1;
  const results = document.getElementById('renc-m-results');
  results.classList.remove('visible');
  document.getElementById('renc-m-search').value = '';
}

// ─── LISTE ITEMS LOOT ─────────────────────────────────────────
function renderItemsList() {
  const list = document.getElementById('loot-items-list');
  if (!tempItems.length) {
    list.innerHTML = '<div class="items-list-empty">Aucun item</div>';
    return;
  }
  list.innerHTML = tempItems.map((item, i) => `
    <div class="item-row">
      <span class="item-row-label">${escHtml(item.nom)}</span>
      <span class="item-row-badge">×${item.quantite}</span>
      <span class="item-row-badge">${escHtml(item.type)}</span>
      <button class="item-remove-btn" data-i="${i}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.item-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tempItems.splice(parseInt(btn.dataset.i), 1);
      renderItemsList();
    });
  });
}

function ajouterItem() {
  const nom = document.getElementById('loot-i-nom').value.trim();
  if (!nom) return;
  tempItems.push({
    nom,
    quantite: parseInt(document.getElementById('loot-i-qte').value) || 1,
    type:     document.getElementById('loot-i-type').value
  });
  document.getElementById('loot-i-nom').value = '';
  renderItemsList();
}

// ─── IMAGE PREVIEW ────────────────────────────────────────────
function updateImagePreview() {
  const url     = document.getElementById('img-url').value.trim();
  const preview = document.getElementById('img-preview');
  if (url) {
    preview.src = url;
    preview.classList.add('loaded');
  } else {
    preview.src = '';
    preview.classList.remove('loaded');
  }
}

// ─── ACTIONS SESSION ──────────────────────────────────────────
async function lancerCombat() {
  const nom      = document.getElementById('renc-nom').value.trim() || 'Rencontre';
  const monstres = [...tempMonstres];
  fermerModal('rencontre');
  const params = new URLSearchParams({
    session_id: sessionId,
    monstres:   JSON.stringify(monstres)
  });
  window.location.href = `ecran-mj.html?${params}`;
}

async function envoyerJetAuxJoueurs() {
  if (!sessionJoueurs.length) { showToast('Aucun joueur dans la session', 'error'); return; }
  const comp    = document.getElementById('jet-comp').value;
  const dd      = document.getElementById('jet-dd').value;
  const contexte = document.getElementById('jet-contexte').value.trim();
  const titre   = `🎲 Jet de ${comp} DD ${dd}`;
  const message = contexte || `Le MJ vous demande un jet de ${comp}.`;
  try {
    await Promise.all(sessionJoueurs.map(j =>
      fetch(`${API}/Notifications`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ user_id: j.user_id, session_id: sessionId, type: 'jet', titre, message })
      })
    ));
    showToast(`Jet envoyé à ${sessionJoueurs.length} joueur(s) !`);
    fermerModal('jet');
  } catch {
    showToast('Erreur lors de l\'envoi', 'error');
  }
}

async function partagerLieu() {
  if (!sessionJoueurs.length) { showToast('Aucun joueur dans la session', 'error'); return; }
  const nom  = document.getElementById('lieu-nom').value.trim();
  const desc = document.getElementById('lieu-desc').value.trim();
  try {
    await Promise.all(sessionJoueurs.map(j =>
      fetch(`${API}/Notifications`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ user_id: j.user_id, session_id: sessionId, type: 'lieu', titre: `📍 ${nom}`, message: desc })
      })
    ));
    showToast(`Lieu partagé avec ${sessionJoueurs.length} joueur(s) !`);
    fermerModal('lieu');
  } catch {
    showToast('Erreur lors du partage', 'error');
  }
}

async function montrerImage() {
  if (!sessionJoueurs.length) { showToast('Aucun joueur dans la session', 'error'); return; }
  const nom = document.getElementById('img-nom').value.trim();
  const url = document.getElementById('img-url').value.trim();
  if (!url) { showToast('URL manquante', 'error'); return; }
  try {
    await Promise.all(sessionJoueurs.map(j =>
      fetch(`${API}/Notifications`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ user_id: j.user_id, session_id: sessionId, type: 'image', titre: `🖼️ ${nom}`, message: url })
      })
    ));
    showToast(`Image montrée à ${sessionJoueurs.length} joueur(s) !`);
    fermerModal('imagebloc');
  } catch {
    showToast('Erreur lors de l\'envoi', 'error');
  }
}

// ─── AUTO-SAVE ────────────────────────────────────────────────
function markDirty() {
  isDirty = true;
  setSaveIndicator('dirty');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => autoSave(), 30000);
}

async function autoSave() {
  if (!isDirty || !campagneId) return;
  // Flush éditeur → chapitre courant
  if (currentChapId && editor) {
    const ch = chapitres.find(c => c.id === currentChapId);
    if (ch) ch.contenu = editor.getJSON();
  }
  setSaveIndicator('saving');
  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}`, {
      method:  'PUT',
      headers: authHeaders(),
      body:    JSON.stringify({ chapitres })
    });
    if (!res.ok) throw new Error();
    isDirty = false;
    setSaveIndicator('saved');
  } catch {
    setSaveIndicator('dirty');
    showToast('Erreur de sauvegarde', 'error');
  }
}

async function sauvegarderMeta() {
  const statut = document.getElementById('statut-select').value;
  try {
    await fetch(`${API}/Campagnes/${campagneId}`, {
      method:  'PUT',
      headers: authHeaders(),
      body:    JSON.stringify({ statut })
    });
    showToast('Statut mis à jour');
  } catch { /* silencieux */ }
}

// ─── CHARGEMENT SESSION ───────────────────────────────────────
async function chargerSession(sid) {
  try {
    const res = await fetch(`${API}/Sessions/${sid}`, { headers: authHeaders() });
    if (!res.ok) return;
    const session = await res.json();
    sessionJoueurs = (session.joueurs || []).filter(j => j.user_id);
  } catch { /* silencieux */ }
}

// ─── INIT ────────────────────────────────────────────────────
async function init() {
  const params  = new URLSearchParams(location.search);
  campagneId    = params.get('id');
  sessionId     = params.get('session_id') || null;

  if (!campagneId) { location.href = 'campagne.html'; return; }

  try {
    const res = await fetch(`${API}/Campagnes/${campagneId}`, { headers: authHeaders() });
    if (!res.ok) { location.href = 'campagne.html'; return; }
    campagne = await res.json();
  } catch { location.href = 'campagne.html'; return; }

  // Métadonnées
  document.getElementById('topbar-nom').textContent = campagne.nom;
  document.title = `${campagne.nom} — La Table du Maître`;
  document.getElementById('statut-select').value = campagne.statut || 'preparation';

  // Migration : ancien format blocs → nouveau format chapitres
  if (campagne.chapitres && campagne.chapitres.length) {
    chapitres = campagne.chapitres;
  } else if (campagne.blocs && campagne.blocs.length) {
    chapitres = [{
      id:     `chap_${uid()}`,
      titre:  'Chapitre 1',
      ordre:  0,
      contenu: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: '(Contenu migré — ancien format Quill)' }
        ]}]
      }
    }];
  } else {
    chapitres = [];
  }

  // Session
  if (sessionId) {
    await chargerSession(sessionId);
    const nom = document.getElementById('topbar-nom');
    nom.textContent += ' 🎮';
  }

  // Peupler la liste des compétences
  const compSel = document.getElementById('jet-comp');
  compSel.innerHTML = COMPETENCES.map(c => `<option value="${c}">${c}</option>`).join('');
  compSel.addEventListener('change', () => {
    document.getElementById('jet-carac').value = COMP_CARAC[compSel.value] || 'SAG';
  });

  // ─── Événements boutons modales ──────────────────────────────

  // Rencontre
  document.getElementById('close-rencontre')   .addEventListener('click', () => fermerModal('rencontre'));
  document.getElementById('renc-annuler')       .addEventListener('click', () => fermerModal('rencontre'));
  document.getElementById('renc-sauvegarder')   .addEventListener('click', () => sauvegarderBloc('rencontre'));
  document.getElementById('renc-supprimer')     .addEventListener('click', () => supprimerBlocActif('rencontre'));
  document.getElementById('renc-add-monstre')   .addEventListener('click', ajouterMonstre);
  document.getElementById('renc-lancer')        .addEventListener('click', lancerCombat);
  initMonstresSearch();

  // Jet
  document.getElementById('close-jet')         .addEventListener('click', () => fermerModal('jet'));
  document.getElementById('jet-annuler')        .addEventListener('click', () => fermerModal('jet'));
  document.getElementById('jet-sauvegarder')    .addEventListener('click', () => sauvegarderBloc('jet'));
  document.getElementById('jet-supprimer')      .addEventListener('click', () => supprimerBlocActif('jet'));
  document.getElementById('jet-envoyer')        .addEventListener('click', envoyerJetAuxJoueurs);

  // Loot
  document.getElementById('close-loot')        .addEventListener('click', () => fermerModal('loot'));
  document.getElementById('loot-annuler')       .addEventListener('click', () => fermerModal('loot'));
  document.getElementById('loot-sauvegarder')   .addEventListener('click', () => sauvegarderBloc('loot'));
  document.getElementById('loot-supprimer')     .addEventListener('click', () => supprimerBlocActif('loot'));
  document.getElementById('loot-add-item')      .addEventListener('click', ajouterItem);
  document.getElementById('loot-i-nom')         .addEventListener('keydown', e => { if (e.key === 'Enter') ajouterItem(); });
  document.getElementById('loot-distribuer')    .addEventListener('click', () => showToast('Distribution — bientôt disponible…'));

  // PNJ
  document.getElementById('close-pnj')         .addEventListener('click', () => fermerModal('pnj'));
  document.getElementById('pnj-annuler')        .addEventListener('click', () => fermerModal('pnj'));
  document.getElementById('pnj-sauvegarder')    .addEventListener('click', () => sauvegarderBloc('pnj'));
  document.getElementById('pnj-supprimer')      .addEventListener('click', () => supprimerBlocActif('pnj'));

  // Lieu
  document.getElementById('close-lieu')        .addEventListener('click', () => fermerModal('lieu'));
  document.getElementById('lieu-annuler')       .addEventListener('click', () => fermerModal('lieu'));
  document.getElementById('lieu-sauvegarder')   .addEventListener('click', () => sauvegarderBloc('lieu'));
  document.getElementById('lieu-supprimer')     .addEventListener('click', () => supprimerBlocActif('lieu'));
  document.getElementById('lieu-partager')      .addEventListener('click', partagerLieu);

  // Image
  document.getElementById('close-imagebloc')   .addEventListener('click', () => fermerModal('imagebloc'));
  document.getElementById('img-annuler')        .addEventListener('click', () => fermerModal('imagebloc'));
  document.getElementById('img-sauvegarder')    .addEventListener('click', () => sauvegarderBloc('imagebloc'));
  document.getElementById('img-supprimer')      .addEventListener('click', () => supprimerBlocActif('imagebloc'));
  document.getElementById('img-montrer')        .addEventListener('click', montrerImage);
  document.getElementById('img-url')            .addEventListener('input',  updateImagePreview);

  // Fermer modal en cliquant sur l'overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        const type = overlay.id.replace('modal-', '');
        fermerModal(type);
      }
    });
  });

  // Escape pour fermer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeBlocType) fermerModal(activeBlocType);
  });

  // Statut
  document.getElementById('statut-select').addEventListener('change', sauvegarderMeta);

  // Ajouter chapitre
  document.getElementById('btn-add-chapitre').addEventListener('click', ajouterChapitre);

  // Auto-save toutes les 30s
  setInterval(() => { if (isDirty) autoSave(); }, 30000);

  // ─── Rendu initial ───────────────────────────────────────────
  renderNav();
  setSaveIndicator('none');

  // Sélection automatique du premier chapitre
  if (chapitres.length) {
    const first = [...chapitres].sort((a, b) => a.ordre - b.ordre)[0];
    selectionnerChapitre(first.id);
  }
}

// ─── DÉMARRAGE ────────────────────────────────────────────────
waitForAuth(init);
