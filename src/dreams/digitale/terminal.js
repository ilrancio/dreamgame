import { Fight, FW, FH, drawForm, drawSilhouette } from './fight.js';
import { SKILLS, loadChiavetta, xpToNext, addXp, heroStats, FORMS, formById, formUnlocked, formData } from './chiavetta.js';

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
  get formName() {
    return formById(this.data?.form).name;
  }

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
      const lines = ['> chiavetta rilevata', `> caricamento ${this.formName}...`, `> LV ${hero.level} · pronto`];
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
    if (this.phase === 'mural') return this.mural(g, input);
    if (this.phase === 'transfer') return this.transfer(g);
  }

  // ---------- Il murale: si sceglie quale entità trasferire nella chiavetta ----------
  startMural(ctx, onClose) {
    this.ctx = ctx;
    this.onClose = onClose;
    this.data = loadChiavetta(ctx.progress);
    this.def = null;
    this.phase = 'mural';
    this.t = 0;
    this.msel = Math.max(0, FORMS.findIndex((q) => q.id === this.data.form));
    this.summary = { transferred: false };
    this.open = true;
    this.el.classList.add('show');
    ctx.input.unlock();
    ctx.audio.chime(990, 0.06);
  }

  mural(g, input) {
    const d = this.data;
    this.drawFrame(g);
    text(g, 'IL MURALE', 24, 28, { size: 13, color: '#ff3ad8' });
    text(g, 'scegli chi abita la chiavetta', 112, 28, { size: 9, color: '#8aa' });
    const cw = 62;
    const x0 = (FW - cw * FORMS.length) / 2;
    FORMS.forEach((fm, i) => {
      const cx = x0 + i * cw + cw / 2;
      const on = this.msel === i;
      const open = formUnlocked(d, fm.id);
      g.fillStyle = on ? 'rgba(122,248,255,0.16)' : 'rgba(122,248,255,0.04)';
      g.fillRect(cx - cw / 2 + 3, 40, cw - 6, 104);
      if (d.form === fm.id) {
        g.strokeStyle = '#ffe42a';
        g.strokeRect(cx - cw / 2 + 3.5, 40.5, cw - 7, 103);
      }
      const sc = Math.min(1.6, 64 / fm.h);
      g.save();
      g.translate(cx, 122);
      g.scale(sc, sc);
      if (open) drawForm(g, fm.id, 0, 0, 1, this.t + i, { state: on ? 'run' : 'idle' });
      else drawSilhouette(g, fm.id, 0, 0, 1, this.t);
      g.restore();
      text(g, open ? fm.name.split(' ')[0] : '???', cx, 138, { size: 8, color: open ? '#ffffff' : '#5a6a7a', align: 'center' });
    });
    // la scheda dell'entità scelta
    const fm = FORMS[this.msel];
    const open = formUnlocked(d, fm.id);
    text(g, open ? fm.name : '??? · dati insufficienti', 24, 168, { size: 12, color: open ? '#7af8ff' : '#ff5a5a' });
    text(g, open ? fm.desc : `Batti altre entità di questo tipo: dati ${Math.min(formData(d, fm.id), fm.need)}/${fm.need}`, 24, 184, { size: 9, color: '#9ab' });
    if (open) {
      const stats = [['VITA', fm.hp], ['CORPO A CORPO', fm.melee], ['TIRO', fm.shot / (fm.shotCd || 1)], ['VELOCITÀ', fm.speed]];
      stats.forEach(([label, v], k) => {
        const y = 202 + k * 12;
        text(g, label, 24, y + 6, { size: 8, color: '#8aa' });
        g.fillStyle = '#1a2a3a';
        g.fillRect(120, y, 160, 6);
        g.fillStyle = v >= 1.2 ? '#4aff8a' : v <= 0.8 ? '#ff8a5a' : '#7af8ff';
        g.fillRect(120, y, Math.round(Math.min(1, v / 2) * 160), 6);
      });
    }
    text(g, d.form === fm.id ? '◆ NELLA CHIAVETTA' : open ? 'INVIO: TRASFERISCI' : '', FW - 24, 212, { size: 11, color: d.form === fm.id ? '#ffe42a' : '#4aff8a', align: 'right' });
    text(g, `livello e abilità restano della chiavetta (LV ${d.hero.level})`, FW - 24, 228, { size: 8, color: '#6a8a9a', align: 'right' });
    this.footer.innerHTML = '<kbd>A</kbd><kbd>D</kbd> scegli · <kbd>Invio</kbd> trasferisci nella chiavetta · <kbd>Esc</kbd> sfila la chiavetta';
    if (input.wasPressed('KeyA', 'ArrowLeft')) this.msel = (this.msel + FORMS.length - 1) % FORMS.length;
    if (input.wasPressed('KeyD', 'ArrowRight')) this.msel = (this.msel + 1) % FORMS.length;
    if (input.wasPressed('Enter', 'Space', 'KeyE')) {
      if (open && d.form !== fm.id) {
        this.phase = 'transfer';
        this.t = 0;
        this.ctx.audio.whoosh(0.2);
      } else this.ctx.audio.thud(0.1);
    }
    if (input.wasPressed('Escape', 'KeyQ')) this.close();
  }

  transfer(g) {
    const fm = FORMS[this.msel];
    this.drawFrame(g);
    const k = Math.min(1, this.t / 1.6);
    text(g, 'TRASFERIMENTO IN CORSO', FW / 2, 60, { size: 14, color: '#ff3ad8', align: 'center' });
    // i pixel dell'entità scendono dal murale nella chiavetta
    for (let i = 0; i < 30; i++) {
      const p = (k * 1.4 + i / 30) % 1;
      g.fillStyle = i % 2 ? '#7af8ff' : '#ff3ad8';
      g.fillRect(140 + p * 190 + Math.sin(i + this.t * 6) * 6, 130 + Math.sin(i * 2.3) * 20 * (1 - p), 3, 3);
    }
    g.save();
    g.translate(120, 160);
    g.scale(1.4, 1.4);
    drawForm(g, fm.id, 0, 0, 1, this.t);
    g.restore();
    // la chiavetta
    g.fillStyle = '#c8ccd2';
    g.fillRect(345, 118, 40, 22);
    g.fillStyle = '#2a2a30';
    g.fillRect(385, 122, 14, 14);
    g.fillStyle = '#7af8ff';
    g.fillRect(351, 124, Math.round(28 * k), 10);
    g.fillStyle = '#1a2a3a';
    g.fillRect(90, 200, 300, 6);
    g.fillStyle = '#7af8ff';
    g.fillRect(90, 200, Math.round(300 * k), 6);
    text(g, `${Math.round(k * 100)}%`, FW / 2, 222, { size: 10, align: 'center' });
    this.footer.innerHTML = '';
    if (this.t > 1.9) {
      this.data.form = fm.id;
      this.summary.transferred = fm.id;
      this.save();
      this.ctx.audio.ding(0.12);
      this.phase = 'mural';
      this.t = 0;
    }
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
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    drawForm(g, this.data.form, 0, 0, 1, this.t);
    g.restore();
  }

  menu(g, input, hero) {
    this.drawFrame(g);
    const rec = this.data.terminals[this.def.id] || {};
    text(g, `TERMINALE · ${this.def.name.toUpperCase()}`, 24, 30, { size: 11, color: '#ff3ad8' });
    text(g, rec.cleared ? 'stato: LIBERATO (le entità tornano a farsi vedere, ogni tanto)' : 'stato: INVASO', 24, 46, { size: 9, color: rec.cleared ? '#4aff8a' : '#ff5a5a' });
    text(g, `pericolo ${'■'.repeat(this.def.diff)}${'□'.repeat(4 - this.def.diff)}`, 24, 60, { size: 9, color: '#ffe42a' });
    this.drawHeroIcon(g, 380, 150, 3);
    const st = heroStats(hero);
    text(g, `${this.formName}  LV ${hero.level}`, 300, 180, { size: 12 });
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
      this.fight = new Fight(this.def, hero, (n) => this.sfx(n), this.data.form);
      this.phase = 'fight';
      this.ctx.audio.chiptune(true, 0.03);
    } else if (pick === 1) {
      this.phase = 'skills';
      this.skillSel = 0;
    } else if (pick === 2) this.close();
  }

  skills(g, input, hero) {
    this.drawFrame(g);
    text(g, `ABILITÀ DI ${this.formName}`, 24, 30, { size: 12, color: '#ff3ad8' });
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
    // i dati delle entità battute: servono al murale
    const before = new Set(FORMS.filter((q) => formUnlocked(this.data, q.id)).map((q) => q.id));
    for (const [key, n] of Object.entries(f.killsBy)) this.data.kills[key] = (this.data.kills[key] || 0) + n;
    const newForms = FORMS.filter((q) => !before.has(q.id) && formUnlocked(this.data, q.id)).map((q) => q.name);
    if (newForms.length) this.summary.newForms = (this.summary.newForms || []).concat(newForms);
    const lvl0 = hero.level;
    const ups = addXp(hero, xp);
    this.save();
    this.res = { won: f.won, xp, ups, first, lvl0, newForms };
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
      text(g, r.won ? (r.first ? 'Terminale liberato!' : 'Il terminale è di nuovo pulito.') : `${this.formName} torna nella chiavetta. Metà dei dati è salva.`, FW / 2, 82, { size: 10, color: '#9ab', align: 'center' });
      const shown = Math.min(r.xp, Math.floor(this.t * 120));
      text(g, `+${shown} XP`, FW / 2, 120, { size: 16, color: '#ffe42a', align: 'center' });
      if (r.ups && this.t > 0.8) {
        text(g, `LIVELLO SU!  ${r.lvl0} → ${hero.level}`, FW / 2, 155, { size: 15, color: '#ff3ad8', align: 'center' });
        text(g, `+${r.ups * 2} punti abilità`, FW / 2, 175, { size: 11, color: '#7af8ff', align: 'center' });
      }
      this.drawHeroIcon(g, 70, 220, 2);
      if (r.newForms?.length && this.t > 1.2) {
        text(g, `NUOVA ENTITÀ NEL MURALE: ${r.newForms.join(', ')}`, FW / 2, 205, { size: 10, color: '#4aff8a', align: 'center' });
        text(g, 'Il murale in fondo alla galleria del centro commerciale', FW / 2, 219, { size: 8, color: '#8aa', align: 'center' });
      }
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
