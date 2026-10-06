import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { loadProgress, saveProgress } from './core/progress.js';
import { DemonDream } from './dreams/demone/DemonDream.js';
import { HotelDream } from './dreams/hotel/HotelDream.js';
import { OutdoorDream } from './dreams/esterno/OutdoorDream.js';
import { MallDream } from './dreams/centro/MallDream.js';
import { AirportDream } from './dreams/aeroporto/AirportDream.js';
import { BeachDream } from './dreams/spiaggia/BeachDream.js';
import { CoastDream } from './dreams/costa/CoastDream.js';
import { IslandDream } from './dreams/isola/IslandDream.js';
import { placeById } from './core/places.js';

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
  resumeHotel: false,
  nextChapter: () => {
    ctx.resumeHotel = false;
    goToChapter(chapterIndex + 1);
  },
  // dal portone dell'hotel si esce all'aperto, e si rientra: niente risveglio.
  // spawn dice dove si compare: 'hotel' (portone), 'borgo' (porta 1313), 'centro' (uscita del centro commerciale)
  goOutside: (spawn = 'hotel') => {
    ctx.spawn = spawn;
    goToChapter(2);
  },
  enterHotel: () => {
    ctx.resumeHotel = true;
    ctx.hotelEntry = 'door';
    goToChapter(1);
  },
  enterMall: (spawn = 'entrance') => {
    ctx.spawn = spawn;
    goToChapter(3);
  },
  // un capitolo qualunque, con il punto in cui si compare (l'aereo, la navetta...)
  goto: (id, spawn) => {
    ctx.spawn = spawn;
    goToChapter(CHAPTERS.findIndex((c) => c.id === id));
  },
  // le porte-scorciatoia: dalla suite a un macroluogo, e da lì alla suite
  travel: (dest) => {
    if (dest === 'suite') {
      ctx.resumeHotel = true;
      ctx.hotelEntry = 'shortcut';
      goToChapter(1);
      return;
    }
    const place = placeById(dest);
    if (!place) return;
    ctx.spawn = place.spawn;
    goToChapter(CHAPTERS.findIndex((c) => c.id === place.chapter));
  },
};

// Un solo sogno che non finisce: il campo è il prologo, poi si vive nell'hotel
// e nei macroluoghi intorno all'hotel (il borgo in vetta, il centro commerciale).
const CHAPTERS = [
  { id: 'campo', create: (c) => new DemonDream(c), card: 'Chiudi gli occhi. Stai già guidando.', color: '#000' },
  { id: 'hotel', create: (c) => new HotelDream(c), card: null, color: '#ffe2b0' },
  { id: 'esterno', create: (c) => new OutdoorDream(c), card: null, color: '#dfe8f4' },
  { id: 'centro', create: (c) => new MallDream(c), card: null, color: '#f4f2ee' },
  { id: 'aeroporto', create: (c) => new AirportDream(c), card: null, color: '#d8dce2' },
  { id: 'spiaggia', create: (c) => new BeachDream(c), card: null, color: '#c8ccd0' },
  { id: 'costa', create: (c) => new CoastDream(c), card: null, color: '#e8f2f8' },
  { id: 'isola', create: (c) => new IslandDream(c), card: null, color: '#e8f8ff' },
];

let current = null;
let running = false;
let chapterIndex = 0;

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
    if (running) current.update(dt);
    renderer.render(current.scene, current.camera);
  }
  ctx.input.endFrame();
}
requestAnimationFrame(frame);

// Schermata iniziale: il primo clic sblocca l'audio. Se il sogno è già
// cominciato un'altra volta, si può riprendere direttamente dall'hotel.
const title = document.getElementById('title');
const hasHotel = !!ctx.progress.hotel?.reached;
function begin(chapter) {
  ctx.audio.init();
  title.style.opacity = '0';
  title.style.pointerEvents = 'none';
  setTimeout(() => title.remove(), 800);
  goToChapter(chapter, true);
}
if (hasHotel) {
  document.getElementById('title-enter').classList.add('hidden');
  document.getElementById('title-actions').classList.remove('hidden');
  title.style.cursor = 'default';
  document.getElementById('btn-continue').addEventListener('click', () => {
    ctx.resumeHotel = true;
    begin(1);
  });
  document.getElementById('btn-restart').addEventListener('click', () => begin(0));
} else {
  title.addEventListener('click', () => {
    // scorciatoie di sviluppo: #hotel parte dall'arrivo in hotel, #esterno dal portone,
    // #centro dall'ingresso del centro commerciale
    begin({ '#hotel': 1, '#esterno': 2, '#centro': 3, '#aeroporto': 4, '#spiaggia': 5, '#costa': 6, '#isola': 7 }[location.hash] ?? 0);
  });
}

// accesso da console per debug: __dreamgame.current
window.__dreamgame = { ctx, get current() { return current; } };
