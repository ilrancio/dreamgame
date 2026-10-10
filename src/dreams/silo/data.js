// I dati della campagna dell'Isola della Tempesta: il gruppo, le abilità che
// si imparano dall'albero di ogni personaggio, l'equipaggiamento, gli oggetti, le creature
// di ogni zona, i boss, le missioni.

export const ELEM = { fuoco: 'Fuoco', fulmine: 'Fulmine', gelo: 'Gelo' };
export const MONEY = 'conchiglie';

// ---------- Il gruppo ----------
// le abilità si imparano dall'albero (TREES, più sotto); Marta si unisce durante la storia
export const PARTY = {
  tu: { name: 'Tu', short: 'Tu', hp: 540, mp: 36, str: 18, mag: 8, def: 14, mdef: 8, agi: 10, color: '#6a9aff', menu: 'Abilità', od: 'mareggiata', weapon: 'remo' },
  amico: { name: 'Il tuo amico', short: 'Amico', hp: 420, mp: 96, str: 11, mag: 19, def: 9, mdef: 15, agi: 9, color: '#ffc84a', menu: 'Magia', od: 'diluvio', weapon: 'ombrello' },
  marta: { name: 'Marta', short: 'Marta', hp: 480, mp: 44, str: 17, mag: 10, def: 12, mdef: 10, agi: 12, color: '#ff8a6a', menu: 'Mestiere', od: 'arpioni', weapon: 'arpione' },
};
export const PARTY_ORDER = ['tu', 'amico', 'marta'];

// rank: quanto pesa l'azione sul turno dopo (2 = torni prima, 4 = aspetti di più)
export const SKILLS = {
  colpo: { name: 'Colpo rapido', mp: 4, rank: 2, target: 'enemy', kind: 'phys', power: 0.75, desc: 'Un colpo veloce: torni in turno prima del solito.' },
  rompi: { name: 'Rompiguardia', mp: 8, rank: 3, target: 'enemy', kind: 'phys', power: 0.9, status: 'armorBreak', desc: 'Spacca la corazza: da adesso la sua difesa non conta più.' },
  provoca: { name: 'Provocazione', mp: 4, rank: 2, target: 'enemy', kind: 'status', status: 'provoked', desc: 'Lo fai arrabbiare: se la prenderà solo con te.' },
  vento: { name: 'Fendente del vento', mp: 12, rank: 3, target: 'allEnemies', kind: 'phys', power: 0.7, desc: 'Un colpo largo come una raffica: tutti i nemici.' },
  fuoco: { name: 'Fuoco', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'fuoco', desc: 'Una fiammata su un nemico.' },
  fulmine: { name: 'Fulmine', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'fulmine', desc: 'Un fulmine dall\'alto. Qui fuori, di fulmini, ce ne sono tanti.' },
  gelo: { name: 'Gelo', mp: 6, rank: 3, target: 'enemy', kind: 'mag', power: 1, elem: 'gelo', desc: 'Schegge di ghiaccio su un nemico.' },
  cura: { name: 'Cura', mp: 8, rank: 3, target: 'ally', kind: 'heal', power: 1, desc: 'Rimette in sesto un compagno.' },
  curatotale: { name: 'Cura totale', mp: 22, rank: 3, target: 'allAllies', kind: 'heal', power: 0.75, desc: 'Cura tutto il gruppo insieme.' },
  lentezza: { name: 'Lentezza', mp: 10, rank: 3, target: 'enemy', kind: 'status', status: 'slow', desc: 'Il nemico agisce la metà delle volte, per un po\'.' },
  scanner: { name: 'Osserva', mp: 0, rank: 2, target: 'enemy', kind: 'scan', desc: 'Studi il nemico: quanta vita gli resta, i suoi punti deboli.' },
  raffica: { name: 'Raffica', mp: 10, rank: 3, target: 'allEnemies', kind: 'mag', power: 0.55, desc: 'Raffiche di vento salato su tutti i nemici.' },
  rapidita: { name: 'Rapidità', mp: 10, rank: 2, target: 'ally', kind: 'status', status: 'haste', desc: 'Un compagno agisce il doppio delle volte, per un po\'.' },
  barriera: { name: 'Barriera', mp: 14, rank: 3, target: 'allAllies', kind: 'status', status: 'shield', desc: 'Un velo d\'acqua su tutti: la magia nemica fa molto meno male.' },
  arpione: { name: 'Arpione', mp: 6, rank: 3, target: 'enemy', kind: 'phys', power: 1.05, pierce: true, desc: 'Un colpo che passa attraverso qualunque corazza.' },
  rete: { name: 'Rete', mp: 12, rank: 3, target: 'allEnemies', kind: 'status', status: 'slow', desc: 'Una rete su tutti: i nemici rallentano.' },
  taglioonda: { name: 'Taglio dell\'onda', mp: 16, rank: 4, target: 'enemy', kind: 'phys', power: 1.9, desc: 'Un colpo solo, lento e enorme, come un\'onda che si rompe.' },
  sentinella: { name: 'Sentinella', mp: 8, rank: 2, target: 'allEnemies', kind: 'status', status: 'provoked', desc: 'Ti pianti davanti a tutti: i nemici se la prendono con te.' },
  tempesta: { name: 'Tempesta', mp: 24, rank: 4, target: 'allEnemies', kind: 'mag', power: 0.95, elem: 'fulmine', desc: 'Fulmini su tutti i nemici. La tempesta, per una volta, dalla vostra parte.' },
  doppio: { name: 'Doppio arpione', mp: 10, rank: 3, target: 'enemy', kind: 'phys', power: 0.62, hits: 2, pierce: true, desc: 'Due colpi di fila che passano ogni corazza.' },
  strattone: { name: 'Strattone', mp: 6, rank: 2, target: 'enemy', kind: 'phys', power: 0.6, status: 'delay', desc: 'Tiri la cima: il nemico perde l\'equilibrio e il turno slitta.' },
  fiocina: { name: 'Fiocina del capodoglio', mp: 18, rank: 4, target: 'enemy', kind: 'phys', power: 1.7, pierce: true, status: 'armorBreak', desc: 'Il colpo dei vecchi balenieri: trapassa e spacca la corazza.' },
  richiamo: { name: 'Richiamo del mare', mp: 10, rank: 2, target: 'allAllies', kind: 'status', status: 'might', desc: 'Un grido da pescatori: tutto il gruppo colpisce più forte.' },
};

