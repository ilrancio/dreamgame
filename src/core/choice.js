// Un pannello di scelta generico (porte della suite, cartucce del negozio...).
// Si usa con il mouse o con i tasti numerici; Esc chiude.
export class ChoicePanel {
  constructor() {
    this.el = document.getElementById('choice');
    this.open = false;
    this.onClick = (ev) => {
      const b = ev.target.closest('[data-choice]');
      if (b && !b.disabled) this.pick(Number(b.dataset.choice));
      if (ev.target.closest('[data-choice-close]')) this.close();
    };
    this.el.addEventListener('click', this.onClick);
  }

  show({ title, note = '', items, onPick, onClose = null, theme = '' }) {
    this.items = items;
    this.onPick = onPick;
    this.onCloseCb = onClose;
    this.el.innerHTML = `<div class="prize-panel bestiary ${theme}">
      <h3>${title}</h3>
      ${note ? `<p class="prize-note">${note}</p>` : ''}
      <div class="prize-list">${items
        .map((it, i) => it.locked
          ? `<div class="prize-row locked"><span>${it.label}${it.sub ? `<small> · ${it.sub}</small>` : ''}</span></div>`
          : `<button class="prize-row" data-choice="${i}"><kbd>${i + 1}</kbd><span>${it.label}${it.sub ? `<small> · ${it.sub}</small>` : ''}</span><b>${it.action || ''}</b></button>`)
        .join('')}</div>
      <div class="elev-row"><span></span><button class="ghost" data-choice-close>Chiudi <kbd>Esc</kbd></button></div>
    </div>`;
    this.open = true;
    this.el.classList.add('show');
  }

  pick(i) {
    const it = this.items?.[i];
    if (!it || it.locked) return;
    const cb = this.onPick;
    this.hide();
    cb?.(it.value);
  }

  handleKeys(input) {
    if (!this.open) return;
    for (let i = 0; i < Math.min(9, this.items.length); i++) if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) return this.pick(i);
    if (input.wasPressed('Escape', 'KeyQ')) this.close();
  }

  close() {
    const cb = this.onCloseCb;
    this.hide();
    cb?.();
  }

  hide() {
    this.open = false;
    this.el.classList.remove('show');
  }

  dispose() {
    this.hide();
    this.el.removeEventListener('click', this.onClick);
  }
}
