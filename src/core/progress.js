// Salvataggio locale dei sogni completati e dei record.

const KEY = 'dreamgame.progress.v1';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // salvataggio non disponibile (navigazione privata ecc.)
  }
}
