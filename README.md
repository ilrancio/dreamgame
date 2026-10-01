# Dreamgame

Un gioco 3D fatto di sogni veri, cuciti in **un sogno che non finisce**: niente menu, niente livelli separati, nessun risveglio. Il campo è il prologo; poi si vive in un hotel non euclideo, piccolo da fuori e con centinaia di piani dentro, dove saranno ambientati molti dei sogni futuri. I sogni non vengono ricostruiti alla lettera: se ne restituisce la *sensazione*, trasformata in meccaniche che convivono nello stesso mondo.

Tutto è generato nel codice: terreno, modelli, texture, musica ed effetti sonori (Three.js + Web Audio API). Non ci sono asset esterni.

## Come giocare

```bash
npm install
npm run dev        # apri l'indirizzo che compare (di solito http://localhost:5173)
npm run build      # versione statica in dist/
```

La prima volta si parte al volante, nel campo. Il sogno si salva da solo nel browser: le volte successive la schermata iniziale propone **Continua il sogno** (si riprende dalla suite) oppure **Ricomincia dal campo**. Scorciatoia per lo sviluppo: `#hotel` in fondo all'indirizzo parte dall'arrivo in hotel.

## Sogni raccontati finora

| # | Sogno | Nel gioco |
|---|-------|-------------|
| I | [La Fuga dal Demone](docs/sogni.md#i--la-fuga-dal-demone) | Guida folle in un campo sconfinato, un demone gigante che lancia macigni, una strada di montagna fino a un hotel di legno enorme. |
| II | [L'Hotel dalle Mille Stanze](docs/sogni.md#ii--lhotel-dalle-mille-stanze) | Corridoi e stanze con le porte, un concierge che fa fare il giro lungo, la suite 1313 con il suo bagno: tè con l'amico, doccia o vasca, camino, letto, porta chiusa a chiave. Al mattino, gnomi nella hall da eliminare sparando. |
| — | [L'hotel non euclideo](docs/sogni.md#lhotel-non-euclideo) | Ascensori verso 500 piani in cinque architetture (cottage, brutalista, classico, moderno, futuristico) ed eventi casuali in qualunque momento. |
| — | [Le creature dei sogni](docs/sogni.md#le-creature-dei-sogni) | Le entità battute finiscono in una vetrina nella suite; ne scegli una e ti segue (si comincia con 10 gnomi, che crescono fino a 100). |
| III | [La Sala Giochi](docs/sogni.md#iii--la-sala-giochi-piano-88) | Il piano 88: una sala giochi infinita, cabinati giocabili, biglietti e premi per la suite. |

L'interpretazione di ogni sogno (cosa è diventato cosa, e perché) è in [docs/sogni.md](docs/sogni.md).

## Struttura

```
src/
  core/              input, audio sintetizzato, UI/HUD, cielo, particelle, texture procedurali
  main.js            il prologo e l'hotel in sequenza, e la ripresa del sogno salvato
  dreams/demone/     capitolo I: il campo, la macchina, il demone, i macigni, la strada
  dreams/hotel/      l'hotel: pianta a corridoi, porte, concierge, piani e architetture, ascensore,
                     stili delle stanze, suite con bagno e attività,
                     personaggi, gnomi e spari, sala giochi con minigiochi e premi, eventi casuali
```

Ogni nuovo sogno raccontato si aggiunge allo stesso mondo, con meccaniche che si intrecciano con quelle esistenti.
