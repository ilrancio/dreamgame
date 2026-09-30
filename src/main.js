import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { loadProgress, saveProgress } from './core/progress.js';
import { Hub } from './hub/Hub.js';
import { DREAMS } from './dreams/index.js';

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
  goToHub: () => switchTo((c) => new Hub(c)),
  startDream: (id) => {
    const dream = DREAMS.find((d) => d.id === id);
    if (!dream) return;
    switchTo((c) => dream.create(c), dream);
  },
};

let current = null;
let switching = false;

async function switchTo(factory, dream = null) {
  if (switching) return;
  switching = true;
  await ui.fade(1, 900);
  current?.dispose();
  current = null;
  if (dream) {
    ui.center(`<div class="dream-title"><div class="num">Sogno ${dream.number}</div><h2>${dream.title}</h2><p>${dream.subtitle}</p></div>`);
  }
  // lascia al browser il tempo di mostrare il titolo prima di generare il mondo
  await new Promise((r) => setTimeout(r, dream ? 1200 : 50));
  current = factory(ctx);
  onResize();
  if (dream) {
    await new Promise((r) => setTimeout(r, 1500));
    ui.center(null);
  }
  switching = false;
  await ui.fade(0, 1200);
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
    if (!switching) current.update(dt);
    renderer.render(current.scene, current.camera);
  }
  ctx.input.endFrame();
}
requestAnimationFrame(frame);

// Schermata iniziale: il primo clic sblocca l'audio.
const title = document.getElementById('title');
title.addEventListener('click', () => {
  ctx.audio.init();
  title.style.opacity = '0';
  setTimeout(() => title.remove(), 800);
  // scorciatoia per lo sviluppo: ?dream=demone salta la stanza dei sogni
  const direct = new URLSearchParams(location.search).get('dream');
  if (direct && DREAMS.some((d) => d.id === direct)) ctx.startDream(direct);
  else ctx.goToHub();
});

// accesso da console per debug: __dreamgame.current
window.__dreamgame = { ctx, get current() { return current; } };
