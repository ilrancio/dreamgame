// I dati del combattimento a turni nel silo: il gruppo, le abilità, gli
// oggetti, le creature e il dio che dorme.

export const ELEM = { fuoco: 'Fuoco', fulmine: 'Fulmine', gelo: 'Gelo' };

// Il gruppo: tu, il tuo amico, e Scintilla uscita dalla chiavetta
export const PARTY = {
  tu: { name: 'Tu', short: 'Tu', hp: 520, mp: 36, str: 18, mag: 8, def: 14, mdef: 8, agi: 10, color: '#6a9aff', menu: 'Abilità', skills: ['colpo', 'rompi', 'provoca'], od: 'mareggiata' },
  amico: { name: 'Il tuo amico', short: 'Amico', hp: 400, mp: 90, str: 11, mag: 19, def: 9, mdef: 15, agi: 9, color: '#ffc84a', menu: 'Magia', skills: ['fuoco', 'fulmine', 'gelo', 'cura', 'lentezza'], od: 'diluvio' },
  scintilla: { name: 'Scintilla', short: 'Scintilla', hp: 330, mp: 50, str: 14, mag: 14, def: 10, mdef: 11, agi: 14, color: '#5af0ff', menu: 'Programmi', skills: ['scanner', 'raffica', 'rapidita'], od: 'overclock' },
};

// rank: quanto pesa l'azione sul turno dopo (2 = torni prima, 4 = aspetti di più)
export const SKILLS = {
  colpo: { name: 'Colpo rapido', mp: 4, rank: 2, target: 'enemy', kind: 'phys', power: 0.75, desc: 'Un colpo veloce: torni in turno prima del solito.' },
  rompi: { name: 'Rompiguardia', mp: 8, rank: 3, target: 'enemy', kind: 'phys', power: 0.9, status: 'armorBreak', desc: 'Spacca la corazza: da adesso la sua difesa non conta più.' },
  provoca: { name: 'Provocazione', mp: 4, rank: 2, target: 'enemy', kind: 'status', status: 'provoked', desc: 'Lo fai arrabbiare: se la prenderà solo con te.' },
  fuoco: { name: 'Fuoco', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'fuoco', desc: 'Una fiammata su un nemico.' },
  fulmine: { name: 'Fulmine', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'fulmine', desc: 'Un fulmine dall\'alto. Qui fuori, di fulmini, ce ne sono tanti.' },
  gelo: { name: 'Gelo', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'gelo', desc: 'Schegge di ghiaccio su un nemico.' },
  cura: { name: 'Cura', mp: 8, rank: 3, target: 'ally', kind: 'heal', power: 1, desc: 'Rimette in sesto un compagno.' },
  lentezza: { name: 'Lentezza', mp: 10, rank: 3, target: 'enemy', kind: 'status', status: 'slow', desc: 'Il nemico agisce la metà delle volte, per un po\'.' },
  scanner: { name: 'Scanner', mp: 0, rank: 2, target: 'enemy', kind: 'scan', desc: 'Legge vita e punti deboli di un nemico.' },
  raffica: { name: 'Raffica', mp: 6, rank: 3, target: 'allEnemies', kind: 'mag', power: 0.55, desc: 'Colpi di energia su tutti i nemici.' },
  rapidita: { name: 'Rapidità', mp: 10, rank: 2, target: 'ally', kind: 'status', status: 'haste', desc: 'Un compagno agisce il doppio delle volte, per un po\'.' },
};

export const OVERDRIVES = {
  mareggiata: { name: 'Mareggiata', kind: 'phys', target: 'randomEnemies', hits: 5, power: 0.95, desc: 'Cinque colpi, come onde contro gli scogli.' },
  diluvio: { name: 'Diluvio', kind: 'mag', target: 'allEnemies', hits: 1, power: 2.4, desc: 'Tutta la tempesta su tutti i nemici.' },
  overclock: { name: 'Overclock', kind: 'phys', target: 'enemy', hits: 4, power: 1.15, desc: 'Quattro colpi a velocità impossibile.' },
};