export const OVERDRIVES = {
  mareggiata: { name: 'Mareggiata', kind: 'phys', target: 'randomEnemies', hits: 5, power: 0.95, desc: 'Cinque colpi, come onde contro gli scogli.' },
  diluvio: { name: 'Diluvio', kind: 'mag', target: 'allEnemies', hits: 1, power: 2.4, desc: 'Tutta la tempesta su tutti i nemici.' },
  overclock: { name: 'Overclock', kind: 'phys', target: 'enemy', hits: 4, power: 1.15, desc: 'Quattro colpi a velocità impossibile.' },
  arpioni: { name: 'Pioggia di arpioni', kind: 'phys', target: 'randomEnemies', hits: 6, power: 0.85, pierce: true, desc: 'Sei arpioni, ognuno dove capita.' },
  // quelli che si imparano andando avanti (how: come si sbloccano)
  colpodelfaro: { name: 'Colpo del faro', kind: 'phys', target: 'enemy', hits: 1, power: 3.6, pierce: true, status: 'armorBreak', desc: 'Un colpo solo, con tutta la luce del faro dietro: trapassa la corazza e la spacca.' },
  scogliera: { name: 'Scogliera', kind: 'status', target: 'allAllies', status: ['shield', 'might'], desc: 'Il gruppo diventa uno scoglio: barriera contro la magia e colpi più forti per tutti.' },
  arcobaleno: { name: 'Arcobaleno', kind: 'heal', target: 'allAllies', power: 2.2, status: 'haste', desc: 'Dopo la pioggia: cura tutto il gruppo e lo rende rapido.' },
  zeroassoluto: { name: 'Zero assoluto', kind: 'mag', target: 'enemy', hits: 1, power: 5.5, elem: 'gelo', desc: 'Il mare che gela in un istante, tutto su un nemico solo.' },
  retedimare: { name: 'Rete di Beppe', kind: 'phys', target: 'allEnemies', hits: 2, power: 0.8, status: 'slow', desc: 'La rete rattoppata coi fili di medusa: due colpi su tutti, e rallentano.' },
  balena: { name: 'Caccia alla balena', kind: 'phys', target: 'enemy', hits: 3, power: 1.6, pierce: true, desc: 'Tre arpioni nello stesso punto, come facevano i vecchi di Porto Grigio.' },
};

// ---------- Oggetti ----------
export const ITEMS = {
  pozione: { name: 'Pozione', target: 'ally', desc: 'Ridà 250 punti vita a un compagno.', price: 30 },
  superpozione: { name: 'Granpozione', target: 'ally', desc: 'Ridà 800 punti vita a un compagno.', price: 110 },
  etere: { name: 'Etere', target: 'ally', desc: 'Ridà 40 MP a un compagno.', price: 80 },
  fenice: { name: 'Coda di fenice', target: 'koAlly', desc: 'Rimette in piedi un compagno caduto.', price: 120 },
};
// gli oggetti di missione (non si usano)
export const KEY_ITEMS = {
  filo: { name: 'Filo di medusa', desc: 'Sottile e fortissimo. A Beppe servono per le reti.' },
  lanterna: { name: 'Lanterna di Ada', desc: 'Una lanterna vecchia, ancora tiepida.' },
  sigillo1: { name: 'Sigillo della Luce', desc: 'Un disco di vetro caldo, preso in cima al Faro Spento.' },
  sigillo2: { name: 'Sigillo dell\'Abisso', desc: 'Un disco di madreperla nera, dal fondo delle grotte.' },
  conchiglia: { name: 'Conchiglia che canta', desc: 'Se l\'appoggi all\'orecchio non si sente il mare: si sente una canzone. Tobia le colleziona.' },
  lenza: { name: 'Lenza d\'argento', desc: 'Il regalo di Nilo. Con questa i pesci abboccano più a lungo e scappano meno.' },
};

// ---------- La pesca ----------
export const FISH_SPOTS = {
  porto: { name: 'Il pontile di Porto Grigio' },
  molo: { name: 'La punta del molo del silo' },
  spiaggia: { name: 'La riva della Spiaggia Nera' },
  lago: { name: 'Il lago sotterraneo' },
};
// w: quanto è comune; diff: quanto si dibatte; price: quanto lo paga Gino
export const FISH = {
  sardina: { name: 'Sardina', spot: 'porto', w: 5, diff: 0.6, price: 8, size: [10, 18], desc: 'Piccola e argentata. Gino ne fa una zuppa ogni sera.' },
  sgombro: { name: 'Sgombro', spot: 'porto', w: 4, diff: 0.8, price: 14, size: [22, 36], desc: 'Strisce blu sul dorso, come il mare in burrasca.' },
  triglia: { name: 'Triglia', spot: 'porto', w: 2, diff: 1, price: 24, size: [15, 28], desc: 'Rossa come un tramonto che qui non si vede mai.' },
  polpo: { name: 'Polpo', spot: 'porto', w: 1, diff: 1.3, price: 40, size: [30, 70], desc: 'Si attacca alla lenza con tutti e otto i tentacoli.' },
  spigola: { name: 'Spigola', spot: 'molo', w: 4, diff: 1, price: 28, size: [30, 60], desc: 'Gira intorno ai pali del molo, nell\'ombra del silo.' },
  orata: { name: 'Orata', spot: 'molo', w: 3, diff: 1.1, price: 34, size: [25, 45], desc: 'Ha una striscia d\'oro fra gli occhi.' },
  pesceluna: { name: 'Pesce luna', spot: 'molo', w: 1, diff: 1.4, price: 90, size: [80, 180], rare: true, big: true, desc: 'Enorme e tondo. Galleggia di lato, come se dormisse anche lui.' },
  razza: { name: 'Razza nera', spot: 'spiaggia', w: 4, diff: 1.2, price: 38, size: [40, 90], desc: 'Scivola sulla sabbia nera, invisibile finché non si muove.' },
  anguillina: { name: 'Anguilla di sabbia', spot: 'spiaggia', w: 4, diff: 1.3, price: 30, size: [30, 60], desc: 'Una parente piccola dell\'Anguillone. Molto piccola, per fortuna.' },
  cavalluccio: { name: 'Cavalluccio d\'ombra', spot: 'spiaggia', w: 1, diff: 1.6, price: 120, size: [8, 16], rare: true, desc: 'Nero, con gli occhi che brillano. Nessuno a Porto Grigio ne ha mai visto uno.' },
  cieco: { name: 'Pesce cieco', spot: 'lago', w: 5, diff: 1, price: 45, size: [12, 24], desc: 'Bianco e senza occhi. Non ha mai visto la luce, e sta benissimo così.' },
  lanterna: { name: 'Pesce lanterna', spot: 'lago', w: 3, diff: 1.3, price: 70, size: [15, 30], desc: 'Si porta la sua luce appesa davanti alla bocca.' },
  cristallo: { name: 'Pesce cristallo', spot: 'lago', w: 1, diff: 1.75, price: 200, size: [20, 40], rare: true, big: true, desc: 'Trasparente come vetro. Dentro, si vede battere un cuore azzurro.' },
};

