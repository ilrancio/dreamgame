import { DemonDream } from './demone/DemonDream.js';

// Registro dei sogni. Ogni nuovo sogno raccontato diventa una voce qui
// e una nuova porta nella Stanza dei Sogni.
export const DREAMS = [
  {
    id: 'demone',
    number: 'I',
    title: 'La Fuga dal Demone',
    subtitle: 'Un campo sconfinato, un amico accanto, qualcosa di enorme che ti guarda.',
    colors: ['#ff5a2a', '#5a1030'],
    create: (ctx) => new DemonDream(ctx),
  },
];

// Porte ancora chiuse: sogni non ancora raccontati.
export const EMPTY_DOORS = 4;
