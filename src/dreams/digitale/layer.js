import { buildTerminal, buildInvasion } from './world.js';
import { TerminalScreen, TERMINALS, terminalsCleared } from './terminal.js';

const FRIEND = 'Il tuo amico:';

// Lo strato "digitale" di una scena: i terminali del luogo, le entità che
// galleggiano, lo schermo della chiavetta. Lo usano l'esterno e il centro.
export class DigitalLayer {
  // places: [{ id, x, y, z, yaw }]; points: posizioni delle entità sparse (o null)
  constructor(scene, ctx, places, points = null) {
    this.ctx = ctx;
    this.screen = new TerminalScreen();
    this.terms = places.map((pl) => ({ ...pl, def: TERMINALS[pl.id], obj: buildTerminal(scene, pl) }));
    this.invasion = points ? buildInvasion(scene, points) : null;
    this.colliders = this.terms.map((t) => t.obj.collider);
    this.refresh();
  }

  get data() {
    return this.ctx.progress.digitale || {};
  }

  refresh() {
    const done = this.data.terminals || {};
    for (const t of this.terms) t.obj.setCleared(!!done[t.id]?.cleared);
    this.invasion?.setAmount(1 - terminalsCleared(this.ctx.progress) / Object.keys(TERMINALS).length);
  }

  get open() {
    return this.screen.open;
  }

  // il terminale davanti al quale sei (se c'è)
  near(pos, r = 1.8) {
    return this.terms.find((t) => Math.hypot(t.obj.spot.x - pos.x, t.obj.spot.z - pos.z) < r && Math.abs(t.obj.spot.y - pos.y) < 2);
  }

  // la prima volta che ti avvicini a un terminale: scopri di avere la chiavetta
  discover(pos, later) {
    const d = (this.ctx.progress.digitale ??= {});
    if (d.found) return;
    if (!this.terms.some((t) => Math.hypot(t.x - pos.x, t.z - pos.z) < 22)) return;
    d.found = true;
    this.ctx.saveProgress(this.ctx.progress);
    const { ui } = this.ctx;
    later(0.3, () => ui.subtitle(FRIEND, 'Quelle cose che galleggiano... sono pixel. Vivi. E quello è un terminale?', 3.8));
    later(4.6, () => ui.subtitle(null, 'Infili la mano in tasca: c\'è una chiavetta USB. Ce l\'hai sempre avuta. Dentro, qualcuno aspetta.', 4.8));
  }

  connect(t, onDone) {
    const { ui } = this.ctx;
    this.screen.start(t.def, this.ctx, (sum) => {
      this.refresh();
      if (sum.firstClear) {
        const left = Object.keys(TERMINALS).length - terminalsCleared(this.ctx.progress);
        ui.popup(`Terminale liberato: ${t.def.name}`);
        ui.subtitle(FRIEND, left ? 'Guarda: si dissolvono! Ne restano altri, in giro.' : 'Era l\'ultimo. Il mondo è... pulito. Per ora.', 3.6);
      }
      onDone?.(sum);
    });
  }

  update(dt, t, input) {
    for (const term of this.terms) term.obj.update(t, dt);
    this.invasion?.update(t, dt);
    if (this.screen.open) this.screen.update(dt, input);
  }

  dispose() {
    this.screen.dispose();
    this.terms.forEach((t) => t.obj.dispose());
    this.invasion?.dispose();
  }
}
