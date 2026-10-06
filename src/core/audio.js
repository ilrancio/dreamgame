// Tutto il suono è sintetizzato con la Web Audio API: nessun file audio da caricare.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.pads = new Map();
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp);

    const len = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get ready() {
    return !!this.ctx;
  }

  toggleMute() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  noise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  // ---------- Motore ----------
  engineStart() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;
    const gain = c.createGain();
    gain.gain.value = 0;
    const g2 = c.createGain();
    g2.gain.value = 0.35;
    o1.connect(filter);
    o2.connect(g2).connect(filter);
    filter.connect(gain).connect(this.master);

    const wind = this.noise();
    const wf = c.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 900;
    wf.Q.value = 0.6;
    const wg = c.createGain();
    wg.gain.value = 0;
    wind.connect(wf).connect(wg).connect(this.master);

    o1.start();
    o2.start();
    wind.start();
    this.engine = { o1, o2, filter, gain, wind, wg, wf };
  }

  engineUpdate(speedNorm, throttle, turbo) {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    // finto cambio marce: il regime sale e ricade a ogni "marcia"
    const gears = 5;
    const g = Math.min(gears - 1, Math.floor(speedNorm * gears));
    const inGear = speedNorm * gears - g;
    const rpm = 0.35 + inGear * 0.65 + g * 0.06;
    const f = 38 + rpm * 95 + (turbo ? 25 : 0);
    e.o1.frequency.setTargetAtTime(f, t, 0.05);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    e.filter.frequency.setTargetAtTime(350 + rpm * 1400 + throttle * 600, t, 0.05);
    e.gain.gain.setTargetAtTime(0.05 + throttle * 0.07 + speedNorm * 0.03, t, 0.08);
    e.wg.gain.setTargetAtTime(Math.min(0.25, speedNorm * speedNorm * 0.3), t, 0.1);
    e.wf.frequency.setTargetAtTime(600 + speedNorm * 1200, t, 0.1);
  }

  engineStop() {
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    e.gain.gain.setTargetAtTime(0, t, 0.2);
    e.wg.gain.setTargetAtTime(0, t, 0.2);
    setTimeout(() => {
      e.o1.stop();
      e.o2.stop();
      e.wind.stop();
    }, 1200);
    this.engine = null;
  }

  // ---------- Effetti ----------
  boom(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 1.4);
    const g = c.createGain();
    g.gain.setValueAtTime(vol * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 1.7);

    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.9);
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 1.1);
  }

  thud(vol = 0.5) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.min(1, vol), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.4);
  }

  roar(vol = 0.8) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const dur = 2.8;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(52, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 11;
    const lfoG = c.createGain();
    lfoG.gain.value = 9;
    lfo.connect(lfoG).connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900, t + 0.6);
    f.frequency.linearRampToValueAtTime(200, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(this.master);

    const n = this.noise();
    const nf = c.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    nf.Q.value = 1.5;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.3);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(nf).connect(ng).connect(this.master);

    o.start(t);
    lfo.start(t);
    n.start(t);
    o.stop(t + dur);
    lfo.stop(t + dur);
    n.stop(t + dur);
  }

  whoosh(vol = 0.4) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.8);
  }

  chime(freq = 880, vol = 0.15) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    [1, 1.5].forEach((m, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * m;
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(vol, t + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.8);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.9);
    });
  }

  // Vocine degli gnomi: brevi squittii acuti.
  squeak(vol = 0.08) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = Math.random() < 0.5 ? 'square' : 'triangle';
    const f = 900 + Math.random() * 1400;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.6 : 0.6), t + 0.09);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.14);
  }

  pop(vol = 0.2) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }

  shot(vol = 0.35) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 0.18);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    const og = c.createGain();
    og.gain.setValueAtTime(vol * 0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }

  // Suoni continui (acqua, fuoco): si accendono e si spengono con dissolvenza.
  loop(name, on, { freq = 1200, q = 0.7, vol = 0.12, type = 'bandpass', crackle = false } = {}) {
    if (!this.ctx) return;
    this.loops ??= new Map();
    const cur = this.loops.get(name);
    const t = this.ctx.currentTime;
    if (on && !cur) {
      const n = this.noise();
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.8);
      n.connect(f).connect(g).connect(this.master);
      n.start(t);
      const entry = { n, g };
      if (crackle) {
        entry.timer = setInterval(() => {
          if (Math.random() < 0.5) this.thud(0.04 + Math.random() * 0.05);
        }, 180);
      }
      this.loops.set(name, entry);
    } else if (!on && cur) {
      this.loops.delete(name);
      cur.g.gain.cancelScheduledValues(t);
      cur.g.gain.setValueAtTime(cur.g.gain.value, t);
      cur.g.gain.linearRampToValueAtTime(0, t + 0.8);
      clearInterval(cur.timer);
      setTimeout(() => cur.n.stop(), 900);
    }
  }

  stopLoops() {
    if (!this.loops) return;
    [...this.loops.keys()].forEach((k) => this.loop(k, false));
  }

  pour() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1500, t + 2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    n.stop(t + 2.3);
  }

  bleep(vol = 0.03) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    const f = [523, 659, 784, 1047, 880, 988][Math.floor(Math.random() * 6)];
    o.frequency.setValueAtTime(f, t);
    o.frequency.setValueAtTime(f * (Math.random() < 0.5 ? 1.5 : 0.75), t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }

  ding(vol = 0.2) {
    this.chime(1175, vol);
    setTimeout(() => this.chime(880, vol * 0.8), 260);
  }

  // Musichetta da sala giochi: un arpeggio a onda quadra che gira in loop.
  chiptune(on, vol = 0.035) {
    if (!this.ctx) return;
    if (!on) {
      clearInterval(this.chipTimer);
      this.chipTimer = null;
      return;
    }
    if (this.chipTimer) return;
    const prog = [[220, 277, 330, 440], [196, 247, 294, 392], [175, 220, 262, 349], [196, 247, 294, 392]];
    let step = 0;
    this.chipTimer = setInterval(() => {
      const c = this.ctx;
      const t = c.currentTime;
      const chord = prog[Math.floor(step / 16) % prog.length];
      const f = chord[step % 4] * (step % 8 < 4 ? 1 : 2);
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.13);
      if (step % 4 === 0) {
        const b = c.createOscillator();
        b.type = 'triangle';
        b.frequency.value = chord[0] / 2;
        const bg = c.createGain();
        bg.gain.setValueAtTime(vol * 1.6, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        b.connect(bg).connect(this.master);
        b.start(t);
        b.stop(t + 0.32);
      }
      step++;
    }, 140);
  }

  // Campana di bronzo: parziali inarmoniche con una lunga coda che si spegne.
  bell(vol = 0.3, base = 196) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.4], [2, 0.35], [2.52, 0.2], [3.01, 0.12]].forEach(([m, a]) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * m;
      const g = c.createGain();
      const dur = 6 / Math.sqrt(m);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }

  // Natura all'aperto: uccellini di giorno, grilli di notte.
  ambience(kind) {
    clearInterval(this.ambTimer);
    this.ambTimer = null;
    if (!this.ctx || !kind) return;
    this.ambTimer = setInterval(() => {
      if (this.muted) return;
      if (kind === 'birds') {
        if (Math.random() < 0.3) this.chirp();
      } else if (Math.random() < 0.6) this.cricket();
    }, kind === 'birds' ? 320 : 380);
  }

  chirp(vol = 0.018) {
    const c = this.ctx;
    let t = c.currentTime;
    const f = 2600 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (1.2 + Math.random() * 0.4), t + 0.06);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.1);
      t += 0.09 + Math.random() * 0.05;
    }
  }

  // Un gabbiano lontano: un grido che scende
  gull(vol = 0.03) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) {
      const t = c.currentTime + k * 0.32;
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1500 + Math.random() * 300, t);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.28);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.32);
    }
  }

  // il volume di un suono continuo già acceso (la folla che si avvicina)
  loopVolume(name, vol) {
    const cur = this.loops?.get(name);
    if (!cur || !this.ctx) return;
    cur.g.gain.setTargetAtTime(Math.max(0.0001, vol), this.ctx.currentTime, 0.3);
  }

  // una voce lontana nella folla: una vocale che non si capisce
  babble(vol = 0.012, kid = false) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime;
    const dur = 0.12 + Math.random() * 0.35;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f0 = (kid ? 280 : 110) + Math.random() * (kid ? 160 : 120);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.4), t + dur);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500 + Math.random() * 1300;
    f.Q.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // il fischietto del bagnino
  whistle(vol = 0.05) {
    if (!this.ctx) return;
    const c = this.ctx;
    for (let k = 0; k < 2; k++) {
      const t = c.currentTime + k * 0.42;
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(2900, t);
      const lfo = c.createOscillator();
      lfo.frequency.value = 38;
      const lg = c.createGain();
      lg.gain.value = 120;
      lfo.connect(lg).connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.setValueAtTime(vol, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      o.connect(g).connect(this.master);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.36);
      lfo.stop(t + 0.36);
    }
  }

  cricket(vol = 0.01) {
    const c = this.ctx;
    const t0 = c.currentTime;
    const f = 4000 + Math.random() * 600;
    for (let k = 0; k < 3; k++) {
      const t = t0 + k * 0.05;
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 8;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
      o.connect(bp).connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.04);
    }
  }

  // ---------- Musica d'atmosfera ----------
  // Un pad è un accordo di oscillatori lenti; si attivano/spengono con dissolvenza.
  pad(name, freqs, { vol = 0.06, type = 'sine', cutoff = 1200, tremolo = 0 } = {}) {
    if (!this.ctx || this.pads.has(name)) return;
    const c = this.ctx;
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 3);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.connect(out).connect(this.master);
    const nodes = [];
    freqs.forEach((fr, i) => {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = fr;
        o.detune.value = det + i * 1.5;
        const g = c.createGain();
        g.gain.value = 1 / (freqs.length * 2);
        o.connect(g).connect(f);
        o.start(t);
        nodes.push(o);
      }
    });
    if (tremolo > 0) {
      const lfo = c.createOscillator();
      lfo.frequency.value = tremolo;
      const lg = c.createGain();
      lg.gain.value = vol * 0.6;
      lfo.connect(lg).connect(out.gain);
      lfo.start(t);
      nodes.push(lfo);
    }
    this.pads.set(name, { out, nodes });
  }

  stopPad(name, fade = 2.5) {
    const p = this.pads.get(name);
    if (!p) return;
    this.pads.delete(name);
    const t = this.ctx.currentTime;
    p.out.gain.cancelScheduledValues(t);
    p.out.gain.setValueAtTime(p.out.gain.value, t);
    p.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => p.nodes.forEach((n) => n.stop()), fade * 1000 + 100);
  }

  stopAllPads(fade = 1.5) {
    [...this.pads.keys()].forEach((k) => this.stopPad(k, fade));
  }
}
