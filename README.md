# Dreamgame

Un gioco 3D fatto di sogni veri, cuciti in **un'unica esperienza continua**: niente menu, niente livelli separati. I sogni non vengono ricostruiti alla lettera: se ne restituisce la *sensazione*, trasformata in meccaniche che convivono nello stesso mondo.

Tutto è generato nel codice: terreno, modelli, texture, musica ed effetti sonori (Three.js + Web Audio API). Non ci sono asset esterni.

## Come giocare

```bash
npm install
npm run dev        # apri l'indirizzo che compare (di solito http://localhost:5173)
npm run build      # versione statica in dist/
```

Dopo il clic iniziale sei subito nel sogno, al volante.

## Sogni raccontati finora

| # | Sogno | Nel gioco |
|---|-------|-------------|
| I | [La Fuga dal Demone](docs/sogni.md#i--la-fuga-dal-demone) | Guida folle in un campo sconfinato, un demone gigante che lancia macigni, una strada di montagna, un hotel di legno enorme. |

L'interpretazione di ogni sogno (cosa è diventato cosa, e perché) è in [docs/sogni.md](docs/sogni.md).

## Struttura

```
src/
  main.js            avvio, cambio di scena, ciclo di rendering
  core/              input, audio sintetizzato, UI/HUD, cielo, particelle, texture procedurali
  dreams/demone/     il campo, la macchina, il demone, i macigni, la strada, l'hotel
```

Ogni nuovo sogno raccontato si aggiunge allo stesso mondo, con meccaniche che si intrecciano con quelle esistenti.
