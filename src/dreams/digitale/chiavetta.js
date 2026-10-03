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
  return d;
}

export function xpToNext(level) {
  return Math.round(80 * Math.pow(level, 1.35));
}

// Le statistiche in combattimento, dal livello e dalle abilità.
export function heroStats(hero) {
  const s = hero.skills;
  const L = hero.level;
  return {
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
