# Dreamgame

Un gioco 3D in cui **ogni sogno diventa un livello**. Nei livelli non si ricostruisce il sogno alla lettera: si cerca di restituire la *sensazione* che ha lasciato, trasformandola in meccaniche di gioco.

Tutto è generato nel codice: terreno, modelli, texture, musica ed effetti sonori (Three.js + Web Audio API). Non ci sono asset esterni.

## Come giocare

```bash
npm install
npm run dev        # apri l'indirizzo che compare (di solito http://localhost:5173)
npm run build      # versione statica in dist/
```

Si comincia nella **Stanza dei Sogni**, un'isola sospesa nel vuoto con il letto da cui ti sei appena alzato e una porta per ogni sogno. Per sognare basta attraversare una porta accesa. Le porte spente aspettano i sogni che verranno.

Scorciatoia per lo sviluppo: `?dream=demone` salta la stanza e apre direttamente il sogno.

## Sogni

| # | Sogno | Descrizione |
|---|-------|-------------|
| I | [La Fuga dal Demone](docs/sogni.md#i--la-fuga-dal-demone) | Guida folle in un campo sconfinato, un demone gigante che lancia macigni, una strada di montagna, un hotel di legno enorme. |

L'interpretazione di ogni sogno (cosa è diventato cosa, e perché) è in [docs/sogni.md](docs/sogni.md).

## Struttura

```
src/
  main.js            avvio, cambio di scena, ciclo di rendering
  core/              input, audio sintetizzato, UI/HUD, cielo, particelle, texture procedurali
  hub/Hub.js         la Stanza dei Sogni
  dreams/index.js    registro dei sogni (uno per porta)
  dreams/demone/     Sogno I: terreno, macchina, demone, macigni, hotel, scenario
```

Per aggiungere un sogno: si crea una cartella in `src/dreams/`, con una classe che espone `scene`, `camera`, `update(dt)` e `dispose()`, e la si registra in `src/dreams/index.js`. La porta nella stanza compare da sola.