// ---------- Equipaggiamento ----------
// who: per chi è l'arma; le armature vanno bene a tutti
export const GEAR = {
  remo: { name: 'Remo spezzato', slot: 'weapon', who: 'tu', str: 0, price: 0 },
  sciabola: { name: 'Sciabola da marinaio', slot: 'weapon', who: 'tu', str: 8, price: 180 },
  lama: { name: 'Lama di corallo', slot: 'weapon', who: 'tu', str: 18, price: 950 },
  ombrello: { name: 'Ombrello rotto', slot: 'weapon', who: 'amico', mag: 0, price: 0 },
  ambra: { name: 'Bastone d\'ambra', slot: 'weapon', who: 'amico', mag: 8, price: 180 },
  perla: { name: 'Scettro di perla', slot: 'weapon', who: 'amico', mag: 18, price: 950 },
  chiavetta2: { name: 'Chiavetta da 2 GB', slot: 'weapon', who: 'scintilla', str: 0, mag: 0, price: 0 },
  chiavetta16: { name: 'Chiavetta da 16 GB', slot: 'weapon', who: 'scintilla', str: 6, mag: 6, price: 200 },
  chiavetta1t: { name: 'Chiavetta da 1 TB', slot: 'weapon', who: 'scintilla', str: 14, mag: 14, price: 1000 },
  arpione: { name: 'Arpione di legno', slot: 'weapon', who: 'marta', str: 4, price: 0 },
  arpioneferro: { name: 'Arpione di ferro', slot: 'weapon', who: 'marta', str: 11, price: 320 },
  arpioneavorio: { name: 'Arpione d\'avorio', slot: 'weapon', who: 'marta', str: 21, price: 1100 },
  remosogno: { name: 'Remo del Sogno', slot: 'weapon', who: 'tu', str: 30, price: 0 },
  ombrellosogno: { name: 'Ombrello stellato', slot: 'weapon', who: 'amico', mag: 30, str: 4, price: 0 },
  arpionesogno: { name: 'Arpione di stelle', slot: 'weapon', who: 'marta', str: 31, price: 0 },
  maglia: { name: 'Maglione', slot: 'armor', def: 0, mdef: 0, hp: 0, price: 0 },
  impermeabile: { name: 'Impermeabile', slot: 'armor', def: 6, mdef: 4, hp: 40, price: 120 },
  cerata: { name: 'Cerata rinforzata', slot: 'armor', def: 12, mdef: 8, hp: 90, price: 420 },
  conchiglie: { name: 'Corazza di conchiglie', slot: 'armor', def: 20, mdef: 14, hp: 170, price: 1050 },
  scaglie: { name: 'Manto di scaglie di balena', slot: 'armor', def: 28, mdef: 24, hp: 260, price: 0 },
};
export const SHOP_GEAR = ['sciabola', 'ambra', 'arpioneferro', 'impermeabile', 'cerata', 'lama', 'perla', 'arpioneavorio', 'conchiglie'];
export const SHOP_ITEMS = ['pozione', 'superpozione', 'etere', 'fenice'];

