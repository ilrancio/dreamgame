import { Fight, FW, FH } from './fight.js';
import { SKILLS, HERO_NAME, loadChiavetta, xpToNext, addXp, heroStats } from './chiavetta.js';

// I terminali sparsi nei macroluoghi: ognuno ha le sue entità e il suo boss.
export const TERMINALS = {
  piazzale: { id: 'piazzale', name: 'Piazzale dell\'hotel', diff: 1, boss: 'bug', theme: 'hotel' },
  borgo: { id: 'borgo', name: 'Piazza di Sant\'Onirio', diff: 2, boss: 'spam', theme: 'borgo' },
  parcheggio: { id: 'parcheggio', name: 'Parcheggio Orizzonte', diff: 3, boss: 'firewall', theme: 'parcheggio' },
  galleria: { id: 'galleria', name: 'Galleria Orizzonte', diff: 4, boss: 'kernel', theme: 'galleria' },
};

export function terminalsCleared(progress) {
  const t = progress.digitale?.terminals || {};
  return Object.keys(TERMINALS).filter((id) => t[id]?.cleared).length;
}

const CONTROLS = '<kbd>A</kbd><kbd>D</kbd> muovi · <kbd>W</kbd>/<kbd>Spazio</kbd> salta · <kbd>J</kbd> pugno · <kbd>K</kbd> calcio · <kbd>L</kbd> spara · <kbd>S</kbd> para · <kbd>Shift</kbd> scatto · <kbd>Esc</kbd> scollega';

function text(g, s, x, y, { size = 10, color = '#7af8ff', align = 'left' } = {}) {
  g.font = `bold ${size}px monospace`;
  g.textAlign = align;
  g.fillStyle = color;
  g.fillText(s, x, y);
}

// Lo schermo del terminale: si collega la chiavetta, si sceglie, si combatte.
export class TerminalScreen {
  constructor() {
    this.el = document.getElementById('terminal');
    this.canvas = document.getElementById('terminal-canvas');
    this.footer = document.getElementById('terminal-footer');
    this.canvas.width = FW;
    this.canvas.height = FH;
    this.g = this.canvas.getContext('2d');
    this.open = false;
  }

  // def: un TERMINALS[...]; onClose({ won, firstClear }) quando si scollega
  start(def, ctx, onClose) {
    this.def = def;
    this.ctx = ctx;
    this.onClose = onClose;
    this.data = loadChiavetta(ctx.progress);
    this.phase = 'boot';
    this.t = 0;
    this.sel = 0;
    this.summary = { won: false, firstClear: false };
    this.open = true;
    this.el.classList.add('show');
    ctx.input.unlock();
    ctx.audio.chime(1320, 0.06);
  }

  sfx(name) {
    const a = this.ctx.audio;
    ({
      hit: () => a.pop(0.12),
      hit2: () => a.thud(0.22),
      swing: () => a.whoosh(0.05),
      swing2: () => a.whoosh(0.08),
      shot: () => a.bleep(0.03),
      eshot: () => a.bleep(0.02),
      jump: () => a.squeak(0.02),
      dash: () => a.whoosh(0.12),
      hurt: () => a.thud(0.35),
      block: () => a.chime(1600, 0.04),
      shield: () => a.chime(400, 0.06),
      delete: () => a.pop(0.15),
      alert: () => a.chime(660, 0.05),
      clear: () => a.ding(0.08),
      boss: () => a.roar(0.25),
      bossdown: () => a.boom(0.5),
      slam: () => a.thud(0.4),
      glitch: () => a.squeak(0.05),
      lose: () => a.boom(0.3),
    })[name]?.();
  }

  save() {
    this.ctx.saveProgress(this.ctx.progress);
  }

