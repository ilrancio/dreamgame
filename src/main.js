import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './core/ui.js';
import { loadProgress, saveProgress } from './core/progress.js';
import { DemonDream } from './dreams/demone/DemonDream.js';

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
};

let current = null;
let running = false;

// Un'unica esperienza continua: niente menu né livelli, si entra direttamente nel sogno.
async function start() {
  ui.center('<div class="dream-title"><h2>Dreamgame</h2><p>Chiudi gli occhi. Stai già guidando.</p></div>');
  await new Promise((r) => setTimeout(r, 1200));
  current = new DemonDream(ctx);
  onResize();
  await new Promise((r) => setTimeout(r, 1500));
  ui.center(null);
  running = true;
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
    if (running) current.update(dt);
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
  start();
});

// accesso da console per debug: __dreamgame.current
window.__dreamgame = { ctx, get current() { return current; } };