// ---------- Le creature ----------
// valori al livello di zona 1; tier della zona li moltiplica (vedi scaleEnemy)
export const ENEMIES = {
  gabbiano: { name: 'Gabbiano Nero', model: 'bird', hp: 110, str: 13, mag: 6, def: 6, mdef: 8, agi: 15, weak: ['fulmine'], xp: 14, money: 12, acts: [['beccata', 3], ['picchiata', 1]], info: 'Veloce, ma le ali bagnate conducono la corrente.' },
  riccio: { name: 'Riccio di Scoglio', model: 'urchin', hp: 160, str: 11, mag: 4, def: 45, mdef: 4, agi: 5, weak: ['fuoco'], xp: 16, money: 14, acts: [['aculei', 3], ['pungiglioni', 1]], info: 'Tutto spine: i colpi fisici rimbalzano. Bruciatelo.' },
  granchio: { name: 'Granchio di Ruggine', model: 'crab', hp: 200, str: 13, mag: 4, def: 50, mdef: 6, agi: 6, weak: ['fulmine'], xp: 18, money: 16, acts: [['chela', 3], ['guscio', 1]], info: 'Corazzato: i colpi fisici rimbalzano. Rompiguardia, un arpione o un fulmine.' },
  medusa: { name: 'Medusa Temporalesca', model: 'jelly', hp: 130, str: 6, mag: 12, def: 10, mdef: 26, agi: 11, weak: ['fuoco'], absorb: ['fulmine'], xp: 16, money: 14, drop: 'filo', acts: [['scossa', 3], ['velo', 1]], info: 'Si nutre di fulmini. Il fuoco la fa evaporare.' },
  anguilla: { name: 'Anguilla Abissale', model: 'eel', hp: 150, str: 14, mag: 6, def: 14, mdef: 12, agi: 17, weak: ['gelo'], resist: ['fuoco'], xp: 17, money: 15, acts: [['morso', 3], ['avvinghia', 1]], info: 'Velocissima. Il gelo la intorpidisce.' },
  fedele: { name: 'Fedele Annegato', model: 'devotee', hp: 170, str: 9, mag: 13, def: 16, mdef: 20, agi: 8, weak: ['fuoco'], xp: 20, money: 22, acts: [['preghiera', 2], ['salmodia', 3]], info: 'Prega per gli altri. Conviene farlo tacere per primo.' },
  fatuo: { name: 'Fuoco Fatuo', model: 'wisp', hp: 120, str: 5, mag: 14, def: 8, mdef: 22, agi: 13, weak: ['gelo'], absorb: ['fuoco'], xp: 18, money: 18, acts: [['fiammella', 3], ['abbaglio', 1]], info: 'Una fiamma che non brucia niente. Il gelo la spegne; il fuoco la nutre.' },
  cirripede: { name: 'Cirripede Vivente', model: 'barnacle', hp: 200, str: 10, mag: 10, def: 32, mdef: 14, agi: 6, weak: ['fuoco'], xp: 18, money: 18, acts: [['spruzzo', 3], ['incrosta', 1]], info: 'Si richiude e si ripara. Il fuoco lo stana.' },
  // i boss
  granchiore: { name: 'Granchio Re', model: 'crabking', hp: 2400, str: 30, mag: 12, def: 55, mdef: 20, agi: 7, weak: ['fulmine'], xp: 320, money: 400, boss: true, acts: [['chela', 3], ['tenaglia', 2], ['bolle', 2], ['guscio', 1]], info: 'Il guardiano del Faro Spento. La corazza è durissima: Rompiguardia prima di tutto.' },
  anguillone: { name: 'L\'Anguillone', model: 'eelking', hp: 1800, str: 28, mag: 8, def: 18, mdef: 16, agi: 18, weak: ['gelo'], resist: ['fuoco'], xp: 260, money: 320, boss: true, acts: [['morso', 3], ['avvinghia', 2], ['risucchio', 2]], info: 'Il mostro della Spiaggia Nera. Veloce: Lentezza aiuta.' },
  madre: { name: 'La Madre delle Meduse', model: 'jellymother', hp: 3600, str: 18, mag: 34, def: 20, mdef: 40, agi: 9, weak: ['fuoco'], absorb: ['fulmine'], xp: 560, money: 600, boss: true, acts: [['catena', 3], ['evoca', 2], ['velomadre', 1]], info: 'Assorbe i fulmini e chiama le sue figlie. Il fuoco la ferisce.' },
  // l'Abisso, sotto la statua: le creature del sogno del dio
  granchioombra: { name: 'Granchio d\'Ombra', model: 'crabshade', hp: 210, str: 14, mag: 8, def: 52, mdef: 14, agi: 7, weak: ['fuoco'], xp: 20, money: 18, acts: [['chela', 3], ['guscio', 1], ['incubo', 1]], info: 'Il ricordo di un granchio. La corazza tiene, ma il fuoco la scioglie.' },
  medusanera: { name: 'Medusa Nera', model: 'jellyshade', hp: 140, str: 6, mag: 15, def: 10, mdef: 30, agi: 12, weak: ['fulmine'], absorb: ['gelo'], xp: 19, money: 16, acts: [['buio', 3], ['velo', 1]], info: 'Al contrario di quelle di sopra: il fulmine la spezza, il gelo la nutre.' },
  anguillasogno: { name: 'Anguilla del Sogno', model: 'eelshade', hp: 160, str: 16, mag: 8, def: 16, mdef: 14, agi: 19, weak: ['fuoco'], resist: ['gelo'], xp: 19, money: 17, acts: [['morso', 3], ['risucchio', 1], ['avvinghia', 1]], info: 'Nuota nell\'aria. Il fuoco la fa scappare.' },
  sognatore: { name: 'Sognatore Annegato', model: 'devshade', hp: 180, str: 9, mag: 16, def: 16, mdef: 24, agi: 9, weak: ['fulmine'], xp: 22, money: 24, acts: [['preghiera', 2], ['incubo', 2], ['salmodia', 2]], info: 'Dorme e prega insieme. Svegliatelo con un fulmine.' },
  fatuonero: { name: 'Fuoco Nero', model: 'wispshade', hp: 130, str: 5, mag: 17, def: 8, mdef: 24, agi: 14, weak: ['fuoco'], absorb: ['gelo'], xp: 20, money: 20, acts: [['buio', 3], ['abbaglio', 1]], info: 'Una fiamma che brucia al contrario. Il fuoco vero la spegne.' },
  riccionero: { name: 'Riccio dell\'Abisso', model: 'urchinshade', hp: 170, str: 13, mag: 6, def: 48, mdef: 8, agi: 6, weak: ['gelo'], xp: 18, money: 16, acts: [['aculei', 3], ['pungiglioni', 2]], info: 'Spine nere. Il gelo le rende fragili.' },
  // i guardiani dell'Abisso: crescono con la profondità (deep = il livello di zona di riferimento)
  colosso: { name: 'Il Cirripede Colosso', model: 'barnaclelord', hp: 4200, str: 34, mag: 30, def: 50, mdef: 30, agi: 8, weak: ['fuoco'], xp: 900, money: 900, boss: true, deep: 4, acts: [['spruzzo', 2], ['incrosta', 1], ['ondata', 2], ['evocaombre', 1]], info: 'Il guardiano del quinto piano. Si richiude e chiama i suoi figli d\'ombra. Il fuoco lo stana.' },
  sognodio: { name: 'Il Sogno del Dio', model: 'dreamwhale', hp: 9000, str: 46, mag: 46, def: 38, mdef: 42, agi: 10, weak: [], xp: 3000, money: 2000, boss: true, deep: 5, countdown: true, acts: [['codata', 3], ['onda', 2], ['incubo', 2]], info: 'Quello che il dio sognava, mentre dormiva. Quando il conto arriva a zero canta: difendetevi.' },
  dio: { name: 'Il Dio Sopito', model: 'whale', hp: 5600, str: 40, mag: 38, def: 35, mdef: 38, agi: 8, weak: [], xp: 1500, money: 0, boss: true, countdown: true, acts: [['codata', 3], ['onda', 2]], info: 'Ogni tanto canta: quando il conto arriva a zero, il Canto degli Abissi colpisce tutti. Difendetevi.' },
};