  update(dt, input) {
    if (!this.open) return;
    this.t += dt;
    const g = this.g;
    const hero = this.data.hero;
    if (this.phase === 'boot') {
      this.drawFrame(g);
      const lines = ['> chiavetta rilevata', `> caricamento ${HERO_NAME}...`, `> LV ${hero.level} · pronto`];
      lines.forEach((l, i) => this.t > 0.3 + i * 0.45 && text(g, l, 40, 90 + i * 22, { size: 12 }));
      g.fillStyle = '#1a2a3a';
      g.fillRect(40, 180, 400, 6);
      g.fillStyle = '#7af8ff';
      g.fillRect(40, 180, Math.min(400, (this.t / 1.6) * 400), 6);
      this.drawHeroIcon(g, 400, 120, 3);
      this.footer.innerHTML = 'La chiavetta si scalda un po\'. Dentro, qualcuno ti saluta.';
      if (this.t > 1.8 || input.wasPressed('Space', 'Enter')) this.phase = 'menu';
      return;
    }
    if (this.phase === 'menu') return this.menu(g, input, hero);
    if (this.phase === 'skills') return this.skills(g, input, hero);
    if (this.phase === 'fight') return this.fightUpdate(dt, input);
    if (this.phase === 'result') return this.result(g, input);
  }

