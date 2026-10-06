# Dreamgame

Un gioco 3D fatto di sogni veri, cuciti in **un sogno che non finisce**: niente menu, niente livelli separati, nessun risveglio. Il campo è il prologo; poi si vive in un hotel non euclideo, piccolo da fuori e con centinaia di piani dentro, dove saranno ambientati molti dei sogni futuri. Dal portone si esce in un mondo aperto fatto di **macroluoghi** (un borgo in vetta, un centro commerciale...): ognuno, una volta visitato, aggiunge una porta-scorciatoia nella suite. I sogni non vengono ricostruiti alla lettera: se ne restituisce la *sensazione*, trasformata in meccaniche che convivono nello stesso mondo.

Tutto è generato nel codice: terreno, modelli, texture, musica ed effetti sonori (Three.js + Web Audio API). Non ci sono asset esterni.

## Come giocare

```bash
npm install
npm run dev        # apri l'indirizzo che compare (di solito http://localhost:5173)
npm run build      # versione statica in dist/
```

La prima volta si parte al volante, nel campo. Il sogno si salva da solo nel browser: le volte successive la schermata iniziale propone **Continua il sogno** (si riprende dalla suite) oppure **Ricomincia dal campo**. Scorciatoie per lo sviluppo: `#hotel` in fondo all'indirizzo parte dall'arrivo in hotel, `#esterno` dal portone dell'hotel, all'aperto, `#centro` dall'ingresso del centro commerciale.

## Sogni raccontati finora

| # | Sogno | Nel gioco |
|---|-------|-------------|
| I | [La Fuga dal Demone](docs/sogni.md#i--la-fuga-dal-demone) | Guida folle in un campo sconfinato, un demone gigante che lancia macigni, una strada di montagna fino a un hotel di legno enorme. |
| II | [L'Hotel dalle Mille Stanze](docs/sogni.md#ii--lhotel-dalle-mille-stanze) | Corridoi e stanze con le porte, un concierge che fa fare il giro lungo, la suite 1313 con il suo bagno: tè con l'amico, doccia o vasca, camino, letto, porta chiusa a chiave. Al mattino, gnomi nella hall da eliminare sparando. |
| — | [L'hotel non euclideo](docs/sogni.md#lhotel-non-euclideo) | Ascensori verso 500 piani in cinque architetture (cottage, brutalista, classico, moderno, futuristico) ed eventi casuali in qualunque momento. |
| — | [Le creature dei sogni](docs/sogni.md#le-creature-dei-sogni) | Le entità battute finiscono in una vetrina nella suite; ne scegli una e ti segue (si comincia con 10 gnomi, che crescono fino a 100). |
| — | [Il borgo in vetta](docs/sogni.md#la-strada-continua-il-borgo-in-vetta) | Dal portone si esce all'aperto: la strada sale a tornanti fino a Sant'Onirio, un paesino di montagna con piazza, fontana, campanile, bar e belvedere. Caffè con l'amico, cannocchiale, campana. |
| — | [I macroluoghi e le porte 1313](docs/sogni.md#i-macroluoghi-e-le-porte-1313) | Ogni grande zona del mondo visitata sblocca una porta verde nella suite che porta lì, e lì una porta 1313 riporta nella suite. |
| IV | [Il Centro Commerciale Orizzonte](docs/sogni.md#il-centro-commerciale-orizzonte) | Un centro commerciale colossale su due piani, vuoto: solo i commessi. Un negozio di retrogiochi con il tubo catodico, un pouf per sdraiarsi e un commesso che mette tranquillità. |
| — | [I gesti](docs/sogni.md#i-gesti-un-minigioco-per-ogni-cosa-di-tutti-i-giorni) | Piccoli minigiochi gentili per le cose di tutti i giorni: la moka, la doccia, il tè, la campana del borgo. |
| V | [L'Invasione Digitale](docs/sogni.md#v--linvasione-digitale) | Entità digitali ovunque e terminali nei macroluoghi: colleghi la chiavetta con dentro Scintilla e combatti in un picchiaduro/shooter laterale 2D. Livelli e punti abilità. |
| — | [Il Murale delle Entità](docs/sogni.md#il-murale-delle-entità) | Un murale gigante in fondo al centro commerciale con tutte le entità: infili la chiavetta e scegli quale trasferire e usare in combattimento. |
| III | [La Sala Giochi](docs/sogni.md#iii--la-sala-giochi-piano-88) | Il piano 88: una sala giochi infinita, cabinati giocabili, biglietti e premi per la suite. |

L'interpretazione di ogni sogno (cosa è diventato cosa, e perché) è in [docs/sogni.md](docs/sogni.md).

## Struttura

```
src/
  core/              input, audio sintetizzato, UI/HUD, cielo, particelle, texture procedurali
  main.js            il prologo, l'hotel e l'esterno in sequenza, e la ripresa del sogno salvato
  dreams/demone/     capitolo I: il campo, la macchina, il demone, i macigni, la strada
  core/places.js     i macroluoghi e le porte-scorciatoia verso la suite
  core/gestures.js   i gesti: minigiochi per le attività di tutti i giorni
  dreams/esterno/    fuori dall'hotel: a piedi o in macchina, il borgo in vetta
  dreams/centro/     il centro commerciale: l'edificio nella conca e la galleria su due piani
  dreams/digitale/   l'invasione digitale: terminali, entità, la chiavetta e il combattimento 2D
  dreams/hotel/      l'hotel: pianta a corridoi, porte, concierge, piani e architetture, ascensore,
                     stili delle stanze, suite con bagno e attività,
                     personaggi, gnomi e spari, sala giochi con minigiochi e premi, eventi casuali
```

Ogni nuovo sogno raccontato si aggiunge allo stesso mondo, con meccaniche che si intrecciano con quelle esistenti.
