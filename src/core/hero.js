// Chi sei nel sogno: dopo una certa doccia il protagonista cambia sesso, e
// resta così (anche nei capitoli dopo e alla prossima partita) finché un'altra
// doccia non lo riporta indietro.

const KEY = 'dreamgame.hero.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export const hero = { female: !!load().female };

export function setHeroFemale(on) {
  hero.female = !!on;
  try {
    localStorage.setItem(KEY, JSON.stringify({ female: hero.female }));
  } catch {
    // salvataggio non disponibile
  }
}