export function scaleEnemy(id, tier = 1) {
  const d = ENEMIES[id];
  if (d.boss && !d.deep) return { ...d };
  // i guardiani dell'Abisso: più si scende, più sono forti
  if (d.boss) {
    const k = Math.max(1, tier / d.deep);
    return { ...d, hp: Math.round(d.hp * Math.pow(k, 1.4)), str: d.str * Math.pow(k, 0.9), mag: d.mag * Math.pow(k, 0.9), def: d.def * k, mdef: d.mdef * k, xp: Math.round(d.xp * k), money: Math.round(d.money * k) };
  }
  const h = Math.pow(tier, 1.3);
  const a = Math.pow(tier, 0.8);
  return { ...d, hp: Math.round(d.hp * h), str: d.str * a, mag: d.mag * a, def: d.def * (0.8 + tier * 0.2), mdef: d.mdef * (0.8 + tier * 0.2), xp: Math.round(d.xp * Math.pow(tier, 1.2)), money: Math.round(d.money * tier) };
}

export const ENEMY_ACTS = {
  beccata: { name: 'Beccata', kind: 'phys', power: 1, target: 'one' },
  picchiata: { name: 'Picchiata', kind: 'phys', power: 1.45, target: 'one' },
  aculei: { name: 'Aculei', kind: 'phys', power: 1, target: 'one' },
  pungiglioni: { name: 'Pioggia di aculei', kind: 'phys', power: 0.6, target: 'all' },
  chela: { name: 'Chela', kind: 'phys', power: 1, target: 'one' },
  tenaglia: { name: 'Tenaglia', kind: 'phys', power: 1.8, target: 'one' },
  bolle: { name: 'Bolle bollenti', kind: 'mag', power: 0.8, target: 'all' },
  guscio: { name: 'Guscio', kind: 'self', status: 'shell', target: 'self' },
  scossa: { name: 'Scossa', kind: 'mag', power: 1, elem: 'fulmine', target: 'one', status: 'slow', chance: 0.3 },
  velo: { name: 'Velo d\'acqua', kind: 'healAlly', power: 130, target: 'ally' },
  morso: { name: 'Morso', kind: 'phys', power: 1.1, target: 'one' },
  avvinghia: { name: 'Avvinghia', kind: 'phys', power: 0.7, target: 'one', status: 'delay' },
  risucchio: { name: 'Risucchio', kind: 'phys', power: 1.2, target: 'one', drain: true },
  preghiera: { name: 'Preghiera', kind: 'healAll', power: 80, target: 'allies' },
  salmodia: { name: 'Salmodia', kind: 'mag', power: 0.95, target: 'one' },
  fiammella: { name: 'Fiammella', kind: 'mag', power: 1, elem: 'fuoco', target: 'one' },
  abbaglio: { name: 'Abbaglio', kind: 'mag', power: 0.4, target: 'all', status: 'delay' },
  spruzzo: { name: 'Spruzzo salato', kind: 'mag', power: 1, target: 'one' },
  incrosta: { name: 'Incrostazione', kind: 'self', status: 'shell', heal: 0.2, target: 'self' },
  catena: { name: 'Scossa a catena', kind: 'mag', power: 0.75, elem: 'fulmine', target: 'all' },
  evoca: { name: 'Richiamo delle figlie', kind: 'summon', summon: 'medusa', target: 'self' },
  velomadre: { name: 'Velo materno', kind: 'healAll', power: 350, target: 'allies' },
  codata: { name: 'Codata', kind: 'phys', power: 1.35, target: 'one' },
  onda: { name: 'Onda nera', kind: 'mag', power: 0.7, target: 'all' },
  canto: { name: 'Canto degli Abissi', kind: 'mag', power: 1.7, target: 'all' },
  buio: { name: 'Buio', kind: 'mag', power: 1.05, target: 'one' },
  incubo: { name: 'Incubo', kind: 'mag', power: 0.55, target: 'all', status: 'delay' },
  ondata: { name: 'Ondata nera', kind: 'mag', power: 0.85, target: 'all' },
  evocaombre: { name: 'Richiamo dal fondo', kind: 'summon', summon: 'granchioombra', target: 'self' },
  marea: { name: 'Marea', kind: 'mag', power: 1.05, target: 'all', status: 'delay' },
};

// ---------- Le zone e i loro incontri ----------
export const ZONES = {
  brughiera: { name: 'La Brughiera', tier: 1, groups: [['gabbiano', 'gabbiano'], ['riccio', 'gabbiano'], ['anguilla'], ['riccio', 'riccio'], ['gabbiano', 'riccio', 'gabbiano']] },
  spiaggia: { name: 'La Spiaggia Nera', tier: 1.35, groups: [['granchio'], ['granchio', 'medusa'], ['medusa', 'medusa'], ['riccio', 'granchio'], ['medusa', 'granchio', 'medusa']] },
  faro: { name: 'Il Faro Spento', tier: 1.8, groups: [['fatuo', 'fatuo'], ['fedele', 'fatuo'], ['granchio', 'fatuo'], ['fatuo', 'fedele', 'fatuo']] },
  grotte: { name: 'Le Grotte dei Cirripedi', tier: 2.5, groups: [['medusa', 'medusa'], ['anguilla', 'medusa'], ['cirripede', 'anguilla'], ['cirripede', 'medusa', 'cirripede'], ['anguilla', 'anguilla']] },
  silo: { name: 'Il Silo', tier: 3.2 },
  abisso: { name: 'L\'Abisso', tier: 3.4, groups: [['granchioombra', 'medusanera'], ['anguillasogno', 'anguillasogno'], ['sognatore', 'fatuonero', 'sognatore'], ['riccionero', 'medusanera', 'riccionero'], ['fatuonero', 'fatuonero'], ['granchioombra', 'anguillasogno', 'granchioombra'], ['medusanera', 'sognatore', 'medusanera'], ['riccionero', 'fatuonero']] },
};

