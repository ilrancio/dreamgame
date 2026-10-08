// La chiavetta: un personaggio digitale che porti in tasca. Lo colleghi ai
// terminali per combattere le entità che hanno invaso il mondo; vincendo
// guadagna esperienza, sale di livello e prende punti abilità.

export const HERO_NAME = 'SCINTILLA';

export const SKILLS = [
  { id: 'forza', name: 'Forza', desc: 'Pugni e calci più forti. Al livello 2: terzo colpo della combo.', max: 5 },
  { id: 'raffica', name: 'Raffica', desc: 'Colpi di energia più forti e più rapidi. Al livello 3: colpo doppio.', max: 5 },
  { id: 'scudo', name: 'Scudo', desc: 'Più vita, e la parata assorbe di più.', max: 5 },
  { id: 'scatto', name: 'Scatto', desc: 'Sblocca lo scatto (Shift), poi più lungo e intoccabile.', max: 5 },
];

export function loadChiavetta(progress) {
  progress.digitale ??= {};
  const d = progress.digitale;
  d.hero ??= { level: 1, xp: 0, sp: 1, skills: { forza: 0, raffica: 0, scudo: 0, scatto: 0 } };
  d.terminals ??= {};
  d.kills ??= {};
  d.form ??= 'scintilla';
  d.modules ??= { owned: [], equipped: [] };
  // i moduli dei terminali già liberati (anche nei salvataggi di prima dei moduli)
  for (const m of MODULES) if (m.terminal && d.terminals[m.terminal]?.cleared && !d.modules.owned.includes(m.id)) d.modules.owned.push(m.id);
  return d;
}

// ---------- I moduli: piccoli programmi da montare nella chiavetta (due alla volta) ----------
// Si trovano liberando i terminali e resistendo nel Sovraccarico.
export const MODULES = [
  { id: 'vampiro', name: 'VAMPIRO', desc: 'Pugni e calci a segno ti ridanno un po\' di vita.', terminal: 'piazzale', how: 'libera il Piazzale dell\'hotel' },
  { id: 'magnete', name: 'MAGNETE', desc: 'I frammenti volano da te, e ne cadono di più.', terminal: 'borgo', how: 'libera la Piazza di Sant\'Onirio' },
  { id: 'specchio', name: 'SPECCHIO', desc: 'La parata perfetta dura il doppio, e respinge più forte.', terminal: 'parcheggio', how: 'libera il Parcheggio Orizzonte' },
  { id: 'perforante', name: 'PERFORANTE', desc: 'I colpi di energia attraversano le entità.', terminal: 'galleria', how: 'libera la Galleria Orizzonte' },
  { id: 'cache', name: 'CACHE', desc: 'Ogni combattimento comincia con l\'overclock già pieno.', terminal: 'aeroporto', how: 'libera l\'Atrio dell\'aeroporto' },
  { id: 'salvagente', name: 'SALVAGENTE', desc: 'Se nessuno ti colpisce per quattro secondi, la vita torna su piano piano.', terminal: 'costa', how: 'libera la Spiaggia Grande' },
  { id: 'eco', name: 'ECO', desc: 'L\'ultimo pugno della combo lancia anche un colpo di energia, gratis.', terminal: 'isola', how: 'libera il Villaggio dell\'Isola' },
  { id: 'turbo', name: 'OVERCLOCK+', desc: 'La barra dell\'overclock si riempie il doppio più in fretta.', wave: 8, how: 'resisti 8 ondate nel Sovraccarico' },
  { id: 'backup', name: 'BACKUP', desc: 'Una volta per combattimento, a vita zero torni con metà vita.', wave: 15, how: 'resisti 15 ondate nel Sovraccarico' },
];
export const MODULE_SLOTS = 2;

export function moduleById(id) {
  return MODULES.find((m) => m.id === id);
}

// dà un modulo; restituisce il modulo se è nuovo
export function grantModule(d, id) {
  if (d.modules.owned.includes(id)) return null;
  d.modules.owned.push(id);
  // se c'è un posto libero lo monta subito
  if (d.modules.equipped.length < MODULE_SLOTS) d.modules.equipped.push(id);
  return moduleById(id);
}

export function xpToNext(level) {
  return Math.round(80 * Math.pow(level, 1.35));
}

