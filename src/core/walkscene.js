import * as THREE from 'three';
import { clamp } from './noise.js';
import { Character } from '../dreams/hotel/character.js';
import { GnomeFollowers } from '../dreams/hotel/companions.js';

export const FRIEND = 'Il tuo amico:';

// La base delle scene "a piedi" su un solo livello (l'aeroporto, la spiaggia...):
// tu e il tuo amico, gli gnomi che vi seguono, ostacoli rettangolari, una camera
// in terza persona che non entra nei muri, e un suggerimento <kbd>E</kbd> per le cose da fare.
// Le scene figlie scrivono groundAt(), ceilingAt(), interaction(), tick(), exitCheck().
export class WalkScene {
  constructor(ctx, { background = '#000', far = 600, bounds = null, speed = 5 } = {}) {
    this.ctx = ctx;
    this.hs = ctx.progress.hotel || {};
    this.day = this.hs.timeOfDay === 'day';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, far);
    this.bounds = bounds;
    this.baseSpeed = speed;
    this.colliders = [];
    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e', model: 'longsleeve' });
    if (this.hs.activeEntity === 'gnomi' && this.hs.entities?.gnomi) {
      this.followers = new GnomeFollowers(this.scene, this.hs.entities.gnomi);
      this.followers.ground = (x, z) => this.groundAt(x, z);
    }
    this.camYaw = 0;
    this.camPitch = 0.2;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.tmpV = new THREE.Vector3();
    this.time = 0;
    this.lineTimer = 0;
    this.flags = {};
    this.script = [];
    this.cine = null;
    this.onCanvasClick = () => !this.busy() && ctx.input.lock();
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);
    const { ui, audio } = ctx;
    ui.showHud(true);
    ui.calm(true);
    ui.crosshair(false);
    ui.steam(false);
    ui.compass(null);
    audio.ambience(null);
    audio.stopAllPads(1);
    audio.stopLoops();
    audio.engineStop();
    ui.configureHud({
      unit: '',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Calma',
      controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>Spazio</kbd> salta',
    });
  }

  // posiziona te e il tuo amico (yaw: dove guardate)
  place(x, z, yaw) {
    const sx = Math.cos(yaw) * 1.5;
    const sz = -Math.sin(yaw) * 1.5;
    this.player.pos.set(x, this.groundAt(x, z), z);
    this.player.facing = yaw;
    this.friend.pos.set(x + sx, this.groundAt(x + sx, z + sz), z + sz);
    this.friend.facing = yaw;
    this.camYaw = yaw;
    if (this.followers) this.followers.placed = false;
    this.updateCamera(1, true);
  }

  // ---------- da ridefinire nelle scene ----------
  groundAt() {
    return 0;
  }

  ceilingAt() {
    return Infinity;
  }

  interaction() {
    return null;
  }

  tick() {}

  exitCheck() {
    return false;
  }

  busy() {
    return false;
  }

  // ---------- utilità ----------
  later(dt, fn) {
    this.script.push({ at: this.time + dt, fn });
    this.script.sort((a, b) => a.at - b.at);
  }

  leave(go) {
    if (this.leaving) return;
    this.leaving = true;
    this.ctx.ui.hint(null);
    this.ctx.audio.thud(0.15);
    this.save?.();
    go();
  }

  // ---------- ciclo ----------
  update(dt) {
    const { input, audio } = this.ctx;
    this.time += dt;
    this.lineTimer -= dt;
    if (input.wasPressed('KeyN')) audio.toggleMute();
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();
    const busy = this.busy();
    if (this.cine) this.updateCine(dt);
    else if (!busy && !this.leaving) this.updateFoot(dt);
    else this.player.animate(dt, 0);
    if (!this.cine) this.updateFriend(dt);
    if (this.followers && !this.cine) this.followers.update(dt, this.time, this.player, (x, z) => this.blockedAt(x, z), 'follow', null);
    this.tick(dt);
  }

  // una piccola scena di camera (cam e look: Vector3; dur: secondi; onEnd)
  startCine(c) {
    this.cine = { t: 0, ...c };
    this.ctx.ui.hint(null);
  }

  updateCine(dt) {
    const c = this.cine;
    c.t += dt;
    c.update?.(dt, c);
    const k = 1 - Math.exp(-2.2 * dt);
    this.camPos.lerp(c.cam, k);
    this.camLook.lerp(c.look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.player.animate(dt, 0);
    if (c.t >= c.dur) {
      this.cine = null;
      c.onEnd?.();
    }
  }

  blockedAt(x, z) {
    const b = this.bounds;
    if (b && (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ)) return true;
    for (const c of this.colliders) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    return false;
  }

  boxesNear(p, r) {
    return this.colliders.filter((b) => p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r);
  }

  walk(ch, dt) {
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    ch.pos.x += ch.vel.x * dt;
    ch.pos.z += ch.vel.z * dt;
    ch.collide(this.boxesNear(ch.pos, 2));
    const b = this.bounds;
    if (b) {
      ch.pos.x = clamp(ch.pos.x, b.minX + 0.45, b.maxX - 0.45);
      ch.pos.z = clamp(ch.pos.z, b.minZ + 0.45, b.maxZ - 0.45);
    }
    // un gradino troppo alto non si sale
    if (this.groundAt(ch.pos.x, ch.pos.z) - ch.pos.y > 0.6) {
      ch.pos.x = ox;
      ch.pos.z = oz;
    }
    const ground = this.groundAt(ch.pos.x, ch.pos.z);
    ch.vel.y = (ch.vel.y || 0) - 22 * dt;
    ch.pos.y += ch.vel.y * dt;
    if (ch.pos.y <= ground) {
      ch.pos.y = ground;
      ch.vel.y = 0;
      ch.grounded = true;
    } else if (ch.pos.y - ground < 0.6 && ch.vel.y <= 0 && ch.grounded) {
      ch.pos.y = ground;
      ch.vel.y = 0;
    } else ch.grounded = false;
  }

  // spinta in più (i tapis roulant dell'aeroporto)
  push() {
    return null;
  }

  updateFoot(dt) {
    const { input, ui, audio } = this.ctx;
    const p = this.player;
    if (input.locked) {
      this.camYaw -= input.mouseDX * 0.0025;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.002, -0.3, 1.1);
    }
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.2;
    const f = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
    const s = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    let mx = fx * f + fz * s;
    let mz = fz * f - fx * s;
    const l = Math.hypot(mx, mz);
    if (l > 0) {
      mx /= l;
      mz /= l;
    }
    const speed = input.down('ShiftLeft', 'ShiftRight') ? this.baseSpeed * 1.7 : this.baseSpeed;
    const k = 1 - Math.exp(-12 * dt);
    p.vel.x += (mx * speed - p.vel.x) * k;
    p.vel.z += (mz * speed - p.vel.z) * k;
    if (mx || mz) {
      let d = Math.atan2(mx, mz) - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-14 * dt));
    }
    if (input.wasPressed('Space') && p.grounded) {
      p.vel.y = 7;
      p.grounded = false;
      audio.whoosh(0.1);
    }
    const extra = this.push(p.pos);
    if (extra) {
      p.pos.x += extra.x * dt;
      p.pos.z += extra.z * dt;
    }
    this.walk(p, dt);
    p.animate(dt, Math.hypot(p.vel.x, p.vel.z));
    if (this.exitCheck(mx, mz)) return;
    const it = this.interaction(p.pos);
    ui.hint(it ? `<kbd>E</kbd> ${it.label}` : null);
    if (it && input.wasPressed('KeyE')) it.fn();
    this.updateCamera(dt);
  }

  updateFriend(dt) {
    const fr = this.friend;
    if (fr.sitting) {
      fr.animate(dt, 0);
      return;
    }
    const p = this.player;
    const fx = Math.sin(p.facing);
    const fz = Math.cos(p.facing);
    const tx = p.pos.x - fx * 1.2 + fz * 1.4;
    const tz = p.pos.z - fz * 1.2 - fx * 1.4;
    const dx = tx - fr.pos.x;
    const dz = tz - fr.pos.z;
    const d = Math.hypot(dx, dz);
    this.apartT = d > 16 || Math.abs(fr.pos.y - p.pos.y) > 2.5 ? (this.apartT || 0) + dt : 0;
    if (this.apartT > 2) {
      this.apartT = 0;
      fr.pos.set(p.pos.x - fx * 1.2, p.pos.y, p.pos.z - fz * 1.2);
      fr.vel.set(0, 0, 0);
    }
    const want = d > 0.7 ? Math.min(8.5, d * 2.2) : 0;
    const k = 1 - Math.exp(-8 * dt);
    fr.vel.x += ((d > 0.01 ? dx / d : 0) * want - fr.vel.x) * k;
    fr.vel.z += ((d > 0.01 ? dz / d : 0) * want - fr.vel.z) * k;
    const extra = this.push(fr.pos);
    if (extra) {
      fr.pos.x += extra.x * dt;
      fr.pos.z += extra.z * dt;
    }
    this.walk(fr, dt);
    const hs = Math.hypot(fr.vel.x, fr.vel.z);
    if (hs > 0.4) {
      let a = Math.atan2(fr.vel.x, fr.vel.z) - fr.facing;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      fr.facing += a * (1 - Math.exp(-10 * dt));
    }
    fr.animate(dt, hs);
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    const head = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const dist = 4.8;
    const dx = -Math.sin(this.camYaw) * Math.cos(this.camPitch);
    const dz = -Math.cos(this.camYaw) * Math.cos(this.camPitch);
    const dy = Math.sin(this.camPitch);
    const boxes = this.boxesNear(head, dist + 1);
    const b = this.bounds;
    let reach = dist;
    for (let s = 0.3; s <= dist; s += 0.2) {
      const x = head.x + dx * s;
      const z = head.z + dz * s;
      const out = b && (x < b.minX + 0.3 || x > b.maxX - 0.3 || z < b.minZ + 0.3 || z > b.maxZ - 0.3);
      if (out || boxes.some((q) => !q.low && x > q.minX - 0.2 && x < q.maxX + 0.2 && z > q.minZ - 0.2 && z < q.maxZ + 0.2)) {
        reach = Math.max(0.35, s - 0.25);
        break;
      }
    }
    const tx = head.x + dx * reach;
    const tz = head.z + dz * reach;
    const ty = clamp(head.y + dy * reach, Math.max(p.pos.y + 0.4, this.groundAt(tx, tz) + 0.4), this.ceilingAt(tx, tz) - 0.4);
    const k = snap || reach < dist - 0.1 ? 1 : 1 - Math.exp(-10 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.copy(head);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov += (64 - this.camera.fov) * (snap ? 1 : 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  onResize() {}

  dispose() {
    const { ui, audio, input } = this.ctx;
    this.ctx.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    input.unlock();
    audio.stopLoops();
    audio.stopAllPads(1);
    ui.hint(null);
    ui.center(null);
    ui.clearSubtitle();
    ui.objective('');
    this.player.dispose();
    this.friend.dispose();
    this.followers?.dispose();
  }
}
