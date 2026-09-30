import { ARCADE_FLOOR } from './elevator.js';

const FRIEND = 'Il tuo amico:';

// Eventi del sogno: capitano quando vogliono, dove vogliono.
// Ogni evento dice se può accadere adesso (`when`) e cosa fa (`run`).
// I nuovi sogni ambientati nell'hotel possono aggiungersi qui.
export const EVENTS = [
  {
    id: 'blackout',
    when: (h) => h.floorNum !== ARCADE_FLOOR,
    run(h) {
      h.ctx.ui.subtitle(null, 'Le luci si abbassano. Tutto l\'hotel trattiene il respiro.', 3.5);
      h.dim = 1;
      h.ctx.audio.whoosh(0.2);
      h.later(2.5, () => h.ctx.ui.subtitle(FRIEND, '...chi ha spento?', 2));
      h.later(6, () => (h.dim = 0));
    },
  },
  {
    id: 'ascensore',
    when: () => true,
    run(h) {
      h.ctx.audio.ding(0.08);
      h.ctx.ui.subtitle(null, 'Da qualche parte un ascensore si apre. Non esce nessuno.', 3.5);
    },
  },
  {
    id: 'risatina',
    when: (h) => h.floorNum === 0,
    run(h) {
      for (let i = 0; i < 5; i++) h.later(i * 0.15, () => h.ctx.audio.squeak(0.05));
      h.ctx.ui.subtitle(null, 'Una risatina minuscola, dietro una porta.', 3);
      h.later(3, () => h.ctx.ui.subtitle(FRIEND, 'Hai sentito anche tu?', 2));
    },
  },
  {
    id: 'stiramento',
    when: () => true,
    run(h) {
      // lo spazio si allunga per un attimo
      h.stretch = 1;
      h.ctx.ui.subtitle(null, 'Per un attimo la stanza è più lunga di quanto dovrebbe.', 3.5);
      h.later(4, () => (h.stretch = 0));
    },
  },
  {
    id: 'musica',
    when: (h) => h.floorNum !== ARCADE_FLOOR,
    run(h) {
      h.ctx.audio.chiptune(true, 0.008);
      h.ctx.ui.subtitle(null, 'Da un piano molto più in alto arriva la musica di una sala giochi.', 4);
      h.later(4.5, () => h.ctx.ui.subtitle(FRIEND, 'Piano 88, credo. L\'ho visto sul pannello dell\'ascensore.', 3));
      h.later(9, () => h.ctx.audio.chiptune(false));
    },
  },
  {
    id: 'neve',
    when: (h) => h.floorNum !== ARCADE_FLOOR,
    run(h) {
      h.snow = 10;
      h.ctx.ui.subtitle(null, 'Comincia a nevicare. Dentro.', 3);
    },
  },
  {
    id: 'deja-vu',
    when: () => true,
    run(h) {
      h.ctx.ui.subtitle(FRIEND, 'Strano... questo corridoio l\'abbiamo già fatto. Ma era a un altro piano.', 3.5);
    },
  },
];

export class EventDirector {
  constructor(hotel) {
    this.h = hotel;
    this.timer = 70 + Math.random() * 60;
    this.last = null;
  }

  update(dt) {
    const h = this.h;
    if (h.phase !== 'explore' || h.activity || h.arcadeScreen?.open || h.elevatorPanel?.open) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 80 + Math.random() * 90;
    const options = EVENTS.filter((e) => e.id !== this.last && e.when(h));
    if (!options.length) return;
    const e = options[Math.floor(Math.random() * options.length)];
    this.last = e.id;
    e.run(h);
  }
}
