import { PARTY, GEAR, ITEMS, KEY_ITEMS, SKILLS, MAIN, SIDE, MONEY, memberStats, knownSkills, xpToNext, SHOP_GEAR, SHOP_ITEMS } from './data.js';

// Le finestre della campagna, nello stile blu di FFX: i dialoghi, il negozio,
// il menu del gruppo (stato, equipaggiamento, oggetti, missioni).

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .rpg { position: fixed; z-index: 45; font: 600 15px Inter, system-ui, sans-serif; color: #fff; text-shadow: 1px 1px 0 #000, 0 0 4px rgba(0,0,0,0.6);
    background: linear-gradient(180deg, rgba(52,86,182,0.94), rgba(14,26,86,0.94)); border: 2px solid rgba(225,232,255,0.9); border-radius: 9px; box-shadow: 0 0 0 1px rgba(0,0,40,0.6), 0 8px 26px rgba(0,0,0,0.55); }
  .rpg.dlg { left: 50%; bottom: 40px; transform: translateX(-50%); width: min(760px, 92vw); padding: 14px 20px 16px; }
  .rpg.dlg .who { color: #ffe8a0; font-size: 14px; letter-spacing: 0.04em; margin-bottom: 4px; }
  .rpg.dlg .txt { font-size: 18px; line-height: 1.45; min-height: 52px; font-weight: 500; }
  .rpg.dlg .more { position: absolute; right: 14px; bottom: 8px; font-size: 12px; opacity: 0.8; animation: rpgb 0.8s infinite alternate; }
  @keyframes rpgb { to { opacity: 0.3; } }
  .rpg .ch { margin-top: 8px; }
  .rpg .ch div, .rpg .li { padding: 4px 10px 4px 26px; border-radius: 4px; position: relative; cursor: pointer; }
  .rpg .ch div.on, .rpg .li.on { background: rgba(255,255,255,0.15); }
  .rpg .ch div.on::before, .rpg .li.on::before { content: '▶'; position: absolute; left: 8px; color: #ffe8a0; }
  .rpg .li.off { opacity: 0.45; }
  .rpg.win { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(860px, 94vw); max-height: 86vh; overflow: auto; padding: 16px 20px; }
  .rpg.win h3 { margin: 0 0 10px; font: 700 26px "Cormorant Garamond", serif; display: flex; justify-content: space-between; align-items: baseline; }
  .rpg.win h3 small { font: 600 14px Inter, sans-serif; color: #ffe8a0; }
  .rpg .tabs { display: flex; gap: 6px; margin-bottom: 12px; }
  .rpg .tabs span { padding: 4px 12px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.4); font-size: 13px; opacity: 0.7; cursor: pointer; }
  .rpg .tabs span.on { opacity: 1; background: rgba(255,255,255,0.18); border-color: #fff; }
  .rpg .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .rpg .card { background: rgba(0,0,40,0.35); border-radius: 6px; padding: 8px 12px; }
  .rpg .card.on { outline: 2px solid #ffe8a0; }
  .rpg .card .nm { font-size: 17px; color: #ffe8a0; display: flex; justify-content: space-between; }
  .rpg .st { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 10px; font-size: 13px; margin-top: 4px; opacity: 0.95; }
  .rpg .sm { font-size: 12px; opacity: 0.8; font-weight: 500; }
  .rpg .row { display: flex; justify-content: space-between; gap: 12px; }
  .rpg .up { color: #8aff9a; } .rpg .dn { color: #ff8a8a; }
  .rpg .q { margin: 6px 0 10px; } .rpg .q b { color: #ffe8a0; } .rpg .q.done { opacity: 0.5; }
  .rpg .keys { margin-top: 10px; font-size: 12px; opacity: 0.7; }
  .rpg .bar { height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; overflow: hidden; margin-top: 3px; }
  .rpg .bar i { display: block; height: 100%; background: linear-gradient(90deg,#4aff8a,#c8ffd0); }
  `;
  document.head.appendChild(s);
}

const nav = (input) => ({
  up: input.wasPressed('KeyW', 'ArrowUp'),
  down: input.wasPressed('KeyS', 'ArrowDown'),
  left: input.wasPressed('KeyA', 'ArrowLeft'),
  right: input.wasPressed('KeyD', 'ArrowRight'),
  ok: input.wasPressed('Enter', 'Space', 'KeyE'),
  back: input.wasPressed('Escape', 'KeyQ', 'Backspace'),
});

// ---------- I dialoghi ----------
// lines: [{ who, text, choices?: [{ label, fn }] }] ; onDone alla fine
export class Dialog {
  constructor(ctx) {
    injectStyle();
    this.ctx = ctx;
    this.open = false;
  }

  show(lines, onDone = null) {
    this.lines = lines.map((l) => (typeof l === 'string' ? { who: null, text: l } : l));
    this.i = 0;
    this.onDone = onDone;
    this.open = true;
    this.t = 0;
    this.ctx.input.unlock();
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'rpg dlg';
      document.body.appendChild(this.el);
    }
    this.sel = 0;
    this.render();
  }

  render() {
    const L = this.lines[this.i];
    this.el.innerHTML = `${L.who ? `<div class="who">${L.who}</div>` : ''}<div class="txt">${L.text}</div>${L.choices ? `<div class="ch">${L.choices.map((c, k) => `<div class="${k === this.sel ? 'on' : ''}" data-k="${k}">${c.label}</div>`).join('')}</div>` : '<div class="more">▼ E</div>'}`;
    this.el.querySelectorAll('.ch div').forEach((d) => {
      d.onclick = () => {
        this.sel = +d.dataset.k;
        this.choose();
      };
    });
    this.el.onclick = (e) => {
      if (!L.choices && e.target === this.el) this.next();
    };
  }

  next() {
    this.ctx.audio.bleep(0.02);
    if (this.i < this.lines.length - 1) {
      this.i++;
      this.sel = 0;
      this.render();
    } else this.close();
  }

  choose() {
    const L = this.lines[this.i];
    const c = L.choices[this.sel];
    this.ctx.audio.chime(1320, 0.04);
    this.close(true);
    c.fn?.();
  }

  close(skipDone = false) {
    this.open = false;
    this.el?.remove();
    this.el = null;
    const cb = this.onDone;
    this.onDone = null;
    if (!skipDone) cb?.();
  }

  update(dt) {
    if (!this.open) return;
    this.t += dt;
    if (this.t < 0.2) return;
    const k = nav(this.ctx.input);
    const L = this.lines[this.i];
    if (L.choices) {
      if (k.up) this.sel = (this.sel + L.choices.length - 1) % L.choices.length;
      if (k.down) this.sel = (this.sel + 1) % L.choices.length;
      if (k.up || k.down) this.render();
      if (k.ok) this.choose();
    } else if (k.ok) this.next();
  }

  dispose() {
    this.el?.remove();
  }
}

// ---------- Il negozio ----------
export class Shop {
  constructor(ctx) {
    injectStyle();
    this.ctx = ctx;
    this.open = false;
  }

  show(state, onClose) {
    this.state = state;
    this.onClose = onClose;
    this.tab = 0;
    this.sel = 0;
    this.open = true;
    this.t = 0;
    this.msg = 'Rina: «Roba buona, anche se un po\' bagnata.»';
    this.ctx.input.unlock();
    this.el = document.createElement('div');
    this.el.className = 'rpg win';
    document.body.appendChild(this.el);
    this.render();
  }

  list() {
    const st = this.state;
    if (this.tab === 0) {
      return SHOP_GEAR.map((id) => {
        const g = GEAR[id];
        const owned = st.gear[id] || 0;
        const who = g.who ? PARTY[g.who].short : 'tutti';
        const stats = [g.str && `For +${g.str}`, g.mag && `Mag +${g.mag}`, g.def && `Dif +${g.def}`, g.mdef && `DifM +${g.mdef}`, g.hp && `Vita +${g.hp}`].filter(Boolean).join(' · ');
        const unique = g.slot === 'weapon';
        const off = st.money < g.price || (unique && owned > 0) || (g.who === 'marta' && !st.members.includes('marta'));
        return { id, kind: 'gear', label: g.name, right: unique && owned ? 'già tuo' : `${g.price} c`, sub: `per ${who} · ${stats}${owned && !unique ? ` · ne hai ${owned}` : ''}`, price: g.price, off };
      });
    }
    return SHOP_ITEMS.map((id) => {
      const it = ITEMS[id];
      return { id, kind: 'item', label: it.name, right: `${it.price} c`, sub: `${it.desc} · ne hai ${st.items[id] || 0}`, price: it.price, off: st.money < it.price };
    });
  }

  render() {
    const L = this.list();
    this.sel = Math.min(this.sel, L.length - 1);
    this.el.innerHTML = `<h3>Emporio di Porto Grigio <small>${this.state.money} ${MONEY}</small></h3>
      <div class="tabs"><span class="${this.tab === 0 ? 'on' : ''}" data-t="0">Equipaggiamento</span><span class="${this.tab === 1 ? 'on' : ''}" data-t="1">Oggetti</span></div>
      ${L.map((r, i) => `<div class="li ${i === this.sel ? 'on' : ''} ${r.off ? 'off' : ''}" data-i="${i}"><div class="row"><span>${r.label}</span><span>${r.right}</span></div><div class="sm">${r.sub}</div></div>`).join('')}
      <div class="keys">${this.msg}<br><b>A</b>/<b>D</b> scheda · <b>W</b>/<b>S</b> scegli · <b>Invio</b> compra · <b>Esc</b> esci</div>`;
    this.el.querySelectorAll('.li').forEach((d) => {
      d.onclick = () => {
        this.sel = +d.dataset.i;
        this.buy();
      };
    });
    this.el.querySelectorAll('.tabs span').forEach((d) => {
      d.onclick = () => {
        this.tab = +d.dataset.t;
        this.sel = 0;
        this.render();
      };
    });
  }

  buy() {
    const r = this.list()[this.sel];
    const st = this.state;
    if (!r || r.off) {
      this.ctx.audio.thud(0.1);
      this.msg = 'Rina: «Non posso, mi spiace.»';
      this.render();
      return;
    }
    st.money -= r.price;
    if (r.kind === 'gear') st.gear[r.id] = (st.gear[r.id] || 0) + 1;
    else st.items[r.id] = (st.items[r.id] || 0) + 1;
    this.ctx.audio.chime(1568, 0.06);
    this.msg = r.kind === 'gear' ? `Comprato: ${r.label}. Equipaggialo dal menu del gruppo (<b>G</b>).` : `Comprato: ${r.label}.`;
    this.onBuy?.();
    this.render();
  }

  update(dt) {
    if (!this.open) return;
    this.t += dt;
    if (this.t < 0.2) return;
    const k = nav(this.ctx.input);
    const n = this.list().length;
    if (k.left || k.right) {
      this.tab = 1 - this.tab;
      this.sel = 0;
      this.render();
    }
    if (k.up) {
      this.sel = (this.sel + n - 1) % n;
      this.render();
    }
    if (k.down) {
      this.sel = (this.sel + 1) % n;
      this.render();
    }
    if (k.ok) this.buy();
    if (k.back) this.close();
  }

  close() {
    this.open = false;
    this.el.remove();
    this.onClose?.();
  }
}

// ---------- Il menu del gruppo ----------
const TABS = ['Gruppo', 'Equipaggia', 'Oggetti', 'Missioni'];

export class PartyMenu {
  constructor(ctx) {
    injectStyle();
    this.ctx = ctx;
    this.open = false;
  }

  show(state, onClose) {
    this.state = state;
    this.onClose = onClose;
    this.tab = 0;
    this.sel = 0;
    this.sub = null; // in Equipaggia/Oggetti: la seconda scelta
    this.open = true;
    this.t = 0;
    this.msg = '';
    this.ctx.input.unlock();
    this.el = document.createElement('div');
    this.el.className = 'rpg win';
    document.body.appendChild(this.el);
    this.render();
  }

  memberCard(id, on = false, extra = '') {
    const st = this.state;
    const ms = memberStats(st, id);
    const cur = st.party[id] || {};
    const hp = Math.round(cur.hp ?? ms.maxHp);
    const mp = Math.round(cur.mp ?? ms.maxMp);
    const eq = st.equip[id] || {};
    return `<div class="card ${on ? 'on' : ''}"><div class="nm"><span>${PARTY[id].name}</span><span class="sm">Liv. ${st.level}</span></div>
      <div class="row"><span>Vita ${hp} / ${ms.maxHp}</span><span>MP ${mp} / ${ms.maxMp}</span></div><div class="bar"><i style="width:${(100 * hp) / ms.maxHp}%"></i></div>
      <div class="st"><span>For ${Math.round(ms.str)}</span><span>Mag ${Math.round(ms.mag)}</span><span>Agi ${Math.round(ms.agi)}</span><span>Dif ${Math.round(ms.def)}</span><span>DifM ${Math.round(ms.mdef)}</span></div>
      <div class="sm" style="margin-top:4px">${GEAR[eq.weapon || PARTY[id].weapon].name} · ${GEAR[eq.armor || 'maglia'].name}</div>
      <div class="sm">${knownSkills(id, st.level).map((s) => SKILLS[s].name).join(', ')}</div>${extra}</div>`;
  }

  render() {
    const st = this.state;
    let body = '';
    let keys = '<b>A</b>/<b>D</b> scheda · <b>Esc</b> chiudi';
    if (this.tab === 0) {
      body = `<div class="sm" style="margin-bottom:8px">Esperienza: ${st.xp} / ${xpToNext(st.level)} per il livello ${st.level + 1}</div><div class="cols">${st.members.map((id) => this.memberCard(id)).join('')}</div>`;
    } else if (this.tab === 1) {
      if (!this.sub) {
        body = `<div class="sm" style="margin-bottom:8px">Scegli chi equipaggiare.</div><div class="cols">${st.members.map((id, i) => this.memberCard(id, i === this.sel)).join('')}</div>`;
        keys = '<b>W</b>/<b>S</b> scegli · <b>Invio</b> conferma · ' + keys;
      } else {
        const id = this.sub.id;
        const opts = this.gearOptions(id);
        const ms = memberStats(st, id);
        body = `<div class="cols"><div>${this.memberCard(id)}</div><div>${opts
          .map((o, i) => {
            const test = { ...st, equip: { ...st.equip, [id]: { ...(st.equip[id] || {}), [o.slot]: o.gid } } };
            const nx = memberStats(test, id);
            const diff = [['For', 'str'], ['Mag', 'mag'], ['Dif', 'def'], ['DifM', 'mdef'], ['Vita', 'maxHp']]
              .map(([l, k]) => {
                const d = Math.round(nx[k] - ms[k]);
                return d ? `<span class="${d > 0 ? 'up' : 'dn'}">${l} ${d > 0 ? '+' : ''}${d}</span>` : '';
              })
              .filter(Boolean)
              .join(' ');
            return `<div class="li ${i === this.sel ? 'on' : ''} ${o.off ? 'off' : ''}"><div class="row"><span>${o.slot === 'weapon' ? '⚔' : '⛨'} ${GEAR[o.gid].name}</span><span class="sm">${o.equipped ? 'indossato' : o.off ? 'lo usa un altro' : ''}</span></div><div class="sm">${diff || '—'}</div></div>`;
          })
          .join('')}</div></div>`;
        keys = '<b>W</b>/<b>S</b> scegli · <b>Invio</b> equipaggia · <b>Esc</b> indietro';
      }
    } else if (this.tab === 2) {
      const items = Object.entries(ITEMS).filter(([id]) => st.items[id]);
      if (!this.sub) {
        body = items.length
          ? items.map(([id, it], i) => `<div class="li ${i === this.sel ? 'on' : ''}"><div class="row"><span>${it.name}</span><span>×${st.items[id]}</span></div><div class="sm">${it.desc}</div></div>`).join('')
          : '<div class="sm">Niente nella borsa.</div>';
        const keyItems = Object.entries(st.keyItems).filter(([, n]) => n > 0);
        if (keyItems.length) body += `<div style="margin-top:12px;color:#ffe8a0">Oggetti importanti</div>${keyItems.map(([id, n]) => `<div class="sm">${KEY_ITEMS[id].name}${n > 1 ? ` ×${n}` : ''} — ${KEY_ITEMS[id].desc}</div>`).join('')}`;
        keys = '<b>W</b>/<b>S</b> scegli · <b>Invio</b> usa · ' + keys;
      } else {
        body = `<div class="sm" style="margin-bottom:8px">${ITEMS[this.sub.item].name}: su chi?</div><div class="cols">${st.members.map((id, i) => this.memberCard(id, i === this.sel)).join('')}</div>`;
        keys = '<b>W</b>/<b>S</b> scegli · <b>Invio</b> usa · <b>Esc</b> indietro';
      }
    } else {
      const q = st.quests;
      const main = MAIN.slice(0, q.main + 1);
      body = `<div style="color:#ffe8a0;margin-bottom:4px">La storia</div>${main
        .map((m, i) => `<div class="q ${i < q.main ? 'done' : ''}"><b>${i < q.main ? '✓ ' : '▶ '}${m.title}</b><div class="sm">${m.text}</div></div>`)
        .reverse()
        .join('')}`;
      const side = Object.entries(SIDE).filter(([id]) => q.side[id]);
      body += `<div style="color:#ffe8a0;margin:12px 0 4px">Missioni secondarie</div>${
        side.length
          ? side.map(([id, sq]) => `<div class="q ${q.side[id] === 'done' ? 'done' : ''}"><b>${q.side[id] === 'done' ? '✓ ' : '▶ '}${sq.title}</b> <span class="sm">(${sq.giver})</span><div class="sm">${sq.text}${id === 'reti' && q.side[id] !== 'done' ? ` Fili: ${Math.min(3, st.keyItems.filo || 0)}/3.` : ''} Ricompensa: ${sq.reward}.</div></div>`).join('')
          : '<div class="sm">Nessuna, per ora. A Porto Grigio c\'è chi ha bisogno di una mano.</div>'
      }`;
    }
    this.el.innerHTML = `<h3>Il gruppo <small>${st.money} ${MONEY}</small></h3><div class="tabs">${TABS.map((t, i) => `<span class="${i === this.tab ? 'on' : ''}" data-t="${i}">${t}</span>`).join('')}</div>${body}<div class="keys">${this.msg ? `${this.msg}<br>` : ''}${keys}</div>`;
    this.el.querySelectorAll('.tabs span').forEach((d) => {
      d.onclick = () => {
        this.tab = +d.dataset.t;
        this.sel = 0;
        this.sub = null;
        this.render();
      };
    });
  }

  gearOptions(id) {
    const st = this.state;
    const opts = [];
    for (const [gid, n] of Object.entries(st.gear)) {
      const g = GEAR[gid];
      if (!n || !g) continue;
      if (g.slot === 'weapon' && g.who !== id) continue;
      const usedBy = st.members.filter((m) => (st.equip[m]?.[g.slot] || (g.slot === 'weapon' ? PARTY[m].weapon : 'maglia')) === gid);
      const equipped = usedBy.includes(id);
      const free = n - usedBy.length;
      opts.push({ gid, slot: g.slot, equipped, off: !equipped && free <= 0 });
    }
    return opts.sort((a, b) => (a.slot === b.slot ? 0 : a.slot === 'weapon' ? -1 : 1));
  }

  confirm() {
    const st = this.state;
    if (this.tab === 1) {
      if (!this.sub) {
        this.sub = { id: st.members[this.sel] };
        this.sel = 0;
      } else {
        const o = this.gearOptions(this.sub.id)[this.sel];
        if (!o || o.off) return this.ctx.audio.thud(0.1);
        st.equip[this.sub.id] = { ...(st.equip[this.sub.id] || {}), [o.slot]: o.gid };
        // la vita non supera il nuovo massimo
        const ms = memberStats(st, this.sub.id);
        const p = st.party[this.sub.id];
        if (p) p.hp = Math.min(p.hp, ms.maxHp);
        this.ctx.audio.chime(1175, 0.06);
        this.msg = `${PARTY[this.sub.id].short}: ${GEAR[o.gid].name}.`;
      }
    } else if (this.tab === 2) {
      const items = Object.keys(ITEMS).filter((id) => st.items[id]);
      if (!this.sub) {
        const it = items[this.sel];
        if (!it) return;
        this.sub = { item: it };
        this.sel = 0;
      } else {
        const id = st.members[this.sel];
        const it = this.sub.item;
        const ms = memberStats(st, id);
        const p = (st.party[id] ??= { hp: ms.maxHp, mp: ms.maxMp });
        let ok = false;
        if ((it === 'pozione' || it === 'superpozione') && p.hp > 0 && p.hp < ms.maxHp) {
          p.hp = Math.min(ms.maxHp, p.hp + (it === 'pozione' ? 250 : 800));
          ok = true;
        } else if (it === 'etere' && p.mp < ms.maxMp) {
          p.mp = Math.min(ms.maxMp, p.mp + 40);
          ok = true;
        } else if (it === 'fenice' && p.hp <= 0) {
          p.hp = Math.round(ms.maxHp * 0.3);
          ok = true;
        }
        if (!ok) {
          this.ctx.audio.thud(0.1);
          this.msg = 'Non serve.';
        } else {
          st.items[it]--;
          this.ctx.audio.chime(1175, 0.06);
          this.msg = `${ITEMS[it].name} a ${PARTY[id].short}.`;
          if (!st.items[it]) {
            this.sub = null;
            this.sel = 0;
          }
        }
      }
    }
    this.render();
  }

  update(dt) {
    if (!this.open) return;
    this.t += dt;
    if (this.t < 0.2) return;
    const k = nav(this.ctx.input);
    const st = this.state;
    let n = 1;
    if (this.tab === 1) n = this.sub ? this.gearOptions(this.sub.id).length : st.members.length;
    if (this.tab === 2) n = this.sub ? st.members.length : Object.keys(ITEMS).filter((id) => st.items[id]).length;
    if ((k.left || k.right) && !this.sub) {
      this.tab = (this.tab + (k.right ? 1 : 3)) % 4;
      this.sel = 0;
      this.msg = '';
      this.render();
    }
    if (k.up && n) {
      this.sel = (this.sel + n - 1) % n;
      this.render();
    }
    if (k.down && n) {
      this.sel = (this.sel + 1) % n;
      this.render();
    }
    if (k.ok) this.confirm();
    if (k.back || this.ctx.input.wasPressed('KeyG')) {
      if (this.sub) {
        this.sub = null;
        this.sel = 0;
        this.render();
      } else this.close();
    }
  }

  close() {
    this.open = false;
    this.el.remove();
    this.onClose?.();
  }
}