export const ITEMS = {
  pozione: { name: 'Pozione', target: 'ally', desc: 'Ridà 250 punti vita a un compagno.' },
  etere: { name: 'Etere', target: 'ally', desc: 'Ridà 40 MP a un compagno.' },
  fenice: { name: 'Coda di fenice', target: 'koAlly', desc: 'Rimette in piedi un compagno caduto.' },
};

// Le creature del silo
export const ENEMIES = {
  granchio: { name: 'Granchio di Ruggine', model: 'crab', hp: 420, str: 16, mag: 6, def: 60, mdef: 6, agi: 6, weak: ['fulmine'], xp: 40, drop: 'pozione', acts: [['chela', 3], ['guscio', 1]], info: 'Corazzato: i colpi fisici rimbalzano. Rompiguardia, o un fulmine.' },
  medusa: { name: 'Medusa Temporalesca', model: 'jelly', hp: 260, str: 8, mag: 15, def: 10, mdef: 30, agi: 11, weak: ['fuoco'], absorb: ['fulmine'], xp: 36, drop: 'etere', acts: [['scossa', 3], ['velo', 1]], info: 'Si nutre di fulmini. Il fuoco la fa evaporare.' },
  anguilla: { name: 'Anguilla Abissale', model: 'eel', hp: 300, str: 17, mag: 8, def: 14, mdef: 12, agi: 17, weak: ['gelo'], resist: ['fuoco'], xp: 38, drop: 'pozione', acts: [['morso', 3], ['avvinghia', 1]], info: 'Velocissima. Il gelo la intorpidisce.' },
  fedele: { name: 'Fedele Annegato', model: 'devotee', hp: 340, str: 10, mag: 16, def: 16, mdef: 20, agi: 8, weak: ['fuoco'], xp: 44, drop: 'fenice', acts: [['preghiera', 2], ['salmodia', 3]], info: 'Prega per gli altri. Conviene farlo tacere per primo.' },
  dio: { name: 'Il Dio Sopito', model: 'whale', hp: 2600, str: 24, mag: 22, def: 30, mdef: 34, agi: 7, weak: [], xp: 400, boss: true, acts: [['codata', 3], ['onda', 2]], info: 'Ogni tanto canta: quando il conto arriva a zero, il Canto degli Abissi colpisce tutti. Difendetevi.' },
};

export const ENEMY_ACTS = {
  chela: { name: 'Chela', kind: 'phys', power: 1, target: 'one' },
  guscio: { name: 'Guscio', kind: 'self', status: 'shell', target: 'self' },
  scossa: { name: 'Scossa', kind: 'mag', power: 1, elem: 'fulmine', target: 'one', status: 'slow', chance: 0.3 },
  velo: { name: 'Velo d\'acqua', kind: 'healAlly', power: 130, target: 'ally' },
  morso: { name: 'Morso', kind: 'phys', power: 1.1, target: 'one' },
  avvinghia: { name: 'Avvinghia', kind: 'phys', power: 0.7, target: 'one', status: 'delay' },
  preghiera: { name: 'Preghiera', kind: 'healAll', power: 80, target: 'allies' },
  salmodia: { name: 'Salmodia', kind: 'mag', power: 0.95, target: 'one' },
  codata: { name: 'Codata', kind: 'phys', power: 1.35, target: 'one' },
  onda: { name: 'Onda nera', kind: 'mag', power: 0.7, target: 'all' },
  canto: { name: 'Canto degli Abissi', kind: 'mag', power: 1.7, target: 'all' },
  marea: { name: 'Marea', kind: 'mag', power: 1.05, target: 'all', status: 'delay' },
};

// I gruppi di creature che girano intorno alla statua (id, composizione, dove)
export const GROUPS = [
  { id: 'g1', foes: ['granchio', 'medusa'], angle: 0.4 },
  { id: 'g2', foes: ['anguilla', 'anguilla'], angle: 1.6 },
  { id: 'g3', foes: ['medusa', 'fedele', 'medusa'], angle: 2.7 },
  { id: 'g4', foes: ['granchio', 'anguilla', 'granchio'], angle: 3.9 },
  { id: 'g5', foes: ['fedele', 'granchio', 'fedele'], angle: 5.1 },
];

export const xpToNext = (level) => Math.round(90 * Math.pow(level, 1.4));
