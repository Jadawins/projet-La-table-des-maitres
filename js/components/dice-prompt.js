/* ================================================================
   DicePrompt — composant vanilla JS
   Usage :
     const dp = new DicePrompt({ formula: '1d20+4', label: 'Jet de Perception' });
     dp.open().then(result => console.log(result)); // { roll, bonus, total, crit, fumble }
   ================================================================ */

export class DicePrompt {
  constructor({ formula = '1d20', label = 'Jet', onResult = null } = {}) {
    this.formula   = formula;
    this.label     = label;
    this.onResult  = onResult;
    this._mode     = localStorage.getItem('dicePrompt.mode') || 'virtual';
    this._resolve  = null;
    this._el       = null;
    this._built    = false;
  }

  // ─── API publique ────────────────────────────────────────

  open() {
    return new Promise(resolve => {
      this._resolve = resolve;
      if (!this._built) this._build();
      this._reset();
      this._el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => this._el.querySelector('.dice-prompt__die, .dice-prompt__input')?.focus());
    });
  }

  close() {
    if (this._el) this._el.classList.add('hidden');
    document.body.style.overflow = '';
  }

  setFormula(formula, label) {
    this.formula = formula;
    if (label) this.label = label;
    if (this._built) {
      this._el.querySelector('.dice-prompt__formula').textContent = formula;
      this._el.querySelector('.dice-prompt__header h2').textContent = label || this.label;
    }
  }

  destroy() {
    if (this._el) { this._el.remove(); this._el = null; this._built = false; }
  }

  // ─── Construction DOM ─────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.className = 'dice-prompt hidden';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="dice-prompt__backdrop"></div>
      <div class="dice-prompt__panel">
        <header class="dice-prompt__header">
          <h2>${this.label}</h2>
          <p class="dice-prompt__formula">${this.formula}</p>
        </header>
        <div class="dice-prompt__mode-switch">
          <button class="mode-btn ${this._mode==='virtual'?'mode-btn--active':''}" data-mode="virtual">
            <i class="fa-solid fa-dice-d20"></i> Lancer ici
          </button>
          <button class="mode-btn ${this._mode==='physical'?'mode-btn--active':''}" data-mode="physical">
            <i class="fa-solid fa-hand"></i> J'ai lancé à la table
          </button>
        </div>
        <div class="dice-prompt__body"></div>
        <footer class="dice-prompt__footer">
          <button class="btn btn--ghost" data-action="cancel">Annuler</button>
          <button class="btn btn--primary" data-action="confirm">Valider</button>
        </footer>
      </div>`;

    el.querySelector('.dice-prompt__backdrop').addEventListener('click', () => this._cancel());
    el.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
    });
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => this._cancel());
    el.querySelector('[data-action="confirm"]').addEventListener('click', () => this._confirm());
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._cancel();
      if (e.key === 'Enter' && this._mode === 'physical') this._confirm();
    });

    document.body.appendChild(el);
    this._el = el;
    this._built = true;
    this._renderBody();
  }

  _renderBody() {
    const body = this._el.querySelector('.dice-prompt__body');
    if (this._mode === 'virtual') {
      body.innerHTML = `
        <div class="dice-prompt__die" tabindex="0" role="button" aria-label="Lancer le dé">🎲</div>
        <div class="dice-prompt__result" style="display:none"></div>
        <div class="dice-prompt__breakdown"></div>`;
      const die = body.querySelector('.dice-prompt__die');
      die.addEventListener('click', () => this._rollVirtual());
      die.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') this._rollVirtual(); });
    } else {
      body.innerHTML = `
        <p style="color:var(--text-muted);font-size:var(--text-sm)">Entrez le résultat brut du dé</p>
        <input type="number" class="dice-prompt__input" min="1" max="20" placeholder="—" />`;
      body.querySelector('.dice-prompt__input').addEventListener('keydown', e => {
        if (e.key === 'Enter') this._confirm();
      });
    }
  }

  _reset() {
    this._currentRoll = null;
    if (this._built) {
      const result = this._el.querySelector('.dice-prompt__result');
      const bd = this._el.querySelector('.dice-prompt__breakdown');
      const die = this._el.querySelector('.dice-prompt__die');
      if (result) { result.style.display = 'none'; result.textContent = ''; result.className = 'dice-prompt__result'; }
      if (bd) bd.textContent = '';
      if (die) { die.textContent = '🎲'; die.classList.remove('dice-prompt__die--rolling'); }
      const inp = this._el.querySelector('.dice-prompt__input');
      if (inp) inp.value = '';
    }
  }

  // ─── Mode & logique ──────────────────────────────────────

  _setMode(mode) {
    this._mode = mode;
    localStorage.setItem('dicePrompt.mode', mode);
    this._el.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('mode-btn--active', b.dataset.mode === mode);
    });
    this._renderBody();
  }

  _parseFormula(formula) {
    const m = String(formula).match(/^(\d+)d(\d+)([+-]\d+)?/i);
    if (!m) return { dice: 1, sides: 20, bonus: 0 };
    return { dice: parseInt(m[1])||1, sides: parseInt(m[2])||20, bonus: parseInt(m[3]||0)||0 };
  }

  _rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  _rollVirtual() {
    const { dice, sides, bonus } = this._parseFormula(this.formula);
    const die = this._el.querySelector('.dice-prompt__die');
    die.classList.add('dice-prompt__die--rolling');
    setTimeout(() => {
      die.classList.remove('dice-prompt__die--rolling');
      const rolls = Array.from({ length: dice }, () => this._rollDie(sides));
      const rawTotal = rolls.reduce((a, b) => a + b, 0);
      const total = rawTotal + bonus;
      const crit   = dice === 1 && sides === 20 && rolls[0] === 20;
      const fumble = dice === 1 && sides === 20 && rolls[0] === 1;
      this._currentRoll = { rolls, bonus, total, crit, fumble };
      this._showResult(total, rolls, bonus, crit, fumble);
    }, 600);
  }

  _showResult(total, rolls, bonus, crit, fumble) {
    const result = this._el.querySelector('.dice-prompt__result');
    const bd = this._el.querySelector('.dice-prompt__breakdown');
    const die = this._el.querySelector('.dice-prompt__die');
    if (crit) { die.textContent = '✨'; result.className = 'dice-prompt__result dice-prompt__result--crit'; }
    else if (fumble) { die.textContent = '💀'; result.className = 'dice-prompt__result dice-prompt__result--fumble'; }
    else { die.textContent = '🎯'; result.className = 'dice-prompt__result'; }
    result.textContent = total;
    result.style.display = '';
    if (bonus !== 0 || rolls.length > 1) {
      const rollStr = rolls.join('+');
      bd.textContent = bonus !== 0 ? `[${rollStr}] ${bonus >= 0 ? '+' : ''}${bonus} = ${total}` : `[${rollStr}] = ${total}`;
    }
  }

  _confirm() {
    if (this._mode === 'virtual') {
      if (!this._currentRoll) { this._rollVirtual(); return; }
      this._emit(this._currentRoll);
    } else {
      const inp = this._el.querySelector('.dice-prompt__input');
      const roll = parseInt(inp?.value);
      if (!roll || roll < 1) { inp?.focus(); return; }
      const { bonus, sides } = this._parseFormula(this.formula);
      const crit   = sides === 20 && roll === 20;
      const fumble = sides === 20 && roll === 1;
      this._emit({ rolls: [roll], bonus, total: roll + bonus, crit, fumble });
    }
  }

  _cancel() {
    this.close();
    if (this._resolve) { this._resolve(null); this._resolve = null; }
  }

  _emit(result) {
    this.close();
    if (this.onResult) this.onResult(result);
    if (this._resolve) { this._resolve(result); this._resolve = null; }
  }
}

// Expose en global pour usage non-modulaire
window.DicePrompt = DicePrompt;