// Le statistiche in combattimento, dal livello e dalle abilità.
export function heroStats(hero, form = null) {
  const s = hero.skills;
  const L = hero.level;
  const st = {
    hp: 90 + L * 10 + s.scudo * 22,
    punch: 9 + L * 1.5 + s.forza * 4,
    kick: 15 + L * 2.2 + s.forza * 6,
    combo: s.forza >= 2 ? 3 : 2,
    shot: 7 + L * 1.2 + s.raffica * 3.5,
    shotCd: Math.max(0.12, 0.34 - s.raffica * 0.035),
    shotCost: 22,
    doubleShot: s.raffica >= 3,
    regen: 26 + s.raffica * 4,
    guard: 0.55 + s.scudo * 0.07,
    dash: s.scatto > 0,
    dashTime: 0.16 + s.scatto * 0.03,
    dashCd: Math.max(0.35, 0.9 - s.scatto * 0.1),
  };
  if (!form) return st;
  // la forma trasferita nella chiavetta cambia il corpo
  st.hp = Math.round(st.hp * form.hp);
  st.punch *= form.melee;
  st.kick *= form.melee;
  st.shot *= form.shot;
  st.shotCd *= form.shotCd || 1;
  st.guard = Math.min(0.92, st.guard + (form.guard || 0));
  if (form.freeDash) st.dash = true;
  return st;
}

// Aggiunge esperienza; restituisce quanti livelli ha preso.
export function addXp(hero, xp) {
  hero.xp += xp;
  let ups = 0;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    hero.sp += 2;
    ups++;
  }
  return ups;
}

// ---------- Le forme: le entità che si possono trasferire nella chiavetta ----------
// Livello e abilità sono della chiavetta; la forma cambia il corpo, e il modo
// di combattere. Si sbloccano raccogliendo i dati delle entità battute.
export const FORMS = [
  { id: 'scintilla', name: 'SCINTILLA', desc: 'Chi abitava la chiavetta da sempre. Equilibrata.', need: 0, w: 14, h: 28, hp: 1, melee: 1, shot: 1, speed: 1, jump: 1 },
  { id: 'glitch', name: 'GLITCH', desc: 'Velocissimo, morde da vicino. Scatto glitch sempre attivo.', need: 15, w: 16, h: 18, hp: 0.8, melee: 1.05, shot: 0.6, speed: 1.4, jump: 1, freeDash: true },
  { id: 'drone', name: 'DRONE', desc: 'Plana, fa il doppio salto e spara forte. Fragile da vicino.', need: 10, w: 18, h: 14, hp: 0.75, melee: 0.6, shot: 1.7, shotCd: 0.75, speed: 1, jump: 0.85, float: true, doubleJump: true },
  { id: 'firewall', name: 'FIREWALL', desc: 'Lento ed enorme. Davanti è quasi indistruttibile.', need: 5, w: 26, h: 40, hp: 1.7, melee: 1.35, shot: 0.5, speed: 0.7, jump: 0.8, armor: 0.45, guard: 0.15 },
  { id: 'bug', name: 'BUG', desc: 'Salta altissimo, doppio salto, calci in picchiata.', need: 1, w: 26, h: 24, hp: 1.05, melee: 1.15, shot: 0.8, speed: 1.2, jump: 1.3, doubleJump: true },
  { id: 'spam', name: 'SPAM', desc: 'Spara buste a ventaglio. Non smette mai di scrivere.', need: 1, w: 30, h: 32, hp: 1.1, melee: 0.85, shot: 0.8, speed: 0.95, jump: 0.95, spread: true },
  { id: 'kernel', name: 'KERNEL PANIC', desc: 'Lo scatto lo teletrasporta alle spalle del nemico più vicino.', need: 1, w: 22, h: 42, hp: 1.25, melee: 1.3, shot: 1.2, speed: 1.15, jump: 1.05, freeDash: true, teleport: true },
  { id: 'lag', name: 'LAG', desc: 'Lo scatto ferma il tempo: le entità e i loro colpi restano immobili per un attimo.', need: 1, w: 26, h: 38, hp: 1.15, melee: 1.1, shot: 1.1, speed: 1, jump: 1, freeDash: true, freeze: true },
  { id: 'phishing', name: 'PHISHING', desc: 'I colpi sono ami: agganciano le entità e le tirano verso di te.', need: 1, w: 32, h: 26, hp: 1.1, melee: 1.15, shot: 1.05, speed: 1.05, jump: 1, hookShots: true },
  { id: 'trojan', name: 'TROJAN', desc: 'Un cavallo di legno, pesante. I calci a terra mandano onde d\'urto.', need: 1, w: 40, h: 44, hp: 1.6, melee: 1.3, shot: 0.7, speed: 0.8, jump: 0.85, armor: 0.25, quake: true },
];

export function formById(id) {
  return FORMS.find((f) => f.id === id) || FORMS[0];
}

// Quanti dati di un'entità hai raccolto (vittorie contro di lei)
export function formData(d, id) {
  if (id === 'scintilla') return 1;
  return d.kills?.[id] || 0;
}

export function formUnlocked(d, id) {
  const f = formById(id);
  return formData(d, id) >= f.need;
}
