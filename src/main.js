import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI, formatTime } from './core/ui.js';
import { loadProgress, saveProgress } from './core/progress.js';
import { DemonDream } from './dreams/demone/DemonDream.js';
import { HotelDream } from './dreams/hotel/HotelDream.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const ui = new UI();
const ctx = {
  renderer,
  input: new Input(renderer.domElement),
  audio: new AudioEngine(),
  ui,
  progress: loadProgress(),
  saveProgress,
  night: { stats: {} },
  nextChapter: (stats) => {
    Object.assign(ctx.night.stats, stats);
    goToChapter(chapterIndex + 1);
  },
  endNight: (stats) => endNight(stats),
};

// Una sola notte, un solo sogno: i capitoli si susseguono senza menu né caricamenti visibili.
const CHAPTERS = [
  { id: 'campo', create: (c) => new DemonDream(c), card: 'Chiudi gli occhi. Stai già guidando.', color: '#000' },
  { id: 'hotel', create: (c) => new HotelDream(c), card: null, color: '#ffe2b0' },
];

let current = null;
let running = false;
let chapterIndex = 0;
let summaryOpen = false;

async function goToChapter(i, first = false) {
  const ch = CHAPTERS[i];
  if (!ch) return;
  running = false;
  chapterIndex = i;
  if (!first) await ui.fade(1, 1400, ch.color);
  current?.dispose();
  current = null;
  if (ch.card) ui.center(`<div class="dream-title"><h2>Dreamgame</h2><p>${ch.card}</p></div>`);
  await new Promise((r) => setTimeout(r, ch.card ? 1200 : 100));
  current = ch.create(ctx);
  onResize();
  await new Promise((r) => setTimeout(r, ch.card ? 1500 : 400));
  ui.center(null);
  running = true;
  await ui.fade(0, 1600, ch.color);
}

function endNight(stats) {
  Object.assign(ctx.night.stats, stats);
  const s = ctx.night.stats;
  const total = (s.campo?.time || 0) + (s.hotel?.time || 0);
  const prev = ctx.progress.bestNight;
  const record = s.campo && s.hotel && (!prev || total < prev);
  if (record) {
    ctx.progress.bestNight = total;
    saveProgress(ctx.progress);
  }
  ui.showHud(false);
  ui.clearSubtitle();
  ui.fade(0.88, 2500, '#1a1206');
  setTimeout(() => {
    ui.center(`<div class="panel">
      <h2>…e poi ti sei svegliato.</h2>
      <p class="poem">Il demone è ancora fermo nel suo campo.<br/>L'hotel ha ancora mille stanze. Gli gnomi, chissà.</p>
      <div class="stats">
        <div><b>${s.campo ? s.campo.dodges : '–'}</b><span>Macigni schivati</span></div>
        <div><b>${s.hotel ? s.hotel.rooms : '–'}</b><span>Stanze scoperte</span></div>
        <div><b>${s.hotel ? s.hotel.gnomes.toLocaleString('it-IT') : '–'}</b><span>Gnomi respinti</span></div>
        <div><b>${formatTime(total)}</b><span>La notte${record ? ' · record' : ''}</span></div>
      </div>
      <p class="cta">Invio: sogna di nuovo</p>
    </div>`);
    summaryOpen = true;
  }, 2500);
}

async function restartNight() {
  summaryOpen = false;
  ui.center(null);
  ctx.night = { stats: {} };
  await ui.fade(1, 800);
  goToChapter(0);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (current) {
    current.camera.aspect = window.innerWidth / window.innerHeight;
    current.camera.updateProjectionMatrix();
    current.onResize?.();
  }
}
window.addEventListener('resize', onResize);

const timer = new THREE.Timer();
timer.connect(document);
function frame(t) {
  requestAnimationFrame(frame);
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  if (current) {
    if (running && !summaryOpen) current.update(dt);
    renderer.render(current.scene, current.camera);
  }
  if (summaryOpen && ctx.input.wasPressed('Enter', 'Space')) restartNight();
  ctx.input.endFrame();
}
requestAnimationFrame(frame);

// Schermata iniziale: il primo clic sblocca l'audio.
const title = document.getElementById('title');
title.addEventListener('click', () => {
  ctx.audio.init();
  title.style.opacity = '0';
  setTimeout(() => title.remove(), 800);
  // scorciatoia di sviluppo: #hotel parte dal secondo capitolo
  goToChapter(location.hash === '#hotel' ? 1 : 0, true);
});

// accesso da console per debug: __dreamgame.current
window.__dreamgame = { ctx, get current() { return current; } };