// I gruppi di creature che custodiscono la statua nel silo (id, composizione, dove)
export const GROUPS = [
  { id: 'g1', foes: ['granchio', 'medusa'], angle: 0.4 },
  { id: 'g2', foes: ['anguilla', 'anguilla'], angle: 1.6 },
  { id: 'g3', foes: ['medusa', 'fedele', 'medusa'], angle: 2.7 },
  { id: 'g4', foes: ['granchio', 'anguilla', 'granchio'], angle: 3.9 },
  { id: 'g5', foes: ['fedele', 'granchio', 'fedele'], angle: 5.1 },
];

export const xpToNext = (level) => Math.round(60 * Math.pow(level, 1.3));

// ---------- L'albero delle abilità ----------
// Ogni personaggio ha tre rami. Un nodo si sblocca spendendo punti abilità,
// solo se è sbloccato quello prima nello stesso ramo (e, se c'è, il nodo req
// di un altro ramo). lv: il livello minimo. I nodi danno un'abilità (skill),
// statistiche (stat) o un talento passivo (pass).
export const PASSIVES = {
  critico: { name: 'Occhio per i punti deboli', desc: 'I colpi critici arrivano molto più spesso.' },
  tenace: { name: 'Tenacia', desc: 'Una volta per battaglia, un colpo che ti abbatterebbe ti lascia a 1 di vita.' },
  svelto: { name: 'Primo a muoversi', desc: 'All\'inizio della battaglia agisci quasi subito.' },
  furia: { name: 'Furia', desc: 'La barra dell\'Overdrive si riempie il 50% più in fretta.' },
  sorgente: { name: 'Sorgente', desc: 'Le tue cure guariscono il 30% in più.' },
  eco: { name: 'Eco', desc: 'Le abilità costano un quarto di MP in meno.' },
  quiete: { name: 'Quiete', desc: 'A ogni tuo turno recuperi 3 MP.' },
};

export const TREES = {
  tu: {
    innate: ['colpo', 'provoca'],
    branches: [
      { name: 'Lama', nodes: [
        { id: 't_rompi', skill: 'rompi', cost: 1 },
        { id: 't_for1', stat: { str: 3 }, cost: 1 },
        { id: 't_vento', skill: 'vento', cost: 2, lv: 4 },
        { id: 't_crit', pass: 'critico', cost: 2 },
        { id: 't_onda', skill: 'taglioonda', cost: 3, lv: 7 },
      ] },
      { name: 'Scoglio', nodes: [
        { id: 't_hp1', stat: { hp: 80 }, cost: 1 },
        { id: 't_def1', stat: { def: 4 }, cost: 1 },
        { id: 't_sent', skill: 'sentinella', cost: 2 },
        { id: 't_hp2', stat: { hp: 150, mdef: 4 }, cost: 2 },
        { id: 't_tenace', pass: 'tenace', cost: 3, lv: 6 },
      ] },
      { name: 'Occhio', nodes: [
        { id: 't_scan', skill: 'scanner', cost: 1 },
        { id: 't_agi1', stat: { agi: 2 }, cost: 1 },
        { id: 't_mp1', stat: { mp: 12 }, cost: 1 },
        { id: 't_svelto', pass: 'svelto', cost: 2 },
        { id: 't_furia', pass: 'furia', cost: 2, req: 't_for1' },
      ] },
    ],
  },
  amico: {
    innate: ['fuoco', 'cura'],
    branches: [
      { name: 'Elementi', nodes: [
        { id: 'a_fulmine', skill: 'fulmine', cost: 1 },
        { id: 'a_gelo', skill: 'gelo', cost: 1 },
        { id: 'a_mag1', stat: { mag: 3 }, cost: 1 },
        { id: 'a_raffica', skill: 'raffica', cost: 2, lv: 3 },
        { id: 'a_tempesta', skill: 'tempesta', cost: 3, lv: 8 },
      ] },
      { name: 'Marea', nodes: [
        { id: 'a_mp1', stat: { mp: 16 }, cost: 1 },
        { id: 'a_sorgente', pass: 'sorgente', cost: 2 },
        { id: 'a_curatot', skill: 'curatotale', cost: 2, lv: 5 },
        { id: 'a_barriera', skill: 'barriera', cost: 2, lv: 6 },
        { id: 'a_eco', pass: 'eco', cost: 3, req: 'a_mag1' },
      ] },
      { name: 'Vento', nodes: [
        { id: 'a_lent', skill: 'lentezza', cost: 1 },
        { id: 'a_agi1', stat: { agi: 2 }, cost: 1 },
        { id: 'a_rapid', skill: 'rapidita', cost: 2, lv: 4 },
        { id: 'a_hp1', stat: { hp: 60, mdef: 5 }, cost: 1 },
        { id: 'a_quiete', pass: 'quiete', cost: 2 },
      ] },
    ],
  },
  marta: {
    innate: ['arpione'],
    branches: [
      { name: 'Arpione', nodes: [
        { id: 'm_for1', stat: { str: 3 }, cost: 1 },
        { id: 'm_doppio', skill: 'doppio', cost: 2 },
        { id: 'm_crit', pass: 'critico', cost: 2 },
        { id: 'm_fiocina', skill: 'fiocina', cost: 3, lv: 7 },
      ] },
      { name: 'Reti', nodes: [
        { id: 'm_rete', skill: 'rete', cost: 1 },
        { id: 'm_strat', skill: 'strattone', cost: 1 },
        { id: 'm_hp1', stat: { hp: 80, def: 4 }, cost: 2 },
        { id: 'm_tenace', pass: 'tenace', cost: 3, lv: 6 },
      ] },
      { name: 'Mare', nodes: [
        { id: 'm_agi1', stat: { agi: 2 }, cost: 1 },
        { id: 'm_richiamo', skill: 'richiamo', cost: 2, lv: 3 },
        { id: 'm_svelto', pass: 'svelto', cost: 2 },
        { id: 'm_mp1', stat: { mp: 12 }, cost: 1 },
        { id: 'm_furia', pass: 'furia', cost: 2, req: 'm_for1' },
      ] },
    ],
  },
};

