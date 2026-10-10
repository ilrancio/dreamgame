import { ENTITIES } from '../dreams/hotel/companions.js';
import { PRIZES } from '../dreams/hotel/prizes.js';
import { TERMINALS } from '../dreams/digitale/terminal.js';
import { MODULES } from '../dreams/digitale/chiavetta.js';
import { FISH, SIDE, knownOverdrives, PARTY_ORDER } from '../dreams/silo/data.js';
import { PLANE_PRICE } from '../dreams/isola/world.js';

// Il diario dei sogni: un libro sul leggio della suite. Una pagina per ogni
// sogno, con quello che ci hai trovato e quello che manca (con un indizio).
// Si riempie da solo, leggendo i salvataggi di tutti i sogni.

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  #diary { position: fixed; inset: 0; z-index: 60; display: none; align-items: center; justify-content: center; background: rgba(10,6,2,0.55); }
  #diary.show { display: flex; }
  #diary .book { width: min(980px, 96vw); height: min(600px, 88vh); display: grid; grid-template-columns: 1fr 1fr; position: relative;
    background: linear-gradient(90deg, #e8dcc0 0%, #f4ead2 46%, #c8b894 50%, #f4ead2 54%, #e8dcc0 100%);
    border-radius: 6px 6px 10px 10px; box-shadow: 0 0 0 10px #5a2a1a, 0 0 0 12px #3a1a0e, 0 24px 60px rgba(0,0,0,0.6);
    font: 500 15px "Cormorant Garamond", Georgia, serif; color: #3a2a1a; }
  #diary .pg { padding: 30px 38px 46px; overflow: auto; }
  #diary h2 { font: 700 30px "Cormorant Garamond", serif; margin: 0 0 4px; color: #5a2a1a; }
  #diary .num { font: 600 13px Inter, sans-serif; letter-spacing: 0.15em; text-transform: uppercase; color: #8a6a4a; }
  #diary blockquote { margin: 14px 0; font-style: italic; font-size: 17px; line-height: 1.45; color: #4a3a2a; border-left: 3px solid #b89a6a; padding-left: 12px; }
  #diary .bar { height: 8px; background: rgba(90,42,26,0.15); border-radius: 4px; overflow: hidden; margin: 6px 0 12px; }
  #diary .bar i { display: block; height: 100%; background: linear-gradient(90deg, #8a5a2a, #c89a4a); }
  #diary ul { list-style: none; padding: 0; margin: 0; }
  #diary li { padding: 4px 0 4px 26px; position: relative; font-size: 16px; line-height: 1.3; border-bottom: 1px dashed rgba(90,60,30,0.18); }
  #diary li::before { content: '○'; position: absolute; left: 4px; color: #a08060; }
  #diary li.ok::before { content: '✓'; color: #2a6a3a; font-weight: 700; }
  #diary li small { display: block; font: 500 12px Inter, sans-serif; color: #8a7a6a; margin-top: 1px; }
  #diary li.ok small { display: none; }
  #diary .idx { display: grid; grid-template-columns: 1fr auto; gap: 2px 14px; font-size: 16px; }
  #diary .idx span.p { font: 600 13px Inter, sans-serif; color: #8a5a2a; }
  #diary .idx .lock { opacity: 0.4; }
  #diary .nav { position: absolute; bottom: 12px; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 34px; font: 600 12px Inter, sans-serif; color: #8a6a4a; }
  #diary .nav b { cursor: pointer; }
  `;
  document.head.appendChild(s);
}

const n = (v) => v || 0;
const item = (t, ok, hint) => ({ t, ok: !!ok, hint });
const count = (t, have, tot, hint) => ({ t: `${t}: ${Math.min(have, tot)} / ${tot}`, ok: have >= tot, hint });

// i capitoli del diario, ognuno legge il suo pezzo di salvataggio
function chapters(P) {
  const h = P.hotel || {};
  const g = P.gesti || {};
  const e = P.esterno || {};
  const c = P.centro || {};
  const d = P.digitale || {};
  const a = P.aeroporto || {};
  const co = P.costa || {};
  const sp = P.spiaggia || {};
  const is = P.isola || {};
  const s = P.silo || {};
  const pl = P.places || {};
  const vis = (h.visited || []).map(String);
  const floors = new Set(vis.map((k) => (k.includes(':') ? k.split(':')[0] : '0'))).size;
  const arcade = vis.some((k) => k.startsWith('88:'));
  const terms = Object.keys(TERMINALS).filter((id) => d.terminals?.[id]?.cleared).length;
  const sq = s.quests || { main: 0, side: {} };
  const ods = PARTY_ORDER.reduce((t, id) => t + (s.quests ? knownOverdrives(id, s).length : 0), 0);
  return [
    {
      id: 'demone',
      title: 'La fuga dal demone',
      seen: !!h.reached,
      quote: 'Guidavo a velocità folle in un campo d\'erba, evitando i macigni che lanciava un gigantesco demone. Poi la strada di montagna, e un hotel di legno dove passare la notte.',
      items: [item('Sei sfuggito al demone e hai trovato l\'hotel', h.reached, 'Corri fra le colline, verso la strada di montagna')],
    },
    {
      id: 'hotel',
      title: 'L\'hotel dalle mille stanze',
      seen: !!h.reached,
      quote: 'Un edificio colossale, tantissime stanze e tantissimi stili. Pernotto con un amico, e il giorno dopo mi attaccano migliaia di piccolissimi gnomi.',
      items: [
        item('Hai liberato la hall dagli gnomi', n(h.gnomesTotal) > 0, 'Al mattino, scendi nella hall con le pistole'),
        item('Hai trovato la porta di servizio della suite', h.serviceOpen, 'Una porta della suite dà dritta sulla hall'),
        count('Piani visitati con l\'ascensore', floors, 10, 'L\'ascensore porta a centinaia di piani'),
        count('Stanze scoperte', vis.length, 40, 'Ogni piano ha le sue stanze, ognuna col suo stile'),
        item('Hai preparato il caffè con la moka', g.moka != null, 'Nella credenza della suite c\'è una moka'),
        item('Hai preso un tè al tavolo', g.te != null, 'Il tavolo rotondo davanti alla finestra'),
        item('Ti sei fatto una doccia', g.doccia != null, 'Il bagno della suite'),
        count('Giorni passati nell\'hotel', n(h.dayNum), 5, 'Vai a letto, la sera'),
      ],
    },
    {
      id: 'giochi',
      title: 'La sala giochi',
      seen: arcade,
      quote: 'Un piano dell\'hotel: un\'immensa sala giochi. Semplicemente questo.',
      items: [
        item('Hai trovato il piano 88', arcade, 'Chiedi all\'ascensore il piano 88'),
        count('Premi vinti al banco', (h.prizes || []).length, PRIZES.length, 'I biglietti si vincono ai cabinati'),
        count('Creature nella vetrina', ENTITIES.filter((x) => h.entities?.[x.id]).length, ENTITIES.length, 'Le creature che batti si possono collezionare'),
      ],
    },
    {
      id: 'borgo',
      title: 'Il borgo in vetta',
      seen: !!(e.villageSeen || pl.borgo),
      quote: 'La strada che porta all\'hotel continua, e porta a un villaggio tipico italiano di montagna, sulla vetta.',
      items: [
        item('Sei arrivato a Sant\'Onirio', e.villageSeen, 'Segui la strada oltre l\'hotel, in salita'),
        item('Un caffè al bar della piazza', e.coffee, 'Il bar ha i tavolini fuori'),
        item('Hai guardato dal cannocchiale', e.scope, 'Al belvedere'),
        item('Hai suonato la campana', e.bell, 'Il campanile della chiesa'),
        item('Tre rintocchi puliti', n(g.campana) >= 2, 'Tira la corda al momento giusto'),
      ],
    },
    {
      id: 'centro',
      title: 'Il centro commerciale',
      seen: !!pl.centro,
      quote: 'Un colossale centro commerciale su due piani, quasi nessuno in giro. Un negozio di retrogames con un tubo catodico e un pouf, e un commesso che trasmetteva tranquillità.',
      items: [
        item('Hai trovato il negozio di retrogames', c.retro, 'Al piano terra, fra le vetrine'),
        item('Hai giocato al tubo catodico', c.played, 'Siediti sul pouf'),
        item('Ti sei sdraiato sul pouf', c.lay, 'Respira'),
        item('Sei salito al primo piano', c.upstairs, 'Le scale mobili'),
        item('Hai visto il murale delle entità', c.mural, 'In fondo alla galleria'),
      ],
    },
    {
      id: 'digitale',
      title: 'L\'invasione digitale',
      seen: !!d.hero,
      quote: 'Il mondo era invaso da entità digitali. Portavo una chiavetta con dentro un personaggio, la collegavo ai terminali e combattevo.',
      items: [
        count('Livello di Scintilla', n(d.hero?.level), 10, 'Ogni entità cancellata dà esperienza'),
        count('Terminali liberati', terms, Object.keys(TERMINALS).length, 'Ce ne sono all\'hotel, nel borgo, al centro, all\'aeroporto, sulla costa, sull\'isola e nel porto della tempesta'),
        count('Moduli trovati', (d.modules?.owned || []).length, MODULES.length, 'Si trovano liberando i terminali e resistendo nel Sovraccarico'),
      ],
    },
    {
      id: 'aeroporto',
      title: 'L\'aeroporto',
      seen: !!pl.aeroporto,
      quote: 'Un aeroporto che porta in altre zone, liminale come gli altri posti.',
      items: [
        item('Hai trovato l\'aeroporto', pl.aeroporto, 'Giù nel campo, oltre l\'hotel'),
        item('Hai preso un volo', a.flown, 'Al gate, con la carta d\'imbarco'),
      ],
    },
    {
      id: 'costa',
      title: 'La spiaggia grande',
      seen: !!pl.costa,
      quote: 'Una spiaggia affollatissima. Per arrivarci, una jeep e una strada sterrata lungo la costa.',
      items: [
        item('Sei arrivato alla spiaggia', co.beach, 'La strada sterrata, in jeep'),
        item('Ti sei sdraiato sull\'asciugamano', co.lain, 'Trova un buco libero fra la gente'),
      ],
    },
    {
      id: 'spiaggia',
      title: 'La spiaggia d\'inverno',
      seen: !!pl.spiaggia,
      quote: 'Uno stabilimento fuori stagione: ombrelloni chiusi, una piscina vuota, il mare grigio.',
      items: [
        item('Hai messo i piedi nell\'acqua gelida', sp.feet, 'Il bagnasciuga'),
        item('Ti sei seduto sul lettino', sp.sat, 'Uno è rimasto aperto'),
      ],
    },
    {
      id: 'isola',
      title: 'L\'isola',
      seen: !!pl.isola,
      quote: 'Un\'isola, e io in un collectathon: trovare la patente di volo, comprare un aeroplano e battere un boss aereo.',
      items: [
        count('Monete', (is.coins || []).length, PLANE_PRICE, 'Sparse per l\'isola, anche in alto'),
        count('Pagine della patente', (is.pages || []).length, 5, 'In cima alla montagna, sul faro, sull\'isolotto, alla gara, dal vecchio pilota'),
        item('Hai comprato l\'aeroplano', is.plane, 'All\'hangar, con le monete'),
        item('Hai battuto il Gabbiano di Ferro', is.boss, 'In volo'),
      ],
    },
    {
      id: 'silo',
      title: 'Il silo nella tempesta',
      seen: !!pl.silo,
      quote: 'Un\'isola di scogli nella tempesta, un silo di metallo con un molo verso il mare. Dentro, una statua di balena e un dio sopito da cacciare. Si combatteva a turni.',
      items: [
        count('La storia', sq.main, 7, 'Parla con Orsola, a Porto Grigio'),
        count('Missioni secondarie', Object.keys(SIDE).filter((k) => sq.side?.[k] === 'done').length, Object.keys(SIDE).length, 'Beppe, Ada, Gino, Nilo e Tobia hanno bisogno di una mano'),
        count('Overdrive imparati', ods, 9, 'Si imparano con la storia, le missioni e l\'Abisso'),
        count('Pesci nel taccuino', Object.keys(FISH).filter((f) => s.fishLog?.[f]).length, Object.keys(FISH).length, 'Marta presta la lenza: si pesca dove l\'acqua fa le bolle'),
        count('Piani dell\'Abisso', n(s.abyss?.best), 10, 'Sotto la statua, dopo il dio'),
        item('Il Sogno del Dio', s.abyss?.won?.includes(10), 'Nel decimo piano dell\'Abisso'),
      ],
    },
  ];
}

export class DreamDiary {
  constructor(ctx) {
    injectStyle();
    this.ctx = ctx;
    this.open = false;
    this.el = document.createElement('div');
    this.el.id = 'diary';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-prev]')) this.flip(-1);
      else if (ev.target.closest('[data-next]')) this.flip(1);
      else if (ev.target.closest('[data-close]')) this.close();
      else if (ev.target.closest('[data-go]')) {
        this.page = +ev.target.closest('[data-go]').dataset.go;
        this.render();
      }
    });
  }

  show(onClose) {
    this.onClose = onClose;
    this.ch = chapters(this.ctx.progress);
    this.page = 0;
    this.open = true;
    this.ctx.input.unlock();
    this.el.classList.add('show');
    this.ctx.audio.whoosh(0.12);
    this.render();
  }

  pct(c) {
    return c.items.filter((i) => i.ok).length / c.items.length;
  }

  render() {
    const C = this.ch;
    let left;
    let right;
    if (this.page === 0) {
      const tot = C.reduce((t, c) => t + (c.seen ? this.pct(c) : 0), 0) / C.length;
      left = `<div class="num">Diario dei sogni</div><h2>Quello che ho sognato</h2>
        <blockquote>Vorrei non svegliarmi mai dalle esperienze. Nei miei sogni, molto spesso, i posti in cui vado li vivo.</blockquote>
        <div>Completato: ${Math.round(tot * 100)}%</div><div class="bar"><i style="width:${tot * 100}%"></i></div>
        <p style="font-size:15px">Ogni sogno ha la sua pagina. Le righe con il cerchio vuoto sono cose che ancora non hai fatto: sotto c'è un indizio.</p>`;
      right = `<div class="idx">${C.map((c, i) => (c.seen ? `<span data-go="${i + 1}" style="cursor:pointer">${i + 1}. ${c.title}</span><span class="p">${Math.round(this.pct(c) * 100)}%</span>` : `<span class="lock">${i + 1}. ???</span><span class="p lock">—</span>`)).join('')}</div>`;
    } else {
      const c = C[this.page - 1];
      if (!c.seen) {
        left = `<div class="num">Sogno ${this.page}</div><h2>???</h2><blockquote>Questa pagina è ancora bianca. È un sogno che non hai ancora sognato.</blockquote>`;
        right = '';
      } else {
        const p = this.pct(c);
        left = `<div class="num">Sogno ${this.page}</div><h2>${c.title}</h2><blockquote>${c.quote}</blockquote><div>Completato: ${Math.round(p * 100)}%</div><div class="bar"><i style="width:${p * 100}%"></i></div>`;
        right = `<ul>${c.items.map((i) => `<li class="${i.ok ? 'ok' : ''}">${i.t}<small>${i.hint}</small></li>`).join('')}</ul>`;
      }
    }
    const last = this.ch.length;
    this.el.innerHTML = `<div class="book"><div class="pg">${left}</div><div class="pg">${right}</div>
      <div class="nav"><b data-prev style="visibility:${this.page > 0 ? 'visible' : 'hidden'}">◀ A</b><b data-close>Esc chiudi</b><b data-next style="visibility:${this.page < last ? 'visible' : 'hidden'}">D ▶</b></div></div>`;
  }

  flip(d) {
    const np = Math.max(0, Math.min(this.ch.length, this.page + d));
    if (np === this.page) return;
    this.page = np;
    this.ctx.audio.whoosh(0.06);
    this.render();
  }

  update(input) {
    if (!this.open) return;
    if (input.wasPressed('KeyA', 'ArrowLeft')) this.flip(-1);
    if (input.wasPressed('KeyD', 'ArrowRight')) this.flip(1);
    if (input.wasPressed('Escape', 'KeyQ', 'KeyE')) this.close();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.onClose?.();
  }

  dispose() {
    this.el.remove();
  }
}
