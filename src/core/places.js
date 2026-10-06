// I macroluoghi: le grandi zone del mondo del sogno dove accadono gli eventi
// (il borgo in vetta, il centro commerciale, ...). La prima volta che ne visiti
// uno, nella suite 1313 si sblocca una porta-scorciatoia che porta lì, e lì
// compare una porta con il numero 1313 che riporta nella suite.
export const PLACES = [
  { id: 'borgo', name: 'Sant\'Onirio', sub: 'il borgo in vetta, 1913 m', chapter: 'esterno', spawn: 'borgo', color: '#7a3a2a' },
  { id: 'centro', name: 'Centro Commerciale Orizzonte', sub: 'due piani, quasi nessuno in giro', chapter: 'centro', spawn: 'shortcut', color: '#2a5a8a' },
  { id: 'aeroporto', name: 'Aeroporto', sub: 'giù nel campo, le partenze verso i sogni', chapter: 'aeroporto', spawn: 'shortcut', color: '#3a4a6a' },
  { id: 'costa', name: 'Spiaggia Grande', sub: 'in jeep lungo la costa, piena di gente', chapter: 'costa', spawn: 'shortcut', color: '#2a8ab0' },
  { id: 'isola', name: 'L\'Isola', sub: 'monete, pagine, un aereo e un gabbiano di ferro', chapter: 'isola', spawn: 'shortcut', color: '#2aa86a' },
  { id: 'spiaggia', name: 'Spiaggia d\'Inverno', sub: 'uno stabilimento fuori stagione', chapter: 'spiaggia', spawn: 'shortcut', color: '#6a8a8a' },
];

export function placeById(id) {
  return PLACES.find((p) => p.id === id);
}

export function unlockedPlaces(progress) {
  const u = progress.places || {};
  // il borgo visto prima che esistessero le porte conta lo stesso
  if (progress.esterno?.villageSeen) u.borgo = true;
  return PLACES.filter((p) => u[p.id]);
}

// Segna il macroluogo come visitato. Restituisce true solo la prima volta.
export function unlockPlace(ctx, id) {
  const p = ctx.progress;
  p.places ??= {};
  if (p.places[id]) return false;
  p.places[id] = true;
  ctx.saveProgress(p);
  return true;
}
