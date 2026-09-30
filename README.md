# Dreamgame

Un gioco 3D fatto di sogni veri, cuciti in **un'unica esperienza continua**: niente menu, niente livelli separati. I sogni non vengono ricostruiti alla lettera: se ne restituisce la *sensazione*, trasformata in meccaniche che convivono nello stesso mondo.

Tutto è generato nel codice: terreno, modelli, texture, musica ed effetti sonori (Three.js + Web Audio API). Non ci sono asset esterni.

## Come giocare

```bash
npm install
npm run dev        # apri l'indirizzo che compare (di solito http://localhost:5173)
npm run build      # versione statica in dist/
```

Dopo il clic iniziale sei subito nel sogno, al volante. Scorciatoia per lo sviluppo: `#hotel` in fondo all'indirizzo parte direttamente dal secondo capitolo.

## Sogni raccontati finora

| # | Sogno | Nel gioco |
|---|-------|-------------|
| I | [La Fuga dal Demone](docs/sogni.md#i--la-fuga-dal-demone) | Guida folle in un campo sconfinato, un demone gigante che lancia macigni, una strada di montagna fino a un hotel di legno enorme. |
| II | [L'Hotel dalle Mille Stanze](docs/sogni.md#ii--lhotel-dalle-mille-stanze) | Un labirinto di stanze in stili diversi, una notte nella 1313 e, al mattino, migliaia di gnomi minuscoli. |

L'interpretazione di ogni sogno (cosa è diventato cosa, e perché) è in [docs/sogni.md](docs/sogni.md).

## Struttura

```
src/
  core/              input, audio sintetizzato, UI/HUD, cielo, particelle, texture procedurali
  main.js            la notte: i capitoli in sequenza e il riepilogo finale
  dreams/demone/     capitolo I: il campo, la macchina, il demone, i macigni, la strada
  dreams/hotel/      capitolo II: pianta a labirinto, stili delle stanze, personaggi a piedi, sciame di gnomi
```

Ogni nuovo sogno raccontato si aggiunge allo stesso mondo, con meccaniche che si intrecciano con quelle esistenti.