export const STAT_NAMES = { hp: 'Vita', mp: 'MP', str: 'For', mag: 'Mag', def: 'Dif', mdef: 'DifM', agi: 'Agi' };

export function treeNode(id, nid) {
  for (const b of TREES[id].branches) {
    const i = b.nodes.findIndex((n) => n.id === nid);
    if (i >= 0) return { node: b.nodes[i], branch: b, prev: b.nodes[i - 1] };
  }
  return null;
}

const unlocked = (state, id) => state.tree?.[id] || [];

// i punti: 2 al primo livello, 2 a ogni livello in più
export const spEarned = (level) => 2 + (level - 1) * 2;
export function spFree(state, id) {
  return spEarned(state.level) - unlocked(state, id).reduce((s, nid) => s + (treeNode(id, nid)?.node.cost || 0), 0);
}

// si può sbloccare? null se sì, altrimenti il motivo
export function nodeBlock(state, id, nid) {
  const t = treeNode(id, nid);
  const have = unlocked(state, id);
  if (have.includes(nid)) return 'già tuo';
  if (t.prev && !have.includes(t.prev.id)) return 'serve il nodo prima';
  if (t.node.req && !have.includes(t.node.req)) return `serve ${nodeLabel(id, t.node.req)}`;
  if (t.node.lv && state.level < t.node.lv) return `livello ${t.node.lv}`;
  if (spFree(state, id) < t.node.cost) return 'punti insufficienti';
  return null;
}

export function nodeLabel(id, nid) {
  const n = treeNode(id, nid).node;
  if (n.skill) return SKILLS[n.skill].name;
  if (n.pass) return PASSIVES[n.pass].name;
  return Object.entries(n.stat).map(([k, v]) => `${STAT_NAMES[k]} +${v}`).join(' ');
}

export function unlockNode(state, id, nid) {
  if (nodeBlock(state, id, nid)) return false;
  state.tree ??= {};
  (state.tree[id] ??= []).push(nid);
  return true;
}

// gli Overdrive: uno all'inizio, gli altri si sbloccano con la storia e le missioni
export const OD_LIST = {
  tu: [['mareggiata'], ['colpodelfaro', (sv) => !!sv.keyItems?.sigillo1, 'Sconfiggi il Granchio Re in cima al faro'], ['scogliera', (sv) => sv.quests?.side?.mostro === 'done', 'Caccia l\'Anguillone per Gino']],
  amico: [['diluvio'], ['arcobaleno', (sv) => sv.quests?.side?.lanterna === 'done', 'Riporta la lanterna ad Ada'], ['zeroassoluto', (sv) => sv.abyss?.won?.includes(5), 'Sconfiggi il guardiano del quinto piano dell\'Abisso']],
  marta: [['arpioni'], ['retedimare', (sv) => sv.quests?.side?.reti === 'done', 'Aiuta Beppe con le reti'], ['balena', (sv) => sv.abyss?.won?.includes(10), 'Sconfiggi il Sogno del Dio, nel decimo piano dell\'Abisso']],
};
export function knownOverdrives(id, sv) {
  return (OD_LIST[id] || [[PARTY[id].od]]).filter(([, req]) => !req || req(sv)).map(([o]) => o);
}

