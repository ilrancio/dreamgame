import * as THREE from 'three';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { Character } from '../hotel/character.js';
import { ChoicePanel } from '../../core/choice.js';
import { unlockPlace } from '../../core/places.js';
import { buildAirport, buildCabin, HALL_Z, END_Z, BELTS, DEPARTURES, ACTIVE_GATE } from './airport.js';

const AGENT = 'L\'addetta al gate 4:';
const PA_LINES = [
  'Ultima chiamata per il volo per Altrove. Il volo non partirà, ma la chiamata è l\'ultima.',
  'Si prega di non lasciare i bagagli incustoditi. Né i pensieri.',
  'Il volo per Ieri è stato cancellato. Ci scusiamo per l\'inconveniente.',
  'Il passeggero in attesa dal 1999 è pregato di presentarsi al gate 2.',
  'Attenzione: il tapis roulant sta per terminare. Lo sta per terminare da molto tempo.',
  'Volo per la Spiaggia Grande: imbarco in corso al gate 4. In corso da sempre.',
  'Volo per la Spiaggia d\'Inverno: imbarco al gate 2. Si consiglia un maglione.',
  'Volo per l\'Isola della Tempesta, gate 5: si avvisano i passeggeri che a destinazione dorme un dio.',
];
const AGENT_LINES = [
  'Volo per la Spiaggia Grande, gate 4. È in imbarco da sempre. Laggiù è sempre agosto.',
  'Per la Spiaggia d\'Inverno è il gate 2. Lì non c\'è nessuno. Qui, invece, nessuno.',
  'Carta d\'imbarco? Non serve. Lei è già nella lista.',
  'Gli altri voli aspettano. Aspettano i vostri sogni, credo.',
];
const WAIT_LINES = [
  [FRIEND, 'Senti che silenzio. Solo l\'aria condizionata.'],
  [null, 'Fuori, nella nebbia, un aereo fermo. Non parte. Non arriva nessuno.'],
  [FRIEND, 'Negli aeroporti il tempo non passa. Si aspetta e basta.'],
  [null, 'Il tabellone gira le sue palette. Clac-clac-clac. Poi di nuovo silenzio.'],
  [FRIEND, 'Potremmo dormire qui. Nessuno ci direbbe niente.'],
];