  drawFrame(g) {
    g.fillStyle = '#05030f';
    g.fillRect(0, 0, FW, FH);
    g.strokeStyle = 'rgba(122,248,255,0.4)';
    g.strokeRect(6.5, 6.5, FW - 13, FH - 13);
    for (let y = 0; y < FH; y += 3) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, y, FW, 1);
    }
  }

  drawHeroIcon(g, x, y, s) {
    const R = (dx, dy, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(x + dx * s, y + dy * s, w * s, h * s);
    };
    R(-9 - Math.round(Math.sin(this.t * 6)), -26, 6, 3, '#ff8a2a');
    R(-4, -10, 4, 10, '#e8f0f4');
    R(1, -10, 4, 10, '#e8f0f4');
    R(-5, -21, 11, 12, '#2ab8c8');
    R(4, -19, 3, 8, '#e8f0f4');
    R(-7, -19, 3, 8, '#e8f0f4');
    R(-4, -28, 9, 8, '#e8f0f4');
    R(0, -26, 6, 3, '#7af8ff');
  }

  menu(g, input, hero) {
    this.drawFrame(g);
    const rec = this.data.terminals[this.def.id] || {};
    text(g, `TERMINALE · ${this.def.name.toUpperCase()}`, 24, 30, { size: 11, color: '#ff3ad8' });
    text(g, rec.cleared ? 'stato: LIBERATO (le entità tornano a farsi vedere, ogni tanto)' : 'stato: INVASO', 24, 46, { size: 9, color: rec.cleared ? '#4aff8a' : '#ff5a5a' });
    text(g, `pericolo ${'■'.repeat(this.def.diff)}${'□'.repeat(4 - this.def.diff)}`, 24, 60, { size: 9, color: '#ffe42a' });
    this.drawHeroIcon(g, 380, 150, 3);
    const st = heroStats(hero);
    text(g, `${HERO_NAME}  LV ${hero.level}`, 300, 180, { size: 12 });
    g.fillStyle = '#1a2a3a';
    g.fillRect(300, 186, 150, 4);
    g.fillStyle = '#ffe42a';
    g.fillRect(300, 186, Math.round((150 * hero.xp) / xpToNext(hero.level)), 4);
    text(g, `XP ${hero.xp}/${xpToNext(hero.level)} · vita ${st.hp}`, 300, 202, { size: 9, color: '#9ab' });
    const items = [
      ['COMBATTI', rec.cleared ? 'di nuovo (meno XP)' : 'libera il terminale'],
      ['ABILITÀ', hero.sp ? `${hero.sp} punt${hero.sp === 1 ? 'o' : 'i'} da spendere!` : 'nessun punto libero'],
      ['SCOLLEGA', 'riprendi la chiavetta'],
    ];
    items.forEach(([label, sub], i) => {
      const y = 100 + i * 34;
      const on = this.sel === i;
      if (on) {
        g.fillStyle = 'rgba(122,248,255,0.15)';
        g.fillRect(20, y - 16, 240, 28);
      }
      text(g, `${on ? '▶' : ' '} ${i + 1} ${label}`, 28, y, { size: 13, color: on ? '#ffffff' : '#7af8ff' });
      text(g, sub, 50, y + 10, { size: 8, color: i === 1 && hero.sp ? '#ffe42a' : '#6a8a9a' });
    });
    this.footer.innerHTML = '<kbd>W</kbd><kbd>S</kbd> scegli · <kbd>Invio</kbd> conferma · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> · <kbd>Esc</kbd> scollega';
    if (input.wasPressed('KeyW', 'ArrowUp')) this.sel = (this.sel + 2) % 3;
    if (input.wasPressed('KeyS', 'ArrowDown')) this.sel = (this.sel + 1) % 3;
    let pick = input.wasPressed('Enter', 'Space', 'KeyE') ? this.sel : -1;
    for (let i = 0; i < 3; i++) if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) pick = i;
    if (input.wasPressed('Escape')) pick = 2;
    if (pick === 0) {
      this.fight = new Fight(this.def, hero, (n) => this.sfx(n));
      this.phase = 'fight';
      this.ctx.audio.chiptune(true, 0.03);
    } else if (pick === 1) {
      this.phase = 'skills';
      this.skillSel = 0;
    } else if (pick === 2) this.close();
  }

  skills(g, input, hero) {
    this.drawFrame(g);
    text(g, `ABILITÀ DI ${HERO_NAME}`, 24, 30, { size: 12, color: '#ff3ad8' });
    text(g, `punti da spendere: ${hero.sp}`, FW - 24, 30, { size: 11, color: '#ffe42a', align: 'right' });
    SKILLS.forEach((sk, i) => {
      const y = 70 + i * 46;
      const lv = hero.skills[sk.id];
      const on = this.skillSel === i;
      if (on) {
        g.fillStyle = 'rgba(122,248,255,0.12)';
        g.fillRect(18, y - 16, FW - 36, 40);
      }
      text(g, `${i + 1} ${sk.name.toUpperCase()}`, 28, y, { size: 12, color: on ? '#ffffff' : '#7af8ff' });
      for (let k = 0; k < sk.max; k++) {
        g.fillStyle = k < lv ? '#ffe42a' : '#1a2a3a';
        g.fillRect(170 + k * 16, y - 9, 12, 10);
      }
      text(g, sk.desc, 28, y + 15, { size: 8, color: '#8aa' });
    });
    this.footer.innerHTML = '<kbd>W</kbd><kbd>S</kbd> scegli · <kbd>Invio</kbd> o <kbd>1</kbd>-<kbd>4</kbd> spendi un punto · <kbd>Esc</kbd> indietro';
    if (input.wasPressed('KeyW', 'ArrowUp')) this.skillSel = (this.skillSel + 3) % 4;
    if (input.wasPressed('KeyS', 'ArrowDown')) this.skillSel = (this.skillSel + 1) % 4;
    let pick = input.wasPressed('Enter', 'Space', 'KeyE') ? this.skillSel : -1;
    for (let i = 0; i < 4; i++) if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) pick = i;
    if (pick >= 0) {
      const sk = SKILLS[pick];
      if (hero.sp > 0 && hero.skills[sk.id] < sk.max) {
        hero.sp--;
        hero.skills[sk.id]++;
        this.ctx.audio.chime(880 + hero.skills[sk.id] * 80, 0.08);
        this.save();
      } else this.ctx.audio.thud(0.1);
    }
    if (input.wasPressed('Escape', 'KeyQ')) this.phase = 'menu';
  }

  fightUpdate(dt, input) {
    const f = this.fight;
    if (input.wasPressed('Escape')) {
      // scollegarsi a metà: nessun dato salvato
      this.ctx.audio.chiptune(false);
      this.res = { won: false, quit: true, xp: 0, ups: 0 };
      this.phase = 'result';
      this.t = 0;
      return;
    }
    const k = {
      left: input.down('KeyA', 'ArrowLeft'),
      right: input.down('KeyD', 'ArrowRight'),
      jump: input.wasPressed('KeyW', 'ArrowUp', 'Space'),
      block: input.down('KeyS', 'ArrowDown'),
      punch: input.wasPressed('KeyJ', 'KeyZ'),
      kick: input.wasPressed('KeyK', 'KeyX'),
      shoot: input.down('KeyL', 'KeyC'),
      dash: input.wasPressed('ShiftLeft', 'ShiftRight'),
    };
    f.update(Math.min(dt, 1 / 30), k);
    f.draw(this.g, this.t);
    this.footer.innerHTML = CONTROLS;
    if (f.done) this.finishFight();
  }

  finishFight() {
    const f = this.fight;
    const hero = this.data.hero;
    const rec = (this.data.terminals[this.def.id] ??= { cleared: false, wins: 0 });
    let xp = f.xp;
    let first = false;
    if (f.won) {
      if (!rec.cleared) {
        first = true;
        xp += 50 * this.def.diff;
        rec.cleared = true;
      } else xp = Math.round(xp * 0.5);
      rec.wins++;
    } else xp = Math.round(xp * 0.5);
    const lvl0 = hero.level;
    const ups = addXp(hero, xp);
    this.save();
    this.res = { won: f.won, xp, ups, first, lvl0 };
    if (f.won) this.summary.won = true;
    if (first) this.summary.firstClear = true;
    this.ctx.audio.chiptune(false);
    if (ups) this.ctx.audio.ding(0.12);
    this.phase = 'result';
    this.t = 0;
  }

  result(g, input) {
    const r = this.res;
    const hero = this.data.hero;
    this.drawFrame(g);
    if (r.quit) {
      text(g, 'CHIAVETTA SCOLLEGATA', FW / 2, 110, { size: 16, color: '#ff5a5a', align: 'center' });
      text(g, 'Le entità restano dove sono. Nessun dato salvato.', FW / 2, 140, { size: 9, color: '#9ab', align: 'center' });
    } else {
      text(g, r.won ? 'ENTITÀ CANCELLATE' : 'DISCONNESSO', FW / 2, 60, { size: 18, color: r.won ? '#4aff8a' : '#ff5a5a', align: 'center' });
      text(g, r.won ? (r.first ? 'Terminale liberato!' : 'Il terminale è di nuovo pulito.') : `${HERO_NAME} torna nella chiavetta. Metà dei dati è salva.`, FW / 2, 82, { size: 10, color: '#9ab', align: 'center' });
      const shown = Math.min(r.xp, Math.floor(this.t * 120));
      text(g, `+${shown} XP`, FW / 2, 120, { size: 16, color: '#ffe42a', align: 'center' });
      if (r.ups && this.t > 0.8) {
        text(g, `LIVELLO SU!  ${r.lvl0} → ${hero.level}`, FW / 2, 155, { size: 15, color: '#ff3ad8', align: 'center' });
        text(g, `+${r.ups * 2} punti abilità`, FW / 2, 175, { size: 11, color: '#7af8ff', align: 'center' });
      }
      this.drawHeroIcon(g, 70, 220, 2);
    }
    if (this.t > 0.6 && Math.floor(this.t * 2) % 2) text(g, 'INVIO PER CONTINUARE', FW / 2, 240, { size: 9, color: '#7af8ff', align: 'center' });
    this.footer.innerHTML = '';
    if (this.t > 0.6 && input.wasPressed('Enter', 'Space', 'KeyE', 'Escape')) {
      this.phase = 'menu';
      this.sel = hero.sp ? 1 : 0;
      this.t = 0;
    }
  }

  close() {
    this.open = false;
    this.el.classList.remove('show');
    this.ctx.audio.chiptune(false);
    this.ctx.audio.chime(660, 0.05);
    const cb = this.onClose;
    this.onClose = null;
    cb?.(this.summary);
  }

  dispose() {
    if (this.open) this.close();
  }
}