// le abilità che un personaggio conosce: quelle di partenza più l'albero
export function knownSkills(id, state) {
  const out = [...TREES[id].innate];
  for (const nid of unlocked(state, id)) {
    const s = treeNode(id, nid)?.node.skill;
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

// quanto costa davvero un'abilità (il talento Eco fa risparmiare)
export const mpCost = (u, sid) => (u.pass?.eco ? Math.ceil(SKILLS[sid].mp * 0.75) : SKILLS[sid].mp);

// ---------- Le missioni ----------
// la storia: un passo dopo l'altro
export const MAIN = [
  { title: 'Il porto nella tempesta', text: 'Siete arrivati a Porto Grigio. Parla con Orsola, la capovillaggio: la sua casa è quella con la lanterna verde.' },
  { title: 'Il Faro Spento', text: 'Il primo sigillo è in cima al Faro Spento, sul capo a est. Marta viene con voi. Qualcosa custodisce il faro.' },
  { title: 'Ritorno da Orsola', text: 'Hai il Sigillo della Luce, e il faro è di nuovo acceso. Torna da Orsola a Porto Grigio.' },
  { title: 'Le Grotte dei Cirripedi', text: 'Il secondo sigillo è nelle grotte sotto le scogliere a ovest. È lì che si è perso Nilo, il fratello di Marta.' },
  { title: 'Il fondo delle grotte', text: 'Trova Nilo e il Sigillo dell\'Abisso, nel fondo delle grotte.' },
  { title: 'Il Silo', text: 'Hai i due sigilli. Il portone del silo, in fondo al molo a nord, aspetta.' },
  { title: 'Il dio sopito', text: 'Dentro il silo: sconfiggi le creature che custodiscono la statua, poi sveglia il dio.' },
  { title: 'La tempesta è passata', text: 'Il dio è stato cacciato. Porto Grigio festeggia.' },
];

export const SIDE = {
  reti: { title: 'Le reti strappate', giver: 'Beppe', text: 'Beppe ha bisogno di 3 fili di medusa per rattoppare le reti. Le meduse si trovano alla Spiaggia Nera e nelle grotte.', reward: '150 conchiglie e 2 Eteri' },
  lanterna: { title: 'La lanterna di Ada', giver: 'Ada', text: 'Ada ha perso la sua lanterna nella brughiera, vicino alle pietre che cantano, al centro dell\'isola.', reward: 'Cerata rinforzata e 2 Code di fenice' },
  cristallo: { title: 'Il pesce che canta', giver: 'Nilo', text: 'Nilo dice che nel lago sotterraneo delle grotte nuota un pesce trasparente, il pesce cristallo. Vuole vederlo almeno una volta. Marta ti presta la sua lenza: si pesca dove l\'acqua fa le bolle.', reward: 'La Lenza d\'argento e 400 conchiglie' },
  conchiglie: { title: 'Le conchiglie che cantano', giver: 'Tobia', text: 'Tobia ha perso le sue conchiglie che cantano: cinque, sparse per l\'isola. Brillano un po\', di sera. Cercale sulla costa e nella brughiera.', reward: 'Il tesoro di Tobia' },
  mostro: { title: 'Il mostro della Spiaggia Nera', giver: 'Gino', text: 'Qualcosa di enorme abita la Spiaggia Nera, a sud-est. Gino offre una ricompensa a chi lo caccia.', reward: 'Lama di corallo e 300 conchiglie' },
};

// le statistiche di un membro del gruppo: livello + equipaggiamento
export function memberStats(state, id) {
  const d = PARTY[id];
  const lvl = state.level;
  const k = 1 + (lvl - 1) * 0.1;
  const hk = 1 + (lvl - 1) * 0.13;
  const eq = state.equip?.[id] || {};
  const w = GEAR[eq.weapon || d.weapon] || {};
  const a = GEAR[eq.armor || 'maglia'] || {};
  // quello che dà l'albero
  const b = { hp: 0, mp: 0, str: 0, mag: 0, def: 0, mdef: 0, agi: 0 };
  const pass = {};
  for (const nid of unlocked(state, id)) {
    const n = treeNode(id, nid)?.node;
    if (!n) continue;
    if (n.stat) for (const [s, v] of Object.entries(n.stat)) b[s] += v;
    if (n.pass) pass[n.pass] = true;
  }
  return {
    maxHp: Math.round(d.hp * hk + (a.hp || 0) + b.hp),
    maxMp: Math.round(d.mp * (1 + (lvl - 1) * 0.08) + b.mp),
    str: d.str * k + (w.str || 0) + b.str,
    mag: d.mag * k + (w.mag || 0) + b.mag,
    def: d.def * k + (a.def || 0) + b.def,
    mdef: d.mdef * k + (a.mdef || 0) + b.mdef,
    agi: d.agi + (lvl - 1) * 0.3 + b.agi,
    pass,
  };
}

// I forzieri sparsi per la campagna
export const CHESTS = {
  isola1: { money: 120 },
  isola2: { items: { superpozione: 1 }, money: 80 },
  isola3: { gear: 'impermeabile' },
  isola4: { items: { etere: 2 } },
  faro1: { items: { pozione: 3 } },
  faro2: { gear: 'ambra' },
  grotte1: { gear: 'arpioneferro' },
  grotte2: { gear: 'cerata' },
  grotte3: { items: { fenice: 2, superpozione: 2 } },
  silo1: { gear: 'conchiglie', money: 300 },
};

// lo stato della campagna, nuovo o aggiornato da un salvataggio vecchio
export function initCampaign(sv) {
  sv.level ??= 1;
  sv.xp ??= 0;
  sv.money ??= 100;
  sv.members ??= ['tu', 'amico'];
  // un gruppo di soli umani: Scintilla torna nella chiavetta
  sv.members = sv.members.filter((m) => m !== 'scintilla');
  sv.party ??= {};
  sv.equip ??= {};
  sv.gear ??= { remo: 1, ombrello: 1, chiavetta2: 1, maglia: 4 };
  sv.items ??= { pozione: 6, etere: 3, fenice: 3 };
  sv.keyItems ??= {};
  sv.quests ??= { main: 0, side: {} };
  sv.chests ??= {};
  sv.cleared ??= [];
  sv.od ??= {};
  sv.lastSave ??= 'villaggio';
  sv.abyss ??= { best: 0, won: [], runs: 0 };
  sv.fish ??= {};
  sv.fishLog ??= {};
  sv.shells ??= [];
  sv.odSeen ??= PARTY_ORDER.flatMap((id) => knownOverdrives(id, sv));
  // i salvataggi di prima dell'albero: le abilità che si avevano per livello
  // diventano nodi sbloccati, finché bastano i punti
  if (!sv.tree) {
    sv.tree = {};
    const OLD = { tu: [[2, 't_scan'], [3, 't_rompi'], [6, 't_vento']], amico: [[1, 'a_fulmine'], [1, 'a_gelo'], [4, 'a_lent'], [5, 'a_rapid'], [7, 'a_curatot'], [9, 'a_barriera']], marta: [[1, 'm_rete'], [4, 'm_richiamo']] };
    for (const [id, list] of Object.entries(OLD)) {
      for (const [l, nid] of list) {
        if (sv.level < l) continue;
        // prima i nodi che servono per arrivarci
        const t = treeNode(id, nid);
        for (const n of t.branch.nodes) {
          unlockNode(sv, id, n.id);
          if (n.id === nid) break;
        }
      }
    }
  }
  // Marta si unisce appena parli con Orsola
  if (sv.quests.main >= 1 && !sv.members.includes('marta')) {
    sv.members.push('marta');
    sv.gear.arpione ??= 1;
  }
  // chi aveva già cacciato il dio con la versione di prima
  if (sv.god && sv.quests.main < 7) {
    sv.quests.main = 7;
    sv.keyItems.sigillo1 = 1;
    sv.keyItems.sigillo2 = 1;
    sv.faroLit = true;
    sv.niloSaved = true;
    if (!sv.members.includes('marta')) sv.members.push('marta');
    sv.gear.arpione ??= 1;
  }
  return sv;
}

// ---------- L'Abisso ----------
// il livello delle creature a un piano dell'Abisso
export const abyssTier = (floor) => 3.3 + floor * 0.22;
// chi custodisce il vortice: ogni cinque piani un guardiano
export function abyssBoss(floor) {
  if (floor % 5) return null;
  return floor % 10 === 0 ? 'sognodio' : 'colosso';
}
// cosa c'è nei forzieri dell'Abisso, più ricchi più si scende
export function abyssChest(floor, rand) {
  const r = rand();
  if (r < 0.3) return { money: Math.round(120 + floor * 40 + rand() * 100) };
  if (r < 0.55) return { items: { superpozione: 1 + Math.floor(floor / 6) } };
  if (r < 0.75) return { items: { etere: 1 + Math.floor(floor / 8) } };
  if (r < 0.9) return { items: { fenice: 1 } };
  return { items: { superpozione: 1, etere: 1 }, money: 100 + floor * 20 };
}