// L'aeroporto vuoto: atrio, corridoio infinito, gate sulla nebbia. Da qui si
// parte per le zone dei sogni (per ora, una sola), e si torna con la navetta.
export class AirportDream extends WalkScene {
  constructor(ctx) {
    const day = ctx.progress.hotel?.timeOfDay === 'day';
    const bg = day ? '#c8ccd2' : '#141a26';
    super(ctx, { background: bg, far: 400, bounds: { minX: -30, maxX: 30, minZ: 0, maxZ: END_Z } });
    this.dreamId = 'aeroporto';
    this.saved = ctx.progress.aeroporto || {};
    this.scene.fog = new THREE.Fog(bg, 45, 170);
    this.scene.add(new THREE.HemisphereLight(day ? '#f4f6fa' : '#c0c8e0', '#8a8278', day ? 1.2 : 0.85), new THREE.AmbientLight('#ffffff', 0.25));
    this.port = buildAirport(this.scene);
    this.port.setDay(day);
    this.colliders = this.port.colliders;
    this.choice = new ChoicePanel();
    // l'invasione è arrivata anche qui: un terminale nell'atrio, accanto alle file dei check-in
    this.addTerminal('aeroporto', 14, 16, -Math.PI / 2, { spread: 12 });

    // l'unica persona dell'aeroporto: l'addetta al gate 4
    const g4 = this.port.gates[ACTIVE_GATE - 1];
    this.agent = new Character(this.scene, { skin: '#e0b8a0', hair: '#2a1a14', shirt: '#1a3a6a', pants: '#1a1a24', model: 'suit' });
    this.agent.pos.set(g4.desk.x + 1.3, 0, g4.desk.z);
    this.agent.facing = -Math.PI / 2;
    this.agent.animate(0, 0);
    this.agentIdx = 0;
    // la lucidatrice che gira da sola per il corridoio
    this.robot = new THREE.Group();
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.45, 16), new THREE.MeshStandardMaterial({ color: '#d8d8dc', metalness: 0.4 }));
    rb.position.y = 0.25;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#4aff8a' }));
    eye.position.set(0, 0.5, 0.3);
    this.robot.add(rb, eye);
    this.robot.position.set(7, 0, 60);
    this.robotDir = 1;
    this.scene.add(this.robot);
    // la cabina del volo, lontano da tutto
    this.cabin = buildCabin(this.scene, new THREE.Vector3(400, 0, 0));

    // si entra dalle porte, dalla porta verde 1313, o si arriva con la navetta
    this.spawn = ctx.spawn || 'entrata';
    ctx.spawn = null;
    if (this.spawn === 'shortcut') this.place(-20, 2, 0);
    else if (this.spawn === 'arrivi') this.place(20, 5, 0);
    else this.place(0, 2.4, 0);
    this.firstVisit = unlockPlace(ctx, 'aeroporto');
    this.paT = 25 + Math.random() * 15;

    const { ui, audio } = ctx;
    audio.pad('aeroporto', [174.6, 220, 261.6, 349.2], { vol: 0.022, cutoff: 900, tremolo: 0.15 });
    audio.loop('aria', true, { freq: 400, q: 0.3, vol: 0.03, type: 'lowpass' });
    this.updateObjective();
    if (this.spawn === 'arrivi') this.later(1.2, () => ui.subtitle(FRIEND, 'La navetta ci ha lasciati agli arrivi. Non c\'è nessuno nemmeno qui.', 3.4));
    else if (this.firstVisit) {
      this.later(1.4, () => ui.subtitle(FRIEND, 'Un aeroporto. Vuoto. Le luci accese per nessuno.', 3.2));
      this.later(5.5, () => ui.subtitle(FRIEND, 'Guarda il tabellone: ci sono posti che non esistono. E quattro voli stanno imbarcando.', 3.8));
      this.later(13, () => {
        ui.popup('Una nuova porta: Aeroporto');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'Anche qui c\'è una porta verde con il 1313. A sinistra dell\'ingresso.', 3.4);
      });
    }
  }

  save() {
    this.ctx.progress.aeroporto = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  updateObjective() {
    this.ctx.ui.objective(this.saved.flown ? 'Il tabellone aspetta i prossimi sogni.' : 'Voli in imbarco: gate 4 Spiaggia Grande, gate 3 Isola, gate 2 Spiaggia d\'Inverno, gate 5 Isola della Tempesta.');
  }

  ceilingAt(x, z) {
    return z < HALL_Z ? 14 : 5;
  }

  // i tapis roulant ti portano anche se stai fermo
  push(pos) {
    if (pos.y > 0.6) return null;
    for (const b of BELTS) if (pos.x > b.x0 && pos.x < b.x1 && pos.z > b.z0 && pos.z < b.z1) return { x: 0, z: b.dir * 2.6 };
    return null;
  }

  busy() {
    return this.choice.open || !!this.sit;
  }

  exitCheck(mx, mz) {
    const p = this.player.pos;
    if (p.z < 1.0 && Math.abs(p.x) < 3.6 && mz < -0.5) {
      this.leave(() => this.ctx.goOutside('aeroporto'));
      return true;
    }
    return false;
  }

  interaction(p) {
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r;
    const P = this.port;
    if (near(P.door13.spot, 1.6)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    if (p.z < 3.5 && Math.abs(p.x) < 4) return { label: 'esci: le porte si aprono da sole', fn: () => this.leave(() => this.ctx.goOutside('aeroporto')) };
    if (p.z < HALL_Z && near(P.board, 8)) return { label: 'leggi il tabellone delle partenze', fn: () => this.openBoard() };
    for (const g of P.gates) {
      if (near(g.desk, 2.2)) {
        if (g.active) return { label: `imbarcati: ${g.flight.dest}`, fn: () => this.board(g) };
        return { label: `il banco del gate ${g.n}`, fn: () => this.ctx.ui.subtitle(null, `Sul monitor del gate ${g.n}: IMBARCO CHIUSO. Da quanto, non si sa.`, 3.4) };
      }
      if (near(g.seats, 3.2)) return { label: 'siediti ad aspettare', fn: () => this.sitDown(g) };
    }
    if (near(P.vending, 1.8)) return { label: 'prendi qualcosa dal distributore', fn: () => this.vend() };
    if (near(this.agent.pos, 3)) return { label: 'parla con l\'addetta', fn: () => this.ctx.ui.subtitle(AGENT, AGENT_LINES[this.agentIdx++ % AGENT_LINES.length], 3.6) };
    return null;
  }

  openBoard() {
    this.ctx.input.unlock();
    this.choice.show({
      title: 'Partenze',
      note: 'Le destinazioni grigie aspettano un sogno. Quando lo sognerai, partiranno.',
      theme: 'doors',
      items: DEPARTURES.map((d) => (d.open ? { label: d.dest, sub: `gate ${d.gate} · ${d.status}`, value: d.gate, action: 'vai' } : { label: d.dest, sub: d.status, locked: true })),
      onPick: (gate) => {
        this.ctx.ui.subtitle(FRIEND, `Gate ${gate}. Lungo il corridoio, a destra. I tapis roulant ci portano.`, 3.4);
      },
    });
  }

  vend() {
    const { ui, audio } = this.ctx;
    audio.thud(0.2);
    setTimeout(() => audio.pop(0.12), 500);
    ui.popup(['Un succo alla pera', 'Un tè freddo al limone', 'Dei crackers'][Math.floor(Math.random() * 3)]);
    ui.subtitle(FRIEND, 'Sa di aeroporto. Non so spiegarlo.', 2.6);
  }

  // sedersi ad aspettare, davanti alla vetrata
  sitDown(g) {
    const p = this.player;
    this.sit = { g, t: 0, li: 0, lineT: 3 };
    p.vel.set(0, 0, 0);
    p.pos.set(g.seats.x + 0.05, 0.12, g.seats.z + 0.7);
    p.facing = Math.PI / 2;
    p.sitting = true;
    this.friend.pos.set(g.seats.x + 0.05, 0.12, g.seats.z - 0.7);
    this.friend.facing = Math.PI / 2;
    this.friend.sitting = true;
    this.ctx.ui.hint('<kbd>E</kbd> alzati');
  }

  standUp() {
    const g = this.sit.g;
    this.sit = null;
    this.player.sitting = false;
    this.friend.sitting = false;
    this.player.pos.x -= 1.2;
    this.friend.pos.x -= 1.2;
    this.ctx.ui.hint(null);
    this.camYaw = Math.PI / 2;
    this.updateCamera(1, true);
    void g;
  }

  // l'imbarco: il finger, la cabina, il volo
  board(g) {
    const { ui, audio } = this.ctx;
    if (this.boarding) return;
    this.boarding = true;
    ui.subtitle(AGENT, 'Buon viaggio. Il volo dura il tempo di un respiro.', 3);
    audio.chime(988, 0.08);
    this.startCine({
      cam: new THREE.Vector3(g.door.x - 6, 2.2, g.door.z - 3),
      look: new THREE.Vector3(g.door.x, 1.4, g.door.z),
      dur: 2.6,
      update: (dt, c) => {
        // tu e il tuo amico camminate verso il finger
        for (const [ch, off] of [[this.player, 0.6], [this.friend, -0.6]]) {
          const dx = g.door.x - ch.pos.x;
          const dz = g.door.z + off - ch.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.3) {
            ch.pos.x += (dx / d) * 3 * dt;
            ch.pos.z += (dz / d) * 3 * dt;
            ch.facing = Math.atan2(dx, dz);
          }
          ch.animate(dt, d > 0.3 ? 3 : 0);
        }
        void c;
      },
      onEnd: async () => {
        await ui.fade(1, 700, '#000');
        if (this.disposed) return;
        const C = this.cabin;
        this.player.pos.copy(C.seat);
        this.player.pos.y = 0.12;
        // seduti guardando avanti, come in aereo; solo la testa si gira verso l'oblò
        this.player.facing = Math.PI;
        this.player.sitting = true;
        this.player.head.rotation.y = 0.85;
        this.player.seatHeight = 0.62;
        this.friend.pos.copy(C.seat2);
        this.friend.pos.y = 0.12;
        this.friend.facing = Math.PI;
        this.friend.sitting = true;
        this.friend.head.rotation.y = 0.6;
        this.friend.seatHeight = 0.62;
        this.camPos.copy(C.cam);
        this.camLook.copy(C.look);
        audio.loop('volo', true, { freq: 180, q: 0.4, vol: 0.06, type: 'lowpass' });
        this.saved.flown = true;
        this.save();
        this.startCine({
          cam: C.cam,
          look: C.look,
          dur: 10,
          update: (dt, c) => {
            this.friend.animate(dt, 0);
            if (c.t > 1 && !c.l1) {
              c.l1 = true;
              ui.subtitle('Altoparlante:', 'Allacciate le cinture. Stiamo per atterrare. Siamo appena partiti.', 3.6);
            }
            if (c.t > 5 && !c.l2) {
              c.l2 = true;
              ui.subtitle(FRIEND, g.flight.sea, 3.2);
            }
          },
          onEnd: () => this.leave(() => this.ctx.goto(g.flight.chapter, 'arrivo')),
        });
        ui.fade(0, 900, '#000');
      },
    });
  }

  // quello che l'amico dice, camminando, in questo sogno
  chatter() {
    return [
      'Hai notato che nessuno chiama mai il nostro nome all\'altoparlante? Eppure ci aspettano.',
      'Il tabellone cambia da solo. Le destinazioni sono tutte posti che abbiamo sognato.',
      'Gli aeroporti di notte mi mettono un po\' di malinconia. Questo poi...',
    ];
  }

  tick(dt) {
    const { input, ui, audio } = this.ctx;
    this.port.update(this.time, dt);
    this.cabin.update(this.time, dt);
    if (this.choice.open) this.choice.handleKeys(input);
    // l'addetta respira, e guarda chi passa
    this.agent.animate(dt, 0);
    this.agent.body.position.y = Math.sin(this.time * 1.1) * 0.01;
    // la lucidatrice va e viene, piano
    const r = this.robot;
    r.position.z += this.robotDir * 0.8 * dt;
    if (r.position.z > END_Z - 8 || r.position.z < HALL_Z + 6) this.robotDir *= -1;
    r.rotation.y = this.robotDir > 0 ? 0 : Math.PI;
    const p = this.player.pos;
    audio.loop('lucidatrice', Math.hypot(p.x - r.position.x, p.z - r.position.z) < 8, { freq: 140, q: 2, vol: 0.03 });
    // seduti ad aspettare
    if (this.sit) {
      const s = this.sit;
      s.t += dt;
      this.player.animate(dt, 0);
      const cam = new THREE.Vector3(s.g.seats.x - 2.8, 1.8, s.g.seats.z - 2);
      const look = new THREE.Vector3(40, 3.5, s.g.seats.z + 2);
      this.camPos.lerp(cam, 1 - Math.exp(-2.5 * dt));
      this.camLook.lerp(look, 1 - Math.exp(-2.5 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      s.lineT -= dt;
      if (s.lineT <= 0) {
        s.lineT = 8 + Math.random() * 4;
        const [who, line] = WAIT_LINES[s.li++ % WAIT_LINES.length];
        ui.subtitle(who, line, 4.5);
      }
      if (s.t > 0.5 && input.wasPressed('KeyE', 'Escape', 'KeyW', 'KeyS')) this.standUp();
    }
    // l'altoparlante, a nessuno
    this.paT -= dt;
    if (this.paT <= 0 && !this.cine) {
      this.paT = 40 + Math.random() * 30;
      audio.ding(0.1);
      this.later(0.9, () => ui.subtitle('Altoparlante:', PA_LINES[Math.floor(Math.random() * PA_LINES.length)], 4.5));
    }
  }

  dispose() {
    this.disposed = true;
    super.dispose();
    this.choice.dispose();
    this.port.dispose();
    this.cabin.dispose();
    this.agent.dispose();
    this.robot.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}
