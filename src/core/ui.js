// Interfaccia HTML sopra il canvas: HUD, sottotitoli, dissolvenze, pannelli.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      objective: $('objective'),
      compass: $('compass'),
      compassArrow: document.querySelector('#compass .arrow'),
      time: $('hud-time'),
      dodges: $('hud-dodges'),
      speed: $('speed-value'),
      turbo: $('turbo-fill'),
      health: $('health-fill'),
      subtitle: $('subtitle'),
      popups: $('popups'),
      center: $('center'),
      hint: $('hint'),
      fade: $('fade'),
      title: $('title'),
    };
    this.subTimer = null;
  }

  fade(to, ms = 800, color = '#000') {
    const f = this.el.fade;
    f.style.background = color;
    f.style.transitionDuration = `${ms}ms`;
    // forza il reflow così la transizione parte anche se chiamata di seguito
    void f.offsetWidth;
    f.style.opacity = String(to);
    return new Promise((r) => setTimeout(r, ms));
  }

  showHud(v) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  objective(text) {
    this.el.objective.textContent = text || '';
  }

  updateHud({ speed, turbo, health, time, dodges }) {
    this.el.speed.textContent = Math.round(speed);
    this.el.turbo.style.width = `${Math.max(0, turbo) * 100}%`;
    this.el.health.style.width = `${Math.max(0, health) * 100}%`;
    this.el.time.textContent = formatTime(time);
    this.el.dodges.textContent = `Schivate ${dodges}`;
  }

  compass(angle) {
    if (angle === null) {
      this.el.compass.style.opacity = '0';
      return;
    }
    this.el.compass.style.opacity = '1';
    this.el.compassArrow.style.transform = `rotate(${angle}rad)`;
  }

  subtitle(who, text, dur = 3.5) {
    const s = this.el.subtitle;
    s.innerHTML = who
      ? `<span class="who">${who}</span>${text}`
      : `<span class="inner">${text}</span>`;
    s.classList.add('show');
    clearTimeout(this.subTimer);
    this.subTimer = setTimeout(() => s.classList.remove('show'), dur * 1000);
  }

  clearSubtitle() {
    clearTimeout(this.subTimer);
    this.el.subtitle.classList.remove('show');
  }

  popup(text, bad = false) {
    const d = document.createElement('div');
    d.className = 'popup' + (bad ? ' bad' : '');
    d.textContent = text;
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  center(html) {
    const c = this.el.center;
    if (!html) {
      c.classList.remove('show');
      return;
    }
    c.innerHTML = html;
    void c.offsetWidth;
    c.classList.add('show');
  }

  hint(text) {
    const h = this.el.hint;
    if (!text) {
      h.classList.remove('show');
      return;
    }
    h.innerHTML = text;
    h.classList.add('show');
  }
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
